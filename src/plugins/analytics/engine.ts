/**
 * @module plugins/analytics/engine
 * @layer L3 — plugin
 *
 * AnalyticsEngine — facade that composes BudgetTracker, AnalyticsDashboard,
 * AnalyticsExporter, and SessionSync behind a single API.
 *
 * Not an IToolProvider — registered as its own 'analytics' capability.
 */

import type {
  TokenUsageEntry,
  SessionAnalytics,
  AnalyticsExportFormat,
  DashboardData,
  TokenBudget,
  AnalyticsStore,
  ConfigParams,
  GoodVibesAnalyticsRequest,
  GoodVibesAnalyticsResponse,
} from './types.js';
import { BudgetTracker } from './budget.js';
import { AnalyticsDashboard } from './dashboard.js';
import { AnalyticsExporter } from './export.js';
import { SessionSync } from './sync.js';

/**
 * Analytics engine for tracking token usage, budgets, and session metrics.
 *
 * Currently operates as an internal service — not directly accessible via ACP.
 * The ACP spec defines `_goodvibes/analytics` as an extension method
 * (KB 08-extensibility.md). To expose analytics via ACP:
 *
 * Option A: Implement IToolProvider (name, tools, execute) for tool-based access
 * Option B: Register a `_goodvibes/analytics` handler in GoodVibesAgent.extMethod()
 *
 * The GoodVibesExtensions class (src/extensions/acp/extensions.ts) already has
 * a `_analytics()` handler that delegates to this engine — it just needs to be
 * wired into the agent's extMethod dispatch.
 */
export class AnalyticsEngine {
  private readonly _store: AnalyticsStore;
  private readonly _budget: BudgetTracker;
  private readonly _dashboard: AnalyticsDashboard;
  private readonly _exporter: AnalyticsExporter;
  private readonly _sync: SessionSync;
  /** Pending threshold-crossing warnings, keyed by sessionId */
  private readonly _pendingWarnings = new Map<string, string[]>();

  constructor(config?: ConfigParams) {
    this._store = {
      sessions: new Map(),
      budgets: new Map(),
      tags: new Map(),
    };

    const storageDir = config?.storageDir ?? '.goodvibes/analytics';

    this._budget = new BudgetTracker(this._store);
    this._dashboard = new AnalyticsDashboard(this._store);
    this._exporter = new AnalyticsExporter(this._store);
    this._sync = new SessionSync(this._store, storageDir);
  }

  // ---------------------------------------------------------------------------
  // Session management
  // ---------------------------------------------------------------------------

