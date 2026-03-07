import { describe, it, expect, beforeEach } from 'bun:test';
import { PlanEmitter } from '../../src/extensions/acp/plan-emitter.js';
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
// PlanEmitter
// ---------------------------------------------------------------------------

describe('PlanEmitter', () => {
  // -------------------------------------------------------------------------
  // initWrfcPlan
  // -------------------------------------------------------------------------

  describe('initWrfcPlan()', () => {
    it('emits a plan session update with sessionUpdate: plan discriminant', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'work-1');
      // Allow the fire-and-forget void promise to resolve
      await new Promise((r) => setTimeout(r, 0));

      expect(calls).toHaveLength(1);
      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.sessionUpdate).toBe('plan');
    });

    it('creates work and review entries for the given workId', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'work-abc');
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const entries = update.entries as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(2);
      expect(entries[0].content).toBe('Execute task');
      expect(entries[1].content).toBe('Review output');
    });

    it('sets both initial entries to pending status', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'work-abc');
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const entries = update.entries as Array<Record<string, unknown>>;
      expect(entries[0].status).toBe('pending');
      expect(entries[1].status).toBe('pending');
    });

    it('sets both initial entries to high priority', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'work-abc');
      await new Promise((r) => setTimeout(r, 0));

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const entries = update.entries as Array<Record<string, unknown>>;
      expect(entries[0].priority).toBe('high');
      expect(entries[1].priority).toBe('high');
    });

    it('threads the sessionId through to sessionUpdate params', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('my-session', 'work-1');
      await new Promise((r) => setTimeout(r, 0));

      expect((calls[0] as { sessionId: string }).sessionId).toBe('my-session');
    });

    it('clears previous entries when called a second time', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'work-1');
      await new Promise((r) => setTimeout(r, 0));

      emitter.initWrfcPlan('sess-1', 'work-2');
      await new Promise((r) => setTimeout(r, 0));

      // Second call should produce exactly 2 entries (not 4)
      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      const entries = lastUpdate.entries as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // updateEntry
  // -------------------------------------------------------------------------

  describe('updateEntry()', () => {
    it('changes the status of the specified entry and re-emits the plan', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      await emitter.updateEntry('sess-1', 'w1_work', 'in_progress');

      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      const entries = lastUpdate.entries as Array<Record<string, unknown>>;
      expect(entries[0].status).toBe('in_progress');
    });

    it('emits a plan update even when the entry id is unknown (graceful no-op on data)', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      const before = calls.length;
      await emitter.updateEntry('sess-1', 'nonexistent', 'completed');
      // Should still emit (plan is re-sent)
      expect(calls.length).toBeGreaterThan(before);
    });

    it('updates the title when provided', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      await emitter.updateEntry('sess-1', 'w1_work', 'completed', 'Task done!');

      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      const entries = lastUpdate.entries as Array<Record<string, unknown>>;
      expect(entries[0].content).toBe('Task done!');
    });

    it('emits sessionUpdate: plan discriminant on update', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      await emitter.updateEntry('sess-1', 'w1_review', 'completed');

      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      expect(lastUpdate.sessionUpdate).toBe('plan');
    });
  });

  // -------------------------------------------------------------------------
  // addEntry
  // -------------------------------------------------------------------------

  describe('addEntry()', () => {
    it('adds a dynamic entry and re-emits the full plan', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      await emitter.addEntry('sess-1', {
        id: 'w1_fix_1',
        title: 'Fix iteration 1',
        status: 'pending',
        priority: 'medium',
      });

      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      const entries = lastUpdate.entries as Array<Record<string, unknown>>;
      expect(entries).toHaveLength(3);
    });

    it('new dynamic entry appears in entries with correct content', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      await emitter.addEntry('sess-1', {
        id: 'w1_fix_1',
        title: 'Fix iteration 1',
        status: 'in_progress',
        priority: 'medium',
      });

      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      const entries = lastUpdate.entries as Array<Record<string, unknown>>;
      const fix = entries.find((e) => e.content === 'Fix iteration 1');
      expect(fix).toBeDefined();
      expect(fix?.status).toBe('in_progress');
      expect(fix?.priority).toBe('medium');
    });

    it('emits sessionUpdate: plan discriminant', async () => {
      const { conn, calls } = makeConn();
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      await emitter.addEntry('sess-1', {
        id: 'dynamic',
        title: 'Dynamic entry',
        status: 'pending',
        priority: 'low',
      });

      const lastUpdate = (calls[calls.length - 1] as { update: Record<string, unknown> }).update;
      expect(lastUpdate.sessionUpdate).toBe('plan');
    });
  });

  // -------------------------------------------------------------------------
  // emitPlan (via emitPlan-exposed paths)
  // -------------------------------------------------------------------------

  describe('emitPlan() error resilience', () => {
    it('swallows errors from sessionUpdate without throwing', async () => {
      const conn = {
        sessionUpdate: async () => {
          throw new Error('connection closed');
        },
      } as unknown as AgentSideConnection;
      const emitter = new PlanEmitter(conn);

      emitter.initWrfcPlan('sess-1', 'w1');
      await new Promise((r) => setTimeout(r, 0));

      // Should not throw even if conn.sessionUpdate fails
      await expect(emitter.updateEntry('sess-1', 'w1_work', 'completed')).resolves.toBeUndefined();
    });
  });
});
