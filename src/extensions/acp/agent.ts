/**
 * @module acp/agent
 * @layer L2 — GoodVibes ACP agent implementation
 *
 * Implements the ACP Agent interface to bridge the GoodVibes runtime with
 * ACP-compliant clients (editors, CLIs, etc.).
 */

import type { Agent, AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type { SessionContext } from '../../types/session.js';
import { SessionManager } from '../sessions/manager.js';
import { Registry } from '../../core/registry.js';
import { EventBus } from '../../core/event-bus.js';
import { buildConfigOptions, modeFromConfigValue, CONFIG_ID_MODE, CONFIG_ID_MODEL } from './config-adapter.js';
import { toAcpError, ACP_ERROR_CODES } from './errors.js';

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * Adapter interface for the WRFC runner.
 *
 * The composition root implements this to wire a WRFCOrchestrator (or any
 * compatible runner) into the agent without creating a hard dependency on the
 * orchestrator's full signature. This keeps the agent layer free of WRFC
 * internals and makes the integration point explicit.
 */
interface WRFCRunner {
  run(params: {
    workId: string;
    sessionId: string;
    task: string;
    signal?: AbortSignal;
  }): Promise<{ state: string; lastScore?: { overall: number } }>;
}

// ---------------------------------------------------------------------------
// SessionUpdate helpers
// ---------------------------------------------------------------------------

/**
 * Build a typed user_message_chunk or agent_message_chunk SessionUpdate.
 * Avoids `as` casts by constructing the discriminated union directly.
 */
function messageChunkUpdate(
  updateType: 'user_message_chunk' | 'agent_message_chunk',
  content: schema.ContentBlock,
): schema.SessionUpdate {
  return { sessionUpdate: updateType, content };
}

/**
 * Build a typed session_info_update SessionUpdate.
 */
function sessionInfoUpdate(title: string, updatedAt: string): schema.SessionUpdate {
  return { sessionUpdate: 'session_info_update' as const, title, updatedAt };
}

// ---------------------------------------------------------------------------
// GoodVibesAgent
// ---------------------------------------------------------------------------

/**
 * The main GoodVibes ACP agent.
 *
 * One instance is created per ACP connection (via AgentSideConnection factory).
 * State for individual sessions is managed through the ISessionManager.
 */
export class GoodVibesAgent implements Agent {
  /** Capabilities advertised by the connected client (set in initialize) */
  private _clientCapabilities: schema.ClientCapabilities = {};

  /** Per-session AbortControllers for cancellation */
  private readonly _abortControllers = new Map<string, AbortController>();

  constructor(
    private readonly conn: AgentSideConnection,
    private readonly registry: Registry,
    private readonly eventBus: EventBus,
    private readonly sessions: SessionManager,
    private readonly wrfc: WRFCRunner,
  ) {}

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  /**
   * Negotiate protocol capabilities with the client.
   * Stores clientCapabilities for use in bridge factories.
   */
  async initialize(params: schema.InitializeRequest): Promise<schema.InitializeResponse> {
    this._clientCapabilities = params.clientCapabilities ?? {};

    return {
      protocolVersion: PROTOCOL_VERSION,
      agentInfo: {
        name: 'goodvibes',
        version: '0.1.0',
      },
      agentCapabilities: {
        loadSession: true,
      },
    };
  }

  // -------------------------------------------------------------------------
  // newSession
  // -------------------------------------------------------------------------

  /**
   * Create a new session and return its ID with initial config options.
   */
  async newSession(params: schema.NewSessionRequest): Promise<schema.NewSessionResponse> {
    const sessionId = crypto.randomUUID();

    await this.sessions.create({
      sessionId,
      cwd: params.cwd,
    });

    return {
      sessionId,
      configOptions: buildConfigOptions(),
    };
  }

  // -------------------------------------------------------------------------
  // loadSession
  // -------------------------------------------------------------------------

  /**
   * Load an existing session and replay its history as session/update
   * notifications to the client.
   */
  async loadSession(params: schema.LoadSessionRequest): Promise<schema.LoadSessionResponse> {
    let loaded: { context: SessionContext; history: Array<{ role: string; content: string; timestamp: number }> };

    try {
      loaded = await this.sessions.load(params.sessionId);
    } catch (err) {
      const acpErr = toAcpError(err);
      throw Object.assign(new Error(acpErr.message), { code: acpErr.code });
    }

    const { context, history } = loaded;

    // Stream history back as session updates
    for (const msg of history) {
      const updateType =
        msg.role === 'user' ? 'user_message_chunk' : 'agent_message_chunk';

      await this.conn.sessionUpdate({
        sessionId: params.sessionId,
        update: messageChunkUpdate(updateType, { type: 'text', text: msg.content }),
      });
    }

    return {
      configOptions: buildConfigOptions(
        modeFromConfigValue(context.config.mode),
        context.config.model,
      ),
    };
  }

  // -------------------------------------------------------------------------
  // authenticate
  // -------------------------------------------------------------------------

  /**
   * No-op — GoodVibes does not require authentication.
   */
  async authenticate(_params: schema.AuthenticateRequest): Promise<void> {
    // No auth required
  }

  // -------------------------------------------------------------------------
  // prompt
  // -------------------------------------------------------------------------

  /**
   * Process a user prompt.
   *
   * 1. Extract text from the prompt content blocks
   * 2. Stream a session_info_update to signal activity
   * 3. Run the WRFC loop
   * 4. Stream the result summary as an agent_message_chunk
   * 5. Return the stop reason
   */
  async prompt(params: schema.PromptRequest): Promise<schema.PromptResponse> {
    const { sessionId, prompt } = params;

    // Extract text from prompt blocks
    const task = prompt
      .filter((block: schema.ContentBlock): block is schema.ContentBlock & { type: 'text'; text: string } =>
        block.type === 'text' && 'text' in block,
      )
      .map((block: schema.ContentBlock & { type: 'text'; text: string }) => block.text)
      .join('\n');

    // Create a per-prompt AbortController
    const controller = new AbortController();
    this._abortControllers.set(sessionId, controller);

    // Record user message in history
    await this.sessions.addHistory(sessionId, {
      role: 'user',
      content: task,
      timestamp: Date.now(),
    });

    try {
      // Emit session_info_update to signal work has started
      await this.conn.sessionUpdate({
        sessionId,
        update: sessionInfoUpdate(task.slice(0, 100), new Date().toISOString()),
      });

      const workId = crypto.randomUUID();

      const result = await this.wrfc.run({
        workId,
        sessionId,
        task,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return { stopReason: 'cancelled' };
      }

      // Build summary for the client
      const score = result.lastScore?.overall;
      const summary =
        result.state === 'complete'
          ? `Task completed${score !== undefined ? ` (score: ${score.toFixed(1)})` : ''}.`
          : `Task ended with state: ${result.state}${score !== undefined ? ` (score: ${score.toFixed(1)})` : ''}.`;

      // Stream result as agent message chunk
      await this.conn.sessionUpdate({
        sessionId,
        update: messageChunkUpdate('agent_message_chunk', { type: 'text', text: summary }),
      });

      // Record assistant message in history
      await this.sessions.addHistory(sessionId, {
        role: 'assistant',
        content: summary,
        timestamp: Date.now(),
      });

      return { stopReason: 'end_turn' };
    } catch (err) {
      if (controller.signal.aborted) {
        return { stopReason: 'cancelled' };
      }

      // Stream error to client
      const acpErr = toAcpError(err);
      await this.conn.sessionUpdate({
        sessionId,
        update: messageChunkUpdate('agent_message_chunk', { type: 'text', text: `Error: ${acpErr.message}` }),
      }).catch(() => {});

      return { stopReason: 'end_turn' };
    } finally {
      this._abortControllers.delete(sessionId);
    }
  }

  // -------------------------------------------------------------------------
  // cancel
  // -------------------------------------------------------------------------

  /**
   * Cancel an in-progress prompt turn for the given session.
   */
  async cancel(params: schema.CancelNotification): Promise<void> {
    const controller = this._abortControllers.get(params.sessionId);
    controller?.abort();
  }

  // -------------------------------------------------------------------------
  // setSessionMode
  // -------------------------------------------------------------------------

  /**
   * Switch the operating mode for a session.
   */
  async setSessionMode(params: schema.SetSessionModeRequest): Promise<void> {
    await this.sessions.setMode(params.sessionId, modeFromConfigValue(params.modeId));
  }

  // -------------------------------------------------------------------------
  // setSessionConfigOption
  // -------------------------------------------------------------------------

  /**
   * Set a named config option on a session.
   * Returns the full updated config state.
   */
  async setSessionConfigOption(
    params: schema.SetSessionConfigOptionRequest,
  ): Promise<schema.SetSessionConfigOptionResponse> {
    const { sessionId, configId, value } = params;

    // Persist the option
    await this.sessions.setConfigOption(sessionId, configId, value);

    // If mode changed, delegate to setMode as well
    if (configId === CONFIG_ID_MODE) {
      const mode = modeFromConfigValue(value);
      await this.sessions.setMode(sessionId, mode);
    }

    // Re-read state to build accurate configOptions
    const context = await this.sessions.get(sessionId);
    const currentMode = modeFromConfigValue(context?.config.mode ?? 'justvibes');
    const currentModel = context?.config.model ?? 'claude-sonnet-4-6';

    return {
      configOptions: buildConfigOptions(currentMode, currentModel),
    };
  }

  // -------------------------------------------------------------------------
  // extMethod
  // -------------------------------------------------------------------------

  /**
   * Handle GoodVibes extension methods.
   *
   * Supported:
   *   - `_goodvibes/state`  — return current runtime state
   *   - `_goodvibes/agents` — return registered agent capabilities
   */
  async extMethod(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (method) {
      case '_goodvibes/state': {
        const sessionId = params['sessionId'] as string | undefined;
        if (sessionId) {
          const context = await this.sessions.get(sessionId);
          return { session: context ?? null };
        }
        return { runtime: 'goodvibes', version: '0.1.0' };
      }

      case '_goodvibes/agents': {
        const spawners = this.registry.get<{ id: string; capabilities: string[] }>('spawner');
        return { agents: spawners ?? [] };
      }

      default:
        throw Object.assign(new Error(`Unknown extension method: ${method}`), {
          code: ACP_ERROR_CODES.METHOD_NOT_FOUND,
        });
    }
  }

  // -------------------------------------------------------------------------
  // extNotification
  // -------------------------------------------------------------------------

  /**
   * Handle GoodVibes extension notifications.
   *
   * Supported:
   *   - `_goodvibes/directive` — emit a runtime directive event
   */
  async extNotification(
    method: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    if (method === '_goodvibes/directive') {
      this.eventBus.emit('directive:received', params);
      return;
    }
    // Unknown notifications are silently ignored per ACP convention
  }
}
