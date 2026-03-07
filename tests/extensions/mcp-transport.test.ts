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
import { describe, test, expect } from 'bun:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { McpClient } from '../../src/extensions/mcp/transport.ts';
import type { ChildProcess } from 'node:child_process';

// ---------------------------------------------------------------------------
// MockProcess — simulates a ChildProcess with proper stream interfaces
// ---------------------------------------------------------------------------

type StdinWrite = { data: string; encoding: string };

/**
 * A minimal writable stdin that records all writes.
 * Uses PassThrough so it satisfies stream.Writable interface expected by ChildProcess.stdin.
 */
class MockStdin extends PassThrough {
  readonly writes: StdinWrite[] = [];

  write(chunk: string | Buffer | Uint8Array, encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    const encoding: BufferEncoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
    this.writes.push({ data, encoding });
    // Drain to avoid backpressure in PassThrough
    super.read();
    if (typeof encodingOrCallback === 'function') {
      encodingOrCallback();
    } else if (callback) {
      callback();
    }
    return true;
  }
}

/**
 * A readable stdout backed by PassThrough.
 * Calling respond() pushes a newline-delimited JSON-RPC response.
 */
class MockStdout extends PassThrough {}

class MockProcess extends EventEmitter {
  readonly stdin: MockStdin;
  readonly stdout: MockStdout;
  private _killed = false;

  constructor() {
    super();
    this.stdin = new MockStdin();
    this.stdout = new MockStdout();
  }

  get killed(): boolean {
    return this._killed;
  }

  kill(): boolean {
    this._killed = true;
    // Simulate exit after kill
    process.nextTick(() => this.emit('exit', null));
    return true;
  }

  /** Simulate the server writing a JSON-RPC response to stdout (newline-delimited) */
  respond(msg: object): void {
    process.nextTick(() => {
      this.stdout.push(JSON.stringify(msg) + '\n');
    });
  }

  /** Push raw text to stdout (for testing malformed input) */
  pushRaw(text: string): void {
    process.nextTick(() => {
      this.stdout.push(text);
    });
  }

  /** Simulate process exit */
  exit(code: number | null = 1): void {
    process.nextTick(() => this.emit('exit', code));
  }

  /** Simulate process error */
  processError(err: Error): void {
    process.nextTick(() => this.emit('error', err));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse all JSON-RPC messages written to stdin (excluding empty lines) */
function parseSentMessages(proc: MockProcess): Array<Record<string, unknown>> {
  return proc.stdin.writes
    .map((w) => w.data.trim())
    .filter(Boolean)
    .flatMap((line) => {
      // stdin.write may accumulate multiple JSON objects in one string if split differs
      return line.split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; }
      }).filter((x): x is Record<string, unknown> => x !== null);
    });
}

/** Create client + mock process */
function makeClient(): { client: McpClient; proc: MockProcess } {
  const proc = new MockProcess();
  const client = new McpClient(proc as unknown as ChildProcess);
  return { client, proc };
}

/**
 * Perform a full initialize handshake by intercepting the first write
 * and responding with a valid JSON-RPC result.
 */
async function initClient(client: McpClient, proc: MockProcess): Promise<void> {
  let responded = false;
  const originalWrite = proc.stdin.write.bind(proc.stdin);
  proc.stdin.write = function (chunk: string | Buffer | Uint8Array, ...rest: unknown[]): boolean {
    const data = typeof chunk === 'string' ? chunk : (chunk as Buffer).toString('utf8');
    // @ts-ignore
    const result = originalWrite(chunk, ...rest);
    if (!responded) {
      try {
        const lines = data.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const msg = JSON.parse(line) as { id: number; method: string };
          if (msg.method === 'initialize') {
            responded = true;
            proc.respond({ jsonrpc: '2.0', id: msg.id, result: { serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} } });
            break;
          }
        }
      } catch {
        // ignore parse errors
      }
    }
    return result;
  } as typeof proc.stdin.write;

  await client.initialize();
  // Restore original write
  proc.stdin.write = originalWrite;
}

// ---------------------------------------------------------------------------
// McpClient — constructor / isReady
// ---------------------------------------------------------------------------

