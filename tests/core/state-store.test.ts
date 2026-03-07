import { describe, it, expect, beforeEach } from 'bun:test';
import { StateStore } from '../../src/core/state-store.ts';
import type { StateChangeEvent } from '../../src/core/state-store.ts';

describe('StateStore', () => {
  let store: StateStore;

  beforeEach(() => {
    store = new StateStore();
  });

  // --- get / set ---

  describe('get / set', () => {
    it('returns undefined for unknown key', () => {
      expect(store.get('ns', 'missing')).toBeUndefined();
    });

    it('returns undefined for unknown namespace', () => {
      expect(store.get('nonexistent', 'key')).toBeUndefined();
    });

    it('stores and retrieves a value', () => {
      store.set('ns', 'key', 'value');
      expect(store.get<string>('ns', 'key')).toBe('value');
    });

    it('stores objects by reference (not cloned)', () => {
      const obj = { a: 1 };
      store.set('ns', 'obj', obj);
      expect(store.get('ns', 'obj')).toBe(obj);
    });

    it('overwrites existing value', () => {
      store.set('ns', 'key', 'first');
      store.set('ns', 'key', 'second');
      expect(store.get<string>('ns', 'key')).toBe('second');
    });

    it('stores numbers, booleans, null', () => {
      store.set('ns', 'num', 42);
      store.set('ns', 'bool', false);
      store.set('ns', 'nul', null);
      expect(store.get('ns', 'num')).toBe(42);
      expect(store.get('ns', 'bool')).toBe(false);
      expect(store.get('ns', 'nul')).toBeNull();
    });
  });

  // --- has ---

  describe('has', () => {
    it('returns false for missing key', () => {
      expect(store.has('ns', 'missing')).toBe(false);
    });

    it('returns true after set', () => {
      store.set('ns', 'key', 'val');
      expect(store.has('ns', 'key')).toBe(true);
    });

    it('returns false after delete', () => {
      store.set('ns', 'key', 'val');
      store.delete('ns', 'key');
      expect(store.has('ns', 'key')).toBe(false);
    });
  });

  // --- delete ---

  describe('delete', () => {
    it('returns false when key does not exist', () => {
      expect(store.delete('ns', 'missing')).toBe(false);
    });

    it('returns false when namespace does not exist', () => {
      expect(store.delete('nonexistent', 'key')).toBe(false);
    });

    it('returns true and removes the key', () => {
      store.set('ns', 'key', 'val');
      const result = store.delete('ns', 'key');
      expect(result).toBe(true);
      expect(store.get('ns', 'key')).toBeUndefined();
    });
  });

  // --- Namespace isolation ---

  describe('namespace isolation', () => {
    it('same key in different namespaces stores independent values', () => {
      store.set('ns1', 'key', 'a');
      store.set('ns2', 'key', 'b');
      expect(store.get<string>('ns1', 'key')).toBe('a');
      expect(store.get<string>('ns2', 'key')).toBe('b');
    });

    it('deleting from one namespace does not affect another', () => {
      store.set('ns1', 'key', 'a');
      store.set('ns2', 'key', 'b');
      store.delete('ns1', 'key');
      expect(store.get<string>('ns2', 'key')).toBe('b');
    });
  });

  // --- keys ---

  describe('keys', () => {
    it('returns empty array for unknown namespace', () => {
      expect(store.keys('nonexistent')).toEqual([]);
    });

    it('returns all keys in namespace', () => {
      store.set('ns', 'a', 1);
      store.set('ns', 'b', 2);
      store.set('ns', 'c', 3);
      const keys = store.keys('ns');
      expect(keys.sort()).toEqual(['a', 'b', 'c']);
    });

    it('deleted keys are not returned', () => {
      store.set('ns', 'a', 1);
      store.set('ns', 'b', 2);
      store.delete('ns', 'a');
      expect(store.keys('ns')).toEqual(['b']);
    });
  });

  // --- namespaces ---

  describe('namespaces', () => {
    it('returns empty array on fresh store', () => {
      expect(store.namespaces()).toEqual([]);
    });

    it('lists all registered namespaces', () => {
      store.set('session', 'x', 1);
      store.set('runtime', 'y', 2);
      const ns = store.namespaces();
      expect(ns.sort()).toEqual(['runtime', 'session']);
    });
  });

  // --- onChange callbacks ---

  describe('onChange', () => {
    it('fires on set with correct event data', () => {
      const events: StateChangeEvent[] = [];
      store.onChange((ev) => events.push(ev));
      store.set('ns', 'key', 'val');
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        namespace: 'ns',
        key: 'key',
        oldValue: undefined,
        newValue: 'val',
      });
    });

    it('fires on set with correct oldValue for existing key', () => {
      const events: StateChangeEvent[] = [];
      store.set('ns', 'key', 'old');
      store.onChange((ev) => events.push(ev));
      store.set('ns', 'key', 'new');
      expect(events[0].oldValue).toBe('old');
      expect(events[0].newValue).toBe('new');
    });

    it('fires on delete with newValue undefined', () => {
      store.set('ns', 'key', 'val');
      const events: StateChangeEvent[] = [];
      store.onChange((ev) => events.push(ev));
      store.delete('ns', 'key');
      expect(events).toHaveLength(1);
      expect(events[0].newValue).toBeUndefined();
      expect(events[0].oldValue).toBe('val');
    });

    it('dispose() stops callback from firing', () => {
      const events: StateChangeEvent[] = [];
      const sub = store.onChange((ev) => events.push(ev));
      store.set('ns', 'k', 1);
      sub.dispose();
      store.set('ns', 'k', 2);
      expect(events).toHaveLength(1);
    });

    it('multiple listeners all fire', () => {
      const calls: number[] = [];
      store.onChange(() => calls.push(1));
      store.onChange(() => calls.push(2));
      store.set('ns', 'k', 'v');
      expect(calls).toEqual([1, 2]);
    });

    it('listener error is swallowed and other listeners still fire', () => {
      const calls: number[] = [];
      store.onChange(() => { throw new Error('boom'); });
      store.onChange(() => calls.push(1));
      expect(() => store.set('ns', 'k', 'v')).not.toThrow();
      expect(calls).toEqual([1]);
    });
  });

  // --- merge ---

  describe('merge', () => {
    it('stores partial as-is when key does not exist', () => {
      const result = store.merge('ns', 'cfg', { port: 3000 });
      expect(result).toEqual({ port: 3000 });
      expect(store.get('ns', 'cfg')).toEqual({ port: 3000 });
    });

    it('deep merges into existing object', () => {
      store.set('ns', 'cfg', { a: 1, b: { x: 10, y: 20 } });
      const result = store.merge('ns', 'cfg', { b: { y: 99 }, c: 3 });
      expect(result).toEqual({ a: 1, b: { x: 10, y: 99 }, c: 3 });
    });

    it('arrays are replaced, not merged', () => {
      store.set('ns', 'cfg', { arr: [1, 2, 3] });
      const result = store.merge('ns', 'cfg', { arr: [4, 5] });
      expect(result.arr).toEqual([4, 5]);
    });

    it('fires onChange after merge', () => {
      const events: StateChangeEvent[] = [];
      store.onChange((ev) => events.push(ev));
      store.merge('ns', 'key', { x: 1 });
      expect(events).toHaveLength(1);
    });

    it('replace non-object with object partial', () => {
      store.set('ns', 'key', 'string-value');
      const result = store.merge('ns', 'key', { replaced: true });
      expect(result).toEqual({ replaced: true });
    });
  });

  // --- clear ---

  describe('clear', () => {
    it('clears a specific namespace and fires onChange for each key', () => {
      store.set('ns', 'a', 1);
      store.set('ns', 'b', 2);
      const events: StateChangeEvent[] = [];
      store.onChange((ev) => events.push(ev));
      store.clear('ns');
      expect(store.keys('ns')).toHaveLength(0);
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.newValue === undefined)).toBe(true);
    });

    it('clears all namespaces when called without argument', () => {
      store.set('ns1', 'a', 1);
      store.set('ns2', 'b', 2);
      store.clear();
      expect(store.namespaces()).toHaveLength(0);
    });

    it('clear specific namespace does not affect other namespaces', () => {
      store.set('ns1', 'a', 1);
      store.set('ns2', 'b', 2);
      store.clear('ns1');
      expect(store.get<number>('ns2', 'b')).toBe(2);
    });
  });

  // --- snapshot / restore ---

  describe('snapshot / restore', () => {
    it('snapshot includes $schema and timestamp', () => {
      const snap = store.snapshot();
      expect(snap.$schema).toBe('1.0.0');
      expect(typeof snap.timestamp).toBe('string');
    });

    it('snapshot captures all namespaces and keys', () => {
      store.set('ns1', 'a', 1);
      store.set('ns2', 'b', 'hello');
      const snap = store.snapshot();
      expect(snap.namespaces.ns1).toEqual({ a: 1 });
      expect(snap.namespaces.ns2).toEqual({ b: 'hello' });
    });

    it('restore replaces current state with snapshot', () => {
      store.set('ns', 'key', 'original');
      const snap = store.snapshot();
      const freshStore = new StateStore();
      freshStore.restore(snap);
      expect(freshStore.get<string>('ns', 'key')).toBe('original');
    });

    it('restore clears existing state before loading', () => {
      store.set('ns', 'key', 'old');
      const emptySnap = new StateStore().snapshot();
      store.restore(emptySnap);
      expect(store.namespaces()).toHaveLength(0);
    });

    it('round-trip snapshot/restore preserves all values', () => {
      store.set('a', 'x', 100);
      store.set('b', 'y', { nested: true });
      const snap = store.snapshot();
      const restored = new StateStore();
      restored.restore(snap);
      expect(restored.get('a', 'x')).toBe(100);
      expect(restored.get('b', 'y')).toEqual({ nested: true });
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('set() throws after destroy', () => {
      store.destroy();
      expect(() => store.set('ns', 'k', 'v')).toThrow('StateStore has been destroyed');
    });

    it('delete() throws after destroy', () => {
      store.destroy();
      expect(() => store.delete('ns', 'k')).toThrow('StateStore has been destroyed');
    });

    it('merge() throws after destroy', () => {
      store.destroy();
      expect(() => store.merge('ns', 'k', { a: 1 })).toThrow('StateStore has been destroyed');
    });

    it('clear() throws after destroy', () => {
      store.destroy();
      expect(() => store.clear()).toThrow('StateStore has been destroyed');
    });

    it('onChange() throws after destroy', () => {
      store.destroy();
      expect(() => store.onChange(() => {})).toThrow('StateStore has been destroyed');
    });

    it('get() still works after destroy (read-only access)', () => {
      // get() does not call _assertNotDestroyed — just returns undefined
      store.destroy();
      expect(store.get('ns', 'k')).toBeUndefined();
    });
  });
});
