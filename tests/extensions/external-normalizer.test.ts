import { describe, it, expect, beforeEach } from 'bun:test';
import { NormalizerRegistry } from '../../src/extensions/external/normalizer.js';
import type { EventNormalizer, NormalizedEvent } from '../../src/extensions/external/normalizer.js';

describe('NormalizerRegistry', () => {
  let registry: NormalizerRegistry;

  beforeEach(() => {
    registry = new NormalizerRegistry();
  });

  // ---------------------------------------------------------------------------
  // Built-in generic normalizer
  // ---------------------------------------------------------------------------

  describe('built-in generic normalizer', () => {
    it('is available by default — sources() includes generic', () => {
      expect(registry.sources()).toContain('generic');
    });

    it('normalizes an object payload and extracts type from "type" key', () => {
      const event = registry.normalize('generic', { type: 'push', ref: 'refs/heads/main' });

      expect(event.source).toBe('generic');
      expect(event.type).toBe('push');
      expect(event.payload).toMatchObject({ type: 'push', ref: 'refs/heads/main' });
    });

    it('extracts type from "event" key when "type" is absent', () => {
      const event = registry.normalize('generic', { event: 'message', data: 'hello' });
      expect(event.type).toBe('message');
    });

    it('extracts type from "action" key as last fallback before unknown', () => {
      const event = registry.normalize('generic', { action: 'opened', number: 42 });
      expect(event.type).toBe('opened');
    });

    it('falls back to type "unknown" when no known key is present', () => {
      const event = registry.normalize('generic', { random: 'data' });
      expect(event.type).toBe('unknown');
    });

    it('wraps non-object payload in { value } container', () => {
      const event = registry.normalize('generic', 'plain-string');
      expect(event.payload).toEqual({ value: 'plain-string' });
    });

    it('wraps null payload in { value: null } container', () => {
      const event = registry.normalize('generic', null);
      expect(event.payload).toEqual({ value: null });
    });
  });

  // ---------------------------------------------------------------------------
  // NormalizedEvent shape
  // ---------------------------------------------------------------------------

  describe('NormalizedEvent shape', () => {
    it('always contains source, type, payload, timestamp, id fields', () => {
      const event = registry.normalize('generic', {});

      expect(event).toHaveProperty('source');
      expect(event).toHaveProperty('type');
      expect(event).toHaveProperty('payload');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('id');
    });

    it('timestamp is a number (Unix ms)', () => {
      const before = Date.now();
      const event = registry.normalize('generic', {});
      const after = Date.now();

      expect(typeof event.timestamp).toBe('number');
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(after);
    });

    it('id is a non-empty string', () => {
      const event = registry.normalize('generic', {});
      expect(typeof event.id).toBe('string');
      expect(event.id.length).toBeGreaterThan(0);
    });

    it('each call produces a unique id', () => {
      const a = registry.normalize('generic', {});
      const b = registry.normalize('generic', {});
      expect(a.id).not.toBe(b.id);
    });
  });

  // ---------------------------------------------------------------------------
  // register custom normalizer
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('registers a custom normalizer and uses it for that source', () => {
      const custom: EventNormalizer = {
        normalize: (payload) => ({
          source: 'github',
          type: 'custom-push',
          payload: payload as Record<string, unknown>,
          timestamp: Date.now(),
          id: 'fixed-id',
        }),
      };
      registry.register('github', custom);

      const event = registry.normalize('github', { sha: 'abc' });
      expect(event.type).toBe('custom-push');
    });

    it('overwrites a previously registered normalizer for the same source', () => {
      const first: EventNormalizer = {
        normalize: () => ({
          source: 's', type: 'first', payload: {}, timestamp: 0, id: '1',
        }),
      };
      const second: EventNormalizer = {
        normalize: () => ({
          source: 's', type: 'second', payload: {}, timestamp: 0, id: '2',
        }),
      };
      registry.register('s', first);
      registry.register('s', second);

      expect(registry.normalize('s', {}).type).toBe('second');
    });

    it('source always reflects the requested source even with custom normalizer', () => {
      const custom: EventNormalizer = {
        normalize: () => ({
          source: 'wrong-source', type: 'x', payload: {}, timestamp: 0, id: 'y',
        }),
      };
      registry.register('github', custom);

      const event = registry.normalize('github', {});
      expect(event.source).toBe('github');
    });
  });

  // ---------------------------------------------------------------------------
  // Fallback to generic
  // ---------------------------------------------------------------------------

  describe('fallback to generic normalizer', () => {
    it('uses generic normalizer for unknown source', () => {
      const event = registry.normalize('unknown-source', { type: 'test' });

      expect(event.source).toBe('unknown-source');
      expect(event.type).toBe('test');
    });

    it('source field is overridden to the requested source even when generic is used', () => {
      const event = registry.normalize('my-webhook', {});
      expect(event.source).toBe('my-webhook');
    });
  });

  // ---------------------------------------------------------------------------
  // has / sources
  // ---------------------------------------------------------------------------

  describe('has', () => {
    it('returns false for generic (generic is built-in, not custom)', () => {
      expect(registry.has('generic')).toBe(false);
    });

    it('returns false for unregistered source', () => {
      expect(registry.has('github')).toBe(false);
    });

    it('returns true after a source-specific normalizer is registered', () => {
      registry.register('github', { normalize: (p) => ({ source: 'github', type: 'x', payload: {} as Record<string, unknown>, timestamp: 0, id: '' }) });
      expect(registry.has('github')).toBe(true);
    });
  });

  describe('sources', () => {
    it('includes generic by default', () => {
      expect(registry.sources()).toEqual(['generic']);
    });

    it('includes newly registered sources', () => {
      registry.register('slack', { normalize: (p) => ({ source: 'slack', type: 'x', payload: {} as Record<string, unknown>, timestamp: 0, id: '' }) });
      expect(registry.sources()).toContain('slack');
      expect(registry.sources()).toContain('generic');
    });
  });
});
