/**
 * Tests for McpToolCallBridge.
 *
 * Covers:
 *   - Constructor creates instance
 *   - makeProgressHandler(sessionId) returns a function
 *   - tool_start emits emitToolCall (kind) + emitToolCallUpdate (in_progress)
 *   - tool_complete emits emitToolCallUpdate (completed) with durationMs meta
 *   - tool_error emits emitToolCallUpdate (failed) with error meta
 *   - No-ops gracefully when emitter getter returns null
 *   - Multiple concurrent tool executions tracked independently (FIFO queue)
 *   - inferKind: read, edit, execute, search, fetch, delete, move, other
 *   - _formatToolTitle: 3-part, 2-part, plain name
 */
import { describe, test, expect } from 'bun:test';
import { McpToolCallBridge } from '../../src/extensions/mcp/tool-call-bridge.ts';
import type { ToolCallEmitter } from '../../src/extensions/acp/tool-call-emitter.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EmitterCall =
  | { method: 'emitToolCall'; sessionId: string; toolCallId: string; name: string; title: string; kind: string; meta?: Record<string, unknown> }
  | { method: 'emitToolCallUpdate'; sessionId: string; toolCallId: string; status: string; meta?: Record<string, unknown>; content?: unknown[] };

function makeEmitter(): { emitter: ToolCallEmitter; calls: EmitterCall[] } {
  const calls: EmitterCall[] = [];
  const emitter = {
    emitToolCall: async (
      sessionId: string,
      toolCallId: string,
      name: string,
      title: string,
      kind: string,
      meta?: Record<string, unknown>,
    ) => {
      calls.push({ method: 'emitToolCall', sessionId, toolCallId, name, title, kind, meta });
    },
    emitToolCallUpdate: async (
      sessionId: string,
      toolCallId: string,
      status: string,
      meta?: Record<string, unknown>,
      content?: unknown[],
    ) => {
      calls.push({ method: 'emitToolCallUpdate', sessionId, toolCallId, status, meta, content });
    },
  } as unknown as ToolCallEmitter;
  return { emitter, calls };
}

/**
 * Wait for all pending micro/macro tasks to settle.
 * tool_start emits emitToolCall, then .then() chains emitToolCallUpdate — both
 * are async, so we need to flush the microtask queue twice.
 */
