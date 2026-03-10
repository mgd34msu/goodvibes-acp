/**
 * @module acp/plan-emitter
 * @layer L2 — ACP plan session update emitter
 *
 * Emits plan session notifications over an AgentSideConnection so ACP
 * clients can observe WRFC phase intent and progress.
 */

import type * as acp from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Internal plan entry (tracks id/title beyond what the SDK requires)
// ---------------------------------------------------------------------------

interface InternalPlanEntry {
  /** Stable identifier used internally to look up and update entries */
  id: string;
  /** Human-readable description sent as the ACP PlanEntry.content */
  content?: string;
  /** Alias for content — used when callers prefer a 'title' field name */
  title?: string;
  status: acp.PlanEntryStatus;
  priority: acp.PlanEntryPriority;
}

// ---------------------------------------------------------------------------
// PlanEmitter
// ---------------------------------------------------------------------------

/**
 * Emits `plan` session updates for WRFC phases.
 *
 * Maintains an ordered list of plan entries and re-emits the full list on
 * every change (the ACP spec requires complete state on each update).
 */
export class PlanEmitter {
  private entries: Map<string, InternalPlanEntry> = new Map();

  constructor(private readonly conn: acp.AgentSideConnection) {}

  // -------------------------------------------------------------------------
  // initWrfcPlan
  // -------------------------------------------------------------------------

  /**
   * Populate the initial WRFC plan with `work` and `review` entries and emit
   * it to the client.
   *
   * @param sessionId - ACP session ID
   * @param workId    - Stable work identifier used to namespace entry IDs
   */
  initWrfcPlan(sessionId: string, workId: string): void {
    this.entries.clear();
    this.entries.set(`${workId}_work`, {
      id: `${workId}_work`,
      content: 'Execute task',
      status: 'pending',
      priority: 'high',
    });
    this.entries.set(`${workId}_review`, {
      id: `${workId}_review`,
      content: 'Review output',
      status: 'pending',
      priority: 'high',
    });
    // Fire-and-forget: the plan is advisory and should not block the WRFC loop
    void this.emitPlan(sessionId);
  }

  // -------------------------------------------------------------------------
  // updateEntry
  // -------------------------------------------------------------------------

  /**
   * Update a plan entry's status (and optional title) and re-emit the full
   * plan to the client.
   *
   * @param sessionId - ACP session ID
   * @param entryId   - ID of the entry to update
   * @param status    - New status
   * @param content   - Optional replacement content
   */
  async updateEntry(
    sessionId: string,
    entryId: string,
    status: acp.PlanEntryStatus,
    content?: string,
  ): Promise<void> {
    const entry = this.entries.get(entryId);
    if (entry) {
      entry.status = status;
      if (content !== undefined) entry.content = content;
    }
    await this.emitPlan(sessionId);
  }

  // -------------------------------------------------------------------------
  // addEntry
  // -------------------------------------------------------------------------

  /**
   * Add a dynamic plan entry (e.g. a fix phase) and re-emit the full plan.
   *
   * @param sessionId - ACP session ID
   * @param entry     - Entry to add
   */
  async addEntry(
    sessionId: string,
    entry: InternalPlanEntry,
  ): Promise<void> {
    this.entries.set(entry.id, entry);
    await this.emitPlan(sessionId);
  }

  // -------------------------------------------------------------------------
  // emitPlan (private)
  // -------------------------------------------------------------------------

  /**
   * Emit the complete current plan state as a `plan` session update.
   * Errors are swallowed — plan updates are best-effort.
   */
  async emitPlan(sessionId: string): Promise<void> {
    const planEntries: acp.PlanEntry[] = Array.from(this.entries.values()).map(
      (e): acp.PlanEntry => ({
        content: e.content ?? e.title ?? '',
        priority: e.priority,
        status: e.status,
      }),
    );

    const plan: acp.Plan = { entries: planEntries };

    await this.conn
      .sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'plan', ...plan } as acp.SessionUpdate,
      })
      .catch((err) => { console.error('[PlanEmitter] emitPlan sessionUpdate failed:', String(err)); });
  }
}
