/**
 * @module plugins/analytics/dashboard
 * @layer L3 — plugin
 *
 * Analytics dashboard — aggregates in-memory session data for display and queries.
 */

import type {
  DashboardData,
  SessionAnalytics,
  TokenUsageEntry,
  AnalyticsStore,
} from './types.js';

/** Provides aggregated analytics views over the shared in-memory store */
export class AnalyticsDashboard {
  private readonly _store: AnalyticsStore;

  constructor(store: AnalyticsStore) {
    this._store = store;
  }

  /**
   * Build a summary dashboard over all recorded sessions.
   */
  getSummary(topToolsLimit = 10, recentEntriesLimit = 20): DashboardData {
    let totalTokensUsed = 0;
    const toolAgg: Record<string, { calls: number; tokens: number }> = {};
    const allEntries: TokenUsageEntry[] = [];
    const budgetUtilization: Record<string, number> = {};

    for (const session of this._store.sessions.values()) {
      totalTokensUsed += session.totalTokensIn + session.totalTokensOut;
      allEntries.push(...session.entries);

      for (const [toolName, breakdown] of Object.entries(session.toolBreakdown)) {
        if (!toolAgg[toolName]) {
          toolAgg[toolName] = { calls: 0, tokens: 0 };
        }
        toolAgg[toolName].calls += breakdown.calls;
        toolAgg[toolName].tokens += breakdown.tokens;
      }
    }

    for (const [sessionId, budget] of this._store.budgets.entries()) {
      budgetUtilization[sessionId] =
        budget.totalBudget > 0 ? budget.used / budget.totalBudget : 0;
    }

    // Sort tools by token consumption descending
    const topTools = Object.entries(toolAgg)
      .map(([toolName, stats]) => ({ toolName, ...stats }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, topToolsLimit);

    // Most recent entries
    const recentEntries = allEntries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, recentEntriesLimit);

    return {
      activeSessions: this._store.sessions.size,
      totalTokensUsed,
      budgetUtilization,
      topTools,
      recentEntries,
    };
  }

  /**
   * Get full analytics for a specific session.
   * Returns undefined if the session is not found.
   */
  getSessionAnalytics(sessionId: string): SessionAnalytics | undefined {
    return this._store.sessions.get(sessionId);
  }

  /**
   * Get aggregated tool breakdown across ALL sessions.
   * Returns a map of toolName → { calls, tokens }.
   */
  getToolBreakdown(): Record<string, { calls: number; tokens: number }> {
    const result: Record<string, { calls: number; tokens: number }> = {};
    for (const session of this._store.sessions.values()) {
      for (const [toolName, stats] of Object.entries(session.toolBreakdown)) {
        if (!result[toolName]) {
          result[toolName] = { calls: 0, tokens: 0 };
        }
        result[toolName].calls += stats.calls;
        result[toolName].tokens += stats.tokens;
      }
    }
    return result;
  }

  /**
   * Get all usage entries in the specified time range across all sessions.
   * Both `from` and `to` are inclusive Unix timestamps (ms).
   */
  getTimeline(from: number, to: number): TokenUsageEntry[] {
    const entries: TokenUsageEntry[] = [];
    for (const session of this._store.sessions.values()) {
      for (const entry of session.entries) {
        if (entry.timestamp >= from && entry.timestamp <= to) {
          entries.push(entry);
        }
      }
    }
    return entries.sort((a, b) => a.timestamp - b.timestamp);
  }
}
