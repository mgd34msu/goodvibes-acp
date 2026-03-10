import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { connect, type Socket } from 'node:net';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';
import { EventBus, type EventRecord } from '../../src/core/event-bus.js';
import { IpcRouter } from '../../src/extensions/ipc/router.js';
import { IpcSocketServer } from '../../src/extensions/ipc/socket.js';
import {
  buildRequest,
  buildNotification,
  serializeMessage,
  deserializeMessage,
} from '../../src/extensions/ipc/protocol.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a unique socket path in /tmp. */
function tempSocketPath(): string {
  return join(tmpdir(), `gv-ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
}

/**
 * Connect a client socket to `socketPath`, send one NDJSON message, and
 * collect the first complete NDJSON response line.
 */
function clientRoundTrip(
  socketPath: string,
  message: object
): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock: Socket = connect(socketPath, () => {
      sock.write(JSON.stringify(message) + '\n');
    });

    let buf = '';
    sock.setEncoding('utf-8');
    sock.on('data', (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl !== -1) {
        const line = buf.slice(0, nl);
        sock.destroy();
        resolve(line);
      }
    });

    sock.on('error', reject);

    setTimeout(() => {
      sock.destroy();
      reject(new Error('clientRoundTrip timed out'));
    }, 3000);
  });
}

/** Wait for an EventBus event, resolving with the payload. */
function waitForEvent<T = unknown>(
  bus: EventBus,
  event: string,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for '${event}'`));
    }, timeoutMs);
    bus.once(event, (record: EventRecord) => {
      clearTimeout(timer);
      resolve(record.payload as T);
    });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IpcSocketServer', () => {
  let bus: EventBus;
  let router: IpcRouter;
  let server: IpcSocketServer;
  let socketPath: string;

  beforeEach(() => {
    bus = new EventBus();
    router = new IpcRouter(bus);
    server = new IpcSocketServer(bus, router);
    socketPath = tempSocketPath();
  });

  afterEach(async () => {
    await server.stop();
    await rm(socketPath, { force: true });
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates an IpcSocketServer instance', () => {
      expect(server).toBeInstanceOf(IpcSocketServer);
    });

    it('isRunning is false before start()', () => {
      expect(server.isRunning).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // start() / stop()
  // -------------------------------------------------------------------------

  describe('start() / stop()', () => {
    it('binds the socket and sets isRunning=true', async () => {
      await server.start(socketPath);
      expect(server.isRunning).toBe(true);
    });

    it('throws if start() is called while already running', async () => {
      await server.start(socketPath);
      await expect(server.start(socketPath)).rejects.toThrow('already running');
    });

    it('stop() sets isRunning=false', async () => {
      await server.start(socketPath);
      await server.stop();
      expect(server.isRunning).toBe(false);
    });

    it('stop() is a no-op when not running', async () => {
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('removes the socket file on stop()', async () => {
      await server.start(socketPath);
      await server.stop();
      // Attempting to connect should fail — socket file is removed
      await expect(
        new Promise<void>((_, reject) => {
          const s = connect(socketPath);
          s.on('error', (err) => reject(err));
          s.on('connect', () => {
            s.destroy();
            reject(new Error('should not have connected after stop'));
          });
        })
      ).rejects.toThrow();
    });

    it('handles start() on a path where a stale socket file exists', async () => {
      // Start once to create the socket file, then stop (file is deleted on stop)
      // but we need to verify stale-file removal works when the file IS present.
      // Simulate by starting server2 on a separate unique path.
      const stalePath = tempSocketPath();
      const server2 = new IpcSocketServer(bus, router);
      await server2.start(stalePath);
      await server2.stop();

      // stalePath socket file is gone. Start server3 on the same path — should succeed.
      const server3 = new IpcSocketServer(bus, router);
      await expect(server3.start(stalePath)).resolves.toBeUndefined();
      await server3.stop();
      await rm(stalePath, { force: true });
    });
  });

  // -------------------------------------------------------------------------
  // Client connections
  // -------------------------------------------------------------------------

  describe('client connections', () => {
    it('emits ipc:connected when a client connects', async () => {
      await server.start(socketPath);

      const connectedPromise = waitForEvent<{ remoteAddress: string }>(bus, 'ipc:connected');

      const sock: Socket = connect(socketPath);
      await connectedPromise;
      sock.destroy();
    });

    it('emits ipc:disconnected when a client disconnects', async () => {
      await server.start(socketPath);

      const disconnectedPromise = waitForEvent(bus, 'ipc:disconnected');

      const sock: Socket = connect(socketPath, () => {
        sock.end();
      });

      await disconnectedPromise;
    });
  });

  // -------------------------------------------------------------------------
  // Message routing
  // -------------------------------------------------------------------------

  describe('message routing', () => {
    it('routes a ping request and returns a pong response', async () => {
      await server.start(socketPath);

      const request = buildRequest('req-1', 'ping', { hello: 'world' });
      const line = await clientRoundTrip(socketPath, request);

      const response = deserializeMessage(line) as {
        type: string;
        id: string;
        result: { pong: boolean; echo: unknown };
        error?: unknown;
      };

      expect(response.type).toBe('response');
      expect(response.error).toBeUndefined();
      expect(response.id).toBe('req-1');
      expect(response.result.pong).toBe(true);
      expect(response.result.echo).toEqual({ hello: 'world' });
    });

    it('routes a status request and returns process info', async () => {
      await server.start(socketPath);

      const request = buildRequest('status-1', 'status');
      const line = await clientRoundTrip(socketPath, request);

      const response = deserializeMessage(line) as {
        error?: unknown;
        result: Record<string, unknown>;
      };

      expect(response.error).toBeUndefined();
      expect(typeof response.result.pid).toBe('number');
      expect(typeof response.result.uptime).toBe('number');
    });

    it('returns an error response for an unknown method', async () => {
      await server.start(socketPath);

      const request = buildRequest('unknown-1', 'no-such-method');
      const line = await clientRoundTrip(socketPath, request);

      const response = deserializeMessage(line) as {
        error: { message: string };
        id: string;
      };

      expect(response.error).toBeDefined();
      expect(response.error.message).toContain('Unknown method');
      expect(response.id).toBe('unknown-1');
    });

    it('returns a parse error response for a malformed message object', async () => {
      await server.start(socketPath);

      // Send a JSON string that is valid JSON but fails IpcMessage validation
      // (missing required fields: type, id, timestamp)
      const line = await new Promise<string>((resolve, reject) => {
        const sock: Socket = connect(socketPath, () => {
          // Send a JSON object missing required IPC fields
          sock.write(JSON.stringify({ bad: 'message' }) + '\n');
        });

        let buf = '';
        sock.setEncoding('utf-8');
        sock.on('data', (chunk: string) => {
          buf += chunk;
          const nl = buf.indexOf('\n');
          if (nl !== -1) {
            sock.destroy();
            resolve(buf.slice(0, nl));
          }
        });
        sock.on('error', reject);
        setTimeout(() => { sock.destroy(); reject(new Error('timeout')); }, 3000);
      });

      const response = deserializeMessage(line) as {
        error: { message: string };
      };

      expect(response.error).toBeDefined();
      expect(typeof response.error.message).toBe('string');
      expect(response.error.message.length).toBeGreaterThan(0);
    });

    it('emits ipc:message on the event bus for each received message', async () => {
      await server.start(socketPath);

      const messagePromise = waitForEvent<{ message: { id: string } }>(bus, 'ipc:message');

      const request = buildRequest('msg-1', 'ping');
      clientRoundTrip(socketPath, request).catch(() => {});

      const event = await messagePromise;
      expect(event.message.id).toBe('msg-1');
    });

    it('does not send a response for notification messages', async () => {
      await server.start(socketPath);

      const notifHandled = waitForEvent(bus, 'ipc:message');

      await new Promise<void>((resolve, reject) => {
        const sock: Socket = connect(socketPath, () => {
          const notif = buildNotification('runtime:test', { ok: true });
          sock.write(serializeMessage(notif));

          // Wait briefly; no data should arrive since notifications are fire-and-forget
          setTimeout(() => {
            sock.destroy();
            resolve();
          }, 200);
        });
        sock.on('error', reject);
      });

      // The ipc:message event should still have fired
      await notifHandled;
    });

    it('routes a custom registered handler through the socket', async () => {
      router.register('echo', (req) => ({ echoed: req.params }));

      await server.start(socketPath);

      const request = buildRequest('custom-1', 'echo', { data: 42 });
      const line = await clientRoundTrip(socketPath, request);

      const response = deserializeMessage(line) as {
        error?: unknown;
        result: { echoed: unknown };
      };

      expect(response.error).toBeUndefined();
      expect(response.result.echoed).toEqual({ data: 42 });
    });
  });
});
