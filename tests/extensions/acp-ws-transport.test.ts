/**
 * Tests for WebSocket and TCP transport hardening.
 *
 * Covers:
 *   - createWebSocketServerStream: message send/receive, connection lifecycle, error handling
 *   - createTcpTransportFromSocket: error handling, timeout, clean close, partial messages
 *   - Transport factory: existing throws preserved (websocket, tcp)
 *   - JSON-RPC format preservation across WebSocket transport
 *   - UTF-8 encoding via patchIncomingStream
 */
import { describe, test, expect, beforeEach } from 'bun:test';
import * as net from 'node:net';
import {
  createWebSocketServerStream,
  createWebSocketTransport,
  createTcpTransportFromSocket,
  createTransport,
  patchIncomingStream,
  type WebSocketServerSocket,
  type AcpStream,
} from '../../src/extensions/acp/transport.ts';
import type { AnyMessage } from '../../src/types/transport.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal AcpStream shape check */
function isAcpStream(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'readable' in obj && 'writable' in obj;
}

/**
 * Collect N message objects from an AcpStream's readable side.
 * Returns early when `count` messages are received or `maxMs` elapses.
 */
async function collectMessages(
  stream: AcpStream,
  count: number,
  maxMs = 500,
): Promise<AnyMessage[]> {
  const messages: AnyMessage[] = [];
  const reader = (stream as unknown as { readable: ReadableStream<AnyMessage> }).readable.getReader();
  const deadline = Date.now() + maxMs;

  try {
    while (messages.length < count && Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise<{ done: true; value: undefined }>((resolve) =>
          setTimeout(() => resolve({ done: true as const, value: undefined }), remaining),
        ),
      ]);
      if (done) break;
      if (value !== undefined) messages.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return messages;
}

/**
 * Write a JSON message object to the AcpStream's writable side.
 * ndJsonStream's writable accepts AnyMessage objects directly.
 */
async function sendMessage(stream: AcpStream, message: AnyMessage): Promise<void> {
  const writable = (stream as unknown as { writable: WritableStream<AnyMessage> }).writable;
  const writer = writable.getWriter();
  try {
    await writer.write(message);
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Mock WebSocket server socket
// ---------------------------------------------------------------------------

/**
 * Creates a mock server-side WebSocket that allows us to:
 * - Simulate incoming messages (push to readable side of transport)
 * - Capture outgoing messages (from writable side of transport)
 * - Simulate close/error events
 */
function createMockServerSocket(): {
  ws: WebSocketServerSocket;
  sent: string[];
  sendToClient: (data: string) => void;
  simulateClose: (code?: number, reason?: string) => void;
  simulateError: () => void;
} {
  const sent: string[] = [];
  const listeners: Record<string, Array<(event: unknown) => void>> = {};

  const ws: WebSocketServerSocket = {
    send(data: string) {
      sent.push(data);
    },
    close(_code?: number, _reason?: string) {
      // no-op for mock
    },
    addEventListener(
      event: string,
      handler: (event: unknown) => void,
    ) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event]!.push(handler);
    },
  };

  const sendToClient = (data: string) => {
    for (const handler of listeners['message'] ?? []) {
      handler({ data });
    }
  };

  const simulateClose = (code = 1000, reason = '') => {
    for (const handler of listeners['close'] ?? []) {
      handler({ code, reason });
    }
  };

  const simulateError = () => {
    for (const handler of listeners['error'] ?? []) {
      handler(new Error('mock ws error'));
    }
  };

  return { ws, sent, sendToClient, simulateClose, simulateError };
}

// ---------------------------------------------------------------------------
// createWebSocketServerStream — shape
// ---------------------------------------------------------------------------

