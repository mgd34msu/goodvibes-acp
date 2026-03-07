/**
 * @module plugins/precision/exec
 * @layer L3 — plugin
 *
 * PrecisionExec — command execution with stdout/stderr capture, timeout,
 * per-command expectations, and optional background (detached) process support.
 *
 * Uses node:child_process spawn for cross-platform compatibility.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** Expectations to assert on a completed command */
export type CommandExpect = {
  /** Expected exit code (default: no assertion) */
  exit_code?: number;
  /** String that stdout should contain */
  stdout_contains?: string;
  /** String that stderr should contain */
  stderr_contains?: string;
};

/** A single command to execute */
export type CommandSpec = {
  /** Shell command string */
  cmd: string;
  /** Working directory for this command (default: params.working_dir or cwd) */
  cwd?: string;
  /** Timeout in milliseconds (default: params.timeout_ms or 120_000) */
  timeout_ms?: number;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Expectations to verify on completion */
  expect?: CommandExpect;
  /** Run in background — return immediately without waiting for exit */
  background?: boolean;
};

/** Parameters for PrecisionExec.run() */
export type ExecParams = {
  /** Commands to execute */
  commands: CommandSpec[];
  /** Global working directory (used when per-command cwd is absent) */
  working_dir?: string;
  /** Global timeout in milliseconds (default: 120_000) */
  timeout_ms?: number;
  /** Execute commands in parallel (default: false — sequential) */
  parallel?: boolean;
  /** Stop sequence on first failure (default: true, sequential only) */
  fail_fast?: boolean;
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Result of a single command execution */
export type CommandResult = {
  /** The command that was run */
  cmd: string;
  /** Exit code (null if timed out or killed) */
  exit_code: number | null;
  /** Captured stdout */
  stdout: string;
  /** Captured stderr */
  stderr: string;
  /** Execution duration in milliseconds */
  duration_ms: number;
  /** Whether the command timed out */
  timed_out: boolean;
  /** Whether expectations were met */
  expectations_met: boolean;
  /** Expectation failure message if expectations were not met */
  expectation_error?: string;
  /** Background process ID (only present when background: true) */
  background_pid?: number;
};

/** Overall result from PrecisionExec.run() */
export type ExecResult = {
  /** Per-command results */
  results: CommandResult[];
  /** Whether all commands succeeded (exit 0 and expectations met) */
  all_passed: boolean;
  /** Total execution duration in milliseconds */
  duration_ms: number;
};

// ---------------------------------------------------------------------------
// Single command runner
// ---------------------------------------------------------------------------

/**
 * Run a single command, capturing stdout and stderr.
 * Resolves with a CommandResult regardless of exit code.
 */
function runCommand(
  spec: CommandSpec,
  globalCwd: string,
  globalTimeoutMs: number
): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve) => {
    const startMs = Date.now();
    const cwd = spec.cwd ? path.resolve(spec.cwd) : globalCwd;
    const timeoutMs = spec.timeout_ms ?? globalTimeoutMs;

    // Merge environment: inherit process.env, then apply custom vars
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    if (spec.env) {
      for (const [k, v] of Object.entries(spec.env)) {
        env[k] = v;
      }
    }

    // Background / detached mode
    if (spec.background) {
      const child = spawn(spec.cmd, [], {
        cwd,
        env,
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      resolve({
        cmd: spec.cmd,
        exit_code: null,
        stdout: '',
        stderr: '',
        duration_ms: Date.now() - startMs,
        timed_out: false,
        expectations_met: true,
        background_pid: child.pid,
      });
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn(spec.cmd, [], {
      cwd,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGTERM');
        // Force kill after 3 seconds if still running
        setTimeout(() => {
          try { child.kill('SIGKILL'); } catch { /* already dead */ }
        }, 3000);
      } catch { /* already exited */ }
    }, timeoutMs);

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      const duration = Date.now() - startMs;
      resolve({
        cmd: spec.cmd,
        exit_code: null,
        stdout: '',
        stderr: err.message,
        duration_ms: duration,
        timed_out: false,
        expectations_met: false,
        expectation_error: `Spawn error: ${err.message}`,
      });
    });

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      const duration = Date.now() - startMs;
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      const exitCode = timedOut ? null : code;

      // Check expectations
      let expectationsMet = true;
      let expectationError: string | undefined;

      if (spec.expect && !timedOut) {
        const { exit_code, stdout_contains, stderr_contains } = spec.expect;
        if (exit_code !== undefined && exitCode !== exit_code) {
          expectationsMet = false;
          expectationError = `Expected exit code ${exit_code}, got ${exitCode}`;
        } else if (stdout_contains !== undefined && !stdout.includes(stdout_contains)) {
          expectationsMet = false;
          expectationError = `stdout did not contain: ${stdout_contains}`;
        } else if (stderr_contains !== undefined && !stderr.includes(stderr_contains)) {
          expectationsMet = false;
          expectationError = `stderr did not contain: ${stderr_contains}`;
        }
      } else if (timedOut) {
        expectationsMet = false;
        expectationError = `Command timed out after ${timeoutMs}ms`;
      }

      resolve({
        cmd: spec.cmd,
        exit_code: exitCode,
        stdout,
        stderr,
        duration_ms: duration,
        timed_out: timedOut,
        expectations_met: expectationsMet,
        expectation_error: expectationError,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// PrecisionExec
// ---------------------------------------------------------------------------

/** Command execution tool — runs shell commands with capture and assertions */
export class PrecisionExec {
  /**
   * Execute commands sequentially or in parallel.
   * Never throws — errors are captured in per-command results.
   */
  async run(params: ExecParams): Promise<ExecResult> {
    const startMs = Date.now();
    const globalCwd = path.resolve(params.working_dir ?? process.cwd());
    const globalTimeout = params.timeout_ms ?? 120_000;
    const failFast = params.fail_fast ?? true;
    const parallel = params.parallel ?? false;

    let results: CommandResult[];

    if (parallel) {
      // Execute all commands concurrently
      results = await Promise.all(
        params.commands.map((cmd) => runCommand(cmd, globalCwd, globalTimeout))
      );
    } else {
      // Execute sequentially, respecting fail_fast
      results = [];
      for (const cmdSpec of params.commands) {
        const result = await runCommand(cmdSpec, globalCwd, globalTimeout);
        results.push(result);

        const failed = result.timed_out ||
          result.exit_code !== 0 ||
          !result.expectations_met;

        if (failed && failFast) break;
      }
    }

    const allPassed = results.every(
      (r) => !r.timed_out && r.exit_code === 0 && r.expectations_met
    );

    return {
      results,
      all_passed: allPassed,
      duration_ms: Date.now() - startMs,
    };
  }
}
