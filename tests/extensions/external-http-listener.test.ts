import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createHmac } from 'node:crypto';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { EventBus, type EventRecord } from '../../src/core/event-bus.js';
import { HttpListener } from '../../src/extensions/external/http-listener.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a random port in the ephemeral range. */
function randomPort(): number {
  return 40000 + Math.floor(Math.random() * 10000);
}

/**
 * Make a simple HTTP request and return status + body.
 * Resolves with status=0 on connection reset (e.g. when server kills the socket
 * before sending a response, as happens with oversized payloads).
 */
function sendRequest(options: {
  port: number;
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const bodyBuf = options.body ? Buffer.from(options.body, 'utf-8') : undefined;
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port: options.port,
        method: options.method,
        path: options.path,
        headers: {
          'Content-Type': 'application/json',
          ...(bodyBuf ? { 'Content-Length': String(bodyBuf.length) } : {}),
          ...(options.headers ?? {}),
        },
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf-8'),
          })
        );
        // Connection reset during response — treat as error status
        res.on('error', () => resolve({ status: 0, body: '' }));
      }
    );
    // Connection reset before any response — treat as rejected (status 0)
    req.on('error', () => resolve({ status: 0, body: '' }));
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

/** Compute a valid x-hub-signature-256 header value for a body+secret. */
function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
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

describe('HttpListener', () => {
  let bus: EventBus;
  let listener: HttpListener;
  let port: number;

  beforeEach(() => {
    bus = new EventBus();
    port = randomPort();
    listener = new HttpListener(bus);
  });

  afterEach(async () => {
    if (listener.isRunning) {
      await listener.stop();
    }
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates an HttpListener instance', () => {
      expect(listener).toBeInstanceOf(HttpListener);
    });

    it('isRunning is false before start()', () => {
      expect(listener.isRunning).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // start() / stop()
  // -------------------------------------------------------------------------

  describe('start() / stop()', () => {
    it('binds the server and sets isRunning=true', async () => {
      await listener.start(port);
      expect(listener.isRunning).toBe(true);
    });

    it('emits external:listener-started with the port', async () => {
      const startedPromise = waitForEvent<{ port: number }>(bus, 'external:listener-started');
      await listener.start(port);
      const payload = await startedPromise;
      expect(payload.port).toBe(port);
    });

    it('stop() sets isRunning=false', async () => {
      await listener.start(port);
      await listener.stop();
      expect(listener.isRunning).toBe(false);
    });

    it('stop() emits external:listener-stopped', async () => {
      await listener.start(port);
      const stoppedPromise = waitForEvent(bus, 'external:listener-stopped');
      await listener.stop();
      await stoppedPromise;
    });

    it('stop() is a no-op when server is not running', async () => {
      await expect(listener.stop()).resolves.toBeUndefined();
    });

    it('start() rejects if already running', async () => {
      await listener.start(port);
      await expect(listener.start(port)).rejects.toThrow('already running');
    });
  });

  // -------------------------------------------------------------------------
  // Routing
  // -------------------------------------------------------------------------

  describe('request routing', () => {
    it('returns 405 for non-POST requests', async () => {
      await listener.start(port);
      const res = await sendRequest({ port, method: 'GET', path: '/webhook/test' });
      expect(res.status).toBe(405);
    });

    it('returns 404 for paths that do not match /webhook/:source', async () => {
      await listener.start(port);
      const res = await sendRequest({ port, method: 'POST', path: '/not-a-webhook', body: '{}' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid JSON body', async () => {
      await listener.start(port);
      const res = await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/test',
        body: 'not-json',
      });
      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Webhook receipt (no signature)
  // -------------------------------------------------------------------------

  describe('webhook receipt (unsigned)', () => {
    it('returns 200 and emits external:webhook for a valid POST', async () => {
      await listener.start(port);

      const eventPromise = waitForEvent(bus, 'external:webhook');

      const body = JSON.stringify({ action: 'push' });
      const res = await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/github',
        body,
      });

      expect(res.status).toBe(200);
      const normalized = await eventPromise;
      expect(normalized).toBeDefined();
    });

    it('emitted NormalizedEvent has a source field matching the route param', async () => {
      await listener.start(port);

      const eventPromise = waitForEvent<{ source: string }>(bus, 'external:webhook');

      await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/my-service',
        body: JSON.stringify({ type: 'test' }),
      });

      const normalized = await eventPromise;
      expect(normalized.source).toBe('my-service');
    });

    it('emits external:webhook-error on invalid JSON', async () => {
      await listener.start(port);

      const errorPromise = waitForEvent<{ source: string; error: string }>(bus, 'external:webhook-error');

      await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/test',
        body: '{invalid-json}',
      });

      const err = await errorPromise;
      expect(err.error).toContain('JSON');
    });
  });

  // -------------------------------------------------------------------------
  // HMAC signature verification
  // -------------------------------------------------------------------------

  describe('signature verification', () => {
    it('returns 401 when secret is configured and no signature header is sent', async () => {
      const secureListener = new HttpListener(bus, { secret: 'my-secret' });
      await secureListener.start(port);

      const res = await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/test',
        body: JSON.stringify({ x: 1 }),
      });

      expect(res.status).toBe(401);
      await secureListener.stop();
    });

    it('returns 401 for an invalid signature', async () => {
      const secureListener = new HttpListener(bus, { secret: 'correct-secret' });
      await secureListener.start(port);

      const body = JSON.stringify({ x: 1 });
      const res = await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/test',
        body,
        headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
      });

      expect(res.status).toBe(401);
      await secureListener.stop();
    });

    it('returns 200 for a request with a valid HMAC signature', async () => {
      const secret = 'test-secret-key';
      const secureListener = new HttpListener(bus, { secret });
      await secureListener.start(port);

      const body = JSON.stringify({ event: 'release' });
      const sig = sign(body, secret);

      const eventPromise = waitForEvent(bus, 'external:webhook');

      const res = await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/releases',
        body,
        headers: { 'x-hub-signature-256': sig },
      });

      expect(res.status).toBe(200);
      await eventPromise;
      await secureListener.stop();
    });
  });

  // -------------------------------------------------------------------------
  // Payload size limit
  // -------------------------------------------------------------------------

  describe('payload size limit', () => {
    it('emits external:webhook-error when body exceeds maxPayloadBytes', async () => {
      // When a payload exceeds the limit, the server calls req.destroy() to kill
      // the upload, then replies 413 — but the connection reset may prevent the
      // client from seeing the 413. We verify behavior via the EventBus instead.
      const smallListener = new HttpListener(bus, { maxPayloadBytes: 10 });
      await smallListener.start(port);

      const errorPromise = waitForEvent<{ source: string; error: string }>(
        bus,
        'external:webhook-error'
      );

      // sendRequest handles ECONNRESET gracefully (resolves with status=0)
      await sendRequest({
        port,
        method: 'POST',
        path: '/webhook/test',
        body: JSON.stringify({ data: 'this body is definitely longer than 10 bytes' }),
      });

      const err = await errorPromise;
      expect(err.error).toContain('size limit');
      await smallListener.stop();
    });
  });
});
