/**
 * @module plugins/analytics/sync
 * @layer L3 — plugin
 *
 * Persistence layer for session analytics.
 * Stores JSON files in .goodvibes/analytics/<sessionId>.json.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionAnalytics, AnalyticsStore } from './types.js';

/** Validate that a parsed JSON object has the required SessionAnalytics shape */
function validateSessionAnalytics(data: unknown): SessionAnalytics {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid session analytics: not an object');
  }
  const d = data as Record<string, unknown>;
  if (typeof d['sessionId'] !== 'string') {
    throw new Error('Invalid session analytics: missing or invalid sessionId');
  }
  if (typeof d['startedAt'] !== 'number') {
    throw new Error('Invalid session analytics: missing or invalid startedAt');
  }
  if (!Array.isArray(d['entries'])) {
    throw new Error('Invalid session analytics: entries must be an array');
  }
  if (typeof d['totalTokensIn'] !== 'number' || typeof d['totalTokensOut'] !== 'number') {
    throw new Error('Invalid session analytics: missing or invalid token totals');
  }
  return d as unknown as SessionAnalytics;
}

const DEFAULT_STORAGE_DIR = '.goodvibes/analytics';

/** Persists and loads session analytics from disk */
export class SessionSync {
  private readonly _store: AnalyticsStore;
  private readonly _storageDir: string;

  constructor(store: AnalyticsStore, storageDir = DEFAULT_STORAGE_DIR) {
    this._store = store;
    this._storageDir = storageDir;
  }

  /**
   * Flush the current in-memory analytics for a session to disk.
   * Creates the storage directory if it does not exist.
   */
  async sync(sessionId: string): Promise<void> {
    const session = this._store.sessions.get(sessionId);
    if (!session) {
      // Nothing to sync — not an error
      return;
    }
    await mkdir(this._storageDir, { recursive: true });
    const filePath = this._sessionPath(sessionId);
    await writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
  }

  /**
   * Load a session's analytics from disk into the in-memory store.
   * Returns the loaded session or null if no file exists.
   */
  async load(sessionId: string): Promise<SessionAnalytics | null> {
    const filePath = this._sessionPath(sessionId);
    try {
      const raw = await readFile(filePath, 'utf-8');
      let session: SessionAnalytics;
      try {
        session = validateSessionAnalytics(JSON.parse(raw));
      } catch (validationErr) {
        // Corrupted or schema-mismatched file — log warning and skip
        const msg = validationErr instanceof Error ? validationErr.message : String(validationErr);
        console.warn(`[SessionSync] Skipping corrupted analytics file '${filePath}': ${msg}`);
        return null;
      }
      this._store.sessions.set(sessionId, session);
      return session;
    } catch (err: unknown) {
      // File not found or unreadable
      if (isNodeError(err) && err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Flush all in-memory sessions to disk.
   */
  async syncAll(): Promise<void> {
    await mkdir(this._storageDir, { recursive: true });
    const promises = Array.from(this._store.sessions.keys()).map((id) =>
      this.sync(id)
    );
    await Promise.all(promises);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _sessionPath(sessionId: string): string {
    // Sanitise to prevent path traversal
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this._storageDir, `${safe}.json`);
  }
}

/** Type guard for Node.js errors with a `code` property */
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
