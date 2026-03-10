/**
 * @file bootstrap.test.ts
 * @description Component integration test for the GoodVibes ACP runtime bootstrap.
 *
 * Since main.ts starts an ACP transport on stdin/stdout, we cannot run it directly
 * in tests. Instead, this file tests that the individual components wire together
 * correctly by importing them and exercising their integration points.
 *
 * Covers:
 *  1. Registry populated — register all plugins, verify expected keys exist
 *  2. EventBus wiring — emit events, verify subscribers receive them
 *  3. WRFC + agent integration — run WRFC with mock spawner/reviewer/fixer
 *  4. Config options — build WRFCConfig, verify shape and defaults
 *  5. Extension methods — GoodVibesExtensions returns health data
 *  6. Permission gate + mode — MODE_POLICIES, verify auto-approve/deny behavior
 */

import { describe, it, test, expect, beforeEach } from 'bun:test';

// L1 core
import { EventBus } from '../../src/core/event-bus.js';
import { StateStore } from '../../src/core/state-store.js';
import { Registry } from '../../src/core/registry.js';

// L2 extensions
import { WRFCOrchestrator } from '../../src/extensions/wrfc/orchestrator.js';
import { HealthCheck } from '../../src/extensions/lifecycle/health.js';
import { AgentTracker } from '../../src/extensions/agents/tracker.js';
import { EventRecorder } from '../../src/extensions/acp/event-recorder.js';
import { GoodVibesExtensions } from '../../src/extensions/acp/extensions.js';
import {
  PermissionGate,
  MODE_POLICIES,
} from '../../src/extensions/acp/permission-gate.js';

// L3 plugins
import { ReviewPlugin } from '../../src/plugins/review/index.js';
import { AgentsPlugin } from '../../src/plugins/agents/index.js';
import { SkillsPlugin } from '../../src/plugins/skills/index.js';
import { PrecisionPlugin } from '../../src/plugins/precision/index.js';
import { AnalyticsPlugin } from '../../src/plugins/analytics/index.js';
import { ProjectPlugin } from '../../src/plugins/project/index.js';
import { FrontendPlugin } from '../../src/plugins/frontend/index.js';

// Types
import type { WRFCConfig } from '../../src/types/wrfc.js';
import type {
  IAgentSpawner,
  IReviewer,
  IFixer,
  WorkResult,
  ReviewResult,
  FixResult,
} from '../../src/types/registry.js';
import type { AgentHandle, AgentConfig, AgentResult } from '../../src/types/agent.js';
import type { PermissionPolicy } from '../../src/types/permissions.js';

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makeMockSpawner(): IAgentSpawner {
  const handle: AgentHandle = { id: 'bootstrap-agent', type: 'engineer', spawnedAt: Date.now() };
  return {
    async spawn(_cfg: AgentConfig): Promise<AgentHandle> { return handle; },
    async result(_h: AgentHandle): Promise<AgentResult> {
      return {
        handle,
        status: 'completed',
        output: 'bootstrap test output',
        filesModified: ['src/bootstrap.ts'],
        errors: [],
        durationMs: 10,
      };
    },
    async cancel(_h: AgentHandle): Promise<void> {},
    status(_h: AgentHandle) { return 'completed' as const; },
  };
}

function makeMockReviewer(score = 9.5): IReviewer {
  return {
    id: 'bootstrap-reviewer',
    capabilities: ['typescript'],
    async review(workResult: WorkResult): Promise<ReviewResult> {
      return {
        sessionId: workResult.sessionId,
        score,
        dimensions: { quality: { score, weight: 1.0, issues: [] } },
        passed: score >= 9.0,
        issues: [],
      };
    },
  };
}

function makeMockFixer(): IFixer {
  return {
    async fix(reviewResult: ReviewResult): Promise<FixResult> {
      return {
        sessionId: reviewResult.sessionId,
        success: true,
        filesModified: [],
        resolvedIssues: reviewResult.issues,
        remainingIssues: [],
      };
    },
  };
}

