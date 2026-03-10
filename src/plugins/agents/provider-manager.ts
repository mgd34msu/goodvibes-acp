/**
 * @module plugins/agents/provider-manager
 * @layer L3 — plugin
 *
 * Manages LLM provider instances based on the `models` section of RuntimeConfig.
 * Providers are lazily instantiated on first use and cached per provider name.
 * API keys are stored in-memory; clients pass them via the ACP session or env vars
 * serve as a backward-compat fallback (ANTHROPIC_API_KEY).
 *
 * Moved from L2 (extensions/acp/) to L3 (plugins/agents/) because it directly
 * imports concrete L3 provider implementations (AnthropicProvider, OpenAICompatibleProvider).
 * L2 must not import L3.
 */

import type { ILLMProvider } from '../../types/registry.js';
import type { RuntimeConfig } from '../../types/config.js';
import { Registry } from '../../core/registry.js';
import { DEFAULT_MODEL_ID, DEFAULT_MODEL_ENTRY } from '../../extensions/acp/config-adapter.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAICompatibleProvider } from './providers/openai-compatible.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Provider config entry type alias for internal use */
type ProviderConfigEntry = NonNullable<NonNullable<RuntimeConfig['models']>['providers']>[number];

/** Flat model descriptor returned by getAvailableModels() */
export interface AvailableModel {
  id: string;
  name: string;
  description?: string;
  providerName: string;
}

/**
 * Optional factory for creating provider instances.
 * When provided, ProviderManager calls this instead of directly instantiating
 * AnthropicProvider / OpenAICompatibleProvider — enabling dependency injection
 * in tests without global module mocking.
 */
export type ProviderFactory = (
  type: 'anthropic' | 'openai-compatible',
  opts: { apiKey: string; baseUrl?: string; name?: string },
) => ILLMProvider | undefined;

// ---------------------------------------------------------------------------
// ProviderManager
// ---------------------------------------------------------------------------

/**
 * Manages LLM provider lifecycle for ACP sessions.
 *
 * - Reads the `models` section of RuntimeConfig to discover configured providers
 * - Creates provider instances lazily (on first `getProvider()` / `activateDefault()`)
 * - Stores API keys in-memory per provider name (keys come from client or env)
 * - Registers the active provider as `'llm-provider'` in the Registry
 */
export class ProviderManager {
  /** models config section; may be undefined if not configured */
  private readonly _config: RuntimeConfig['models'];
  private readonly _registry: Registry;

  /** In-memory API keys keyed by provider name (case-insensitive lowercase) */
  private readonly _apiKeys = new Map<string, string>();

  /** Cached provider instances keyed by provider name (lowercase) */
  private readonly _instances = new Map<string, ILLMProvider>();

  /** Currently active model ID */
  private _activeModelId: string;

  /** Optional factory for constructing provider instances (used in tests for DI) */
  private readonly _providerFactory: ProviderFactory | undefined;

  constructor(
    modelsConfig: RuntimeConfig['models'],
    registry: Registry,
    providerFactory?: ProviderFactory,
  ) {
    this._config = modelsConfig;
    this._registry = registry;
    this._activeModelId = modelsConfig?.default ?? DEFAULT_MODEL_ID;
    this._providerFactory = providerFactory;
  }

  // -------------------------------------------------------------------------
  // API key management
  // -------------------------------------------------------------------------

  /**
   * Store an API key for the named provider.
   * Key is stored in memory only — never persisted to disk.
   *
   * @param providerName - Case-insensitive provider name (e.g. 'Anthropic')
   * @param key          - API key value
   */
  setApiKey(providerName: string, key: string): void {
    this._apiKeys.set(providerName.toLowerCase(), key);
    // Invalidate any cached instance for this provider so it is re-created
    // with the new key on next use.
    this._instances.delete(providerName.toLowerCase());
  }

  /**
   * Retrieve the stored API key for a provider.
   * Returns undefined when no key has been set.
   */
  getApiKey(providerName: string): string | undefined {
    return this._apiKeys.get(providerName.toLowerCase());
  }

  // -------------------------------------------------------------------------
  // Model management
  // -------------------------------------------------------------------------

  /**
   * Return a flat list of all configured models across all providers.
   * Used by config-adapter to build the model selector config option.
   *
   * Falls back to a minimal default list when no config is present.
   */
  getAvailableModels(): AvailableModel[] {
    if (!this._config?.providers?.length) {
      return [{ ...DEFAULT_MODEL_ENTRY, providerName: DEFAULT_MODEL_ENTRY.providerName ?? 'Anthropic' }];
    }

    const result: AvailableModel[] = [];
    for (const provider of this._config.providers) {
      for (const model of provider.models) {
        result.push({
          id: model.id,
          name: model.name,
          description: model.description,
          providerName: provider.name,
        });
      }
    }
    return result;
  }

  /**
   * Get the currently active model ID.
   */
  getActiveModelId(): string {
    return this._activeModelId;
  }

