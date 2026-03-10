/**
 * Tests for session/list implementation:
 * - SessionManager.list() with title
 * - SessionManager.addHistory() title auto-generation
 * - SessionManager.setTitle()
 * - GoodVibesAgent.unstable_listSessions() with filtering, pagination, cursor
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { SessionManager } from '../manager.js';
import { StateStore } from '../../../core/state-store.js'; // needed by makeManager
import { EventBus } from '../../../core/event-bus.js';
import { GoodVibesAgent } from '../../acp/agent.js';
import { Registry } from '../../../core/registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManager(): { manager: SessionManager; store: StateStore; bus: EventBus } {
  const store = new StateStore();
  const bus = new EventBus();
  const manager = new SessionManager(store, bus);
  return { manager, store, bus };
}

/** Build a minimal GoodVibesAgent with only sessions wired */
function makeAgent(manager: SessionManager): GoodVibesAgent {
  const registry = new Registry();
  const bus = new EventBus();

  // Minimal no-op conn stub
  const conn = {
    sessionUpdate: async () => {},
    extNotification: async () => {},
  } as never;

  // Minimal no-op wrfc stub
  const wrfc = {
    run: async () => ({ state: 'complete' as const }),
  } as never;

  // Constructor: (conn, registry, eventBus, sessions, wrfc, mcpBridge?, deps?)
  return new GoodVibesAgent(conn, registry, bus, manager, wrfc);
}

async function createSession(
  manager: SessionManager,
  opts: { sessionId?: string; cwd?: string } = {},
): Promise<string> {
  const sessionId = opts.sessionId ?? crypto.randomUUID();
  await manager.create({ sessionId, cwd: opts.cwd ?? '/home/user/project' });
  return sessionId;
}

// ---------------------------------------------------------------------------
// SessionManager.list() — title field included
// ---------------------------------------------------------------------------

describe('SessionManager.list() — title', () => {
  it('returns empty array when no sessions', async () => {
    const { manager } = makeManager();
    const result = await manager.list();
    expect(result).toEqual([]);
  });

  it('returns session without title when no history added', async () => {
    const { manager } = makeManager();
    await createSession(manager, { sessionId: 'sess-1' });
    const list = await manager.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe('sess-1');
    expect(list[0]!.title).toBeUndefined();
  });

  it('includes title in summary after first user message', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager, { sessionId: 'sess-2' });
    await manager.addHistory(id, { role: 'user', content: 'Hello world', timestamp: Date.now() });
    const list = await manager.list();
    expect(list[0]!.title).toBe('Hello world');
  });

  it('returns multiple sessions', async () => {
    const { manager } = makeManager();
    await createSession(manager, { sessionId: 'a' });
    await createSession(manager, { sessionId: 'b' });
    await createSession(manager, { sessionId: 'c' });
    const list = await manager.list();
    expect(list).toHaveLength(3);
    expect(list.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// SessionManager.addHistory() — title auto-generation
// ---------------------------------------------------------------------------

describe('SessionManager.addHistory() — title auto-generation', () => {
  it('auto-generates title from first user string message', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.addHistory(id, { role: 'user', content: 'Implement session list', timestamp: Date.now() });
    const ctx = await manager.get(id);
    expect(ctx?.title).toBe('Implement session list');
  });

  it('truncates title to 100 chars', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    const longMsg = 'A'.repeat(200);
    await manager.addHistory(id, { role: 'user', content: longMsg, timestamp: Date.now() });
    const ctx = await manager.get(id);
    expect(ctx?.title).toBe('A'.repeat(100));
  });

  it('does not override title with subsequent user messages', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.addHistory(id, { role: 'user', content: 'First message', timestamp: Date.now() });
    await manager.addHistory(id, { role: 'user', content: 'Second message', timestamp: Date.now() });
    const ctx = await manager.get(id);
    expect(ctx?.title).toBe('First message');
  });

  it('does not generate title from assistant messages', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.addHistory(id, { role: 'assistant', content: 'I can help', timestamp: Date.now() });
    const ctx = await manager.get(id);
    expect(ctx?.title).toBeUndefined();
  });

  it('auto-generates title from content blocks (text type)', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.addHistory(id, {
      role: 'user',
      content: [{ type: 'text', text: 'Fix the bug' }],
      timestamp: Date.now(),
    });
    const ctx = await manager.get(id);
    expect(ctx?.title).toBe('Fix the bug');
  });

  it('generates no title from empty text content', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.addHistory(id, { role: 'user', content: '   ', timestamp: Date.now() });
    const ctx = await manager.get(id);
    expect(ctx?.title).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SessionManager.setTitle()
// ---------------------------------------------------------------------------

describe('SessionManager.setTitle()', () => {
  it('sets title on an existing session', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.setTitle(id, 'My custom title');
    const ctx = await manager.get(id);
    expect(ctx?.title).toBe('My custom title');
  });

  it('overwrites an existing title', async () => {
    const { manager } = makeManager();
    const id = await createSession(manager);
    await manager.setTitle(id, 'First');
    await manager.setTitle(id, 'Second');
    const ctx = await manager.get(id);
    expect(ctx?.title).toBe('Second');
  });

  it('is a no-op for non-existent sessions', async () => {
    const { manager } = makeManager();
    // Should not throw
    await manager.setTitle('nonexistent-id', 'title');
  });

  it('emits session:title-set event', async () => {
    const { manager, bus } = makeManager();
    const id = await createSession(manager);
    const events: unknown[] = [];
    bus.on('session:title-set', (e) => { events.push(e); });
    await manager.setTitle(id, 'My Title');
    expect(events).toHaveLength(1);
    expect((events[0] as { payload: { sessionId: string; title: string } }).payload.sessionId).toBe(id);
    expect((events[0] as { payload: { sessionId: string; title: string } }).payload.title).toBe('My Title');
  });
});

