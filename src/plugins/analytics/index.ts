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

/** Module-level engine reference held for shutdown flushing */
let _engine: AnalyticsEngine | undefined;

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
    const reg = registry as Registry;
    _engine = new AnalyticsEngine();
    reg.register('analytics-engine', _engine);
  },
  shutdown: async () => {
    await _engine?.shutdown();
    _engine = undefined;
  },
};
