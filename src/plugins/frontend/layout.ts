/**
 * @module plugins/frontend/layout
 * @layer L3 — plugin
 *
 * LayoutAnalyzer: static analysis of CSS classes and inline styles
 * in JSX/TSX files. Detects overflow, breakpoints, stacking contexts,
 * and Tailwind class conflicts.
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { BreakpointConfig, LayoutAnalysis, LayoutNode } from './types.js';

// ---------------------------------------------------------------------------
// Tailwind conflict definitions
// ---------------------------------------------------------------------------

/** Known conflicting Tailwind class pairs (first class conflicts with second) */
const TAILWIND_CONFLICT_PAIRS: [string, string][] = [
  ['flex', 'grid'],
  ['flex', 'block'],
  ['flex', 'inline'],
  ['flex', 'hidden'],
  ['grid', 'block'],
  ['grid', 'inline'],
  ['grid', 'hidden'],
  ['absolute', 'relative'],
  ['absolute', 'fixed'],
  ['absolute', 'static'],
  ['fixed', 'relative'],
  ['fixed', 'static'],
  ['overflow-hidden', 'overflow-auto'],
  ['overflow-hidden', 'overflow-scroll'],
  ['overflow-auto', 'overflow-scroll'],
  ['w-full', 'w-screen'],
  ['h-full', 'h-screen'],
];

/** Default Tailwind breakpoints */
const DEFAULT_BREAKPOINTS: BreakpointConfig[] = [
  { name: 'sm', minWidth: 640 },
  { name: 'md', minWidth: 768 },
  { name: 'lg', minWidth: 1024 },
  { name: 'xl', minWidth: 1280 },
  { name: '2xl', minWidth: 1536 },
];

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Match className="..." or className={`...`} */
const CLASS_NAME_RE = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

/** Match z-index usage */
const Z_INDEX_RE = /\bz-(?:index|[0-9]+|auto|\[[-\d]+\])/g;

