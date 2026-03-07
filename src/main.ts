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

import { Readable, Writable } from 'node:stream';
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
import type { IAgentSpawner, IReviewer, IFixer } from './types/registry.js';
import { AgentTracker } from './extensions/agents/tracker.js';
import { AgentCoordinator } from './extensions/agents/coordinator.js';
import { DirectiveQueue } from './extensions/directives/queue.js';
import { MemoryManager } from './extensions/memory/manager.js';
import { LogsManager } from './extensions/logs/manager.js';
import { HookEngine } from './core/hook-engine.js';
import { HookRegistrar } from './extensions/hooks/registrar.js';
import { ShutdownManager } from './extensions/lifecycle/shutdown.js';
import { HealthCheck } from './extensions/lifecycle/health.js';
import { ReviewPlugin } from './plugins/review/index.js';
import { AgentsPlugin, AgentSpawnerPlugin } from './plugins/agents/index.js';
import type { OnProgressFactory } from './plugins/agents/spawner.js';
import { SkillsPlugin } from './plugins/skills/index.js';
import { PrecisionPlugin } from './plugins/precision/index.js';
import { AnalyticsPlugin } from './plugins/analytics/index.js';
import { ProjectPlugin } from './plugins/project/index.js';
import { FrontendPlugin } from './plugins/frontend/index.js';
import { EventRecorder } from './extensions/acp/event-recorder.js';
import { GoodVibesExtensions } from './extensions/acp/extensions.js';
import { ToolCallEmitter } from './extensions/acp/tool-call-emitter.js';
import { AgentEventBridge } from './extensions/acp/agent-event-bridge.js';
import { createTcpTransportFromSocket } from './extensions/acp/transport.js';
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
const hookEngine = new HookEngine();

// ---------------------------------------------------------------------------
// L2 extensions
// ---------------------------------------------------------------------------

const sessionManager = new SessionManager(stateStore, eventBus);

const agentTracker = new AgentTracker(stateStore, eventBus);
const agentCoordinator = new AgentCoordinator(agentTracker, registry, eventBus, { maxParallel: 6 });
const directiveQueue = new DirectiveQueue(eventBus);
const memoryManager = new MemoryManager('.goodvibes/memory', eventBus);
const logsManager = new LogsManager('.goodvibes/logs', eventBus);
const hookRegistrar = new HookRegistrar(hookEngine, eventBus);
const shutdownManager = new ShutdownManager(eventBus);
const healthCheck = new HealthCheck(eventBus);

// ---------------------------------------------------------------------------
// L3 plugins
// ---------------------------------------------------------------------------

// Register built-in hooks (validation, lifecycle events)
hookRegistrar.registerBuiltins();

// Register shutdown handlers for core services
shutdownManager.register('memory', 10, () => memoryManager.save());
// wrfcOrchestrator has no destroy — WRFC state lives in memory only
shutdownManager.register('hooks', 90, async () => { hookEngine.destroy(); });
shutdownManager.register('mcp-bridge', 20, () => mcpBridge.disconnectAll());
shutdownManager.register('service-registry', 30, () => serviceRegistry.save());
shutdownManager.register('ipc-socket', 40, () => ipcSocketServer.stop());
shutdownManager.register('daemon', 50, () => daemonManager.stop());

ReviewPlugin.register(registry);
AgentsPlugin.register(registry);
// Re-register the agent spawner with the McpToolCallBridge progress factory
// so AgentLoop tool executions emit ACP tool_call updates in real time.
registry.unregister('agent-spawner');
registry.register('agent-spawner', new AgentSpawnerPlugin(registry, onProgressFactory));
SkillsPlugin.register(registry);
PrecisionPlugin.register(registry);
AnalyticsPlugin.register(registry);
ProjectPlugin.register(registry);
FrontendPlugin.register(registry);

