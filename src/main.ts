#!/usr/bin/env bun
/**
 * main.ts — GoodVibes ACP runtime composition root
 *
 * Wires all layers together:
 *   L0 types → L1 core → L2 extensions → L3 plugins
 *
 * Transport: ACP ndjson over stdin/stdout.
 * All diagnostic output goes to stderr so stdout remains clean for ACP.
 */

import type { Socket } from 'node:net';
import * as acp from '@agentclientprotocol/sdk';
import { EventBus } from './core/event-bus.js';
import { StateStore } from './core/state-store.js';
import { Registry } from './core/registry.js';
import { Config } from './core/config.js';
import { SessionManager } from './extensions/sessions/manager.js';
import { WRFCOrchestrator } from './extensions/wrfc/orchestrator.js';
import type { WRFCRunParams, WRFCCallbacks } from './extensions/wrfc/orchestrator.js';
import type { WRFCConfig } from './types/wrfc.js';
import { GoodVibesAgent } from './extensions/acp/agent.js';
import { WRFCHandlers } from './extensions/wrfc/handlers.js';
import { SessionAdapter } from './extensions/acp/session-adapter.js';
import { ServiceRegistry } from './extensions/services/registry.js';
import { McpBridge } from './extensions/mcp/bridge.js';
import { McpToolCallBridge } from './extensions/mcp/tool-call-bridge.js';
import { DaemonManager } from './extensions/lifecycle/daemon.js';
import { IpcRouter } from './extensions/ipc/router.js';
import { IpcSocketServer } from './extensions/ipc/socket.js';
import type { AgentConfig, AgentHandle, AgentResult } from './types/agent.js';
import type { ReviewResult, WorkResult, FixResult } from './types/registry.js';
import type { IAgentSpawner, IToolProvider, ILLMProvider } from './types/registry.js';
import { AgentTracker } from './extensions/agents/tracker.js';
import { AgentCoordinator } from './extensions/agents/coordinator.js';
import { DirectiveQueue } from './extensions/directives/queue.js';
import { MemoryManager } from './extensions/memory/manager.js';
import { LogsManager } from './extensions/logs/manager.js';
import { HookEngine } from './core/hook-engine.js';
import { HookRegistrar } from './extensions/hooks/registrar.js';
import { AnthropicProvider } from './plugins/agents/providers/anthropic.js';
import { McpToolProxy } from './extensions/mcp/tool-proxy.js';
import { ShutdownManager, SHUTDOWN_ORDER } from './extensions/lifecycle/shutdown.js';
import { HealthCheck } from './extensions/lifecycle/health.js';
import { ReviewPlugin } from './plugins/review/index.js';
import { AgentsPlugin, AgentSpawnerPlugin } from './plugins/agents/index.js';
import type { OnProgressFactory } from './plugins/agents/spawner.js';
import { SkillsPlugin } from './plugins/skills/index.js';
import { PrecisionPlugin } from './plugins/precision/index.js';
import { AnalyticsPlugin } from './plugins/analytics/index.js';
import { ReviewToolProvider } from './plugins/review/review-tool-provider.js';
import { calculateScore } from './plugins/review/scoring-engine.js';
import { buildReviewerPrompt } from './plugins/review/reviewer-prompt.js';
import { filterReviewableFiles } from './plugins/review/exclusions.js';
import type { ReviewIssue } from './plugins/review/types.js';
import { AgentLoop } from './plugins/agents/loop.js';
import { AGENT_TYPE_CONFIGS } from './plugins/agents/types.js';
import { ProjectPlugin } from './plugins/project/index.js';
import { FrontendPlugin } from './plugins/frontend/index.js';
import { EventRecorder } from './extensions/acp/event-recorder.js';
import { GoodVibesExtensions } from './extensions/acp/extensions.js';
import { ToolCallEmitter } from './extensions/acp/tool-call-emitter.js';
import { AgentEventBridge } from './extensions/acp/agent-event-bridge.js';
import { createTcpTransportFromSocket, createStdioTransport } from './extensions/acp/transport.js';
import type { AcpStream } from './extensions/acp/transport.js';

// ---------------------------------------------------------------------------
// Startup banner
// ---------------------------------------------------------------------------

console.error('[goodvibes-acp] Starting...');

// ---------------------------------------------------------------------------
// L1 primitives
// ---------------------------------------------------------------------------

