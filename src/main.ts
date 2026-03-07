#!/usr/bin/env bun
/**
 * main.ts — GoodVibes ACP runtime composition root
 *
 * Wires all layers together:
 *   L0 types → L1 core → L2 extensions → L3 plugins (future)
 *
 * Transport: ACP ndjson over stdin/stdout.
 * All diagnostic output goes to stderr so stdout remains clean for ACP.
 */

import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { EventBus } from './core/event-bus.js';
import { StateStore } from './core/state-store.js';
import { Registry } from './core/registry.js';
import { Config } from './core/config.js';
import { SessionManager } from './extensions/sessions/manager.js';
import { WRFCOrchestrator } from './extensions/wrfc/orchestrator.js';
import type { WRFCRunParams } from './extensions/wrfc/orchestrator.js';
import type { WRFCConfig } from './types/wrfc.js';
import { GoodVibesAgent } from './extensions/acp/agent.js';
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
import { AgentsPlugin } from './plugins/agents/index.js';

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

ReviewPlugin.register(registry);
AgentsPlugin.register(registry);

const wrfcConfig: WRFCConfig = {
  minReviewScore: 9.5,
  maxAttempts: 3,
  enableQualityGates: true,
};

const wrfcOrchestrator = new WRFCOrchestrator(wrfcConfig, eventBus);

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

      // No-op lifecycle callbacks.
      // Consumers may observe the event bus instead.
      callbacks: {
        onStateChange: () => {},
        onWorkComplete: () => {},
        onReviewComplete: () => {},
        onFixComplete: () => {},
      },
    };

    const result = await wrfcOrchestrator.run(runParams);
    return { state: result.state, lastScore: result.lastScore };
  },
};

// ---------------------------------------------------------------------------
// Startup: load memory and ensure log files exist
// ---------------------------------------------------------------------------

await memoryManager.load();
await logsManager.ensureFiles();
healthCheck.markReady();
console.error('[goodvibes-acp] Health check: ready');

// ---------------------------------------------------------------------------
// ACP transport (ndjson over stdin/stdout)
// ---------------------------------------------------------------------------

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as unknown as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as unknown as ReadableStream<Uint8Array>,
);

// ---------------------------------------------------------------------------
// ACP connection — one GoodVibesAgent per connection
// ---------------------------------------------------------------------------

const conn = new acp.AgentSideConnection(
  (c) => new GoodVibesAgent(c, registry, eventBus, sessionManager, wrfcAdapter),
  stream,
);

console.error('[goodvibes-acp] Ready — listening for ACP messages on stdin.');

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
// Wait for the ACP connection to close
// ---------------------------------------------------------------------------

await conn.closed;

console.error('[goodvibes-acp] Connection closed.');

// Suppress unused variable warnings for wired-but-unreferenced instances
void agentCoordinator;
void directiveQueue;
void config;
void hookEngine;
void healthCheck;
