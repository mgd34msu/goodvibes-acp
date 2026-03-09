/**
 * Tests for McpClient (mcp/transport).
 *
 * Covers:
 *   - Constructor creates instance from a ChildProcess
 *   - isReady returns false before initialize()
 *   - initialize() sends JSON-RPC initialize request + notifications/initialized
 *   - isReady returns true after initialize(), false after close()
 *   - listTools() sends tools/list request and returns tool definitions
 *   - callTool() sends tools/call request and returns result
 *   - close() kills the subprocess and prevents further requests
 *   - Request rejection when process exits before response
 *   - JSON-RPC error responses reject the pending promise
 *   - Malformed/non-JSON stdout lines are ignored
 *   - listTools/callTool throw when called before initialize()
 *   - listTools/callTool throw when called after close()
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { McpClient } from '../../src/extensions/mcp/transport.ts';
import type { ChildProcess } from 'node:child_process';

// ---------------------------------------------------------------------------
// MockProcess — simulates a ChildProcess with proper stream interfaces
// ---------------------------------------------------------------------------

/** A minimal Writable stdin that records writes. */
class MockStdin extends Writable {
  readonly writes: string[] = [];

  _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (err?: Error | null) => void): void {
    this.writes.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    callback();
  }
}

/**
 * A Readable stdout backed by push().
 * Calling destroy() ends readline and releases the event loop.
 */
class MockStdout extends Readable {
  _read(): void {
    // Data pushed externally
  }
}

class MockProcess extends EventEmitter {
  readonly stdin: MockStdin;
  readonly stdout: MockStdout;
  private _killed = false;

  constructor() {
    super();
    this.stdin = new MockStdin();
    this.stdout = new MockStdout({ objectMode: false });
    // Prevent unhandled error events on the stdout stream from crashing
    this.stdout.on('error', () => {});
  }

  get killed(): boolean {
    return this._killed;
  }

  kill(): boolean {
    this._killed = true;
    // Simulate process exit asynchronously (like real child_process)
    setImmediate(() => this.emit('exit', null));
    return true;
  }

  /**
   * Push a JSON-RPC response to stdout (newline-delimited).
   * Scheduled with setImmediate so readline has time to set up its listener first.
   */
  respond(msg: object): void {
    setImmediate(() => {
      this.stdout.push(JSON.stringify(msg) + '\n');
    });
  }

  /** Push raw text synchronously (for robustness tests). */
  pushRaw(text: string): void {
    this.stdout.push(text);
  }

  /** Simulate process exit event */
  exit(code: number | null = 1): void {
    setImmediate(() => this.emit('exit', code));
  }

  /** Simulate process error event */
  processError(err: Error): void {
    setImmediate(() => this.emit('error', err));
  }

  /**
   * End/destroy streams to release readline and let the event loop drain.
   * Must be called at end of each test to prevent test-runner hang.
   */
  cleanup(): void {
    // destroy() is more reliable than push(null) for releasing readline's handle
    this.stdout.destroy();
    this.stdin.destroy();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse all JSON-RPC messages written to stdin */
function parseSentMessages(proc: MockProcess): Array<Record<string, unknown>> {
  const all: Array<Record<string, unknown>> = [];
  for (const chunk of proc.stdin.writes) {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        all.push(JSON.parse(trimmed) as Record<string, unknown>);
      } catch {
        // skip
      }
    }
  }
  return all;
}

/** Create client + mock process */
function makeClient(): { client: McpClient; proc: MockProcess } {
  const proc = new MockProcess();
  const client = new McpClient(proc as unknown as ChildProcess);
  // Suppress unhandled 'error' events on client (e.g. when process emits error)
  client.on('error', () => {});
  return { client, proc };
}

/**
 * Schedule initialize response for id=1 and complete the handshake.
 * The response MUST be scheduled before calling initialize() since
 * initialize() writes the request synchronously and then awaits the promise.
 */
async function doInit(client: McpClient, proc: MockProcess): Promise<void> {
  proc.respond({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} } });
  await client.initialize();
}

// ---------------------------------------------------------------------------
// Test state management
// ---------------------------------------------------------------------------

let activeProc: MockProcess | null = null;

function trackProc(proc: MockProcess): MockProcess {
  activeProc = proc;
  return proc;
}

afterEach(() => {
  if (activeProc) {
    activeProc.cleanup();
    activeProc = null;
  }
});

// ---------------------------------------------------------------------------
// McpClient — constructor / isReady
// ---------------------------------------------------------------------------

