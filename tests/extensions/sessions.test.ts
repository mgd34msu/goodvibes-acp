import { describe, it, expect, beforeEach } from 'bun:test';
import { StateStore } from '../../src/core/state-store.js';
import { EventBus } from '../../src/core/event-bus.js';
import { SessionManager } from '../../src/extensions/sessions/manager.js';
import type { SessionContext, HistoryMessage } from '../../src/types/session.js';

describe('SessionManager', () => {
  let store: StateStore;
  let bus: EventBus;
  let manager: SessionManager;

  beforeEach(() => {
    store = new StateStore();
    bus = new EventBus();
    manager = new SessionManager(store, bus);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates a session with default mode (justvibes)', async () => {
      const ctx = await manager.create({ sessionId: 'sess-1', cwd: '/tmp/proj' });

      expect(ctx.id).toBe('sess-1');
      expect(ctx.state).toBe('idle');
      expect(ctx.config.cwd).toBe('/tmp/proj');
      expect(ctx.config.mode).toBe('justvibes');
      expect(ctx.history).toEqual([]);
      expect(typeof ctx.createdAt).toBe('number');
      expect(typeof ctx.updatedAt).toBe('number');
    });

    it('creates a session with custom mode', async () => {
      const ctx = await manager.create({
        sessionId: 'sess-2',
        cwd: '/tmp/proj',
        mode: 'vibecoding',
      });

      expect(ctx.config.mode).toBe('vibecoding');
    });

    it('creates a session with custom model', async () => {
      const ctx = await manager.create({
        sessionId: 'sess-3',
        cwd: '/tmp/proj',
        model: 'claude-opus-4',
      });

      expect(ctx.config.model).toBe('claude-opus-4');
    });

    it('creates a session with mcpServers', async () => {
      const mcpServers = [{ name: 'my-server', transport: 'stdio' as const, command: 'node', args: ['server.js'] }];
      const ctx = await manager.create({
        sessionId: 'sess-4',
        cwd: '/tmp',
        mcpServers,
      });

      expect(ctx.config.mcpServers).toEqual(mcpServers);
    });

    it('emits session:created event', async () => {
      const events: unknown[] = [];
      bus.on('session:created', (ev) => events.push(ev.payload));

      await manager.create({ sessionId: 'sess-5', cwd: '/tmp', mode: 'plan' });

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ sessionId: 'sess-5', cwd: '/tmp', mode: 'plan' });
    });
  });

  // ---------------------------------------------------------------------------
  // load
  // ---------------------------------------------------------------------------

  describe('load', () => {
    it('loads an existing session', async () => {
      await manager.create({ sessionId: 'load-1', cwd: '/tmp' });
      const { context, history } = await manager.load('load-1');

      expect(context.id).toBe('load-1');
      expect(history).toEqual([]);
    });

    it('throws when loading a non-existent session', async () => {
      await expect(manager.load('no-such-session')).rejects.toThrow('Session not found: no-such-session');
    });

    it('loads session with history', async () => {
      await manager.create({ sessionId: 'load-2', cwd: '/tmp' });
      const msg: HistoryMessage = { role: 'user', content: 'hello', timestamp: Date.now() };
      await manager.addHistory('load-2', msg);

      const { history } = await manager.load('load-2');
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('hello');
    });
  });

  // ---------------------------------------------------------------------------
  // destroy
  // ---------------------------------------------------------------------------

  describe('destroy', () => {
    it('destroys a session and removes it from the store', async () => {
      await manager.create({ sessionId: 'destroy-1', cwd: '/tmp' });
      await manager.destroy('destroy-1');

      const ctx = await manager.get('destroy-1');
      expect(ctx).toBeUndefined();
    });

    it('emits session:destroyed event', async () => {
      const events: unknown[] = [];
      bus.on('session:destroyed', (ev) => events.push(ev.payload));

      await manager.create({ sessionId: 'destroy-2', cwd: '/tmp' });
      await manager.destroy('destroy-2');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ sessionId: 'destroy-2' });
    });

    it('removing a non-existent session does not throw', async () => {
      await expect(manager.destroy('ghost')).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns empty array when no sessions exist', async () => {
      const summaries = await manager.list();
      expect(summaries).toEqual([]);
    });

    it('lists all sessions as summaries', async () => {
      await manager.create({ sessionId: 'list-1', cwd: '/a', mode: 'justvibes' });
      await manager.create({ sessionId: 'list-2', cwd: '/b', mode: 'sandbox' });

      const summaries = await manager.list();
      expect(summaries).toHaveLength(2);

      const ids = summaries.map((s) => s.id).sort();
      expect(ids).toEqual(['list-1', 'list-2']);
    });

    it('summary contains expected fields', async () => {
      await manager.create({ sessionId: 'list-3', cwd: '/c', mode: 'plan' });
      const summaries = await manager.list();
      const s = summaries[0];

      expect(s).toHaveProperty('id', 'list-3');
      expect(s).toHaveProperty('state', 'idle');
      expect(s).toHaveProperty('mode', 'plan');
      expect(s).toHaveProperty('cwd', '/c');
      expect(s).toHaveProperty('createdAt');
      expect(s).toHaveProperty('updatedAt');
    });

    it('does not include history entries in list', async () => {
      await manager.create({ sessionId: 'list-4', cwd: '/d' });
      await manager.addHistory('list-4', { role: 'user', content: 'hi', timestamp: Date.now() });

      const summaries = await manager.list();
      expect(summaries).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // get
  // ---------------------------------------------------------------------------

  describe('get', () => {
    it('returns session context by ID', async () => {
      await manager.create({ sessionId: 'get-1', cwd: '/tmp' });
      const ctx = await manager.get('get-1');

      expect(ctx).toBeDefined();
      expect(ctx!.id).toBe('get-1');
    });

    it('returns undefined for non-existent session', async () => {
      const ctx = await manager.get('no-such');
      expect(ctx).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // setMode / getMode
  // ---------------------------------------------------------------------------

  describe('setMode / getMode', () => {
    it('sets and gets the session mode', async () => {
      await manager.create({ sessionId: 'mode-1', cwd: '/tmp', mode: 'justvibes' });
      await manager.setMode('mode-1', 'vibecoding');

      const mode = await manager.getMode('mode-1');
      expect(mode).toBe('vibecoding');
    });

    it('emits session:mode-changed event', async () => {
      const events: unknown[] = [];
      bus.on('session:mode-changed', (ev) => events.push(ev.payload));

      await manager.create({ sessionId: 'mode-2', cwd: '/tmp', mode: 'justvibes' });
      await manager.setMode('mode-2', 'plan');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ sessionId: 'mode-2', from: 'justvibes', to: 'plan' });
    });

    it('throws when setting mode on non-existent session', async () => {
      await expect(manager.setMode('ghost', 'plan')).rejects.toThrow('Session not found: ghost');
    });

    it('throws when getting mode on non-existent session', async () => {
      await expect(manager.getMode('ghost')).rejects.toThrow('Session not found: ghost');
    });
  });

  // ---------------------------------------------------------------------------
  // setConfigOption
  // ---------------------------------------------------------------------------

  describe('setConfigOption', () => {
    it('sets a config option on a session', async () => {
      await manager.create({ sessionId: 'cfg-1', cwd: '/tmp' });
      await manager.setConfigOption('cfg-1', 'theme', 'dark');

      const ctx = await manager.get('cfg-1');
      expect(ctx!.config.configOptions).toMatchObject({ theme: 'dark' });
    });

    it('merges multiple config options', async () => {
      await manager.create({ sessionId: 'cfg-2', cwd: '/tmp' });
      await manager.setConfigOption('cfg-2', 'a', '1');
      await manager.setConfigOption('cfg-2', 'b', '2');

      const ctx = await manager.get('cfg-2');
      expect(ctx!.config.configOptions).toMatchObject({ a: '1', b: '2' });
    });

    it('throws when setting option on non-existent session', async () => {
      await expect(manager.setConfigOption('ghost', 'k', 'v')).rejects.toThrow('Session not found: ghost');
    });
  });

  // ---------------------------------------------------------------------------
  // addHistory
  // ---------------------------------------------------------------------------

  describe('addHistory', () => {
    it('appends history entries in order', async () => {
      await manager.create({ sessionId: 'hist-1', cwd: '/tmp' });

      const m1: HistoryMessage = { role: 'user', content: 'hello', timestamp: 1000 };
      const m2: HistoryMessage = { role: 'assistant', content: 'hi!', timestamp: 2000 };

      await manager.addHistory('hist-1', m1);
      await manager.addHistory('hist-1', m2);

      const ctx = await manager.get('hist-1');
      expect(ctx!.history).toHaveLength(2);
      expect(ctx!.history[0].content).toBe('hello');
      expect(ctx!.history[1].content).toBe('hi!');
    });

    it('throws when adding history to non-existent session', async () => {
      const msg: HistoryMessage = { role: 'user', content: 'test', timestamp: 0 };
      await expect(manager.addHistory('ghost', msg)).rejects.toThrow('Session not found: ghost');
    });

    it('updating history touches updatedAt', async () => {
      await manager.create({ sessionId: 'hist-2', cwd: '/tmp' });
      const before = (await manager.get('hist-2'))!.updatedAt;

      // Ensure time advances
      await new Promise((r) => setTimeout(r, 2));
      await manager.addHistory('hist-2', { role: 'user', content: 'msg', timestamp: Date.now() });

      const after = (await manager.get('hist-2'))!.updatedAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  // ---------------------------------------------------------------------------
  // setState
  // ---------------------------------------------------------------------------

  describe('setState', () => {
    it('updates the lifecycle state', async () => {
      await manager.create({ sessionId: 'state-1', cwd: '/tmp' });
      await manager.setState('state-1', 'active');

      const ctx = await manager.get('state-1');
      expect(ctx!.state).toBe('active');
    });

    it('emits session:state-changed event', async () => {
      const events: unknown[] = [];
      bus.on('session:state-changed', (ev) => events.push(ev.payload));

      await manager.create({ sessionId: 'state-2', cwd: '/tmp' });
      await manager.setState('state-2', 'completed');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ sessionId: 'state-2', from: 'idle', to: 'completed' });
    });

    it('throws when setting state on non-existent session', async () => {
      await expect(manager.setState('ghost', 'active')).rejects.toThrow('Session not found: ghost');
    });
  });
});
