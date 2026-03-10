import { describe, it, expect, beforeEach } from 'bun:test';
import { ToolCallEmitter } from '../../src/extensions/acp/tool-call-emitter.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConn(): { conn: AgentSideConnection; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const conn = {
    sessionUpdate: async (params: Record<string, unknown>) => {
      calls.push(params);
    },
  } as unknown as AgentSideConnection;
  return { conn, calls };
}

// ---------------------------------------------------------------------------
// ToolCallEmitter — emitToolCall
// ---------------------------------------------------------------------------

describe('ToolCallEmitter', () => {
  describe('emitToolCall()', () => {
    it('calls sessionUpdate with sessionUpdate: tool_call discriminant', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCall('sess-1', 'tc-1', 'goodvibes_work', 'Work Phase');

      expect(calls).toHaveLength(1);
      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.sessionUpdate).toBe('tool_call');
    });

    it('includes toolCallId, title, and status in the tool_call update', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCall('sess-1', 'tc-abc', 'goodvibes_review', 'Review Phase');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.toolCallId).toBe('tc-abc');
      expect(update.title).toBe('Review Phase');
      expect(update.status).toBe('pending');
    });

    it('threads the sessionId through to sessionUpdate params', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCall('my-session-id', 'tc-2', 'goodvibes_fix', 'Fix Phase');

      expect((calls[0] as { sessionId: string }).sessionId).toBe('my-session-id');
    });

    it('includes _meta when provided', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);
      const meta = { attempt: 2, score: 8.5 };

      await emitter.emitToolCall('sess-1', 'tc-3', 'goodvibes_work', 'Work', 'other', meta);

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update._meta).toEqual(expect.objectContaining(meta));
    });

    it('includes _goodvibes/tool_name in _meta even when no explicit meta is passed', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCall('sess-1', 'tc-4', 'goodvibes_work', 'Work');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const meta = update._meta as Record<string, unknown>;
      expect(meta['_goodvibes/tool_name']).toBe('goodvibes_work');
    });

    it('passes pending status correctly', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCall('sess-1', 'tc-5', 'goodvibes_work', 'Work');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('pending');
    });

    it('passes in_progress status correctly', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCall('sess-1', 'tc-6', 'goodvibes_work', 'Work', 'other');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('pending'); // status is always 'pending' on new tool_call
    });
  });

  // -------------------------------------------------------------------------
  // emitToolCallUpdate
  // -------------------------------------------------------------------------

  describe('emitToolCallUpdate()', () => {
    it('calls sessionUpdate with sessionUpdate: tool_call_update discriminant', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCallUpdate('sess-1', 'tc-10', 'completed');

      expect(calls).toHaveLength(1);
      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.sessionUpdate).toBe('tool_call_update');
    });

    it('includes toolCallId and status in the tool_call_update', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCallUpdate('sess-1', 'tc-xyz', 'completed');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.toolCallId).toBe('tc-xyz');
      expect(update.status).toBe('completed');
    });

    it('threads the sessionId through to sessionUpdate params', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCallUpdate('target-session', 'tc-11', 'completed');

      expect((calls[0] as { sessionId: string }).sessionId).toBe('target-session');
    });

    it('includes _meta when provided', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);
      const meta = { score: 9.0, passed: true };

      await emitter.emitToolCallUpdate('sess-1', 'tc-12', 'completed', meta);

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update._meta).toEqual(meta);
    });

    it('omits _meta when not provided', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCallUpdate('sess-1', 'tc-13', 'failed');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update._meta).toBeUndefined();
    });

    it('passes failed status correctly', async () => {
      const { conn, calls } = makeConn();
      const emitter = new ToolCallEmitter(conn);

      await emitter.emitToolCallUpdate('sess-1', 'tc-14', 'failed');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.status).toBe('failed');
    });
  });
});
