/**
 * @module plugins/analytics/export
 * @layer L3 — plugin
 *
 * Analytics export — serialises session data to JSON, CSV, or Markdown.
 */

import type {
  AnalyticsExportFormat,
  SessionAnalytics,
  TokenUsageEntry,
  AnalyticsStore,
} from './types.js';

/** Exports analytics data to various formats */
export class AnalyticsExporter {
  private readonly _store: AnalyticsStore;

  constructor(store: AnalyticsStore) {
    this._store = store;
  }

  /**
   * Export analytics for a single session.
   * @throws Error if the session is not found.
   */
  exportSession(sessionId: string, format: AnalyticsExportFormat): string {
    const session = this._store.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Analytics: session '${sessionId}' not found`);
    }
    return this._format([session], format);
  }

  /** Export analytics for all sessions */
  exportAll(format: AnalyticsExportFormat): string {
    const sessions = Array.from(this._store.sessions.values());
    return this._format(sessions, format);
  }

  // ---------------------------------------------------------------------------
  // Private formatting methods
  // ---------------------------------------------------------------------------

  private _format(sessions: SessionAnalytics[], format: AnalyticsExportFormat): string {
    switch (format) {
      case 'json':
        return this._toJson(sessions);
      case 'csv':
        return this._toCsv(sessions);
      case 'markdown':
        return this._toMarkdown(sessions);
    }
  }

  private _toJson(sessions: SessionAnalytics[]): string {
    return JSON.stringify(sessions, null, 2);
  }

  private _toCsv(sessions: SessionAnalytics[]): string {
    const lines: string[] = [
      'sessionId,timestamp,toolName,tokensIn,tokensOut,durationMs',
    ];
    for (const session of sessions) {
      for (const entry of session.entries) {
        lines.push(
          [
            this._csvEscape(session.sessionId),
            entry.timestamp.toString(),
            this._csvEscape(entry.toolName),
            entry.tokensIn.toString(),
            entry.tokensOut.toString(),
            entry.durationMs.toString(),
          ].join(',')
        );
      }
    }
    return lines.join('\n');
  }

  private _toMarkdown(sessions: SessionAnalytics[]): string {
    const parts: string[] = [];

    for (const session of sessions) {
      parts.push(`## Session: ${session.sessionId}`);
      parts.push('');
      parts.push(`- **Started at**: ${new Date(session.startedAt).toISOString()}`);
      parts.push(`- **Total tokens in**: ${session.totalTokensIn}`);
      parts.push(`- **Total tokens out**: ${session.totalTokensOut}`);
      parts.push(`- **Total tokens**: ${session.totalTokensIn + session.totalTokensOut}`);
      parts.push(`- **Entries**: ${session.entries.length}`);
      parts.push('');

      // Tool breakdown table
      if (Object.keys(session.toolBreakdown).length > 0) {
        parts.push('### Tool Breakdown');
        parts.push('');
        parts.push('| Tool | Calls | Tokens |');
        parts.push('|------|-------|--------|');
        for (const [toolName, stats] of Object.entries(session.toolBreakdown)) {
          parts.push(`| ${toolName} | ${stats.calls} | ${stats.tokens} |`);
        }
        parts.push('');
      }

      // Usage entries table
      if (session.entries.length > 0) {
        parts.push('### Usage Entries');
        parts.push('');
        parts.push('| Timestamp | Tool | Tokens In | Tokens Out | Duration (ms) |');
        parts.push('|-----------|------|-----------|------------|---------------|');
        for (const entry of session.entries) {
          const ts = new Date(entry.timestamp).toISOString();
          parts.push(
            `| ${ts} | ${entry.toolName} | ${entry.tokensIn} | ${entry.tokensOut} | ${entry.durationMs} |`
          );
        }
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * Escape a string value for CSV — wraps in quotes if it contains
   * commas, newlines, or double-quote characters.
   */
  private _csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private _formatEntry(_entry: TokenUsageEntry): string {
    // Utility kept for potential future single-entry formatting
    return '';
  }
}