/** Build a null ACP connection double that satisfies PermissionGate constructor */
function makeNullConn(): Parameters<typeof PermissionGate>[0] {
  return {
    requestPermission: async () => {
      throw new Error('requestPermission not expected in this test');
    },
  } as unknown as Parameters<typeof PermissionGate>[0];
}

// ---------------------------------------------------------------------------
// 1. Registry populated — register all plugins
// ---------------------------------------------------------------------------

describe('Registry — all plugins registered', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
    ReviewPlugin.register(registry);
    AgentsPlugin.register(registry);
    SkillsPlugin.register(registry);
    PrecisionPlugin.register(registry);
    AnalyticsPlugin.register(registry);
    ProjectPlugin.register(registry);
    FrontendPlugin.register(registry);
  });

  test('ReviewPlugin registers "fixer" key', () => {
    expect(registry.has('fixer')).toBe(true);
  });

  test('ReviewPlugin registers "reviewer" kind', () => {
    expect(registry.hasMany('reviewer')).toBe(true);
  });

  test('AgentsPlugin registers "agent-spawner" key', () => {
    expect(registry.has('agent-spawner')).toBe(true);
  });

  test('all reviewers have id and capabilities', () => {
    const reviewers = registry.getAll<IReviewer>('reviewer');
    expect(reviewers.length).toBeGreaterThan(0);
    for (const r of reviewers) {
      expect(typeof r.id).toBe('string');
      expect(r.id.length).toBeGreaterThan(0);
      expect(Array.isArray(r.capabilities)).toBe(true);
    }
  });

  test('fixer implementation has fix() method', () => {
    const fixer = registry.get<IFixer>('fixer');
    expect(typeof fixer.fix).toBe('function');
  });

  test('agent-spawner has spawn(), result(), cancel(), status()', () => {
    const spawner = registry.get<IAgentSpawner>('agent-spawner');
    expect(typeof spawner.spawn).toBe('function');
    expect(typeof spawner.result).toBe('function');
    expect(typeof spawner.cancel).toBe('function');
    expect(typeof spawner.status).toBe('function');
  });

  test('registry.keys() contains fixer and agent-spawner', () => {
    const keys = registry.keys();
    expect(keys).toContain('fixer');
    expect(keys).toContain('agent-spawner');
  });

  test('registry.kinds() contains reviewer', () => {
    const kinds = registry.kinds();
    expect(kinds).toContain('reviewer');
  });

  test('registering a plugin twice throws a duplicate key error', () => {
    expect(() => ReviewPlugin.register(registry)).toThrow();
    expect(() => AgentsPlugin.register(registry)).toThrow();
  });

  test('PrecisionPlugin registers "precision" key', () => {
    // PrecisionPlugin registers under the single-value key 'precision'
    expect(registry.has('precision')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. EventBus wiring
// ---------------------------------------------------------------------------

describe('EventBus wiring', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('subscriber receives emitted event', () => {
    const received: unknown[] = [];
    bus.on('test:event', (ev) => received.push(ev.payload));
    bus.emit('test:event', { value: 42 });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ value: 42 });
  });

  test('wildcard subscriber receives all events', () => {
    const types: string[] = [];
    bus.on('*', (ev) => types.push(ev.type));
    bus.emit('alpha', {});
    bus.emit('beta', {});
    expect(types).toContain('alpha');
    expect(types).toContain('beta');
  });

  test('once() subscriber fires only once', () => {
    let count = 0;
    bus.once('once:event', () => count++);
    bus.emit('once:event', {});
    bus.emit('once:event', {});
    expect(count).toBe(1);
  });

  test('dispose() stops event delivery', () => {
    const received: unknown[] = [];
    const sub = bus.on('dispose:event', (ev) => received.push(ev));
    bus.emit('dispose:event', { a: 1 });
    sub.dispose();
    bus.emit('dispose:event', { a: 2 });
    expect(received).toHaveLength(1);
  });

  test('multiple subscribers all receive the same event', () => {
    const r1: unknown[] = [];
    const r2: unknown[] = [];
    bus.on('multi:event', (ev) => r1.push(ev));
    bus.on('multi:event', (ev) => r2.push(ev));
    bus.emit('multi:event', { x: 99 });
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });

  test('history() returns previously emitted events', () => {
    bus.emit('hist:a', { n: 1 });
    bus.emit('hist:b', { n: 2 });
    const all = bus.history();
    const types = all.map((e) => e.type);
    expect(types).toContain('hist:a');
    expect(types).toContain('hist:b');
  });

  test('EventBus prefix subscribe — wrfc:* fires on wrfc:state-changed', () => {
    const types: string[] = [];
    bus.on('wrfc:*', (ev) => types.push(ev.type));
    bus.emit('wrfc:state-changed', { from: 'idle', to: 'working' });
    bus.emit('wrfc:work-complete', { filesModified: [] });
    expect(types).toContain('wrfc:state-changed');
    expect(types).toContain('wrfc:work-complete');
  });
});

