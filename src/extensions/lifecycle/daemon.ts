/**
 * @module lifecycle/daemon
 * @layer L2 — extensions, depends on L1 core
 *
 * Daemon mode manager. Starts a long-running background process that:
 * - Accepts ACP connections over TCP (stub — wired by main.ts)
 * - Exposes HTTP health and readiness endpoints
 * - Writes / removes a PID file for process management
 * - Emits lifecycle events on the shared EventBus
 */

import { createServer as createHttpServer } from 'node:http';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import type { Server as TcpServer, Socket } from 'node:net';
import { writeFile, unlink } from 'node:fs/promises';
import { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Configuration options for daemon mode */
export interface DaemonOptions {
  /** TCP port for ACP connections */
  port: number;
  /** Host to bind the TCP listener (default: '127.0.0.1') */
  host?: string;
  /** Port for the HTTP health / readiness endpoint (default: port + 1) */
  healthPort?: number;
  /** Path to the PID file (optional) */
  pidFile?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handleHealthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  isReady: boolean,
): Promise<void> {
  const url = req.url ?? '/';

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  if (url === '/health') {
    sendJson(res, 200, { status: 'ok', pid: process.pid, timestamp: Date.now() });
    return;
  }

  if (url === '/ready') {
    if (isReady) {
      sendJson(res, 200, { status: 'ready', pid: process.pid, timestamp: Date.now() });
    } else {
      sendJson(res, 503, { status: 'starting', pid: process.pid, timestamp: Date.now() });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not Found' });
}

// ---------------------------------------------------------------------------
// DaemonManager
// ---------------------------------------------------------------------------

/**
 * Manages daemon mode for the GoodVibes ACP runtime.
 *
 * Lifecycle:
 * 1. `start(options)` — binds TCP and health listeners, writes PID file
 * 2. Runtime emits `daemon:started`
 * 3. Incoming TCP connections emit `daemon:connection` (wired to ACP transport in main.ts)
 * 4. `stop()` — closes servers, removes PID file
 * 5. Runtime emits `daemon:stopped`
 *
 * @example
 * ```typescript
 * const daemon = new DaemonManager(eventBus);
 * await daemon.start({ port: 9000, healthPort: 9001, pidFile: '/tmp/gv.pid' });
 * // later:
 * await daemon.stop();
 * ```
 */
export class DaemonManager {
  private readonly _eventBus: EventBus;
  private _tcpServer: TcpServer | null = null;
  private _healthServer: HttpServer | null = null;
  private _options: DaemonOptions | null = null;
  private _running = false;
  private _ready = false;

  constructor(eventBus: EventBus) {
    this._eventBus = eventBus;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start daemon mode.
   *
   * Binds the TCP listener for ACP connections and the HTTP health endpoint.
   * Writes a PID file if `options.pidFile` is provided.
   *
   * @throws If already running or if the server fails to bind.
   */
  async start(options: DaemonOptions): Promise<void> {
    if (this._running) {
      throw new Error('DaemonManager is already running');
    }

    this._options = options;
    const host = options.host ?? '127.0.0.1';
    const healthPort = options.healthPort ?? options.port + 1;

    // Write PID file before opening sockets so callers can find the process
    if (options.pidFile) {
      await writeFile(options.pidFile, String(process.pid), 'utf-8');
    }

    // Start TCP listener for ACP connections
    await this._startTcpServer(host, options.port);

    // Start HTTP health / readiness server
    await this._startHealthServer(host, healthPort);

    this._running = true;

    this._eventBus.emit('daemon:started', {
      pid: process.pid,
      port: options.port,
      host,
      healthPort,
      pidFile: options.pidFile,
    });
  }

  /**
   * Signal the daemon as ready to accept work.
   * After calling this, `GET /ready` returns 200.
   */
  markReady(): void {
    this._ready = true;
  }

  /**
   * Gracefully stop the daemon.
   *
   * Closes TCP and health servers, removes the PID file.
   */
  async stop(): Promise<void> {
    if (!this._running) {
      return;
    }

    this._running = false;
    this._ready = false;

    await Promise.all([
      this._stopTcpServer(),
      this._stopHealthServer(),
    ]);

    if (this._options?.pidFile) {
      await unlink(this._options.pidFile).catch(() => {
        // Ignore missing PID file — process may have already cleaned up
      });
    }

    this._eventBus.emit('daemon:stopped', {
      pid: process.pid,
      pidFile: this._options?.pidFile,
    });

    this._options = null;
  }

  /**
   * Returns true if the daemon TCP and health servers are active.
   */
  isRunning(): boolean {
    return this._running;
  }

  // ---------------------------------------------------------------------------
  // Private: TCP server
  // ---------------------------------------------------------------------------

  private _startTcpServer(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createTcpServer();

      server.on('connection', (socket: Socket) => {
        this._eventBus.emit('daemon:connection', {
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort,
        });
        // Real ACP transport wiring is done in main.ts via the socket object.
        // Stub: keep socket open until closed by the client.
        socket.on('error', () => socket.destroy());
      });

      server.once('error', (err) => {
        reject(err);
      });

      server.listen(port, host, () => {
        this._tcpServer = server;
        resolve();
      });
    });
  }

  private _stopTcpServer(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._tcpServer) {
        resolve();
        return;
      }
      this._tcpServer.close(() => resolve());
      this._tcpServer = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Private: HTTP health server
  // ---------------------------------------------------------------------------

  private _startHealthServer(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
        handleHealthRequest(req, res, this._ready).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          sendJson(res, 500, { error: msg });
        });
      });

      server.once('error', (err) => {
        reject(err);
      });

      server.listen(port, host, () => {
        this._healthServer = server;
        resolve();
      });
    });
  }

  private _stopHealthServer(): Promise<void> {
    return new Promise((resolve) => {
      if (!this._healthServer) {
        resolve();
        return;
      }
      this._healthServer.close(() => resolve());
      this._healthServer = null;
    });
  }
}
