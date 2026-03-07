import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventBus } from '../../src/core/event-bus.js';
import { ServiceRegistry } from '../../src/extensions/services/registry.js';
import type { ServiceConfig } from '../../src/extensions/services/registry.js';

const BASIC_CONFIG: ServiceConfig = {
  endpoint: 'https://api.example.com',
  auth: { type: 'bearer', token: 'tok123' },
};

describe('ServiceRegistry', () => {
  let bus: EventBus;
  let registry: ServiceRegistry;
  let tmpDir: string;

  beforeEach(async () => {
    bus = new EventBus();
    tmpDir = await mkdtemp(join(tmpdir(), 'gv-svc-'));
    registry = new ServiceRegistry(tmpDir, bus);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------------------
  // register / get / has
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('registers a service and makes it retrievable via get', () => {
      registry.register('my-api', BASIC_CONFIG);
      const cfg = registry.get('my-api');
      expect(cfg).toEqual(BASIC_CONFIG);
    });

    it('overwrites an existing service with the same name', () => {
      registry.register('my-api', BASIC_CONFIG);
      const updated: ServiceConfig = { endpoint: 'https://other.example.com' };
      registry.register('my-api', updated);
      expect(registry.get('my-api')).toEqual(updated);
    });

    it('emits service:registered event', () => {
      const events: unknown[] = [];
      bus.on('service:registered', (ev) => events.push(ev.payload));

      registry.register('svc-a', BASIC_CONFIG);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ name: 'svc-a' });
    });
  });

  describe('get', () => {
    it('returns undefined for an unregistered service', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('returns true for a registered service', () => {
      registry.register('svc-b', BASIC_CONFIG);
      expect(registry.has('svc-b')).toBe(true);
    });

    it('returns false for an unregistered service', () => {
      expect(registry.has('nope')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns empty array when no services are registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('lists all registered services', () => {
      registry.register('alpha', BASIC_CONFIG);
      registry.register('beta', { endpoint: 'https://beta.io' });

      const entries = registry.list();
      expect(entries).toHaveLength(2);
      const names = entries.map((e) => e.name).sort();
      expect(names).toEqual(['alpha', 'beta']);
    });

    it('each entry contains name, config, and registeredAt', () => {
      registry.register('gamma', BASIC_CONFIG);
      const [entry] = registry.list();

      expect(entry).toHaveProperty('name', 'gamma');
      expect(entry).toHaveProperty('config');
      expect(entry).toHaveProperty('registeredAt');
      expect(typeof entry.registeredAt).toBe('string');
    });

    it('returns a snapshot — mutations do not affect the returned array', () => {
      registry.register('snap', BASIC_CONFIG);
      const first = registry.list();
      registry.register('snap2', BASIC_CONFIG);
      expect(first).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('removes a registered service', () => {
      registry.register('to-remove', BASIC_CONFIG);
      registry.remove('to-remove');
      expect(registry.get('to-remove')).toBeUndefined();
      expect(registry.has('to-remove')).toBe(false);
    });

    it('emits service:removed event', () => {
      const events: unknown[] = [];
      bus.on('service:removed', (ev) => events.push(ev.payload));

      registry.register('rem-me', BASIC_CONFIG);
      registry.remove('rem-me');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ name: 'rem-me' });
    });

    it('is a no-op and does NOT emit event when service is not registered', () => {
      const events: unknown[] = [];
      bus.on('service:removed', (ev) => events.push(ev.payload));

      registry.remove('ghost');

      expect(events).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Disk persistence — load / save
  // ---------------------------------------------------------------------------

  describe('save / load', () => {
    it('save persists and load restores registered services', async () => {
      registry.register('persist-me', BASIC_CONFIG);
      await registry.save();

      const registry2 = new ServiceRegistry(tmpDir, new EventBus());
      await registry2.load();

      expect(registry2.has('persist-me')).toBe(true);
      expect(registry2.get('persist-me')).toEqual(BASIC_CONFIG);
    });

    it('load on missing file resets to empty store without throwing', async () => {
      // No save — file does not exist yet
      await expect(registry.load()).resolves.toBeUndefined();
      expect(registry.list()).toEqual([]);
    });

    it('save emits service:saved event', async () => {
      const events: unknown[] = [];
      bus.on('service:saved', (ev) => events.push(ev.payload));

      await registry.save();

      expect(events).toHaveLength(1);
    });

    it('load emits service:loaded event', async () => {
      const events: unknown[] = [];
      bus.on('service:loaded', (ev) => events.push(ev.payload));

      await registry.load();

      expect(events).toHaveLength(1);
    });

    it('save creates directory if it does not exist', async () => {
      const nested = join(tmpDir, 'nested', 'deep');
      const r = new ServiceRegistry(nested, new EventBus());
      r.register('nested-svc', BASIC_CONFIG);
      await expect(r.save()).resolves.toBeUndefined();
    });
  });
});
