/**
 * @module plugins/agents/spawner
 * @layer L3 — plugin
 *
 * AgentSpawnerPlugin — implements IAgentSpawner from L0 registry.ts.
 *
 * When an ILLMProvider is registered under 'llm-provider', spawn() drives
 * a real AgentLoop (prompt → tool_use → execute → repeat).
 *
 * When no ILLMProvider is registered, spawn() falls back to the timer-based
 * stub so the interface remains usable in environments without an API key.
 */

import { randomUUID } from 'node:crypto';
import type {
  AgentConfig,
  AgentHandle,
  AgentResult,
  AgentStatus,
  AgentError,
} from '../../types/agent.js';
import type { IAgentSpawner, ILLMProvider, IToolProvider } from '../../types/registry.js';
import type { Registry } from '../../core/registry.js';
import { AGENT_TYPE_CONFIGS } from './types.js';
import { AgentLoop } from './loop.js';
import type { AgentLoopResult, AgentProgressEvent } from './loop.js';

// ---------------------------------------------------------------------------
// OnProgressFactory
// ---------------------------------------------------------------------------

/**
 * Factory that returns a per-session progress handler for an AgentLoop.
 * Injected at construction time so the spawner can provide ACP visibility
 * for tool executions without depending on ACP types directly.
 */
export type OnProgressFactory = (
  sessionId: string,
) => ((event: AgentProgressEvent) => void) | undefined;

// ---------------------------------------------------------------------------
// Internal state type
// ---------------------------------------------------------------------------

type AgentState = {
  handle: AgentHandle;
  config: AgentConfig;
  status: AgentStatus;
  output: string;
  errors: AgentError[];
  /**
   * Files modified by the agent loop.
   * Populated from AgentLoopResult after the loop completes.
   * Empty array until the loop reports file modifications.
   */
  filesModified: string[] | undefined;
  startedAt?: number;
  finishedAt?: number;
  /** AbortController for real AgentLoop cancellation */
  controller?: AbortController;
  /** Reference to the running AgentLoop — used to capture filesModified on timeout */
  loop?: AgentLoop;
  /** Pending timer handle for stub simulation (used when no LLM provider) */
  timer?: ReturnType<typeof setTimeout>;
  /** Timeout timer handle — cleared when agent reaches a terminal state */
  timeoutTimer?: ReturnType<typeof setTimeout>;
  /** ACP stop reason from the underlying AgentLoop (populated on loop completion) */
  loopStopReason?: string;
  /** Accumulated resolvers waiting on result() */
  resolvers: Array<(result: AgentResult) => void>;
  /** Accumulated rejecters waiting on result() */
  rejecters: Array<(err: Error) => void>;
};

// ---------------------------------------------------------------------------
// AgentSpawnerPlugin
// ---------------------------------------------------------------------------

export class AgentSpawnerPlugin implements IAgentSpawner {
  private readonly _agents = new Map<string, AgentState>();
  private readonly _registry: Registry | undefined;
  private _onProgressFactory: OnProgressFactory | undefined;

  /**
   * @param registry           — optional L1 Registry. When provided and an
   *                             ILLMProvider is registered under 'llm-provider',
   *                             spawn() creates a real AgentLoop. Otherwise
   *                             falls back to the timer-based stub.
   * @param onProgressFactory  — optional factory to create a per-session
   *                             AgentLoop onProgress callback. Used to wire
   *                             ACP tool_call updates for tool execution
   *                             visibility (e.g. McpToolCallBridge).
   */
  constructor(registry?: Registry, onProgressFactory?: OnProgressFactory) {
    this._registry = registry;
    this._onProgressFactory = onProgressFactory;
  }

  /**
   * Set or replace the onProgressFactory after construction.
   * Allows the ACP layer to inject progress wiring once the connection
   * is established, without requiring it to be available at registration time.
   * See ISS-037.
   *
   * @param factory - Factory that returns a per-session progress handler.
   */
  setOnProgressFactory(factory: OnProgressFactory): void {
    this._onProgressFactory = factory;
  }

  // -------------------------------------------------------------------------
  // spawn
  // -------------------------------------------------------------------------

