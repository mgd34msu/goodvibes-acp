import { describe, it, expect } from 'bun:test';
import { deepMerge } from '../../src/core/utils.ts';

describe('deepMerge', () => {
  describe('basic merge', () => {
    it('returns a merged object with source values overriding target', () => {
      const result = deepMerge({ a: 1, b: 2 }, { b: 99, c: 3 });
      expect(result).toEqual({ a: 1, b: 99, c: 3 });
    });

    it('does not mutate the target object', () => {
      const target = { a: 1, b: 2 };
      deepMerge(target, { b: 99 });
      expect(target).toEqual({ a: 1, b: 2 });
    });

    it('does not mutate the source object', () => {
      const source = { b: 99 };
      deepMerge({ a: 1, b: 2 }, source);
      expect(source).toEqual({ b: 99 });
    });

    it('returns target unchanged when source is empty', () => {
      const result = deepMerge({ a: 1 }, {});
      expect(result).toEqual({ a: 1 });
    });

    it('returns a copy of source fields when target is empty', () => {
      const result = deepMerge({} as Record<string, unknown>, { a: 1 });
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('nested object merging', () => {
    it('deep-merges nested objects recursively', () => {
      const target = { nested: { x: 1, y: 2 } };
      const source = { nested: { y: 99, z: 3 } };
      const result = deepMerge(target, source);
      expect(result.nested).toEqual({ x: 1, y: 99, z: 3 });
    });

    it('handles multiple levels of nesting', () => {
      const target = { a: { b: { c: 1 } } };
      const source = { a: { b: { d: 2 } } };
      const result = deepMerge(target, source);
      expect((result as Record<string, unknown>).a).toEqual({ b: { c: 1, d: 2 } });
    });

    it('does not deep-merge nested objects in the target', () => {
      // Target nested should be replaced when source provides a primitive
      const target = { meta: { version: 1, flag: true } };
      const source: Record<string, unknown> = { meta: 'replaced' };
      const result = deepMerge(target, source);
      expect(result.meta).toBe('replaced');
    });
  });

  describe('array handling', () => {
    it('replaces arrays rather than merging them', () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [4, 5] };
      const result = deepMerge(target, source);
      expect(result.items).toEqual([4, 5]);
    });

    it('treats an array in target as a plain value when source replaces it', () => {
      const target = { items: [1, 2] };
      const source: Record<string, unknown> = { items: 'not-an-array' };
      const result = deepMerge(target, source);
      expect(result.items).toBe('not-an-array');
    });

    it('keeps target array when source does not include that key', () => {
      const target = { items: [1, 2, 3], other: 'x' };
      const result = deepMerge(target, { other: 'y' });
      expect(result.items).toEqual([1, 2, 3]);
    });
  });

  describe('null and undefined handling', () => {
    it('skips source keys whose value is undefined', () => {
      const target = { a: 1 };
      const source: Record<string, unknown> = { a: undefined };
      const result = deepMerge(target, source);
      expect(result.a).toBe(1);
    });

    it('allows source null to override a target value', () => {
      const target: Record<string, unknown> = { a: 1 };
      const source: Record<string, unknown> = { a: null };
      const result = deepMerge(target, source);
      expect(result.a).toBeNull();
    });

    it('does not deep-merge when target value is null', () => {
      // null target + object source → source object replaces null
      const target: Record<string, unknown> = { nested: null };
      const source = { nested: { x: 1 } };
      const result = deepMerge(target, source);
      expect(result.nested).toEqual({ x: 1 });
    });

    it('does not deep-merge when source value is null', () => {
      // object target + null source → null replaces object
      const target: Record<string, unknown> = { nested: { x: 1 } };
      const source: Record<string, unknown> = { nested: null };
      const result = deepMerge(target, source);
      expect(result.nested).toBeNull();
    });
  });

  describe('type invariants', () => {
    it('returns type T inferred from target', () => {
      const result = deepMerge({ count: 0, label: '' }, { count: 42 });
      // TypeScript ensures result has same shape as target
      expect(result.count).toBe(42);
      expect(result.label).toBe('');
    });
  });
});