  /**
   * Ensure a session exists in the store.
   * Returns the existing session or creates a new one.
   */
  ensureSession(sessionId: string): SessionAnalytics {
    let session = this._store.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        startedAt: Date.now(),
        entries: [],
        totalTokensIn: 0,
        totalTokensOut: 0,
        toolBreakdown: {},
      };
      this._store.sessions.set(sessionId, session);
    }
    return session;
  }

  // ---------------------------------------------------------------------------
  // Token tracking
  // ---------------------------------------------------------------------------

  /**
   * Record a token usage entry for a session.
   * Creates the session automatically if it does not exist.
   */
  track(sessionId: string, entry: TokenUsageEntry): void {
    const session = this.ensureSession(sessionId);
    session.entries.push(entry);
    session.totalTokensIn += entry.tokensIn;
    session.totalTokensOut += entry.tokensOut;

    // Update tool breakdown
    const existing = session.toolBreakdown[entry.toolName];
    if (existing) {
      existing.calls += 1;
      existing.tokens += entry.tokensIn + entry.tokensOut;
    } else {
      session.toolBreakdown[entry.toolName] = {
        calls: 1,
        tokens: entry.tokensIn + entry.tokensOut,
      };
    }

    // Update budget and check threshold crossings
    const budgetBefore = this._store.budgets.get(sessionId);
    const utilizationBefore =
      budgetBefore && budgetBefore.totalBudget > 0
        ? budgetBefore.used / budgetBefore.totalBudget
        : 0;

    this._budget.track(entry, sessionId);

    const budgetAfter = this._store.budgets.get(sessionId);
    if (budgetAfter && budgetAfter.totalBudget > 0) {
      const utilizationAfter = budgetAfter.used / budgetAfter.totalBudget;
      // Check if we just crossed the warning threshold
      if (
        utilizationBefore < budgetAfter.warningThreshold &&
        utilizationAfter >= budgetAfter.warningThreshold
      ) {
        this._pendingWarnings.set(sessionId, [
          ...this.getWarnings(sessionId),
        ]);
      }
      // Check if we just crossed the alert threshold
      if (
        utilizationBefore < budgetAfter.alertThreshold &&
        utilizationAfter >= budgetAfter.alertThreshold
      ) {
        this._pendingWarnings.set(sessionId, [
          ...this.getWarnings(sessionId),
        ]);
      }
      // Check if we just crossed 100%
      if (utilizationBefore < 1.0 && utilizationAfter >= 1.0) {
        this._pendingWarnings.set(sessionId, [
          ...this.getWarnings(sessionId),
        ]);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Budget API
  // ---------------------------------------------------------------------------

  /** Get the current budget for a session */
  getBudget(sessionId: string): TokenBudget {
    return this._budget.getBudget(sessionId);
  }

  /** Set the total budget for a session */
  setBudget(sessionId: string, total: number, warningThreshold?: number, alertThreshold?: number): void {
    this._budget.setBudget(sessionId, total, warningThreshold, alertThreshold);
  }

  /** Check if a session has exceeded its budget */
  isOverBudget(sessionId: string): boolean {
    return this._budget.isOverBudget(sessionId);
  }

  /** Get budget warnings for a session */
  getWarnings(sessionId: string): string[] {
    return this._budget.getWarnings(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Dashboard API
  // ---------------------------------------------------------------------------

  /** Get the dashboard summary */
  getDashboard(topToolsLimit?: number, recentEntriesLimit?: number): DashboardData {
    return this._dashboard.getSummary(topToolsLimit, recentEntriesLimit);
  }

  /** Get analytics for a specific session */
  getSessionAnalytics(sessionId: string): SessionAnalytics | undefined {
    return this._dashboard.getSessionAnalytics(sessionId);
  }

  /** Get aggregated tool breakdown across all sessions */
  getToolBreakdown(): Record<string, { calls: number; tokens: number }> {
    return this._dashboard.getToolBreakdown();
  }

  /** Get all usage entries in a time range */
  getTimeline(from: number, to: number): TokenUsageEntry[] {
    return this._dashboard.getTimeline(from, to);
  }

  // ---------------------------------------------------------------------------
  // Export API
  // ---------------------------------------------------------------------------

  /** Export a single session */
  exportSession(sessionId: string, format: AnalyticsExportFormat): string {
    return this._exporter.exportSession(sessionId, format);
  }

  /** Export all sessions */
  exportAll(format: AnalyticsExportFormat): string {
    return this._exporter.exportAll(format);
  }

  // ---------------------------------------------------------------------------
  // Persistence API
  // ---------------------------------------------------------------------------

  /** Persist a session's analytics to disk */
  async sync(sessionId: string): Promise<void> {
    return this._sync.sync(sessionId);
  }

  /** Load a session's analytics from disk */
  async load(sessionId: string): Promise<SessionAnalytics | null> {
    return this._sync.load(sessionId);
  }

  /** Flush all sessions to disk */
  async syncAll(): Promise<void> {
    return this._sync.syncAll();
  }

  // ---------------------------------------------------------------------------
  // Tag API
  // ---------------------------------------------------------------------------

  /** Attach a tag to a session */
  tag(sessionId: string, key: string, value: string): void {
    const existing = this._store.tags.get(sessionId) ?? {};
    existing[key] = value;
    this._store.tags.set(sessionId, existing);
  }

  /** Get all tags for a session */
  getTags(sessionId: string): Record<string, string> {
    return this._store.tags.get(sessionId) ?? {};
  }

  // ---------------------------------------------------------------------------
  // ACP Response format
  // ---------------------------------------------------------------------------

  /**
   * Build a GoodVibesAnalyticsResponse for an analytics request.
   *
   * Supports session, workflow, and agent scopes per the ACP `_goodvibes/analytics`
   * wire format (KB-08 lines 306-324). Workflow and agent scopes currently fall back
   * to session-level data since per-workflow/agent tracking is not yet implemented.
   *
   * @param request - Analytics request with sessionId, scope, and optional id.
   *   Accepts a plain `{ sessionId?: string }` object for backwards compatibility.
   * @returns Token usage totals, turn count, agent count, and wall-clock duration.
   */
  getAnalyticsResponse(
    request?: GoodVibesAnalyticsRequest | { sessionId?: string }
  ): GoodVibesAnalyticsResponse {
    const sessionId = request?.sessionId;
    if (sessionId) {
      const session = this._store.sessions.get(sessionId);
      const budget = this._store.budgets.get(sessionId);
      const input = session?.totalTokensIn ?? 0;
      const output = session?.totalTokensOut ?? 0;
      const firstEntry = session?.entries[0]?.timestamp;
      const lastEntry = session?.entries[session.entries.length - 1]?.timestamp;
      const duration_ms =
        firstEntry !== undefined && lastEntry !== undefined
          ? lastEntry - firstEntry
          : 0;
      return {
        tokenUsage: {
          input,
          output,
          total: input + output,
          ...(budget ? { budget: budget.totalBudget, remaining: budget.remaining } : {}),
        },
        turnCount: session?.entries.length ?? 0,
        agentCount: 1,
        duration_ms,
      };
    }

    // Aggregate across all sessions
    let input = 0;
    let output = 0;
    let turnCount = 0;
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const session of this._store.sessions.values()) {
      input += session.totalTokensIn;
      output += session.totalTokensOut;
      turnCount += session.entries.length;
      for (const e of session.entries) {
        if (e.timestamp < minTs) minTs = e.timestamp;
        if (e.timestamp > maxTs) maxTs = e.timestamp;
      }
    }
    return {
      tokenUsage: {
        input,
        output,
        total: input + output,
      },
      turnCount,
      agentCount: this._store.sessions.size,
      duration_ms: minTs !== Infinity ? maxTs - minTs : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  /** Flush all pending writes to disk before shutdown */
  async shutdown(): Promise<void> {
    await this._sync.syncAll();
  }
}
