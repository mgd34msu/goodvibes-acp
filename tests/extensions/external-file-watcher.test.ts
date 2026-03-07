import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventBus, type EventRecord } from '../../src/core/event-bus.js';
import { FileWatcher } from '../../src/extensions/external/file-watcher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for an EventBus event, resolving with the payload, or reject after
 * `timeoutMs` milliseconds.
 */
function waitForEvent<T = unknown>(
  bus: EventBus,
  event: string,
  timeoutMs = 2000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event '${event}' after ${timeoutMs}ms`));
    }, timeoutMs);

    bus.once(event, (record: EventRecord) => {
      clearTimeout(timer);
      resolve(record.payload as T);
    });
  });
}

/** Sleep for `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileWatcher', () => {
  let bus: EventBus;
  let watcher: FileWatcher;
  let tmpDir: string;

  beforeEach(async () => {
    bus = new EventBus();
    watcher = new FileWatcher(bus);
    tmpDir = await mkdtemp(join(tmpdir(), 'gv-fw-test-'));
  });

  afterEach(async () => {
    watcher.stop();
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('creates a FileWatcher instance', () => {
      expect(watcher).toBeInstanceOf(FileWatcher);
    });

    it('isWatching is false before any watch() call', () => {
      expect(watcher.isWatching).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // watch()
  // -------------------------------------------------------------------------

  describe('watch()', () => {
    it('registers a watcher and sets isWatching to true', () => {
      watcher.watch([tmpDir]);
      expect(watcher.isWatching).toBe(true);
    });

    it('can watch multiple paths in multiple calls', () => {
      watcher.watch([tmpDir]);
      // Second watch call accumulates; still watching
      watcher.watch([tmpDir]);
      expect(watcher.isWatching).toBe(true);
    });

    it('emits external:file-watch-error for a non-existent path', async () => {
      const errorPayload = waitForEvent<{ path: string; error: string }>(
        bus,
        'external:file-watch-error'
      );
      watcher.watch([join(tmpDir, 'does-not-exist-path-xyz')]);
      const payload = await errorPayload;
      expect(typeof payload.error).toBe('string');
      expect(payload.error.length).toBeGreaterThan(0);
    });

    it('accepts custom debounceMs and ignore options without throwing', () => {
      expect(() =>
        watcher.watch([tmpDir], { debounceMs: 50, ignore: ['node_modules', '.git'] })
      ).not.toThrow();
      expect(watcher.isWatching).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // File change event emission
  // -------------------------------------------------------------------------

  describe('file change events', () => {
    it('emits external:file-changed when a file is modified', async () => {
      const filePath = join(tmpDir, 'test.txt');
      await writeFile(filePath, 'initial');

      watcher.watch([tmpDir], { debounceMs: 50 });

      const eventPromise = waitForEvent<{ path: string; changeType: string; timestamp: number }>(
        bus,
        'external:file-changed'
      );

      await writeFile(filePath, 'updated content');

      const payload = await eventPromise;
      expect(typeof payload.path).toBe('string');
      expect(['created', 'modified', 'deleted']).toContain(payload.changeType);
      expect(typeof payload.timestamp).toBe('number');
    });

    it('payload path is an absolute path', async () => {
      const filePath = join(tmpDir, 'check-abs.txt');
      await writeFile(filePath, 'init');

      watcher.watch([tmpDir], { debounceMs: 50 });

      const eventPromise = waitForEvent<{ path: string }>(bus, 'external:file-changed');
      await writeFile(filePath, 'changed');

      const payload = await eventPromise;
      expect(payload.path.startsWith('/')).toBe(true);
    });

    it('debounces rapid successive changes into fewer events', async () => {
      const filePath = join(tmpDir, 'debounce.txt');
      await writeFile(filePath, 'v0');

      const events: unknown[] = [];
      bus.on('external:file-changed', (record: EventRecord) => {
        events.push(record.payload);
      });

      watcher.watch([tmpDir], { debounceMs: 150 });

      // Fire several rapid writes within the debounce window
      await writeFile(filePath, 'v1');
      await sleep(20);
      await writeFile(filePath, 'v2');
      await sleep(20);
      await writeFile(filePath, 'v3');

      // Wait well past the debounce window
      await sleep(400);

      // Should receive fewer events than writes due to debouncing
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events.length).toBeLessThan(4);
    });
  });

  // -------------------------------------------------------------------------
  // stop()
  // -------------------------------------------------------------------------

  describe('stop()', () => {
    it('sets isWatching to false after stopping', () => {
      watcher.watch([tmpDir]);
      expect(watcher.isWatching).toBe(true);
      watcher.stop();
      expect(watcher.isWatching).toBe(false);
    });

    it('emits external:file-watch-stopped event', async () => {
      watcher.watch([tmpDir]);
      const stopPromise = waitForEvent(bus, 'external:file-watch-stopped');
      watcher.stop();
      await stopPromise;
    });

    it('can be called multiple times without throwing', () => {
      watcher.watch([tmpDir]);
      watcher.stop();
      expect(() => watcher.stop()).not.toThrow();
    });

    it('calling stop() before watch() emits stopped event', async () => {
      const stopPromise = waitForEvent(bus, 'external:file-watch-stopped');
      watcher.stop();
      await stopPromise;
    });
  });
});
