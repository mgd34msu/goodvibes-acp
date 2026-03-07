import { describe, it, expect, beforeEach } from 'bun:test';
import { Registry } from '../../src/core/registry.ts';

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  // --- register / get ---

  describe('register / get', () => {
    it('registers and retrieves an implementation', () => {
      const impl = { name: 'my-plugin' };
      registry.register('plugin', impl);
      expect(registry.get('plugin')).toBe(impl);
    });

    it('get throws for unregistered key', () => {
      expect(() => registry.get('missing')).toThrow("Registry: key 'missing' is not registered");
    });

    it('error message includes available keys', () => {
      registry.register('alpha', {});
      registry.register('beta', {});
      let message = '';
      try {
        registry.get('missing');
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toContain('alpha');
      expect(message).toContain('beta');
    });

    it('throws on duplicate key registration', () => {
      registry.register('key', {});
      expect(() => registry.register('key', {})).toThrow("Registry: key 'key' is already registered");
    });

    it('stores different types under different keys', () => {
      registry.register<string>('str', 'hello');
      registry.register<number>('num', 42);
      expect(registry.get<string>('str')).toBe('hello');
      expect(registry.get<number>('num')).toBe(42);
    });
  });

  // --- getOptional ---

  describe('getOptional', () => {
    it('returns undefined for unregistered key (no throw)', () => {
      expect(registry.getOptional('missing')).toBeUndefined();
    });

    it('returns the registered implementation when present', () => {
      const impl = { id: 1 };
      registry.register('thing', impl);
      expect(registry.getOptional('thing')).toBe(impl);
    });
  });

  // --- has ---

  describe('has', () => {
    it('returns false for unregistered key', () => {
      expect(registry.has('nope')).toBe(false);
    });

    it('returns true after register', () => {
      registry.register('key', {});
      expect(registry.has('key')).toBe(true);
    });

    it('returns false after unregister', () => {
      registry.register('key', {});
      registry.unregister('key');
      expect(registry.has('key')).toBe(false);
    });
  });

  // --- keys ---

  describe('keys', () => {
    it('returns empty array on fresh registry', () => {
      expect(registry.keys()).toEqual([]);
    });

    it('returns all registered keys', () => {
      registry.register('a', {});
      registry.register('b', {});
      registry.register('c', {});
      expect(registry.keys().sort()).toEqual(['a', 'b', 'c']);
    });

    it('does not include unregistered keys', () => {
      registry.register('a', {});
      registry.unregister('a');
      expect(registry.keys()).toEqual([]);
    });
  });

  // --- unregister ---

  describe('unregister', () => {
    it('returns true when key existed and was removed', () => {
      registry.register('key', {});
      expect(registry.unregister('key')).toBe(true);
    });

    it('returns false when key did not exist', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });

    it('after unregister, the key can be re-registered', () => {
      registry.register('key', { v: 1 });
      registry.unregister('key');
      registry.register('key', { v: 2 });
      expect((registry.get<{ v: number }>('key')).v).toBe(2);
    });
  });

  // --- registerMany / getAll ---

  describe('registerMany / getAll', () => {
    it('registers multiple implementations under same kind', () => {
      registry.registerMany('reviewer', 'code', { name: 'code-reviewer' });
      registry.registerMany('reviewer', 'security', { name: 'security-reviewer' });
      const all = registry.getAll<{ name: string }>('reviewer');
      expect(all).toHaveLength(2);
    });

    it('getAll returns empty array for unknown kind', () => {
      expect(registry.getAll('unknown-kind')).toEqual([]);
    });

    it('throws on duplicate kind+key registration', () => {
      registry.registerMany('kind', 'key', {});
      expect(() => registry.registerMany('kind', 'key', {})).toThrow(
        "Registry: multi-value key 'kind/key' is already registered"
      );
    });

    it('different kinds are independent', () => {
      registry.registerMany('tools', 'hammer', { type: 'tool' });
      registry.registerMany('plugins', 'analytics', { type: 'plugin' });
      expect(registry.getAll('tools')).toHaveLength(1);
      expect(registry.getAll('plugins')).toHaveLength(1);
    });

    it('getAll returns all implementations for a kind', () => {
      registry.registerMany('k', 'a', 1);
      registry.registerMany('k', 'b', 2);
      registry.registerMany('k', 'c', 3);
      const all = registry.getAll<number>('k');
      expect(all.sort()).toEqual([1, 2, 3]);
    });
  });

  // --- getFromKind ---

  describe('getFromKind', () => {
    it('retrieves specific implementation by kind+key', () => {
      registry.registerMany('reviewer', 'code', { id: 'code' });
      registry.registerMany('reviewer', 'security', { id: 'security' });
      const impl = registry.getFromKind<{ id: string }>('reviewer', 'code');
      expect(impl?.id).toBe('code');
    });

    it('returns undefined for unknown kind', () => {
      expect(registry.getFromKind('unknown', 'key')).toBeUndefined();
    });

    it('returns undefined for known kind but unknown key', () => {
      registry.registerMany('kind', 'key', {});
      expect(registry.getFromKind('kind', 'missing')).toBeUndefined();
    });
  });

  // --- hasMany ---

  describe('hasMany', () => {
    it('returns false for unknown kind (no key arg)', () => {
      expect(registry.hasMany('unknown')).toBe(false);
    });

    it('returns true for kind with registered entries (no key arg)', () => {
      registry.registerMany('kind', 'key', {});
      expect(registry.hasMany('kind')).toBe(true);
    });

    it('returns false for kind with no entries', () => {
      // Need to create a kind then remove it — not directly possible without unregisterMany
      // Instead test an entirely unknown kind
      expect(registry.hasMany('empty-kind')).toBe(false);
    });

    it('returns true when specific kind+key is registered', () => {
      registry.registerMany('kind', 'key', {});
      expect(registry.hasMany('kind', 'key')).toBe(true);
    });

    it('returns false when specific kind+key is not registered', () => {
      registry.registerMany('kind', 'key1', {});
      expect(registry.hasMany('kind', 'key2')).toBe(false);
    });
  });

  // --- kinds ---

  describe('kinds', () => {
    it('returns empty array on fresh registry', () => {
      expect(registry.kinds()).toEqual([]);
    });

    it('returns registered kind names', () => {
      registry.registerMany('tools', 'a', {});
      registry.registerMany('plugins', 'b', {});
      expect(registry.kinds().sort()).toEqual(['plugins', 'tools']);
    });
  });

  // --- unregisterMany ---

  describe('unregisterMany', () => {
    it('returns true when kind+key existed and was removed', () => {
      registry.registerMany('kind', 'key', {});
      expect(registry.unregisterMany('kind', 'key')).toBe(true);
    });

    it('returns false when kind+key did not exist', () => {
      expect(registry.unregisterMany('kind', 'missing')).toBe(false);
    });

    it('after unregisterMany, key can be re-registered', () => {
      registry.registerMany('kind', 'key', { v: 1 });
      registry.unregisterMany('kind', 'key');
      registry.registerMany('kind', 'key', { v: 2 });
      const impl = registry.getFromKind<{ v: number }>('kind', 'key');
      expect(impl?.v).toBe(2);
    });

    it('removes specific key without affecting other keys in same kind', () => {
      registry.registerMany('kind', 'a', { id: 'a' });
      registry.registerMany('kind', 'b', { id: 'b' });
      registry.unregisterMany('kind', 'a');
      expect(registry.getAll('kind')).toHaveLength(1);
      expect(registry.getFromKind<{ id: string }>('kind', 'b')?.id).toBe('b');
    });
  });

  // --- clear ---

  describe('clear', () => {
    it('removes all single and multi registrations', () => {
      registry.register('key', {});
      registry.registerMany('kind', 'k', {});
      registry.clear();
      expect(registry.keys()).toHaveLength(0);
      expect(registry.kinds()).toHaveLength(0);
    });

    it('registry is usable after clear', () => {
      registry.register('key', 'val');
      registry.clear();
      registry.register('key', 'new-val');
      expect(registry.get<string>('key')).toBe('new-val');
    });
  });
});