describe('McpClient', () => {
  describe('constructor', () => {
    test('creates an instance from a ChildProcess', () => {
      const { client } = makeClient();
      expect(client).toBeInstanceOf(McpClient);
    });

    test('isReady is false before initialize()', () => {
      const { client } = makeClient();
      expect(client.isReady).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  describe('initialize()', () => {
    test('sends a JSON-RPC initialize request to stdin', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      const msgs = parseSentMessages(proc);
      const initReq = msgs.find((r) => r.method === 'initialize');
      expect(initReq).toBeDefined();
      expect(initReq?.jsonrpc).toBe('2.0');
      expect(typeof initReq?.id).toBe('number');
    });

    test('initialize request includes protocolVersion, capabilities, and clientInfo', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      const msgs = parseSentMessages(proc);
      const initReq = msgs.find((r) => r.method === 'initialize');
      const params = initReq?.params as Record<string, unknown> | undefined;
      expect(params?.protocolVersion).toBe('2024-11-05');
      expect(params?.capabilities).toBeDefined();
      expect(params?.clientInfo).toBeDefined();
    });

    test('sends notifications/initialized after initialize response', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      const msgs = parseSentMessages(proc);
      const notif = msgs.find((r) => r.method === 'notifications/initialized');
      expect(notif).toBeDefined();
      // Notifications have no id
      expect(notif?.id).toBeUndefined();
    });

    test('isReady returns true after successful initialize()', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);
      expect(client.isReady).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // listTools
  // -------------------------------------------------------------------------

  describe('listTools()', () => {
    test('sends a tools/list request', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      const toolDefs = [
        { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
      ];
      proc.respond({ jsonrpc: '2.0', id: 2, result: { tools: toolDefs } });

      await client.listTools();

      const msgs = parseSentMessages(proc);
      const listReq = msgs.find((r) => r.method === 'tools/list');
      expect(listReq).toBeDefined();
      expect(listReq?.jsonrpc).toBe('2.0');
    });

    test('returns the tool definitions from the response', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

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
      await initClient(client, proc);

      proc.respond({ jsonrpc: '2.0', id: 2, result: {} });

      const tools = await client.listTools();
      expect(tools).toEqual([]);
    });

    test('throws when called before initialize()', async () => {
      const { client } = makeClient();
      await expect(client.listTools()).rejects.toThrow('not initialized');
    });
  });

  // -------------------------------------------------------------------------
  // callTool
  // -------------------------------------------------------------------------

  describe('callTool()', () => {
    test('sends a tools/call request with name and arguments', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      const callResult = { content: [{ type: 'text', text: 'file contents' }], isError: false };
      proc.respond({ jsonrpc: '2.0', id: 2, result: callResult });

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
      await initClient(client, proc);

      const callResult = { content: [{ type: 'text', text: 'hello' }], isError: false };
      proc.respond({ jsonrpc: '2.0', id: 2, result: callResult });

      const result = await client.callTool('greet', {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('hello');
      expect(result.isError).toBe(false);
    });

    test('returns error result when isError is true', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      const errorResult = { content: [{ type: 'text', text: 'Permission denied' }], isError: true };
      proc.respond({ jsonrpc: '2.0', id: 2, result: errorResult });

      const result = await client.callTool('write_file', { path: '/etc/passwd' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Permission denied');
    });

    test('rejects when the JSON-RPC response contains an error field', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      proc.respond({ jsonrpc: '2.0', id: 2, error: { code: -32601, message: 'Method not found' } });

      await expect(client.callTool('nonexistent', {})).rejects.toThrow('Method not found');
    });

    test('throws when called before initialize()', async () => {
      const { client } = makeClient();
      await expect(client.callTool('read_file', {})).rejects.toThrow('not initialized');
    });

    test('throws when called after close()', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      // close() sets _closed immediately, then kills the process
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
      await initClient(client, proc);

      client.close();

      expect(proc.killed).toBe(true);
    });

    test('isReady returns false immediately after close()', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

      expect(client.isReady).toBe(true);
      client.close();
      expect(client.isReady).toBe(false);
    });

    test('calling close() twice does not throw', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

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
      await initClient(client, proc);

      // Start a listTools call but DO NOT respond — let the process exit instead
      const listPromise = client.listTools();
      proc.exit(1);

      await expect(listPromise).rejects.toThrow('exited');
    });

    test('emits exit event when the process exits', async () => {
      const { client, proc } = makeClient();

      const codes: Array<number | null> = [];
      client.on('exit', (code) => codes.push(code as number | null));

      proc.exit(42);
      await new Promise<void>((resolve) => setTimeout(resolve, 20));

      expect(codes).toHaveLength(1);
      expect(codes[0]).toBe(42);
    });

    test('rejects in-flight request when process emits error event', async () => {
      const { client, proc } = makeClient();
      await initClient(client, proc);

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

      // Push garbage first, then valid initialize response
      process.nextTick(() => {
        proc.stdout.push('not-json-garbage\n');
        proc.stdout.push('{ jsonrpc: invalid }\n');
        proc.stdout.push(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { capabilities: {} } }) + '\n');
      });

      await expect(client.initialize()).resolves.toBeUndefined();
    });

    test('ignores responses with unrecognized ids', async () => {
      const { client, proc } = makeClient();

      // Respond with unknown id first, then the real initialize response
      process.nextTick(() => {
        proc.stdout.push(JSON.stringify({ jsonrpc: '2.0', id: 999, result: 'unknown' }) + '\n');
        proc.stdout.push(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { capabilities: {} } }) + '\n');
      });

      await expect(client.initialize()).resolves.toBeUndefined();
    });
  });
});
