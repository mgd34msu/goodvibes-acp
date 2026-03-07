/**
 * @module plugins/frontend/analyzer
 * @layer L3 — plugin
 *
 * FrontendAnalyzer: facade composing ComponentAnalyzer, AccessibilityChecker,
 * and LayoutAnalyzer into a single unified analysis interface.
 */

import { resolve } from 'node:path';
import { ComponentAnalyzer } from './components.js';
import { AccessibilityChecker } from './accessibility.js';
import { LayoutAnalyzer } from './layout.js';
import type {
  FrontendAnalysisParams,
  FrontendAnalysisResult,
  ComponentTree,
  ComponentNode,
  A11yReport,
  BreakpointConfig,
} from './types.js';

/** Unified frontend analysis facade */
export class FrontendAnalyzer {
  private readonly components: ComponentAnalyzer;
  private readonly a11y: AccessibilityChecker;
  private readonly layout: LayoutAnalyzer;

  constructor() {
    this.components = new ComponentAnalyzer();
    this.a11y = new AccessibilityChecker();
    this.layout = new LayoutAnalyzer();
  }

  /**
   * Run full frontend analysis for a project.
   * Detects framework, builds component tree, checks accessibility,
   * finds client boundaries, and analyzes layout.
   */
  async analyze(params: FrontendAnalysisParams): Promise<FrontendAnalysisResult> {
    const root = resolve(params.projectRoot);

    // Run independent analyses in parallel
    const [framework, allComponents, clientBoundaries, breakpoints] = await Promise.all([
      this.components.detectFramework(root),
      this.components.findComponents(root),
      this.components.findClientBoundaries(root),
      this.layout.detectBreakpoints(root),
    ]);

    // Build component tree if entry path provided
    let componentTree: ComponentTree | undefined;
    if (params.entryPath) {
      try {
        componentTree = await this.components.buildTree(params.entryPath);
      } catch {
        // optional — continue without tree
      }
    }

    // Determine files for a11y and layout checks
    const filesToCheck = params.files ?? allComponents.map((c) => c.path);

    // Run a11y and layout in parallel
    const [a11yReport, layoutResults] = await Promise.all([
      this.a11y.check(filesToCheck),
      this._analyzeLayoutForFiles(filesToCheck),
    ]);

    return {
      framework,
      componentTree,
      components: allComponents,
      clientBoundaries,
      a11y: a11yReport,
      breakpoints,
      layoutIssues: layoutResults.issues,
      tailwindConflicts: layoutResults.conflicts,
    };
  }

  /**
   * Check accessibility for a specific set of files.
   */
  async checkAccessibility(files: string[]): Promise<A11yReport> {
    return this.a11y.check(files);
  }

  /**
   * Detect the framework for a project root.
   */
  async detectFramework(
    projectRoot: string
  ): Promise<'react' | 'vue' | 'svelte' | 'astro' | 'unknown'> {
    return this.components.detectFramework(projectRoot);
  }

  /**
   * Find client boundaries in a project.
   */
  async findClientBoundaries(projectRoot: string): Promise<string[]> {
    return this.components.findClientBoundaries(projectRoot);
  }

  /**
   * Get breakpoints for a project.
   */
  async detectBreakpoints(projectRoot: string): Promise<BreakpointConfig[]> {
    return this.layout.detectBreakpoints(projectRoot);
  }

  /**
   * Get all component definitions for a project.
   */
  async findComponents(projectRoot: string): Promise<ComponentNode[]> {
    return this.components.findComponents(projectRoot);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async _analyzeLayoutForFiles(
    files: string[]
  ): Promise<{ issues: string[]; conflicts: string[] }> {
    const allIssues: string[] = [];
    const allConflicts: string[] = [];

    // Process in parallel batches of 10 to avoid overwhelming the FS
    const BATCH_SIZE = 10;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const [analysis, conflicts] = await Promise.all([
            this.layout.analyzeFile(file),
            this.layout.analyzeTailwindConflicts(file),
          ]);
          return { issues: analysis.issues, conflicts };
        })
      );
      for (const r of results) {
        allIssues.push(...r.issues);
        allConflicts.push(...r.conflicts);
      }
    }

    return { issues: allIssues, conflicts: allConflicts };
  }
}
