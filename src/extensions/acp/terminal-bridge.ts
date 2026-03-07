/**
 * @module acp/terminal-bridge
 * @layer L2 — ACP terminal bridge
 *
 * Implements ITerminal using ACP terminal methods when the client advertises
 * the capability, falling back to direct child_process.spawn otherwise.
 */

import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import { TerminalHandle as AcpTerminalHandle } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import type { ITerminal, TerminalHandle, ExitResult } from '../../types/registry.js';
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
  async create(command: string, args?: string[]): Promise<TerminalHandle> {
    const id = `term-${this._nextId++}`;
    const fullCommand = args && args.length > 0 ? `${command} ${args.join(' ')}` : command;
    const handle: TerminalHandle = {
      id,
      command: fullCommand,
      createdAt: Date.now(),
    };

    if (this.clientCapabilities.terminal) {
      // ACP-backed terminal
      const acpHandle = await this.conn.createTerminal({
        command,
        args: args ?? [],
        sessionId: this.sessionId,
        cwd: this.cwd,
      });

      this._handles.set(id, { kind: 'acp', handle, acpHandle });
    } else {
      // Direct spawn fallback
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];
      let exitCode: number | null = null;

      const proc = spawn(command, args ?? [], {
        cwd: this.cwd,
        shell: false,
        stdio: 'pipe',
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
  async output(handle: TerminalHandle): Promise<string> {
    const internal = this._requireHandle(handle.id);

    if (internal.kind === 'acp') {
      const result = await internal.acpHandle.currentOutput();
      return result.output;
    }

    // Spawn-backed: combine buffered stdout
    return internal.stdout.join('');
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
  async waitForExit(handle: TerminalHandle): Promise<ExitResult> {
    const internal = this._requireHandle(handle.id);
    const startedAt = Date.now();

    if (internal.kind === 'acp') {
      const exitResult = await internal.acpHandle.waitForExit();
      const outputResult = await internal.acpHandle.currentOutput();
      return {
        exitCode: exitResult.exitCode ?? 0,
        stdout: outputResult.output,
        stderr: '',
        durationMs: Date.now() - startedAt,
      };
    }

    // Spawn-backed: wait for the process to complete
    const spawnedAt = internal.startedAt;
    const proc = internal.process;

    return new Promise<ExitResult>((resolve) => {
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
