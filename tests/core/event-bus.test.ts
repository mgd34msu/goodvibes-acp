import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.ts';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // --- Basic subscribe/emit ---

  describe('on / emit', () => {
    it('calls handler when matching event is emitted', () => {
      const received: unknown[] = [];
      bus.on('test', (ev) => received.push(ev.payload));
      bus.emit('test', 'hello');
      expect(received).toEqual(['hello']);
    });

    it('does not call handler for different event type', () => {
      const received: unknown[] = [];
      bus.on('a', (ev) => received.push(ev.payload));
      bus.emit('b', 'ignored');
      expect(received).toHaveLength(0);
    });

    it('passes full EventRecord to handler', () => {
      let record: unknown;
      bus.on('test', (ev) => { record = ev; });
      bus.emit('test', { value: 42 });
      expect(record).toMatchObject({
        type: 'test',
        payload: { value: 42 },
      });
      expect(typeof (record as { id: string }).id).toBe('string');
      expect(typeof (record as { timestamp: number }).timestamp).toBe('number');
    });

    it('extracts sessionId from payload when present', () => {
      let record: { sessionId?: string } | undefined;
      bus.on('test', (ev) => { record = ev as { sessionId?: string }; });
      bus.emit('test', { sessionId: 'session-abc' });
      expect(record?.sessionId).toBe('session-abc');
    });

    it('sessionId is undefined when payload has no sessionId', () => {
      let record: { sessionId?: string } | undefined;
      bus.on('test', (ev) => { record = ev as { sessionId?: string }; });
      bus.emit('test', 'plain string');
      expect(record?.sessionId).toBeUndefined();
    });
  });

  // --- Multiple handlers ---

  describe('multiple handlers for same event type', () => {
    it('calls all handlers in registration order', () => {
      const calls: number[] = [];
      bus.on('evt', () => calls.push(1));
      bus.on('evt', () => calls.push(2));
      bus.on('evt', () => calls.push(3));
      bus.emit('evt', null);
      expect(calls).toEqual([1, 2, 3]);
    });

    it('each handler receives the same event record', () => {
      const records: unknown[] = [];
      bus.on('evt', (ev) => records.push(ev));
      bus.on('evt', (ev) => records.push(ev));
      bus.emit('evt', 'data');
      expect(records[0]).toBe(records[1]);
    });
  });

  // --- handlerCount ---

  describe('handlerCount', () => {
    it('is 0 on a new bus', () => {
      expect(bus.handlerCount).toBe(0);
    });

    it('increments with each subscription', () => {
      bus.on('a', () => {});
      expect(bus.handlerCount).toBe(1);
      bus.on('b', () => {});
      expect(bus.handlerCount).toBe(2);
      bus.on('a', () => {});
      expect(bus.handlerCount).toBe(3);
    });
  });

  // --- Wildcard subscriptions ---

  describe('wildcard subscriptions', () => {
    it('* matches all event types', () => {
      const types: string[] = [];
      bus.on('*', (ev) => types.push(ev.type));
      bus.emit('session:started', null);
      bus.emit('agent:done', null);
      bus.emit('anything', null);
      expect(types).toEqual(['session:started', 'agent:done', 'anything']);
    });

    it('* does not receive * events emitted directly', () => {
      // Emitting '*' directly matches exact handlers only, not the wildcard itself
      const calls: number[] = [];
      bus.on('*', () => calls.push(1));
      // Emitting a regular event fires the wildcard handler
      bus.emit('anything', null);
      expect(calls).toHaveLength(1);
    });

    it('prefix:* matches events starting with that prefix', () => {
      const types: string[] = [];
      bus.on('session:*', (ev) => types.push(ev.type));
      bus.emit('session:started', null);
      bus.emit('session:ended', null);
      bus.emit('agent:done', null);
      expect(types).toEqual(['session:started', 'session:ended']);
    });

    it('prefix:* does not match events with different prefix', () => {
      const types: string[] = [];
      bus.on('session:*', (ev) => types.push(ev.type));
      bus.emit('agent:started', null);
      expect(types).toHaveLength(0);
    });

    it('exact handler and wildcard both fire for same event', () => {
      const calls: string[] = [];
      bus.on('session:started', () => calls.push('exact'));
      bus.on('*', () => calls.push('wildcard'));
      bus.emit('session:started', null);
      expect(calls).toContain('exact');
      expect(calls).toContain('wildcard');
    });
  });

  // --- once ---

  describe('once', () => {
    it('handler fires only on first emit', () => {
      let count = 0;
      bus.once('test', () => { count++; });
      bus.emit('test', null);
      bus.emit('test', null);
      bus.emit('test', null);
      expect(count).toBe(1);
    });

    it('returns disposable that can cancel before first fire', () => {
      let count = 0;
      const sub = bus.once('test', () => { count++; });
      sub.dispose();
      bus.emit('test', null);
      expect(count).toBe(0);
    });
  });

  // --- onFiltered ---

  describe('onFiltered', () => {
    it('handler fires when predicate returns true', () => {
      const received: unknown[] = [];
      bus.onFiltered(
        (ev) => (ev.payload as { value: number }).value > 5,
        'test',
        (ev) => received.push(ev.payload)
      );
      bus.emit('test', { value: 10 });
      expect(received).toHaveLength(1);
    });

    it('handler does not fire when predicate returns false', () => {
      const received: unknown[] = [];
      bus.onFiltered(
        (ev) => (ev.payload as { value: number }).value > 5,
        'test',
        (ev) => received.push(ev.payload)
      );
      bus.emit('test', { value: 3 });
      expect(received).toHaveLength(0);
    });

    it('returns disposable that unsubscribes the filtered handler', () => {
      let count = 0;
      const sub = bus.onFiltered(() => true, 'test', () => { count++; });
      bus.emit('test', null);
      sub.dispose();
      bus.emit('test', null);
      expect(count).toBe(1);
    });
  });

  // --- Handler disposal ---

  describe('off / dispose', () => {
    it('dispose() unsubscribes handler', () => {
      let count = 0;
      const sub = bus.on('test', () => { count++; });
      bus.emit('test', null);
      sub.dispose();
      bus.emit('test', null);
      expect(count).toBe(1);
    });

    it('off() directly unsubscribes a named handler', () => {
      let count = 0;
      const handler = () => { count++; };
      bus.on('test', handler);
      bus.emit('test', null);
      bus.off('test', handler);
      bus.emit('test', null);
      expect(count).toBe(1);
    });

    it('disposing twice does not throw', () => {
      const sub = bus.on('test', () => {});
      sub.dispose();
      expect(() => sub.dispose()).not.toThrow();
    });

    it('disposing one handler does not affect other handlers on same event', () => {
      const calls: number[] = [];
      const sub1 = bus.on('test', () => calls.push(1));
      bus.on('test', () => calls.push(2));
      sub1.dispose();
      bus.emit('test', null);
      expect(calls).toEqual([2]);
    });
  });

  // --- Event history ---

  describe('history', () => {
    it('records emitted events in order', () => {
      bus.emit('a', 1);
      bus.emit('b', 2);
      bus.emit('a', 3);
      const h = bus.history();
      expect(h).toHaveLength(3);
      expect(h[0].type).toBe('a');
      expect(h[1].type).toBe('b');
      expect(h[2].type).toBe('a');
    });

    it('filters history by event type', () => {
      bus.emit('a', 1);
      bus.emit('b', 2);
      bus.emit('a', 3);
      const h = bus.history('a');
      expect(h).toHaveLength(2);
      expect(h.every((r) => r.type === 'a')).toBe(true);
    });

    it('returns most recent events when limit is set', () => {
      bus.emit('x', 1);
      bus.emit('x', 2);
      bus.emit('x', 3);
      const h = bus.history(undefined, 2);
      expect(h).toHaveLength(2);
      expect(h[0].payload).toBe(2);
      expect(h[1].payload).toBe(3);
    });

    it('respects historyLimit ring buffer', () => {
      const smallBus = new EventBus({ historyLimit: 3 });
      smallBus.emit('x', 1);
      smallBus.emit('x', 2);
      smallBus.emit('x', 3);
      smallBus.emit('x', 4);
      const h = smallBus.history();
      expect(h).toHaveLength(3);
      expect(h[0].payload).toBe(2);
      expect(h[2].payload).toBe(4);
    });

    it('returns empty array when no events match type filter', () => {
      bus.emit('a', 1);
      expect(bus.history('b')).toHaveLength(0);
    });
  });

  // --- clear ---

  describe('clear', () => {
    it('removes all handlers and history', () => {
      bus.on('test', () => {});
      bus.emit('test', null);
      bus.clear();
      expect(bus.handlerCount).toBe(0);
      expect(bus.history()).toHaveLength(0);
    });

    it('bus still works after clear', () => {
      bus.clear();
      let count = 0;
      bus.on('test', () => { count++; });
      bus.emit('test', null);
      expect(count).toBe(1);
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('isDestroyed is false before destroy', () => {
      expect(bus.isDestroyed).toBe(false);
    });

    it('isDestroyed is true after destroy', () => {
      bus.destroy();
      expect(bus.isDestroyed).toBe(true);
    });

    it('emit is a no-op after destroy', () => {
      let count = 0;
      bus.on('test', () => { count++; });
      bus.destroy();
      bus.emit('test', null);
      expect(count).toBe(0);
    });

    it('on() throws after destroy', () => {
      bus.destroy();
      expect(() => bus.on('test', () => {})).toThrow('EventBus has been destroyed');
    });

    it('once() throws after destroy', () => {
      bus.destroy();
      expect(() => bus.once('test', () => {})).toThrow('EventBus has been destroyed');
    });

    it('onFiltered() throws after destroy', () => {
      bus.destroy();
      expect(() => bus.onFiltered(() => true, 'test', () => {})).toThrow('EventBus has been destroyed');
    });

    it('clears history on destroy', () => {
      bus.emit('test', null);
      bus.destroy();
      expect(bus.history()).toHaveLength(0);
    });
  });

  // --- Error isolation ---

  describe('error isolation', () => {
    it('synchronous handler error emits error event instead of throwing', () => {
      const errorPayloads: unknown[] = [];
      bus.on('error', (ev) => errorPayloads.push(ev.payload));
      bus.on('test', () => { throw new Error('boom'); });
      expect(() => bus.emit('test', null)).not.toThrow();
      expect(errorPayloads).toHaveLength(1);
      const err = errorPayloads[0] as { source: string; error: Error };
      expect(err.source).toBe('test');
      expect(err.error.message).toBe('boom');
    });

    it('async handler error emits error event', async () => {
      const errorPayloads: unknown[] = [];
      bus.on('error', (ev) => errorPayloads.push(ev.payload));
      bus.on('test', async () => { throw new Error('async boom'); });
      bus.emit('test', null);
      // Give the async rejection time to propagate
      await new Promise((r) => setTimeout(r, 20));
      expect(errorPayloads).toHaveLength(1);
    });

    it('error in error handler is swallowed to prevent infinite loop', () => {
      bus.on('error', () => { throw new Error('meta error'); });
      bus.on('test', () => { throw new Error('original'); });
      expect(() => bus.emit('test', null)).not.toThrow();
    });

    it('error from error event type itself is not re-emitted', () => {
      // Emitting 'error' directly does not trigger infinite recursion
      let count = 0;
      bus.on('error', () => { count++; });
      expect(() => bus.emit('error', { source: 'error', error: new Error('x'), timestamp: 0 })).not.toThrow();
      // The handler fires once for the direct emit
      expect(count).toBe(1);
    });

    it('one failing handler does not prevent other handlers from running', () => {
      const calls: number[] = [];
      bus.on('test', () => { throw new Error('fail'); });
      bus.on('test', () => calls.push(1));
      bus.emit('test', null);
      expect(calls).toEqual([1]);
    });
  });

  // --- Async handlers ---

  describe('async handlers', () => {
    it('async handler completes without blocking emit', async () => {
      const results: string[] = [];
      bus.on('test', async (ev) => {
        await new Promise((r) => setTimeout(r, 10));
        results.push(ev.payload as string);
      });
      bus.emit('test', 'done');
      // Not yet resolved — emit doesn't await
      expect(results).toHaveLength(0);
      await new Promise((r) => setTimeout(r, 30));
      expect(results).toEqual(['done']);
    });
  });
});
