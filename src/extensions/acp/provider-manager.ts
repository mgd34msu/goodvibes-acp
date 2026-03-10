/**
 * @module acp/provider-manager
 * @layer L2 — re-export shim
 *
 * ProviderManager has moved to L3 (plugins/agents/provider-manager) because
 * it directly imports concrete L3 provider implementations. L2 must not import L3.
 *
 * This shim re-exports ProviderManager from its new L3 location so that any
 * existing imports of this path continue to resolve without breakage.
 *
 * @deprecated Import from '../../plugins/agents/provider-manager.js' directly.
 */
export { ProviderManager } from '../../plugins/agents/provider-manager.js';
export type { AvailableModel, ProviderFactory } from '../../plugins/agents/provider-manager.js';
