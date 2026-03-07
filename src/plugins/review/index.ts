/**
 * @module review
 * @layer L3 — plugin
 *
 * Review plugin entry point.
 * Registers CodeReviewer (multi-value, kind='reviewer') and CodeFixer (single)
 * into the L1 Registry at startup.
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { Registry } from '../../core/registry.js';
import { CodeReviewer } from './reviewer.js';
import { CodeFixer } from './fixer.js';

export { CodeReviewer } from './reviewer.js';
export { CodeFixer } from './fixer.js';
export { REVIEW_DIMENSIONS, computeWeightedScore } from './scoring.js';
export type { ReviewDimension, ReviewIssue, IssueSeverity } from './scoring.js';

/** Review plugin registration object */
export const ReviewPlugin: PluginRegistration = {
  manifest: {
    name: 'review',
    version: '0.1.0',
    description: 'Code review with 10-dimension scoring',
    layer: 'L3',
    dependencies: [],
    capabilities: ['review', 'fix'],
  },
  register: (registry: unknown) => {
    const reg = registry as Registry;
    reg.registerMany('reviewer', 'code-review', new CodeReviewer());
    reg.register('fixer', new CodeFixer());
  },
  shutdown: async () => {},
};