/** Match overflow-hidden/auto/scroll/visible in classes or style */
const OVERFLOW_CLASS_RE = /\boverflow-(?:hidden|auto|scroll|x-hidden|y-hidden)/g;
const OVERFLOW_STYLE_RE = /overflow(?:X|Y)?\s*:\s*['"](hidden|auto|scroll)/g;

/** Match fixed/absolute positioned elements without explicit dimensions */
const FIXED_NO_SIZE_RE = /<[\w]+[^>]*className=["'][^"']*(?:fixed|absolute)[^"']*["'][^>]*>/g;

/** Match JSX opening tags */
const JSX_TAG_RE = /<([a-zA-Z][\w.-]*)\b([^>]*)>/g;

// ---------------------------------------------------------------------------
// LayoutAnalyzer
// ---------------------------------------------------------------------------

/** Static layout analysis for JSX/TSX and config files */
export class LayoutAnalyzer {
  /**
   * Parse a file for layout structure and issues.
   */
  async analyzeFile(filePath: string): Promise<LayoutAnalysis> {
    const abs = resolve(filePath);
    let source = '';
    try {
      source = await readFile(abs, 'utf-8');
    } catch {
      return this._emptyAnalysis();
    }

    const tree = this._buildLayoutTree(source);
    const issues: string[] = [];

    // Check for overflow issues
    const overflowIssues = await this.findOverflow(filePath);
    issues.push(...overflowIssues);

    // Check for fixed elements without size
    FIXED_NO_SIZE_RE.lastIndex = 0;
    let fixedMatch: RegExpExecArray | null;
    while ((fixedMatch = FIXED_NO_SIZE_RE.exec(source)) !== null) {
      const line = source.slice(0, fixedMatch.index).split('\n').length;
      issues.push(
        `Line ${line}: fixed/absolute element may need explicit width/height`
      );
    }

    const stackingContexts = await this.findStackingContexts(filePath);

    return { tree, issues, stackingContexts };
  }

  /**
   * Detect potential overflow issues in a file.
   */
  async findOverflow(filePath: string): Promise<string[]> {
    const abs = resolve(filePath);
    const issues: string[] = [];
    let source = '';
    try {
      source = await readFile(abs, 'utf-8');
    } catch {
      return issues;
    }

    // Find overflow class usages
    OVERFLOW_CLASS_RE.lastIndex = 0;
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      if (OVERFLOW_CLASS_RE.test(line)) {
        OVERFLOW_CLASS_RE.lastIndex = 0;
        // Check if parent might clip children with fixed heights
        if (/\bh-\d+\b|\bmax-h-\d+\b|\bh-\[/.test(line)) {
          issues.push(
            `Line ${i + 1}: overflow control with fixed height may clip content`
          );
        }
      }

      // Find overflow style usage
      OVERFLOW_STYLE_RE.lastIndex = 0;
      if (OVERFLOW_STYLE_RE.test(line)) {
        issues.push(`Line ${i + 1}: inline overflow style detected`);
      }
    }

    return issues;
  }

  /**
   * Detect responsive breakpoints from Tailwind config or CSS custom properties.
   */
  async detectBreakpoints(projectRoot: string): Promise<BreakpointConfig[]> {
    const root = resolve(projectRoot);

    // Try to read tailwind.config.ts or tailwind.config.js
    const configPaths = [
      join(root, 'tailwind.config.ts'),
      join(root, 'tailwind.config.js'),
      join(root, 'tailwind.config.cjs'),
    ];

    for (const configPath of configPaths) {
      try {
        const source = await readFile(configPath, 'utf-8');
        const breakpoints = this._parseTailwindBreakpoints(source);
        if (breakpoints.length > 0) return breakpoints;
      } catch {
        // try next
      }
    }

    // Try CSS custom properties
    const cssPaths = [
      join(root, 'src', 'styles', 'globals.css'),
      join(root, 'app', 'globals.css'),
      join(root, 'styles', 'globals.css'),
      join(root, 'src', 'index.css'),
    ];

    for (const cssPath of cssPaths) {
      try {
        const source = await readFile(cssPath, 'utf-8');
        const breakpoints = this._parseCssBreakpoints(source);
        if (breakpoints.length > 0) return breakpoints;
      } catch {
        // try next
      }
    }

    // Return defaults if nothing found
    return DEFAULT_BREAKPOINTS;
  }

  /**
   * Count z-index usages (stacking contexts) in a file.
   */
  async findStackingContexts(filePath: string): Promise<number> {
    const abs = resolve(filePath);
    try {
      const source = await readFile(abs, 'utf-8');
      Z_INDEX_RE.lastIndex = 0;
      const matches = source.match(Z_INDEX_RE);
      return matches?.length ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Detect conflicting Tailwind classes on the same element.
   */
  async analyzeTailwindConflicts(filePath: string): Promise<string[]> {
    const abs = resolve(filePath);
    let source = '';
    try {
      source = await readFile(abs, 'utf-8');
    } catch {
      return [];
    }

    const conflicts: string[] = [];
    CLASS_NAME_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = CLASS_NAME_RE.exec(source)) !== null) {
      const classStr = match[1] ?? match[2] ?? match[3] ?? '';
      const classes = classStr.split(/\s+/).filter(Boolean);
      // Strip responsive prefixes for comparison (e.g., sm:flex → flex)
      const normalized = classes.map((c) => c.replace(/^[a-z0-9]+:/, ''));

      for (const [a, b] of TAILWIND_CONFLICT_PAIRS) {
        if (normalized.includes(a) && normalized.includes(b)) {
          const line = source.slice(0, match.index).split('\n').length;
          conflicts.push(
            `Line ${line}: conflicting classes '${a}' and '${b}' on same element`
          );
        }
      }
    }

    return conflicts;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Build a shallow layout tree from JSX source */
  private _buildLayoutTree(source: string): LayoutNode {
    const nodes: LayoutNode[] = [];
    JSX_TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = JSX_TAG_RE.exec(source)) !== null) {
      const element = match[1] ?? 'unknown';
      const attrs = match[2] ?? '';

      // Extract className
      const classMatch = /className\s*=\s*["']([^"']*)["']/.exec(attrs);
      const classes = classMatch?.[1]?.split(/\s+/) ?? [];

      const display = this._inferDisplay(classes);
      const position = this._inferPosition(classes);
      const dimensions = this._inferDimensions(classes);

      nodes.push({ element, display, position, dimensions, children: [] });
    }

    // Build simple parent-child structure: first node contains subsequent ones
    if (nodes.length === 0) {
      return { element: 'root', display: 'block', position: 'static', children: [] };
    }

    const root = nodes[0]!;
    root.children = nodes.slice(1);
    return root;
  }

  /** Infer CSS display from Tailwind classes */
  private _inferDisplay(classes: string[]): string {
    if (classes.includes('flex') || classes.some((c) => /^(?:sm|md|lg|xl|2xl):flex$/.test(c)))
      return 'flex';
    if (classes.includes('grid') || classes.some((c) => /^(?:sm|md|lg|xl|2xl):grid$/.test(c)))
      return 'grid';
    if (classes.includes('hidden')) return 'none';
    if (classes.includes('inline-flex')) return 'inline-flex';
    if (classes.includes('inline-block')) return 'inline-block';
    if (classes.includes('inline')) return 'inline';
    if (classes.includes('block')) return 'block';
    return 'block';
  }

  /** Infer CSS position from Tailwind classes */
  private _inferPosition(classes: string[]): string {
    if (classes.includes('fixed')) return 'fixed';
    if (classes.includes('absolute')) return 'absolute';
    if (classes.includes('relative')) return 'relative';
    if (classes.includes('sticky')) return 'sticky';
    return 'static';
  }

  /** Infer dimensions from Tailwind classes */
  private _inferDimensions(
    classes: string[]
  ): { width?: string; height?: string } | undefined {
    const widthClass = classes.find((c) => /^w-/.test(c));
    const heightClass = classes.find((c) => /^h-/.test(c));
    if (!widthClass && !heightClass) return undefined;
    return {
      width: widthClass,
      height: heightClass,
    };
  }

  /** Parse breakpoints from Tailwind config source */
  private _parseTailwindBreakpoints(source: string): BreakpointConfig[] {
    const breakpoints: BreakpointConfig[] = [];
    // Match: 'sm': '640px' or sm: { min: '640px' }
    const simpleRe = /['"]?([a-z0-9]+)['"]?\s*:\s*['"]?(\d+)px['"]?/g;
    let m: RegExpExecArray | null;
    while ((m = simpleRe.exec(source)) !== null) {
      const name = m[1];
      const px = parseInt(m[2] ?? '0', 10);
      if (name && px > 0 && px < 4000) {
        breakpoints.push({ name, minWidth: px });
      }
    }
    return breakpoints;
  }

  /** Parse breakpoints from CSS media query source */
  private _parseCssBreakpoints(source: string): BreakpointConfig[] {
    const breakpoints: BreakpointConfig[] = [];
    const mediaRe = /@media[^{]*min-width:\s*(\d+)px/g;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = mediaRe.exec(source)) !== null) {
      const px = parseInt(m[1] ?? '0', 10);
      if (px > 0) {
        breakpoints.push({ name: `bp${idx++}`, minWidth: px });
      }
    }
    return breakpoints;
  }

  private _emptyAnalysis(): LayoutAnalysis {
    return {
      tree: { element: 'root', display: 'block', position: 'static', children: [] },
      issues: [],
      stackingContexts: 0,
    };
  }
}
