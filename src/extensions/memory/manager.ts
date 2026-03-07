/**
 * @module memory/manager
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * Cross-session memory CRUD manager.
 * Manages decisions, patterns, failures, and preferences with JSON file
 * persistence in a configurable basePath directory.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EventBus } from '../../core/event-bus.js';
import type {
  DecisionRecord,
  FailureRecord,
  MemoryStore,
  PatternRecord,
  PreferenceRecord,
} from '../../types/memory.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = '1.0.0';
const MEMORY_FILE = 'memory.json';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface DecisionFilter {
  category?: string;
  status?: string;
  keyword?: string;
}

export interface KeywordFilter {
  keyword?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Case-insensitive substring match */
function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Generate a unique ID like `dec_20260307_143052` */
function buildId(prefix: string): string {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const time = now
    .toISOString()
    .slice(11, 19)
    .replace(/:/g, '');
  return `${prefix}_${date}_${time}`;
}

/** Build an empty memory store */
function emptyStore(): MemoryStore {
  return {
    $schema: SCHEMA_VERSION,
    decisions: [],
    patterns: [],
    failures: [],
    preferences: [],
  };
}

// ---------------------------------------------------------------------------
// MemoryManager
// ---------------------------------------------------------------------------

/**
 * Cross-session memory manager.
 *
 * Stores records in a single `memory.json` file within `basePath`.
 * All mutations are in-memory until `save()` is called explicitly.
 * Call `load()` at startup to restore persisted records.
 */
export class MemoryManager {
  private readonly _basePath: string;
  private readonly _bus: EventBus;
  private _store: MemoryStore;

