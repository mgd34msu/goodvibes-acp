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
import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// RequestTracker
// ---------------------------------------------------------------------------

/**
 * Minimal interface for tracking in-flight JSON-RPC request IDs sent to the client.
 * Used by bridge classes to register/unregister pending requests so GoodVibesAgent
 * can send `$/cancel_request` notifications during cascading cancellation.
 */
export interface RequestTracker {
  add(requestId: string): void;
  remove(requestId: string): void;
}

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
    private readonly _tracker?: RequestTracker,
    private readonly _eventBus?: EventBus,
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
    const { command = '', args, env, cwd, outputByteLimit } = opts;
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
      // ACP-backed terminal — track request for cascading cancellation
      const _reqId = crypto.randomUUID();
      this._tracker?.add(_reqId);
      this._eventBus?.emit('acp:client-request:start', { sessionId: this.sessionId, requestId: _reqId });
      let acpHandle: AcpTerminalHandle;
      try {
        acpHandle = await this.conn.createTerminal({
          command,
          sessionId: this.sessionId,
          cwd: cwd ?? this.cwd,
          ...(args !== undefined ? { args } : {}),
          ...(envVars ? { env: envVars } : {}),
          ...(outputByteLimit !== undefined ? { outputByteLimit } : {}),
        });
      } finally {
        this._tracker?.remove(_reqId);
        this._eventBus?.emit('acp:client-request:end', { sessionId: this.sessionId, requestId: _reqId });
      }

      this._handles.set(id, { kind: 'acp', handle, acpHandle });
    } else {
      // Direct spawn fallback
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let exitCode: number | null = null;

      /**
       * When `args` is provided, use shell: false to avoid shell interpretation
       * and eliminate shell injection risk entirely.
       * When only a command string is provided (no args), fall back to shell: true
       * for compatibility with pipes, redirects, and compound shell expressions.
       * In the shell: true path, the permission gate (ISS-021) is the intended
       * mitigation for injection risk from caller-controlled command strings.
       */
      const proc = args !== undefined
        ? spawn(command, args, {
            cwd: cwd ?? this.cwd,
            shell: false,
            stdio: 'pipe',
            env: env ? { ...process.env, ...env } : process.env,
          })
        : spawn(command, [], {
            cwd: cwd ?? this.cwd,
            shell: true,
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
      let outputTimer: ReturnType<typeof setTimeout> | undefined;
      const result: schema.TerminalOutputResponse = timeout !== undefined
        ? await Promise.race([
            outputPromise,
            new Promise<never>((_, reject) => {
              outputTimer = setTimeout(() => reject(new Error(`output() timed out after ${timeout}ms`)), timeout);
            }),
          ]).finally(() => clearTimeout(outputTimer))
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
        let acpExitTimer: ReturnType<typeof setTimeout> | undefined;
        return Promise.race([
          exitPromise,
          new Promise<never>((_, reject) => {
            acpExitTimer = setTimeout(() => reject(new Error(`waitForExit() timed out after ${timeout}ms`)), timeout);
          }),
        ]).finally(() => clearTimeout(acpExitTimer));
      }
      return exitPromise;
    }

    // Spawn-backed: wait for the process to complete
    const spawnedAt = internal.startedAt;
    const proc = internal.process;

    const waitPromise = new Promise<ExitResult>((resolve) => {
      const finish = () => {
        resolve({
          exitCode: internal.exitCode ?? -1,
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
      let spawnExitTimer: ReturnType<typeof setTimeout> | undefined;
      return Promise.race([
        waitPromise,
        new Promise<never>((_, reject) => {
          spawnExitTimer = setTimeout(() => reject(new Error(`waitForExit() timed out after ${timeout}ms`)), timeout);
        }),
      ]).finally(() => clearTimeout(spawnExitTimer));
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
