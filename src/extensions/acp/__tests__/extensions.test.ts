/**
 * Tests for GoodVibesExtensions._analytics() — ISS-032
 * Verifies the handler returns KB-08 compliant GoodVibesAnalyticsResponse wire format.
 */
import { describe, it, expect } from 'bun:test';
import { GoodVibesExtensions } from '../extensions.js';
import { EventBus } from '../../../core/event-bus.js';
import { StateStore } from '../../../core/state-store.js';
import { Registry } from '../../../core/registry.js';
import { HealthCheck } from '../../lifecycle/health.js';
import { AgentTracker } from '../../agents/tracker.js';
import { EventRecorder } from '../event-recorder.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExtensions(analyticsEngine?: unknown): GoodVibesExtensions {
  const eventBus = new EventBus();
  const stateStore = new StateStore();
  const registry = new Registry();
  if (analyticsEngine !== undefined) {
    registry.register('analytics-engine', analyticsEngine);
  }
  const healthCheck = new HealthCheck(eventBus);
  const agentTracker = new AgentTracker(stateStore, eventBus);
  const eventRecorder = new EventRecorder(eventBus, 100);
  return new GoodVibesExtensions(
    eventBus,
    stateStore,
    registry,
    healthCheck,
    agentTracker,
    eventRecorder,
  );
}

// ---------------------------------------------------------------------------
// Tests — no analytics engine registered
// ---------------------------------------------------------------------------

describe('GoodVibesExtensions._analytics — no engine registered', () => {
  it('returns KB-08 zero-value shape with _meta', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;

    expect(result).toHaveProperty('tokenUsage');
    const usage = result['tokenUsage'] as Record<string, number>;
    expect(usage.input).toBe(0);
    expect(usage.output).toBe(0);
    expect(usage.total).toBe(0);
    expect(result['turnCount']).toBe(0);
    expect(result['agentCount']).toBe(0);
    expect(result['duration_ms']).toBe(0);
    expect(result).toHaveProperty('_meta');
    const meta = result['_meta'] as Record<string, unknown>;
    expect(meta['version']).toBe('0.1.0');
  });

  it('does NOT include legacy fields (totalTokensUsed, activeBudgets, topTools)', async () => {
    const ext = makeExtensions();
    const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;
    expect(result).not.toHaveProperty('totalTokensUsed');
    expect(result).not.toHaveProperty('activeBudgets');
    expect(result).not.toHaveProperty('topTools');
  });
});

// ---------------------------------------------------------------------------
// Tests — analytics engine registered
// ---------------------------------------------------------------------------

describe('GoodVibesExtensions._analytics — engine registered', () => {
  const mockResponse = {
    tokenUsage: { input: 100, output: 200, total: 300 },
    turnCount: 5,
    agentCount: 2,
    duration_ms: 4200,
  };

  const mockEngine = {
    getAnalyticsResponse: (_req?: unknown) => mockResponse,
  };

  it('returns KB-08 response shape from getAnalyticsResponse()', async () => {
    const ext = makeExtensions(mockEngine);
    const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;

    const usage = result['tokenUsage'] as Record<string, number>;
    expect(usage.input).toBe(100);
    expect(usage.output).toBe(200);
    expect(usage.total).toBe(300);
    expect(result['turnCount']).toBe(5);
    expect(result['agentCount']).toBe(2);
    expect(result['duration_ms']).toBe(4200);
  });

  it('includes _meta in the response', async () => {
    const ext = makeExtensions(mockEngine);
    const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;
    expect(result).toHaveProperty('_meta');
    const meta = result['_meta'] as Record<string, unknown>;
    expect(meta['version']).toBe('0.1.0');
  });

  it('propagates _meta from request params', async () => {
    const ext = makeExtensions(mockEngine);
    const params = { _meta: { requestId: 'req-123' } };
    const result = await ext.handle('_goodvibes/analytics', params) as Record<string, unknown>;
    const meta = result['_meta'] as Record<string, unknown>;
    expect(meta['requestId']).toBe('req-123');
    expect(meta['version']).toBe('0.1.0');
  });

  it('does NOT include legacy fields', async () => {
    const ext = makeExtensions(mockEngine);
    const result = await ext.handle('_goodvibes/analytics') as Record<string, unknown>;
    expect(result).not.toHaveProperty('totalTokensUsed');
    expect(result).not.toHaveProperty('activeBudgets');
    expect(result).not.toHaveProperty('topTools');
  });

  it('passes sessionId to getAnalyticsResponse when provided in params', async () => {
    let capturedRequest: unknown;
    const capturingEngine = {
      getAnalyticsResponse: (req?: unknown) => {
        capturedRequest = req;
        return mockResponse;
      },
    };

    const ext = makeExtensions(capturingEngine);
    await ext.handle('_goodvibes/analytics', { sessionId: 'sess-abc' });
    expect((capturedRequest as Record<string, unknown>)['sessionId']).toBe('sess-abc');
  });
});
