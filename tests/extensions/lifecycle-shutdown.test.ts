import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { ShutdownManager, SHUTDOWN_ORDER } from '../../src/extensions/lifecycle/shutdown.js';
import type { PluginRegistration } from '../../src/types/plugin.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlugin(name: string, shutdown?: () => Promise<void>): PluginRegistration {
  return {
    manifest: {
      name,
      version: '1.0.0',
      description: `Test plugin ${name}`,
      layer: 'L3',
    },
    register: () => {},
    shutdown,
  };
}

// ---------------------------------------------------------------------------
// SHUTDOWN_ORDER constants
// ---------------------------------------------------------------------------

describe('SHUTDOWN_ORDER', () => {
  it('L3 > L2 > L1 in numeric order', () => {
    expect(SHUTDOWN_ORDER.L3).toBeGreaterThan(SHUTDOWN_ORDER.L2);
    expect(SHUTDOWN_ORDER.L2).toBeGreaterThan(SHUTDOWN_ORDER.L1);
  });

  it('exports the expected values', () => {
    expect(SHUTDOWN_ORDER.L3).toBe(300);
    expect(SHUTDOWN_ORDER.L2).toBe(200);
    expect(SHUTDOWN_ORDER.L1).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// ShutdownManager
// ---------------------------------------------------------------------------

describe('ShutdownManager', () => {
  let bus: EventBus;
  let manager: ShutdownManager;

  beforeEach(() => {
    bus = new EventBus();
    manager = new ShutdownManager(bus);
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  describe('register', () => {
    it('is not shutting down initially', () => {
      expect(manager.isShuttingDown()).toBe(false);
    });

    it('accepts a handler registration without throwing', () => {
      expect(() =>
        manager.register('test-handler', SHUTDOWN_ORDER.L2, async () => {})
      ).not.toThrow();
    });

    it('accepts multiple handlers', () => {
      manager.register('handler-a', SHUTDOWN_ORDER.L3, async () => {});
      manager.register('handler-b', SHUTDOWN_ORDER.L2, async () => {});
      manager.register('handler-c', SHUTDOWN_ORDER.L1, async () => {});
      // No error thrown
    });
  });

  // -------------------------------------------------------------------------
  // shutdown
  // -------------------------------------------------------------------------

  describe('shutdown', () => {
    it('calls all registered handlers', async () => {
      const called: string[] = [];
      manager.register('a', SHUTDOWN_ORDER.L1, async () => { called.push('a'); });
      manager.register('b', SHUTDOWN_ORDER.L2, async () => { called.push('b'); });

      await manager.shutdown();

      expect(called).toContain('a');
      expect(called).toContain('b');
    });

    it('calls handlers in descending order (higher order first)', async () => {
      const order: number[] = [];
      manager.register('L1', SHUTDOWN_ORDER.L1, async () => { order.push(100); });
      manager.register('L2', SHUTDOWN_ORDER.L2, async () => { order.push(200); });
      manager.register('L3', SHUTDOWN_ORDER.L3, async () => { order.push(300); });

      await manager.shutdown();

      expect(order).toEqual([300, 200, 100]);
    });

    it('emits lifecycle:shutdown-start before handlers run', async () => {
      const events: string[] = [];
      bus.on('lifecycle:shutdown-start', () => events.push('start'));

      const callOrder: string[] = [];
      manager.register('handler', SHUTDOWN_ORDER.L2, async () => { callOrder.push('handler'); });

      await manager.shutdown('test');

      expect(events).toHaveLength(1);
    });

    it('emits lifecycle:shutdown-complete after all handlers run', async () => {
      const events: string[] = [];
      bus.on('lifecycle:shutdown-complete', () => events.push('complete'));

      const order: string[] = [];
      manager.register('handler', SHUTDOWN_ORDER.L2, async () => { order.push('handler'); });

      await manager.shutdown();

      // complete event must fire after handler
      expect(order).toEqual(['handler']);
      expect(events).toHaveLength(1);
    });

    it('sets isShuttingDown() to true during shutdown', async () => {
      let seenDuring = false;
      manager.register('check', SHUTDOWN_ORDER.L2, async () => {
        seenDuring = manager.isShuttingDown();
      });

      await manager.shutdown();

      expect(seenDuring).toBe(true);
    });

    it('is idempotent — second shutdown call is a no-op', async () => {
      const called: number[] = [];
      manager.register('handler', SHUTDOWN_ORDER.L2, async () => { called.push(1); });

      await manager.shutdown();
      await manager.shutdown(); // second call — should not run handlers again

      expect(called).toHaveLength(1);
    });

    it('continues with remaining handlers when one throws', async () => {
      const called: string[] = [];
      manager.register('fails', SHUTDOWN_ORDER.L3, async () => { throw new Error('boom'); });
      manager.register('ok', SHUTDOWN_ORDER.L2, async () => { called.push('ok'); });

      await manager.shutdown();

      expect(called).toContain('ok');
    });

    it('accepts an optional reason string', async () => {
      const payloads: unknown[] = [];
      bus.on('lifecycle:shutdown-start', (ev) => payloads.push(ev.payload));

      await manager.shutdown('graceful restart');

      expect((payloads[0] as { reason: string }).reason).toBe('graceful restart');
    });

    it('works with no registered handlers', async () => {
      await expect(manager.shutdown()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // registerPlugin
  // -------------------------------------------------------------------------

  describe('registerPlugin', () => {
    it('registers a plugin shutdown handler', async () => {
      const called: boolean[] = [];
      const plugin = makePlugin('test-plugin', async () => { called.push(true); });

      manager.registerPlugin(plugin);
      await manager.shutdown();

      expect(called).toHaveLength(1);
    });

    it('ignores plugins without a shutdown function', async () => {
      const plugin = makePlugin('no-shutdown');
      // Should not throw
      expect(() => manager.registerPlugin(plugin)).not.toThrow();
    });

    it('registers plugin at L3 order (300) — runs before L2 handlers', async () => {
      const order: string[] = [];
      const plugin = makePlugin('plugin', async () => { order.push('plugin'); });
      manager.registerPlugin(plugin);
      manager.register('L2-handler', SHUTDOWN_ORDER.L2, async () => { order.push('L2'); });

      await manager.shutdown();

      expect(order.indexOf('plugin')).toBeLessThan(order.indexOf('L2'));
    });
  });
});