describe('McpClient', () => {
  describe('constructor', () => {
    test('creates an instance from a ChildProcess', () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      expect(client).toBeInstanceOf(McpClient);
    });

    test('isReady is false before initialize()', () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      expect(client.isReady).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  describe('initialize()', () => {
    test('sends a JSON-RPC initialize request to stdin', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      const msgs = parseSentMessages(proc);
      const initReq = msgs.find((r) => r.method === 'initialize');
      expect(initReq).toBeDefined();
      expect(initReq?.jsonrpc).toBe('2.0');
      expect(typeof initReq?.id).toBe('number');
    });

    test('initialize request includes protocolVersion, capabilities, and clientInfo', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      const msgs = parseSentMessages(proc);
      const params = msgs.find((r) => r.method === 'initialize')?.params as Record<string, unknown> | undefined;
      expect(params?.protocolVersion).toBe('2024-11-05');
      expect(params?.capabilities).toBeDefined();
      expect(params?.clientInfo).toBeDefined();
    });

    test('sends notifications/initialized after initialize response', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      const msgs = parseSentMessages(proc);
      const notif = msgs.find((r) => r.method === 'notifications/initialized');
      expect(notif).toBeDefined();
      // Notifications have no id field
      expect(notif?.id).toBeUndefined();
    });

    test('isReady returns true after successful initialize()', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);
      expect(client.isReady).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // listTools
  // -------------------------------------------------------------------------

  describe('listTools()', () => {
    test('sends a tools/list request', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      proc.respond({ jsonrpc: '2.0', id: 2, result: { tools: [] } });
      await client.listTools();

      const msgs = parseSentMessages(proc);
      const listReq = msgs.find((r) => r.method === 'tools/list');
      expect(listReq).toBeDefined();
      expect(listReq?.jsonrpc).toBe('2.0');
    });

    test('returns the tool definitions from the response', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      const toolDefs = [
        { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
        { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object' } },
      ];
      proc.respond({ jsonrpc: '2.0', id: 2, result: { tools: toolDefs } });
      const tools = await client.listTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('read_file');
      expect(tools[1].name).toBe('write_file');
    });

    test('returns empty array when response omits tools field', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      proc.respond({ jsonrpc: '2.0', id: 2, result: {} });
      const tools = await client.listTools();

      expect(tools).toEqual([]);
    });

    test('throws when called before initialize()', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);

      await expect(client.listTools()).rejects.toThrow('not initialized');
    });
  });

  // -------------------------------------------------------------------------
  // callTool
  // -------------------------------------------------------------------------

  describe('callTool()', () => {
    test('sends a tools/call request with name and arguments', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      proc.respond({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: 'ok' }], isError: false } });
      await client.callTool('read_file', { path: '/tmp/test.txt' });

      const msgs = parseSentMessages(proc);
      const callReq = msgs.find((r) => r.method === 'tools/call');
      expect(callReq).toBeDefined();
      const params = callReq?.params as Record<string, unknown> | undefined;
      expect(params?.name).toBe('read_file');
      expect((params?.arguments as Record<string, unknown>)?.path).toBe('/tmp/test.txt');
    });

    test('returns the McpCallResult from the response', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      const callResult = { content: [{ type: 'text', text: 'hello' }], isError: false };
      proc.respond({ jsonrpc: '2.0', id: 2, result: callResult });
      const result = await client.callTool('greet', {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('hello');
      expect(result.isError).toBe(false);
    });

    test('returns error result when isError is true', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      const errorResult = { content: [{ type: 'text', text: 'Permission denied' }], isError: true };
      proc.respond({ jsonrpc: '2.0', id: 2, result: errorResult });
      const result = await client.callTool('write_file', { path: '/etc/passwd' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Permission denied');
    });

    test('rejects when the JSON-RPC response contains an error field', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      proc.respond({ jsonrpc: '2.0', id: 2, error: { code: -32601, message: 'Method not found' } });
      await expect(client.callTool('nonexistent', {})).rejects.toThrow('Method not found');
    });

    test('throws when called before initialize()', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);

      await expect(client.callTool('read_file', {})).rejects.toThrow('not initialized');
    });

    test('throws when called after close()', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      // close() sets _closed synchronously before calling kill()
      client.close();
      await expect(client.callTool('read_file', {})).rejects.toThrow('closed');
    });
  });

  // -------------------------------------------------------------------------
  // close
  // -------------------------------------------------------------------------

  describe('close()', () => {
    test('kills the subprocess', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      client.close();

      expect(proc.killed).toBe(true);
    });

    test('isReady returns false immediately after close()', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      expect(client.isReady).toBe(true);
      client.close();
      expect(client.isReady).toBe(false);
    });

    test('calling close() twice does not throw', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      expect(() => {
        client.close();
        client.close();
      }).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Process exit — pending requests rejected
  // -------------------------------------------------------------------------

  describe('process exit', () => {
    test('rejects pending requests when the process exits', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      await doInit(client, proc);

      // Start a listTools call but do NOT respond — let the process exit instead
      const listPromise = client.listTools();
      proc.exit(1);

      await expect(listPromise).rejects.toThrow('exited');
    });

    test('emits exit event when the process exits', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);

      const codes: Array<number | null> = [];
      client.on('exit', (code) => codes.push(code as number | null));

      proc.exit(42);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      expect(codes).toHaveLength(1);
      expect(codes[0]).toBe(42);
    });

    test('rejects in-flight request when process emits error event', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);
      // client already has an error listener from makeClient(), so error won't throw
      await doInit(client, proc);

      const listPromise = client.listTools();
      proc.processError(new Error('ENOENT: spawn failed'));

      await expect(listPromise).rejects.toThrow('ENOENT');
    });
  });

  // -------------------------------------------------------------------------
  // Robustness — malformed stdout
  // -------------------------------------------------------------------------

  describe('robustness', () => {
    test('ignores non-JSON lines on stdout without throwing', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);

      // Push garbage followed by a valid initialize response, all in one setImmediate
      setImmediate(() => {
        proc.pushRaw('not-json-garbage\n');
        proc.pushRaw('{ invalid json }\n');
        proc.pushRaw(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { capabilities: {} } }) + '\n');
      });

      await expect(client.initialize()).resolves.toBeUndefined();
    });

    test('ignores responses with unrecognized ids', async () => {
      const { client, proc } = makeClient();
      trackProc(proc);

      // Unknown id first, then the real initialize response
      setImmediate(() => {
        proc.pushRaw(JSON.stringify({ jsonrpc: '2.0', id: 999, result: 'unknown' }) + '\n');
        proc.pushRaw(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { capabilities: {} } }) + '\n');
      });

      await expect(client.initialize()).resolves.toBeUndefined();
    });
  });
});
