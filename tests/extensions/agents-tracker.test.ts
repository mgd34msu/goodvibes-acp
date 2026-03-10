import { describe, it, expect, beforeEach } from 'bun:test';
import { StateStore } from '../../src/core/state-store.ts';
import { EventBus } from '../../src/core/event-bus.ts';
import { AgentTracker } from '../../src/extensions/agents/tracker.ts';
import type { AgentHandle, AgentMetadata } from '../../src/types/agent.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandle(id: string, type = 'engineer'): AgentHandle {
  return { id, type, spawnedAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentTracker (dedicated)', () => {
  let store: StateStore;
  let bus: EventBus;
  let tracker: AgentTracker;

  beforeEach(() => {
    store = new StateStore();
    bus = new EventBus();
    tracker = new AgentTracker(store, bus);
  });

  describe('register', () => {
    it('stores initial status as spawned', () => {
      const handle = makeHandle('t-1');
      tracker.register(handle, 'sess-1', 'task-A');
      expect(tracker.get('t-1')!.status).toBe('spawned');
    });

    it('increments activeCount on register', () => {
      tracker.register(makeHandle('t-2'), 'sess-1', 'task');
      tracker.register(makeHandle('t-3'), 'sess-1', 'task');
      expect(tracker.activeCount()).toBe(2);
    });

    it('emits agent:registered with correct metadata', () => {
      const payloads: unknown[] = [];
      bus.on('agent:registered', (ev) => payloads.push(ev.payload));

      const handle = makeHandle('t-4', 'architect');
      tracker.register(handle, 'sess-A', 'build something');

      expect(payloads).toHaveLength(1);
      const meta = (payloads[0] as { metadata: AgentMetadata }).metadata;
      expect(meta.id).toBe('t-4');
      expect(meta.type).toBe('architect');
      expect(meta.sessionId).toBe('sess-A');
      expect(meta.task).toBe('build something');
    });

    it('preserves spawnedAt from the handle', () => {
      const now = Date.now();
      const handle = { id: 't-5', type: 'tester', spawnedAt: now };
      tracker.register(handle, 'sess-1', 'test it');
      expect(tracker.get('t-5')!.spawnedAt).toBe(now);
    });
  });

  describe('updateStatus', () => {
    it('transitions spawned → running and sets startedAt', () => {
      tracker.register(makeHandle('u-1'), 'sess-1', 't');
      const before = Date.now();
      tracker.updateStatus('u-1', 'running');
      expect(tracker.get('u-1')!.status).toBe('running');
      expect(tracker.get('u-1')!.startedAt).toBeGreaterThanOrEqual(before);
    });

    it('does not overwrite startedAt on second running transition', () => {
      tracker.register(makeHandle('u-2'), 'sess-1', 't');
      tracker.updateStatus('u-2', 'running');
      const first = tracker.get('u-2')!.startedAt;
      tracker.updateStatus('u-2', 'running');
      expect(tracker.get('u-2')!.startedAt).toBe(first);
    });

    it('sets finishedAt on completed without durationMs when startedAt absent', () => {
      // Go directly spawned → completed (skipping running)
      tracker.register(makeHandle('u-3'), 'sess-1', 't');
      tracker.updateStatus('u-3', 'completed');
      const meta = tracker.get('u-3')!;
      expect(meta.finishedAt).toBeDefined();
      // startedAt was never set so durationMs should also be absent
      expect(meta.startedAt).toBeUndefined();
      expect(meta.durationMs).toBeUndefined();
    });

    it('sets finishedAt and durationMs on completed when running first', () => {
      tracker.register(makeHandle('u-4'), 'sess-1', 't');
      tracker.updateStatus('u-4', 'running');
      tracker.updateStatus('u-4', 'completed');
      const meta = tracker.get('u-4')!;
      expect(meta.finishedAt).toBeDefined();
      expect(meta.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('does not overwrite finishedAt on a second terminal transition', () => {
      tracker.register(makeHandle('u-5'), 'sess-1', 't');
      tracker.updateStatus('u-5', 'running');
      tracker.updateStatus('u-5', 'completed');
      const first = tracker.get('u-5')!.finishedAt;
      tracker.updateStatus('u-5', 'completed');
      expect(tracker.get('u-5')!.finishedAt).toBe(first);
    });

    it('decrements activeCount exactly once when agent reaches terminal state', () => {
      tracker.register(makeHandle('u-6'), 'sess-1', 't');
      expect(tracker.activeCount()).toBe(1);
      tracker.updateStatus('u-6', 'running');
      expect(tracker.activeCount()).toBe(1); // still active
      tracker.updateStatus('u-6', 'failed');
      expect(tracker.activeCount()).toBe(0);
    });

    it('activeCount does not go below 0 on redundant terminal transitions', () => {
      tracker.register(makeHandle('u-7'), 'sess-1', 't');
      tracker.updateStatus('u-7', 'completed');
      // Second terminal transition on same agent
      tracker.updateStatus('u-7', 'failed');
      expect(tracker.activeCount()).toBeGreaterThanOrEqual(0);
    });

    it('emits agent:failed for cancelled status', () => {
      const payloads: unknown[] = [];
      bus.on('agent:failed', (ev) => payloads.push(ev.payload));
      tracker.register(makeHandle('u-8'), 'sess-1', 't');
      tracker.updateStatus('u-8', 'cancelled');
      expect(payloads).toHaveLength(1);
    });

    it('emits agent:status-changed with correct from/to values', () => {
      const changes: Array<{ from: string; to: string }> = [];
      bus.on('agent:status-changed', (ev) =>
        changes.push(ev.payload as { from: string; to: string })
      );
      tracker.register(makeHandle('u-9'), 'sess-1', 't');
      tracker.updateStatus('u-9', 'running');
      tracker.updateStatus('u-9', 'completed');
      expect(changes[0]).toMatchObject({ from: 'spawned', to: 'running' });
      expect(changes[1]).toMatchObject({ from: 'running', to: 'completed' });
    });

    it('silently ignores unknown agentId', () => {
      expect(() => tracker.updateStatus('ghost', 'running')).not.toThrow();
    });
  });

  describe('getBySession', () => {
    it('returns agents for requested session only', () => {
      tracker.register(makeHandle('s-1'), 'sess-A', 't');
      tracker.register(makeHandle('s-2'), 'sess-B', 't');
      tracker.register(makeHandle('s-3'), 'sess-A', 't');
      const result = tracker.getBySession('sess-A');
      expect(result.map((m) => m.id).sort()).toEqual(['s-1', 's-3']);
    });

    it('returns empty array when session has no agents', () => {
      expect(tracker.getBySession('nonexistent')).toEqual([]);
    });
  });

  describe('active / activeCount', () => {
    it('active() lists only spawned and running agents', () => {
      tracker.register(makeHandle('a-1'), 'sess-1', 't');
      tracker.register(makeHandle('a-2'), 'sess-1', 't');
      tracker.register(makeHandle('a-3'), 'sess-1', 't');
      tracker.updateStatus('a-2', 'running');
      tracker.updateStatus('a-3', 'completed');
      const active = tracker.active();
      expect(active.map((m) => m.id).sort()).toEqual(['a-1', 'a-2']);
    });

    it('returns 0 when no agents registered', () => {
      expect(tracker.activeCount()).toBe(0);
    });
  });

  describe('remove', () => {
    it('removes agent metadata from store', () => {
      tracker.register(makeHandle('r-1'), 'sess-1', 't');
      tracker.remove('r-1');
      expect(tracker.get('r-1')).toBeUndefined();
    });

    it('does not throw when removing a non-existent agent', () => {
      expect(() => tracker.remove('does-not-exist')).not.toThrow();
    });
  });
});