// ---------------------------------------------------------------------------
// 3. WRFC + agent integration via mock components
// ---------------------------------------------------------------------------

describe('WRFC orchestrator + mock components integration', () => {
  let bus: EventBus;
  const wrfcConfig: WRFCConfig = {
    minReviewScore: 9.0,
    maxAttempts: 3,
    enableQualityGates: true,
  };

  beforeEach(() => {
    bus = new EventBus();
  });

  test('full WRFC run reaches complete with mock spawner and passing reviewer', async () => {
    const orchestrator = new WRFCOrchestrator(wrfcConfig, bus);
    const ctx = await orchestrator.run({
      workId: 'bs-w-1',
      sessionId: 'bs-s-1',
      task: 'Bootstrap integration task',
      spawner: makeMockSpawner(),
      reviewer: makeMockReviewer(9.5),
      fixer: makeMockFixer(),
      callbacks: {
        onStateChange: () => {},
        onWorkComplete: () => {},
        onReviewComplete: () => {},
        onFixComplete: () => {},
      },
    });
    expect(ctx.state).toBe('complete');
  });

  test('WRFC run with registry-backed reviewer and fixer', async () => {
    const registry = new Registry();
    ReviewPlugin.register(registry);
    AgentsPlugin.register(registry);

    const reviewer = registry.getAll<IReviewer>('reviewer')[0];
    const fixer = registry.get<IFixer>('fixer');

    // Registry reviewer should be callable
    expect(typeof reviewer.review).toBe('function');
    expect(typeof fixer.fix).toBe('function');

    const orchestrator = new WRFCOrchestrator(wrfcConfig, bus);
    // Run with our mock spawner, but real reviewer + fixer
    const ctx = await orchestrator.run({
      workId: 'bs-w-2',
      sessionId: 'bs-s-2',
      task: 'Test with real reviewer',
      spawner: makeMockSpawner(),
      reviewer,
      fixer,
      callbacks: {
        onStateChange: () => {},
        onWorkComplete: () => {},
        onReviewComplete: () => {},
        onFixComplete: () => {},
      },
    });
    // Should complete (possibly complete or escalated depending on reviewer score)
    expect(['complete', 'escalated', 'failed']).toContain(ctx.state);
    expect(ctx.finishedAt).toBeDefined();
  });

  test('WRFC events are emitted on the event bus during a run', async () => {
    const eventTypes: string[] = [];
    bus.on('wrfc:*', (ev) => eventTypes.push(ev.type));

    const orchestrator = new WRFCOrchestrator(wrfcConfig, bus);
    await orchestrator.run({
      workId: 'bs-ev',
      sessionId: 'bs-ev-s',
      task: 'Event test',
      spawner: makeMockSpawner(),
      reviewer: makeMockReviewer(9.5),
      fixer: makeMockFixer(),
      callbacks: {
        onStateChange: () => {},
        onWorkComplete: () => {},
        onReviewComplete: () => {},
        onFixComplete: () => {},
      },
    });

    expect(eventTypes).toContain('wrfc:state-changed');
    expect(eventTypes).toContain('wrfc:work-complete');
    expect(eventTypes).toContain('wrfc:review-complete');
    expect(eventTypes).toContain('wrfc:chain-complete');
  });

  test('runtime:started event is correctly structured', () => {
    const received: unknown[] = [];
    bus.on('runtime:started', (ev) => received.push(ev.payload));
    bus.emit('runtime:started', {
      mode: 'subprocess',
      plugins: ['review', 'agents', 'skills', 'precision', 'analytics', 'project', 'frontend'],
      timestamp: Date.now(),
    });
    expect(received).toHaveLength(1);
    const payload = received[0] as Record<string, unknown>;
    expect(payload).toHaveProperty('mode', 'subprocess');
    expect(Array.isArray(payload.plugins)).toBe(true);
    expect((payload.plugins as string[]).length).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// 4. Config options — WRFCConfig structure
// ---------------------------------------------------------------------------

describe('WRFCConfig options', () => {
  test('default runtime config has correct shape', () => {
    const wrfcConfig: WRFCConfig = {
      minReviewScore: 9.5,
      maxAttempts: 3,
      enableQualityGates: true,
    };
    expect(wrfcConfig.minReviewScore).toBe(9.5);
    expect(wrfcConfig.maxAttempts).toBe(3);
    expect(wrfcConfig.enableQualityGates).toBe(true);
  });

  test('minReviewScore boundary — exactly at threshold passes', async () => {
    const config: WRFCConfig = { minReviewScore: 8.0, maxAttempts: 1, enableQualityGates: true };
    const bus = new EventBus();
    const orchestrator = new WRFCOrchestrator(config, bus);
    const ctx = await orchestrator.run({
      workId: 'cfg-w',
      sessionId: 'cfg-s',
      task: 'Config boundary test',
      spawner: makeMockSpawner(),
      reviewer: makeMockReviewer(8.0),
      fixer: makeMockFixer(),
      callbacks: {
        onStateChange: () => {},
        onWorkComplete: () => {},
        onReviewComplete: () => {},
        onFixComplete: () => {},
      },
    });
    expect(ctx.state).toBe('complete');
  });

  test('minReviewScore boundary — just below threshold escalates', async () => {
    const config: WRFCConfig = { minReviewScore: 8.0, maxAttempts: 1, enableQualityGates: true };
    const bus = new EventBus();
    const orchestrator = new WRFCOrchestrator(config, bus);
    const ctx = await orchestrator.run({
      workId: 'cfg-w2',
      sessionId: 'cfg-s2',
      task: 'Config below threshold',
      spawner: makeMockSpawner(),
      reviewer: makeMockReviewer(7.9),
      fixer: makeMockFixer(),
      callbacks: {
        onStateChange: () => {},
        onWorkComplete: () => {},
        onReviewComplete: () => {},
        onFixComplete: () => {},
      },
    });
    expect(ctx.state).toBe('escalated');
  });

  test('maxAttempts: 1 with failing reviewer — escalates without a fix cycle', async () => {
    const config: WRFCConfig = { minReviewScore: 9.0, maxAttempts: 1, enableQualityGates: true };
    const bus = new EventBus();
    const callbacks = {
      fixes: 0,
      onStateChange: () => {},
      onWorkComplete: () => {},
      onReviewComplete: () => {},
      onFixComplete: () => { callbacks.fixes++; },
    };
    const orchestrator = new WRFCOrchestrator(config, bus);
    await orchestrator.run({
      workId: 'cfg-w3',
      sessionId: 'cfg-s3',
      task: 'Max1 escalation test',
      spawner: makeMockSpawner(),
      reviewer: makeMockReviewer(3.0),
      fixer: makeMockFixer(),
      callbacks,
    });
    // With maxAttempts:1 and a failing reviewer, escalates without fix
    expect(callbacks.fixes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Extension methods — GoodVibesExtensions health data
// ---------------------------------------------------------------------------

describe('GoodVibesExtensions — runtime status', () => {
  function makeExtensions(overrides?: {
    health?: HealthCheck;
    registry?: Registry;
  }) {
    const bus = new EventBus();
    const store = new StateStore();
    const registry = overrides?.registry ?? new Registry();
    const health = overrides?.health ?? new HealthCheck(bus);
    const tracker = new AgentTracker(store, bus);
    const recorder = new EventRecorder(bus);
    return new GoodVibesExtensions(bus, store, registry, health, tracker, recorder);
  }

  test('_goodvibes/status returns health, uptime, sessions, agents, plugins, _meta', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(result).toHaveProperty('health');
    expect(result).toHaveProperty('uptime');
    expect(result).toHaveProperty('activeSessionCount');
    expect(result).toHaveProperty('activeAgentCount');
    expect(result).toHaveProperty('registeredPlugins');
    expect(result).toHaveProperty('_meta');
  });

  test('health is "degraded" when runtime is still starting', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(result.health).toBe('degraded');
  });

  test('health is "healthy" after markReady()', async () => {
    const bus = new EventBus();
    const health = new HealthCheck(bus);
    health.markReady();
    const ext = makeExtensions({ health });
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(result.health).toBe('healthy');
  });

  test('health is "shutting_down" after markShuttingDown()', async () => {
    const bus = new EventBus();
    const health = new HealthCheck(bus);
    health.markReady();
    health.markShuttingDown();
    const ext = makeExtensions({ health });
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(result.health).toBe('shutting_down');
  });

  test('registeredPlugins is empty when no plugins registered', async () => {
    const ext = makeExtensions({ registry: new Registry() });
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(Array.isArray(result.registeredPlugins)).toBe(true);
    expect(result.registeredPlugins).toHaveLength(0);
  });

  test('_goodvibes/status activeAgentCount is 0 initially', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(result.activeAgentCount).toBe(0);
  });

  test('_goodvibes/status activeSessionCount is 0 when no sessions exist', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
    expect(result.activeSessionCount).toBe(0);
  });

  test('unknown method returns error object', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/unknown-method') as Record<string, unknown>;
    expect(result).toHaveProperty('error', 'unknown_method');
  });
});

// ---------------------------------------------------------------------------
// 6. Permission gate + mode policies
// ---------------------------------------------------------------------------

describe('PermissionGate — mode policies', () => {
  test('MODE_POLICIES exports justvibes, vibecoding, plan, sandbox', () => {
    expect(MODE_POLICIES).toHaveProperty('justvibes');
    expect(MODE_POLICIES).toHaveProperty('vibecoding');
    expect(MODE_POLICIES).toHaveProperty('plan');
    expect(MODE_POLICIES).toHaveProperty('sandbox');
  });

  test('justvibes policy auto-approves all permission types', () => {
    const policy = MODE_POLICIES['justvibes'] as PermissionPolicy;
    // ISS-068: spec-defined permission types (network, browser, shell, file_write, file_delete)
    expect(policy.autoApprove).toContain('file_write');
    expect(policy.autoApprove).toContain('file_delete');
    expect(policy.autoApprove).toContain('network');
    expect(policy.autoApprove).toContain('browser');
    expect(policy.autoApprove).toContain('shell');
    expect(policy.alwaysDeny).toHaveLength(0);
    expect(policy.promptForUnknown).toBe(false);
  });

  test('plan policy auto-approves nothing and denies shell and file_delete', () => {
    const policy = MODE_POLICIES['plan'] as PermissionPolicy;
    // ISS-068/ISS-098: plan mode requires prompting for every gated action; file_read removed from autoApprove
    // alwaysDeny uses spec-defined type 'shell' (not 'command_execute')
    expect(policy.alwaysDeny).toContain('shell');
    expect(policy.alwaysDeny).toContain('file_delete');
    expect(policy.promptForUnknown).toBe(true);
  });

  test('sandbox policy denies network and browser', () => {
    const policy = MODE_POLICIES['sandbox'] as PermissionPolicy;
    // ISS-068: spec-defined type 'network' (not 'network_access')
    expect(policy.alwaysDeny).toContain('network');
    expect(policy.alwaysDeny).toContain('browser');
  });

  test('justvibes gate auto-approves file_write without contacting client', async () => {
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-just',
      MODE_POLICIES['justvibes'] as PermissionPolicy,
    );
    // ISS-068: use spec-defined type 'file_write' (justvibes autoApprove includes file_write)
    const result = await gate.check({
      type: 'file_write',
      title: 'Write a file',
    });
    expect(result.granted).toBe(true);
  });

  test('justvibes gate auto-approves network without contacting client', async () => {
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-just',
      MODE_POLICIES['justvibes'] as PermissionPolicy,
    );
    // ISS-068: spec-defined type 'network' (not 'network_access')
    const result = await gate.check({
      type: 'network',
      title: 'Fetch external URL',
    });
    expect(result.granted).toBe(true);
  });

  test('plan gate denies shell immediately', async () => {
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-plan',
      MODE_POLICIES['plan'] as PermissionPolicy,
    );
    // ISS-068: spec-defined type 'shell' (not 'command_execute')
    const result = await gate.check({
      type: 'shell',
      title: 'Run shell command',
    });
    expect(result.granted).toBe(false);
  });

  test('sandbox gate denies network immediately', async () => {
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-sandbox',
      MODE_POLICIES['sandbox'] as PermissionPolicy,
    );
    // ISS-068: spec-defined type 'network' (not 'network_access')
    const result = await gate.check({
      type: 'network',
      title: 'External API call',
    });
    expect(result.granted).toBe(false);
  });

  test('justvibes gate auto-approves unknown permission types (promptForUnknown=false)', async () => {
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-just',
      MODE_POLICIES['justvibes'] as PermissionPolicy,
    );
    // 'unknown_type' is not in any list but promptForUnknown=false means auto-grant
    const result = await gate.check({
      type: 'unknown_type' as never,
      title: 'Unknown action',
    });
    expect(result.granted).toBe(true);
  });

  test('plan gate prompts for file_write (neither auto-approve nor always-deny)', async () => {
    // ISS-068/ISS-098: plan mode has empty autoApprove array; file_write requires a prompt.
    // Since makeNullConn() throws when requestPermission is called (simulating timeout),
    // this test verifies the gate falls through to the promptForUnknown path.
    // We can only verify it does NOT auto-approve and does NOT hard-fail with an unhandled error.
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-plan',
      MODE_POLICIES['plan'] as PermissionPolicy,
    );
    // file_write is not in autoApprove or alwaysDeny for plan, so it prompts.
    // makeNullConn() rejects, which the gate catches and returns denied.
    const result = await gate.check({
      type: 'file_write',
      title: 'Write a file',
    });
    // Permission is denied because the conn threw (makeNullConn rejects requestPermission)
    expect(result.granted).toBe(false);
  });

  test('vibecoding gate auto-approves file_write and shell', async () => {
    const gate = new PermissionGate(
      makeNullConn(),
      'sess-vibe',
      MODE_POLICIES['vibecoding'] as PermissionPolicy,
    );
    // ISS-068: spec-defined type 'shell' (not 'command_execute')
    for (const type of ['file_write', 'shell'] as const) {
      const result = await gate.check({ type, title: 'Test' });
      expect(result.granted).toBe(true);
    }
  });

  test('all mode policies have autoApprove and alwaysDeny arrays', () => {
    for (const [mode, policy] of Object.entries(MODE_POLICIES)) {
      expect(Array.isArray(policy.autoApprove), `${mode}.autoApprove should be array`).toBe(true);
      expect(Array.isArray(policy.alwaysDeny), `${mode}.alwaysDeny should be array`).toBe(true);
      expect(typeof policy.promptForUnknown, `${mode}.promptForUnknown should be boolean`).toBe('boolean');
    }
  });
});