const eventBus = new EventBus();
const stateStore = new StateStore();
const registry = new Registry();
const config = new Config();
await config.load('goodvibes.config.json');
const configValidation = config.validate();
if (!configValidation.valid) {
  for (const err of configValidation.errors) {
    console.error(`[goodvibes-acp] Config warning: ${err}`);
  }
}
registry.register('config', config);
const hookEngine = new HookEngine();

// ---------------------------------------------------------------------------
// L2 extensions
// ---------------------------------------------------------------------------

const sessionManager = new SessionManager(stateStore, eventBus);
registry.register('session-manager', sessionManager);

const agentTracker = new AgentTracker(stateStore, eventBus);
const agentCoordinator = new AgentCoordinator(agentTracker, registry, eventBus, { maxParallel: 6 });
const directiveQueue = new DirectiveQueue(eventBus);
const memoryManager = new MemoryManager('.goodvibes/memory', eventBus);
const logsManager = new LogsManager('.goodvibes/logs', eventBus);
const hookRegistrar = new HookRegistrar(hookEngine, eventBus);
const shutdownManager = new ShutdownManager(eventBus);
const healthCheck = new HealthCheck(eventBus);

// ---------------------------------------------------------------------------
// ToolCallEmitter — scoped per-connection to prevent cross-session data leakage
// McpToolCallBridge — bridges AgentLoop onProgress to ACP tool_call updates
//
// Each connection creates its own ToolCallEmitter. Sessions are mapped to their
// connection's emitter when created, and removed when the connection closes.
// This prevents the last-writer-wins bug where daemon-mode connections would
// overwrite each other's emitter reference (ISS-006).
// ---------------------------------------------------------------------------

const toolCallEmitters = new Map<string, InstanceType<typeof ToolCallEmitter>>();

// Map of sessionId → AgentSideConnection for ACP session finish notifications on shutdown (ISS-004).
const activeSessionConnections = new Map<string, InstanceType<typeof acp.AgentSideConnection>>();

const mcpToolCallBridge = new McpToolCallBridge((sessionId: string) => toolCallEmitters.get(sessionId) ?? null);

const onProgressFactory: OnProgressFactory = (sessionId: string) =>
  mcpToolCallBridge.makeProgressHandler(sessionId);

// ---------------------------------------------------------------------------
// L3 plugins
// ---------------------------------------------------------------------------

// Register built-in hooks (validation, lifecycle events)
hookRegistrar.registerBuiltins();

// Register shutdown handlers ordered by layer (descending = runs first).
// L3 plugins (300+) → L2 services (200..299) → L1 core (100..199)
// Within a layer, higher values run before lower values.

// L3 plugin teardown — must complete before L2 services are stopped
shutdownManager.register('analytics-plugin', SHUTDOWN_ORDER.L3 + 3, async () => { await AnalyticsPlugin.shutdown?.(); });
shutdownManager.register('project-plugin', SHUTDOWN_ORDER.L3 + 2, async () => { await ProjectPlugin.shutdown?.(); });
shutdownManager.register('frontend-plugin', SHUTDOWN_ORDER.L3 + 1, async () => { await FrontendPlugin.shutdown?.(); });

// L2 service teardown — ordered so dependents stop before dependencies:
//   daemon (accepts new conns) → acp-sessions (finish events) → ipc-socket → mcp-bridge → service-registry → memory → hooks
shutdownManager.register('daemon',           SHUTDOWN_ORDER.L2 + 60, () => daemonManager.stop());
// ISS-004: Send finish events to all active ACP sessions before tearing down connections.
shutdownManager.register('acp-sessions',     SHUTDOWN_ORDER.L2 + 55, async () => {
  // SDK v0.15.0 SessionUpdate union does not include 'finish' yet — cast required per ACP spec
  const finishUpdate = { sessionUpdate: 'finish', stopReason: 'cancelled' } as unknown as acp.SessionUpdate;
  await Promise.allSettled(
    Array.from(activeSessionConnections.entries()).map(([sessionId, sessionConn]) =>
      sessionConn.sessionUpdate({ sessionId, update: finishUpdate }).catch((err) => { console.error('[goodvibes-acp] acp-sessions shutdown: finish update failed for', sessionId, ':', String(err)); }),
    ),
  );
});
shutdownManager.register('ipc-socket',       SHUTDOWN_ORDER.L2 + 50, () => ipcSocketServer.stop());
shutdownManager.register('mcp-bridge',       SHUTDOWN_ORDER.L2 + 40, () => mcpBridge.disconnectAll());
shutdownManager.register('service-registry', SHUTDOWN_ORDER.L2 + 30, () => serviceRegistry.save());
// wrfcOrchestrator has no destroy — WRFC state lives in memory only
shutdownManager.register('memory',           SHUTDOWN_ORDER.L2 + 20, () => memoryManager.save());
shutdownManager.register('hooks',            SHUTDOWN_ORDER.L2 + 10, async () => { hookEngine.destroy(); });

