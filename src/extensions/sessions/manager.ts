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
import type * as schema from '@agentclientprotocol/sdk';
import { buildConfigOptions, modeFromConfigValue } from '../acp/config-adapter.js';
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
// State transition table
// ---------------------------------------------------------------------------

/** Permitted lifecycle transitions per state */
const ALLOWED_TRANSITIONS: Readonly<Record<SessionState, SessionState[]>> = {
  idle: ['active', 'completed', 'cancelled'],
  active: ['idle', 'cancelled', 'completed'],
  cancelled: [],
  completed: [],
};

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
   * When `params.cwd` or `params.mcpServers` are provided, the stored session
   * context is updated with those values before returning. This implements
   * ISS-004 / ISS-019: `session/load` must honour request-level overrides.
   *
   * TODO(ISS-123): History replay is missing `_goodvibes/phase: 'replay'` marker.
   * When replaying history messages into the agent loop, each replayed message
   * should include `_goodvibes: { phase: 'replay' }` in its metadata so the
   * agent can distinguish replay from live input. This marker lives in agent.ts
   * at the point where history is replayed into the agent loop.
   */
  async load(
    sessionId: string,
    params?: { cwd?: string; mcpServers?: MCPServerConfig[] },
  ): Promise<{ context: SessionContext; history: HistoryMessage[] }> {
    let stored = this._store.get<StoredContext>(NS, sessionId);
    if (!stored) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // ISS-019: Update stored context when request overrides are present.
    if (params?.cwd !== undefined || params?.mcpServers !== undefined) {
      const updatedConfig: SessionContext['config'] = {
        ...stored.config,
        ...(params.cwd !== undefined ? { cwd: params.cwd } : {}),
        ...(params.mcpServers !== undefined ? { mcpServers: params.mcpServers } : {}),
      };
      stored = { ...stored, config: updatedConfig, updatedAt: Date.now() };
      this._store.set(NS, sessionId, stored);
    }

    const history = this._store.get<HistoryMessage[]>(NS, `${HISTORY_PREFIX}${sessionId}`) ?? [];
    const context: SessionContext = { ...stored, history };

    this._bus.emit('session:loaded', { sessionId });

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
        ...(stored.title !== undefined ? { title: stored.title } : {}),
      });
    }

    return summaries;
  }

  // -------------------------------------------------------------------------
  // setTitle
  // -------------------------------------------------------------------------

  /**
   * Set the title of a session.
   * A no-op if the session does not exist.
   */
  async setTitle(sessionId: string, title: string): Promise<void> {
    const stored = this._store.get<StoredContext>(NS, sessionId);
    if (!stored) return;
    this._store.set(NS, sessionId, { ...stored, title, updatedAt: Date.now() });
    this._bus.emit('session:title-set', { sessionId, title });
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
   * Validates that the transition is permitted before applying.
   * Emits `session:state-changed`.
   *
   * @throws {Error} if the transition from the current state to `state` is not allowed
   */
  async setState(sessionId: string, state: SessionState): Promise<void> {
    const stored = this._requireStored(sessionId);
    const from = stored.state;

    const allowed = ALLOWED_TRANSITIONS[from];
    if (!allowed.includes(state)) {
      throw new Error(
        `Invalid session state transition: '${from}' → '${state}'. Allowed: [${allowed.join(', ') || 'none'}]`,
      );
    }

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
   * Valid keys:
   *   - `'mode'`  — session operating mode (see {@link SessionMode})
   *   - `'model'` — model identifier string passed to the agent layer
   * Additional keys may be used for custom config options, but only `'mode'`
   * and `'model'` are recognized by the agent layer's `buildConfigOptions()`.
   *
   * Returns the full updated configOptions record so callers can reflect
   * the new state back to ACP (SetSessionConfigOption response).
   *
   * Storage note: configOptions is stored as a flat `Record<string, string>`
   * rather than `ConfigOption[]`. This is intentional — the agent layer's
   * `buildConfigOptions()` in config-adapter.ts reconstructs the full
   * `ConfigOption[]` wire format using the stored values as `currentValue`.
   * Custom config options beyond `mode` and `model` would need richer storage
   * (e.g. type metadata) if added in the future.
   *
   * TODO(ISS-033): The `session/new` handler in agent.ts casts
   * `params.mcpServers as unknown as MCPServerConfig[]` (line ~218) because
   * the ACP SDK McpServer type and our internal MCPServerConfig are structurally
   * compatible but nominally distinct. A proper adapter function should be
   * introduced in a shared conversion module rather than relying on the cast.
   *
   * Emits `session:config-changed`.
   */
  async setConfigOption(
    sessionId: string,
    key: string,
    value: string,
  ): Promise<schema.SessionConfigOption[]> {
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

    this._bus.emit('session:config-changed', { sessionId, key, value });

    // Build the full ConfigOption[] wire format using the canonical builder.
    // This returns the complete set of config options (mode + model) with full
    // metadata (names, choices, categories) as required by the ACP spec.
    const currentMode = modeFromConfigValue(updatedOptions['mode'] ?? stored.config.mode);
    const currentModel = updatedOptions['model'] ?? stored.config.model;
    return buildConfigOptions(currentMode, currentModel);
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
    const updatedStored: StoredContext = { ...stored, updatedAt: Date.now() };

    // Auto-generate title from the first user message (first 100 chars, trimmed)
    if (message.role === 'user' && stored.title === undefined) {
      const text =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((b): b is { type: 'text'; text: string } => b.type === 'text' && typeof (b as { text?: unknown }).text === 'string')
              .map((b) => (b as { type: 'text'; text: string }).text)
              .join(' ');
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        updatedStored.title = trimmed.slice(0, 100);
      }
    }

    this._store.set(NS, sessionId, updatedStored);
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
