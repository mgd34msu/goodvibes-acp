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
import type { SessionContext, HistoryMessage } from '../../types/session.js';
import { SessionManager } from '../sessions/manager.js';
import { Registry } from '../../core/registry.js';
import { EventBus } from '../../core/event-bus.js';
import { buildConfigOptions, buildLegacyModes, modeFromConfigValue, CONFIG_ID_MODE, CONFIG_ID_MODEL } from './config-adapter.js';
import { toAcpError, ACP_ERROR_CODES } from './errors.js';
import type { McpBridge } from '../mcp/bridge.js';
import { PlanEmitter } from './plan-emitter.js';
import { CommandsEmitter } from './commands-emitter.js';
import { GoodVibesExtensions } from './extensions.js';
import { HealthCheck } from '../lifecycle/health.js';
import { AgentTracker } from '../agents/tracker.js';
import { EventRecorder } from './event-recorder.js';
import { StateStore } from '../../core/state-store.js';
import { RUNTIME_VERSION } from '../../types/constants.js';

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
  }): Promise<{
    state: string;
    lastScore?: { overall: number };
    /**
     * ACP stop reason derived from the innermost agent loop result.
     * Propagated so the prompt handler can return 'max_tokens' or
     * 'max_turn_requests' instead of always returning 'end_turn'.
     */
    stopReason?: 'end_turn' | 'max_tokens' | 'max_turn_requests';
  }>;
}

// ---------------------------------------------------------------------------
// PendingRequestTracker
// ---------------------------------------------------------------------------

/**
 * Tracks in-flight JSON-RPC request IDs sent by the agent to the client
 * (e.g. terminal/create, session/request_permission, fs/* calls).
 *
 * When a session is cancelled, the agent MUST send `$/cancel_request`
 * notifications for each pending client request so the client can respond
 * with -32800 errors and the agent can then reply to the original
 * session/prompt with stopReason: 'cancelled'.
 *
 * ACP spec: docs/protocol/draft/cancellation.mdx
 */
class PendingRequestTracker {
  private readonly _pending = new Map<string, Set<string>>();

  /** Register a pending client-side request ID for a session */
  add(sessionId: string, requestId: string): void {
    let set = this._pending.get(sessionId);
    if (!set) {
      set = new Set();
      this._pending.set(sessionId, set);
    }
    set.add(requestId);
  }

  /** Remove a resolved/cancelled request ID */
  remove(sessionId: string, requestId: string): void {
    this._pending.get(sessionId)?.delete(requestId);
  }

  /** Drain all pending request IDs for a session (returns them for cancellation) */
  drain(sessionId: string): string[] {
    const set = this._pending.get(sessionId);
    if (!set || set.size === 0) return [];
    const ids = Array.from(set);
    set.clear();
    return ids;
  }

  /** Clean up session state */
  delete(sessionId: string): void {
    this._pending.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// SessionUpdate helpers
// ---------------------------------------------------------------------------

/**
 * Build a typed user_message_chunk, agent_message_chunk, or agent_thought_chunk
 * SessionUpdate. Avoids `as` casts by constructing the discriminated union directly.
 */
function messageChunkUpdate(
  updateType: 'user_message_chunk' | 'agent_message_chunk' | 'agent_thought_chunk',
  content: schema.ContentBlock,
): schema.SessionUpdate {
  return { sessionUpdate: updateType, content };
}

/**
 * Build a typed session_info SessionUpdate.
 * Uses 'session_info' discriminator per ACP spec.
 * Payload carries a text content block with the session title.
 */
/**
 * ISS-104: Categorize an error into an ACP stopReason when appropriate.
 * Returns 'refusal' for deliberate content-policy refusals, null for all
 * other errors (which should propagate as JSON-RPC errors per ISS-084).
 */
function toStopReason(err: unknown): schema.PromptResponse['stopReason'] | null {
  if (
    err instanceof Error &&
    (
      err.message.toLowerCase().includes('content policy') ||
      err.message.toLowerCase().includes('refusal') ||
      (err as Error & { code?: string }).code === 'refusal'
    )
  ) {
    return 'refusal';
  }
  return null;
}

/**
 * Build a typed session_info_update SessionUpdate.
 * Uses 'session_info_update' discriminator per ACP SDK (SDK type: SessionInfoUpdate).
 * The ACP spec prose may reference 'session_info' but the SDK union discriminator is 'session_info_update'.
 */
function sessionInfoUpdate(title: string): schema.SessionUpdate {
  const update: schema.SessionInfoUpdate & { sessionUpdate: 'session_info_update' } = {
    sessionUpdate: 'session_info_update',
    title,
  };
  return update;
}

// ---------------------------------------------------------------------------
// Prompt content processing
// ---------------------------------------------------------------------------

/**
 * Determine if a MIME type represents text content that can be decoded from base64.
 */
function isTextMimeType(mimeType: string | undefined): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'application/javascript' ||
    mimeType === 'application/typescript'
  );
}

