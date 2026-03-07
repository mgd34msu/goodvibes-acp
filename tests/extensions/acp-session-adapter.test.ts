import { describe, it, expect, beforeEach } from 'bun:test';
import { SessionAdapter } from '../../src/extensions/acp/session-adapter.js';
import { SessionManager } from '../../src/extensions/sessions/manager.js';
import { EventBus } from '../../src/core/event-bus.js';
import { StateStore } from '../../src/core/state-store.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SessionUpdateCall = {
  sessionId: string;
  update: Record<string, unknown>;
};

function makeConn(): { conn: AgentSideConnection; calls: SessionUpdateCall[] } {
  const calls: SessionUpdateCall[] = [];
  const conn = {
    sessionUpdate: async (params: SessionUpdateCall) => {
      calls.push(params);
    },
  } as unknown as AgentSideConnection;
  return { conn, calls };
}

function makeThrowingConn(): AgentSideConnection {
  return {
    sessionUpdate: async () => {
      throw new Error('ACP connection error');
    },
  } as unknown as AgentSideConnection;
}

// ---------------------------------------------------------------------------
// SessionAdapter
// ---------------------------------------------------------------------------

describe('SessionAdapter', () => {
  let bus: EventBus;
  let sessions: SessionManager;

  beforeEach(() => {
    const store = new StateStore();
    bus = new EventBus();
    sessions = new SessionManager(store, bus);
  });

  // -------------------------------------------------------------------------
  // register() / basic bridging
  // -------------------------------------------------------------------------

  describe('register()', () => {
    it('forwards session:created as sessionUpdate with session_info_update type', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-1', cwd: '/tmp', mode: 'justvibes' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      expect(calls[0].sessionId).toBe('adapt-1');
      expect(calls[0].update.sessionUpdate).toBe('session_info_update');
    });

    it('session:created update title includes the mode', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-2', cwd: '/tmp', mode: 'vibecoding' });
      await new Promise((r) => setTimeout(r, 0));

      const title = calls[0].update.title as string;
      expect(title).toContain('vibecoding');
    });

    it('session:created update has updatedAt ISO string', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-3', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));

      const updatedAt = calls[0].update.updatedAt as string;
      expect(typeof updatedAt).toBe('string');
      expect(() => new Date(updatedAt)).not.toThrow();
      expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
    });

    it('forwards session:destroyed as sessionUpdate', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-4', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0; // clear create call

      await sessions.destroy('adapt-4');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      expect(calls[0].sessionId).toBe('adapt-4');
      expect(calls[0].update.sessionUpdate).toBe('session_info_update');
    });

    it('session:destroyed update title is "Session ended"', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-5', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      await sessions.destroy('adapt-5');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls[0].update.title).toBe('Session ended');
    });

    it('forwards session:state-changed as sessionUpdate', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-6', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      await sessions.setState('adapt-6', 'active');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      expect(calls[0].sessionId).toBe('adapt-6');
      expect(calls[0].update.sessionUpdate).toBe('session_info_update');
    });

    it('session:state-changed update title shows from and to states', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-7', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      await sessions.setState('adapt-7', 'completed');
      await new Promise((r) => setTimeout(r, 0));

      const title = calls[0].update.title as string;
      expect(title).toContain('idle');
      expect(title).toContain('completed');
    });

    it('forwards session:mode-changed as sessionUpdate', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-8', cwd: '/tmp', mode: 'justvibes' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      await sessions.setMode('adapt-8', 'plan');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      expect(calls[0].sessionId).toBe('adapt-8');
      expect(calls[0].update.sessionUpdate).toBe('session_info_update');
    });

    it('session:mode-changed update title includes the new mode', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'adapt-9', cwd: '/tmp', mode: 'justvibes' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      await sessions.setMode('adapt-9', 'sandbox');
      await new Promise((r) => setTimeout(r, 0));

      const title = calls[0].update.title as string;
      expect(title).toContain('sandbox');
    });

    it('does not forward events before register() is called', async () => {
      const { conn, calls } = makeConn();
      // Intentionally NOT calling adapter.register()
      new SessionAdapter(conn, sessions, bus);

      await sessions.create({ sessionId: 'adapt-10', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // register() idempotency
  // -------------------------------------------------------------------------

  describe('register() idempotency', () => {
    it('calling register() twice does not double-emit sessionUpdate', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();
      adapter.register(); // second call should be no-op

      await sessions.create({ sessionId: 'idem-1', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));

      // Should only get one call, not two
      expect(calls).toHaveLength(1);
    });

    it('calling register() three times still emits only once per event', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();
      adapter.register();
      adapter.register();

      await sessions.create({ sessionId: 'idem-2', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // unregister()
  // -------------------------------------------------------------------------

  describe('unregister()', () => {
    it('stops forwarding session:created after unregister()', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();
      adapter.unregister();

      await sessions.create({ sessionId: 'unreg-1', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });

    it('stops forwarding session:destroyed after unregister()', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'unreg-2', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      adapter.unregister();
      await sessions.destroy('unreg-2');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });

    it('stops forwarding session:state-changed after unregister()', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'unreg-3', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      adapter.unregister();
      await sessions.setState('unreg-3', 'active');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });

    it('stops forwarding session:mode-changed after unregister()', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      await sessions.create({ sessionId: 'unreg-4', cwd: '/tmp', mode: 'justvibes' });
      await new Promise((r) => setTimeout(r, 0));
      calls.length = 0;

      adapter.unregister();
      await sessions.setMode('unreg-4', 'plan');
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(0);
    });

    it('can re-register after unregister()', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();
      adapter.unregister();
      adapter.register();

      await sessions.create({ sessionId: 'unreg-5', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
    });

    it('calling unregister() without prior register() does not throw', () => {
      const { conn } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      expect(() => adapter.unregister()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Error swallowing (_safeSessionUpdate)
  // -------------------------------------------------------------------------

  describe('conn.sessionUpdate error swallowing', () => {
    it('does not throw when conn.sessionUpdate rejects on session:created', async () => {
      const conn = makeThrowingConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      expect(() => {
        void sessions.create({ sessionId: 'err-1', cwd: '/tmp' });
      }).not.toThrow();

      await new Promise((r) => setTimeout(r, 10));
      // No unhandled rejection — reaching here is the assertion
    });

    it('does not throw when conn.sessionUpdate rejects on session:destroyed', async () => {
      // Use a good conn to create, then swap to throwing conn
      const { conn: goodConn } = makeConn();
      const adapter = new SessionAdapter(goodConn, sessions, bus);
      adapter.register();
      await sessions.create({ sessionId: 'err-2', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      adapter.unregister();

      const throwingAdapter = new SessionAdapter(makeThrowingConn(), sessions, bus);
      throwingAdapter.register();

      expect(() => {
        void sessions.destroy('err-2');
      }).not.toThrow();

      await new Promise((r) => setTimeout(r, 10));
    });

    it('does not throw when conn.sessionUpdate rejects on session:state-changed', async () => {
      const { conn: goodConn } = makeConn();
      const goodAdapter = new SessionAdapter(goodConn, sessions, bus);
      goodAdapter.register();
      await sessions.create({ sessionId: 'err-3', cwd: '/tmp' });
      await new Promise((r) => setTimeout(r, 0));
      goodAdapter.unregister();

      const throwingAdapter = new SessionAdapter(makeThrowingConn(), sessions, bus);
      throwingAdapter.register();

      expect(() => {
        void sessions.setState('err-3', 'active');
      }).not.toThrow();

      await new Promise((r) => setTimeout(r, 10));
    });

    it('does not throw when conn.sessionUpdate rejects on session:mode-changed', async () => {
      const { conn: goodConn } = makeConn();
      const goodAdapter = new SessionAdapter(goodConn, sessions, bus);
      goodAdapter.register();
      await sessions.create({ sessionId: 'err-4', cwd: '/tmp', mode: 'justvibes' });
      await new Promise((r) => setTimeout(r, 0));
      goodAdapter.unregister();

      const throwingAdapter = new SessionAdapter(makeThrowingConn(), sessions, bus);
      throwingAdapter.register();

      expect(() => {
        void sessions.setMode('err-4', 'plan');
      }).not.toThrow();

      await new Promise((r) => setTimeout(r, 10));
    });
  });

  // -------------------------------------------------------------------------
  // session:mode-changed — session not found
  // -------------------------------------------------------------------------

  describe('session:mode-changed with missing session context', () => {
    it('does not call sessionUpdate when sessions.get() returns undefined', async () => {
      const { conn, calls } = makeConn();
      const adapter = new SessionAdapter(conn, sessions, bus);
      adapter.register();

      // Emit mode-changed directly on the bus for a session that was never created
      // (bypasses SessionManager so sessions.get() returns undefined)
      bus.emit('session:mode-changed', { sessionId: 'ghost', from: 'justvibes', to: 'plan' });
      await new Promise((r) => setTimeout(r, 10));

      expect(calls).toHaveLength(0);
    });
  });
});
