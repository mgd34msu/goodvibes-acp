import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { DirectiveQueue } from '../../src/extensions/directives/queue.js';
import type { Directive, DirectiveResult } from '../../src/types/directive.js';

function makeDirective(overrides: Partial<Directive> & { id: string }): Directive {
  return {
    action: 'spawn',
    workId: 'work-1',
    priority: 'normal',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('DirectiveQueue', () => {
  let bus: EventBus;
  let queue: DirectiveQueue;

  beforeEach(() => {
    bus = new EventBus();
    queue = new DirectiveQueue(bus);
  });

  // ---------------------------------------------------------------------------
  // enqueue / dequeue
  // ---------------------------------------------------------------------------

  describe('enqueue / dequeue', () => {
    it('enqueues and dequeues a single directive', () => {
      const d = makeDirective({ id: 'd1' });
      queue.enqueue(d);

      const result = queue.dequeue();
      expect(result).toBeDefined();
      expect(result!.id).toBe('d1');
    });

    it('returns undefined when queue is empty', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('emits directive:enqueued event on enqueue', () => {
      const events: unknown[] = [];
      bus.on('directive:enqueued', (ev) => events.push(ev.payload));

      const d = makeDirective({ id: 'd2', action: 'review', priority: 'high' });
      queue.enqueue(d);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ directiveId: 'd2', action: 'review', priority: 'high' });
    });
  });

  // ---------------------------------------------------------------------------
  // Priority ordering
  // ---------------------------------------------------------------------------

  describe('priority ordering', () => {
    it('dequeues critical before high before normal before low', () => {
      queue.enqueue(makeDirective({ id: 'low', priority: 'low' }));
      queue.enqueue(makeDirective({ id: 'normal', priority: 'normal' }));
      queue.enqueue(makeDirective({ id: 'critical', priority: 'critical' }));
      queue.enqueue(makeDirective({ id: 'high', priority: 'high' }));

      expect(queue.dequeue()!.id).toBe('critical');
      expect(queue.dequeue()!.id).toBe('high');
      expect(queue.dequeue()!.id).toBe('normal');
      expect(queue.dequeue()!.id).toBe('low');
    });

    it('preserves FIFO within the same priority', () => {
      queue.enqueue(makeDirective({ id: 'first', priority: 'normal' }));
      queue.enqueue(makeDirective({ id: 'second', priority: 'normal' }));

      expect(queue.dequeue()!.id).toBe('first');
      expect(queue.dequeue()!.id).toBe('second');
    });
  });

  // ---------------------------------------------------------------------------
  // size
  // ---------------------------------------------------------------------------

  describe('size', () => {
    it('returns 0 for an empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('tracks size as items are enqueued and dequeued', () => {
      queue.enqueue(makeDirective({ id: 'sz1' }));
      queue.enqueue(makeDirective({ id: 'sz2' }));
      expect(queue.size()).toBe(2);

      queue.dequeue();
      expect(queue.size()).toBe(1);

      queue.dequeue();
      expect(queue.size()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // pending (non-destructive view)
  // ---------------------------------------------------------------------------

  describe('pending', () => {
    it('returns all directives without removing them', () => {
      queue.enqueue(makeDirective({ id: 'p1' }));
      queue.enqueue(makeDirective({ id: 'p2' }));

      const pending = queue.pending();
      expect(pending).toHaveLength(2);
      expect(queue.size()).toBe(2); // still intact
    });

    it('filters by action', () => {
      queue.enqueue(makeDirective({ id: 'spawn-1', action: 'spawn' }));
      queue.enqueue(makeDirective({ id: 'review-1', action: 'review' }));

      const spawns = queue.pending({ action: 'spawn' });
      expect(spawns).toHaveLength(1);
      expect(spawns[0].id).toBe('spawn-1');
    });

    it('filters by workId', () => {
      queue.enqueue(makeDirective({ id: 'w1', workId: 'work-A' }));
      queue.enqueue(makeDirective({ id: 'w2', workId: 'work-B' }));

      const filtered = queue.pending({ workId: 'work-A' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('w1');
    });

    it('filters by target', () => {
      queue.enqueue(makeDirective({ id: 'tgt-1', target: 'engineer' }));
      queue.enqueue(makeDirective({ id: 'tgt-2', target: 'reviewer' }));

      const filtered = queue.pending({ target: 'engineer' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tgt-1');
    });

    it('filters by minPriority', () => {
      queue.enqueue(makeDirective({ id: 'min-low', priority: 'low' }));
      queue.enqueue(makeDirective({ id: 'min-high', priority: 'high' }));
      queue.enqueue(makeDirective({ id: 'min-critical', priority: 'critical' }));

      const filtered = queue.pending({ minPriority: 'high' });
      const ids = filtered.map((d) => d.id).sort();
      expect(ids).toEqual(['min-critical', 'min-high']);
    });
  });

  // ---------------------------------------------------------------------------
  // drain
  // ---------------------------------------------------------------------------

  describe('drain', () => {
    it('drains all directives (no filter)', () => {
      queue.enqueue(makeDirective({ id: 'dr1' }));
      queue.enqueue(makeDirective({ id: 'dr2' }));

      const drained = queue.drain();
      expect(drained).toHaveLength(2);
      expect(queue.size()).toBe(0);
    });

    it('drains only matching directives with filter', () => {
      queue.enqueue(makeDirective({ id: 'da1', action: 'spawn' }));
      queue.enqueue(makeDirective({ id: 'da2', action: 'review' }));
      queue.enqueue(makeDirective({ id: 'da3', action: 'spawn' }));

      const drained = queue.drain({ action: 'spawn' });
      expect(drained).toHaveLength(2);
      expect(drained.map((d) => d.id).sort()).toEqual(['da1', 'da3']);
      expect(queue.size()).toBe(1); // review directive remains
    });

    it('returns directives in priority order', () => {
      queue.enqueue(makeDirective({ id: 'prio-low', priority: 'low' }));
      queue.enqueue(makeDirective({ id: 'prio-critical', priority: 'critical' }));

      const drained = queue.drain();
      expect(drained[0].id).toBe('prio-critical');
      expect(drained[1].id).toBe('prio-low');
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  describe('clear', () => {
    it('removes all directives', () => {
      queue.enqueue(makeDirective({ id: 'clr1' }));
      queue.enqueue(makeDirective({ id: 'clr2' }));
      queue.clear();

      expect(queue.size()).toBe(0);
    });

    it('emits directive:cleared event', () => {
      const events: unknown[] = [];
      bus.on('directive:cleared', (ev) => events.push(ev.payload));

      queue.enqueue(makeDirective({ id: 'clr3' }));
      queue.clear();

      expect(events).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // process
  // ---------------------------------------------------------------------------

  describe('process', () => {
    it('calls handler for each directive and returns results', async () => {
      queue.enqueue(makeDirective({ id: 'proc-1', priority: 'normal' }));
      queue.enqueue(makeDirective({ id: 'proc-2', priority: 'high' }));

      const processed: string[] = [];
      const results = await queue.process(async (d) => {
        processed.push(d.id);
        return {
          directive: d,
          status: 'processed',
          processedAt: Date.now(),
        } satisfies DirectiveResult;
      });

      // Higher priority processed first
      expect(processed[0]).toBe('proc-2');
      expect(processed[1]).toBe('proc-1');
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'processed')).toBe(true);
    });

    it('captures handler errors as failed results', async () => {
      queue.enqueue(makeDirective({ id: 'err-1' }));

      const results = await queue.process(async () => {
        throw new Error('handler exploded');
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('handler exploded');
    });

    it('emits directive:processed event after each directive', async () => {
      const events: unknown[] = [];
      bus.on('directive:processed', (ev) => events.push(ev.payload));

      queue.enqueue(makeDirective({ id: 'emit-1' }));
      queue.enqueue(makeDirective({ id: 'emit-2' }));

      await queue.process(async (d) => ({
        directive: d,
        status: 'processed',
        processedAt: Date.now(),
      }));

      expect(events).toHaveLength(2);
    });

    it('drains the queue after processing (queue is empty)', async () => {
      queue.enqueue(makeDirective({ id: 'drain-1' }));
      queue.enqueue(makeDirective({ id: 'drain-2' }));

      await queue.process(async (d) => ({
        directive: d,
        status: 'processed',
        processedAt: Date.now(),
      }));

      expect(queue.size()).toBe(0);
    });
  });
});
