/**
 * @module plugins/frontend/types
 * @layer L3 — plugin
 *
 * Domain types for the frontend analysis plugin.
 * Component trees, accessibility reports, layout analysis.
 */

// ---------------------------------------------------------------------------
// Component analysis types
// ---------------------------------------------------------------------------

/** A single prop on a component */
export type PropInfo = {
  /** Prop name */
  name: string;
  /** TypeScript type as a string (e.g., 'string', 'number | undefined') */
  type: string;
  /** Whether the prop is required */
  required: boolean;
  /** Default value expression, if any */
  defaultValue?: string;
};

/** A node in the component tree */
export type ComponentNode = {
  /** Component display name */
  name: string;
  /** Absolute file path */
  path: string;
  /** Line number of the component definition */
  line: number;
  /** Prop definitions */
  props: PropInfo[];
  /** Child components referenced in this component's JSX */
  children: ComponentNode[];
  /** Whether this component has a 'use client' directive */
  isClientComponent?: boolean;
  /** Detected framework */
  framework?: 'react' | 'vue' | 'svelte' | 'astro' | 'unknown';
};

/** Full component tree for a project entry point */
export type ComponentTree = {
  /** Root component node */
  root: ComponentNode;
  /** Total number of components in the tree */
  totalComponents: number;
  /** Maximum depth of the tree */
  maxDepth: number;
};

// ---------------------------------------------------------------------------
// Accessibility types
// ---------------------------------------------------------------------------

/** Severity level of an accessibility issue */
export type A11ySeverity = 'error' | 'warning' | 'info';

/** A single accessibility issue found in source */
export type A11yIssue = {
  /** Issue severity */
  severity: A11ySeverity;
  /** Rule identifier (e.g., 'img-alt', 'interactive-aria-label') */
  rule: string;
  /** Element or selector where the issue was found */
  element: string;
  /** Human-readable description */
  message: string;
  /** Source line number, if available */
  line?: number;
  /** Suggested fix */
  suggestion?: string;
};

/** Breakdown of issues by rule */
export type A11yRuleBreakdown = {
  /** Rule identifier */
  rule: string;
  /** Number of violations */
  count: number;
  /** Severity of the rule */
  severity: A11ySeverity;
};

/** Full accessibility report for a set of files */
export type A11yReport = {
  /** All issues found */
  issues: A11yIssue[];
  /** Computed 0–100 score (higher is better) */
  score: number;
  /** Number of rules that passed */
  passCount: number;
  /** Number of rules that failed */
  failCount: number;
  /** Per-rule breakdown */
  ruleBreakdown: A11yRuleBreakdown[];
};

// ---------------------------------------------------------------------------
// Layout analysis types
// ---------------------------------------------------------------------------

/** A node in the layout tree */
export type LayoutNode = {
  /** Element tag or component name */
  element: string;
  /** CSS display value (e.g., 'flex', 'grid', 'block') */
  display: string;
  /** CSS position value */
  position: string;
  /** Detected dimensions (if inferrable from classes) */
  dimensions?: {
    width?: string;
    height?: string;
  };
  /** Child layout nodes */
  children: LayoutNode[];
};

/** Full layout analysis for a file */
export type LayoutAnalysis = {
  /** Root layout node */
  tree: LayoutNode;
  /** Layout-related issues found */
  issues: string[];
  /** Number of stacking contexts (z-index usages) */
  stackingContexts: number;
};

/** A responsive breakpoint configuration */
export type BreakpointConfig = {
  /** Breakpoint name (e.g., 'sm', 'md', 'lg') */
  name: string;
  /** Minimum width in pixels */
  minWidth: number;
  /** Maximum width in pixels, if defined */
  maxWidth?: number;
};

// ---------------------------------------------------------------------------
// Operation parameter types
// ---------------------------------------------------------------------------

/** Params for buildTree */
export type BuildTreeParams = {
  entryPath: string;
};

/** Params for findComponents */
export type FindComponentsParams = {
  projectRoot: string;
};

/** Params for analyzeProps */
export type AnalyzePropsParams = {
  componentPath: string;
};

/** Params for detectFramework */
export type DetectFrameworkParams = {
  projectRoot: string;
};

/** Params for findClientBoundaries */
export type FindClientBoundariesParams = {
  projectRoot: string;
};

/** Params for accessibility check */
export type A11yCheckParams = {
  files: string[];
};

/** Params for layout file analysis */
export type LayoutAnalyzeParams = {
  filePath: string;
};

/** Params for breakpoint detection */
export type DetectBreakpointsParams = {
  projectRoot: string;
};

/** Params for full frontend analysis */
export type FrontendAnalysisParams = {
  projectRoot: string;
  entryPath?: string;
  files?: string[];
};

/** Full frontend analysis result */
export type FrontendAnalysisResult = {
  framework: 'react' | 'vue' | 'svelte' | 'astro' | 'unknown';
  componentTree?: ComponentTree;
  components: ComponentNode[];
  clientBoundaries: string[];
  a11y: A11yReport;
  breakpoints: BreakpointConfig[];
  layoutIssues: string[];
  tailwindConflicts: string[];
};
