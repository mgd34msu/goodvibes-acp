/**
 * @module plugins/analytics/budget
 * @layer L3 — plugin
 *
 * Token budget tracking. Maintains per-session budgets and emits warnings
 * when usage crosses configured thresholds.
 */

import type { TokenBudget, TokenUsageEntry, AnalyticsStore } from './types.js';

const DEFAULT_TOTAL_BUDGET = 100_000;
const DEFAULT_WARNING_THRESHOLD = 0.75;
const DEFAULT_ALERT_THRESHOLD = 0.90;

/** Manages per-session token budgets */
export class BudgetTracker {
  private readonly _store: AnalyticsStore;

  constructor(store: AnalyticsStore) {
    this._store = store;
  }

  /**
   * Record a token usage entry and update the session budget.
   * Creates the session budget with defaults if it does not exist.
   */
  track(entry: TokenUsageEntry, sessionId: string): void {
    let budget = this._store.budgets.get(sessionId);
    if (!budget) {
      budget = this._createDefaultBudget(sessionId);
      this._store.budgets.set(sessionId, budget);
    }
    const consumed = entry.tokensIn + entry.tokensOut;
    budget.used += consumed;
    budget.remaining = Math.max(0, budget.totalBudget - budget.used);
  }

  /**
   * Get the current budget for a session.
   * Creates a default budget if none exists.
   */
  getBudget(sessionId: string): TokenBudget {
    let budget = this._store.budgets.get(sessionId);
    if (!budget) {
      budget = this._createDefaultBudget(sessionId);
      this._store.budgets.set(sessionId, budget);
    }
    return budget;
  }

  /**
   * Set (or replace) the total budget for a session.
   * Preserves existing used/remaining values when updating.
   */
  setBudget(
    sessionId: string,
    total: number,
    warningThreshold = DEFAULT_WARNING_THRESHOLD,
    alertThreshold = DEFAULT_ALERT_THRESHOLD
  ): void {
    const existing = this._store.budgets.get(sessionId);
    const used = existing?.used ?? 0;
    const budget: TokenBudget = {
      sessionId,
      totalBudget: total,
      used,
      remaining: Math.max(0, total - used),
      warningThreshold,
      alertThreshold,
    };
    this._store.budgets.set(sessionId, budget);
  }

  /** Returns true if the session has exceeded its total budget */
  isOverBudget(sessionId: string): boolean {
    const budget = this._store.budgets.get(sessionId);
    if (!budget) return false;
    return budget.used >= budget.totalBudget;
  }

  /**
   * Returns warning messages for the session based on threshold crossings.
   * Returns an empty array if no thresholds have been crossed.
   */
  getWarnings(sessionId: string): string[] {
    const budget = this._store.budgets.get(sessionId);
    if (!budget || budget.totalBudget === 0) return [];

    const utilization = budget.used / budget.totalBudget;
    const warnings: string[] = [];

    if (utilization >= 1.0) {
      warnings.push(
        `Session '${sessionId}' has EXCEEDED its token budget (${budget.used}/${budget.totalBudget} tokens used)`
      );
    } else if (utilization >= budget.alertThreshold) {
      warnings.push(
        `Session '${sessionId}' has reached ALERT threshold: ${
          (utilization * 100).toFixed(1)
        }% of budget used (${budget.used}/${budget.totalBudget})`
      );
    } else if (utilization >= budget.warningThreshold) {
      warnings.push(
        `Session '${sessionId}' has reached WARNING threshold: ${
          (utilization * 100).toFixed(1)
        }% of budget used (${budget.used}/${budget.totalBudget})`
      );
    }

    return warnings;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _createDefaultBudget(sessionId: string): TokenBudget {
    return {
      sessionId,
      totalBudget: DEFAULT_TOTAL_BUDGET,
      used: 0,
      remaining: DEFAULT_TOTAL_BUDGET,
      warningThreshold: DEFAULT_WARNING_THRESHOLD,
      alertThreshold: DEFAULT_ALERT_THRESHOLD,
    };
  }
}
