import { describe, it, expect, beforeEach } from 'bun:test';
import { HookEngine } from '../../src/core/hook-engine.ts';

describe('HookEngine', () => {
  let engine: HookEngine;

  beforeEach(() => {
    engine = new HookEngine();
  });

  // --- register / list ---

  describe('register / list', () => {
    it('registers a pre hook and lists it', () => {
      engine.register('agent:spawn', 'pre', (ctx) => ctx);
      const hooks = engine.list();
      expect(hooks).toHaveLength(1);
      expect(hooks[0].hookPoint).toBe('agent:spawn');
      expect(hooks[0].phase).toBe('pre');
    });

    it('registers a post hook and lists it', () => {
      engine.register('agent:spawn', 'post', () => {});
      const hooks = engine.list();
      expect(hooks).toHaveLength(1);
      expect(hooks[0].phase).toBe('post');
    });

    it('assigns default priority of 50', () => {
      engine.register('test', 'pre', (ctx) => ctx);
      expect(engine.list()[0].priority).toBe(50);
    });

    it('assigns custom priority', () => {
      engine.register('test', 'pre', (ctx) => ctx, 10);
      expect(engine.list()[0].priority).toBe(10);
    });

    it('assigns unique id to each registration', () => {
      engine.register('test', 'pre', (ctx) => ctx);
      engine.register('test', 'pre', (ctx) => ctx);
      const hooks = engine.list();
      expect(hooks[0].id).not.toBe(hooks[1].id);
    });

    it('list filtered by hookPoint returns only matching hooks', () => {
      engine.register('point:a', 'pre', (ctx) => ctx);
      engine.register('point:b', 'pre', (ctx) => ctx);
      const filtered = engine.list('point:a');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].hookPoint).toBe('point:a');
    });

    it('list with no argument returns all hooks across all hook points', () => {
      engine.register('point:a', 'pre', (ctx) => ctx);
      engine.register('point:b', 'post', () => {});
      expect(engine.list()).toHaveLength(2);
    });

    it('list for unknown hook point returns empty array', () => {
      expect(engine.list('nonexistent')).toHaveLength(0);
    });

    it('throws after destroy', () => {
      engine.destroy();
      expect(() => engine.register('test', 'pre', (ctx) => ctx)).toThrow('HookEngine has been destroyed');
    });
  });

  // --- execute (pre hooks) ---

  describe('execute (pre hooks)', () => {
    it('returns context unchanged when no hooks registered', async () => {
      const ctx = { value: 42 };
      const result = await engine.execute('test', ctx);
      expect(result).toEqual({ value: 42 });
    });

    it('pre hook can modify and return new context', async () => {
      engine.register('test', 'pre', (ctx: { value: number }) => ({ ...ctx, value: ctx.value + 1 }));
      const result = await engine.execute('test', { value: 10 });
      expect(result).toEqual({ value: 11 });
    });

    it('returning undefined/void keeps context unchanged', async () => {
      engine.register('test', 'pre', (_ctx) => { /* returns nothing */ });
      const result = await engine.execute('test', { value: 5 });
      expect(result).toEqual({ value: 5 });
    });

    it('chains context through multiple pre hooks', async () => {
      engine.register('test', 'pre', (ctx: { value: number }) => ({ value: ctx.value + 1 }));
      engine.register('test', 'pre', (ctx: { value: number }) => ({ value: ctx.value * 2 }));
      const result = await engine.execute('test', { value: 3 });
      // First hook: 3 + 1 = 4, second: 4 * 2 = 8
      expect(result).toEqual({ value: 8 });
    });

    it('executes hooks in priority order (lower number first)', async () => {
      const order: number[] = [];
      engine.register('test', 'pre', (ctx) => { order.push(30); return ctx; }, 30);
      engine.register('test', 'pre', (ctx) => { order.push(10); return ctx; }, 10);
      engine.register('test', 'pre', (ctx) => { order.push(50); return ctx; }, 50);
      await engine.execute('test', {});
      expect(order).toEqual([10, 30, 50]);
    });

    it('error in pre hook is isolated — continues with unchanged context', async () => {
      engine.register('test', 'pre', (_ctx) => { throw new Error('pre error'); });
      engine.register('test', 'pre', (ctx: { value: number }) => ({ value: ctx.value + 1 }));
      const result = await engine.execute('test', { value: 5 });
      // Error hook returns nothing, second hook applies
      expect(result).toEqual({ value: 6 });
    });

    it('supports async pre hook handlers', async () => {
      engine.register('test', 'pre', async (ctx: { value: number }) => {
        await new Promise((r) => setTimeout(r, 5));
        return { value: ctx.value + 100 };
      });
      const result = await engine.execute('test', { value: 1 });
      expect(result).toEqual({ value: 101 });
    });

    it('throws after destroy', async () => {
      engine.destroy();
      await expect(engine.execute('test', {})).rejects.toThrow('HookEngine has been destroyed');
    });
  });

  // --- executePost (post hooks) ---

  describe('executePost (post hooks)', () => {
    it('executes post hooks with context and result', async () => {
      const calls: Array<{ ctx: unknown; result: unknown }> = [];
      engine.register('test', 'post', (ctx, result) => { calls.push({ ctx, result }); });
      await engine.executePost('test', { value: 42 }, 'result-data');
      expect(calls).toHaveLength(1);
      expect(calls[0].ctx).toEqual({ value: 42 });
      expect(calls[0].result).toBe('result-data');
    });

    it('runs multiple post hooks in priority order', async () => {
      const order: number[] = [];
      engine.register('test', 'post', () => { order.push(20); }, 20);
      engine.register('test', 'post', () => { order.push(5); }, 5);
      engine.register('test', 'post', () => { order.push(50); }, 50);
      await engine.executePost('test', {}, null);
      expect(order).toEqual([5, 20, 50]);
    });

    it('does nothing when no post hooks registered', async () => {
      await expect(engine.executePost('nonexistent', {}, null)).resolves.toBeUndefined();
    });

    it('error in post hook is isolated — other hooks still run', async () => {
      const calls: number[] = [];
      engine.register('test', 'post', () => { throw new Error('post error'); });
      engine.register('test', 'post', () => { calls.push(1); });
      await engine.executePost('test', {}, null);
      expect(calls).toEqual([1]);
    });

    it('supports async post hook handlers', async () => {
      const calls: number[] = [];
      engine.register('test', 'post', async () => {
        await new Promise((r) => setTimeout(r, 5));
        calls.push(1);
      });
      await engine.executePost('test', {}, null);
      expect(calls).toEqual([1]);
    });

    it('throws after destroy', async () => {
      engine.destroy();
      await expect(engine.executePost('test', {}, null)).rejects.toThrow('HookEngine has been destroyed');
    });
  });

  // --- dispose (unregister) ---

  describe('dispose / unregister', () => {
    it('dispose removes the hook from list', () => {
      const sub = engine.register('test', 'pre', (ctx) => ctx);
      expect(engine.list()).toHaveLength(1);
      sub.dispose();
      expect(engine.list()).toHaveLength(0);
    });

    it('disposed hook does not run during execute', async () => {
      const calls: number[] = [];
      const sub = engine.register('test', 'pre', (ctx) => { calls.push(1); return ctx; });
      sub.dispose();
      await engine.execute('test', {});
      expect(calls).toHaveLength(0);
    });

    it('disposing one hook does not affect others on the same hook point', async () => {
      const calls: number[] = [];
      const sub1 = engine.register('test', 'pre', (ctx) => { calls.push(1); return ctx; });
      engine.register('test', 'pre', (ctx) => { calls.push(2); return ctx; });
      sub1.dispose();
      await engine.execute('test', {});
      expect(calls).toEqual([2]);
    });

    it('disposing twice does not throw', () => {
      const sub = engine.register('test', 'pre', (ctx) => ctx);
      sub.dispose();
      expect(() => sub.dispose()).not.toThrow();
    });
  });

  // --- clear ---

  describe('clear', () => {
    it('clear() with hookPoint removes only that hook point', () => {
      engine.register('point:a', 'pre', (ctx) => ctx);
      engine.register('point:b', 'pre', (ctx) => ctx);
      engine.clear('point:a');
      expect(engine.list('point:a')).toHaveLength(0);
      expect(engine.list('point:b')).toHaveLength(1);
    });

    it('clear() with no argument removes all hooks', () => {
      engine.register('point:a', 'pre', (ctx) => ctx);
      engine.register('point:b', 'post', () => {});
      engine.clear();
      expect(engine.list()).toHaveLength(0);
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('clears all hooks on destroy', () => {
      engine.register('test', 'pre', (ctx) => ctx);
      engine.destroy();
      expect(engine.list()).toHaveLength(0);
    });

    it('execute does not run hooks after destroy', async () => {
      const calls: number[] = [];
      engine.register('test', 'pre', (ctx) => { calls.push(1); return ctx; });
      engine.destroy();
      await expect(engine.execute('test', {})).rejects.toThrow();
      expect(calls).toHaveLength(0);
    });
  });
});
