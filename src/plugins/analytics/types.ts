/**
 * @module plugins/analytics/types
 * @layer L3 — plugin
 *
 * Analytics plugin types: token budget tracking, session analytics, and data export.
 */

// ---------------------------------------------------------------------------
// Core data types
// ---------------------------------------------------------------------------

/** Token budget state for a session */
export type TokenBudget = {
  /** Session this budget belongs to */
  sessionId: string;
  /** Total token budget allocated */
  totalBudget: number;
  /** Tokens used so far */
  used: number;
  /** Remaining tokens (totalBudget - used) */
  remaining: number;
  /** Fraction at which a warning is emitted (0–1, default 0.75) */
  warningThreshold: number;
  /** Fraction at which an alert is emitted (0–1, default 0.90) */
  alertThreshold: number;
};

/** A single token usage event */
export type TokenUsageEntry = {
  /** Unix timestamp (ms) */
  timestamp: number;
  /** Tool that was called */
  toolName: string;
  /** Input tokens consumed */
  tokensIn: number;
  /** Output tokens produced */
  tokensOut: number;
  /** Wall-clock duration in ms */
  durationMs: number;
};

/** Aggregated analytics for one session */
export type SessionAnalytics = {
  /** Session identifier */
  sessionId: string;
  /** Unix timestamp (ms) when the session started */
  startedAt: number;
  /** All usage entries recorded in this session */
  entries: TokenUsageEntry[];
  /** Sum of all tokensIn across entries */
  totalTokensIn: number;
  /** Sum of all tokensOut across entries */
  totalTokensOut: number;
  /** Per-tool breakdown: calls and total tokens */
  toolBreakdown: Record<string, { calls: number; tokens: number }>;
};

/** Supported export formats */
export type AnalyticsExportFormat = 'json' | 'csv' | 'markdown';

/** Dashboard summary data */
export type DashboardData = {
  /** Number of sessions with at least one entry */
  activeSessions: number;
  /** Total tokens used across all sessions */
  totalTokensUsed: number;
  /** Map of sessionId → budget utilization fraction (0–1) */
  budgetUtilization: Record<string, number>;
  /** Top tools by total token consumption */
  topTools: Array<{ toolName: string; calls: number; tokens: number }>;
  /** Most recent usage entries (up to 20) */
  recentEntries: TokenUsageEntry[];
};

// ---------------------------------------------------------------------------
// Operation param types
// ---------------------------------------------------------------------------

/** Parameters for budget operations */
export type BudgetParams = {
  /** Session to operate on */
  sessionId: string;
  /** Total budget to set (used with setBudget) */
  totalBudget?: number;
  /** Warning threshold fraction (default 0.75) */
  warningThreshold?: number;
  /** Alert threshold fraction (default 0.90) */
  alertThreshold?: number;
};

/** Parameters for analytics queries */
export type QueryParams = {
  /** Session to query (omit for all sessions) */
  sessionId?: string;
  /** Start of time range (Unix ms, inclusive) */
  from?: number;
  /** End of time range (Unix ms, inclusive) */
  to?: number;
  /** Maximum entries to return */
  limit?: number;
};

/** Parameters for export operations */
export type ExportParams = {
  /** Session to export (omit for all sessions) */
  sessionId?: string;
  /** Export format */
  format: AnalyticsExportFormat;
};

/** Parameters for sync operations */
export type SyncParams = {
  /** Session to sync */
  sessionId: string;
};

/** Parameters for dashboard queries */
export type DashboardParams = {
  /** Maximum number of top tools to include (default 10) */
  topToolsLimit?: number;
  /** Maximum recent entries to include (default 20) */
  recentEntriesLimit?: number;
};

/** Parameters for tagging/annotating entries */
export type TagParams = {
  /** Session to tag */
  sessionId: string;
  /** Tag key */
  key: string;
  /** Tag value */
  value: string;
};

/** Parameters for analytics configuration */
export type ConfigParams = {
  /** Default total budget for new sessions */
  defaultBudget?: number;
  /** Default warning threshold (0–1) */
  defaultWarningThreshold?: number;
  /** Default alert threshold (0–1) */
  defaultAlertThreshold?: number;
  /** Directory to persist analytics data */
  storageDir?: string;
};

/** Shared in-memory analytics store — passed to sub-components */
export type AnalyticsStore = {
  /** Sessions keyed by sessionId */
  sessions: Map<string, SessionAnalytics>;
  /** Budgets keyed by sessionId */
  budgets: Map<string, TokenBudget>;
  /** Per-session tags */
  tags: Map<string, Record<string, string>>;
};
