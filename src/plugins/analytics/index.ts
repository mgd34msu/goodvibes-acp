/**
 * @module plugins/analytics
 * @layer L3 — plugin
 *
 * Plugin registration entry point for the analytics plugin.
 * Registers AnalyticsEngine into the L1 Registry under the 'analytics' capability key.
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { Registry } from '../../core/registry.js';
import { AnalyticsEngine } from './engine.js';

export { AnalyticsEngine } from './engine.js';
export { BudgetTracker } from './budget.js';
export { AnalyticsDashboard } from './dashboard.js';
export { AnalyticsExporter } from './export.js';
export { SessionSync } from './sync.js';
export type {
  TokenBudget,
  TokenUsageEntry,
  SessionAnalytics,
  AnalyticsExportFormat,
  DashboardData,
  BudgetParams,
  QueryParams,
  ExportParams,
  SyncParams,
  DashboardParams,
  TagParams,
  ConfigParams,
  AnalyticsStore,
} from './types.js';

export const AnalyticsPlugin: PluginRegistration = {
  manifest: {
    name: 'analytics',
    version: '0.1.0',
    description: 'Session analytics, token budget tracking, and data export',
    layer: 'L3',
    dependencies: [],
    capabilities: ['analytics', 'budget'],
  },
  register: (registry: unknown) => {
    (registry as Registry).register('analytics', new AnalyticsEngine());
  },
  shutdown: async () => {
    // The engine instance is held only in the registry; graceful flush
    // is called directly via AnalyticsEngine.shutdown() from main.ts
    // if the consumer wires it up.
  },
};
