/**
 * Tests for L3 AnalyticsEngine + BudgetTracker + AnalyticsExporter.
 * Covers token tracking, budget management, dashboard aggregation, and export formats.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { AnalyticsEngine } from '../../src/plugins/analytics/engine.ts';
import type { TokenUsageEntry } from '../../src/plugins/analytics/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(toolName: string, tokensIn: number, tokensOut: number, durationMs = 50): TokenUsageEntry {
  return {
    timestamp: Date.now(),
    toolName,
    tokensIn,
    tokensOut,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

describe('AnalyticsEngine — session management', () => {
  it('creates a session on first ensureSession call', () => {
    const engine = new AnalyticsEngine();
    const session = engine.ensureSession('sess-1');
    expect(session.sessionId).toBe('sess-1');
    expect(session.entries).toHaveLength(0);
    expect(session.totalTokensIn).toBe(0);
    expect(session.totalTokensOut).toBe(0);
  });

  it('returns existing session on subsequent ensureSession calls', () => {
    const engine = new AnalyticsEngine();
    const s1 = engine.ensureSession('sess-2');
    const s2 = engine.ensureSession('sess-2');
    expect(s1).toBe(s2); // same reference
  });

  it('sessions have unique IDs', () => {
    const engine = new AnalyticsEngine();
    const a = engine.ensureSession('alpha');
    const b = engine.ensureSession('beta');
    expect(a.sessionId).not.toBe(b.sessionId);
  });

  it('session startedAt is a positive number', () => {
    const engine = new AnalyticsEngine();
    const session = engine.ensureSession('sess-ts');
    expect(typeof session.startedAt).toBe('number');
    expect(session.startedAt).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Token tracking
// ---------------------------------------------------------------------------

describe('AnalyticsEngine — token tracking', () => {
  let engine: AnalyticsEngine;

  beforeEach(() => {
    engine = new AnalyticsEngine();
  });

  it('track() adds an entry to the session', () => {
    engine.track('sess-1', makeEntry('precision_read', 100, 200));
    const session = engine.ensureSession('sess-1');
    expect(session.entries).toHaveLength(1);
  });

  it('track() accumulates totalTokensIn and totalTokensOut', () => {
    engine.track('sess-1', makeEntry('precision_read', 100, 200));
    engine.track('sess-1', makeEntry('precision_write', 50, 75));
    const session = engine.ensureSession('sess-1');
    expect(session.totalTokensIn).toBe(150);
    expect(session.totalTokensOut).toBe(275);
  });

  it('track() updates tool breakdown per-tool', () => {
    engine.track('sess-1', makeEntry('tool_a', 100, 200));
    engine.track('sess-1', makeEntry('tool_a', 50, 50));
    engine.track('sess-1', makeEntry('tool_b', 30, 40));

    const session = engine.ensureSession('sess-1');
    expect(session.toolBreakdown['tool_a'].calls).toBe(2);
    expect(session.toolBreakdown['tool_a'].tokens).toBe(400); // (100+200) + (50+50)
    expect(session.toolBreakdown['tool_b'].calls).toBe(1);
    expect(session.toolBreakdown['tool_b'].tokens).toBe(70);
  });

  it('track() auto-creates session if not present', () => {
    engine.track('new-session', makeEntry('tool', 10, 20));
    const session = engine.ensureSession('new-session');
    expect(session.totalTokensIn).toBe(10);
  });

  it('each entry stores the toolName correctly', () => {
    engine.track('sess-1', makeEntry('my_tool', 5, 10));
    const session = engine.ensureSession('sess-1');
    expect(session.entries[0].toolName).toBe('my_tool');
  });
});

// ---------------------------------------------------------------------------
// Budget management
// ---------------------------------------------------------------------------

describe('AnalyticsEngine — budget management', () => {
  let engine: AnalyticsEngine;

  beforeEach(() => {
    engine = new AnalyticsEngine();
  });

  it('getBudget creates a default budget for new sessions', () => {
    const budget = engine.getBudget('sess-budget');
    expect(budget.sessionId).toBe('sess-budget');
    expect(budget.totalBudget).toBe(100_000);
    expect(budget.used).toBe(0);
    expect(budget.remaining).toBe(100_000);
  });

  it('default budget has warningThreshold and alertThreshold', () => {
    const budget = engine.getBudget('sess-thresholds');
    expect(budget.warningThreshold).toBeGreaterThan(0);
    expect(budget.alertThreshold).toBeGreaterThan(budget.warningThreshold);
  });

  it('setBudget sets the total budget', () => {
    engine.setBudget('sess-1', 50_000);
    const budget = engine.getBudget('sess-1');
    expect(budget.totalBudget).toBe(50_000);
  });

  it('setBudget preserves used tokens when updating', () => {
    engine.track('sess-1', makeEntry('tool', 10_000, 5_000));
    engine.setBudget('sess-1', 20_000);
    const budget = engine.getBudget('sess-1');
    expect(budget.used).toBe(15_000);
    expect(budget.remaining).toBe(5_000);
  });

  it('isOverBudget returns false when under budget', () => {
    engine.setBudget('sess-1', 100_000);
    engine.track('sess-1', makeEntry('tool', 100, 200));
    expect(engine.isOverBudget('sess-1')).toBe(false);
  });

  it('isOverBudget returns true when exceeded', () => {
    engine.setBudget('sess-1', 100);
    engine.track('sess-1', makeEntry('tool', 60, 60));
    expect(engine.isOverBudget('sess-1')).toBe(true);
  });

  it('isOverBudget returns false for unknown session (no budget set)', () => {
    expect(engine.isOverBudget('nonexistent')).toBe(false);
  });

  it('budget remaining does not go below 0', () => {
    engine.setBudget('sess-1', 100);
    engine.track('sess-1', makeEntry('tool', 200, 200));
    const budget = engine.getBudget('sess-1');
    expect(budget.remaining).toBe(0);
  });

  it('getWarnings returns warning when approaching budget', () => {
    engine.setBudget('sess-1', 1000, 0.5, 0.8);
    engine.track('sess-1', makeEntry('tool', 600, 0)); // 60% used
    const warnings = engine.getWarnings('sess-1');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('sess-1');
  });

  it('getWarnings returns empty array when under warning threshold', () => {
    engine.setBudget('sess-1', 1000);
    engine.track('sess-1', makeEntry('tool', 10, 0));
    const warnings = engine.getWarnings('sess-1');
    expect(warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Dashboard aggregation
// ---------------------------------------------------------------------------

describe('AnalyticsEngine — dashboard', () => {
  it('getDashboard returns activeSessions count', () => {
    const engine = new AnalyticsEngine();
    engine.track('sess-1', makeEntry('tool', 100, 200));
    engine.track('sess-2', makeEntry('tool', 50, 50));
    const dashboard = engine.getDashboard();
    expect(dashboard.activeSessions).toBe(2);
  });

  it('getDashboard returns totalTokensUsed', () => {
    const engine = new AnalyticsEngine();
    engine.track('sess-1', makeEntry('tool', 100, 200));
    const dashboard = engine.getDashboard();
    expect(dashboard.totalTokensUsed).toBe(300);
  });

  it('getDashboard returns topTools sorted by token consumption', () => {
    const engine = new AnalyticsEngine();
    engine.track('sess-1', makeEntry('cheap_tool', 10, 10));
    engine.track('sess-1', makeEntry('expensive_tool', 500, 500));
    const dashboard = engine.getDashboard();
    expect(dashboard.topTools[0].toolName).toBe('expensive_tool');
    expect(dashboard.topTools[1].toolName).toBe('cheap_tool');
  });

  it('getDashboard recentEntries is capped at 20', () => {
    const engine = new AnalyticsEngine();
    for (let i = 0; i < 25; i++) {
      engine.track('sess-1', makeEntry('tool', 10, 10));
    }
    const dashboard = engine.getDashboard();
    expect(dashboard.recentEntries.length).toBeLessThanOrEqual(20);
  });

  it('getDashboard budgetUtilization is a fraction between 0 and 1', () => {
    const engine = new AnalyticsEngine();
    engine.setBudget('sess-1', 1000);
    engine.track('sess-1', makeEntry('tool', 250, 250));
    const dashboard = engine.getDashboard();
    expect(dashboard.budgetUtilization['sess-1']).toBeCloseTo(0.5, 5);
  });

  it('getToolBreakdown aggregates across sessions', () => {
    const engine = new AnalyticsEngine();
    engine.track('sess-1', makeEntry('shared_tool', 100, 200));
    engine.track('sess-2', makeEntry('shared_tool', 50, 50));
    const breakdown = engine.getToolBreakdown();
    expect(breakdown['shared_tool'].calls).toBe(2);
    expect(breakdown['shared_tool'].tokens).toBe(400);
  });

  it('getSessionAnalytics returns undefined for unknown session', () => {
    const engine = new AnalyticsEngine();
    expect(engine.getSessionAnalytics('ghost')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Export formats
// ---------------------------------------------------------------------------

describe('AnalyticsEngine — export', () => {
  let engine: AnalyticsEngine;

  beforeEach(() => {
    engine = new AnalyticsEngine();
    engine.track('sess-export', makeEntry('precision_read', 100, 200, 30));
    engine.track('sess-export', makeEntry('precision_write', 50, 75, 10));
  });

  it('exportSession to JSON format produces valid JSON', () => {
    const json = engine.exportSession('sess-export', 'json');
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].sessionId).toBe('sess-export');
  });

  it('exportSession to CSV format has header row', () => {
    const csv = engine.exportSession('sess-export', 'csv');
    const lines = csv.split('\n');
    expect(lines[0]).toBe('sessionId,timestamp,toolName,tokensIn,tokensOut,durationMs');
    expect(lines.length).toBeGreaterThanOrEqual(3); // header + 2 entries
  });

  it('CSV rows contain correct session data', () => {
    const csv = engine.exportSession('sess-export', 'csv');
    expect(csv).toContain('precision_read');
    expect(csv).toContain('precision_write');
    expect(csv).toContain('sess-export');
  });

  it('exportSession to Markdown format with session header', () => {
    const md = engine.exportSession('sess-export', 'markdown');
    expect(md).toContain('## Session: sess-export');
    expect(md).toContain('Total tokens in');
    expect(md).toContain('precision_read');
  });

  it('exportAll exports all sessions as JSON', () => {
    const engine2 = new AnalyticsEngine();
    engine2.track('s1', makeEntry('tool', 10, 20));
    engine2.track('s2', makeEntry('tool', 30, 40));
    const json = engine2.exportAll('json');
    const parsed = JSON.parse(json);
    expect(parsed.length).toBe(2);
  });

  it('exportSession throws for non-existent session', () => {
    expect(() => engine.exportSession('ghost-session', 'json')).toThrow();
  });
});