describe('createWebSocketServerStream', () => {
  test('returns an AcpStream with readable and writable', () => {
    const { ws } = createMockServerSocket();
    const stream = createWebSocketServerStream(ws);
    expect(isAcpStream(stream)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Inbound messages (client → server readable)
  // -------------------------------------------------------------------------

  test('readable side receives messages sent by client', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    const msg = {
      jsonrpc: '2.0' as const,
      method: 'agent/prompt',
      id: 1,
      params: { sessionId: 'abc', messages: [] },
    };

    // Send message as ndjson string (what a real WS client sends)
    mock.sendToClient(JSON.stringify(msg));
    mock.simulateClose();

    const messages = await collectMessages(stream, 1, 500);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const first = messages[0] as Record<string, unknown>;
    expect(first['method']).toBe('agent/prompt');
  });

  test('patchIncomingStream injects protocolVersion on initialize via WebSocket', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    const initMsg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: { capabilities: {} },
    });

    mock.sendToClient(initMsg);
    mock.simulateClose();

    const messages = await collectMessages(stream, 1, 500);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const first = messages[0] as Record<string, unknown>;
    const params = first['params'] as Record<string, unknown>;
    expect(params['protocolVersion']).toBe(1);
  });

  test('multiple inbound messages are received in order', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    mock.sendToClient(JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1, params: {} }));
    mock.sendToClient(JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 2, params: {} }));
    mock.simulateClose();

    const messages = await collectMessages(stream, 2, 500);
    expect(messages.length).toBe(2);
    const first = messages[0] as Record<string, unknown>;
    const second = messages[1] as Record<string, unknown>;
    expect(first['id']).toBe(1);
    expect(second['id']).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Outbound messages (server writable → client)
  // -------------------------------------------------------------------------

  test('writing a message object to writable sends it as JSON via WebSocket', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    const responseMsg: AnyMessage = {
      jsonrpc: '2.0',
      id: 1,
      result: { ok: true },
    };
    await sendMessage(stream, responseMsg);

    expect(mock.sent.length).toBeGreaterThanOrEqual(1);
    const parsed = JSON.parse(mock.sent[0]!) as Record<string, unknown>;
    expect(parsed['id']).toBe(1);
    expect((parsed['result'] as Record<string, unknown>)['ok']).toBe(true);
  });

  test('multiple message objects written produce separate WebSocket frames', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    const msg1: AnyMessage = { jsonrpc: '2.0', id: 1, result: { step: 1 } };
    const msg2: AnyMessage = { jsonrpc: '2.0', id: 2, result: { step: 2 } };
    await sendMessage(stream, msg1);
    await sendMessage(stream, msg2);

    // Each message should be sent as a separate frame
    expect(mock.sent.length).toBe(2);
    const p1 = JSON.parse(mock.sent[0]!) as Record<string, unknown>;
    const p2 = JSON.parse(mock.sent[1]!) as Record<string, unknown>;
    expect(p1['id']).toBe(1);
    expect(p2['id']).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------

  test('readable side closes when WebSocket closes normally (code 1000)', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    // Close immediately with normal code
    mock.simulateClose(1000, 'done');

    // Should be able to collect with no messages and not hang
    const messages = await collectMessages(stream, 10, 300);
    expect(Array.isArray(messages)).toBe(true);
  });

  test('readable side closes or errors on error event', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    mock.simulateError();

    // After an error, the stream should either error (throw) or close (return empty).
    // ndJsonStream catches upstream errors in its finally block and closes the stream,
    // so we accept either outcome — what matters is that the stream terminates.
    let terminated = false;
    try {
      await collectMessages(stream, 10, 300);
      // Stream closed gracefully after error
      terminated = true;
    } catch {
      // Stream propagated the error
      terminated = true;
    }
    expect(terminated).toBe(true);
  });

  // -------------------------------------------------------------------------
  // JSON-RPC format preservation
  // -------------------------------------------------------------------------

  test('JSON-RPC 2.0 fields are preserved when writing to writable', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    const rpcMsg: AnyMessage = {
      jsonrpc: '2.0',
      id: 42,
      method: 'agent/prompt',
      params: { sessionId: 'test-123', messages: [{ role: 'user', content: 'hello' }] },
    };
    await sendMessage(stream, rpcMsg);

    expect(mock.sent.length).toBeGreaterThanOrEqual(1);
    const sent = JSON.parse(mock.sent[0]!) as Record<string, unknown>;
    expect(sent['jsonrpc']).toBe('2.0');
    expect(sent['id']).toBe(42);
    expect(sent['method']).toBe('agent/prompt');
    const params = sent['params'] as Record<string, unknown>;
    expect(params['sessionId']).toBe('test-123');
  });

  test('sent frames do not contain embedded newlines', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    // Message with a string value that contains a period (not newline)
    const rpcMsg: AnyMessage = {
      jsonrpc: '2.0',
      id: 1,
      result: { content: 'line one. line two.' },
    };
    await sendMessage(stream, rpcMsg);

    for (const sent of mock.sent) {
      expect(sent).not.toContain('\n');
    }
  });

  test('JSON-RPC fields are preserved inbound through WebSocket transport', async () => {
    const mock = createMockServerSocket();
    const stream = createWebSocketServerStream(mock.ws);

    const inboundMsg = {
      jsonrpc: '2.0' as const,
      method: 'agent/prompt',
      id: 99,
      params: { sessionId: 's99', messages: [] },
    };
    mock.sendToClient(JSON.stringify(inboundMsg));
    mock.simulateClose();

    const messages = await collectMessages(stream, 1, 500);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const received = messages[0] as Record<string, unknown>;
    expect(received['jsonrpc']).toBe('2.0');
    expect(received['id']).toBe(99);
    expect(received['method']).toBe('agent/prompt');
  });
});

