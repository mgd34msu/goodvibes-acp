import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentEventBridge } from '../../src/extensions/acp/agent-event-bridge.js';
import { EventBus } from '../../src/core/event-bus.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type { AgentTracker } from '../../src/extensions/agents/tracker.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConn(): { conn: AgentSideConnection; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const conn = {
    sessionUpdate: async (params: Record<string, unknown>) => {
      calls.push(params);
    },
  } as unknown as AgentSideConnection;
  return { conn, calls };
}

function makeTracker(sessionIdMap: Record<string, string> = {}): AgentTracker {
  return {
    get: (agentId: string) => {
      const sessionId = sessionIdMap[agentId];
      if (!sessionId) return undefined;
      return { id: agentId, sessionId, type: 'engineer', task: 'test task', status: 'running', spawnedAt: Date.now() };
    },
  } as unknown as AgentTracker;
}

function makeRegisteredPayload(overrides: Record<string, unknown> = {}) {
  return {
    metadata: {
      id: 'agent-1',
      type: 'engineer',
      sessionId: 'sess-1',
      task: 'Implement feature X',
      status: 'spawned',
      spawnedAt: Date.now(),
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// AgentEventBridge
// ---------------------------------------------------------------------------

describe('AgentEventBridge', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // -------------------------------------------------------------------------
  // agent:registered
  // -------------------------------------------------------------------------

  describe('agent:registered event', () => {
    it('emits tool_call with correct toolCallId', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:registered', makeRegisteredPayload());
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.sessionUpdate).toBe('tool_call');
      expect(update.toolCallId).toBe('goodvibes_agent_agent-1');
    });

    it('emits tool_call with correct title', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:registered', makeRegisteredPayload());
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.title).toBe('engineer: Implement feature X');
    });

    it('emits tool_call with pending status', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:registered', makeRegisteredPayload());
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('pending');
    });

    it('threads correct sessionId through to sessionUpdate', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:registered', makeRegisteredPayload());
      await new Promise((r) => setTimeout(r, 0));

      expect((calls[0] as { sessionId: string }).sessionId).toBe('sess-1');
    });

    it('includes _goodvibes/agentId and _goodvibes/agentType in _meta', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:registered', makeRegisteredPayload());
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const meta = update._meta as Record<string, unknown>;
      expect(meta['_goodvibes/agentId']).toBe('agent-1');
      expect(meta['_goodvibes/agentType']).toBe('engineer');
    });
  });

  // -------------------------------------------------------------------------
  // agent:status-changed
  // -------------------------------------------------------------------------

  describe('agent:status-changed event', () => {
    it('emits tool_call_update with in_progress status when to=running', async () => {
      const { conn, calls } = makeConn();
      const tracker = makeTracker({ 'agent-1': 'sess-1' });
      const bridge = new AgentEventBridge(conn, bus, tracker);
      bridge.register();

      bus.emit('agent:status-changed', { agentId: 'agent-1', from: 'spawned', to: 'running' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.sessionUpdate).toBe('tool_call_update');
      expect(update.toolCallId).toBe('goodvibes_agent_agent-1');
      expect(update.status).toBe('in_progress');
    });

    it('emits tool_call_update with completed status when to=completed', async () => {
      const { conn, calls } = makeConn();
      const tracker = makeTracker({ 'agent-1': 'sess-1' });
      const bridge = new AgentEventBridge(conn, bus, tracker);
      bridge.register();

      bus.emit('agent:status-changed', { agentId: 'agent-1', from: 'running', to: 'completed' });
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('completed');
    });

    it('emits tool_call_update with failed status when to=failed', async () => {
      const { conn, calls } = makeConn();
      const tracker = makeTracker({ 'agent-1': 'sess-1' });
      const bridge = new AgentEventBridge(conn, bus, tracker);
      bridge.register();

      bus.emit('agent:status-changed', { agentId: 'agent-1', from: 'running', to: 'failed' });
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('failed');
    });

    it('emits tool_call_update with failed status when to=cancelled', async () => {
      const { conn, calls } = makeConn();
      const tracker = makeTracker({ 'agent-1': 'sess-1' });
      const bridge = new AgentEventBridge(conn, bus, tracker);
      bridge.register();

      bus.emit('agent:status-changed', { agentId: 'agent-1', from: 'running', to: 'cancelled' });
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('failed');
    });
  });

  // -------------------------------------------------------------------------
  // Events without sessionId are ignored
  // -------------------------------------------------------------------------

  describe('events without sessionId', () => {
    it('ignores agent:registered events where metadata has no sessionId', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:registered', {
        metadata: { id: 'agent-2', type: 'engineer', sessionId: undefined, task: 'task', status: 'spawned', spawnedAt: Date.now() },
      });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });

    it('ignores agent:status-changed events when tracker has no sessionId for agent', async () => {
      const { conn, calls } = makeConn();
      // tracker returns undefined for unknown agent
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      bus.emit('agent:status-changed', { agentId: 'unknown-agent', from: 'spawned', to: 'running' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // unregister()
  // -------------------------------------------------------------------------

  describe('unregister()', () => {
    it('stops forwarding events after unregister()', async () => {
      const { conn, calls } = makeConn();
      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();
      bridge.unregister();

      bus.emit('agent:registered', makeRegisteredPayload());
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });

    it('stops forwarding status-changed events after unregister()', async () => {
      const { conn, calls } = makeConn();
      const tracker = makeTracker({ 'agent-1': 'sess-1' });
      const bridge = new AgentEventBridge(conn, bus, tracker);
      bridge.register();
      bridge.unregister();

      bus.emit('agent:status-changed', { agentId: 'agent-1', from: 'spawned', to: 'running' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error swallowing
  // -------------------------------------------------------------------------

  describe('conn.sessionUpdate errors', () => {
    it('does not propagate when conn.sessionUpdate rejects', async () => {
      const conn = {
        sessionUpdate: async () => {
          throw new Error('ACP connection error');
        },
      } as unknown as AgentSideConnection;

      const bridge = new AgentEventBridge(conn, bus, makeTracker());
      bridge.register();

      // Should not throw
      expect(() => {
        bus.emit('agent:registered', makeRegisteredPayload());
      }).not.toThrow();

      // Allow microtasks to settle
      await new Promise((r) => setTimeout(r, 10));
      // No unhandled rejection — test passes if we reach here
    });
  });
});