  /**
   * Switch the active model and update the registry's `'llm-provider'`.
   *
   * Finds the provider config entry for the given modelId, instantiates
   * (or reuses) the provider, and re-registers it in the registry.
   *
   * @param modelId - Model ID to activate (must be a configured model)
   * @returns true when successfully switched, false when modelId is not found
   */
  setActiveModel(modelId: string): boolean {
    const providerConfig = this._findProviderForModel(modelId);
    if (!providerConfig) {
      console.error(`[ProviderManager] setActiveModel: model '${modelId}' not found in config`);
      return false;
    }

    this._activeModelId = modelId;
    const provider = this._getOrCreateProvider(providerConfig);
    if (!provider) return false;

    this._registry.unregister('llm-provider');
    this._registry.register('llm-provider', provider);
    console.error(`[ProviderManager] Active model switched to '${modelId}' via provider '${providerConfig.name}'`);
    return true;
  }

  /**
   * Get the ILLMProvider instance for a specific model ID.
   *
   * Returns the provider responsible for that model, or undefined when
   * the model is not found in any configured provider.
   */
  getProvider(modelId: string): ILLMProvider | undefined {
    const providerConfig = this._findProviderForModel(modelId);
    if (!providerConfig) return undefined;
    return this._getOrCreateProvider(providerConfig) ?? undefined;
  }

  /**
   * Activate the default model and register the corresponding provider
   * as `'llm-provider'` in the registry.
   *
   * Called once during startup. If no providers are configured, falls back
   * to ANTHROPIC_API_KEY env var (backward compat).
   */
  activateDefault(): void {
    // Fast path: config-driven activation
    if (this._config?.providers?.length) {
      const activated = this.setActiveModel(this._activeModelId);
      if (!activated) {
        // Default model not found — try the first configured model
        const first = this._config.providers[0]?.models[0];
        if (first) {
          this.setActiveModel(first.id);
        } else {
          console.error('[ProviderManager] activateDefault: no models configured');
        }
      }
      return;
    }

    // Fallback: env-var-only mode (no models config)
    if (process.env.ANTHROPIC_API_KEY) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const provider = this._providerFactory
        ? this._providerFactory('anthropic', { apiKey })
        : new AnthropicProvider(apiKey);
      if (provider) {
        this._registry.register('llm-provider', provider);
      }
      console.error('[ProviderManager] activateDefault: env-var fallback — anthropic provider registered');
    } else {
      console.error('[ProviderManager] activateDefault: WARNING — no models config and ANTHROPIC_API_KEY not set. LLM provider not registered.');
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Find the provider config entry that contains the given modelId.
   * Returns undefined when not found.
   */
  private _findProviderForModel(
    modelId: string,
  ): ProviderConfigEntry | undefined {
    if (!this._config?.providers) return undefined;
    for (const p of this._config.providers) {
      if (p.models.some((m) => m.id === modelId)) {
        return p;
      }
    }
    return undefined;
  }

  /**
   * Get or create a provider instance for the given provider config.
   * Returns null when the provider cannot be instantiated (e.g. missing API key).
   */
  private _getOrCreateProvider(
    providerConfig: ProviderConfigEntry,
  ): ILLMProvider | null {
    const key = providerConfig.name.toLowerCase();
    const cached = this._instances.get(key);
    if (cached) return cached;

    let provider: ILLMProvider | null = null;

    if (providerConfig.type === 'anthropic') {
      const apiKey =
        this._apiKeys.get(key) ??
        process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(
          `[ProviderManager] No API key for provider '${providerConfig.name}'. Set ANTHROPIC_API_KEY or call setApiKey().`,
        );
        return null;
      }
      provider = this._providerFactory
        ? (this._providerFactory('anthropic', { apiKey }) ?? null)
        : new AnthropicProvider(apiKey);
    } else if (providerConfig.type === 'openai-compatible') {
      const apiKey = this._apiKeys.get(key);
      if (!apiKey) {
        console.error(
          `[ProviderManager] No API key for provider '${providerConfig.name}'. Call setApiKey() before activation.`,
        );
        return null;
      }
      if (!providerConfig.baseUrl) {
        console.error(
          `[ProviderManager] Provider '${providerConfig.name}' has type 'openai-compatible' but no baseUrl configured.`,
        );
        return null;
      }
      provider = this._providerFactory
        ? (this._providerFactory('openai-compatible', {
            apiKey,
            baseUrl: providerConfig.baseUrl,
            name: providerConfig.name,
          }) ?? null)
        : new OpenAICompatibleProvider({
            apiKey,
            baseUrl: providerConfig.baseUrl,
            name: providerConfig.name,
          });
    } else {
      console.error(`[ProviderManager] Unknown provider type: ${(providerConfig as { type: string }).type}`);
      return null;
    }

    if (!provider) return null;
    this._instances.set(key, provider);
    return provider;
  }
}