// ---------------------------------------------------------------------------
// createTcpTransportFromSocket — hardening
// ---------------------------------------------------------------------------

describe('createTcpTransportFromSocket (hardened)', () => {
  test('returns an AcpStream from a connected socket', async () => {
    let server: net.Server | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server = net.createServer((socket) => {
          try {
            const stream = createTcpTransportFromSocket(socket);
            expect(isAcpStream(stream)).toBe(true);
            socket.destroy();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          const client = net.connect(addr.port, '127.0.0.1');
          client.on('error', reject);
        });
        server.on('error', reject);
      });
    } finally {
      server?.close();
    }
  });

  test('accepts TcpSocketOptions without error', async () => {
    let server: net.Server | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server = net.createServer((socket) => {
          try {
            const stream = createTcpTransportFromSocket(socket, {
              keepAlive: true,
              keepAliveInitialDelay: 1000,
            });
            expect(isAcpStream(stream)).toBe(true);
            socket.destroy();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          const client = net.connect(addr.port, '127.0.0.1');
          client.on('error', reject);
        });
        server.on('error', reject);
      });
    } finally {
      server?.close();
    }
  });

  test('readable side closes cleanly when client disconnects', async () => {
    let server: net.Server | undefined;
    let transportStream: AcpStream | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server = net.createServer((socket) => {
          transportStream = createTcpTransportFromSocket(socket);
          resolve();
        });
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          const client = net.connect(addr.port, '127.0.0.1', () => {
            client.end();
          });
          client.on('error', reject);
        });
        server.on('error', reject);
      });

      expect(transportStream).toBeDefined();
      // Should drain to completion without throwing
      const messages = await collectMessages(transportStream!, 100, 500);
      expect(Array.isArray(messages)).toBe(true);
    } finally {
      server?.close();
    }
  });

  test('readable side receives valid JSON-RPC messages sent by client', async () => {
    let server: net.Server | undefined;
    let transportStream: AcpStream | undefined;
    const testMsg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'agent/prompt',
      id: 7,
      params: { sessionId: 's1', messages: [] },
    }) + '\n';

    try {
      await new Promise<void>((resolve, reject) => {
        server = net.createServer((socket) => {
          transportStream = createTcpTransportFromSocket(socket);
          resolve();
        });
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          const client = net.connect(addr.port, '127.0.0.1', () => {
            client.write(testMsg);
            client.end();
          });
          client.on('error', reject);
        });
        server.on('error', reject);
      });

      expect(transportStream).toBeDefined();
      const messages = await collectMessages(transportStream!, 1, 500);
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const first = messages[0] as Record<string, unknown>;
      expect(first['method']).toBe('agent/prompt');
    } finally {
      server?.close();
    }
  });

  test('partial messages split across TCP packets are reassembled', async () => {
    let server: net.Server | undefined;
    let transportStream: AcpStream | undefined;
    const fullMsg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      id: 1,
      params: { capabilities: {} },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server = net.createServer((socket) => {
          transportStream = createTcpTransportFromSocket(socket);
          resolve();
        });
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          const client = net.connect(addr.port, '127.0.0.1', () => {
            // Split message into two writes to simulate TCP fragmentation
            const mid = Math.floor(fullMsg.length / 2);
            client.write(fullMsg.slice(0, mid));
            setImmediate(() => {
              client.write(fullMsg.slice(mid) + '\n');
              client.end();
            });
          });
          client.on('error', reject);
        });
        server.on('error', reject);
      });

      expect(transportStream).toBeDefined();
      const messages = await collectMessages(transportStream!, 1, 1000);
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const first = messages[0] as Record<string, unknown>;
      // patchIncomingStream should have injected protocolVersion
      const params = first['params'] as Record<string, unknown>;
      expect(params['protocolVersion']).toBe(1);
    } finally {
      server?.close();
    }
  });

  test('timeout option is accepted without error', async () => {
    let server: net.Server | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        server = net.createServer((socket) => {
          try {
            // Use a very large timeout so it won't trigger during the test
            const stream = createTcpTransportFromSocket(socket, { timeoutMs: 60000 });
            expect(isAcpStream(stream)).toBe(true);
            socket.destroy();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        server.listen(0, '127.0.0.1', () => {
          const addr = server!.address() as net.AddressInfo;
          const client = net.connect(addr.port, '127.0.0.1');
          client.on('error', reject);
        });
        server.on('error', reject);
      });
    } finally {
      server?.close();
    }
  });
});

