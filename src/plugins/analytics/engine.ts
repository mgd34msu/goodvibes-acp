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
} from './types.js';
import { BudgetTracker } from './budget.js';
import { AnalyticsDashboard } from './dashboard.js';
import { AnalyticsExporter } from './export.js';
import { SessionSync } from './sync.js';

/** Unified analytics engine — composes all analytics sub-systems */
export class AnalyticsEngine {
  private readonly _store: AnalyticsStore;
  private readonly _budget: BudgetTracker;
  private readonly _dashboard: AnalyticsDashboard;
  private readonly _exporter: AnalyticsExporter;
  private readonly _sync: SessionSync;

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

    // Update budget
    this._budget.track(entry, sessionId);
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
  // Shutdown
  // ---------------------------------------------------------------------------

  /** Flush all pending writes to disk before shutdown */
  async shutdown(): Promise<void> {
    await this._sync.syncAll();
  }
}
