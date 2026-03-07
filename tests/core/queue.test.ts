import { describe, it, expect, beforeEach } from 'bun:test';
import { Queue } from '../../src/core/queue.ts';

describe('Queue', () => {
  let queue: Queue<string>;

  beforeEach(() => {
    queue = new Queue<string>();
  });

  // --- FIFO ordering ---

  describe('FIFO ordering (same priority)', () => {
    it('dequeues items in insertion order', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.enqueue('c');
      expect(queue.dequeue()).toBe('a');
      expect(queue.dequeue()).toBe('b');
      expect(queue.dequeue()).toBe('c');
    });

    it('returns undefined when empty', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('dequeue after all items removed returns undefined', () => {
      queue.enqueue('x');
      queue.dequeue();
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  // --- Priority support ---

  describe('priority support', () => {
    it('higher priority item is dequeued before lower priority', () => {
      queue.enqueue('low', 0);
      queue.enqueue('high', 10);
      expect(queue.dequeue()).toBe('high');
      expect(queue.dequeue()).toBe('low');
    });

    it('same priority maintains FIFO order', () => {
      queue.enqueue('first', 5);
      queue.enqueue('second', 5);
      queue.enqueue('third', 5);
      expect(queue.dequeue()).toBe('first');
      expect(queue.dequeue()).toBe('second');
      expect(queue.dequeue()).toBe('third');
    });

    it('mixed priorities: ordering is strictly by priority desc, then FIFO', () => {
      queue.enqueue('b', 1);
      queue.enqueue('a', 5);
      queue.enqueue('c', 1);
      queue.enqueue('d', 10);
      expect(queue.dequeue()).toBe('d');
      expect(queue.dequeue()).toBe('a');
      expect(queue.dequeue()).toBe('b');
      expect(queue.dequeue()).toBe('c');
    });

    it('negative priority dequeues last', () => {
      queue.enqueue('normal', 0);
      queue.enqueue('low', -5);
      expect(queue.dequeue()).toBe('normal');
      expect(queue.dequeue()).toBe('low');
    });
  });

  // --- peek ---

  describe('peek', () => {
    it('returns next item without removing it', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      expect(queue.peek()).toBe('a');
      expect(queue.size()).toBe(2);
    });

    it('returns undefined on empty queue', () => {
      expect(queue.peek()).toBeUndefined();
    });

    it('peek reflects priority ordering', () => {
      queue.enqueue('low', 0);
      queue.enqueue('high', 10);
      expect(queue.peek()).toBe('high');
    });
  });

  // --- size / isEmpty ---

  describe('size / isEmpty', () => {
    it('size is 0 on empty queue', () => {
      expect(queue.size()).toBe(0);
    });

    it('isEmpty is true on empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('size increments on enqueue', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      expect(queue.size()).toBe(2);
    });

    it('isEmpty is false after enqueue', () => {
      queue.enqueue('a');
      expect(queue.isEmpty()).toBe(false);
    });

    it('size decrements on dequeue', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.dequeue();
      expect(queue.size()).toBe(1);
    });
  });

  // --- drain ---

  describe('drain', () => {
    it('returns all items in priority order', () => {
      queue.enqueue('b', 0);
      queue.enqueue('a', 10);
      queue.enqueue('c', 0);
      const items = queue.drain();
      expect(items).toEqual(['a', 'b', 'c']);
    });

    it('queue is empty after drain', () => {
      queue.enqueue('x');
      queue.drain();
      expect(queue.isEmpty()).toBe(true);
    });

    it('drain on empty queue returns empty array', () => {
      expect(queue.drain()).toEqual([]);
    });
  });

  // --- filter ---

  describe('filter', () => {
    it('returns items matching predicate without removing them', () => {
      queue.enqueue('apple');
      queue.enqueue('banana');
      queue.enqueue('apricot');
      const result = queue.filter((s) => s.startsWith('a'));
      expect(result.sort()).toEqual(['apple', 'apricot']);
      expect(queue.size()).toBe(3);
    });

    it('returns empty array when no items match', () => {
      queue.enqueue('hello');
      expect(queue.filter((s) => s.startsWith('z'))).toEqual([]);
    });
  });

  // --- remove ---

  describe('remove', () => {
    it('removes and returns items matching predicate', () => {
      queue.enqueue('apple');
      queue.enqueue('banana');
      queue.enqueue('apricot');
      const removed = queue.remove((s) => s.startsWith('a'));
      expect(removed.sort()).toEqual(['apple', 'apricot']);
      expect(queue.size()).toBe(1);
      expect(queue.peek()).toBe('banana');
    });

    it('returns empty array when nothing matches', () => {
      queue.enqueue('hello');
      const removed = queue.remove((s) => s.startsWith('z'));
      expect(removed).toEqual([]);
      expect(queue.size()).toBe(1);
    });

    it('can remove all items', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.remove(() => true);
      expect(queue.isEmpty()).toBe(true);
    });

    it('remaining items maintain priority ordering after remove', () => {
      queue.enqueue('low', 0);
      queue.enqueue('target', 5);
      queue.enqueue('high', 10);
      queue.remove((s) => s === 'target');
      expect(queue.dequeue()).toBe('high');
      expect(queue.dequeue()).toBe('low');
    });
  });

  // --- clear ---

  describe('clear', () => {
    it('empties the queue', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.clear();
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('queue is usable after clear', () => {
      queue.enqueue('a');
      queue.clear();
      queue.enqueue('b');
      expect(queue.dequeue()).toBe('b');
    });
  });

  // --- serialize / restore ---

  describe('serialize / restore', () => {
    it('serialize returns $schema, entries, timestamp', () => {
      queue.enqueue('x', 5);
      const data = queue.serialize();
      expect(data.$schema).toBe('1.0.0');
      expect(Array.isArray(data.entries)).toBe(true);
      expect(typeof data.timestamp).toBe('string');
    });

    it('serialize captures items with priorities', () => {
      queue.enqueue('a', 0);
      queue.enqueue('b', 10);
      const data = queue.serialize();
      // Entries in serialized order (priority-sorted)
      expect(data.entries).toHaveLength(2);
      const priorities = data.entries.map((e) => e.priority);
      expect(priorities[0]).toBe(10); // highest first
    });

    it('restore creates queue with same items in same order', () => {
      queue.enqueue('low', 0);
      queue.enqueue('high', 10);
      const data = queue.serialize();
      const restored = Queue.restore(data);
      expect(restored.dequeue()).toBe('high');
      expect(restored.dequeue()).toBe('low');
    });

    it('round-trip preserves all items', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.enqueue('c');
      const restored = Queue.restore(queue.serialize());
      expect(restored.size()).toBe(3);
      expect(restored.drain()).toEqual(['a', 'b', 'c']);
    });

    it('restored queue is independent from original', () => {
      queue.enqueue('x');
      const restored = Queue.restore(queue.serialize());
      queue.clear();
      expect(restored.size()).toBe(1);
    });
  });

  // --- typed queue ---

  describe('typed queue (objects)', () => {
    it('stores and retrieves typed objects', () => {
      const objQueue = new Queue<{ id: string; value: number }>();
      objQueue.enqueue({ id: 'task-1', value: 10 });
      objQueue.enqueue({ id: 'task-2', value: 20 });
      expect(objQueue.dequeue()).toEqual({ id: 'task-1', value: 10 });
    });

    it('filter works on object properties', () => {
      const objQueue = new Queue<{ id: string; priority: number }>();
      objQueue.enqueue({ id: 'a', priority: 1 });
      objQueue.enqueue({ id: 'b', priority: 5 });
      objQueue.enqueue({ id: 'c', priority: 1 });
      const high = objQueue.filter((item) => item.priority > 1);
      expect(high).toHaveLength(1);
      expect(high[0].id).toBe('b');
    });
  });
});
