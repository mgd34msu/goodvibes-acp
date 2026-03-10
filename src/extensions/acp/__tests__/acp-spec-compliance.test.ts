/**
 * @module acp/__tests__/acp-spec-compliance
 *
 * Tests for three ACP spec compliance fixes:
 * 1. Forward `outputByteLimit` in terminal/create (Fix 1)
 * 2. Legacy `modes` field in session/new and session/load responses (Fix 2)
 * 3. `agent_thought_chunk` notification support (Fix 3)
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type * as schema from '@agentclientprotocol/sdk';
import { buildConfigOptions, buildLegacyModes } from '../config-adapter.js';

// ---------------------------------------------------------------------------
// Fix 1: outputByteLimit forwarded to terminal/create
// ---------------------------------------------------------------------------

describe('Fix 1: terminal/create outputByteLimit forwarding', () => {
  it('forwards outputByteLimit to ACP createTerminal when provided', async () => {
    const { AcpTerminal } = await import('../terminal-bridge.js');

    let capturedParams: Record<string, unknown> | null = null;
    const fakeHandle = {
      currentOutput: async () => ({ output: '', exitStatus: null }),
      waitForExit: async () => ({ exitCode: 0 }),
      kill: async () => {},
      release: async () => {},
    };

    const mockConn = {
      createTerminal: async (params: Record<string, unknown>) => {
        capturedParams = params;
        return fakeHandle;
      },
    } as unknown as schema.AgentSideConnection & { createTerminal: (p: Record<string, unknown>) => Promise<typeof fakeHandle> };

    const terminal = new AcpTerminal(
      mockConn as unknown as import('@agentclientprotocol/sdk').AgentSideConnection,
      'session-1',
      { terminal: true },
      '/tmp',
    );

    await terminal.create({
      command: 'echo hello',
      outputByteLimit: 4096,
    });

    expect(capturedParams).not.toBeNull();
    expect((capturedParams as unknown as Record<string, unknown>)['outputByteLimit']).toBe(4096);
  });

  it('omits outputByteLimit from ACP createTerminal when not provided', async () => {
    const { AcpTerminal } = await import('../terminal-bridge.js');

    let capturedParams: Record<string, unknown> | null = null;
    const fakeHandle = {
      currentOutput: async () => ({ output: '', exitStatus: null }),
      waitForExit: async () => ({ exitCode: 0 }),
      kill: async () => {},
      release: async () => {},
    };

    const mockConn = {
      createTerminal: async (params: Record<string, unknown>) => {
        capturedParams = params;
        return fakeHandle;
      },
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const terminal = new AcpTerminal(
      mockConn,
      'session-1',
      { terminal: true },
      '/tmp',
    );

    await terminal.create({ command: 'ls' });

    expect(capturedParams).not.toBeNull();
    expect('outputByteLimit' in (capturedParams as unknown as Record<string, unknown>)).toBe(false);
  });

  it('TerminalCreateOptions type includes outputByteLimit field', () => {
    // Type-level check: this should compile if the type is correct
    const opts: import('../../../types/registry.js').TerminalCreateOptions = {
      command: 'echo',
      outputByteLimit: 8192,
    };
    expect(opts.outputByteLimit).toBe(8192);
  });
});

// ---------------------------------------------------------------------------
// Fix 2: Legacy `modes` field in session/new and session/load responses
// ---------------------------------------------------------------------------

describe('Fix 2: buildLegacyModes — legacy SessionModeState', () => {
  it('returns SessionModeState with currentModeId and availableModes', () => {
    const modes = buildLegacyModes('justvibes');

    expect(modes.currentModeId).toBe('justvibes');
    expect(Array.isArray(modes.availableModes)).toBe(true);
    expect(modes.availableModes.length).toBe(4);
  });

  it('includes all four GoodVibes modes in availableModes', () => {
    const modes = buildLegacyModes();
    const ids = modes.availableModes.map((m) => m.id);

    expect(ids).toContain('justvibes');
    expect(ids).toContain('vibecoding');
    expect(ids).toContain('sandbox');
    expect(ids).toContain('plan');
  });

  it('reflects the passed currentMode in currentModeId', () => {
    expect(buildLegacyModes('vibecoding').currentModeId).toBe('vibecoding');
    expect(buildLegacyModes('sandbox').currentModeId).toBe('sandbox');
    expect(buildLegacyModes('plan').currentModeId).toBe('plan');
  });

  it('defaults currentModeId to justvibes when not provided', () => {
    const modes = buildLegacyModes();
    expect(modes.currentModeId).toBe('justvibes');
  });

  it('each mode entry has required id, name fields', () => {
    const modes = buildLegacyModes();
    for (const mode of modes.availableModes) {
      expect(typeof mode.id).toBe('string');
      expect(typeof mode.name).toBe('string');
    }
  });
});

describe('Fix 2: GoodVibesAgent newSession and loadSession include modes field', () => {
  async function makeAgent() {
    const { GoodVibesAgent } = await import('../agent.js');
    const { SessionManager } = await import('../../sessions/manager.js');
    const { Registry } = await import('../../../core/registry.js');
    const { EventBus } = await import('../../../core/event-bus.js');
    const { StateStore } = await import('../../../core/state-store.js');

    const sessionUpdates: Array<{ sessionId: string; update: schema.SessionUpdate }> = [];
    const mockConn = {
      sessionUpdate: async (params: { sessionId: string; update: schema.SessionUpdate }) => {
        sessionUpdates.push(params);
      },
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const stateStore = new StateStore();
    const eventBus = new EventBus();
    const registry = new Registry();
    const sessions = new SessionManager(stateStore, eventBus);

    const mockWrfc = {
      run: async () => ({ state: 'complete' }),
    };

    const agent = new GoodVibesAgent(
      mockConn,
      registry,
      eventBus,
      sessions,
      mockWrfc,
    );

    return { agent, sessions, sessionUpdates };
  }

  it('newSession response includes modes field with currentModeId', async () => {
    const { agent } = await makeAgent();

    const response = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);

    expect(response.modes).toBeDefined();
    expect(response.modes?.currentModeId).toBe('justvibes');
    expect(Array.isArray(response.modes?.availableModes)).toBe(true);
    expect(response.modes?.availableModes.length).toBe(4);
  });

  it('newSession response also includes configOptions alongside modes', async () => {
    const { agent } = await makeAgent();

    const response = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);

    expect(response.configOptions).toBeDefined();
    expect(response.modes).toBeDefined();
  });

  it('loadSession response includes modes field with correct currentModeId', async () => {
    const { agent, sessions } = await makeAgent();

    // Create a session first so we can load it
    const newResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = newResp.sessionId;

    // Change the mode to vibecoding
    await sessions.setMode(sessionId, 'vibecoding');

    const loadResp = await agent.loadSession({ sessionId } as unknown as schema.LoadSessionRequest);

    expect(loadResp.modes).toBeDefined();
    expect(loadResp.modes?.currentModeId).toBe('vibecoding');
    expect(Array.isArray(loadResp.modes?.availableModes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix 3: agent_thought_chunk notification
// ---------------------------------------------------------------------------

describe('Fix 3: agent_thought_chunk — AgentProgressEvent type', () => {
  it('AgentProgressEvent union includes agent_thought_chunk variant', () => {
    // Type-level check: this should compile
    const event: import('../../../types/agent.js').AgentProgressEvent = {
      type: 'agent_thought_chunk',
      chunk: { type: 'text', text: 'I am thinking...' },
    };
    expect(event.type).toBe('agent_thought_chunk');
  });
});

describe('Fix 3: agent_thought_chunk — ToolCallEmitter.emitThoughtChunk', () => {
  it('emits agent_thought_chunk session update with correct discriminator', async () => {
    const { ToolCallEmitter } = await import('../tool-call-emitter.js');

    const emittedUpdates: Array<{ sessionId: string; update: schema.SessionUpdate }> = [];
    const mockConn = {
      sessionUpdate: async (params: { sessionId: string; update: schema.SessionUpdate }) => {
        emittedUpdates.push(params);
      },
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const emitter = new ToolCallEmitter(mockConn);
    await emitter.emitThoughtChunk('session-abc', 'The answer is 42');

    expect(emittedUpdates.length).toBe(1);
    const update = emittedUpdates[0]!.update as { sessionUpdate: string; content: { type: string; text: string } };
    expect(update.sessionUpdate).toBe('agent_thought_chunk');
    expect(update.content.type).toBe('text');
    expect(update.content.text).toBe('The answer is 42');
    expect(emittedUpdates[0]!.sessionId).toBe('session-abc');
  });
});

describe('Fix 3: agent_thought_chunk — McpToolCallBridge progress handler', () => {
  it('forwards agent_thought_chunk progress events to ToolCallEmitter.emitThoughtChunk', async () => {
    const { McpToolCallBridge } = await import('../../mcp/tool-call-bridge.js');

    const thoughtChunksEmitted: Array<{ sessionId: string; text: string }> = [];
    const mockEmitter = {
      emitThoughtChunk: async (sessionId: string, text: string) => {
        thoughtChunksEmitted.push({ sessionId, text });
      },
      emitToolCall: async () => {},
      emitToolCallUpdate: async () => {},
    } as unknown as import('../tool-call-emitter.js').ToolCallEmitter;

    const bridge = new McpToolCallBridge(() => mockEmitter);
    const handler = bridge.makeProgressHandler('session-xyz');

    handler({ type: 'agent_thought_chunk', chunk: { type: 'text', text: 'Thinking step 1' } });

    // Allow the async fire-and-forget to settle
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(thoughtChunksEmitted.length).toBe(1);
    expect(thoughtChunksEmitted[0]!.sessionId).toBe('session-xyz');
    expect(thoughtChunksEmitted[0]!.text).toBe('Thinking step 1');
  });

  it('does not emit tool_call updates for agent_thought_chunk events', async () => {
    const { McpToolCallBridge } = await import('../../mcp/tool-call-bridge.js');

    const toolCallsEmitted: unknown[] = [];
    const thoughtChunksEmitted: unknown[] = [];
    const mockEmitter = {
      emitThoughtChunk: async (_: string, text: string) => {
        thoughtChunksEmitted.push(text);
      },
      emitToolCall: async (...args: unknown[]) => {
        toolCallsEmitted.push(args);
      },
      emitToolCallUpdate: async (...args: unknown[]) => {
        toolCallsEmitted.push(args);
      },
    } as unknown as import('../tool-call-emitter.js').ToolCallEmitter;

    const bridge = new McpToolCallBridge(() => mockEmitter);
    const handler = bridge.makeProgressHandler('session-xyz');

    handler({ type: 'agent_thought_chunk', chunk: { type: 'text', text: 'Reasoning...' } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(toolCallsEmitted.length).toBe(0);
    expect(thoughtChunksEmitted.length).toBe(1);
  });
});

describe('Fix 3: agent_thought_chunk — loadSession history replay', () => {
  it('replays thinking-role history messages as agent_thought_chunk updates', async () => {
    const { GoodVibesAgent } = await import('../agent.js');
    const { SessionManager } = await import('../../sessions/manager.js');
    const { Registry } = await import('../../../core/registry.js');
    const { EventBus } = await import('../../../core/event-bus.js');
    const { StateStore } = await import('../../../core/state-store.js');

    const sessionUpdates: Array<{ sessionId: string; update: schema.SessionUpdate }> = [];
    const mockConn = {
      sessionUpdate: async (params: { sessionId: string; update: schema.SessionUpdate }) => {
        sessionUpdates.push(params);
      },
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const stateStore = new StateStore();
    const eventBus = new EventBus();
    const registry = new Registry();
    const sessions = new SessionManager(stateStore, eventBus);
    const mockWrfc = { run: async () => ({ state: 'complete' }) };

    const agent = new GoodVibesAgent(mockConn, registry, eventBus, sessions, mockWrfc);

    // Create a session
    const newResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = newResp.sessionId;

    // Add a thinking message to history
    await sessions.addHistory(sessionId, {
      role: 'thinking',
      content: 'I need to reason about this...',
      timestamp: Date.now(),
    });
    await sessions.addHistory(sessionId, {
      role: 'assistant',
      content: 'Here is the answer.',
      timestamp: Date.now(),
    });

    // Clear captured updates before loadSession
    sessionUpdates.length = 0;

    await agent.loadSession({ sessionId } as unknown as schema.LoadSessionRequest);

    const updateTypes = sessionUpdates.map(
      (u) => (u.update as { sessionUpdate: string }).sessionUpdate,
    );

    expect(updateTypes).toContain('agent_thought_chunk');
    expect(updateTypes).toContain('agent_message_chunk');

    const thoughtUpdate = sessionUpdates.find(
      (u) => (u.update as { sessionUpdate: string }).sessionUpdate === 'agent_thought_chunk',
    );
    const content = (thoughtUpdate?.update as { content?: { text?: string } })?.content;
    expect(content?.text).toBe('I need to reason about this...');
  });
});

describe('Fix 3: agent_thought_chunk — AgentLoop thinking_delta streaming', () => {
  it('emits agent_thought_chunk progress event when thinking_delta chunk received', async () => {
    const { AgentLoop } = await import('../../../plugins/agents/loop.js');

    const progressEvents: import('../../../types/agent.js').AgentProgressEvent[] = [];

    async function* mockStream(): AsyncGenerator<import('../../../types/llm.js').ChatChunk> {
      yield { type: 'thinking_delta', thinking: 'Reasoning about the task...' };
      yield { type: 'text_delta', text: 'Final answer.' };
      yield { type: 'stop', stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 5 } };
    }

    const mockProvider = {
      name: 'mock',
      chat: async () => ({ content: [], stopReason: 'end_turn' as const, usage: { inputTokens: 0, outputTokens: 0 } }),
      stream: () => mockStream(),
    };

    const loop = new AgentLoop({
      provider: mockProvider,
      tools: [],
      model: 'claude-sonnet-4-6',
      systemPrompt: 'You are helpful.',
      maxTurns: 1,
      streaming: true,
      onProgress: (event) => { progressEvents.push(event); },
    });

    await loop.run('Test task');

    const thoughtEvents = progressEvents.filter((e) => e.type === 'agent_thought_chunk');
    expect(thoughtEvents.length).toBe(1);
    expect((thoughtEvents[0] as { chunk: { text: string } }).chunk.text).toBe('Reasoning about the task...');
  });
});
