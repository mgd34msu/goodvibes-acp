import { describe, test, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.ts';
import { EventRecorder } from '../../src/extensions/acp/event-recorder.ts';

describe('EventRecorder', () => {
  let bus: EventBus;
  let recorder: EventRecorder;

  beforeEach(() => {
    bus = new EventBus();
    recorder = new EventRecorder(bus);
  });

  // ---------------------------------------------------------------------------
  // register / unregister
  // ---------------------------------------------------------------------------

  describe('register', () => {
    test('subscribes to events on the bus', () => {
      recorder.register();
      bus.emit('test:event', { value: 1 });

      const events = recorder.query();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test:event');
    });

    test('calling register twice is a no-op (idempotent)', () => {
      recorder.register();
      recorder.register();

      bus.emit('test:event', { value: 1 });

      // Should only record once, not twice
      const events = recorder.query();
      expect(events).toHaveLength(1);
    });

    test('does not record events before register is called', () => {
      bus.emit('test:event', { value: 1 });
      recorder.register();

      const events = recorder.query();
      expect(events).toHaveLength(0);
    });
  });

  describe('unregister', () => {
    test('stops recording events after unregister', () => {
      recorder.register();
      bus.emit('before:unregister', {});

      recorder.unregister();
      bus.emit('after:unregister', {});

      const events = recorder.query();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('before:unregister');
    });

    test('calling unregister before register is a no-op', () => {
      // Should not throw
      recorder.unregister();
      recorder.unregister();
    });

    test('calling unregister twice is a no-op', () => {
      recorder.register();
      recorder.unregister();
      recorder.unregister(); // second call — should not throw

      bus.emit('after:double-unregister', {});
      expect(recorder.query()).toHaveLength(0);
    });

    test('can re-register after unregister', () => {
      recorder.register();
      bus.emit('first', {});
      recorder.unregister();

      recorder.register();
      bus.emit('second', {});

      const events = recorder.query();
      expect(events).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Recorded event shape
  // ---------------------------------------------------------------------------

  describe('recorded event shape', () => {
    test('records event type', () => {
      recorder.register();
      bus.emit('my:event', {});

      const events = recorder.query();
      expect(events[0].type).toBe('my:event');
    });

    test('records event timestamp', () => {
      const before = Date.now();
      recorder.register();
      bus.emit('ts:event', {});
      const after = Date.now();

      const events = recorder.query();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });

    test('records event data as the payload', () => {
      recorder.register();
      bus.emit('data:event', { key: 'value', num: 42 });

      const events = recorder.query();
      expect(events[0].data).toEqual({ key: 'value', num: 42 });
    });

    test('records sessionId when present in event payload', () => {
      recorder.register();
      // sessionId is extracted from payload.sessionId by EventBus
      bus.emit('session:event', { sessionId: 'sess-abc', info: 'test' });

      const events = recorder.query();
      expect(events[0].sessionId).toBe('sess-abc');
    });

    test('omits sessionId when not present in event payload', () => {
      recorder.register();
      bus.emit('no-session:event', { data: 'no-sid' });

      const events = recorder.query();
      expect(events[0].sessionId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // query — no filter
  // ---------------------------------------------------------------------------

  describe('query with no filter', () => {
    test('returns empty array when no events recorded', () => {
      recorder.register();
      expect(recorder.query()).toEqual([]);
    });

    test('returns all recorded events', () => {
      recorder.register();
      bus.emit('event:1', {});
      bus.emit('event:2', {});
      bus.emit('event:3', {});

      expect(recorder.query()).toHaveLength(3);
    });

    test('returns events newest-first', () => {
      recorder.register();
      bus.emit('event:a', { order: 1 });
      bus.emit('event:b', { order: 2 });
      bus.emit('event:c', { order: 3 });

      const events = recorder.query();
      expect(events[0].type).toBe('event:c');
      expect(events[1].type).toBe('event:b');
      expect(events[2].type).toBe('event:a');
    });
  });

  // ---------------------------------------------------------------------------
  // query — filter by type
  // ---------------------------------------------------------------------------

  describe('query with type filter', () => {
    test('filters events by exact type', () => {
      recorder.register();
      bus.emit('session:created', { id: 's1' });
      bus.emit('agent:started', { id: 'a1' });
      bus.emit('session:created', { id: 's2' });

      const events = recorder.query({ type: 'session:created' });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === 'session:created')).toBe(true);
    });

    test('returns empty array when no events match the type', () => {
      recorder.register();
      bus.emit('other:event', {});

      expect(recorder.query({ type: 'no:match' })).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // query — filter by sessionId
  // ---------------------------------------------------------------------------

  describe('query with sessionId filter', () => {
    test('filters events by sessionId', () => {
      recorder.register();
      // sessionId comes from payload.sessionId
      bus.emit('event:a', { sessionId: 'sess-1' });
      bus.emit('event:b', { sessionId: 'sess-2' });
      bus.emit('event:c', { sessionId: 'sess-1' });

      const events = recorder.query({ sessionId: 'sess-1' });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.sessionId === 'sess-1')).toBe(true);
    });

    test('returns empty array when no events match the sessionId', () => {
      recorder.register();
      bus.emit('event', { sessionId: 'sess-other' });

      expect(recorder.query({ sessionId: 'sess-none' })).toEqual([]);
    });

    test('events without sessionId are excluded when filtering by sessionId', () => {
      recorder.register();
      bus.emit('no-session', { data: 'no-sid' }); // no sessionId in payload
      bus.emit('has-session', { sessionId: 'sess-X' });

      const events = recorder.query({ sessionId: 'sess-X' });
      expect(events).toHaveLength(1);
      expect(events[0].sessionId).toBe('sess-X');
    });
  });

  // ---------------------------------------------------------------------------
  // query — limit
  // ---------------------------------------------------------------------------

  describe('query with limit', () => {
    test('respects limit and returns most recent events', () => {
      recorder.register();
      for (let i = 0; i < 10; i++) {
        bus.emit(`event:${i}`, { i });
      }

      const events = recorder.query({ limit: 3 });
      expect(events).toHaveLength(3);
      // Most recent first
      expect(events[0].type).toBe('event:9');
      expect(events[1].type).toBe('event:8');
      expect(events[2].type).toBe('event:7');
    });

    test('limit larger than event count returns all events', () => {
      recorder.register();
      bus.emit('event:a', {});
      bus.emit('event:b', {});

      const events = recorder.query({ limit: 100 });
      expect(events).toHaveLength(2);
    });

    test('limit of 0 returns all events (non-positive limit is ignored)', () => {
      recorder.register();
      bus.emit('event:a', {});
      bus.emit('event:b', {});

      // limit <= 0 is ignored per implementation (filter.limit > 0 check)
      const events = recorder.query({ limit: 0 });
      expect(events).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Combined filters
  // ---------------------------------------------------------------------------

  describe('combined filters', () => {
    test('type + limit filters work together', () => {
      recorder.register();
      for (let i = 0; i < 5; i++) {
        bus.emit('target:event', { i });
        bus.emit('other:event', { i });
      }

      const events = recorder.query({ type: 'target:event', limit: 2 });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === 'target:event')).toBe(true);
    });

    test('sessionId + type filters work together', () => {
      recorder.register();
      bus.emit('session:created', { sessionId: 'sess-1' });
      bus.emit('session:created', { sessionId: 'sess-2' });
      bus.emit('agent:started', { sessionId: 'sess-1' });

      const events = recorder.query({ type: 'session:created', sessionId: 'sess-1' });
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:created');
      expect(events[0].sessionId).toBe('sess-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Circular buffer
  // ---------------------------------------------------------------------------

  describe('circular buffer', () => {
    test('evicts oldest event when max capacity is exceeded', () => {
      // Use a small buffer so we can test eviction easily
      const smallRecorder = new EventRecorder(bus, 3);
      smallRecorder.register();

      bus.emit('event:1', { order: 1 });
      bus.emit('event:2', { order: 2 });
      bus.emit('event:3', { order: 3 });
      // Buffer full — next emit should evict event:1
      bus.emit('event:4', { order: 4 });

      // Total is still 3
      const events = smallRecorder.query();
      expect(events).toHaveLength(3);

      // event:1 should have been evicted
      const types = events.map((e) => e.type);
      expect(types).not.toContain('event:1');
      expect(types).toContain('event:4');
    });

    test('continues evicting when multiple events overflow', () => {
      const smallRecorder = new EventRecorder(bus, 3);
      smallRecorder.register();

      for (let i = 1; i <= 6; i++) {
        bus.emit(`event:${i}`, { i });
      }

      const events = smallRecorder.query();
      expect(events).toHaveLength(3);

      // Should contain only the last 3 events (newest-first)
      expect(events[0].type).toBe('event:6');
      expect(events[1].type).toBe('event:5');
      expect(events[2].type).toBe('event:4');
    });

    test('default max is 1000 events', () => {
      // Emit exactly 1000 events
      recorder.register();
      for (let i = 0; i < 1000; i++) {
        bus.emit('bulk:event', { i });
      }
      expect(recorder.query().length).toBe(1000);

      // 1001st event should evict the oldest
      bus.emit('overflow:event', {});
      const events = recorder.query();
      expect(events).toHaveLength(1000);
      expect(events[0].type).toBe('overflow:event');
    });
  });

  // ---------------------------------------------------------------------------
  // query does not mutate internal state
  // ---------------------------------------------------------------------------

  describe('query isolation', () => {
    test('query returns a copy — mutations do not affect internal state', () => {
      recorder.register();
      bus.emit('event:a', {});

      const first = recorder.query();
      first.push({ type: 'injected', timestamp: 0, data: {} });

      const second = recorder.query();
      expect(second).toHaveLength(1);
    });
  });
});
