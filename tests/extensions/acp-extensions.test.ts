import { describe, test, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.ts';
import { StateStore } from '../../src/core/state-store.ts';
import { Registry } from '../../src/core/registry.ts';
import { HealthCheck } from '../../src/extensions/lifecycle/health.ts';
import { AgentTracker } from '../../src/extensions/agents/tracker.ts';
import { EventRecorder } from '../../src/extensions/acp/event-recorder.ts';
import { GoodVibesExtensions } from '../../src/extensions/acp/extensions.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExtensions(overrides?: {
  bus?: EventBus;
  store?: StateStore;
  registry?: Registry;
  health?: HealthCheck;
  tracker?: AgentTracker;
  recorder?: EventRecorder;
}) {
  const bus = overrides?.bus ?? new EventBus();
  const store = overrides?.store ?? new StateStore();
  const registry = overrides?.registry ?? new Registry();
  const health = overrides?.health ?? new HealthCheck(bus);
  const tracker = overrides?.tracker ?? new AgentTracker(store, bus);
  const recorder = overrides?.recorder ?? new EventRecorder(bus);
  return new GoodVibesExtensions(bus, store, registry, health, tracker, recorder);
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('GoodVibesExtensions', () => {
  describe('constructor', () => {
    test('accepts all 6 dependencies without throwing', () => {
      expect(() => makeExtensions()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // _goodvibes/status
  // ---------------------------------------------------------------------------

  describe("handle('_goodvibes/status')", () => {
    test('returns health, uptime, activeSessionCount, activeAgentCount, registeredPlugins, _meta', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;

      expect(result).toHaveProperty('health');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('activeSessionCount');
      expect(result).toHaveProperty('activeAgentCount');
      expect(result).toHaveProperty('registeredPlugins');
      expect(result).toHaveProperty('_meta');
    });

    test('health is "degraded" when runtime is in starting state', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      // 'starting' maps to 'degraded'
      expect(result.health).toBe('degraded');
    });

    test('health is "healthy" when runtime is ready', async () => {
      const bus = new EventBus();
      const health = new HealthCheck(bus);
      health.markReady();
      const ext = makeExtensions({ bus, health });

      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(result.health).toBe('healthy');
    });

    test('health is "degraded" when runtime is ready but has a failing check', async () => {
      const bus = new EventBus();
      const health = new HealthCheck(bus);
      health.markReady();
      health.setCheck('db', false, 'DB is down');
      const ext = makeExtensions({ bus, health });

      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(result.health).toBe('degraded');
    });

    test('health is "shutting_down" when runtime is shutting down', async () => {
      const bus = new EventBus();
      const health = new HealthCheck(bus);
      health.markShuttingDown();
      const ext = makeExtensions({ bus, health });

      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(result.health).toBe('shutting_down');
    });

    test('uptime is a non-negative number', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime as number).toBeGreaterThanOrEqual(0);
    });

    test('activeSessionCount reflects sessions in state store (excluding history keys)', async () => {
      const store = new StateStore();
      store.set('sessions', 'sess-1', { id: 'sess-1', state: 'active', createdAt: Date.now() });
      store.set('sessions', 'sess-2', { id: 'sess-2', state: 'active', createdAt: Date.now() });
      // history keys should not be counted
      store.set('sessions', 'history:sess-1', []);

      const ext = makeExtensions({ store });
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(result.activeSessionCount).toBe(2);
    });

    test('activeAgentCount reflects active agents in tracker', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const tracker = new AgentTracker(store, bus);
      tracker.register({ id: 'a1', type: 'engineer', spawnedAt: Date.now() }, 'sess-1', 'task1');
      tracker.register({ id: 'a2', type: 'tester', spawnedAt: Date.now() }, 'sess-1', 'task2');
      tracker.updateStatus('a2', 'running');
      tracker.register({ id: 'a3', type: 'engineer', spawnedAt: Date.now() }, 'sess-1', 'task3');
      tracker.updateStatus('a3', 'completed'); // not active

      const ext = makeExtensions({ bus, store, tracker });
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(result.activeAgentCount).toBe(2);
    });

    test('registeredPlugins is an empty array when no plugins registered', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      expect(result.registeredPlugins).toEqual([]);
    });

    test('registeredPlugins returns plugin names from registry', async () => {
      const registry = new Registry();
      // Plugins are registered via registerMany('plugin', key, { manifest: { name } })
      registry.registerMany('plugin', 'plugin-a', { manifest: { name: 'plugin-alpha' } });
      registry.registerMany('plugin', 'plugin-b', { manifest: { name: 'plugin-beta' } });

      const bus = new EventBus();
      const health = new HealthCheck(bus);
      health.markReady();
      const ext = makeExtensions({ bus, registry, health });

      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      const plugins = result.registeredPlugins as string[];
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain('plugin-alpha');
      expect(plugins).toContain('plugin-beta');
    });

    test('_meta includes version field', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/status') as Record<string, unknown>;
      const meta = result._meta as Record<string, unknown>;
      expect(typeof meta.version).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // _goodvibes/state
  // ---------------------------------------------------------------------------

  describe("handle('_goodvibes/state')", () => {
    test('returns sessions, wrfcChains, config, _meta', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;

      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('wrfcChains');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('_meta');
    });

    test('sessions is empty object when no sessions in store', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      expect(result.sessions).toEqual({});
    });

    test('sessions includes session data without history keys', async () => {
      const store = new StateStore();
      const now = Date.now();
      store.set('sessions', 'sess-A', { id: 'sess-A', state: 'active', createdAt: now });
      store.set('sessions', 'history:sess-A', ['msg1', 'msg2']);

      const ext = makeExtensions({ store });
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      const sessions = result.sessions as Record<string, unknown>;

      expect(sessions).toHaveProperty('sess-A');
      expect(sessions).not.toHaveProperty('history:sess-A');
    });

    test('session summary has id, status, createdAt, promptCount', async () => {
      const store = new StateStore();
      const now = Date.now();
      store.set('sessions', 'sess-B', { id: 'sess-B', state: 'active', createdAt: now });
      store.set('sessions', 'history:sess-B', ['m1', 'm2', 'm3']);

      const ext = makeExtensions({ store });
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      const sessions = result.sessions as Record<string, Record<string, unknown>>;
      const sess = sessions['sess-B'];

      expect(sess.id).toBe('sess-B');
      expect(sess.status).toBe('active');
      expect(sess.createdAt).toBe(now);
      expect(sess.promptCount).toBe(3);
    });

    test('promptCount is 0 when no history key exists for session', async () => {
      const store = new StateStore();
      store.set('sessions', 'sess-C', { id: 'sess-C', state: 'idle', createdAt: Date.now() });
      // No history:sess-C key

      const ext = makeExtensions({ store });
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      const sessions = result.sessions as Record<string, Record<string, unknown>>;
      expect(sessions['sess-C'].promptCount).toBe(0);
    });

    test('wrfcChains is empty object when no wrfc namespace exists', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      expect(result.wrfcChains).toEqual({});
    });

    test('wrfcChains includes chain data when wrfc namespace exists', async () => {
      const store = new StateStore();
      store.set('wrfc', 'chain-1', {
        state: 'applying',
        attempt: { attemptNumber: 2 },
        lastScore: { overall: 8 },
      });

      const ext = makeExtensions({ store });
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      const chains = result.wrfcChains as Record<string, Record<string, unknown>>;

      expect(chains).toHaveProperty('chain-1');
      expect(chains['chain-1'].phase).toBe('applying');
      expect(chains['chain-1'].attempt).toBe(2);
      expect(chains['chain-1'].score).toBe(8);
    });

    test('config is empty object when no config registered', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      expect(result.config).toEqual({});
    });

    test('_meta includes version field', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/state') as Record<string, unknown>;
      const meta = result._meta as Record<string, unknown>;
      expect(typeof meta.version).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // _goodvibes/events
  // ---------------------------------------------------------------------------

  describe("handle('_goodvibes/events')", () => {
    test('returns events array and _meta', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/events') as Record<string, unknown>;

      expect(Array.isArray(result.events)).toBe(true);
      expect(result).toHaveProperty('_meta');
    });

    test('returns empty events array when recorder has no events', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/events') as Record<string, unknown>;
      expect(result.events).toEqual([]);
    });

    test('returns events recorded by the EventRecorder', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const recorder = new EventRecorder(bus);
      recorder.register();

      bus.emit('test:event', { val: 1 });
      bus.emit('test:event', { val: 2 });

      const ext = makeExtensions({ bus, store, recorder });
      const result = await ext.handle('_goodvibes/events') as Record<string, unknown>;
      expect((result.events as unknown[]).length).toBe(2);
    });

    test('respects limit param', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const recorder = new EventRecorder(bus);
      recorder.register();

      for (let i = 0; i < 10; i++) {
        bus.emit('test:event', { i });
      }

      const ext = makeExtensions({ bus, store, recorder });
      const result = await ext.handle('_goodvibes/events', { limit: 5 }) as Record<string, unknown>;
      expect((result.events as unknown[]).length).toBe(5);
    });

    test('respects type filter param', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const recorder = new EventRecorder(bus);
      recorder.register();

      bus.emit('session:created', { id: 's1' });
      bus.emit('agent:started', { id: 'a1' });
      bus.emit('session:created', { id: 's2' });

      const ext = makeExtensions({ bus, store, recorder });
      const result = await ext.handle('_goodvibes/events', { type: 'session:created' }) as Record<string, unknown>;
      const events = result.events as Array<{ type: string }>;
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === 'session:created')).toBe(true);
    });

    test('respects sessionId filter param', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const recorder = new EventRecorder(bus);
      recorder.register();

      // sessionId comes from payload.sessionId
      bus.emit('event:a', { sessionId: 'sess-1' });
      bus.emit('event:b', { sessionId: 'sess-2' });

      const ext = makeExtensions({ bus, store, recorder });
      const result = await ext.handle('_goodvibes/events', { sessionId: 'sess-1' }) as Record<string, unknown>;
      const events = result.events as Array<{ sessionId: string }>;
      expect(events).toHaveLength(1);
      expect(events[0].sessionId).toBe('sess-1');
    });

    test('ignores non-object params gracefully', async () => {
      const ext = makeExtensions();
      // Should not throw
      const result = await ext.handle('_goodvibes/events', null) as Record<string, unknown>;
      expect(Array.isArray(result.events)).toBe(true);
    });

    test('ignores string params gracefully', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/events', 'bad-param') as Record<string, unknown>;
      expect(Array.isArray(result.events)).toBe(true);
    });

    test('_meta includes version field', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/events') as Record<string, unknown>;
      const meta = result._meta as Record<string, unknown>;
      expect(typeof meta.version).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // _goodvibes/agents
  // ---------------------------------------------------------------------------

  describe("handle('_goodvibes/agents')", () => {
    test('returns agents array and _meta', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/agents') as Record<string, unknown>;

      expect(Array.isArray(result.agents)).toBe(true);
      expect(result).toHaveProperty('_meta');
    });

    test('returns empty agents array when no active agents', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/agents') as Record<string, unknown>;
      expect(result.agents).toEqual([]);
    });

    test('returns active agents with expected fields', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const tracker = new AgentTracker(store, bus);
      const spawnedAt = Date.now();
      tracker.register({ id: 'a1', type: 'engineer', spawnedAt }, 'sess-1', 'Build feature');

      const ext = makeExtensions({ bus, store, tracker });
      const result = await ext.handle('_goodvibes/agents') as Record<string, unknown>;
      const agents = result.agents as Array<Record<string, unknown>>;

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('a1');
      expect(agents[0].type).toBe('engineer');
      expect(agents[0].task).toBe('Build feature');
      expect(agents[0].sessionId).toBe('sess-1');
      expect(agents[0].status).toBe('spawned');
      expect(typeof agents[0].durationMs).toBe('number');
      expect(agents[0].spawnedAt).toBe(spawnedAt);
    });

    test('excludes completed agents from the list', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const tracker = new AgentTracker(store, bus);
      tracker.register({ id: 'a1', type: 'engineer', spawnedAt: Date.now() }, 'sess-1', 'task');
      tracker.updateStatus('a1', 'running');
      tracker.register({ id: 'a2', type: 'tester', spawnedAt: Date.now() }, 'sess-1', 'task');
      tracker.updateStatus('a2', 'completed');

      const ext = makeExtensions({ bus, store, tracker });
      const result = await ext.handle('_goodvibes/agents') as Record<string, unknown>;
      const agents = result.agents as Array<Record<string, unknown>>;

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('a1');
    });

    test('excludes failed agents from the list', async () => {
      const bus = new EventBus();
      const store = new StateStore();
      const tracker = new AgentTracker(store, bus);
      tracker.register({ id: 'a1', type: 'engineer', spawnedAt: Date.now() }, 'sess-1', 'task');
      tracker.updateStatus('a1', 'failed');

      const ext = makeExtensions({ bus, store, tracker });
      const result = await ext.handle('_goodvibes/agents') as Record<string, unknown>;
      const agents = result.agents as Array<Record<string, unknown>>;
      expect(agents).toHaveLength(0);
    });

    test('_meta includes version field', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/agents') as Record<string, unknown>;
      const meta = result._meta as Record<string, unknown>;
      expect(typeof meta.version).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // _goodvibes/analytics
  // ---------------------------------------------------------------------------

  describe("handle('_goodvibes/analytics')", () => {
    test('returns KB-08 compliant shape: tokenUsage, turnCount, agentCount, duration_ms, _meta', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;

      expect(result).toHaveProperty('tokenUsage');
      expect(result).toHaveProperty('turnCount');
      expect(result).toHaveProperty('agentCount');
      expect(result).toHaveProperty('duration_ms');
      expect(result).toHaveProperty('_meta');
    });

    test('returns zero token data when no analytics engine is registered', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;

      const tokenUsage = result.tokenUsage as Record<string, number>;
      expect(tokenUsage.input).toBe(0);
      expect(tokenUsage.output).toBe(0);
      expect(tokenUsage.total).toBe(0);
      expect(result.turnCount).toBe(0);
      expect(result.agentCount).toBe(0);
      expect(result.duration_ms).toBe(0);
    });

    test('returns analytics data from registered analytics engine', async () => {
      const registry = new Registry();
      const mockEngine = {
        getAnalyticsResponse: (req?: { sessionId?: string }) => ({
          tokenUsage: { input: 2000, output: 3000, total: 5000 },
          turnCount: 12,
          agentCount: 3,
          duration_ms: 45000,
        }),
      };
      registry.register('analytics-engine', mockEngine);

      const ext = makeExtensions({ registry });
      const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;

      const tokenUsage = result.tokenUsage as Record<string, number>;
      expect(tokenUsage.input).toBe(2000);
      expect(tokenUsage.output).toBe(3000);
      expect(tokenUsage.total).toBe(5000);
      expect(result.turnCount).toBe(12);
      expect(result.agentCount).toBe(3);
      expect(result.duration_ms).toBe(45000);
    });

    test('handles analytics engine with minimal response gracefully', async () => {
      const registry = new Registry();
      const mockEngine = {
        getAnalyticsResponse: () => ({
          tokenUsage: { input: 50, output: 50, total: 100 },
          turnCount: 1,
          agentCount: 0,
          duration_ms: 1000,
        }),
      };
      registry.register('analytics-engine', mockEngine);

      const ext = makeExtensions({ registry });
      const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;
      const tokenUsage = result.tokenUsage as Record<string, number>;
      expect(tokenUsage.total).toBe(100);
      expect(result.agentCount).toBe(0);
    });

    test('_meta includes version field', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;
      const meta = result._meta as Record<string, unknown>;
      expect(typeof meta.version).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown method
  // ---------------------------------------------------------------------------

  describe('handle(unknown method)', () => {
    test('returns error with _meta for unknown method', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/nonexistent') as Record<string, unknown>;

      expect(result.error).toBe('unknown_method');
      expect(result).toHaveProperty('_meta');
    });

    test('returns error for empty string method', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('') as Record<string, unknown>;
      expect(result.error).toBe('unknown_method');
    });

    test('_meta version is present on unknown method response', async () => {
      const ext = makeExtensions();
      const result = await ext.handle('_goodvibes/unknown') as Record<string, unknown>;
      const meta = result._meta as Record<string, unknown>;
      expect(typeof meta.version).toBe('string');
    });
  });

  // ---------------------------------------------------------------------------
  // All responses include _meta.version
  // ---------------------------------------------------------------------------

  describe('_meta.version in all responses', () => {
    const methods = [
      '_goodvibes/status',
      '_goodvibes/state',
      '_goodvibes/events',
      '_goodvibes/agents',
      '_goodvibes/analytics',
      '_goodvibes/unknown',
    ] as const;

    for (const method of methods) {
      test(`${method} response includes _meta.version`, async () => {
        const ext = makeExtensions();
        const result = await ext.handle(method) as Record<string, unknown>;
        const meta = result._meta as Record<string, unknown>;
        expect(typeof meta.version).toBe('string');
        expect(meta.version).toBeTruthy();
      });
    }
  });
});
