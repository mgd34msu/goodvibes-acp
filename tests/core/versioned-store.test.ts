import { describe, test, expect } from 'bun:test';
import {
  wrapVersioned,
  unwrapVersioned,
  isVersioned,
} from '../../src/core/versioned-store.ts';

describe('versioned-store', () => {
  // ---------------------------------------------------------------------------
  // wrapVersioned
  // ---------------------------------------------------------------------------

  describe('wrapVersioned', () => {
    test('wraps data with $schema and data fields', () => {
      const wrapped = wrapVersioned({ name: 'test' }, '1.0.0');
      expect(wrapped.$schema).toBe('1.0.0');
      expect(wrapped.data).toEqual({ name: 'test' });
    });

    test('wraps primitive values', () => {
      const wrapped = wrapVersioned(42, '2.3.1');
      expect(wrapped.$schema).toBe('2.3.1');
      expect(wrapped.data).toBe(42);
    });

    test('wraps null', () => {
      const wrapped = wrapVersioned(null, '1.0.0');
      expect(wrapped.$schema).toBe('1.0.0');
      expect(wrapped.data).toBeNull();
    });

    test('wraps arrays', () => {
      const wrapped = wrapVersioned([1, 2, 3], '0.1.0');
      expect(wrapped.data).toEqual([1, 2, 3]);
    });

    test('stores the exact version string provided', () => {
      const wrapped = wrapVersioned({}, 'custom-schema-v3');
      expect(wrapped.$schema).toBe('custom-schema-v3');
    });
  });

  // ---------------------------------------------------------------------------
  // unwrapVersioned
  // ---------------------------------------------------------------------------

  describe('unwrapVersioned', () => {
    test('extracts version and data from a valid envelope', () => {
      const envelope = { $schema: '1.0.0', data: { id: 'abc' } };
      const result = unwrapVersioned(envelope);
      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0.0');
      expect(result!.data).toEqual({ id: 'abc' });
    });

    test('returns null for null input', () => {
      expect(unwrapVersioned(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(unwrapVersioned(undefined)).toBeNull();
    });

    test('returns null for a plain string', () => {
      expect(unwrapVersioned('hello')).toBeNull();
    });

    test('returns null for a number', () => {
      expect(unwrapVersioned(123)).toBeNull();
    });

    test('returns null for an object missing $schema', () => {
      expect(unwrapVersioned({ data: { foo: 'bar' } })).toBeNull();
    });

    test('returns null for an object where $schema is not a string', () => {
      expect(unwrapVersioned({ $schema: 42, data: {} })).toBeNull();
    });

    test('returns null for an object missing data', () => {
      expect(unwrapVersioned({ $schema: '1.0.0' })).toBeNull();
    });

    test('returns null for an empty object', () => {
      expect(unwrapVersioned({})).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isVersioned
  // ---------------------------------------------------------------------------

  describe('isVersioned', () => {
    test('returns true for a valid versioned envelope', () => {
      expect(isVersioned({ $schema: '1.0.0', data: {} })).toBe(true);
    });

    test('returns false for null', () => {
      expect(isVersioned(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isVersioned(undefined)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(isVersioned('1.0.0')).toBe(false);
    });

    test('returns false for a number', () => {
      expect(isVersioned(0)).toBe(false);
    });

    test('returns false for an object missing $schema', () => {
      expect(isVersioned({ data: { x: 1 } })).toBe(false);
    });

    test('returns false when $schema is not a string', () => {
      expect(isVersioned({ $schema: 100, data: {} })).toBe(false);
    });

    test('returns false for an object missing data', () => {
      expect(isVersioned({ $schema: '1.0.0' })).toBe(false);
    });

    test('returns false for an empty object', () => {
      expect(isVersioned({})).toBe(false);
    });

    test('returns false for an array', () => {
      expect(isVersioned([])).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Round-trip: wrap then unwrap
  // ---------------------------------------------------------------------------

  describe('round-trip', () => {
    test('wrap then unwrap preserves object data', () => {
      const original = { id: 'xyz', count: 7, nested: { a: true } };
      const wrapped = wrapVersioned(original, '1.2.3');
      const result = unwrapVersioned(wrapped);

      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.2.3');
      expect(result!.data).toEqual(original);
    });

    test('wrap then unwrap preserves primitive data', () => {
      const wrapped = wrapVersioned(99, '0.0.1');
      const result = unwrapVersioned<number>(wrapped);

      expect(result).not.toBeNull();
      expect(result!.data).toBe(99);
    });

    test('wrap then unwrap preserves array data', () => {
      const arr = ['a', 'b', 'c'];
      const wrapped = wrapVersioned(arr, '1.0.0');
      const result = unwrapVersioned<string[]>(wrapped);

      expect(result).not.toBeNull();
      expect(result!.data).toEqual(arr);
    });

    test('round-trip isVersioned check is true after wrap', () => {
      const wrapped = wrapVersioned({ x: 1 }, '1.0.0');
      expect(isVersioned(wrapped)).toBe(true);
    });
  });
});