async function settle(): Promise<void> {
  // Flush microtasks twice to allow the .then() chain to resolve
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const SESSION_ID = 'sess-test';

// ---------------------------------------------------------------------------
// McpToolCallBridge — constructor
// ---------------------------------------------------------------------------

describe('McpToolCallBridge', () => {
  describe('constructor', () => {
    test('creates instance without error', () => {
      const bridge = new McpToolCallBridge((_sessionId) => null);
      expect(bridge).toBeInstanceOf(McpToolCallBridge);
    });

    test('getter receives the sessionId when called', async () => {
      const receivedIds: string[] = [];
      const { emitter } = makeEmitter();
      const bridge = new McpToolCallBridge((sid) => {
        receivedIds.push(sid);
        return emitter;
      });
      const handler = bridge.makeProgressHandler('my-session');
      handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
      await settle();
      expect(receivedIds).toContain('my-session');
    });
  });

  // -------------------------------------------------------------------------
  // makeProgressHandler
  // -------------------------------------------------------------------------

  describe('makeProgressHandler', () => {
    test('returns a function', () => {
      const bridge = new McpToolCallBridge(() => null);
      const handler = bridge.makeProgressHandler(SESSION_ID);
      expect(typeof handler).toBe('function');
    });

    // -----------------------------------------------------------------------
    // tool_start → emitToolCall + emitToolCallUpdate(in_progress)
    // -----------------------------------------------------------------------

    describe('tool_start event', () => {
      test('emits emitToolCall then emitToolCallUpdate(in_progress)', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
        await settle();

        expect(calls).toHaveLength(2);
        expect(calls[0].method).toBe('emitToolCall');
        const update = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(update.method).toBe('emitToolCallUpdate');
        expect(update.status).toBe('in_progress');
      });

      test('emitToolCall receives correct sessionId', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler('session-xyz');

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.sessionId).toBe('session-xyz');
      });

      test('emitToolCall receives the toolName as name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write_file' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.name).toBe('mcp__fs__write_file');
      });

      test('emitToolCall receives a non-empty toolCallId (UUID)', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(typeof call.toolCallId).toBe('string');
        expect(call.toolCallId.length).toBeGreaterThan(0);
      });

      test('includes turn in _meta', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 7, toolName: 'mcp__fs__read' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.meta?.['_goodvibes/turn']).toBe(7);
      });

      test('emitToolCallUpdate uses same toolCallId as emitToolCall', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();

        const start = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        const update = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(update.toolCallId).toBe(start.toolCallId);
      });

      // -------------------------------------------------------------------
      // inferKind
      // -------------------------------------------------------------------

      test('infers kind "read" for read_file tool name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.kind).toBe('read');
      });

      test('infers kind "edit" for write_file tool name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write_file' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.kind).toBe('edit');
      });

      test('infers kind "execute" for exec_command tool name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__sh__exec_command' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.kind).toBe('execute');
      });

      test('infers kind "search" for glob tool name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__precision__glob' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.kind).toBe('search');
      });

      test('infers kind "delete" for delete_file tool name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__delete_file' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.kind).toBe('delete');
      });

      test('infers kind "other" for unknown tool name', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__svc__frobnicate' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.kind).toBe('other');
      });

      // -------------------------------------------------------------------
      // _formatToolTitle
      // -------------------------------------------------------------------

      test('formats 3-part tool name as "serverName: toolName" title', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__filesystem__read_file' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.title).toBe('filesystem: read_file');
      });

      test('formats 2-part tool name as "part0: part1" title', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'server__tool' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.title).toBe('server: tool');
      });

      test('returns plain tool name as title when no separator', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'unknown_tool' });
        await settle();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.title).toBe('unknown_tool');
      });
    });

    // -----------------------------------------------------------------------
    // tool_complete → emitToolCallUpdate (completed)
    // -----------------------------------------------------------------------

    describe('tool_complete event', () => {
      test('calls emitToolCallUpdate with status completed', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 42 });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const completed = updates.find((u) => u.status === 'completed');
        expect(completed).toBeDefined();
        expect(completed?.status).toBe('completed');
      });

      test('uses the same toolCallId as the matching tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();
        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 10 });
        await settle();

        const start = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const completed = updates.find((u) => u.status === 'completed')!;
        expect(completed.toolCallId).toBe(start.toolCallId);
      });

      test('includes durationMs in _meta', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();
        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 99 });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const completed = updates.find((u) => u.status === 'completed')!;
        expect(completed.meta?.['_goodvibes/durationMs']).toBe(99);
      });

      test('no-ops when tool_complete arrives without prior tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 10 });
        await settle();

        const completed = calls.filter((c) => c.method === 'emitToolCallUpdate' && (c as Extract<EmitterCall, {method:'emitToolCallUpdate'}>).status === 'completed');
        expect(completed).toHaveLength(0);
      });
    });

    // -----------------------------------------------------------------------
    // tool_error → emitToolCallUpdate (failed)
    // -----------------------------------------------------------------------

    describe('tool_error event', () => {
      test('calls emitToolCallUpdate with status failed', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await settle();
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'EACCES' });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const failed = updates.find((u) => u.status === 'failed');
        expect(failed).toBeDefined();
        expect(failed?.status).toBe('failed');
      });

      test('uses the same toolCallId as the matching tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await settle();
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'ENOENT' });
        await settle();

        const start = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const failed = updates.find((u) => u.status === 'failed')!;
        expect(failed.toolCallId).toBe(start.toolCallId);
      });

      test('includes error message in _meta', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await settle();
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'Permission denied' });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const failed = updates.find((u) => u.status === 'failed')!;
        expect(failed.meta?.['_goodvibes/error']).toBe('Permission denied');
      });

      test('no-ops when tool_error arrives without prior tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'oops' });
        await settle();

        const failed = calls.filter((c) => c.method === 'emitToolCallUpdate' && (c as Extract<EmitterCall, {method:'emitToolCallUpdate'}>).status === 'failed');
        expect(failed).toHaveLength(0);
      });
    });

    // -----------------------------------------------------------------------
    // Null emitter — no-op
    // -----------------------------------------------------------------------

    describe('null emitter', () => {
      test('no-ops on tool_start when emitter getter returns null', async () => {
        const bridge = new McpToolCallBridge(() => null);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        // Should not throw
        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();
      });

      test('no-ops on tool_complete when emitter getter returns null', async () => {
        const bridge = new McpToolCallBridge(() => null);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 5 });
        await settle();
        // Should not throw
      });

      test('no-ops on tool_error when emitter getter returns null', async () => {
        const bridge = new McpToolCallBridge(() => null);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__read', error: 'fail' });
        await settle();
        // Should not throw
      });

      test('ignores llm_start events regardless of emitter state', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'llm_start', turn: 1 });
        await settle();

        expect(calls).toHaveLength(0);
      });
    });

    // -----------------------------------------------------------------------
    // Multiple concurrent tool executions (FIFO queue)
    // -----------------------------------------------------------------------

    describe('multiple concurrent tool executions', () => {
      test('tracks two different tool names with distinct toolCallIds', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await settle();

        const startCalls = calls.filter((c) => c.method === 'emitToolCall') as Extract<EmitterCall, { method: 'emitToolCall' }>[];
        expect(startCalls).toHaveLength(2);
        expect(startCalls[0].toolCallId).not.toBe(startCalls[1].toolCallId);
      });

      test('completes each tool independently using its own toolCallId', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await settle();

        const startCalls = calls.filter((c) => c.method === 'emitToolCall') as Extract<EmitterCall, { method: 'emitToolCall' }>[];
        const idForRead = startCalls.find((c) => c.name === 'mcp__fs__read')!.toolCallId;
        const idForWrite = startCalls.find((c) => c.name === 'mcp__fs__write')!.toolCallId;

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 10 });
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'disk full' });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const completedUpdate = updates.find((u) => u.status === 'completed')!;
        const failedUpdate = updates.find((u) => u.status === 'failed')!;

        expect(completedUpdate.toolCallId).toBe(idForRead);
        expect(failedUpdate.toolCallId).toBe(idForWrite);
      });

      test('FIFO: two concurrent calls to the same tool name use separate toolCallIds', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        // Start the same tool twice
        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_start', turn: 2, toolName: 'mcp__fs__read' });
        await settle();

        const startCalls = calls.filter((c) => c.method === 'emitToolCall') as Extract<EmitterCall, { method: 'emitToolCall' }>[];
        expect(startCalls).toHaveLength(2);
        const id1 = startCalls[0].toolCallId;
        const id2 = startCalls[1].toolCallId;
        expect(id1).not.toBe(id2);

        // Complete first one — should use id1 (FIFO order)
        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 5 });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const completedUpdate = updates.find((u) => u.status === 'completed')!;
        expect(completedUpdate.toolCallId).toBe(id1);
      });

      test('each makeProgressHandler call has its own independent activeIds map', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler1 = bridge.makeProgressHandler('session-1');
        const handler2 = bridge.makeProgressHandler('session-2');

        handler1({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler2({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await settle();

        const startCalls = calls.filter((c) => c.method === 'emitToolCall') as Extract<EmitterCall, { method: 'emitToolCall' }>[];
        const id1 = startCalls.find((c) => c.sessionId === 'session-1')!.toolCallId;
        const id2 = startCalls.find((c) => c.sessionId === 'session-2')!.toolCallId;
        expect(id1).not.toBe(id2);

        // Completing via handler1 must not affect handler2's state
        handler1({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 5 });
        await settle();

        const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
        const completedUpdate = updates.find((u) => u.status === 'completed')!;
        expect(completedUpdate.toolCallId).toBe(id1);
        expect(completedUpdate.sessionId).toBe('session-1');

        // handler2 should still have an active tool call pending
        handler2({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 8 });
        await settle();

        const allCompleted = (calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[]).filter((u) => u.status === 'completed');
        expect(allCompleted).toHaveLength(2);
        expect(allCompleted[1].toolCallId).toBe(id2);
      });
    });
  });
});
