/**
 * @module acp/terminal-bridge
 * @layer L2 — ACP terminal bridge
 *
 * Implements ITerminal using ACP terminal methods when the client advertises
 * the capability, falling back to direct child_process.spawn otherwise.
 */

import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { TerminalHandle as AcpTerminalHandle } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import type { ITerminal, TerminalHandle, TerminalCreateOptions, ExitResult } from '../../types/registry.js';
import { spawn, type ChildProcess } from 'node:child_process';

// ---------------------------------------------------------------------------
// Internal handle union
// ---------------------------------------------------------------------------

/** Internal state for an ACP-backed terminal */
type AcpBackedHandle = {
  kind: 'acp';
  handle: TerminalHandle;
  acpHandle: AcpTerminalHandle;
};

/** Internal state for a directly-spawned terminal */
type SpawnBackedHandle = {
  kind: 'spawn';
  handle: TerminalHandle;
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
  startedAt: number;
  process: ChildProcess;
};

type InternalHandle = AcpBackedHandle | SpawnBackedHandle;

// ---------------------------------------------------------------------------
// AcpTerminal
// ---------------------------------------------------------------------------

/**
 * ITerminal implementation that routes terminal operations through the ACP
 * client when the client advertises the `terminal` capability, and falls back
 * to direct `child_process.spawn` otherwise.
 */
export class AcpTerminal implements ITerminal {
  /** Map from L0 TerminalHandle.id to internal state */
  private readonly _handles = new Map<string, InternalHandle>();
  private _nextId = 1;

