/**
 * @module external/http-listener
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * Webhook receiver for external events.
 *
 * Starts an HTTP server on a configurable port and accepts
 * POST /webhook/:source requests.  Each request is signature-verified
 * (HMAC-SHA256, timing-safe), size-limited, and — on success — the
 * payload is normalised and emitted onto the EventBus.
 *
 * Uses only Node/Bun built-in modules: node:http, node:crypto.
 * No express / fastify dependency.
 *
 * TODO(ISS-018): IPC protocol uses a custom event-based format, not JSON-RPC 2.0.
 * This module emits events onto EventBus using a proprietary normalized event
 * format (NormalizedEvent). To comply with ACP JSON-RPC 2.0, incoming webhook
 * payloads should be wrapped in a JSON-RPC 2.0 envelope:
 *   { "jsonrpc": "2.0", "method": "<event-type>", "params": <payload>, "id": <req-id> }
 * and responses should conform to:
 *   { "jsonrpc": "2.0", "result": ..., "id": <req-id> }  (success)
 *   { "jsonrpc": "2.0", "error": { "code": ..., "message": ... }, "id": <req-id> }  (error)
 * The NormalizerRegistry and EventBus emission patterns would need to be updated
 * to produce/consume this envelope format throughout the IPC layer.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { EventBus } from '../../core/event-bus.js';
import type { NormalizedEvent } from './normalizer.js';
import { NormalizerRegistry } from './normalizer.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for HttpListener construction */
export interface HttpListenerOptions {
  /**
   * HMAC-SHA256 secret used to verify incoming webhook signatures.
   * When provided every request must include an `x-hub-signature-256` header
   * with a valid `sha256=<hex>` value.  When omitted signature checking is
   * skipped (useful for development / unsigned sources).
   */
  secret?: string;
  /**
   * Maximum accepted request body size in bytes.
   * Requests exceeding this limit are rejected with HTTP 413.
   * Default: 1_048_576 (1 MiB).
   */
  maxPayloadBytes?: number;
  /**
   * Optional pre-configured NormalizerRegistry.
   * When omitted a fresh registry (with the built-in 'generic' normalizer)
   * is created automatically.
   */
  normalizers?: NormalizerRegistry;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_PAYLOAD = 1_048_576; // 1 MiB
const ROUTE_RE = /^\/webhook\/([a-zA-Z0-9_-]+)\/?$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the full request body up to `maxBytes`.
 * Rejects with an error if the limit is exceeded.
 */
function readBody(
  req: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error(`Payload exceeds ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Verify an HMAC-SHA256 webhook signature using a timing-safe comparison.
 *
 * @param body    Raw request body bytes.
 * @param secret  Shared secret.
 * @param header  Value of the `x-hub-signature-256` header (`sha256=<hex>`).
 * @returns       `true` when the signature is valid.
 */
function verifySignature(body: Buffer, secret: string, header: string): boolean {
  if (!header.startsWith('sha256=')) return false;
  const provided = Buffer.from(header.slice('sha256='.length), 'hex');
  const expected = Buffer.from(
    createHmac('sha256', secret).update(body).digest('hex'),
    'hex'
  );
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/** Send a plain-text HTTP response and close the connection. */
function reply(
  res: ServerResponse,
  status: number,
  body: string
): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------------------------------------------------------------------------
// HttpListener
// ---------------------------------------------------------------------------

/**
 * HTTP webhook listener.
 *
 * Lifecycle:
 * 1. `new HttpListener(eventBus, options)` — configure
 * 2. `await listener.start(port)` — bind and start accepting connections
 * 3. `await listener.stop()` — gracefully close the server
 *
 * Events emitted onto the EventBus:
 * - `external:webhook` — payload: NormalizedEvent (on every valid request)
 * - `external:webhook-error` — payload: `{ source, error }` (on bad sig / oversized / parse error)
 *
 * @example
 * ```typescript
 * const listener = new HttpListener(bus, { secret: process.env.WEBHOOK_SECRET });
 * await listener.start(3001);
 * ```
 */
export class HttpListener {
  private readonly _bus: EventBus;
  private readonly _options: Required<Omit<HttpListenerOptions, 'normalizers'>> & {
    normalizers: NormalizerRegistry;
  };
  private _server: Server | null = null;

  constructor(eventBus: EventBus, options: HttpListenerOptions = {}) {
    this._bus = eventBus;
    this._options = {
      secret: options.secret ?? '',
      maxPayloadBytes: options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD,
      normalizers: options.normalizers ?? new NormalizerRegistry(),
    };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start the HTTP server on the given port.
   * Resolves once the server is bound and ready to accept connections.
   *
   * @throws If the server is already running.
   */
  start(port: number): Promise<void> {
    if (this._server) {
      return Promise.reject(new Error('HttpListener is already running'));
    }

    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        this._handleRequest(req, res).catch((err: unknown) => {
          this._bus.emit('external:webhook-error', {
            source: 'unknown',
            error: err instanceof Error ? err.message : String(err),
          });
          if (!res.headersSent) {
            reply(res, 500, 'Internal Server Error');
          }
        });
      });

      server.once('error', reject);
      server.listen(port, () => {
        this._server = server;
        this._bus.emit('external:listener-started', { port });
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server.
   * Resolves once all connections are closed.
   * No-op if the server is not running.
   */
  stop(): Promise<void> {
    const server = this._server;
    if (!server) return Promise.resolve();

    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        this._server = null;
        this._bus.emit('external:listener-stopped', {});
        resolve();
      });
    });
  }

  /** Whether the HTTP server is currently running. */
  get isRunning(): boolean {
    return this._server !== null;
  }

  // -------------------------------------------------------------------------
  // Request handling
  // -------------------------------------------------------------------------

  private async _handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // Only POST is accepted
    if (req.method !== 'POST') {
      reply(res, 405, 'Method Not Allowed');
      return;
    }

    // Route matching: POST /webhook/:source
    const match = ROUTE_RE.exec(req.url ?? '');
    if (!match) {
      reply(res, 404, 'Not Found');
      return;
    }

    const source = match[1]!;

    // Read body with size enforcement
    let body: Buffer;
    try {
      body = await readBody(req, this._options.maxPayloadBytes);
    } catch {
      reply(res, 413, 'Payload Too Large');
      this._bus.emit('external:webhook-error', {
        source,
        error: 'Payload exceeds size limit',
      });
      return;
    }

    // Signature verification (when a secret is configured)
    if (this._options.secret) {
      const sigHeader = req.headers['x-hub-signature-256'];
      const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      if (!sig || !verifySignature(body, this._options.secret, sig)) {
        reply(res, 401, 'Unauthorized');
        this._bus.emit('external:webhook-error', {
          source,
          error: 'Invalid signature',
        });
        return;
      }
    }

    // Parse JSON payload
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString('utf-8'));
    } catch {
      reply(res, 400, 'Bad Request: invalid JSON');
      this._bus.emit('external:webhook-error', {
        source,
        error: 'Invalid JSON payload',
      });
      return;
    }

    // Normalize and emit
    const normalized: NormalizedEvent = this._options.normalizers.normalize(
      source,
      parsed
    );
    this._bus.emit('external:webhook', normalized);

    reply(res, 200, 'OK');
  }
}