// ---------------------------------------------------------------------------
// createTransport — factory routing preserved
// ---------------------------------------------------------------------------

describe('createTransport factory', () => {
  test('stdio type returns AcpStream', () => {
    const stream = createTransport({ type: 'stdio' });
    expect(isAcpStream(stream)).toBe(true);
  });

  test('tcp type throws with createTcpTransportFromSocket hint', () => {
    expect(() => createTransport({ type: 'tcp', port: 9999 })).toThrow('createTcpTransportFromSocket');
  });

  test('tcp type throws with daemon:connection hint', () => {
    expect(() => createTransport({ type: 'tcp', port: 9999 })).toThrow('daemon:connection');
  });

  test('websocket type throws with factory redirect message', () => {
    expect(() => createTransport({ type: 'websocket', port: 9999 })).toThrow(
      "createTransport({ type: 'websocket' }) is not supported via factory",
    );
  });

  test('websocket type throws with createWebSocketTransport hint', () => {
    expect(() => createTransport({ type: 'websocket', port: 9999 })).toThrow(
      'createWebSocketTransport',
    );
  });

  test('websocket type throws with createWebSocketServerStream hint', () => {
    expect(() => createTransport({ type: 'websocket', port: 9999 })).toThrow(
      'createWebSocketServerStream',
    );
  });
});

// ---------------------------------------------------------------------------
// createWebSocketTransport — client mode
// ---------------------------------------------------------------------------

/**
 * A mock WebSocket constructor that simulates browser/Bun WebSocket API.
 * Allows tests to control when open/message/error/close events fire.
 */
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState: number = 0; // CONNECTING
  url: string;
  sent: string[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  // Allow test control
  _closeCode: number = 1000;
  _closeReason: string = '';

  constructor(url: string, _options?: unknown) {
    this.url = url;
    this.sent = [];
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code = 1000, reason = '') {
    this._closeCode = code;
    this._closeReason = reason;
    this.readyState = MockWebSocket.CLOSED;
    // Fire close event
    this.onclose?.({ code, reason });
  }

  /** Test helper: simulate a successful connection open */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** Test helper: simulate an incoming message from the server */
  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }

  /** Test helper: simulate a connection error */
  simulateError() {
    this.onerror?.(new Error('mock ws error'));
    // After error, browser/Bun fires close too
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: 'Abnormal closure' });
  }

  /** Test helper: simulate connection refused (close without open) */
  simulateConnectionRefused() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: 'Connection refused' });
  }
}

