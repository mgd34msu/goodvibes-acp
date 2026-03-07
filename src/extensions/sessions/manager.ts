/**
 * @module sessions/manager
 * @layer L2 — extends L1 core with session lifecycle management
 *
 * Creates, loads, destroys, and lists sessions. Persists state via L1
 * StateStore and broadcasts lifecycle events via L1 EventBus.
 */

import type {
  SessionState,
  SessionMode,
  SessionConfig,
  SessionContext,
  SessionSummary,
  HistoryMessage,
  MCPServerConfig,
} from '../../types/session.js';
import { StateStore } from '../../core/state-store.js';
import { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Internal storage shape
// ---------------------------------------------------------------------------

/** Stored context (without history, which lives under a separate key) */
type StoredContext = Omit<SessionContext, 'history'>;

// Namespace used for all session state
const NS = 'sessions';
// Key prefix for history entries
const HISTORY_PREFIX = 'history:';

// ---------------------------------------------------------------------------
// SessionManager
// ---------------------------------------------------------------------------

/**
 * Manages the full lifecycle of ACP sessions.
 *
 * Sessions are persisted in an L1 StateStore under the `sessions` namespace:
 *   - `{sessionId}`           → StoredContext (no history)
 *   - `history:{sessionId}`   → HistoryMessage[]
 *
 * Lifecycle transitions are broadcast via the L1 EventBus.
 */
export class SessionManager {
  private readonly _store: StateStore;
  private readonly _bus: EventBus;

  constructor(stateStore: StateStore, eventBus: EventBus) {
    this._store = stateStore;
    this._bus = eventBus;
  }

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  /**
   * Create a new session and persist it.
   * Emits `session:created`.
   */
  async create(params: {
    sessionId: string;
    cwd: string;
    mode?: SessionMode;
    model?: string;
    mcpServers?: MCPServerConfig[];
  }): Promise<SessionContext> {
    const { sessionId, cwd, mode = 'justvibes', model, mcpServers } = params;

    const config: SessionConfig = {
      cwd,
      mode,
      ...(model !== undefined ? { model } : {}),
      ...(mcpServers !== undefined ? { mcpServers } : {}),
    };

    const now = Date.now();
    const stored: StoredContext = {
      id: sessionId,
      state: 'idle',
      config,
      createdAt: now,
      updatedAt: now,
    };

    this._store.set(NS, sessionId, stored);
    this._store.set(NS, `${HISTORY_PREFIX}${sessionId}`, [] as HistoryMessage[]);

    this._bus.emit('session:created', { sessionId, cwd, mode });

    return { ...stored, history: [] };
  }

  // -------------------------------------------------------------------------
  // load
  // -------------------------------------------------------------------------

  /**
   * Load an existing session by ID.
   * Throws if the session does not exist.
   *
   * TODO(ISS-123): History replay is missing `_goodvibes/phase: 'replay'` marker.
   * When replaying history messages into the agent loop, each replayed message
   * should include `_goodvibes: { phase: 'replay' }` in its metadata so the
   * agent can distinguish replay from live input. This marker lives in agent.ts
   * at the point where history is replayed into the agent loop.
   */
  async load(sessionId: string): Promise<{ context: SessionContext; history: HistoryMessage[] }> {
    const stored = this._store.get<StoredContext>(NS, sessionId);
    if (!stored) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const history = this._store.get<HistoryMessage[]>(NS, `${HISTORY_PREFIX}${sessionId}`) ?? [];
    const context: SessionContext = { ...stored, history };
    return { context, history };
  }

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------

  /**
   * Destroy a session, removing all stored state and history.
   * Emits `session:destroyed`.
   */
  async destroy(sessionId: string): Promise<void> {
    this._store.delete(NS, sessionId);
    this._store.delete(NS, `${HISTORY_PREFIX}${sessionId}`);

    this._bus.emit('session:destroyed', { sessionId });
  }

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  /**
   * List all sessions as lightweight summaries.
   */
  async list(): Promise<SessionSummary[]> {
    const keys = this._store.keys(NS);
    const summaries: SessionSummary[] = [];

    for (const key of keys) {
      // Skip history entries
      if (key.startsWith(HISTORY_PREFIX)) continue;

      const stored = this._store.get<StoredContext>(NS, key);
      if (!stored) continue;

      summaries.push({
        id: stored.id,
        state: stored.state,
        mode: stored.config.mode,
        cwd: stored.config.cwd,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      });
    }

    return summaries;
  }

  // -------------------------------------------------------------------------
  // get
  // -------------------------------------------------------------------------

  /**
   * Get a session context by ID. Returns `undefined` if not found.
   */
  async get(sessionId: string): Promise<SessionContext | undefined> {
    const stored = this._store.get<StoredContext>(NS, sessionId);
    if (!stored) return undefined;

    const history = this._store.get<HistoryMessage[]>(NS, `${HISTORY_PREFIX}${sessionId}`) ?? [];
    return { ...stored, history };
  }

  // -------------------------------------------------------------------------
  // setState
  // -------------------------------------------------------------------------

  /**
   * Update the lifecycle state of a session.
   * Emits `session:state-changed`.
   */
  async setState(sessionId: string, state: SessionState): Promise<void> {
    const stored = this._requireStored(sessionId);
    const from = stored.state;

    const updated: StoredContext = { ...stored, state, updatedAt: Date.now() };
    this._store.set(NS, sessionId, updated);

    this._bus.emit('session:state-changed', { sessionId, from, to: state });
  }

  // -------------------------------------------------------------------------
  // setMode
  // -------------------------------------------------------------------------

  /**
   * Change the operating mode of a session.
   * Emits `session:mode-changed`.
   */
  async setMode(sessionId: string, mode: SessionMode): Promise<void> {
    const stored = this._requireStored(sessionId);
    const from = stored.config.mode;

    const updated: StoredContext = {
      ...stored,
      config: { ...stored.config, mode },
      updatedAt: Date.now(),
    };
    this._store.set(NS, sessionId, updated);

    this._bus.emit('session:mode-changed', { sessionId, from, to: mode });
  }

  // -------------------------------------------------------------------------
  // getMode
  // -------------------------------------------------------------------------

  /**
   * Get the current operating mode of a session.
   */
  async getMode(sessionId: string): Promise<SessionMode> {
    const stored = this._requireStored(sessionId);
    return stored.config.mode;
  }

  // -------------------------------------------------------------------------
  // setConfigOption
  // -------------------------------------------------------------------------

  /**
   * Set a named config option on a session.
   *
   * Returns the full updated configOptions record so callers can reflect
   * the new state back to ACP (SetSessionConfigOption response).
   */
  async setConfigOption(
    sessionId: string,
    key: string,
    value: string,
  ): Promise<Record<string, string>> {
    const stored = this._requireStored(sessionId);

    const updatedOptions: Record<string, string> = {
      ...stored.config.configOptions,
      [key]: value,
    };

    const updated: StoredContext = {
      ...stored,
      config: {
        ...stored.config,
        configOptions: updatedOptions,
      },
      updatedAt: Date.now(),
    };
    this._store.set(NS, sessionId, updated);

    return updatedOptions;
  }

  // -------------------------------------------------------------------------
  // addHistory
  // -------------------------------------------------------------------------

  /**
   * Append a message to the session's conversation history.
   */
  async addHistory(sessionId: string, message: HistoryMessage): Promise<void> {
    // Ensure the session exists
    this._requireStored(sessionId);

    const histKey = `${HISTORY_PREFIX}${sessionId}`;
    const history = this._store.get<HistoryMessage[]>(NS, histKey) ?? [];
    this._store.set(NS, histKey, [...history, message]);

    // Touch updatedAt on the context
    const stored = this._store.get<StoredContext>(NS, sessionId)!;
    this._store.set(NS, sessionId, { ...stored, updatedAt: Date.now() });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Retrieve stored context or throw if the session is not found. */
  private _requireStored(sessionId: string): StoredContext {
    const stored = this._store.get<StoredContext>(NS, sessionId);
    if (!stored) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return stored;
  }
}