/**
 * Result of processing prompt content blocks.
 */
export interface ProcessedPrompt {
  /** Flat text string for the WRFC task runner. */
  task: string;
  /** Rich content blocks for history storage. */
  richContent: Array<{ type: string; [key: string]: unknown }>;
}

/**
 * Process ACP prompt content blocks into a task string and rich history content.
 *
 * Handles three block types:
 * - `text`: extracted verbatim
 * - `resource`: text resources extracted with URI delimiter; blob resources decoded
 *   if the MIME type is text-like, otherwise replaced with a placeholder
 * - `resource_link`: included as a placeholder (agent cannot fetch the content)
 */
export function processPromptBlocks(blocks: schema.ContentBlock[]): ProcessedPrompt {
  const parts: string[] = [];
  const richContent: Array<{ type: string; [key: string]: unknown }> = [];

  for (const block of blocks) {
    if (block.type === 'text' && 'text' in block) {
      const text = (block as { type: 'text'; text: string }).text;
      parts.push(text);
      richContent.push({ type: 'text', text });
    } else if (block.type === 'resource' && 'resource' in block) {
      const res = (block as { type: 'resource'; resource: Record<string, unknown> }).resource;
      const uri = typeof res['uri'] === 'string' ? res['uri'] : '<unknown>';
      const mimeType = typeof res['mimeType'] === 'string' ? res['mimeType'] : undefined;

      let content: string;
      if (typeof res['text'] === 'string') {
        // Text resource
        content = res['text'];
      } else if (typeof res['blob'] === 'string') {
        // Blob resource — decode if text mime type
        if (isTextMimeType(mimeType)) {
          try {
            content = Buffer.from(res['blob'], 'base64').toString('utf-8');
          } catch {
            content = `[binary resource: ${uri}]`;
          }
        } else {
          content = `[binary resource: ${uri}]`;
        }
      } else {
        content = `[resource: ${uri}]`;
      }

      parts.push(`\n--- Resource: ${uri} ---\n${content}\n`);
      richContent.push({ ...block });
    } else if (block.type === 'resource_link' && 'resource_link' in block) {
      const link = (block as { type: 'resource_link'; resource_link: Record<string, unknown> }).resource_link;
      const uri = typeof link['uri'] === 'string' ? link['uri'] : '<unknown>';
      const name = typeof link['name'] === 'string' ? link['name'] : uri;
      parts.push(`[Resource link: ${uri} - ${name}]`);
      richContent.push({ ...block });
    }
    // Unknown block types are silently skipped
  }

  return { task: parts.join('\n'), richContent };
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

  /** ISS-109: True once EventBus bridges are registered in the constructor */
  private _bridgesReady = false;

  /** Per-session AbortControllers for cancellation */
  private readonly _abortControllers = new Map<string, AbortController>();

  /** Tracks in-flight client-side request IDs for cascading cancellation (ACP spec) */
  private readonly _pendingRequests = new PendingRequestTracker();

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
        this._extensions!.pushStatus(conn, p.sessionId, p.to, p.attempt, 0).catch((err) => {
          // Intentional: fire-and-forget status notification — client may have disconnected
          console.error('[GoodVibesAgent] pushStatus(wrfc:state-changed) failed:', String(err));
        });
      });
    }

    // Wire EventBus-based request tracking so bridge classes automatically populate
    // _pendingRequests without needing explicit tracker constructor injection.
    // Bridges emit 'acp:client-request:start' / 'acp:client-request:end' events;
    // the agent subscribes here to decouple the tracker from bridge construction.
    this.eventBus.on('acp:client-request:start', (event) => {
      const p = event.payload as { sessionId: string; requestId: string };
      this._pendingRequests.add(p.sessionId, p.requestId);
    });
    this.eventBus.on('acp:client-request:end', (event) => {
      const p = event.payload as { sessionId: string; requestId: string };
      this._pendingRequests.remove(p.sessionId, p.requestId);
    });

    // ISS-109: Mark bridges as ready after all EventBus listeners are established.
    this._bridgesReady = true;
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
        version: RUNTIME_VERSION,
      },
      // ISS-003: Advertise no authentication required
      authMethods: [],
      agentCapabilities: {
        loadSession: true,
        // NOTE: SDK field name is `mcpCapabilities` (schema.AgentCapabilities line 27).
        // ACP spec prose uses `mcp` but the TypeScript SDK type uses `mcpCapabilities`.
        mcpCapabilities: { http: true, sse: false },
        promptCapabilities: {
          embeddedContext: true,
          image: false,
          audio: false,
        },
        // ISS-030: Advertise session capabilities.
        // SDK type: fork/list/resume are `XxxCapabilities | null` — null means not supported.
        // list: {} means supported (SessionListCapabilities accepts an empty object).
        sessionCapabilities: {
          fork: null,
          list: {},
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
      // Per ACP session-modes spec (transition period): include legacy `modes`
      // alongside the new `configOptions` so clients that have not yet migrated
      // continue to receive mode state on session/new.
      modes: buildLegacyModes(),
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
    let loaded: { context: SessionContext; history: HistoryMessage[] };

    try {
      // ISS-004 / ISS-019: Pass request-level cwd and mcpServers overrides to
      // SessionManager.load() so stored context is updated on resume.
      loaded = await this.sessions.load(params.sessionId, {
        ...(params.cwd !== undefined ? { cwd: params.cwd } : {}),
        ...(params.mcpServers !== undefined
          ? { mcpServers: params.mcpServers as unknown as import('../../types/session.js').MCPServerConfig[] }
          : {}),
      });
    } catch (err) {
      const acpErr = toAcpError(err);
      throw Object.assign(new Error(acpErr.message), { code: acpErr.code });
    }

    const { context, history } = loaded;

    // Reconnect MCP servers if bridge is available.
    // Use the updated context — which reflects params.mcpServers when provided,
    // falling back to the stored config when params.mcpServers was omitted.
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
      // Map role to ACP session update discriminator:
      //   'user'      → user_message_chunk
      //   'assistant' → agent_message_chunk
      //   'thinking'  → agent_thought_chunk (ACP prompt-turn spec)
      const updateType =
        msg.role === 'user' ? 'user_message_chunk'
        : msg.role === 'thinking' ? 'agent_thought_chunk'
        : 'agent_message_chunk';

      await this.conn.sessionUpdate({
        sessionId: params.sessionId,
        update: messageChunkUpdate(
            updateType,
            typeof msg.content === 'string'
              ? { type: 'text', text: msg.content }
              : Array.isArray(msg.content)
                ? (msg.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined) ??
                  { type: 'text', text: '' }
                : { type: 'text', text: '' },
          ),
      });
    }

    // ISS-142: configOptions is returned in the response below; the prior
    // duplicate sessionUpdate notification has been removed to avoid sending
    // identical payloads to the client. The response carries config options
    // and is always delivered, making the notification redundant.
    const loadedMode = modeFromConfigValue(context.config.mode);
    return {
      configOptions: buildConfigOptions(
        loadedMode,
        context.config.model,
      ),
      // Per ACP session-modes spec (transition period): include legacy `modes`
      // alongside the new `configOptions` so clients that have not yet migrated
      // continue to receive mode state on session/load.
      modes: buildLegacyModes(loadedMode),
    };
  }

  // -------------------------------------------------------------------------
  // authenticate
  // -------------------------------------------------------------------------

  /**
   * No-op — GoodVibes does not require authentication.
   * ISS-065: Returns AuthenticateResponse ({}) rather than void to satisfy
   * the SDK type contract and produce a well-formed JSON-RPC result.
   */
  async authenticate(_params: schema.AuthenticateRequest): Promise<schema.AuthenticateResponse> {
    return {};
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
    // ISS-109: Guard against prompts arriving before EventBus bridges are established.
    if (!this._bridgesReady) {
      throw Object.assign(new Error('ACP bridges must be registered before processing prompts'), { code: -32603 });
    }

    const { sessionId, prompt } = params;

    // Extract text and rich content from prompt blocks (handles text, resource, resource_link)
    const { task, richContent } = processPromptBlocks(prompt);

    // Create a per-prompt AbortController
    const controller = new AbortController();
    this._abortControllers.set(sessionId, controller);

    // Record user message in history with full rich content blocks
    await this.sessions.addHistory(sessionId, {
      role: 'user',
      content: richContent.length > 0 ? richContent : task,
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

      // Propagate explicit stop reasons from the agent loop:
      // max_tokens — LLM response was truncated (KB-04 lines 446-460)
      // max_turn_requests — turn count limit exceeded
      if (result.stopReason === 'max_tokens' || result.stopReason === 'max_turn_requests') {
        console.error(`[GoodVibesAgent] Returning stopReason='${result.stopReason}' from WRFC result`);
        return { stopReason: result.stopReason };
      }

      // Build summary for the client
      const score = result.lastScore?.overall;
      const summary =
        result.state === 'complete'
          ? `Task completed${score !== undefined ? ` (score: ${score.toFixed(1)})` : ''}.`
          : `Task ended with state: ${result.state}${score !== undefined ? ` (score: ${score.toFixed(1)})` : ''}.`;

      // Log non-complete states to stderr for visibility
      if (result.state !== 'complete') {
        console.error(`[GoodVibesAgent] WRFC ended with state: ${result.state}`);
      }

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

      // ISS-104: Categorize errors — deliberate refusals get 'refusal' stopReason;
      // all other errors propagate as JSON-RPC errors per ISS-084.
      const stopReason = toStopReason(err);
      if (stopReason !== null) {
        return { stopReason };
      }

      // ISS-084: Propagate internal errors as JSON-RPC errors rather than disguising as end_turn
      const acpErr = toAcpError(err);
      throw Object.assign(new Error(acpErr.message), { code: acpErr.code });
    } finally {
      this._abortControllers.delete(sessionId);
      this._pendingRequests.delete(sessionId);
    }
  }

  // -------------------------------------------------------------------------
  // getRequestTracker
  // -------------------------------------------------------------------------

  /**
   * Returns a RequestTracker bound to the given sessionId.
   *
   * Pass the returned tracker to bridge instances (AcpTerminal, AcpFileSystem,
   * PermissionGate) so their in-flight request IDs are registered in the
   * agent's PendingRequestTracker. When cancel() is called, it drains the
   * tracker and sends `$/cancel_request` for all pending requests.
   *
   * NOTE: Bridges are currently created ad-hoc in tests. When bridges are
   * instantiated in the production path (e.g. via session context injection
   * from the composition root), pass the tracker returned here.
   *
   * ACP spec: docs/protocol/draft/cancellation.mdx
   */
  getRequestTracker(sessionId: string): import('./terminal-bridge.js').RequestTracker {
    return {
      add: (requestId: string) => this._pendingRequests.add(sessionId, requestId),
      remove: (requestId: string) => this._pendingRequests.remove(sessionId, requestId),
    };
  }

  // -------------------------------------------------------------------------
  // cancel
  // -------------------------------------------------------------------------

  /**
   * Cancel an in-progress prompt turn for the given session.
   *
   * Per ACP spec (docs/protocol/draft/cancellation.mdx):
   * 1. Abort the local AbortController (propagates into WRFC / agent loop)
   * 2. Send `$/cancel_request` for any in-flight client-side requests
   *    (terminal/create, session/request_permission, fs/* calls)
   *    so the client can respond with -32800 and clean up its side.
   *
   * The `$/cancel_request` notification payload uses `{ id }` per JSON-RPC 2.0
   * / LSP cancellation convention (same field name used by LSP `$/cancelRequest`).
   */
  async cancel(params: schema.CancelNotification): Promise<void> {
    const { sessionId } = params;

    // Step 1: abort the running WRFC/AgentLoop signal
    const controller = this._abortControllers.get(sessionId);
    controller?.abort();

    // Step 2: cascade cancellation to all pending client-side requests
    const pendingIds = this._pendingRequests.drain(sessionId);
    for (const id of pendingIds) {
      // extNotification is fire-and-forget — the client handles it asynchronously
      this.conn.extNotification('$/cancel_request', { id }).catch((err) => {
        console.error(`[GoodVibesAgent] $/cancel_request(${id}) failed:`, String(err));
        this.eventBus.emit('acp:cancel-request:failed', { sessionId, requestId: id, error: String(err) });
      });
    }

    if (pendingIds.length > 0) {
      console.error(`[GoodVibesAgent] cancel(${sessionId}): sent $/cancel_request for ${pendingIds.length} pending request(s)`);
    }
  }

  // -------------------------------------------------------------------------
  // setSessionMode
  // -------------------------------------------------------------------------

  /**
   * Switch the operating mode for a session.
   */
  async setSessionMode(params: schema.SetSessionModeRequest): Promise<void> {
    await this.sessions.setMode(params.sessionId, modeFromConfigValue(params.modeId));

    // ISS-011: Emit current_mode_update session update per ACP spec
    // SDK discriminator: 'current_mode_update'; field: currentModeId (schema.CurrentModeUpdate)
    await this.conn.sessionUpdate({
      sessionId: params.sessionId,
      update: { sessionUpdate: 'current_mode_update', currentModeId: params.modeId },
    }).catch((err) => { console.error('[GoodVibesAgent] setSessionMode sessionUpdate failed:', String(err)); });
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
  // unstable_listSessions
  // -------------------------------------------------------------------------

  /**
   * List sessions with optional cwd filtering and cursor-based pagination.
   *
   * Implements the `session/list` ACP endpoint.
   * Page size: 20. Cursor is a base64-encoded page index (1-based).
   * Invalid cursor → JSON-RPC error (-32602 INVALID_PARAMS).
   */
  async unstable_listSessions(
    params: schema.ListSessionsRequest,
  ): Promise<schema.ListSessionsResponse> {
    const PAGE_SIZE = 20;

    // Parse cursor — base64-encoded stringified page index (1-based)
    let page = 1;
    if (params.cursor != null && params.cursor !== '') {
      try {
        const decoded = Buffer.from(params.cursor, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded) as unknown;
        if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 1) {
          throw new Error('invalid cursor value');
        }
        page = parsed;
      } catch {
        throw Object.assign(
          new Error(`Invalid cursor: ${params.cursor}`),
          { code: ACP_ERROR_CODES.INVALID_PARAMS },
        );
      }
    }

    // Fetch all sessions
    let all = await this.sessions.list();

    // Filter by cwd if provided
    if (params.cwd != null && params.cwd !== '') {
      all = all.filter((s) => s.cwd === params.cwd);
    }

    // Sort by updatedAt descending (most recently updated first)
    all.sort((a, b) => b.updatedAt - a.updatedAt);

    // Paginate
    const offset = (page - 1) * PAGE_SIZE;
    const pageItems = all.slice(offset, offset + PAGE_SIZE);
    const hasMore = offset + PAGE_SIZE < all.length;

    // Map SessionSummary → ACP SessionInfo
    const sessions: schema.SessionInfo[] = pageItems.map((s) => ({
      sessionId: s.id,
      cwd: s.cwd,
      ...(s.title !== undefined ? { title: s.title } : {}),
      updatedAt: new Date(s.updatedAt).toISOString(),
      _meta: { messageCount: 0 },
    }));

    // Build nextCursor if there are more results
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify(page + 1)).toString('base64')
      : undefined;

    return {
      sessions,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
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
    // Provide minimal inline handling for core methods so callers don't hard-fail
    // in test/lightweight contexts where full runtime deps are unavailable.
    switch (method) {
      case '_goodvibes/state': {
        const sessionId = typeof params['sessionId'] === 'string' ? params['sessionId'] : undefined;
        if (sessionId !== undefined) {
          const session = await this.sessions.get(sessionId);
          return { session: session ?? null };
        }
        return { runtime: 'goodvibes', version: RUNTIME_VERSION };
      }
      case '_goodvibes/agents': {
        const agents = this.registry.get<unknown>('agent-spawner') ?? [];
        return { agents };
      }
      default: {
        // Unknown _goodvibes/* methods throw METHOD_NOT_FOUND per JSON-RPC 2.0
        const err = new Error(`Unknown extension method: ${method}`);
        (err as Error & { code: number }).code = ACP_ERROR_CODES.METHOD_NOT_FOUND;
        throw err;
      }
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
