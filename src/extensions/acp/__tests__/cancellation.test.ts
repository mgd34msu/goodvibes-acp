/**
 * @module acp/__tests__/cancellation
 *
 * Tests for ACP cancellation infrastructure:
 * 1. PendingRequestTracker add/remove/drain/delete
 * 2. GoodVibesAgent.cancel() cascades $/cancel_request to pending requests
 * 3. Stop reason propagation from WRFC result to PromptResponse
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type * as schema from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeAgent(opts?: {
  wrfcStopReason?: 'end_turn' | 'max_tokens' | 'max_turn_requests';
  wrfcState?: string;
}) {
  const { GoodVibesAgent } = await import('../agent.js');
  const { SessionManager } = await import('../../sessions/manager.js');
  const { Registry } = await import('../../../core/registry.js');
  const { EventBus } = await import('../../../core/event-bus.js');
  const { StateStore } = await import('../../../core/state-store.js');

  const extNotifications: Array<{ method: string; params: Record<string, unknown> }> = [];
  const sessionUpdates: Array<{ sessionId: string; update: schema.SessionUpdate }> = [];

  const mockConn = {
    sessionUpdate: async (params: { sessionId: string; update: schema.SessionUpdate }) => {
      sessionUpdates.push(params);
    },
    extNotification: async (method: string, params: Record<string, unknown>) => {
      extNotifications.push({ method, params });
    },
  } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

  const stateStore = new StateStore();
  const eventBus = new EventBus();
  const registry = new Registry();
  const sessions = new SessionManager(stateStore, eventBus);

  const stopReason = opts?.wrfcStopReason;
  const state = opts?.wrfcState ?? 'complete';

  const mockWrfc = {
    run: async () => ({
      state,
      ...(stopReason !== undefined ? { stopReason } : {}),
    }),
  };

  const agent = new GoodVibesAgent(
    mockConn,
    registry,
    eventBus,
    sessions,
    mockWrfc,
  );

  // Initialize to set up clientCapabilities
  await agent.initialize({
    protocolVersion: 1 as schema.ProtocolVersion,
    clientCapabilities: {},
    clientInfo: { name: 'test', version: '0.0.1' },
  } as unknown as schema.InitializeRequest);

  return { agent, sessions, extNotifications, sessionUpdates, mockConn };
}

// ---------------------------------------------------------------------------
// 1. PendingRequestTracker — tested via AcpTerminal (which uses RequestTracker)
// ---------------------------------------------------------------------------

describe('PendingRequestTracker — via AcpTerminal RequestTracker interface', () => {
  it('add() registers a request ID and remove() deregisters it', () => {
    const tracked: string[] = [];
    const untracked: string[] = [];

    const tracker = {
      add: (id: string) => tracked.push(id),
      remove: (id: string) => untracked.push(id),
    };

    // Simulate a bridge calling tracker
    tracker.add('req-1');
    tracker.add('req-2');
    tracker.remove('req-1');

    expect(tracked).toContain('req-1');
    expect(tracked).toContain('req-2');
    expect(untracked).toContain('req-1');
    expect(untracked).not.toContain('req-2');
  });

  it('AcpTerminal calls add() before createTerminal and remove() after', async () => {
    const { AcpTerminal } = await import('../terminal-bridge.js');

    const addedIds: string[] = [];
    const removedIds: string[] = [];
    const tracker = {
      add: (id: string) => { addedIds.push(id); },
      remove: (id: string) => { removedIds.push(id); },
    };

    const fakeHandle = {
      currentOutput: async () => ({ output: '', exitStatus: null }),
      waitForExit: async () => ({ exitCode: 0 }),
      kill: async () => {},
      release: async () => {},
    };

    const mockConn = {
      createTerminal: async () => fakeHandle,
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const terminal = new AcpTerminal(
      mockConn,
      'session-1',
      { terminal: true },
      '/tmp',
      tracker,
    );

    await terminal.create({ command: 'echo hello' });

    expect(addedIds.length).toBe(1);
    expect(removedIds.length).toBe(1);
    expect(addedIds[0]).toBe(removedIds[0]);
  });

  it('AcpFileSystem calls add() before readTextFile and remove() after', async () => {
    const { AcpFileSystem } = await import('../fs-bridge.js');

    const addedIds: string[] = [];
    const removedIds: string[] = [];
    const tracker = {
      add: (id: string) => { addedIds.push(id); },
      remove: (id: string) => { removedIds.push(id); },
    };

    const mockConn = {
      readTextFile: async () => ({ content: 'file contents' }),
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const fs = new AcpFileSystem(
      mockConn,
      'session-1',
      { fs: { readTextFile: true, writeTextFile: true } },
      tracker,
    );

    const content = await fs.readTextFile('/some/file.ts');

    expect(content).toBe('file contents');
    expect(addedIds.length).toBe(1);
    expect(removedIds.length).toBe(1);
    expect(addedIds[0]).toBe(removedIds[0]);
  });

  it('AcpFileSystem calls add() before writeTextFile and remove() after', async () => {
    const { AcpFileSystem } = await import('../fs-bridge.js');

    const addedIds: string[] = [];
    const removedIds: string[] = [];
    const tracker = {
      add: (id: string) => { addedIds.push(id); },
      remove: (id: string) => { removedIds.push(id); },
    };

    const mockConn = {
      writeTextFile: async () => {},
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const fs = new AcpFileSystem(
      mockConn,
      'session-1',
      { fs: { readTextFile: true, writeTextFile: true } },
      tracker,
    );

    await fs.writeTextFile('/some/file.ts', 'content');

    expect(addedIds.length).toBe(1);
    expect(removedIds.length).toBe(1);
    expect(addedIds[0]).toBe(removedIds[0]);
  });

  it('PermissionGate calls add() before requestPermission and remove() after', async () => {
    const { PermissionGate } = await import('../permission-gate.js');

    const addedIds: string[] = [];
    const removedIds: string[] = [];
    const tracker = {
      add: (id: string) => { addedIds.push(id); },
      remove: (id: string) => { removedIds.push(id); },
    };

    const mockOutcome: import('@agentclientprotocol/sdk').RequestPermissionOutcome = {
      outcome: 'selected',
      optionId: 'allow_once',
    };

    const mockConn = {
      requestPermission: async () => mockOutcome,
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const gate = new PermissionGate(
      mockConn,
      'session-1',
      { autoApprove: [], alwaysDeny: [], promptForUnknown: true },
      tracker,
    );

    const result = await gate.check({
      type: 'network',
      title: 'Allow network access',
      description: 'Network request to external service',
      toolCallId: 'tool-1',
    });

    expect(result.granted).toBe(true);
    expect(addedIds.length).toBe(1);
    expect(removedIds.length).toBe(1);
    expect(addedIds[0]).toBe(removedIds[0]);
  });

  it('tracker.remove() is called even when requestPermission throws', async () => {
    const { PermissionGate } = await import('../permission-gate.js');

    const removedIds: string[] = [];
    const tracker = {
      add: (_id: string) => {},
      remove: (id: string) => { removedIds.push(id); },
    };

    const mockConn = {
      requestPermission: async () => { throw new Error('network error'); },
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const gate = new PermissionGate(
      mockConn,
      'session-1',
      { autoApprove: [], alwaysDeny: [], promptForUnknown: true },
      tracker,
    );

    // PermissionGate.check() swallows errors and returns denied
    const result = await gate.check({
      type: 'network',
      title: 'Allow network',
      description: 'Network request to external service',
      toolCallId: 'tool-1',
    });

    expect(result.granted).toBe(false);
    // remove() must have been called despite the error
    expect(removedIds.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2. GoodVibesAgent.cancel() — cascading $/cancel_request
// ---------------------------------------------------------------------------

describe('GoodVibesAgent.cancel() — cascading $/cancel_request', () => {
  it('sends $/cancel_request for each ID added via getRequestTracker()', async () => {
    const { agent, sessions, extNotifications } = await makeAgent();

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    // Get a tracker bound to this session and pre-register two pending requests
    const tracker = agent.getRequestTracker(sessionId);
    tracker.add('req-a');
    tracker.add('req-b');

    // Cancel — should drain tracker and send $/cancel_request for each
    await agent.cancel({ sessionId } as unknown as schema.CancelNotification);

    const cancelNotifications = extNotifications.filter(
      (n) => n.method === '$/cancel_request',
    );
    expect(cancelNotifications.length).toBe(2);

    const sentIds = cancelNotifications.map((n) => n.params['id']);
    expect(sentIds).toContain('req-a');
    expect(sentIds).toContain('req-b');
  });

  it('does not send $/cancel_request for IDs removed before cancel()', async () => {
    const { agent, sessions, extNotifications } = await makeAgent();

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    const tracker = agent.getRequestTracker(sessionId);
    tracker.add('req-x');
    tracker.add('req-y');
    // Simulate request completing before cancel
    tracker.remove('req-x');

    await agent.cancel({ sessionId } as unknown as schema.CancelNotification);

    const cancelNotifications = extNotifications.filter(
      (n) => n.method === '$/cancel_request',
    );
    expect(cancelNotifications.length).toBe(1);
    expect(cancelNotifications[0].params['id']).toBe('req-y');
  });

  it('aborts the running prompt AbortController', async () => {
    const { GoodVibesAgent } = await import('../agent.js');
    const { SessionManager } = await import('../../sessions/manager.js');
    const { Registry } = await import('../../../core/registry.js');
    const { EventBus } = await import('../../../core/event-bus.js');
    const { StateStore } = await import('../../../core/state-store.js');

    let capturedSignal: AbortSignal | undefined;
    let resolveRun!: (v: { state: string }) => void;
    const runPromise = new Promise<{ state: string }>((resolve) => {
      resolveRun = resolve;
    });

    const mockConn = {
      sessionUpdate: async () => {},
      extNotification: async () => {},
    } as unknown as import('@agentclientprotocol/sdk').AgentSideConnection;

    const stateStore = new StateStore();
    const eventBus = new EventBus();
    const registry = new Registry();
    const sessions = new SessionManager(stateStore, eventBus);

    const mockWrfc = {
      run: async (params: { signal?: AbortSignal }) => {
        capturedSignal = params.signal;
        return runPromise;
      },
    };

    const agent = new GoodVibesAgent(
      mockConn,
      registry,
      eventBus,
      sessions,
      mockWrfc,
    );

    await agent.initialize({
      protocolVersion: 1 as schema.ProtocolVersion,
      clientCapabilities: {},
      clientInfo: { name: 'test', version: '0.0.1' },
    } as unknown as schema.InitializeRequest);

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    // Start prompt without awaiting
    const promptPromise = agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'hello' }],
    } as unknown as schema.PromptRequest);

    // Give it a tick for wrfc.run to be called and signal to be captured
    await new Promise((r) => setTimeout(r, 10));

    // Cancel and resolve the wrfc run
    await agent.cancel({ sessionId } as unknown as schema.CancelNotification);
    resolveRun({ state: 'cancelled' });

    const response = await promptPromise;

    expect(capturedSignal?.aborted).toBe(true);
    expect(response.stopReason).toBe('cancelled');
  });

  it('sends $/cancel_request for no pending requests (empty drain is silent)', async () => {
    const { agent, extNotifications } = await makeAgent();

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    // Cancel without any active prompt (no pending requests)
    await agent.cancel({ sessionId } as unknown as schema.CancelNotification);

    // No $/cancel_request should be sent
    const cancelNotifications = extNotifications.filter(
      (n) => n.method === '$/cancel_request',
    );
    expect(cancelNotifications.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Stop reason propagation from WRFC result to PromptResponse
// ---------------------------------------------------------------------------

describe('Stop reason propagation — WRFC result to PromptResponse', () => {
  it('returns stopReason=end_turn when wrfc returns no stopReason', async () => {
    const { agent, sessions } = await makeAgent();

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    const response = await agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'do work' }],
    } as unknown as schema.PromptRequest);

    expect(response.stopReason).toBe('end_turn');
  });

  it('returns stopReason=max_tokens when wrfc propagates max_tokens', async () => {
    const { agent, sessions } = await makeAgent({ wrfcStopReason: 'max_tokens' });

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    const response = await agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'do work' }],
    } as unknown as schema.PromptRequest);

    expect(response.stopReason).toBe('max_tokens');
  });

  it('returns stopReason=max_turn_requests when wrfc propagates max_turn_requests', async () => {
    const { agent, sessions } = await makeAgent({ wrfcStopReason: 'max_turn_requests' });

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    const response = await agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'do work' }],
    } as unknown as schema.PromptRequest);

    expect(response.stopReason).toBe('max_turn_requests');
  });

  it('returns stopReason=end_turn for non-max stop reasons (escalated state)', async () => {
    const { agent, sessions } = await makeAgent({ wrfcState: 'escalated' });

    const sessionResp = await agent.newSession({ cwd: '/tmp' } as unknown as schema.NewSessionRequest);
    const sessionId = sessionResp.sessionId;

    const response = await agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: 'do work' }],
    } as unknown as schema.PromptRequest);

    // Non-max stop reason — falls through to end_turn
    expect(response.stopReason).toBe('end_turn');
  });
});