ReviewPlugin.register(registry);
AgentsPlugin.register(registry);

// ---------------------------------------------------------------------------
// LLM + Tool providers — these enable the real AgentLoop path in AgentSpawnerPlugin
// ---------------------------------------------------------------------------
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[goodvibes-acp] WARNING: ANTHROPIC_API_KEY not set — LLM provider not registered, agent loops will fail on first call');
} else {
  const llmProvider = new AnthropicProvider(); // reads ANTHROPIC_API_KEY from .env
  registry.register('llm-provider', llmProvider);
  console.error('[goodvibes-acp] LLM provider registered: anthropic (claude)');
}
// Tool provider registered below after mcpToolProxy is created

// Re-register the agent spawner with the McpToolCallBridge progress factory
// so AgentLoop tool executions emit ACP tool_call updates in real time.
registry.unregister('agent-spawner');
registry.register('agent-spawner', new AgentSpawnerPlugin(registry, onProgressFactory));
SkillsPlugin.register(registry);
PrecisionPlugin.register(registry);
// Also expose precision as a tool-provider so agent spawner's getAll('tool-provider') finds it
registry.registerMany('tool-provider', 'precision', registry.get<IToolProvider>('precision')!);
AnalyticsPlugin.register(registry);
ProjectPlugin.register(registry);
FrontendPlugin.register(registry);

// Create shared ReviewToolProvider — used by the LLM reviewer in the WRFC adapter
const reviewToolProvider = new ReviewToolProvider();
registry.registerMany('tool-provider', 'review', reviewToolProvider);

const minReviewScore = config.get<number>('wrfc.minReviewScore') ?? 9.5;
const maxAttempts = config.get<number>('wrfc.maxFixAttempts') ?? 3;

const wrfcConfig: WRFCConfig = {
  minReviewScore,
  maxAttempts,
  enableQualityGates: true,
};

const wrfcOrchestrator = new WRFCOrchestrator(wrfcConfig, eventBus);
const wrfcHandlers = new WRFCHandlers(eventBus, directiveQueue);
wrfcHandlers.register();

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

const ipcRouter = new IpcRouter(eventBus);
const ipcSocketServer = new IpcSocketServer(eventBus, ipcRouter);

// ---------------------------------------------------------------------------
// Service registry
// ---------------------------------------------------------------------------

const serviceRegistry = new ServiceRegistry('.goodvibes', eventBus);

// ---------------------------------------------------------------------------
// MCP bridge
// ---------------------------------------------------------------------------

const mcpBridge = new McpBridge(eventBus);
const mcpToolProxy = new McpToolProxy(mcpBridge);
registry.registerMany('tool-provider', 'mcp-proxy', mcpToolProxy);

// ---------------------------------------------------------------------------
// Daemon manager
// ---------------------------------------------------------------------------

const daemonManager = new DaemonManager(eventBus);



// ---------------------------------------------------------------------------
// createConnection — shared helper for subprocess and daemon modes
//
// Creates a GoodVibesAgent + all wiring (ToolCallEmitter, SessionAdapter,
// AgentEventBridge, EventRecorder, GoodVibesExtensions) for one ACP stream.
// ---------------------------------------------------------------------------