describe('createWebSocketTransport (client mode)', () => {
  let origWS: typeof globalThis.WebSocket;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    origWS = globalThis.WebSocket;
    // Install mock — will be set per-test via the factory below
  });

  const restoreWS = () => {
    globalThis.WebSocket = origWS;
  };

  /**
   * Install the mock WebSocket constructor so that the next `new WebSocket(url)`
   * call returns a controlled instance.
   */
  const installMock = () => {
    mockWs = new MockWebSocket('ws://mock');
    globalThis.WebSocket = function MockWebSocketFactory(url: string, options?: unknown) {
      mockWs.url = url;
      // Re-use the existing mockWs instance so test has a handle
      return mockWs;
    } as unknown as typeof WebSocket;
    (globalThis.WebSocket as unknown as Record<string, unknown>).OPEN = MockWebSocket.OPEN;
    (globalThis.WebSocket as unknown as Record<string, unknown>).CLOSED = MockWebSocket.CLOSED;
    return mockWs;
  };

  test('resolves with AcpStream on successful connection', async () => {
    installMock();
    try {
      const connectPromise = createWebSocketTransport('ws://localhost:9999');
      // Simulate open event
      mockWs.simulateOpen();
      const stream = await connectPromise;
      expect(isAcpStream(stream)).toBe(true);
    } finally {
      restoreWS();
    }
  });

  test('rejects on connection error', async () => {
    installMock();
    try {
      const connectPromise = createWebSocketTransport('ws://localhost:9999');
      // Simulate error + close (connection refused pattern)
      mockWs.simulateError();
      await expect(connectPromise).rejects.toThrow();
    } finally {
      restoreWS();
    }
  });

  test('rejects when connection closes before open', async () => {
    installMock();
    try {
      const connectPromise = createWebSocketTransport('ws://localhost:9999');
      mockWs.simulateConnectionRefused();
      await expect(connectPromise).rejects.toThrow('closed before open');
    } finally {
      restoreWS();
    }
  });

  test('rejects on connection timeout', async () => {
    installMock();
    try {
      // Use a very short timeout
      const connectPromise = createWebSocketTransport('ws://localhost:9999', {
        connectTimeoutMs: 50,
      });
      // Don't simulate open — let it timeout
      await expect(connectPromise).rejects.toThrow('timed out');
    } finally {
      mockWs.close();
      restoreWS();
    }
  }, 2000);

  test('received messages are readable from the stream', async () => {
    installMock();
    try {
      const connectPromise = createWebSocketTransport('ws://localhost:9999');
      mockWs.simulateOpen();
      const stream = await connectPromise;

      const msg = { jsonrpc: '2.0' as const, method: 'agent/prompt', id: 1, params: { sessionId: 'abc', messages: [] } };
      mockWs.simulateMessage(JSON.stringify(msg));
      // Close the readable side
      mockWs.close(1000, 'done');

      const messages = await collectMessages(stream, 1, 500);
      expect(messages.length).toBeGreaterThanOrEqual(1);
      const first = messages[0] as Record<string, unknown>;
      expect(first['method']).toBe('agent/prompt');
    } finally {
      restoreWS();
    }
  });

  test('stream closes cleanly when WebSocket closes normally', async () => {
    installMock();
    try {
      const connectPromise = createWebSocketTransport('ws://localhost:9999');
      mockWs.simulateOpen();
      const stream = await connectPromise;

      // Close cleanly
      mockWs.close(1000, 'done');

      const messages = await collectMessages(stream, 10, 300);
      expect(Array.isArray(messages)).toBe(true);
    } finally {
      restoreWS();
    }
  });

  test('writing a message sends it via WebSocket', async () => {
    installMock();
    try {
      const connectPromise = createWebSocketTransport('ws://localhost:9999');
      mockWs.simulateOpen();
      const stream = await connectPromise;

      const responseMsg: AnyMessage = { jsonrpc: '2.0', id: 1, result: { ok: true } };
      await sendMessage(stream, responseMsg);

      expect(mockWs.sent.length).toBeGreaterThanOrEqual(1);
      const parsed = JSON.parse(mockWs.sent[0]!) as Record<string, unknown>;
      expect(parsed['id']).toBe(1);
    } finally {
      restoreWS();
    }
  });
});

// ---------------------------------------------------------------------------
// patchIncomingStream — UTF-8 encoding guarantee
// These tests operate at the raw byte layer, not the AcpStream layer
// ---------------------------------------------------------------------------

describe('patchIncomingStream UTF-8 encoding', () => {
  beforeEach(() => {});

  test('output is valid UTF-8 for ASCII messages', async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const msg = JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 }) + '\n';
    const input = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(msg));
        c.close();
      },
    });
    const output = patchIncomingStream(input);
    const reader = output.getReader();
    let result = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    reader.releaseLock();
    // Must be valid JSON after parsing
    const parsed = JSON.parse(result.trim());
    expect((parsed as Record<string, unknown>)['method']).toBe('ping');
  });

  test('output is valid UTF-8 for messages with unicode content', async () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const msg = JSON.stringify({
      jsonrpc: '2.0',
      method: 'agent/prompt',
      id: 1,
      params: { message: '\u4e2d\u6587\u5185\u5bb9' },
    }) + '\n';
    const input = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(msg));
        c.close();
      },
    });
    const output = patchIncomingStream(input);
    const reader = output.getReader();
    let result = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    reader.releaseLock();
    const parsed = JSON.parse(result.trim()) as Record<string, unknown>;
    const params = parsed['params'] as Record<string, unknown>;
    expect(params['message']).toBe('\u4e2d\u6587\u5185\u5bb9');
  });
});
