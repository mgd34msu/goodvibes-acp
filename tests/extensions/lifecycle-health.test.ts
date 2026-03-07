import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { HealthCheck } from '../../src/extensions/lifecycle/health.js';
import type { HealthStatus } from '../../src/extensions/lifecycle/health.js';

describe('HealthCheck', () => {
  let bus: EventBus;
  let health: HealthCheck;

  beforeEach(() => {
    bus = new EventBus();
    health = new HealthCheck(bus);
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts in starting status', () => {
      const snapshot = health.check();
      expect(snapshot.status).toBe('starting');
    });

    it('has an empty checks map initially', () => {
      const snapshot = health.check();
      expect(snapshot.checks).toEqual({});
    });

    it('uptime is a non-negative number', () => {
      const snapshot = health.check();
      expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
    });

    it('uptime increases over time', async () => {
      const before = health.check().uptime;
      await new Promise((r) => setTimeout(r, 5));
      const after = health.check().uptime;
      expect(after).toBeGreaterThan(before);
    });
  });

  // -------------------------------------------------------------------------
  // markReady
  // -------------------------------------------------------------------------

  describe('markReady', () => {
    it('transitions from starting to ready', () => {
      health.markReady();
      expect(health.check().status).toBe('ready');
    });

    it('is idempotent — calling markReady twice stays ready', () => {
      health.markReady();
      health.markReady();
      expect(health.check().status).toBe('ready');
    });

    it('does not transition from shutting_down to ready', () => {
      health.markShuttingDown();
      health.markReady();
      // Still shutting_down, not ready
      expect(health.check().status).toBe('shutting_down');
    });
  });

  // -------------------------------------------------------------------------
  // markShuttingDown
  // -------------------------------------------------------------------------

  describe('markShuttingDown', () => {
    it('transitions to shutting_down from starting', () => {
      health.markShuttingDown();
      expect(health.check().status).toBe('shutting_down');
    });

    it('transitions to shutting_down from ready', () => {
      health.markReady();
      health.markShuttingDown();
      expect(health.check().status).toBe('shutting_down');
    });

    it('returns shutting_down even when failing checks exist', () => {
      health.markReady();
      health.setCheck('db', false, 'DB is down');
      health.markShuttingDown();
      expect(health.check().status).toBe('shutting_down');
    });
  });

  // -------------------------------------------------------------------------
  // setCheck
  // -------------------------------------------------------------------------

  describe('setCheck', () => {
    it('adds a named check', () => {
      health.setCheck('database', true);
      const snapshot = health.check();
      expect(snapshot.checks).toHaveProperty('database');
      expect(snapshot.checks['database'].ok).toBe(true);
    });

    it('stores an optional message', () => {
      health.setCheck('api', false, 'API is unreachable');
      const snapshot = health.check();
      expect(snapshot.checks['api'].message).toBe('API is unreachable');
    });

    it('updates an existing check by name', () => {
      health.setCheck('cache', false, 'miss');
      health.setCheck('cache', true, 'connected');
      const snapshot = health.check();
      expect(snapshot.checks['cache'].ok).toBe(true);
      expect(snapshot.checks['cache'].message).toBe('connected');
    });

    it('supports multiple independent checks', () => {
      health.setCheck('db', true);
      health.setCheck('cache', true);
      health.setCheck('queue', false, 'queue full');
      const snapshot = health.check();
      expect(Object.keys(snapshot.checks)).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // _deriveStatus — degraded logic
  // -------------------------------------------------------------------------

  describe('derived status (degraded)', () => {
    it('is ready when all checks are passing', () => {
      health.markReady();
      health.setCheck('db', true);
      health.setCheck('cache', true);
      expect(health.check().status).toBe('ready');
    });

    it('is degraded when ready but at least one check is failing', () => {
      health.markReady();
      health.setCheck('db', true);
      health.setCheck('cache', false, 'Redis is down');
      expect(health.check().status).toBe('degraded');
    });

    it('is starting (not degraded) even when a check is failing', () => {
      // Starting state overrides degraded logic
      health.setCheck('db', false);
      expect(health.check().status).toBe('starting');
    });

    it('recovers from degraded to ready when failing check is fixed', () => {
      health.markReady();
      health.setCheck('db', false, 'down');
      expect(health.check().status).toBe('degraded');

      health.setCheck('db', true);
      expect(health.check().status).toBe('ready');
    });

    it('check snapshot is a copy — mutations do not affect internal state', () => {
      health.setCheck('db', true);
      const snapshot = health.check();
      // Mutate the returned snapshot
      snapshot.checks['db'] = { ok: false, message: 'tampered' };

      // Original should be unchanged
      const fresh = health.check();
      expect(fresh.checks['db'].ok).toBe(true);
    });
  });
});
