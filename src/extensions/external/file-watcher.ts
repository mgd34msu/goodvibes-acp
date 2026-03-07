/**
 * @module external/file-watcher
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * File system change detection.
 *
 * Watches one or more paths using the Node/Bun built-in `node:fs` watch API,
 * debounces rapid successive changes, filters out ignored path patterns, and
 * emits normalized events onto the EventBus.
 *
 * No chokidar / fsevents / external dependency.
 */

import { watch, type FSWatcher } from 'node:fs';
import { resolve } from 'node:path';

import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for `FileWatcher.watch()` */
export interface WatchOptions {
  /**
   * Milliseconds to debounce consecutive changes to the same path.
   * Default: 100 ms.
   */
  debounceMs?: number;
  /**
   * Glob-style substring patterns for paths to ignore.
   * Any path that contains one of these substrings is skipped.
   * Default: `['node_modules', '.git']`.
   */
  ignore?: string[];
  /**
   * Whether to watch directories recursively.
   * Default: true.
   */
  recursive?: boolean;
}

/** Change event types produced by the watcher */
export type FileChangeType = 'created' | 'modified' | 'deleted';

/** Payload emitted for every file change */
export interface FileChangedPayload {
  /** Absolute path that changed */
  path: string;
  /** Type of change */
  changeType: FileChangeType;
  /** Unix timestamp (ms) when the change was detected (after debounce) */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DEBOUNCE_MS = 100;
const DEFAULT_IGNORE = ['node_modules', '.git'];

// ---------------------------------------------------------------------------
// FileWatcher
// ---------------------------------------------------------------------------

/**
 * File system watcher that emits debounced change events onto the EventBus.
 *
 * Lifecycle:
 * 1. `new FileWatcher(eventBus)` — configure
 * 2. `watcher.watch(paths, options)` — start watching
 * 3. `watcher.stop()` — stop all watchers and clear debounce timers
 *
 * Events emitted onto the EventBus:
 * - `external:file-changed` — payload: FileChangedPayload
 * - `external:file-watch-error` — payload: `{ path, error }`
 *
 * @example
 * ```typescript
 * const watcher = new FileWatcher(bus);
 * watcher.watch(['src', 'config'], { debounceMs: 200, ignore: ['node_modules'] });
 * // later:
 * watcher.stop();
 * ```
 */
export class FileWatcher {
  private readonly _bus: EventBus;
  private readonly _watchers: FSWatcher[] = [];
  /** Map of absolute path → pending debounce timer ID */
  private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(eventBus: EventBus) {
    this._bus = eventBus;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Start watching the given paths.
   * Each call to `watch()` ADDS to existing watchers — call `stop()` first
   * to reset.
   *
   * @param paths    One or more file system paths to watch (resolved to absolute).
   * @param options  Watch configuration.
   */
  watch(paths: string[], options: WatchOptions = {}): void {
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const ignore = options.ignore ?? DEFAULT_IGNORE;
    const recursive = options.recursive ?? true;

    for (const rawPath of paths) {
      const absPath = resolve(rawPath);

      let watcher: FSWatcher;
      try {
        watcher = watch(
          absPath,
          { recursive, persistent: false },
          (event, filename) => {
            this._onRawChange(event, filename, absPath, debounceMs, ignore);
          }
        );
      } catch (err: unknown) {
        this._bus.emit('external:file-watch-error', {
          path: absPath,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      watcher.on('error', (err: Error) => {
        this._bus.emit('external:file-watch-error', {
          path: absPath,
          error: err.message,
        });
      });

      this._watchers.push(watcher);
    }
  }

  /**
   * Stop all active watchers and cancel any pending debounce timers.
   */
  stop(): void {
    // Cancel all pending debounce timers
    for (const timer of this._timers.values()) {
      clearTimeout(timer);
    }
    this._timers.clear();

    // Close all FS watchers
    for (const watcher of this._watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore close errors — already closing
      }
    }
    this._watchers.length = 0;

    this._bus.emit('external:file-watch-stopped', {});
  }

  /** Whether any paths are currently being watched. */
  get isWatching(): boolean {
    return this._watchers.length > 0;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private _onRawChange(
    event: string,
    filename: string | Buffer | null,
    watchRoot: string,
    debounceMs: number,
    ignore: string[]
  ): void {
    // Resolve the full path of the changed entry
    const name: string =
      filename === null
        ? ''
        : typeof filename === 'string'
          ? filename
          : (filename as Buffer).toString('utf-8');
    const fullPath = name ? resolve(watchRoot, name) : watchRoot;

    // Ignore filter
    if (this._shouldIgnore(fullPath, ignore)) return;

    // Map native event type to our change type
    // node:fs watch only emits 'rename' (create/delete) and 'change' (modify)
    const changeType: FileChangeType =
      event === 'rename' ? 'created' : 'modified';

    // Debounce: cancel any existing timer for this path, then re-set
    const existing = this._timers.get(fullPath);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this._timers.delete(fullPath);
      const payload: FileChangedPayload = {
        path: fullPath,
        changeType,
        timestamp: Date.now(),
      };
      this._bus.emit('external:file-changed', payload);
    }, debounceMs);

    this._timers.set(fullPath, timer);
  }

  private _shouldIgnore(fullPath: string, ignore: string[]): boolean {
    return ignore.some((pattern) => fullPath.includes(pattern));
  }
}
