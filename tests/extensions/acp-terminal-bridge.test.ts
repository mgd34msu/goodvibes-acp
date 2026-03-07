import { describe, test, expect, beforeEach } from 'bun:test';
import { AcpTerminal } from '../../src/extensions/acp/terminal-bridge.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Minimal mock connection — never called in no-capability tests
// ---------------------------------------------------------------------------

function makeConn(): AgentSideConnection {
  return {
    createTerminal: async () => { throw new Error('should not be called'); },
  } as unknown as AgentSideConnection;
}

// No-capability client: no terminal capability
const NO_CAPS: schema.ClientCapabilities = {};

// Temporary directory for spawned processes
const CWD = process.cwd();

// ---------------------------------------------------------------------------
// AcpTerminal — direct spawn fallback (no capabilities)
// ---------------------------------------------------------------------------

describe('AcpTerminal (no capabilities — direct spawn fallback)', () => {
  let terminal: AcpTerminal;

  beforeEach(() => {
    terminal = new AcpTerminal(makeConn(), 'sess-1', NO_CAPS, CWD);
  });

  test('create returns a TerminalHandle with id, command, createdAt', async () => {
    const handle = await terminal.create('echo', ['hello']);
    expect(handle.id).toMatch(/^term-\d+$/);
    expect(handle.command).toBe('echo hello');
    expect(typeof handle.createdAt).toBe('number');
    expect(handle.createdAt).toBeGreaterThan(0);
    await terminal.waitForExit(handle);
  });

  test('create with no args uses just the command', async () => {
    const handle = await terminal.create('true');
    expect(handle.command).toBe('true');
    await terminal.waitForExit(handle);
  });

  test('each create call produces a unique handle id', async () => {
    const h1 = await terminal.create('true');
    const h2 = await terminal.create('true');
    expect(h1.id).not.toBe(h2.id);
    await Promise.all([terminal.waitForExit(h1), terminal.waitForExit(h2)]);
  });

  test('waitForExit returns exitCode 0 for successful command', async () => {
    const handle = await terminal.create('true');
    const result = await terminal.waitForExit(handle);
    expect(result.exitCode).toBe(0);
  });

  test('waitForExit returns non-zero exitCode for failing command', async () => {
    const handle = await terminal.create('false');
    const result = await terminal.waitForExit(handle);
    expect(result.exitCode).not.toBe(0);
  });

  test('waitForExit captures stdout from echo', async () => {
    const handle = await terminal.create('echo', ['hello from test']);
    const result = await terminal.waitForExit(handle);
    expect(result.stdout).toContain('hello from test');
  });

  test('waitForExit returns durationMs greater than or equal to 0', async () => {
    const handle = await terminal.create('true');
    const result = await terminal.waitForExit(handle);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('output returns captured stdout before exit', async () => {
    const handle = await terminal.create('echo', ['buffered output']);
    // Wait for the process to complete so stdout is buffered
    await terminal.waitForExit(handle);
    const out = await terminal.output(handle);
    expect(out).toContain('buffered output');
  });

  test('kill terminates a running process without throwing', async () => {
    // sleep for a long time — we will kill it
    const handle = await terminal.create('sleep', ['10']);
    await expect(terminal.kill(handle)).resolves.toBeUndefined();
    // Allow process to clean up
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  });

  test('release removes the handle (subsequent waitForExit throws)', async () => {
    const handle = await terminal.create('true');
    await terminal.waitForExit(handle);
    await terminal.release(handle);
    // After release, the handle is gone
    await expect(terminal.waitForExit(handle)).rejects.toThrow(
      `Terminal handle not found: ${handle.id}`,
    );
  });

  test('release on running process kills it without throwing', async () => {
    const handle = await terminal.create('sleep', ['10']);
    await expect(terminal.release(handle)).resolves.toBeUndefined();
  });

  test('_requireHandle via waitForExit throws for unknown id', async () => {
    const fakeHandle = { id: 'nonexistent', command: 'true', createdAt: Date.now() };
    await expect(terminal.waitForExit(fakeHandle)).rejects.toThrow(
      'Terminal handle not found: nonexistent',
    );
  });

  test('waitForExit resolves immediately if process already exited', async () => {
    const handle = await terminal.create('true');
    // Give process time to exit on its own
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    // Should resolve immediately since exitCode is already set
    const result = await terminal.waitForExit(handle);
    expect(result.exitCode).toBe(0);
  });
});