  async spawn(config: AgentConfig): Promise<AgentHandle> {
    const id = `agent_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const handle: AgentHandle = {
      id,
      type: config.type,
      spawnedAt: Date.now(),
    };

    const typeConfig = AGENT_TYPE_CONFIGS[config.type];
    const timeoutMs = config.timeoutMs ?? typeConfig.defaultTimeoutMs;

    const state: AgentState = {
      handle,
      config,
      status: 'pending',
      output: '',
      errors: [],
      filesModified: undefined,
      resolvers: [],
      rejecters: [],
    };

    this._agents.set(id, state);

    // Check whether a real LLM provider is available
    const hasLLMProvider = this._registry?.has('llm-provider') ?? false;

    // Transition to 'running' now that we are about to start the agent loop
    state.status = 'running';
    state.startedAt = Date.now();

    if (hasLLMProvider) {
      // --- Real AgentLoop path ---
      const llmProvider = this._registry!.get<ILLMProvider>('llm-provider');
      const toolProviders = this._registry!.getAll<IToolProvider>('tool-provider');

      let sessionCwd: string | undefined;
      try {
        const sessionMgr = this._registry!.get<{ get(id: string): Promise<{ config: { cwd: string } } | undefined> }>('session-manager');
        if (sessionMgr) {
          const session = await sessionMgr.get(config.sessionId);
          sessionCwd = session?.config?.cwd;
        }
      } catch { /* continue without cwd */ }

      const controller = new AbortController();
      state.controller = controller;

      const model = config.model ?? typeConfig.defaultModel;

      // Build project dossier if cwd is available
      let dossierContent = '';
      if (sessionCwd) {
        try {
          const { buildDossier } = await import('./dossier.js');
          const dossier = await buildDossier({
            cwd: sessionCwd,
            agentType: config.type,
          });
          if (dossier.content) {
            dossierContent = dossier.content;
          }
        } catch (dossierErr) {
          console.error('[AgentSpawner] Dossier build failed (continuing without):', String(dossierErr));
        }
      }

      const systemPrompt = dossierContent
        ? `${dossierContent}\n\n---\n\n${typeConfig.systemPromptPrefix}`
        : typeConfig.systemPromptPrefix;

      const loop = new AgentLoop({
        provider: llmProvider,
        tools: toolProviders,
        model,
        systemPrompt,
        maxTurns: typeConfig.maxTurns,
        maxTokens: typeConfig.maxTokens,
        signal: controller.signal,
        onProgress: this._onProgressFactory?.(config.sessionId),
        cwd: sessionCwd,
        workspaceRoots: sessionCwd ? [sessionCwd] : undefined,
      });

      // Store loop reference so timeout can capture any files written before expiry
      state.loop = loop;

      // Run in background — state machine fires when it settles
      const resultPromise = loop.run(config.task);

      // Schedule timeout cancellation
      state.timeoutTimer = setTimeout(() => {
        const s = this._agents.get(id);
        if (s && s.status === 'running') {
          controller.abort();
          this._settleFromLoop(id, {
            output: '',
            turns: 0,
            usage: { inputTokens: 0, outputTokens: 0 },
            stopReason: 'error',
            error: `Agent exceeded timeout of ${timeoutMs}ms`,
            filesModified: loop.filesModified,
          });
        }
      }, timeoutMs);

      if (typeof state.timeoutTimer.unref === 'function') {
        state.timeoutTimer.unref();
      }

      // When the loop finishes naturally, settle the state
      resultPromise.then(
        (loopResult) => {
          const s = this._agents.get(id);
          if (s && s.status === 'running') {
            this._settleFromLoop(id, loopResult);
          }
        },
        (err: unknown) => {
          const s = this._agents.get(id);
          if (s && s.status === 'running') {
            console.error(`[AgentSpawner] Agent ${s.config.type} (${id}) threw:`, String(err));
            this._settleFromLoop(id, {
              output: '',
              turns: 0,
              usage: { inputTokens: 0, outputTokens: 0 },
              stopReason: 'error',
              error: String(err),
              filesModified: loop.filesModified,
            });
          }
        },
      );
    } else {
      // --- Stub fallback path ---
      const completionDelayMs = Math.min(timeoutMs, 100);
      state.timer = setTimeout(() => {
        this._complete(id);
      }, completionDelayMs);

      // Schedule timeout cancellation
      state.timeoutTimer = setTimeout(() => {
        const s = this._agents.get(id);
        if (s && s.status === 'running') {
          this._timeout(id);
        }
      }, timeoutMs);

      if (typeof state.timeoutTimer.unref === 'function') {
        state.timeoutTimer.unref();
      }
    }

    return handle;
  }

  // -------------------------------------------------------------------------
  // result
  // -------------------------------------------------------------------------

  result(handle: AgentHandle): Promise<AgentResult> {
    const state = this._requireState(handle.id);

    // Already terminal — resolve immediately
    if (
      state.status === 'completed' ||
      state.status === 'failed' ||
      state.status === 'cancelled'
    ) {
      return Promise.resolve(this._buildResult(state));
    }

    // Still running — park a resolver until the state machine fires
    return new Promise<AgentResult>((resolve, reject) => {
      state.resolvers.push(resolve);
      state.rejecters.push(reject);
    });
  }

  // -------------------------------------------------------------------------
  // cancel
  // -------------------------------------------------------------------------

  async cancel(handle: AgentHandle): Promise<void> {
    const state = this._requireState(handle.id);

    if (
      state.status === 'completed' ||
      state.status === 'failed' ||
      state.status === 'cancelled'
    ) {
      // Already terminal — no-op
      return;
    }

    // Abort the real AgentLoop if present
    if (state.controller !== undefined) {
      state.controller.abort();
    }

    // Clear the pending stub timer
    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    // Clear the timeout timer
    if (state.timeoutTimer !== undefined) {
      clearTimeout(state.timeoutTimer);
      state.timeoutTimer = undefined;
    }

    state.filesModified = state.loop?.filesModified ?? state.filesModified;
    state.status = 'cancelled';
    state.finishedAt = Date.now();

    this._flushResolvers(state);
  }

  // -------------------------------------------------------------------------
  // status
  // -------------------------------------------------------------------------

  status(handle: AgentHandle): AgentStatus {
    const state = this._requireState(handle.id);
    return state.status;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Settle state from an AgentLoopResult */
  private _settleFromLoop(id: string, loopResult: AgentLoopResult): void {
    const state = this._agents.get(id);
    if (!state || state.status !== 'running') return;

    // Clear timeout timer
    if (state.timeoutTimer !== undefined) {
      clearTimeout(state.timeoutTimer);
      state.timeoutTimer = undefined;
    }

    state.finishedAt = Date.now();
    state.output = loopResult.output;
    state.filesModified = loopResult.filesModified;

    if (loopResult.stopReason === 'cancelled') {
      state.status = 'cancelled';
    } else if (loopResult.stopReason === 'error') {
      state.status = 'failed';
      console.error(`[AgentSpawner] Agent ${state.config.type} (${id}) failed:`, loopResult.error ?? 'Unknown error');
      state.errors.push({
        code: 'AGENT_ERROR',
        message: loopResult.error ?? 'Unknown error',
      });
    } else {
      // 'end_turn', 'max_tokens', or 'max_turn_requests' — all map to completed status
      state.status = 'completed';
      // Preserve the ACP stop reason so callers can distinguish truncation
      state.loopStopReason = loopResult.stopReason;
    }

    this._flushResolvers(state);
  }

  /** Resolve an agent as successfully completed (stub path) */
  private _complete(id: string): void {
    const state = this._agents.get(id);
    if (!state || state.status !== 'running') return;

    state.status = 'completed';
    state.finishedAt = Date.now();
    state.output = `[stub] Agent ${state.config.type} completed task: ${state.config.task}`;
    state.timer = undefined;

    // Clear the timeout timer since the agent completed normally
    if (state.timeoutTimer !== undefined) {
      clearTimeout(state.timeoutTimer);
      state.timeoutTimer = undefined;
    }

    this._flushResolvers(state);
  }

  /** Fail an agent due to timeout (stub path) */
  private _timeout(id: string): void {
    const state = this._agents.get(id);
    if (!state || state.status !== 'running') return;

    if (state.timer !== undefined) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    state.status = 'failed';
    state.finishedAt = Date.now();
    state.errors.push({
      code: 'TIMEOUT',
      message: `Agent exceeded timeout of ${state.config.timeoutMs ?? AGENT_TYPE_CONFIGS[state.config.type].defaultTimeoutMs}ms`,
    });

    this._flushResolvers(state);
  }

  /** Notify all parked result() promises */
  private _flushResolvers(state: AgentState): void {
    const result = this._buildResult(state);
    for (const resolve of state.resolvers) {
      resolve(result);
    }
    state.resolvers = [];
    state.rejecters = [];
  }

  /** Build an AgentResult from the current state */
  private _buildResult(state: AgentState): AgentResult {
    const spawnedAt = state.handle.spawnedAt;
    const finishedAt = state.finishedAt ?? Date.now();
    return {
      handle: state.handle,
      status: state.status as AgentResult['status'],
      output: state.output,
      filesModified: state.filesModified ?? [],
      errors: state.errors,
      durationMs: finishedAt - spawnedAt,
      ...(state.loopStopReason !== undefined ? { stopReason: state.loopStopReason } : {}),
    };
  }

  /** Look up state or throw if unknown */
  private _requireState(id: string): AgentState {
    const state = this._agents.get(id);
    if (!state) {
      throw new Error(`AgentSpawnerPlugin: unknown agent id "${id}"`);
    }
    return state;
  }
}
