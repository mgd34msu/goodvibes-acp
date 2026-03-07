import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createConnection } from 'node:net';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '../../src/core/event-bus.js';
import { DaemonManager } from '../../src/extensions/lifecycle/daemon.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick a random high port to minimise conflicts between test runs. */
function randomPort(): number {
  return Math.floor(Math.random() * 16000) + 49000;
}

/** Wait for an EventBus event, resolving with its payload. */
function waitForEvent<T = unknown>(bus: EventBus, name: string, timeoutMs = 2000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${name}`)), timeoutMs);
    bus.once(name, (ev: { payload: T }) => {
      clearTimeout(timer);
      resolve(ev.payload);
    });
  });
}

/** Open a TCP connection to host:port and close it immediately. */
function openAndCloseTcp(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port }, () => {
      socket.destroy();
      resolve();
    });
    socket.once('error', reject);
  });
}

// ---------------------------------------------------------------------------
// DaemonManager
// ---------------------------------------------------------------------------

describe('DaemonManager', () => {
  let bus: EventBus;
  let daemon: DaemonManager;
  let tcpPort: number;
  let healthPort: number;
  let pidFile: string;

  beforeEach(() => {
    bus = new EventBus();
    daemon = new DaemonManager(bus);
    tcpPort = randomPort();
    // Ensure health port never collides with tcp port
    healthPort = tcpPort + 100;
    pidFile = join(tmpdir(), `gv-daemon-test-${process.pid}-${Date.now()}.pid`);
  });

  afterEach(async () => {
    if (daemon.isRunning()) {
      await daemon.stop();
    }
    // Best-effort PID file cleanup
    await unlink(pidFile).catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates without error and isRunning() returns false initially', () => {
      const d = new DaemonManager(new EventBus());
      expect(d.isRunning()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // start()
  // -------------------------------------------------------------------------

  describe('start()', () => {
    it('starts TCP and health servers on specified ports', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });

      expect(daemon.isRunning()).toBe(true);

      // Verify TCP port is listening
      await expect(openAndCloseTcp('127.0.0.1', tcpPort)).resolves.toBeUndefined();

      // Verify health port is listening
      const res = await fetch(`http://127.0.0.1:${healthPort}/health`);
      expect(res.status).toBe(200);
    });

    it('throws if start() is called when already running', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });

      await expect(
        daemon.start({ port: tcpPort + 200, healthPort: healthPort + 200, host: '127.0.0.1' })
      ).rejects.toThrow('DaemonManager is already running');
    });

    it('writes a PID file when pidFile option is provided', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1', pidFile });

      const contents = await readFile(pidFile, 'utf-8');
      expect(contents).toBe(String(process.pid));
    });

    it('emits daemon:started event with correct payload', async () => {
      const payloadPromise = waitForEvent<Record<string, unknown>>(bus, 'daemon:started');

      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1', pidFile });

      const payload = await payloadPromise;
      expect(payload.pid).toBe(process.pid);
      expect(payload.port).toBe(tcpPort);
      expect(payload.healthPort).toBe(healthPort);
      expect(payload.host).toBe('127.0.0.1');
      expect(payload.pidFile).toBe(pidFile);
    });

    it('defaults host to 127.0.0.1 when not provided', async () => {
      const payloadPromise = waitForEvent<Record<string, unknown>>(bus, 'daemon:started');

      await daemon.start({ port: tcpPort, healthPort });

      const payload = await payloadPromise;
      expect(payload.host).toBe('127.0.0.1');
    });
  });

  // -------------------------------------------------------------------------
  // Health endpoint
  // -------------------------------------------------------------------------

  describe('health endpoint', () => {
    beforeEach(async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });
    });

    it('GET /health returns 200 with status ok', async () => {
      const res = await fetch(`http://127.0.0.1:${healthPort}/health`);
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('ok');
    });

    it('GET /ready returns 503 before markReady()', async () => {
      const res = await fetch(`http://127.0.0.1:${healthPort}/ready`);
      expect(res.status).toBe(503);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('starting');
    });

    it('GET /ready returns 200 after markReady()', async () => {
      daemon.markReady();

      const res = await fetch(`http://127.0.0.1:${healthPort}/ready`);
      expect(res.status).toBe(200);
      const body = await res.json() as { status: string };
      expect(body.status).toBe('ready');
    });

    it('GET /unknown returns 404', async () => {
      const res = await fetch(`http://127.0.0.1:${healthPort}/unknown`);
      expect(res.status).toBe(404);
    });

    it('non-GET request returns 405', async () => {
      const res = await fetch(`http://127.0.0.1:${healthPort}/health`, { method: 'POST' });
      expect(res.status).toBe(405);
    });
  });

  // -------------------------------------------------------------------------
  // markReady()
  // -------------------------------------------------------------------------

  describe('markReady()', () => {
    it('toggles ready state so /ready returns 200', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });

      const before = await fetch(`http://127.0.0.1:${healthPort}/ready`);
      expect(before.status).toBe(503);

      daemon.markReady();

      const after = await fetch(`http://127.0.0.1:${healthPort}/ready`);
      expect(after.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // stop()
  // -------------------------------------------------------------------------

  describe('stop()', () => {
    it('sets isRunning() to false after stop', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });
      expect(daemon.isRunning()).toBe(true);

      await daemon.stop();

      expect(daemon.isRunning()).toBe(false);
    });

    it('removes the PID file on stop', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1', pidFile });

      // Verify file exists before stop
      const before = await readFile(pidFile, 'utf-8');
      expect(before).toBe(String(process.pid));

      await daemon.stop();

      // File should be gone after stop
      await expect(readFile(pidFile, 'utf-8')).rejects.toThrow();
    });

    it('emits daemon:stopped event with correct payload', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1', pidFile });

      const payloadPromise = waitForEvent<Record<string, unknown>>(bus, 'daemon:stopped');
      await daemon.stop();

      const payload = await payloadPromise;
      expect(payload.pid).toBe(process.pid);
      expect(payload.pidFile).toBe(pidFile);
    });

    it('is a no-op if not running', async () => {
      // Should not throw when daemon was never started
      await expect(daemon.stop()).resolves.toBeUndefined();
      expect(daemon.isRunning()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TCP connection events
  // -------------------------------------------------------------------------

  describe('TCP connection', () => {
    it('emits daemon:connection event when a client connects', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });

      const payloadPromise = waitForEvent<Record<string, unknown>>(bus, 'daemon:connection');
      await openAndCloseTcp('127.0.0.1', tcpPort);

      const payload = await payloadPromise;
      expect(payload).toBeDefined();
    });

    it('daemon:connection payload includes remoteAddress and remotePort', async () => {
      await daemon.start({ port: tcpPort, healthPort, host: '127.0.0.1' });

      const payloadPromise = waitForEvent<Record<string, unknown>>(bus, 'daemon:connection');
      await openAndCloseTcp('127.0.0.1', tcpPort);

      const payload = await payloadPromise;
      expect(typeof payload.remoteAddress).toBe('string');
      expect(typeof payload.remotePort).toBe('number');
    });
  });
});
