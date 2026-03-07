/**
 * @module plugins/agents
 * @layer L3 — plugin
 *
 * Plugin registration entry point for the agents plugin.
 * Registers AgentSpawnerPlugin into the L1 Registry under the
 * 'agent-spawner' capability key.
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { Registry } from '../../core/registry.js';
import { AgentSpawnerPlugin } from './spawner.js';

export { AgentSpawnerPlugin } from './spawner.js';
export { AGENT_TYPE_CONFIGS } from './types.js';
export type { AgentTypeConfig } from './types.js';

export const AgentsPlugin: PluginRegistration = {
  manifest: {
    name: 'agents',
    version: '0.1.0',
    description: 'Agent spawning and lifecycle management',
    layer: 'L3',
    dependencies: [],
    capabilities: ['agent-spawning'],
  },
  register: (registry: unknown) => {
    (registry as Registry).register('agent-spawner', new AgentSpawnerPlugin());
  },
  shutdown: async () => {},
};
