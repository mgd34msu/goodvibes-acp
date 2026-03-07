/**
 * Tests for McpToolCallBridge.
 *
 * Covers:
 *   - Constructor creates instance
 *   - makeProgressHandler returns a function
 *   - tool_start event emits emitToolCall (status: in_progress)
 *   - tool_complete event emits emitToolCallUpdate (status: completed)
 *   - tool_error event emits emitToolCallUpdate (status: failed)
 *   - No-ops gracefully when emitter getter returns null
 *   - Multiple concurrent tool executions tracked independently
 *   - _formatToolTitle helper: 3-part name, 2-part name, plain name
 */
import { describe, test, expect, beforeEach } from 'bun:test';
import { McpToolCallBridge } from '../../src/extensions/mcp/tool-call-bridge.ts';
import type { ToolCallEmitter } from '../../src/extensions/acp/tool-call-emitter.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Records calls to emitToolCall and emitToolCallUpdate */
type EmitterCall =
  | { method: 'emitToolCall'; sessionId: string; toolCallId: string; name: string; title: string; status: string; meta?: Record<string, unknown> }
  | { method: 'emitToolCallUpdate'; sessionId: string; toolCallId: string; status: string; meta?: Record<string, unknown> };

function makeEmitter(): { emitter: ToolCallEmitter; calls: EmitterCall[] } {
  const calls: EmitterCall[] = [];
  const emitter = {
    emitToolCall: async (
      sessionId: string,
      toolCallId: string,
      name: string,
      title: string,
      status: string,
      meta?: Record<string, unknown>,
    ) => {
      calls.push({ method: 'emitToolCall', sessionId, toolCallId, name, title, status, meta });
    },
    emitToolCallUpdate: async (
      sessionId: string,
      toolCallId: string,
      status: string,
      meta?: Record<string, unknown>,
    ) => {
      calls.push({ method: 'emitToolCallUpdate', sessionId, toolCallId, status, meta });
    },
  } as unknown as ToolCallEmitter;
  return { emitter, calls };
}

/** Flush pending microtasks so fire-and-forget promises settle */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const SESSION_ID = 'sess-abc';

// ---------------------------------------------------------------------------
// McpToolCallBridge — constructor
// ---------------------------------------------------------------------------

