/**
 * @module plugins/skills
 * @layer L3 — plugin
 *
 * Skills plugin entry point.
 * Registers the SkillRegistry into the L1 Registry for
 * skill search, retrieval, and recommendation.
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { Registry } from '../../core/registry.js';
import { SkillRegistry } from './registry.js';

export { SkillRegistry } from './registry.js';
export type {
  SkillDefinition,
  SkillTier,
  SkillSearchParams,
  SkillSearchResult,
  SkillSummary,
  RecommendationContext,
  SkillRecommendation,
} from './types.js';

export const SkillsPlugin: PluginRegistration = {
  manifest: {
    name: 'skills',
    version: '0.1.0',
    description: 'Skill definitions, search, and recommendations',
    layer: 'L3',
    dependencies: [],
    capabilities: ['skills', 'recommendations'],
  },
  register: (registry: unknown) => {
    (registry as Registry).register('skill-registry', new SkillRegistry());
  },
  shutdown: async () => {},
};