function createConnection(stream: AcpStream) {
  const conn = new acp.AgentSideConnection(
    (c) => new GoodVibesAgent(c, registry, eventBus, sessionManager, wrfcAdapter, mcpBridge),
    stream,
  );

  // Create a per-connection ToolCallEmitter (ISS-006: avoid last-writer-wins bug).
  // Track which sessionIds belong to this connection so we can clean up on close.
  const connEmitter = new ToolCallEmitter(conn);
  const connSessionIds = new Set<string>();

  // Map each new session created on this connection to its emitter and connection
  // reference (ISS-004: needed to send finish events on shutdown).
  const sessionCreatedSub = eventBus.on('session:created', (event) => {
    const { sessionId } = event.payload as { sessionId: string };
    connSessionIds.add(sessionId);
    toolCallEmitters.set(sessionId, connEmitter);
    activeSessionConnections.set(sessionId, conn);
  });

  // Clean up maps when the connection closes.
  conn.closed.then(() => {
    sessionCreatedSub.dispose();
    for (const sid of connSessionIds) {
      toolCallEmitters.delete(sid);
      activeSessionConnections.delete(sid);
    }
  }).catch(() => {
    // Intentional: conn.closed should not reject in practice; guard against unexpected rejection
  });

  const sessionAdapter = new SessionAdapter(conn, sessionManager, eventBus);
  sessionAdapter.register();

  const agentEventBridge = new AgentEventBridge(conn, eventBus, agentTracker);
  agentEventBridge.register();

  const eventRecorder = new EventRecorder(eventBus);
  eventRecorder.register();

  const goodvibesExtensions = new GoodVibesExtensions(
    eventBus, stateStore, registry, healthCheck, agentTracker, eventRecorder,
  );
  void goodvibesExtensions;

  return conn;
}

// ---------------------------------------------------------------------------
// WRFC adapter — bridges IWRFCRunner (agent.ts) to WRFCOrchestrator.run()
//
// WRFCOrchestrator.run() requires spawner/reviewer/fixer/callbacks that will
// be provided by the L3 plugin system. For now, stub them with no-op
// implementations that return minimal valid results.
// ---------------------------------------------------------------------------

async function resolveSessionCwd(sessionId: string): Promise<string | undefined> {
  try {
    const session = await sessionManager.get(sessionId);
    return session?.config?.cwd;
  } catch { return undefined; }
}