  constructor(
    private readonly conn: AgentSideConnection,
    private readonly sessionId: string,
    private readonly clientCapabilities: schema.ClientCapabilities,
    private readonly cwd: string,
  ) {}

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  /**
   * Create a new terminal process.
   *
   * Routes to ACP terminal if the client advertises `terminal: true`,
   * otherwise spawns a child process directly.
   */
  async create(opts: TerminalCreateOptions): Promise<TerminalHandle> {
    const id = `term-${this._nextId++}`;
    const { command = '', env, cwd } = opts;
    const handle: TerminalHandle = {
      id,
      command,
      createdAt: Date.now(),
    };

    // Convert env Record to ACP EnvVariable array
    const envVars: schema.EnvVariable[] | undefined = env
      ? Object.entries(env).map(([name, value]) => ({ name, value }))
      : undefined;

    if (this.clientCapabilities.terminal) {
      // ACP-backed terminal
      const acpHandle = await this.conn.createTerminal({
        command,
        sessionId: this.sessionId,
        cwd: cwd ?? this.cwd,
        ...(envVars ? { env: envVars } : {}),
      });

      this._handles.set(id, { kind: 'acp', handle, acpHandle });
    } else {
      // Direct spawn fallback
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let exitCode: number | null = null;

      /**
       * Use shell: true for the spawn fallback because `command` is a bare string
       * (TerminalCreateOptions has no separate args array). Shell interpretation is
       * required to support pipes, redirects, and other shell features.
       * Tradeoff: slightly lower security due to shell injection risk if `command`
       * is user-controlled. Callers must sanitize untrusted command input.
       * shell: false would be preferred if args were supplied separately, as it
       * avoids shell interpretation entirely and reduces injection surface.
       */
      const useShell = true; // bare command strings may need shell interpretation
      const proc = spawn(command, [], {
        cwd: cwd ?? this.cwd,
        shell: useShell,
        stdio: 'pipe',
        env: env ? { ...process.env, ...env } : process.env,
      });

      const internal: SpawnBackedHandle = {
        kind: 'spawn',
        handle,
        stdout: stdoutChunks,
        stderr: stderrChunks,
        exitCode,
        startedAt: Date.now(),
        process: proc,
      };

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk.toString('utf-8'));
      });
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk.toString('utf-8'));
      });
      proc.on('exit', (code) => {
        internal.exitCode = code ?? -1;
      });

      this._handles.set(id, internal);
    }

    return handle;
  }

  // -------------------------------------------------------------------------
  // output
  // -------------------------------------------------------------------------

  /**
   * Get the current output of a terminal (stdout + stderr combined).
   */
  async output(handle: TerminalHandle, timeout?: number): Promise<{ output: string; exitCode: number | null }> {
    const internal = this._requireHandle(handle.id);

    if (internal.kind === 'acp') {
      // ISS-073: The ACP SDK's currentOutput() does not currently accept a timeout
      // parameter (Expected 0 arguments). The timeout is consumed locally via
      // Promise.race as a fallback. When the SDK is updated to accept a timeout,
      // forward it as: internal.acpHandle.currentOutput({ timeout })
      const outputPromise = internal.acpHandle.currentOutput();
      const result: schema.TerminalOutputResponse = timeout !== undefined
        ? await Promise.race([
            outputPromise,
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`output() timed out after ${timeout}ms`)), timeout)
            ),
          ])
        : await outputPromise;
      return {
        output: result.output,
        exitCode: result.exitStatus?.exitCode ?? null,
      };
    }

    // Spawn-backed: combine buffered stdout and stderr.
    // ACP spec (KB-07) expects combined terminal output in a single `output` field
    // (stdout + stderr interleaved, matching real terminal behavior).
    // Since we buffer stdout and stderr separately, we concatenate them here.
    // For interleaved order, refactor to push both into a single combined buffer.
    return {
      output: internal.stdout.join('') + internal.stderr.join(''),
      exitCode: internal.exitCode,
    };
  }

  // -------------------------------------------------------------------------
  // waitForExit
  // -------------------------------------------------------------------------

  /**
   * Wait for the terminal process to exit and return the result.
   *
   * For ACP-backed terminals, calls waitForExit() then fetches final output
   * via currentOutput() since WaitForTerminalExitResponse only carries exitCode.
   */
  async waitForExit(handle: TerminalHandle, timeout?: number): Promise<ExitResult> {
    const internal = this._requireHandle(handle.id);
    const startedAt = Date.now();

    if (internal.kind === 'acp') {
      const exitPromise = internal.acpHandle.waitForExit().then(async (exitResult) => {
        const outputResult: schema.TerminalOutputResponse = await internal.acpHandle.currentOutput();
        return {
          // ISS-146: Use -1 as sentinel for null exit code (consistent with spawn path
          // which stores code ?? -1 in the on-exit handler).
          exitCode: exitResult.exitCode ?? -1,
          stdout: outputResult.output,
          stderr: '',
          durationMs: Date.now() - startedAt,
        };
      });

      if (timeout !== undefined) {
        return Promise.race([
          exitPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`waitForExit() timed out after ${timeout}ms`)), timeout)
          ),
        ]);
      }
      return exitPromise;
    }

    // Spawn-backed: wait for the process to complete
    const spawnedAt = internal.startedAt;
    const proc = internal.process;

    const waitPromise = new Promise<ExitResult>((resolve) => {
      const finish = () => {
        resolve({
          exitCode: internal.exitCode ?? 0,
          stdout: internal.stdout.join(''),
          stderr: internal.stderr.join(''),
          durationMs: Date.now() - spawnedAt,
        });
      };

      if (proc.exitCode !== null) {
        // Already exited
        internal.exitCode = proc.exitCode;
        finish();
      } else {
        proc.once('exit', (code) => {
          internal.exitCode = code ?? -1;
          finish();
        });
      }
    });

    if (timeout !== undefined) {
      return Promise.race([
        waitPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`waitForExit() timed out after ${timeout}ms`)), timeout)
        ),
      ]);
    }
    return waitPromise;
  }

  // -------------------------------------------------------------------------
  // kill
  // -------------------------------------------------------------------------

  /**
   * Forcibly kill the terminal process.
   */
  async kill(handle: TerminalHandle): Promise<void> {
    const internal = this._requireHandle(handle.id);

    if (internal.kind === 'acp') {
      await internal.acpHandle.kill();
      return;
    }

    // Spawn-backed: send SIGTERM
    internal.process.kill('SIGTERM');
  }

  // -------------------------------------------------------------------------
  // release
  // -------------------------------------------------------------------------

  /**
   * Release a terminal and free its resources.
   *
   * For ACP-backed terminals: calls the ACP client's release() on the handle.
   * For spawn-backed terminals: kills the process if still running and removes the handle.
   */
  async release(handle: TerminalHandle): Promise<void> {
    const internal = this._requireHandle(handle.id);

    if (internal.kind === 'acp') {
      await internal.acpHandle.release();
    } else {
      // Spawn-backed: kill the process if still running
      if (internal.process.exitCode === null) {
        try {
          internal.process.kill('SIGTERM');
        } catch {
          // Process may have already exited; ignore
        }
      }
      // Clear buffers to free memory
      internal.stdout.length = 0;
      internal.stderr.length = 0;
    }

    this._handles.delete(handle.id);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _requireHandle(id: string): InternalHandle {
    const internal = this._handles.get(id);
    if (!internal) {
      throw new Error(`Terminal handle not found: ${id}`);
    }
    return internal;
  }
}
