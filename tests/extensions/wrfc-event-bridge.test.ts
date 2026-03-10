import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.ts';
import { WRFCEventBridge } from '../../src/extensions/wrfc/wrfc-event-bridge.ts';
import { WRFC_TOOL_NAMES } from '../../src/types/constants.ts';
import type * as acp from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Mock ACP connection
// ---------------------------------------------------------------------------

interface EmittedCall {
  type: 'tool_call' | 'tool_call_update';
  sessionId: string;
  toolCallId: string;
  status?: string;
  name?: string;
  meta?: Record<string, unknown>;
  content?: unknown[];
}

function makeMockConn(): { conn: acp.AgentSideConnection; calls: EmittedCall[] } {
  const calls: EmittedCall[] = [];
  const conn = {
    sessionUpdate: async (params: { sessionId: string; update: Record<string, unknown> }) => {
      const { sessionId, update } = params;
      const sessionUpdate = update.sessionUpdate as string;
      if (sessionUpdate === 'tool_call') {
        calls.push({
          type: 'tool_call',
          sessionId,
          toolCallId: update.toolCallId as string,
          name: (update._meta as Record<string, unknown>)?.['_goodvibes/tool_name'] as string,
          meta: update._meta as Record<string, unknown>,
        });
      } else if (sessionUpdate === 'tool_call_update') {
        calls.push({
          type: 'tool_call_update',
          sessionId,
          toolCallId: update.toolCallId as string,
          status: update.status as string,
          meta: update._meta as Record<string, unknown>,
          content: update.content as unknown[],
        });
      }
    },
  } as unknown as acp.AgentSideConnection;
  return { conn, calls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WRFCEventBridge', () => {
  let bus: EventBus;
  let calls: EmittedCall[];
  let bridge: WRFCEventBridge;

  beforeEach(() => {
    bus = new EventBus();
    const mock = makeMockConn();
    calls = mock.calls;
    bridge = new WRFCEventBridge(mock.conn, bus);
  });

  describe('register / unregister lifecycle', () => {
    it('register() is idempotent — calling twice does not double-subscribe', () => {
      bridge.register();
      bridge.register();

      bus.emit('wrfc:state-changed', {
        workId: 'w1',
        sessionId: 's1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });

      // Only one set of emissions expected despite two register() calls
      const toolCalls = calls.filter((c) => c.type === 'tool_call');
      expect(toolCalls).toHaveLength(1);
    });

    it('unregister() stops all event forwarding', () => {
      bridge.register();
      bridge.unregister();

      bus.emit('wrfc:state-changed', {
        workId: 'w1',
        sessionId: 's1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });

      expect(calls).toHaveLength(0);
    });

    it('unregister() clears active tool call tracking', () => {
      bridge.register();
      bus.emit('wrfc:state-changed', {
        workId: 'w1',
        sessionId: 's1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      bridge.unregister();

      // After unregister, chain-complete should not fail (no keys to clean)
      expect(() =>
        bus.emit('wrfc:chain-complete', { workId: 'w1', sessionId: 's1', finalState: 'completed' })
      ).not.toThrow();
    });
  });

  describe('wrfc:state-changed → working', () => {
    beforeEach(() => bridge.register());

    it('emits tool_call for goodvibes_work tool', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w1',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));

      const tc = calls.find((c) => c.type === 'tool_call');
      expect(tc).toBeDefined();
      expect(tc!.name).toBe(WRFC_TOOL_NAMES.WORK);
    });

    it('emits tool_call_update with in_progress for working state', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w1',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'in_progress');
      expect(upd).toBeDefined();
    });

    it('uses a stable tool call ID for the same workId+phase', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'stable-work',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));

      // The tool_call and its update should share the same toolCallId
      const tc = calls.find((c) => c.type === 'tool_call');
      const upd = calls.find((c) => c.type === 'tool_call_update');
      expect(tc!.toolCallId).toBe(upd!.toolCallId);
      expect(tc!.toolCallId).toBe(`wrfc_work_stable-work`);
    });
  });

  describe('wrfc:state-changed → reviewing', () => {
    beforeEach(() => bridge.register());

    it('emits tool_call for goodvibes_review tool', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w2',
        sessionId: 'sess-1',
        from: 'working',
        to: 'reviewing',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));

      const tc = calls.find((c) => c.type === 'tool_call');
      expect(tc!.name).toBe(WRFC_TOOL_NAMES.REVIEW);
    });

    it('emits in_progress update for reviewing state', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w2',
        sessionId: 'sess-1',
        from: 'working',
        to: 'reviewing',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'in_progress');
      expect(upd).toBeDefined();
    });
  });

  describe('wrfc:state-changed → fixing', () => {
    beforeEach(() => bridge.register());

    it('emits tool_call for goodvibes_fix tool', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w3',
        sessionId: 'sess-1',
        from: 'reviewing',
        to: 'fixing',
        attempt: 2,
      });
      await new Promise((r) => setTimeout(r, 5));

      const tc = calls.find((c) => c.type === 'tool_call');
      expect(tc!.name).toBe(WRFC_TOOL_NAMES.FIX);
    });

    it('emits in_progress update for fixing state', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w3',
        sessionId: 'sess-1',
        from: 'reviewing',
        to: 'fixing',
        attempt: 2,
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'in_progress');
      expect(upd).toBeDefined();
    });
  });

  describe('wrfc:state-changed — unknown state', () => {
    beforeEach(() => bridge.register());

    it('does not emit for unknown state transitions', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'w4',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'some-unknown-state',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));
      expect(calls).toHaveLength(0);
    });

    it('silently handles null/undefined payload', () => {
      bridge.register();
      expect(() =>
        bus.emit('wrfc:state-changed', null as unknown as object)
      ).not.toThrow();
    });
  });

  describe('wrfc:work-complete', () => {
    beforeEach(() => bridge.register());

    it('emits completed update for the work tool call', async () => {
      // First trigger working to register the tool call ID
      bus.emit('wrfc:state-changed', {
        workId: 'wc1',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));
      calls.length = 0; // clear prior calls

      bus.emit('wrfc:work-complete', {
        workId: 'wc1',
        sessionId: 'sess-1',
        filesModified: ['a.ts', 'b.ts'],
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'completed');
      expect(upd).toBeDefined();
      expect(upd!.toolCallId).toBe('wrfc_work_wc1');
    });

    it('includes filesModified count in _meta', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'wc2',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      bus.emit('wrfc:work-complete', {
        workId: 'wc2',
        sessionId: 'sess-1',
        filesModified: ['x.ts', 'y.ts', 'z.ts'],
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'completed');
      expect(upd!.meta?.['_goodvibes/filesModified']).toBe(3);
    });
  });

  describe('wrfc:review-complete', () => {
    beforeEach(() => bridge.register());

    it('emits completed update for the review tool call', async () => {
      bus.emit('wrfc:state-changed', {
        workId: 'rv1',
        sessionId: 'sess-1',
        from: 'working',
        to: 'reviewing',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));
      calls.length = 0;

      bus.emit('wrfc:review-complete', {
        workId: 'rv1',
        sessionId: 'sess-1',
        score: 9.5,
        passed: true,
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'completed');
      expect(upd).toBeDefined();
      expect(upd!.meta?.['_goodvibes/score']).toBe(9.5);
      expect(upd!.meta?.['_goodvibes/passed']).toBe(true);
    });

    it('marks review as not passed in _meta', async () => {
      bus.emit('wrfc:state-changed', { workId: 'rv2', sessionId: 's1', from: 'w', to: 'reviewing', attempt: 1 });
      bus.emit('wrfc:review-complete', { workId: 'rv2', sessionId: 's1', score: 7.0, passed: false });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'completed');
      expect(upd!.meta?.['_goodvibes/passed']).toBe(false);
    });
  });

  describe('wrfc:fix-complete', () => {
    beforeEach(() => bridge.register());

    it('emits completed update for the fix tool call', async () => {
      bus.emit('wrfc:state-changed', { workId: 'fx1', sessionId: 's1', from: 'reviewing', to: 'fixing', attempt: 1 });
      await new Promise((r) => setTimeout(r, 5));
      calls.length = 0;

      bus.emit('wrfc:fix-complete', {
        workId: 'fx1',
        sessionId: 's1',
        resolvedIssues: ['issue-1', 'issue-2'],
      });
      await new Promise((r) => setTimeout(r, 5));

      const upd = calls.find((c) => c.type === 'tool_call_update' && c.status === 'completed');
      expect(upd).toBeDefined();
      expect(upd!.meta?.['_goodvibes/resolvedIssues']).toBe(2);
    });
  });

  describe('wrfc:chain-complete', () => {
    beforeEach(() => bridge.register());

    it('removes tracked tool call IDs for the completed workId', async () => {
      // Register a tool call ID
      bus.emit('wrfc:state-changed', {
        workId: 'cc1',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
      await new Promise((r) => setTimeout(r, 5));
      calls.length = 0;

      bus.emit('wrfc:chain-complete', {
        workId: 'cc1',
        sessionId: 'sess-1',
        finalState: 'completed',
        score: 9.8,
      });

      // After chain-complete, a new working state for same workId should create
      // a fresh tool call ID (demonstrating the old one was cleared)
      bus.emit('wrfc:state-changed', {
        workId: 'cc1',
        sessionId: 'sess-1',
        from: 'idle',
        to: 'working',
        attempt: 2,
      });
      await new Promise((r) => setTimeout(r, 5));

      const tc = calls.find((c) => c.type === 'tool_call');
      expect(tc).toBeDefined();
      // A new tool_call was emitted, confirming ID was regenerated after chain-complete
      expect(tc!.toolCallId).toBe('wrfc_work_cc1');
    });

    it('does not affect tool call IDs for other workIds', async () => {
      bus.emit('wrfc:state-changed', { workId: 'other', sessionId: 's1', from: 'idle', to: 'working', attempt: 1 });
      await new Promise((r) => setTimeout(r, 5));

      bus.emit('wrfc:chain-complete', { workId: 'cc2', sessionId: 's1', finalState: 'completed' });
      calls.length = 0;

      // 'other' workId tool calls should still be trackable
      bus.emit('wrfc:work-complete', { workId: 'other', sessionId: 's1', filesModified: [] });
      await new Promise((r) => setTimeout(r, 5));

      // Should still emit update for 'other' workId
      const upd = calls.find((c) => c.type === 'tool_call_update');
      expect(upd).toBeDefined();
    });
  });
});
