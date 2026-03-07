import { describe, it, expect, beforeEach } from 'bun:test';
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import { GoodVibesAgent } from '../../src/extensions/acp/agent.js';
import type { Registry } from '../../src/core/registry.js';
import type { EventBus } from '../../src/core/event-bus.js';
import type { SessionManager } from '../../src/extensions/sessions/manager.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WRFCRunner {
  run(params: {
    workId: string;
    sessionId: string;
    task: string;
    signal?: AbortSignal;
  }): Promise<{ state: string; lastScore?: { overall: number } }>;
}

interface McpBridge {
  connectServers(servers: unknown[]): Promise<Array<{ serverId: string }>>;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeConn(): { conn: AgentSideConnection; updates: Array<Record<string, unknown>> } {
  const updates: Array<Record<string, unknown>> = [];
  const conn = {
    sessionUpdate: async (params: Record<string, unknown>) => {
      updates.push(params);
    },
  } as unknown as AgentSideConnection;
  return { conn, updates };
}

function makeRegistry(spawners: Array<{ id: string; capabilities: string[] }> = []): Registry {
  return {
    get: (_key: string) => spawners,
    register: () => {},
    registerMany: () => {},
  } as unknown as Registry;
}

function makeEventBus(): EventBus {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  return {
    emit: (event: string, payload: unknown) => {
      const handlers = listeners.get(event) ?? [];
      handlers.forEach((h) => h(payload));
    },
    on: (event: string, handler: (payload: unknown) => void) => {
      const handlers = listeners.get(event) ?? [];
      listeners.set(event, [...handlers, handler]);
    },
  } as unknown as EventBus;
}

function makeSessions(): {
  sessions: SessionManager;
  store: Map<string, Record<string, unknown>>;
} {
  const store = new Map<string, Record<string, unknown>>();
  const sessions = {
    create: async (params: { sessionId: string; cwd?: string }) => {
      store.set(params.sessionId, {
        id: params.sessionId,
        config: { mode: 'justvibes', model: 'claude-sonnet-4-6' },
      });
    },
    addHistory: async (_sessionId: string, _entry: unknown) => {},
    get: async (sessionId: string) => store.get(sessionId) ?? null,
    setMode: async (_sessionId: string, _mode: string) => {},
    setConfigOption: async (sessionId: string, configId: string, value: string) => {
      const existing = store.get(sessionId) ?? { config: {} };
      const config = (existing.config as Record<string, unknown>) ?? {};
      config[configId === 'mode' ? 'mode' : configId === 'model' ? 'model' : configId] = value;
      store.set(sessionId, { ...existing, config });
    },
  } as unknown as SessionManager;
  return { sessions, store };
}

function makeWrfc(result?: { state: string; lastScore?: { overall: number } }): WRFCRunner {
  return {
    run: async (_params: unknown) =>
      result ?? { state: 'complete', lastScore: { overall: 9.5, dimensions: {}, passed: true } },
  };
}

function makeMcpBridge(
  connected: Array<{ serverId: string }> = [{ serverId: 'mcp-server-1' }],
): { bridge: McpBridge; calls: Array<unknown[]> } {
  const calls: Array<unknown[]> = [];
  const bridge: McpBridge = {
    connectServers: async (servers: unknown[]) => {
      calls.push(servers);
      return connected;
    },
  };
  return { bridge, calls };
}

function makeAgent(
  overrides: {
    conn?: AgentSideConnection;
    registry?: Registry;
    eventBus?: EventBus;
    sessions?: SessionManager;
    wrfc?: WRFCRunner;
    mcpBridge?: McpBridge;
  } = {},
): { agent: GoodVibesAgent; conn: AgentSideConnection; updates: Array<Record<string, unknown>> } {
  const { conn, updates } = makeConn();
  const registry = overrides.registry ?? makeRegistry();
  const eventBus = overrides.eventBus ?? makeEventBus();
  const { sessions } = makeSessions();
  const wrfc = overrides.wrfc ?? makeWrfc();

  const agent = new GoodVibesAgent(
    overrides.conn ?? conn,
    registry,
    eventBus,
    overrides.sessions ?? sessions,
    wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
    overrides.mcpBridge as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[5],
  );

  return { agent, conn: overrides.conn ?? conn, updates };
}

// ---------------------------------------------------------------------------
// initialize()
// ---------------------------------------------------------------------------

describe('GoodVibesAgent', () => {
  describe('initialize()', () => {
    it('returns the PROTOCOL_VERSION constant', async () => {
      const { agent } = makeAgent();
      const result = await agent.initialize({ clientCapabilities: {} });
      expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    });

    it('returns agentInfo with name goodvibes', async () => {
      const { agent } = makeAgent();
      const result = await agent.initialize({ clientCapabilities: {} });
      expect(result.agentInfo.name).toBe('goodvibes');
    });

    it('returns agentCapabilities with loadSession: true', async () => {
      const { agent } = makeAgent();
      const result = await agent.initialize({ clientCapabilities: {} });
      expect(result.agentCapabilities.loadSession).toBe(true);
    });

    it('returns agentCapabilities with promptCapabilities.embeddedContext: true', async () => {
      const { agent } = makeAgent();
      const result = await agent.initialize({ clientCapabilities: {} });
      expect(result.agentCapabilities.promptCapabilities?.embeddedContext).toBe(true);
    });

    it('handles missing clientCapabilities gracefully', async () => {
      const { agent } = makeAgent();
      const result = await agent.initialize({} as schema.InitializeRequest);
      expect(result.protocolVersion).toBe(PROTOCOL_VERSION);
    });
  });

  // -------------------------------------------------------------------------
  // newSession()
  // -------------------------------------------------------------------------

  describe('newSession()', () => {
    it('returns a sessionId string', async () => {
      const { agent } = makeAgent();
      const result = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);
      expect(typeof result.sessionId).toBe('string');
      expect(result.sessionId.length).toBeGreaterThan(0);
    });

    it('returns configOptions in the response', async () => {
      const { agent } = makeAgent();
      const result = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);
      expect(Array.isArray(result.configOptions)).toBe(true);
      expect(result.configOptions.length).toBeGreaterThan(0);
    });

    it('calls sessions.create with the generated sessionId', async () => {
      const { sessions, store } = makeSessions();
      const { agent } = makeAgent({ sessions });
      const result = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);
      expect(store.has(result.sessionId)).toBe(true);
    });

    it('calls mcpBridge.connectServers when mcpServers are provided', async () => {
      const { bridge, calls } = makeMcpBridge();
      const { agent } = makeAgent({ mcpBridge: bridge as unknown as Parameters<typeof makeAgent>[0]['mcpBridge'] });

      await agent.newSession({
        cwd: '/tmp',
        mcpServers: [{ id: 'server-1', uri: 'http://localhost:3001' }],
      } as unknown as schema.NewSessionRequest);

      expect(calls).toHaveLength(1);
      expect((calls[0] as Array<{ id: string }>)[0].id).toBe('server-1');
    });

    it('does not call mcpBridge.connectServers when mcpServers is empty', async () => {
      const { bridge, calls } = makeMcpBridge();
      const { agent } = makeAgent({ mcpBridge: bridge as unknown as Parameters<typeof makeAgent>[0]['mcpBridge'] });

      await agent.newSession({
        cwd: '/tmp',
        mcpServers: [],
      } as unknown as schema.NewSessionRequest);

      expect(calls).toHaveLength(0);
    });

    it('does not call mcpBridge.connectServers when no mcpBridge provided', async () => {
      // Should not throw even without mcpBridge
      const { agent } = makeAgent();
      const result = await agent.newSession({
        cwd: '/tmp',
        mcpServers: [{ id: 'server-1', uri: 'http://localhost:3001' }],
      } as unknown as schema.NewSessionRequest);
      // Resolves to a valid sessionId without error
      expect(typeof result.sessionId).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // prompt()
  // -------------------------------------------------------------------------

  describe('prompt()', () => {
    it('returns stopReason: end_turn on success', async () => {
      const { sessions } = makeSessions();
      const { agent } = makeAgent({ sessions });
      await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      const { sessions: sessions2, store } = makeSessions();
      const result_ns = await new GoodVibesAgent(
        makeConn().conn,
        makeRegistry(),
        makeEventBus(),
        sessions2,
        makeWrfc() as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      ).newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      const { conn: promptConn, updates } = makeConn();
      const wrfc = makeWrfc({ state: 'complete', lastScore: { overall: 9.5 } });
      const agent2 = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions2,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const response = await agent2.prompt({
        sessionId: result_ns.sessionId,
        prompt: [{ type: 'text', text: 'Build a feature' }],
      } as schema.PromptRequest);

      expect(response.stopReason).toBe('end_turn');
    });

    it('streams a session_info_update before running wrfc', async () => {
      const { conn: promptConn, updates } = makeConn();
      const { sessions, store } = makeSessions();
      const wrfc = makeWrfc();

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      await agent.prompt({
        sessionId: nsResult.sessionId,
        prompt: [{ type: 'text', text: 'Do work' }],
      } as schema.PromptRequest);

      const infoUpdate = updates.find(
        (u) => (u.update as Record<string, unknown>)?.sessionUpdate === 'session_info_update',
      );
      expect(infoUpdate).toBeDefined();
    });

    it('streams an agent_message_chunk with the task result summary', async () => {
      const { conn: promptConn, updates } = makeConn();
      const { sessions } = makeSessions();
      const wrfc = makeWrfc({ state: 'complete', lastScore: { overall: 9.5 } });

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      await agent.prompt({
        sessionId: nsResult.sessionId,
        prompt: [{ type: 'text', text: 'Do work' }],
      } as schema.PromptRequest);

      const msgUpdate = updates.find(
        (u) => (u.update as Record<string, unknown>)?.sessionUpdate === 'agent_message_chunk',
      );
      expect(msgUpdate).toBeDefined();
      const content = ((msgUpdate!.update as Record<string, unknown>).content as { text: string }).text;
      expect(content).toContain('9.5');
    });

    it('streams a finish update after the task completes', async () => {
      const { conn: promptConn, updates } = makeConn();
      const { sessions } = makeSessions();
      const wrfc = makeWrfc();

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      await agent.prompt({
        sessionId: nsResult.sessionId,
        prompt: [{ type: 'text', text: 'Do work' }],
      } as schema.PromptRequest);

      const finishUpdate = updates.find(
        (u) => (u.update as Record<string, unknown>)?.sessionUpdate === 'finish',
      );
      expect(finishUpdate).toBeDefined();
    });

    it('returns stopReason: cancelled when controller is aborted during run', async () => {
      let capturedAgent: GoodVibesAgent | null = null;
      let capturedSessionId: string | null = null;

      const { conn: promptConn } = makeConn();
      const { sessions } = makeSessions();

      // wrfc that aborts via cancel() during run
      const wrfc = {
        run: async (params: { sessionId: string; signal?: AbortSignal }) => {
          // Trigger cancel on the agent for this session
          if (capturedAgent && capturedSessionId) {
            await capturedAgent.cancel({ sessionId: capturedSessionId });
          }
          return { state: 'complete' };
        },
      };

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      capturedAgent = agent;

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);
      capturedSessionId = nsResult.sessionId;

      const response = await agent.prompt({
        sessionId: nsResult.sessionId,
        prompt: [{ type: 'text', text: 'Do work' }],
      } as schema.PromptRequest);

      expect(response.stopReason).toBe('cancelled');
    });

    it('handles wrfc errors and streams an error message', async () => {
      const { conn: promptConn, updates } = makeConn();
      const { sessions } = makeSessions();

      const wrfc = {
        run: async () => { throw new Error('Something went wrong'); },
      };

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      const response = await agent.prompt({
        sessionId: nsResult.sessionId,
        prompt: [{ type: 'text', text: 'Do work' }],
      } as schema.PromptRequest);

      expect(response.stopReason).toBe('end_turn');

      const errUpdate = updates.find(
        (u) =>
          (u.update as Record<string, unknown>)?.sessionUpdate === 'agent_message_chunk' &&
          ((u.update as Record<string, unknown>).content as { text: string }).text.includes('Error'),
      );
      expect(errUpdate).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // cancel()
  // -------------------------------------------------------------------------

  describe('cancel()', () => {
    it('aborts the controller so an in-progress prompt returns cancelled', async () => {
      let capturedAgent: GoodVibesAgent | null = null;
      let capturedSessionId: string | null = null;

      const { conn: promptConn } = makeConn();
      const { sessions } = makeSessions();

      const wrfc = {
        run: async (params: { sessionId: string }) => {
          if (capturedAgent && capturedSessionId) {
            await capturedAgent.cancel({ sessionId: capturedSessionId });
          }
          return { state: 'complete' };
        },
      };

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        wrfc as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      capturedAgent = agent;
      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);
      capturedSessionId = nsResult.sessionId;

      const response = await agent.prompt({
        sessionId: nsResult.sessionId,
        prompt: [{ type: 'text', text: 'Task' }],
      } as schema.PromptRequest);

      expect(response.stopReason).toBe('cancelled');
    });

    it('does not throw when cancelling a session with no active prompt', async () => {
      const { agent } = makeAgent();
      await expect(
        agent.cancel({ sessionId: 'non-existent-session' }),
      ).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // extMethod()
  // -------------------------------------------------------------------------

  describe('extMethod()', () => {
    it('_goodvibes/state without sessionId returns runtime info', async () => {
      const { agent } = makeAgent();
      const result = await agent.extMethod('_goodvibes/state', {});
      expect(result.runtime).toBe('goodvibes');
      expect(result.version).toBe('0.1.0');
    });

    it('_goodvibes/state with sessionId returns session context', async () => {
      const { sessions, store } = makeSessions();
      const { conn: promptConn } = makeConn();

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        makeWrfc() as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);
      const sessionId = nsResult.sessionId;

      const result = await agent.extMethod('_goodvibes/state', { sessionId });
      expect(result.session).toBeDefined();
      expect((result.session as Record<string, unknown>).id).toBe(sessionId);
    });

    it('_goodvibes/state with unknown sessionId returns session: null', async () => {
      const { agent } = makeAgent();
      const result = await agent.extMethod('_goodvibes/state', { sessionId: 'nonexistent' });
      expect(result.session).toBeNull();
    });

    it('_goodvibes/agents returns agents from registry', async () => {
      const spawners = [{ id: 'eng-1', capabilities: ['write'] }];
      const registry = makeRegistry(spawners);
      const { conn: promptConn } = makeConn();

      const agent = new GoodVibesAgent(
        promptConn,
        registry,
        makeEventBus(),
        makeSessions().sessions,
        makeWrfc() as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const result = await agent.extMethod('_goodvibes/agents', {});
      expect(result.agents).toEqual(spawners);
    });

    it('throws with METHOD_NOT_FOUND code for unknown method', async () => {
      const { agent } = makeAgent();
      await expect(
        agent.extMethod('_goodvibes/unknown', {}),
      ).rejects.toMatchObject({ code: -32601 });
    });

    it('throws with unknown method message for unrecognized method', async () => {
      const { agent } = makeAgent();
      await expect(
        agent.extMethod('totally/unknown', {}),
      ).rejects.toThrow('Unknown extension method: totally/unknown');
    });
  });

  // -------------------------------------------------------------------------
  // setSessionConfigOption()
  // -------------------------------------------------------------------------

  describe('setSessionConfigOption()', () => {
    it('returns configOptions in the response', async () => {
      const { sessions } = makeSessions();
      const { conn: promptConn } = makeConn();

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        makeWrfc() as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      const result = await agent.setSessionConfigOption({
        sessionId: nsResult.sessionId,
        configId: 'model',
        value: 'claude-opus-4',
      } as schema.SetSessionConfigOptionRequest);

      expect(Array.isArray(result.configOptions)).toBe(true);
    });

    it('configOptions array is non-empty after setting a config option', async () => {
      const { sessions } = makeSessions();
      const { conn: promptConn } = makeConn();

      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        makeEventBus(),
        sessions,
        makeWrfc() as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      const nsResult = await agent.newSession({ cwd: '/tmp' } as schema.NewSessionRequest);

      const result = await agent.setSessionConfigOption({
        sessionId: nsResult.sessionId,
        configId: 'mode',
        value: 'justvibes',
      } as schema.SetSessionConfigOptionRequest);

      expect(result.configOptions.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // extNotification()
  // -------------------------------------------------------------------------

  describe('extNotification()', () => {
    it('emits directive:received on the event bus for _goodvibes/directive', async () => {
      const eventBus = makeEventBus();
      const received: unknown[] = [];
      (eventBus as unknown as { on: (e: string, h: (p: unknown) => void) => void }).on(
        'directive:received',
        (payload: unknown) => received.push(payload),
      );

      const { conn: promptConn } = makeConn();
      const agent = new GoodVibesAgent(
        promptConn,
        makeRegistry(),
        eventBus,
        makeSessions().sessions,
        makeWrfc() as unknown as Parameters<typeof GoodVibesAgent.prototype.constructor>[4],
      );

      await agent.extNotification('_goodvibes/directive', { action: 'stop' });

      expect(received).toHaveLength(1);
      expect((received[0] as Record<string, unknown>).action).toBe('stop');
    });

    it('ignores unknown notifications silently', async () => {
      const { agent } = makeAgent();
      await expect(
        agent.extNotification('_goodvibes/unknown', {}),
      ).resolves.toBeUndefined();
    });
  });
});
