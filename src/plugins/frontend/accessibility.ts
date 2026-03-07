/**
 * @module plugins/frontend/accessibility
 * @layer L3 — plugin
 *
 * AccessibilityChecker: static analysis of JSX/TSX files for a11y issues.
 * Rule-based, regex-driven — no runtime DOM access.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { A11yIssue, A11yReport, A11yRuleBreakdown, A11ySeverity } from './types.js';

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------

type A11yRule = {
  id: string;
  severity: A11ySeverity;
  description: string;
  check: (source: string) => A11yIssue[];
};

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/** Extract line number for a match index in source */
function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Find all regex matches with their line numbers */
function findMatches(
  source: string,
  pattern: RegExp
): Array<{ match: RegExpExecArray; line: number }> {
  const results: Array<{ match: RegExpExecArray; line: number }> = [];
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source)) !== null) {
    results.push({ match: m, line: lineAt(source, m.index) });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

/** Rule: img elements must have alt attribute */
const imgAltRule: A11yRule = {
  id: 'img-alt',
  severity: 'error',
  description: 'img elements must have an alt attribute',
  check(source) {
    const issues: A11yIssue[] = [];
    // Match <img ... > or <img ... /> that do NOT contain alt=
    const imgRe = /<img\b([^>]*?)\/?>/g;
    const matches = findMatches(source, imgRe);
    for (const { match, line } of matches) {
      const attrs = match[1] ?? '';
      if (!/\balt\s*=/.test(attrs)) {
        issues.push({
          severity: 'error',
          rule: 'img-alt',
          element: 'img',
          message: 'img element is missing an alt attribute',
          line,
          suggestion: 'Add alt="" for decorative images or alt="description" for informative ones',
        });
      }
    }
    return issues;
  },
};

/** Rule: interactive elements without visible text need aria-label */
const interactiveAriaLabelRule: A11yRule = {
  id: 'interactive-aria-label',
  severity: 'warning',
  description: 'Interactive elements without text content need aria-label',
  check(source) {
    const issues: A11yIssue[] = [];
    // Find self-closing interactive elements: <button />, <input />, <a />
    const selfClosingRe = /<(button|input|a)\b([^>]*?)\s*\/>/g;
    const matches = findMatches(source, selfClosingRe);
    for (const { match, line } of matches) {
      const tag = match[1] ?? 'element';
      const attrs = match[2] ?? '';
      if (!/aria-label|aria-labelledby|aria-describedby/.test(attrs)) {
        issues.push({
          severity: 'warning',
          rule: 'interactive-aria-label',
          element: tag,
          message: `${tag} element may lack accessible label`,
          line,
          suggestion: 'Add aria-label or aria-labelledby to provide an accessible name',
        });
      }
    }
    return issues;
  },
};

/** Rule: click handlers on non-interactive elements without role */
const clickableRoleRule: A11yRule = {
  id: 'clickable-role',
  severity: 'error',
  description: 'Non-interactive elements with click handlers must have a role',
  check(source) {
    const issues: A11yIssue[] = [];
    // Find <div onClick= or <span onClick= without role=
    const clickRe = /<(div|span)\b([^>]*?)onClick=["'{][^>]*?>/g;
    const matches = findMatches(source, clickRe);
    for (const { match, line } of matches) {
      const tag = match[1] ?? 'div';
      const attrs = match[2] ?? '';
      if (!/\brole\s*=/.test(attrs)) {
        issues.push({
          severity: 'error',
          rule: 'clickable-role',
          element: tag,
          message: `${tag} has onClick but no role attribute`,
          line,
          suggestion:
            'Add role="button" and make the element keyboard-accessible with onKeyDown',
        });
      }
    }
    return issues;
  },
};

/** Rule: label must have htmlFor */
const labelHtmlForRule: A11yRule = {
  id: 'label-html-for',
  severity: 'error',
  description: 'label elements should have htmlFor attribute',
  check(source) {
    const issues: A11yIssue[] = [];
    // Find <label without htmlFor and without a nested input (simplified: just check attr)
    const labelRe = /<label\b([^>]*?)>/g;
    const matches = findMatches(source, labelRe);
    for (const { match, line } of matches) {
      const attrs = match[1] ?? '';
      if (!/htmlFor\s*=|for\s*=/.test(attrs)) {
        issues.push({
          severity: 'error',
          rule: 'label-html-for',
          element: 'label',
          message: 'label element is missing htmlFor attribute',
          line,
          suggestion: 'Add htmlFor="inputId" to associate the label with its input',
        });
      }
    }
    return issues;
  },
};

/** Rule: headings should not be empty */
const emptyHeadingRule: A11yRule = {
  id: 'empty-heading',
  severity: 'warning',
  description: 'Headings should not be empty',
  check(source) {
    const issues: A11yIssue[] = [];
    // Match <h1></h1> through <h6></h6> (empty)
    const emptyHeadingRe = /<(h[1-6])\b[^>]*>\s*<\/\1>/g;
    const matches = findMatches(source, emptyHeadingRe);
    for (const { match, line } of matches) {
      const tag = match[1] ?? 'heading';
      issues.push({
        severity: 'warning',
        rule: 'empty-heading',
        element: tag,
        message: `${tag} element is empty`,
        line,
        suggestion: 'Add meaningful text content to the heading',
      });
    }
    return issues;
  },
};

/** Rule: html element should have lang attribute */
const htmlLangRule: A11yRule = {
  id: 'html-lang',
  severity: 'error',
  description: 'html element must have a lang attribute',
  check(source) {
    const issues: A11yIssue[] = [];
    // Find <html without lang=
    const htmlRe = /<html\b([^>]*)>/g;
    const matches = findMatches(source, htmlRe);
    for (const { match, line } of matches) {
      const attrs = match[1] ?? '';
      if (!/\blang\s*=/.test(attrs)) {
        issues.push({
          severity: 'error',
          rule: 'html-lang',
          element: 'html',
          message: 'html element is missing lang attribute',
          line,
          suggestion: 'Add lang="en" (or the appropriate language code)',
        });
      }
    }
    return issues;
  },
};

/** Rule: flag inline color styles (potential contrast issues) */
const colorContrastHintRule: A11yRule = {
  id: 'color-contrast-hint',
  severity: 'info',
  description: 'Inline color styles may cause contrast issues',
  check(source) {
    const issues: A11yIssue[] = [];
    // Match style={{ color: '...' }} or style={{ backgroundColor: '...' }}
    const inlineColorRe = /style\s*=\s*\{\{[^}]*(?:color|backgroundColor)\s*:\s*['"#][^}]*\}\}/g;
    const matches = findMatches(source, inlineColorRe);
    for (const { match, line } of matches) {
      issues.push({
        severity: 'info',
        rule: 'color-contrast-hint',
        element: match[0].slice(0, 40),
        message: 'Hardcoded color may not meet contrast requirements',
        line,
        suggestion: 'Use design tokens or CSS variables and verify contrast ratio is 4.5:1 for normal text',
      });
    }
    return issues;
  },
};

/** Rule: tabIndex > 0 is an anti-pattern */
const tabIndexRule: A11yRule = {
  id: 'tab-index-positive',
  severity: 'warning',
  description: 'Positive tabIndex values disrupt natural tab order',
  check(source) {
    const issues: A11yIssue[] = [];
    // Match tabIndex={N} where N > 0 or tabIndex="N" where N > 0
    const tabIndexRe = /tabIndex\s*=\s*(?:\{([1-9]\d*)\}|"([1-9]\d*)")/g;
    const matches = findMatches(source, tabIndexRe);
    for (const { match, line } of matches) {
      issues.push({
        severity: 'warning',
        rule: 'tab-index-positive',
        element: match[0],
        message: 'Positive tabIndex disrupts natural keyboard navigation order',
        line,
        suggestion: 'Use tabIndex={0} or tabIndex={-1} instead',
      });
    }
    return issues;
  },
};

/** Rule: autoFocus usage may cause UX issues */
const autoFocusRule: A11yRule = {
  id: 'auto-focus',
  severity: 'warning',
  description: 'autoFocus can disorient screen reader users',
  check(source) {
    const issues: A11yIssue[] = [];
    const autoFocusRe = /\bautoFocus\b/g;
    const matches = findMatches(source, autoFocusRe);
    for (const { match, line } of matches) {
      issues.push({
        severity: 'warning',
        rule: 'auto-focus',
        element: match[0],
        message: 'autoFocus can disrupt screen reader navigation',
        line,
        suggestion: 'Use autoFocus only when it meaningfully improves UX (e.g., modal dialogs)',
      });
    }
    return issues;
  },
};

// All rules in order
const ALL_RULES: A11yRule[] = [
  imgAltRule,
  interactiveAriaLabelRule,
  clickableRoleRule,
  labelHtmlForRule,
  emptyHeadingRule,
  htmlLangRule,
  colorContrastHintRule,
  tabIndexRule,
  autoFocusRule,
];

// ---------------------------------------------------------------------------
// AccessibilityChecker
// ---------------------------------------------------------------------------

/** Static accessibility checker for JSX/TSX source files */
export class AccessibilityChecker {
  /**
   * Scan a list of files for accessibility issues.
   */
  async check(files: string[]): Promise<A11yReport> {
    const allIssues: A11yIssue[] = [];

    for (const file of files) {
      try {
        const source = await readFile(resolve(file), 'utf-8');
        for (const rule of ALL_RULES) {
          const issues = rule.check(source);
          allIssues.push(...issues);
        }
      } catch (err: unknown) {
        console.error('[Accessibility] file read error:', err);
      }
    }

    return this._buildReport(allIssues);
  }

  /**
   * Compute a 0–100 accessibility score from a list of issues.
   * Errors have weight 10, warnings 3, info 1.
   */
  scoreFromIssues(issues: A11yIssue[]): number {
    if (issues.length === 0) return 100;
    const penalty = issues.reduce((sum, issue) => {
      switch (issue.severity) {
        case 'error':
          return sum + 10;
        case 'warning':
          return sum + 3;
        case 'info':
          return sum + 1;
        default:
          return sum;
      }
    }, 0);
    return Math.max(0, 100 - penalty);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _buildReport(issues: A11yIssue[]): A11yReport {
    const score = this.scoreFromIssues(issues);
    const ruleIds = new Set(ALL_RULES.map((r) => r.id));
    const issuesByRule = new Map<string, A11yIssue[]>();
    for (const issue of issues) {
      if (!issuesByRule.has(issue.rule)) issuesByRule.set(issue.rule, []);
      issuesByRule.get(issue.rule)!.push(issue);
    }

    const failedRules = new Set(issuesByRule.keys());
    const passCount = ruleIds.size - failedRules.size;
    const failCount = failedRules.size;

    const ruleBreakdown: A11yRuleBreakdown[] = ALL_RULES.map((rule) => ({
      rule: rule.id,
      count: issuesByRule.get(rule.id)?.length ?? 0,
      severity: rule.severity,
    }));

    return { issues, score, passCount, failCount, ruleBreakdown };
  }
}
