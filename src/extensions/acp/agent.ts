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
import type { McpBridge } from '../mcp/bridge.js';
import { PlanEmitter } from './plan-emitter.js';
import { CommandsEmitter } from './commands-emitter.js';
import { GoodVibesExtensions } from './extensions.js';
import { HealthCheck } from '../lifecycle/health.js';
import { AgentTracker } from '../agents/tracker.js';
import { EventRecorder } from './event-recorder.js';
import { StateStore } from '../../core/state-store.js';

// The protocol version this agent supports (ISS-029).
const SUPPORTED_VERSION: number = typeof PROTOCOL_VERSION === 'number' ? PROTOCOL_VERSION : 1;

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
 * Build a typed session_info SessionUpdate.
 * Uses 'session_info' discriminator per ACP spec.
 * Payload carries a text content block with the session title.
 */
function sessionInfoUpdate(title: string): schema.SessionUpdate {
  return { sessionUpdate: 'session_info' as any, content: { type: 'text', text: title } as any } as schema.SessionUpdate;
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

  /** Plan emitter for WRFC phase visibility */
  private readonly planEmitter: PlanEmitter;
  /** Commands emitter for slash command advertisement */
  private readonly commandsEmitter: CommandsEmitter;

  /**
   * GoodVibesExtensions delegate — handles all _goodvibes/* method calls and push notifications.
   * Wired when runtime deps (healthCheck, agentTracker, eventRecorder, stateStore) are provided.
   * ISS-025: delegate extMethod() to this instance instead of inline switch-case.
   */
  private readonly _extensions: GoodVibesExtensions | undefined;

  constructor(
    private readonly conn: AgentSideConnection,
    private readonly registry: Registry,
    private readonly eventBus: EventBus,
    private readonly sessions: SessionManager,
    private readonly wrfc: WRFCRunner,
    private readonly mcpBridge?: McpBridge,
    deps?: {
      healthCheck: HealthCheck;
      agentTracker: AgentTracker;
      eventRecorder: EventRecorder;
      stateStore: StateStore;
    },
  ) {
    this.planEmitter = new PlanEmitter(conn);
    this.commandsEmitter = new CommandsEmitter(conn);

    // ISS-025: Wire GoodVibesExtensions when runtime deps are available.
    if (deps !== undefined) {
      this._extensions = new GoodVibesExtensions(
        eventBus,
        deps.stateStore,
        registry,
        deps.healthCheck,
        deps.agentTracker,
        deps.eventRecorder,
      );

      // ISS-054: Subscribe to WRFC phase changes and push _goodvibes/status notifications.
      // The orchestrator emits 'wrfc:state-changed' with { workId, sessionId, from, to, attempt }.
      // Notifications are fire-and-forget — no response is expected from the client.
      this.eventBus.on('wrfc:state-changed', (event) => {
        const p = event.payload as { sessionId: string; to: string; attempt: number };
        // completedSteps = attempt index; totalSteps = 0 (not known at this layer)
        this._extensions!.pushStatus(conn, p.sessionId, p.to, p.attempt, 0).catch(() => {
          // Swallow push errors — client may have disconnected
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // initialize
  // -------------------------------------------------------------------------

  /**
   * Negotiate protocol capabilities with the client.
   * Stores clientCapabilities for use in bridge factories.
   */
  async initialize(params: schema.InitializeRequest): Promise<schema.InitializeResponse> {
    this._clientCapabilities = params.clientCapabilities ?? {};

    // ISS-098: Log client info and capabilities on initialize (stderr only — stdout is JSON-RPC)
    console.error('[GoodVibesAgent] initialize — clientInfo:', JSON.stringify(params.clientInfo ?? null));
    console.error('[GoodVibesAgent] initialize — clientCapabilities:', JSON.stringify(this._clientCapabilities));

    // ISS-029: Protocol version negotiation
    const clientVersion = typeof params.protocolVersion === 'number' ? params.protocolVersion : SUPPORTED_VERSION;
    if (clientVersion < SUPPORTED_VERSION) {
      throw Object.assign(
        new Error(`Unsupported protocol version: ${clientVersion}. Minimum supported: ${SUPPORTED_VERSION}`),
        { code: -32600 },
      );
    }
    const negotiatedVersion = Math.min(clientVersion, SUPPORTED_VERSION) as schema.ProtocolVersion;

    return {
      protocolVersion: negotiatedVersion,
      agentInfo: {
        name: 'goodvibes',
        title: 'GoodVibes Runtime',
        version: '0.1.0',
      },
      // ISS-003: Advertise no authentication required
      authMethods: [],
      agentCapabilities: {
        loadSession: true,
        mcpCapabilities: { http: false, sse: false },
        promptCapabilities: {
          embeddedContext: true,
          image: false,
          audio: false,
        },
        // ISS-030: Advertise session capabilities (all unstable features disabled)
        sessionCapabilities: {
          fork: null,
          list: null,
          resume: null,
        },
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
      ...(params.mcpServers && params.mcpServers.length > 0
        ? { mcpServers: params.mcpServers as unknown as import('../../types/session.js').MCPServerConfig[] }
        : {}),
    });

    // Connect MCP servers if provided and bridge is available
    if (this.mcpBridge && params.mcpServers && params.mcpServers.length > 0) {
      const connections = await this.mcpBridge.connectServers(params.mcpServers);
      const connectedIds = connections.map((c) => c.serverId);
      if (connectedIds.length > 0) {
        console.error(`[GoodVibesAgent] MCP servers connected for session ${sessionId}: ${connectedIds.join(', ')}`);
      }
    }

    // Advertise available commands to the client at session start
    await this.commandsEmitter.emitCommands(sessionId);

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

    // Reconnect MCP servers if bridge is available.
    // The spec requires that MCP servers be restored on session/load so that
    // the client's tool set is fully available without a new session.
    // MCPServerConfig (L0 stored config) is structurally compatible with
    // McpServerStdio for stdio transport; cast to McpServer[] for bridge.
    if (this.mcpBridge && context.config.mcpServers && context.config.mcpServers.length > 0) {
      const connections = await this.mcpBridge.connectServers(
        context.config.mcpServers as unknown as schema.McpServer[],
      );
      const connectedIds = connections.map((c) => c.serverId);
      if (connectedIds.length > 0) {
        console.error(
          `[GoodVibesAgent] MCP servers reconnected for session ${params.sessionId}: ${connectedIds.join(', ')}`,
        );
      }
    }

    // Stream history back as session updates
    for (const msg of history) {
      const updateType =
        msg.role === 'user' ? 'user_message_chunk' : 'agent_message_chunk';

      await this.conn.sessionUpdate({
        sessionId: params.sessionId,
        update: messageChunkUpdate(updateType, { type: 'text', text: msg.content }),
      });
    }

    // ISS-032: Emit config options as a session notification, then return null
    await this.conn.sessionUpdate({
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'config_option_update',
        configOptions: buildConfigOptions(
          modeFromConfigValue(context.config.mode),
          context.config.model,
        ),
      } as schema.SessionUpdate,
    });

    return null as any;
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
        update: sessionInfoUpdate(task.slice(0, 100)),
      });

      const workId = crypto.randomUUID();

      // Emit initial WRFC plan so the client can see phases
      this.planEmitter.initWrfcPlan(sessionId, workId);

      const result = await this.wrfc.run({
        workId,
        sessionId,
        task,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        // ISS-103: Do not emit non-spec 'finish' update; stopReason is in the return value
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

      // ISS-103: stopReason communicated via return value only; no 'finish' session update
      return { stopReason: 'end_turn' };
    } catch (err) {
      if (controller.signal.aborted) {
        // ISS-103: Do not emit non-spec 'finish' update; stopReason is in the return value
        return { stopReason: 'cancelled' };
      }

      // ISS-084: Propagate internal errors as JSON-RPC errors rather than disguising as end_turn
      const acpErr = toAcpError(err);
      throw Object.assign(new Error(acpErr.message), { code: acpErr.code });
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

    // ISS-011: Emit current_mode session update per ACP spec
    await this.conn.sessionUpdate({
      sessionId: params.sessionId,
      update: { sessionUpdate: 'current_mode' as any, currentModeId: params.modeId } as schema.SessionUpdate,
    }).catch(() => {});
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
   * ISS-025: Delegates all _goodvibes/* calls to GoodVibesExtensions.handle().
   * Non-_goodvibes/* methods throw METHOD_NOT_FOUND per ACP spec.
   *
   * Supported (via GoodVibesExtensions):
   *   - `_goodvibes/state`     — full runtime state snapshot
   *   - `_goodvibes/events`    — recent event stream
   *   - `_goodvibes/agents`    — active agent list
   *   - `_goodvibes/analytics` — token usage and metrics
   */
  async extMethod(
    method: string,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    // Non-extension methods are not routed here — reject immediately.
    if (!method.startsWith('_goodvibes/')) {
      throw Object.assign(new Error(`Unknown extension method: ${method}`), {
        code: ACP_ERROR_CODES.METHOD_NOT_FOUND,
      });
    }

    // Delegate to GoodVibesExtensions when wired (ISS-025).
    // Falls back to a minimal inline handler if deps were not provided at construction.
    if (this._extensions !== undefined) {
      // handle() returns Promise<unknown>; cast to the required return type.
      // The cast is safe: all _goodvibes/* handlers return Record<string, unknown> shapes.
      return this._extensions.handle(method, params) as Promise<Record<string, unknown>>;
    }

    // Fallback: _extensions not wired (composition root did not supply deps).
    // Return a minimal response so the call doesn't hard-fail.
    return { error: 'extensions_not_wired', method };
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
