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

// ---------------------------------------------------------------------------
// L2 extensions
// ---------------------------------------------------------------------------

const sessionManager = new SessionManager(stateStore, eventBus);

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

      // Stub spawner — returns a no-op handle that resolves immediately.
      // A future L3 plugin will replace this with a real agent spawner.
      spawner: {
        async spawn(agentConfig: AgentConfig): Promise<AgentHandle> {
          return {
            id: agentConfig.task?.slice(0, 8) ?? 'stub',
            type: agentConfig.type,
            spawnedAt: Date.now(),
          };
        },
        async result(_handle: AgentHandle): Promise<AgentResult> {
          return {
            handle: _handle,
            status: 'completed',
            output: '',
            filesModified: [],
            errors: [],
            durationMs: 0,
          };
        },
        async cancel(_handle: AgentHandle): Promise<void> {
          // no-op
        },
        status(_handle: AgentHandle) {
          return 'completed' as const;
        },
      },

      // Stub reviewer — auto-approves with a perfect score.
      // A future L3 plugin will replace this with a real reviewer.
      reviewer: {
        id: 'stub-reviewer',
        capabilities: [],
        async review(workResult: WorkResult): Promise<ReviewResult> {
          return {
            sessionId: workResult.sessionId,
            score: 10,
            dimensions: {},
            passed: true,
            issues: [],
            notes: 'Auto-approved (no reviewer configured)',
          };
        },
      },

      // Stub fixer — returns the work result unchanged.
      // A future L3 plugin will replace this with a real fixer.
      fixer: {
        async fix(_reviewResult: ReviewResult): Promise<FixResult> {
          return {
            sessionId: _reviewResult.sessionId,
            success: true,
            filesModified: [],
            resolvedIssues: [],
            remainingIssues: [],
          };
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

function shutdown(signal: string): void {
  console.error(`[goodvibes-acp] Received ${signal}, shutting down...`);
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

// Suppress unused variable warnings for L1 primitives wired into the runtime
void stateStore;
void config;