describe('McpToolCallBridge', () => {
  describe('constructor', () => {
    test('creates instance without error', () => {
      const { emitter } = makeEmitter();
      const bridge = new McpToolCallBridge(() => emitter);
      expect(bridge).toBeInstanceOf(McpToolCallBridge);
    });

    test('accepts a getter that returns null', () => {
      const bridge = new McpToolCallBridge(() => null);
      expect(bridge).toBeInstanceOf(McpToolCallBridge);
    });
  });

  // -------------------------------------------------------------------------
  // makeProgressHandler
  // -------------------------------------------------------------------------

  describe('makeProgressHandler', () => {
    test('returns a function', () => {
      const { emitter } = makeEmitter();
      const bridge = new McpToolCallBridge(() => emitter);
      const handler = bridge.makeProgressHandler(SESSION_ID);
      expect(typeof handler).toBe('function');
    });

    // -----------------------------------------------------------------------
    // tool_start → emitToolCall
    // -----------------------------------------------------------------------

    describe('tool_start event', () => {
      test('calls emitToolCall with status in_progress', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
        await flushMicrotasks();

        expect(calls).toHaveLength(1);
        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.method).toBe('emitToolCall');
        expect(call.status).toBe('in_progress');
      });

      test('passes sessionId through to emitToolCall', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler('my-session-42');

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read_file' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.sessionId).toBe('my-session-42');
      });

      test('passes toolName as name to emitToolCall', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 2, toolName: 'mcp__precision__glob' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.name).toBe('mcp__precision__glob');
      });

      test('formats 3-part tool name as "serverName: toolName" title', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__filesystem__read_file' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.title).toBe('filesystem: read_file');
      });

      test('formats 2-part tool name as "part0: part1" title', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'server__tool' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.title).toBe('server: tool');
      });

      test('returns plain tool name as title when no separator', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'unknown_tool' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.title).toBe('unknown_tool');
      });

      test('includes turn in _meta', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 5, toolName: 'mcp__fs__write' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(call.meta?.['_goodvibes/turn']).toBe(5);
      });

      test('generates a non-empty toolCallId', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await flushMicrotasks();

        const call = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        expect(typeof call.toolCallId).toBe('string');
        expect(call.toolCallId.length).toBeGreaterThan(0);
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
        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 42 });
        await flushMicrotasks();

        expect(calls).toHaveLength(2);
        const update = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(update.method).toBe('emitToolCallUpdate');
        expect(update.status).toBe('completed');
      });

      test('uses the same toolCallId as the matching tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 10 });
        await flushMicrotasks();

        const start = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        const complete = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(complete.toolCallId).toBe(start.toolCallId);
      });

      test('includes durationMs in _meta', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 99 });
        await flushMicrotasks();

        const update = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(update.meta?.['_goodvibes/durationMs']).toBe(99);
      });

      test('no-ops when tool_complete arrives without prior tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 10 });
        await flushMicrotasks();

        expect(calls).toHaveLength(0);
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
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'EACCES' });
        await flushMicrotasks();

        expect(calls).toHaveLength(2);
        const update = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(update.method).toBe('emitToolCallUpdate');
        expect(update.status).toBe('failed');
      });

      test('uses the same toolCallId as the matching tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'ENOENT' });
        await flushMicrotasks();

        const start = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        const err = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(err.toolCallId).toBe(start.toolCallId);
      });

      test('includes error message in _meta', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'Permission denied' });
        await flushMicrotasks();

        const update = calls[1] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(update.meta?.['_goodvibes/error']).toBe('Permission denied');
      });

      test('no-ops when tool_error arrives without prior tool_start', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'oops' });
        await flushMicrotasks();

        expect(calls).toHaveLength(0);
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
        await flushMicrotasks();
        // No assertion needed beyond no throw; verifying no-op behavior.
      });

      test('no-ops on tool_complete when emitter getter returns null', async () => {
        const bridge = new McpToolCallBridge(() => null);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 5 });
        await flushMicrotasks();
        // Should not throw
      });

      test('no-ops on tool_error when emitter getter returns null', async () => {
        const bridge = new McpToolCallBridge(() => null);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__read', error: 'fail' });
        await flushMicrotasks();
        // Should not throw
      });

      test('ignores llm_start events regardless of emitter state', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'llm_start', turn: 1 });
        await flushMicrotasks();

        expect(calls).toHaveLength(0);
      });
    });

    // -----------------------------------------------------------------------
    // Multiple concurrent tools
    // -----------------------------------------------------------------------

    describe('multiple concurrent tool executions', () => {
      test('tracks two concurrent tools with distinct toolCallIds', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await flushMicrotasks();

        expect(calls).toHaveLength(2);
        const idA = (calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>).toolCallId;
        const idB = (calls[1] as Extract<EmitterCall, { method: 'emitToolCall' }>).toolCallId;
        expect(idA).not.toBe(idB);
      });

      test('completes each tool independently using its own toolCallId', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler = bridge.makeProgressHandler(SESSION_ID);

        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__write' });
        await flushMicrotasks();

        const startA = calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>;
        const startB = calls[1] as Extract<EmitterCall, { method: 'emitToolCall' }>;

        handler({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 10 });
        handler({ type: 'tool_error', turn: 1, toolName: 'mcp__fs__write', error: 'disk full' });
        await flushMicrotasks();

        const completeA = calls[2] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        const failB = calls[3] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;

        expect(completeA.toolCallId).toBe(startA.toolCallId);
        expect(completeA.status).toBe('completed');
        expect(failB.toolCallId).toBe(startB.toolCallId);
        expect(failB.status).toBe('failed');
      });

      test('each makeProgressHandler call has its own independent activeIds map', async () => {
        const { emitter, calls } = makeEmitter();
        const bridge = new McpToolCallBridge(() => emitter);
        const handler1 = bridge.makeProgressHandler('session-1');
        const handler2 = bridge.makeProgressHandler('session-2');

        handler1({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        handler2({ type: 'tool_start', turn: 1, toolName: 'mcp__fs__read' });
        await flushMicrotasks();

        const id1 = (calls[0] as Extract<EmitterCall, { method: 'emitToolCall' }>).toolCallId;
        const id2 = (calls[1] as Extract<EmitterCall, { method: 'emitToolCall' }>).toolCallId;
        expect(id1).not.toBe(id2);

        // Completing tool via handler1 must not affect handler2's state
        handler1({ type: 'tool_complete', turn: 1, toolName: 'mcp__fs__read', durationMs: 5 });
        await flushMicrotasks();
        expect(calls).toHaveLength(3);

        const complete1 = calls[2] as Extract<EmitterCall, { method: 'emitToolCallUpdate' }>;
        expect(complete1.toolCallId).toBe(id1);
        expect(complete1.sessionId).toBe('session-1');
      });
    });
  });
});
