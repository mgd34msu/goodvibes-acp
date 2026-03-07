/**
 * @module plugins/frontend
 * @layer L3 — plugin
 *
 * Frontend analysis plugin entry point.
 * Registers FrontendAnalyzer into the L1 Registry under 'frontend-analyzer'.
 * Provides component tree analysis, accessibility checking, and layout analysis.
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { Registry } from '../../core/registry.js';
import { FrontendAnalyzer } from './analyzer.js';

export { FrontendAnalyzer } from './analyzer.js';
export { ComponentAnalyzer } from './components.js';
export { AccessibilityChecker } from './accessibility.js';
export { LayoutAnalyzer } from './layout.js';
export type {
  ComponentNode,
  ComponentTree,
  PropInfo,
  A11yIssue,
  A11yReport,
  A11yRuleBreakdown,
  A11ySeverity,
  LayoutNode,
  LayoutAnalysis,
  BreakpointConfig,
  FrontendAnalysisParams,
  FrontendAnalysisResult,
} from './types.js';

/** Frontend analysis plugin registration */
export const FrontendPlugin: PluginRegistration = {
  manifest: {
    name: 'frontend',
    version: '0.1.0',
    description: 'Frontend analysis — components, accessibility, layout',
    layer: 'L3',
    dependencies: [],
    capabilities: ['frontend-analysis'],
  },
  register: (registry: unknown) => {
    (registry as Registry).register('frontend-analyzer', new FrontendAnalyzer());
  },
  shutdown: async () => {},
};