const wrfcConfig: WRFCConfig = {
  minReviewScore: 9.5,
  maxAttempts: 3,
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

// ---------------------------------------------------------------------------
// Daemon manager
// ---------------------------------------------------------------------------

const daemonManager = new DaemonManager(eventBus);

// ---------------------------------------------------------------------------
// ToolCallEmitter — lazily assigned after conn is created
// ---------------------------------------------------------------------------

let toolCallEmitter: InstanceType<typeof ToolCallEmitter> | null = null;

// ---------------------------------------------------------------------------
// McpToolCallBridge — bridges AgentLoop onProgress to ACP tool_call updates
//
// Created before plugin registration so it can be passed as onProgressFactory
// to AgentSpawnerPlugin. The emitter getter is lazy — it resolves to null
// until createConnection() sets toolCallEmitter for the active connection.
// ---------------------------------------------------------------------------

const mcpToolCallBridge = new McpToolCallBridge(() => toolCallEmitter);

const onProgressFactory: OnProgressFactory = (sessionId: string) =>
  mcpToolCallBridge.makeProgressHandler(sessionId);

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

  // Wire toolCallEmitter to this connection (last-writer-wins in daemon mode,
  // but each connection can have its own — set module-level for WRFC callbacks)
  toolCallEmitter = new ToolCallEmitter(conn);

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

const wrfcAdapter = {
  run: async (params: { workId: string; sessionId: string; task: string; signal?: AbortSignal }) => {
    const runParams: WRFCRunParams = {
      ...params,

      // Real spawner — delegates to the L3 AgentSpawnerPlugin via registry.
      spawner: {
        async spawn(agentConfig: AgentConfig): Promise<AgentHandle> {
          return registry.get<IAgentSpawner>('agent-spawner')!.spawn(agentConfig);
        },
        async result(handle: AgentHandle): Promise<AgentResult> {
          return registry.get<IAgentSpawner>('agent-spawner')!.result(handle);
        },
        async cancel(handle: AgentHandle): Promise<void> {
          return registry.get<IAgentSpawner>('agent-spawner')!.cancel(handle);
        },
        status(handle: AgentHandle) {
          return registry.get<IAgentSpawner>('agent-spawner')!.status(handle);
        },
      },

      // Real reviewer — delegates to the first registered L3 CodeReviewer.
      reviewer: {
        id: 'registry-reviewer',
        capabilities: [],
        async review(workResult: WorkResult): Promise<ReviewResult> {
          const reviewers = registry.getAll<IReviewer>('reviewer');
          const reviewer = reviewers.values().next().value;
          if (!reviewer) {
            return {
              sessionId: workResult.sessionId,
              score: 10,
              dimensions: {},
              passed: true,
              issues: [],
              notes: 'No reviewer configured',
            };
          }
          return reviewer.review(workResult);
        },
      },

      // Real fixer — delegates to the L3 CodeFixer via registry.
      fixer: {
        async fix(reviewResult: ReviewResult): Promise<FixResult> {
          return registry.get<IFixer>('fixer')!.fix(reviewResult);
        },
      },

      // WRFC lifecycle callbacks — emit tool_call updates so ACP clients
      // can observe phase progress in real time.
      // toolCallEmitter is lazily resolved — it is assigned after conn is created below.
      callbacks: (() => {
        const ids: Record<string, string> = {};
        const cb: WRFCCallbacks = {
          onStateChange: (_from, to) => {
            const phase =
              to === 'working' ? 'goodvibes_work'
              : to === 'reviewing' ? 'goodvibes_review'
              : to === 'fixing' ? 'goodvibes_fix'
              : null;
            if (!phase || !toolCallEmitter) return;
            ids[phase] = crypto.randomUUID();
            toolCallEmitter.emitToolCall(
              params.sessionId,
              ids[phase],
              phase,
              phase === 'goodvibes_work' ? 'Running task'
                : phase === 'goodvibes_review' ? 'Reviewing output'
                : 'Applying fixes',
              'in_progress',
            ).catch(() => {});
          },
          onWorkComplete: () => {
            const id = ids['goodvibes_work'];
            if (!id || !toolCallEmitter) return;
            toolCallEmitter.emitToolCallUpdate(params.sessionId, id, 'completed').catch(() => {});
          },
          onReviewComplete: (result) => {
            const id = ids['goodvibes_review'];
            if (!id || !toolCallEmitter) return;
            toolCallEmitter.emitToolCallUpdate(
              params.sessionId,
              id,
              'completed',
              { score: result.score },
            ).catch(() => {});
          },
          onFixComplete: () => {
            const id = ids['goodvibes_fix'];
            if (!id || !toolCallEmitter) return;
            toolCallEmitter.emitToolCallUpdate(params.sessionId, id, 'completed').catch(() => {});
          },
        };
        return cb;
      })(),
    };

    const result = await wrfcOrchestrator.run(runParams);
    return { state: result.state, lastScore: result.lastScore };
  },
};

// ---------------------------------------------------------------------------
// Startup: load memory and ensure log files exist
// ---------------------------------------------------------------------------

// Process mode detection
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
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[goodvibes-acp] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[goodvibes-acp] Unhandled rejection:', reason);
  process.exit(1);
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

  const daemonPort = parseInt(
    process.env.GOODVIBES_DAEMON_PORT ?? getArgValue('--port') ?? '9000',
    10,
  );
  const daemonHost =
    process.env.GOODVIBES_DAEMON_HOST ?? getArgValue('--host') ?? '127.0.0.1';
  const daemonHealthPort = parseInt(
    process.env.GOODVIBES_DAEMON_HEALTH_PORT ?? getArgValue('--health-port') ?? String(daemonPort + 1),
    10,
  );
  const daemonPidFile =
    process.env.GOODVIBES_DAEMON_PID_FILE ?? getArgValue('--pid-file');

  await daemonManager.start({
    port: daemonPort,
    host: daemonHost,
    healthPort: daemonHealthPort,
    pidFile: daemonPidFile,
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
      }).catch(() => {});
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

  const stream = acp.ndJsonStream(
    Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
    Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
  );

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
void config;
void hookEngine;
void healthCheck;
void wrfcHandlers;
void ipcRouter;
void serviceRegistry;
void mcpBridge;
void daemonManager;