const wrfcAdapter = {
  run: async (params: { workId: string; sessionId: string; task: string; signal?: AbortSignal }) => {
    // Tracks the last engineer agent's stop reason for ACP stop reason propagation.
    let lastEngineerStopReason: string | undefined;
    // Maps spawned agent handles to their configs so result() can filter by agent type.
    const spawnedAgentConfigs = new Map<AgentHandle, AgentConfig>();

    const runParams: WRFCRunParams = {
      ...params,

      // Real spawner — delegates to the L3 AgentSpawnerPlugin via registry.
      spawner: {
        async spawn(agentConfig: AgentConfig): Promise<AgentHandle> {
          const handle = await registry.get<IAgentSpawner>('agent-spawner')!.spawn(agentConfig);
          spawnedAgentConfigs.set(handle, agentConfig);
          return handle;
        },
        async result(handle: AgentHandle): Promise<AgentResult> {
          const agentResult = await registry.get<IAgentSpawner>('agent-spawner')!.result(handle);
          // Only capture stop reason from engineer-type agents (work phase) for ACP propagation.
          // Reviewer, fixer, and other agent types should not influence the ACP stop reason.
          const config = spawnedAgentConfigs.get(handle);
          if (config?.type === 'engineer' && agentResult.stopReason !== undefined) {
            lastEngineerStopReason = agentResult.stopReason;
          }
          spawnedAgentConfigs.delete(handle);
          return agentResult;
        },
        async cancel(handle: AgentHandle): Promise<void> {
          return registry.get<IAgentSpawner>('agent-spawner')!.cancel(handle);
        },
        status(handle: AgentHandle) {
          return registry.get<IAgentSpawner>('agent-spawner')!.status(handle);
        },
      },

      // LLM reviewer — spawns a reviewer agent with the submit_review tool.
      reviewer: {
        id: 'llm-reviewer',
        capabilities: ['typescript', 'general'],
        async review(workResult: WorkResult): Promise<ReviewResult> {
          // Reset review tool state from any previous run
          reviewToolProvider.reset();

          console.error(`[WRFC] Review called. filesModified=${workResult.filesModified.length}: ${workResult.filesModified.join(', ')}`);

          const reviewableFiles = filterReviewableFiles(workResult.filesModified);
          console.error(`[WRFC] After exclusion filter: ${reviewableFiles.length} reviewable files`);
          if (reviewableFiles.length === 0) {
            console.error('[WRFC] No reviewable files after exclusion filtering');
            return {
              sessionId: workResult.sessionId,
              score: 0,
              dimensions: {},
              passed: false,
              issues: ['No reviewable files found — all modified files are in excluded paths (node_modules, dist, etc.)'],
              notes: 'All modified files excluded from review',
            };
          }

          const llmProvider = registry.getOptional<ILLMProvider>('llm-provider');
          if (!llmProvider) {
            console.error('[WRFC] No LLM provider — cannot perform review');
            return {
              sessionId: workResult.sessionId,
              score: 0,
              dimensions: {},
              passed: false,
              issues: ['No LLM provider configured — cannot perform review'],
              notes: 'No LLM provider configured — cannot review',
            };
          }

          const reviewerConfig = AGENT_TYPE_CONFIGS['reviewer'];
          const toolProviders = registry.getAll<IToolProvider>('tool-provider');
          console.error(`[WRFC] Reviewer tool providers: ${toolProviders.map(p => p.name).join(', ')} (${toolProviders.reduce((n, p) => n + p.tools.length, 0)} tools total)`);

          const reviewerPrompt = buildReviewerPrompt({
            task: workResult.task,
            filesModified: reviewableFiles,
            minScore: minReviewScore,
          });

          const sessionCwd = await resolveSessionCwd(params.sessionId);

          // Build project dossier for reviewer
          let reviewerDossier = '';
          if (sessionCwd) {
            try {
              const { buildDossier } = await import('./plugins/agents/dossier.js');
              const dossier = await buildDossier({
                cwd: sessionCwd,
                agentType: 'reviewer',
                maxTokens: 2000,
              });
              reviewerDossier = dossier.content;
            } catch (dossierErr) {
              console.error('[WRFC] Reviewer dossier build failed (continuing without):', String(dossierErr));
            }
          }
          const fullReviewerPrompt = reviewerDossier
            ? `${reviewerDossier}\n\n---\n\n${reviewerPrompt}`
            : reviewerPrompt;

          const loop = new AgentLoop({
            provider: llmProvider,
            tools: toolProviders,
            model: reviewerConfig.defaultModel,
            systemPrompt: fullReviewerPrompt,
            maxTurns: reviewerConfig.maxTurns,
            onFileRead: (path) => reviewToolProvider.trackFileRead(path),
            cwd: sessionCwd,
            workspaceRoots: sessionCwd ? [sessionCwd] : undefined,
          });

          const loopResult = await loop.run(
            `Review the following files that were modified:\n${reviewableFiles.map(f => '- ' + f).join('\n')}\n\nAgent output:\n${workResult.output}`,
          );
          console.error(`[WRFC] Reviewer loop done: turns=${loopResult.turns}, stopReason=${loopResult.stopReason}, outputLen=${loopResult.output.length}${loopResult.error ? ', error=' + loopResult.error : ''}`);

          const submittedReview = reviewToolProvider.consumeReview();

          if (!submittedReview) {
            console.error('[WRFC] Reviewer agent did not call submit_review — automatic fail');
            return {
              sessionId: workResult.sessionId,
              score: 0,
              dimensions: {},
              passed: false,
              issues: ['Reviewer agent did not submit a structured review via submit_review tool'],
              notes: 'Reviewer failed to call submit_review — automatic fail',
            };
          }

          const score = calculateScore(submittedReview.issues);
          const passed = score >= minReviewScore;

          const issues = submittedReview.issues.map(i =>
            `[${i.severity.toUpperCase()}] ${i.file}${i.line ? ':' + i.line : ''} \u2014 ${i.title}: ${i.description}`,
          );

          console.error(`[WRFC] Review complete: score=${score}, passed=${passed}, issues=${submittedReview.issues.length}`);

          return Object.assign(
            {
              sessionId: workResult.sessionId,
              score,
              dimensions: {},
              passed,
              issues,
              notes: submittedReview.summary,
            } satisfies ReviewResult,
            { _structuredIssues: submittedReview.issues },
          );
        },
      },

      // LLM fixer — spawns an engineer agent with structured issues as the task.
      fixer: {
        async fix(reviewResult: ReviewResult): Promise<FixResult> {
          const structuredIssues = (reviewResult as ReviewResult & { _structuredIssues?: ReviewIssue[] })._structuredIssues;

          if (!structuredIssues || structuredIssues.length === 0) {
            return {
              sessionId: reviewResult.sessionId,
              success: true,
              filesModified: [],
              resolvedIssues: [],
              remainingIssues: [],
            };
          }

          const llmProvider = registry.getOptional<ILLMProvider>('llm-provider');
          if (!llmProvider) {
            return {
              sessionId: reviewResult.sessionId,
              success: false,
              filesModified: [],
              resolvedIssues: [],
              remainingIssues: reviewResult.issues,
            };
          }

          // Sort issues by severity so the engineer addresses critical issues first
          const priorityOrder = ['critical', 'major', 'minor', 'nitpick'];
          const sorted = [...structuredIssues].sort(
            (a, b) => priorityOrder.indexOf(a.severity) - priorityOrder.indexOf(b.severity),
          );

          const fixTask = `Fix the following code review issues. Each issue includes the file, location, problem description, and fix guidance. Focus on implementing the fixes — do not re-review or re-discover.\n\n${sorted.map((issue, i) => {
            let entry = `### Issue ${i + 1} [${issue.severity.toUpperCase()}]\n`;
            entry += `**File**: ${issue.file}${issue.line ? ':' + issue.line : ''}\n`;
            entry += `**Title**: ${issue.title}\n`;
            entry += `**Description**: ${issue.description}\n`;
            if (issue.references && issue.references.length > 0) {
              entry += `**References**:\n${issue.references.map(r => `  - ${r.file}${r.line ? ':' + r.line : ''} \u2014 ${r.note}`).join('\n')}\n`;
            }
            return entry;
          }).join('\n')}`;

          const engineerConfig = AGENT_TYPE_CONFIGS['engineer'];
          const toolProviders = registry.getAll<IToolProvider>('tool-provider');

          const fixerSessionCwd = await resolveSessionCwd(params.sessionId);

          // Build project dossier for fixer (engineer)
          let fixerDossier = '';
          if (fixerSessionCwd) {
            try {
              const { buildDossier } = await import('./plugins/agents/dossier.js');
              const dossier = await buildDossier({
                cwd: fixerSessionCwd,
                agentType: 'engineer',
              });
              fixerDossier = dossier.content;
            } catch (dossierErr) {
              console.error('[WRFC] Fixer dossier build failed (continuing without):', String(dossierErr));
            }
          }
          const fullFixerPrompt = fixerDossier
            ? `${fixerDossier}\n\n---\n\n${engineerConfig.systemPromptPrefix}`
            : engineerConfig.systemPromptPrefix;

          const loop = new AgentLoop({
            provider: llmProvider,
            tools: toolProviders,
            model: engineerConfig.defaultModel,
            systemPrompt: fullFixerPrompt,
            maxTurns: engineerConfig.maxTurns,
            cwd: fixerSessionCwd,
            workspaceRoots: fixerSessionCwd ? [fixerSessionCwd] : undefined,
          });

          const loopResult = await loop.run(fixTask);

          const succeeded = loopResult.stopReason !== 'error';
          return {
            sessionId: reviewResult.sessionId,
            success: succeeded,
            filesModified: loopResult.filesModified,
            resolvedIssues: succeeded ? structuredIssues.map(i => `${i.title} (${i.file})`) : [],
            remainingIssues: succeeded ? [] : structuredIssues.map(i => `${i.title} (${i.file})`),
          };
        },
      },

      // WRFC lifecycle callbacks — emit tool_call updates so ACP clients
      // can observe phase progress in real time.
      // Emitter is resolved per-invocation from the sessionId map (ISS-006).
      callbacks: (() => {
        const ids: Record<string, string> = {};
        let attempt = 0;
        const cb: WRFCCallbacks = {
          onStateChange: (_from, to) => {
            const phase =
              to === 'working' ? 'goodvibes_work'
              : to === 'reviewing' ? 'goodvibes_review'
              : to === 'fixing' ? 'goodvibes_fix'
              : null;
            const emitter = toolCallEmitters.get(params.sessionId);
            if (!phase || !emitter) return;
            const gvPhase =
              phase === 'goodvibes_work' ? 'work'
              : phase === 'goodvibes_review' ? 'review'
              : 'fix';
            if (phase === 'goodvibes_work') attempt++;
            ids[phase] = crypto.randomUUID();
            const announceMeta: Record<string, unknown> = {
              '_goodvibes/attempt': attempt,
              '_goodvibes/phase': gvPhase,
            };
            // Step 1: announce with status 'pending'
            emitter.emitToolCall(
              params.sessionId,
              ids[phase],
              phase,
              phase === 'goodvibes_work' ? 'Running task'
                : phase === 'goodvibes_review' ? 'Reviewing output'
                : 'Applying fixes',
              'other',
              announceMeta,
            ).then(() => {
              // Step 2: transition to 'in_progress'
              const em2 = toolCallEmitters.get(params.sessionId);
              if (!em2) return;
              return em2.emitToolCallUpdate(
                params.sessionId,
                ids[phase],
                'in_progress',
                announceMeta,
              );
            }).catch((err) => { console.error('[goodvibes-acp] WRFC emitToolCallUpdate(in_progress) failed:', String(err)); });
          },
          onWorkComplete: () => {
            const id = ids['goodvibes_work'];
            const emitter = toolCallEmitters.get(params.sessionId);
            if (!id || !emitter) return;
            emitter.emitToolCallUpdate(
              params.sessionId,
              id,
              'completed',
              { '_goodvibes/attempt': attempt, '_goodvibes/phase': 'work' },
            ).catch((err) => { console.error('[goodvibes-acp] WRFC emitToolCallUpdate(work/completed) failed:', String(err)); });
          },
          onReviewComplete: (result) => {
            const id = ids['goodvibes_review'];
            const emitter = toolCallEmitters.get(params.sessionId);
            if (!id || !emitter) return;
            const reviewMeta: Record<string, unknown> = {
              '_goodvibes/score': result.score,
              '_goodvibes/minimumScore': wrfcConfig.minReviewScore,
              '_goodvibes/phase': 'review',
              '_goodvibes/attempt': attempt,
            };
            if (result.dimensions) {
              reviewMeta['_goodvibes/dimensions'] = result.dimensions;
            }
            emitter.emitToolCallUpdate(
              params.sessionId,
              id,
              'completed',
              reviewMeta,
            ).catch((err) => { console.error('[goodvibes-acp] WRFC emitToolCallUpdate(review/completed) failed:', String(err)); });
          },
          onFixComplete: () => {
            const id = ids['goodvibes_fix'];
            const emitter = toolCallEmitters.get(params.sessionId);
            if (!id || !emitter) return;
            emitter.emitToolCallUpdate(
              params.sessionId,
              id,
              'completed',
              { '_goodvibes/attempt': attempt, '_goodvibes/phase': 'fix' },
            ).catch((err) => { console.error('[goodvibes-acp] WRFC emitToolCallUpdate(fix/completed) failed:', String(err)); });
          },
        };
        return cb;
      })(),
    };

    const result = await wrfcOrchestrator.run(runParams);
    return {
      state: result.state,
      lastScore: result.lastScore,
      // Propagate the last engineer agent stop reason for ACP stop reason mapping.
      // Only propagate 'max_tokens' and 'max_turn_requests' — 'end_turn' is the
      // default and doesn't need special handling.
      ...(lastEngineerStopReason === 'max_tokens' || lastEngineerStopReason === 'max_turn_requests'
        ? { stopReason: lastEngineerStopReason as 'max_tokens' | 'max_turn_requests' }
        : {}),
    };
  },
};

// ---------------------------------------------------------------------------
// Startup: load memory and ensure log files exist
// ---------------------------------------------------------------------------

// Process mode detection
// GOODVIBES_MODE is read directly here as a top-level startup override,
// intentionally outside the nested config env system (GOODVIBES_RUNTIME__MODE).
// This allows a simple env var to control process mode without requiring
// the full GOODVIBES_RUNTIME__MODE=daemon notation.
const mode = process.argv.includes('--daemon') || process.env.GOODVIBES_MODE === 'daemon'
  ? 'daemon' as const
  : 'subprocess' as const;

console.error(`[goodvibes-acp] Mode: ${mode}`);

await memoryManager.load();
await logsManager.ensureFiles();

eventBus.emit('runtime:started', {
  mode,
  plugins: ['review', 'agents', 'skills', 'precision', 'analytics', 'project', 'frontend'],
  timestamp: Date.now(),
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
  healthCheck.markShuttingDown();
  await shutdownManager.shutdown();
  // Allow the event loop to drain pending I/O (e.g. finish event socket writes)
  // before forcing exit. The process exits naturally once all handles close.
  const gracePeriod = config.get<number>('runtime.agentGracePeriodMs') ?? 10000;
  setTimeout(() => process.exit(0), gracePeriod).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[goodvibes-acp] Uncaught exception:', err);
  // Safety timeout — ensures exit even if shutdown hangs
  setTimeout(() => process.exit(1), 5000).unref();
  shutdownManager.shutdown().finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  console.error('[goodvibes-acp] Unhandled rejection:', reason);
  // Safety timeout — ensures exit even if shutdown hangs
  setTimeout(() => process.exit(1), 5000).unref();
  shutdownManager.shutdown().finally(() => process.exit(1));
});

// ---------------------------------------------------------------------------
// Mode-specific startup
// ---------------------------------------------------------------------------

if (mode === 'daemon') {
  // -------------------------------------------------------------------------
  // Daemon mode — parse options from env / CLI args
  // -------------------------------------------------------------------------

  function getArgValue(flag: string): string | undefined {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 ? process.argv[idx + 1] : undefined;
  }

  const daemonPort = config.get<number>('runtime.port') ??
    parseInt(
      process.env.GOODVIBES_DAEMON_PORT ?? getArgValue('--port') ?? '9000',
      10,
    );
  if (Number.isNaN(daemonPort) || daemonPort < 1 || daemonPort > 65535) {
    throw new Error(
      `[goodvibes-acp] Invalid daemon port: "${process.env.GOODVIBES_DAEMON_PORT ?? getArgValue('--port') ?? '9000'}" — must be an integer between 1 and 65535`,
    );
  }
  const daemonHost =
    config.get<string>('runtime.host') ??
    process.env.GOODVIBES_DAEMON_HOST ?? getArgValue('--host') ?? '127.0.0.1';
  const daemonHealthPort = config.get<number>('health.port') ??
    parseInt(
      process.env.GOODVIBES_DAEMON_HEALTH_PORT ?? getArgValue('--health-port') ?? String(daemonPort + 1),
      10,
    );
  if (Number.isNaN(daemonHealthPort) || daemonHealthPort < 1 || daemonHealthPort > 65535) {
    throw new Error(
      `[goodvibes-acp] Invalid daemon health port: "${process.env.GOODVIBES_DAEMON_HEALTH_PORT ?? getArgValue('--health-port') ?? String(daemonPort + 1)}" — must be an integer between 1 and 65535`,
    );
  }
  const daemonPidFile =
    process.env.GOODVIBES_DAEMON_PID_FILE ?? getArgValue('--pid-file');

  await daemonManager.start({
    port: daemonPort,
    host: daemonHost,
    healthPort: daemonHealthPort,
    pidFile: daemonPidFile,
    healthCheck,
    onConnection: (socket: Socket) => {
      const remoteId = `${socket.remoteAddress}:${socket.remotePort}`;
      console.error(`[goodvibes-acp] Daemon: new TCP connection from ${remoteId}`);

      socket.on('error', (err) => {
        console.error(`[goodvibes-acp] Daemon: socket error from ${remoteId}:`, err.message);
        socket.destroy();
      });

      const stream = createTcpTransportFromSocket(socket);
      const conn = createConnection(stream);

      // Log when this client disconnects
      conn.closed.then(() => {
        console.error(`[goodvibes-acp] Daemon: connection closed from ${remoteId}`);
      }).catch(() => {
        // Intentional: conn.closed should not reject in practice; guard against unexpected rejection
      });
    },
  });

  healthCheck.markReady();
  daemonManager.markReady();
  console.error(
    `[goodvibes-acp] Daemon ready — listening on ${daemonHost}:${daemonPort}` +
    ` (health: ${daemonHost}:${daemonHealthPort})`,
  );

  // Daemon runs until a shutdown signal — keep the process alive.
  await new Promise<void>((resolve) => {
    eventBus.once('daemon:stopped', () => resolve());
  });

} else {
  // -------------------------------------------------------------------------
  // Subprocess mode — stdio transport (original behaviour)
  // -------------------------------------------------------------------------

  // Use the createStdioTransport helper from the transport module which
  // encapsulates the Node→Web stream casting and ndjson wrapping.
  const stream = createStdioTransport();

  const conn = createConnection(stream);

  healthCheck.markReady();
  console.error('[goodvibes-acp] Health check: ready');
  console.error('[goodvibes-acp] Ready — listening for ACP messages on stdin.');

  await conn.closed;
  console.error('[goodvibes-acp] Connection closed.');
}

// Suppress unused variable warnings for wired-but-unreferenced instances
void agentCoordinator;
void directiveQueue;
// config is wired into wrfcConfig above
void hookEngine;
void healthCheck;
void wrfcHandlers;
void ipcRouter;
void serviceRegistry;
void mcpBridge;
void daemonManager;