// ---------------------------------------------------------------------------
// GoodVibesAgent.unstable_listSessions()
// ---------------------------------------------------------------------------

describe('GoodVibesAgent.unstable_listSessions()', () => {
  let manager: SessionManager;
  let agent: GoodVibesAgent;

  beforeEach(() => {
    const m = makeManager();
    manager = m.manager;
    agent = makeAgent(manager);
  });

  it('returns empty sessions array when no sessions exist', async () => {
    const result = await agent.unstable_listSessions({});
    expect(result.sessions).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it('returns all sessions on first page (fewer than PAGE_SIZE)', async () => {
    await createSession(manager, { sessionId: 'a', cwd: '/proj/a' });
    await createSession(manager, { sessionId: 'b', cwd: '/proj/b' });
    const result = await agent.unstable_listSessions({});
    expect(result.sessions).toHaveLength(2);
    expect(result.nextCursor).toBeUndefined();
  });

  it('returns correct SessionInfo fields', async () => {
    const id = await createSession(manager, { cwd: '/home/user/project' });
    await manager.addHistory(id, { role: 'user', content: 'Hello world', timestamp: Date.now() });
    const result = await agent.unstable_listSessions({});
    expect(result.sessions).toHaveLength(1);
    const info = result.sessions[0]!;
    expect(info.sessionId).toBe(id);
    expect(info.cwd).toBe('/home/user/project');
    expect(info.title).toBe('Hello world');
    expect(typeof info.updatedAt).toBe('string');
    // updatedAt should be ISO 8601
    expect(() => new Date(info.updatedAt!)).not.toThrow();
    expect(info._meta).toBeDefined();
  });

  it('omits title when session has no title', async () => {
    await createSession(manager, { sessionId: 'no-title' });
    const result = await agent.unstable_listSessions({});
    const info = result.sessions[0]!;
    expect(info.title).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // cwd filtering
  // -------------------------------------------------------------------------

  it('filters sessions by cwd', async () => {
    await createSession(manager, { sessionId: 'a', cwd: '/proj/alpha' });
    await createSession(manager, { sessionId: 'b', cwd: '/proj/beta' });
    await createSession(manager, { sessionId: 'c', cwd: '/proj/alpha' });
    const result = await agent.unstable_listSessions({ cwd: '/proj/alpha' });
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions.every((s) => s.cwd === '/proj/alpha')).toBe(true);
  });

  it('returns empty array when cwd filter matches nothing', async () => {
    await createSession(manager, { cwd: '/proj/other' });
    const result = await agent.unstable_listSessions({ cwd: '/proj/nowhere' });
    expect(result.sessions).toEqual([]);
    expect(result.nextCursor).toBeUndefined();
  });

  it('returns all sessions when cwd filter is absent', async () => {
    await createSession(manager, { cwd: '/a' });
    await createSession(manager, { cwd: '/b' });
    const result = await agent.unstable_listSessions({});
    expect(result.sessions).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  it('returns nextCursor when results exceed page size (20)', async () => {
    // Create 25 sessions
    for (let i = 0; i < 25; i++) {
      await createSession(manager, { cwd: '/proj' });
    }
    const result = await agent.unstable_listSessions({});
    expect(result.sessions).toHaveLength(20);
    expect(result.nextCursor).toBeDefined();
    expect(typeof result.nextCursor).toBe('string');
  });

  it('second page returns remaining items and no nextCursor', async () => {
    for (let i = 0; i < 25; i++) {
      await createSession(manager, { cwd: '/proj' });
    }
    const page1 = await agent.unstable_listSessions({});
    expect(page1.nextCursor).toBeDefined();

    const page2 = await agent.unstable_listSessions({ cursor: page1.nextCursor! });
    expect(page2.sessions).toHaveLength(5);
    expect(page2.nextCursor).toBeUndefined();
  });

  it('pages are non-overlapping and cover all sessions', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 22; i++) {
      const id = await createSession(manager, { cwd: '/proj' });
      ids.add(id);
    }
    const page1 = await agent.unstable_listSessions({});
    const page2 = await agent.unstable_listSessions({ cursor: page1.nextCursor! });
    const all = [...page1.sessions, ...page2.sessions];
    expect(all).toHaveLength(22);
    // No duplicates
    const seen = new Set(all.map((s) => s.sessionId));
    expect(seen.size).toBe(22);
    // All original IDs covered
    for (const id of ids) {
      expect(seen.has(id)).toBe(true);
    }
  });

  it('exact page size boundary — 20 sessions yields no nextCursor', async () => {
    for (let i = 0; i < 20; i++) {
      await createSession(manager, { cwd: '/proj' });
    }
    const result = await agent.unstable_listSessions({});
    expect(result.sessions).toHaveLength(20);
    expect(result.nextCursor).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Invalid cursor
  // -------------------------------------------------------------------------

  it('throws on invalid cursor (non-base64)', async () => {
    await expect(agent.unstable_listSessions({ cursor: '!!!not-base64!!!' })).rejects.toThrow();
  });

  it('throws on cursor that decodes to invalid value', async () => {
    // Valid base64 but not a JSON integer
    const badCursor = Buffer.from(JSON.stringify('not-a-number')).toString('base64');
    await expect(agent.unstable_listSessions({ cursor: badCursor })).rejects.toThrow();
  });

  it('throws on cursor decoding to zero (page must be >= 1)', async () => {
    const badCursor = Buffer.from(JSON.stringify(0)).toString('base64');
    await expect(agent.unstable_listSessions({ cursor: badCursor })).rejects.toThrow();
  });

  it('cursor error has INVALID_PARAMS code (-32602)', async () => {
    const badCursor = Buffer.from(JSON.stringify(-1)).toString('base64');
    let caught: (Error & { code?: number }) | undefined;
    try {
      await agent.unstable_listSessions({ cursor: badCursor });
    } catch (e) {
      caught = e as Error & { code?: number };
    }
    expect(caught).toBeDefined();
    expect(caught?.code).toBe(-32602);
  });

  it('handles empty cursor string as first page', async () => {
    await createSession(manager, { sessionId: 'only-one' });
    const result = await agent.unstable_listSessions({ cursor: '' });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.sessionId).toBe('only-one');
  });

  it('handles null cursor as first page', async () => {
    await createSession(manager, { sessionId: 'only-one' });
    const result = await agent.unstable_listSessions({ cursor: null });
    expect(result.sessions).toHaveLength(1);
  });
});
