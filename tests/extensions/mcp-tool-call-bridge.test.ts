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
import { McpToolCallBridge, requiresPermission } from '../../src/extensions/mcp/tool-call-bridge.ts';
import type { PermissionGate } from '../../src/extensions/mcp/tool-call-bridge.ts';
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

// ---------------------------------------------------------------------------
// ISS-021: requiresPermission
// ---------------------------------------------------------------------------

describe('requiresPermission', () => {
  test('returns true for write tool', () => {
    expect(requiresPermission('mcp__fs__write_file')).toBe(true);
  });

  test('returns true for edit tool', () => {
    expect(requiresPermission('mcp__precision__precision_edit')).toBe(true);
  });

  test('returns true for delete tool', () => {
    expect(requiresPermission('mcp__fs__delete_file')).toBe(true);
  });

  test('returns true for exec tool', () => {
    expect(requiresPermission('mcp__sh__exec_command')).toBe(true);
  });

  test('returns true for create tool', () => {
    expect(requiresPermission('mcp__fs__create_dir')).toBe(true);
  });

  test('returns true for remove tool', () => {
    expect(requiresPermission('mcp__fs__remove_file')).toBe(true);
  });

  test('returns false for read tool', () => {
    expect(requiresPermission('mcp__fs__read_file')).toBe(false);
  });

  test('returns false for search tool', () => {
    expect(requiresPermission('mcp__precision__glob')).toBe(false);
  });

  test('returns false for fetch tool', () => {
    expect(requiresPermission('mcp__web__fetch')).toBe(false);
  });

  test('returns false for unknown tool', () => {
    expect(requiresPermission('mcp__svc__frobnicate')).toBe(false);
  });

  test('handles non-namespaced tool names', () => {
    expect(requiresPermission('write_file')).toBe(true);
    expect(requiresPermission('read_file')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ISS-021: PermissionGate integration
// ---------------------------------------------------------------------------

describe('PermissionGate integration', () => {
  function makeGate(grants: boolean): { gate: PermissionGate; calls: Array<{ sessionId: string; toolCallId: string; toolName: string }> } {
    const calls: Array<{ sessionId: string; toolCallId: string; toolName: string }> = [];
    const gate: PermissionGate = {
      async requestPermission(sessionId, toolCallId, toolName) {
        calls.push({ sessionId, toolCallId, toolName });
        return grants;
      },
    };
    return { gate, calls };
  }

  test('denied: emits failed with Permission denied content (not in_progress)', async () => {
    const { emitter, calls } = makeEmitter();
    const { gate } = makeGate(false);
    const bridge = new McpToolCallBridge(() => emitter, gate);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write_file' });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('failed');
    const contentBlock = updates[0].content?.[0] as { type: string; content: { type: string; text: string } } | undefined;
    expect(contentBlock?.content?.text).toBe('Permission denied');
    // Must NOT emit in_progress
    expect(updates.some((u) => u.status === 'in_progress')).toBe(false);
  });

  test('granted: proceeds to in_progress after permission check', async () => {
    const { emitter, calls } = makeEmitter();
    const { gate, calls: gateCalls } = makeGate(true);
    const bridge = new McpToolCallBridge(() => emitter, gate);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write_file' });
    await settle();

    expect(gateCalls).toHaveLength(1);
    expect(gateCalls[0].toolName).toBe('mcp__fs__write_file');

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('in_progress');
  });

  test('safe tool (read) skips gate and proceeds to in_progress', async () => {
    const { emitter, calls } = makeEmitter();
    const { gate, calls: gateCalls } = makeGate(false); // would deny if called
    const bridge = new McpToolCallBridge(() => emitter, gate);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
    await settle();

    // Gate should NOT be called for read tools
    expect(gateCalls).toHaveLength(0);

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('in_progress');
  });

  test('no gate (undefined): all tools proceed to in_progress', async () => {
    const { emitter, calls } = makeEmitter();
    const bridge = new McpToolCallBridge(() => emitter); // no gate
    const handler = bridge.makeProgressHandler(SESSION_ID);

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write_file' });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    expect(updates).toHaveLength(1);
    expect(updates[0].status).toBe('in_progress');
  });

  test('gate receives correct sessionId and toolCallId', async () => {
    const { emitter } = makeEmitter();
    const { gate, calls: gateCalls } = makeGate(true);
    const bridge = new McpToolCallBridge(() => emitter, gate);
    const handler = bridge.makeProgressHandler('my-session-id');

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__delete_file' });
    await settle();

    expect(gateCalls).toHaveLength(1);
    expect(gateCalls[0].sessionId).toBe('my-session-id');
    expect(typeof gateCalls[0].toolCallId).toBe('string');
    expect(gateCalls[0].toolCallId.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ISS-022: MCP content block forwarding on tool_complete
// ---------------------------------------------------------------------------

describe('ISS-022: content block forwarding', () => {
  test('tool_complete with multi-block McpCallResult forwards all blocks', async () => {
    const { emitter, calls } = makeEmitter();
    const bridge = new McpToolCallBridge(() => emitter);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    const mcpResult = {
      content: [
        { type: 'text', text: 'line one' },
        { type: 'text', text: 'line two' },
      ],
      isError: false,
    };

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
    await settle();
    handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read_file', durationMs: 10, result: { data: mcpResult } });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    const completed = updates.find((u) => u.status === 'completed')!;
    expect(completed.content).toHaveLength(2);
    const block0 = completed.content?.[0] as { type: string; content: { type: string; text: string } };
    const block1 = completed.content?.[1] as { type: string; content: { type: string; text: string } };
    expect(block0.type).toBe('content');
    expect(block0.content.text).toBe('line one');
    expect(block1.content.text).toBe('line two');
  });

  test('tool_complete with single-block result forwards that block directly', async () => {
    const { emitter, calls } = makeEmitter();
    const bridge = new McpToolCallBridge(() => emitter);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    const mcpResult = {
      content: [{ type: 'text', text: 'file contents here' }],
      isError: false,
    };

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
    await settle();
    handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read_file', durationMs: 5, result: { data: mcpResult } });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    const completed = updates.find((u) => u.status === 'completed')!;
    expect(completed.content).toHaveLength(1);
    const block = completed.content?.[0] as { type: string; content: { type: string; text: string } };
    expect(block.type).toBe('content');
    expect(block.content.text).toBe('file contents here');
  });

  test('tool_complete with empty content array forwards empty array', async () => {
    const { emitter, calls } = makeEmitter();
    const bridge = new McpToolCallBridge(() => emitter);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    const mcpResult = { content: [], isError: false };

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
    await settle();
    handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read_file', durationMs: 5, result: { data: mcpResult } });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    const completed = updates.find((u) => u.status === 'completed')!;
    expect(completed.content).toHaveLength(0);
  });

  test('tool_complete with no result forwards empty content', async () => {
    const { emitter, calls } = makeEmitter();
    const bridge = new McpToolCallBridge(() => emitter);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
    await settle();
    handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read_file', durationMs: 5 });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    const completed = updates.find((u) => u.status === 'completed')!;
    expect(completed.content).toHaveLength(0);
  });

  test('content blocks preserve non-text types (e.g. image)', async () => {
    const { emitter, calls } = makeEmitter();
    const bridge = new McpToolCallBridge(() => emitter);
    const handler = bridge.makeProgressHandler(SESSION_ID);

    const mcpResult = {
      content: [
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ],
      isError: false,
    };

    handler({ type: 'tool_start', turn: 1, toolName: 'mcp__img__screenshot' });
    await settle();
    handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__img__screenshot', durationMs: 20, result: { data: mcpResult } });
    await settle();

    const updates = calls.filter((c) => c.method === 'emitToolCallUpdate') as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>[];
    const completed = updates.find((u) => u.status === 'completed')!;
    const block = completed.content?.[0] as { type: string; content: { type: string; data: string; mimeType: string } };
    expect(block.type).toBe('content');
    expect(block.content.type).toBe('image');
    expect(block.content.data).toBe('base64data');
    expect(block.content.mimeType).toBe('image/png');
  });
});