  constructor(basePath: string, eventBus: EventBus) {
    this._basePath = basePath;
    this._bus = eventBus;
    this._store = emptyStore();
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Generate a time-stamped ID with the given prefix.
   * Format: `<prefix>_YYYYMMDD_HHmmss`
   */
  generateId(prefix: string): string {
    return buildId(prefix);
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Load the memory store from disk.
   * If the file does not exist, the in-memory store is reset to empty.
   * Emits `memory:loaded`.
   */
  async load(): Promise<void> {
    const filePath = join(this._basePath, MEMORY_FILE);
    try {
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as MemoryStore;
      this._store = {
        $schema: parsed.$schema ?? SCHEMA_VERSION,
        decisions: parsed.decisions ?? [],
        patterns: parsed.patterns ?? [],
        failures: parsed.failures ?? [],
        preferences: parsed.preferences ?? [],
      };
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // No file yet — start fresh
        this._store = emptyStore();
      } else {
        throw err;
      }
    }
    this._bus.emit('memory:loaded', { basePath: this._basePath });
  }

  /**
   * Persist the current in-memory store to disk.
   * Creates the basePath directory if it does not exist.
   * Emits `memory:saved`.
   */
  async save(): Promise<void> {
    await mkdir(this._basePath, { recursive: true });
    const filePath = join(this._basePath, MEMORY_FILE);
    await writeFile(filePath, JSON.stringify(this._store, null, 2), 'utf-8');
    this._bus.emit('memory:saved', { basePath: this._basePath });
  }

  // -------------------------------------------------------------------------
  // Decisions
  // -------------------------------------------------------------------------

  /**
   * Add a decision record.
   * Assigns a generated ID; emits `memory:decision-added`.
   */
  addDecision(record: Omit<DecisionRecord, 'id'>): DecisionRecord {
    const full: DecisionRecord = { id: buildId('dec'), ...record };
    this._store.decisions.push(full);
    this._bus.emit('memory:decision-added', { record: full });
    return full;
  }

  /** Retrieve a decision by ID. Returns `undefined` if not found. */
  getDecision(id: string): DecisionRecord | undefined {
    return this._store.decisions.find((d) => d.id === id);
  }

  /**
   * Query decisions by category, status, and/or keyword.
   * Keyword is matched case-insensitively against `what`, `why`, `category`,
   * and `scope`.
   */
  queryDecisions(filter: DecisionFilter): DecisionRecord[] {
    return this._store.decisions.filter((d) => {
      if (filter.category && d.category !== filter.category) return false;
      if (filter.status && d.status !== filter.status) return false;
      if (filter.keyword) {
        const kw = filter.keyword;
        if (
          !matches(d.what, kw) &&
          !matches(d.why, kw) &&
          !matches(d.category, kw) &&
          !matches(d.scope, kw)
        ) {
          return false;
        }
      }
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // Patterns
  // -------------------------------------------------------------------------

  /**
   * Add a pattern record.
   * Assigns a generated ID; emits `memory:pattern-added`.
   */
  addPattern(record: Omit<PatternRecord, 'id'>): PatternRecord {
    const full: PatternRecord = { id: buildId('pat'), ...record };
    this._store.patterns.push(full);
    this._bus.emit('memory:pattern-added', { record: full });
    return full;
  }

  /** Retrieve a pattern by ID. Returns `undefined` if not found. */
  getPattern(id: string): PatternRecord | undefined {
    return this._store.patterns.find((p) => p.id === id);
  }

  /**
   * Query patterns by keyword.
   * Keyword is matched case-insensitively against `name`, `description`,
   * `when_to_use`, and each entry in `keywords`.
   */
  queryPatterns(filter: KeywordFilter): PatternRecord[] {
    return this._store.patterns.filter((p) => {
      if (!filter.keyword) return true;
      const kw = filter.keyword;
      return (
        matches(p.name, kw) ||
        matches(p.description, kw) ||
        matches(p.when_to_use, kw) ||
        p.keywords.some((k) => matches(k, kw))
      );
    });
  }

  // -------------------------------------------------------------------------
  // Failures
  // -------------------------------------------------------------------------

  /**
   * Add a failure record.
   * Assigns a generated ID; emits `memory:failure-added`.
   */
  addFailure(record: Omit<FailureRecord, 'id'>): FailureRecord {
    const full: FailureRecord = { id: buildId('fail'), ...record };
    this._store.failures.push(full);
    this._bus.emit('memory:failure-added', { record: full });
    return full;
  }

  /** Retrieve a failure by ID. Returns `undefined` if not found. */
  getFailure(id: string): FailureRecord | undefined {
    return this._store.failures.find((f) => f.id === id);
  }

  /**
   * Query failures by keyword.
   * Keyword is matched case-insensitively against `error`, `context`,
   * `root_cause`, `resolution`, `prevention`, and each entry in `keywords`.
   */
  queryFailures(filter: KeywordFilter): FailureRecord[] {
    return this._store.failures.filter((f) => {
      if (!filter.keyword) return true;
      const kw = filter.keyword;
      return (
        matches(f.error, kw) ||
        matches(f.context, kw) ||
        matches(f.root_cause, kw) ||
        matches(f.resolution, kw) ||
        matches(f.prevention, kw) ||
        f.keywords.some((k) => matches(k, kw))
      );
    });
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  /**
   * Set (create or update) a preference.
   * Emits `memory:preference-set`.
   */
  setPreference(key: string, value: string, reason: string): PreferenceRecord {
    const record: PreferenceRecord = {
      key,
      value,
      reason,
      setAt: new Date().toISOString(),
    };
    const idx = this._store.preferences.findIndex((p) => p.key === key);
    if (idx >= 0) {
      this._store.preferences[idx] = record;
    } else {
      this._store.preferences.push(record);
    }
    this._bus.emit('memory:preference-set', { record });
    return record;
  }

  /** Retrieve a preference by key. Returns `undefined` if not found. */
  getPreference(key: string): PreferenceRecord | undefined {
    return this._store.preferences.find((p) => p.key === key);
  }

  /** Return all stored preferences. */
  allPreferences(): PreferenceRecord[] {
    return [...this._store.preferences];
  }
}
