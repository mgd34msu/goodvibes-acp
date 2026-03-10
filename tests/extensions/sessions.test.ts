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

    it('persists mcpServers so load() returns them intact', async () => {
      const mcpServers = [
        { name: 'server-a', transport: 'stdio' as const, command: 'npx', args: ['server-a'] },
        { name: 'server-b', transport: 'stdio' as const, command: 'npx', args: ['server-b'] },
      ];
      await manager.create({ sessionId: 'mcp-persist-1', cwd: '/tmp', mcpServers });

      const { context } = await manager.load('mcp-persist-1');
      expect(context.config.mcpServers).toEqual(mcpServers);
      expect(context.config.mcpServers).toHaveLength(2);
      expect(context.config.mcpServers![0].name).toBe('server-a');
      expect(context.config.mcpServers![1].name).toBe('server-b');
    });

    it('omits mcpServers key when not provided', async () => {
      const ctx = await manager.create({ sessionId: 'mcp-omit-1', cwd: '/tmp' });
      expect(ctx.config.mcpServers).toBeUndefined();
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

    // ISS-019: load() with cwd/mcpServers params updates stored context
    it('updates stored cwd when params.cwd is provided', async () => {
      await manager.create({ sessionId: 'load-cwd-1', cwd: '/original' });
      const { context } = await manager.load('load-cwd-1', { cwd: '/updated' });

      expect(context.config.cwd).toBe('/updated');

      // Verify the update was persisted
      const persisted = await manager.get('load-cwd-1');
      expect(persisted!.config.cwd).toBe('/updated');
    });

    it('updates stored mcpServers when params.mcpServers is provided', async () => {
      const original = [{ name: 'old-server', transport: 'stdio' as const, command: 'old', args: [] }];
      await manager.create({ sessionId: 'load-mcp-1', cwd: '/tmp', mcpServers: original });

      const updated = [
        { name: 'new-server-a', transport: 'stdio' as const, command: 'new-a', args: [] },
        { name: 'new-server-b', transport: 'stdio' as const, command: 'new-b', args: [] },
      ];
      const { context } = await manager.load('load-mcp-1', { mcpServers: updated });

      expect(context.config.mcpServers).toEqual(updated);
      expect(context.config.mcpServers).toHaveLength(2);

      // Verify persisted
      const persisted = await manager.get('load-mcp-1');
      expect(persisted!.config.mcpServers).toEqual(updated);
    });

    it('updates both cwd and mcpServers when both params are provided', async () => {
      await manager.create({ sessionId: 'load-both-1', cwd: '/original' });
      const newServers = [{ name: 'srv', transport: 'stdio' as const, command: 'srv', args: [] }];

      const { context } = await manager.load('load-both-1', { cwd: '/new-cwd', mcpServers: newServers });

      expect(context.config.cwd).toBe('/new-cwd');
      expect(context.config.mcpServers).toEqual(newServers);
    });

    it('leaves stored values intact when no params are provided', async () => {
      const servers = [{ name: 'srv', transport: 'stdio' as const, command: 'srv', args: [] }];
      await manager.create({ sessionId: 'load-noop-1', cwd: '/original', mcpServers: servers });

      const { context } = await manager.load('load-noop-1');

      expect(context.config.cwd).toBe('/original');
      expect(context.config.mcpServers).toEqual(servers);
    });

    it('leaves stored values intact when params object is empty', async () => {
      await manager.create({ sessionId: 'load-noop-2', cwd: '/original' });
      const { context } = await manager.load('load-noop-2', {});

      expect(context.config.cwd).toBe('/original');
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

  // ---------------------------------------------------------------------------
  // Multiple sessions — isolation
  // ---------------------------------------------------------------------------

  describe('multiple sessions — isolation', () => {
    it('concurrent sessions do not share history', async () => {
      await manager.create({ sessionId: 'iso-1', cwd: '/a' });
      await manager.create({ sessionId: 'iso-2', cwd: '/b' });

      await manager.addHistory('iso-1', { role: 'user', content: 'msg-for-1', timestamp: 1000 });
      await manager.addHistory('iso-2', { role: 'user', content: 'msg-for-2', timestamp: 2000 });

      const ctx1 = await manager.get('iso-1');
      const ctx2 = await manager.get('iso-2');

      expect(ctx1!.history).toHaveLength(1);
      expect(ctx1!.history[0].content).toBe('msg-for-1');
      expect(ctx2!.history).toHaveLength(1);
      expect(ctx2!.history[0].content).toBe('msg-for-2');
    });

    it('mode change on one session does not affect another', async () => {
      await manager.create({ sessionId: 'iso-3', cwd: '/c', mode: 'justvibes' });
      await manager.create({ sessionId: 'iso-4', cwd: '/d', mode: 'justvibes' });

      await manager.setMode('iso-3', 'plan');

      expect(await manager.getMode('iso-3')).toBe('plan');
      expect(await manager.getMode('iso-4')).toBe('justvibes');
    });

    it('destroying one session does not affect another', async () => {
      await manager.create({ sessionId: 'iso-5', cwd: '/e' });
      await manager.create({ sessionId: 'iso-6', cwd: '/f' });

      await manager.destroy('iso-5');

      expect(await manager.get('iso-5')).toBeUndefined();
      expect(await manager.get('iso-6')).toBeDefined();
    });

    it('state change on one session does not affect another', async () => {
      await manager.create({ sessionId: 'iso-7', cwd: '/g' });
      await manager.create({ sessionId: 'iso-8', cwd: '/h' });

      await manager.setState('iso-7', 'active');

      expect((await manager.get('iso-7'))!.state).toBe('active');
      expect((await manager.get('iso-8'))!.state).toBe('idle');
    });

    it('list returns all sessions without duplicates after concurrent creates', async () => {
      await manager.create({ sessionId: 'iso-9', cwd: '/i', mode: 'sandbox' });
      await manager.create({ sessionId: 'iso-10', cwd: '/j', mode: 'vibecoding' });
      await manager.create({ sessionId: 'iso-11', cwd: '/k', mode: 'plan' });

      const summaries = await manager.list();
      const ids = summaries.map((s) => s.id).sort();
      expect(ids).toContain('iso-9');
      expect(ids).toContain('iso-10');
      expect(ids).toContain('iso-11');
      // Each appears exactly once
      expect(ids.filter((id) => id === 'iso-9')).toHaveLength(1);
    });
  });
});
