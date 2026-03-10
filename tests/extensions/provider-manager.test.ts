/**
 * Tests for ProviderManager (L3 plugin).
 *
 * Tests cover:
 * - Construction with various config shapes
 * - getAvailableModels(): with config, without config, multi-provider
 * - getActiveModelId(): initial value
 * - setActiveModel(): success, failure on unknown model, registry update
 * - activateDefault(): config-driven, first-model fallback, env-var fallback, no-op warning
 * - setApiKey() / getApiKey(): storage and cache invalidation
 * - getProvider(): lazy creation, caching, unknown model, provider types
 * - Multi-provider config: correct provider per model
 * - openai-compatible: missing key, missing baseUrl
 * - Cache invalidation: setApiKey clears cached instance
 *
 * Strategy: Dependency injection via optional providerFactory constructor param.
 * No mock.module calls — avoids global module poisoning in bun:test.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Registry } from '../../src/core/registry.ts';
import { ProviderManager } from '../../src/plugins/agents/provider-manager.ts';
import type { ProviderFactory } from '../../src/plugins/agents/provider-manager.ts';
import type { RuntimeConfig } from '../../src/types/config.ts';
import type { ILLMProvider } from '../../src/types/registry.ts';

// ---------------------------------------------------------------------------
// Fake provider implementations (no network calls)
// ---------------------------------------------------------------------------

const mockAnthropicInstances: Array<FakeAnthropicProvider> = [];
const mockOpenAIInstances: Array<FakeOpenAICompatibleProvider> = [];

class FakeAnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  readonly _apiKey: string;
  constructor(apiKey?: string) {
    this._apiKey = apiKey ?? '';
    mockAnthropicInstances.push(this);
  }
  async chat() {
    return { content: [], stopReason: 'end_turn' as const, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  async *stream(): AsyncGenerator<never> { /* empty */ }
}

class FakeOpenAICompatibleProvider implements ILLMProvider {
  readonly name: string;
  readonly _opts: { apiKey: string; baseUrl: string; name?: string };
  constructor(opts: { apiKey: string; baseUrl: string; name?: string }) {
    this._opts = opts;
    this.name = opts.name ?? 'openai-compatible';
    mockOpenAIInstances.push(this);
  }
  async chat() {
    return { content: [], stopReason: 'end_turn' as const, usage: { inputTokens: 0, outputTokens: 0 } };
  }
  async *stream(): AsyncGenerator<never> { /* empty */ }
}

// ---------------------------------------------------------------------------
// Shared fake factory (injected via DI — no mock.module needed)
// ---------------------------------------------------------------------------

const fakeProviderFactory: ProviderFactory = (type, opts) => {
  if (type === 'anthropic') {
    return new FakeAnthropicProvider(opts.apiKey);
  }
  if (type === 'openai-compatible') {
    return new FakeOpenAICompatibleProvider({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl ?? '',
      name: opts.name,
    });
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRegistry(): Registry {
  return new Registry();
}

/** Minimal anthropic-only models config */
function singleAnthropicConfig(): RuntimeConfig['models'] {
  return {
    default: 'claude-sonnet-4-6',
    providers: [
      {
        type: 'anthropic',
        name: 'Anthropic',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced' },
          { id: 'claude-opus-4', name: 'Claude Opus 4', description: 'Powerful' },
        ],
      },
    ],
  };
}

/** Config with two providers: anthropic + openai-compatible */
function multiProviderConfig(): RuntimeConfig['models'] {
  return {
    default: 'claude-sonnet-4-6',
    providers: [
      {
        type: 'anthropic',
        name: 'Anthropic',
        models: [
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
        ],
      },
      {
        type: 'openai-compatible',
        name: 'Groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        models: [
          { id: 'llama3-70b', name: 'Llama 3 70B' },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe('ProviderManager — construction', () => {
  it('constructs without throwing when config has models', () => {
    expect(() => new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory)).not.toThrow();
  });

  it('constructs without throwing when config is undefined', () => {
    expect(() => new ProviderManager(undefined, makeRegistry(), fakeProviderFactory)).not.toThrow();
  });

  it('uses config.default as initial active model ID', () => {
    const pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
    expect(pm.getActiveModelId()).toBe('claude-sonnet-4-6');
  });

  it('falls back to claude-sonnet-4-6 when config.default is absent', () => {
    const cfg: RuntimeConfig['models'] = {
      providers: [
        {
          type: 'anthropic',
          name: 'Anthropic',
          models: [{ id: 'claude-haiku-3', name: 'Haiku 3' }],
        },
      ],
    };
    const pm = new ProviderManager(cfg, makeRegistry(), fakeProviderFactory);
    expect(pm.getActiveModelId()).toBe('claude-sonnet-4-6');
  });

  it('sets active model from config.default when explicitly provided', () => {
    const cfg: RuntimeConfig['models'] = {
      default: 'claude-opus-4',
      providers: [
        {
          type: 'anthropic',
          name: 'Anthropic',
          models: [{ id: 'claude-opus-4', name: 'Opus' }],
        },
      ],
    };
    const pm = new ProviderManager(cfg, makeRegistry(), fakeProviderFactory);
    expect(pm.getActiveModelId()).toBe('claude-opus-4');
  });
});

// ---------------------------------------------------------------------------
// getAvailableModels
// ---------------------------------------------------------------------------

describe('ProviderManager — getAvailableModels()', () => {
  it('returns default list when no config provided', () => {
    const pm = new ProviderManager(undefined, makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('claude-sonnet-4-6');
    expect(models[0].providerName).toBe('Anthropic');
  });

  it('returns default list when config has no providers array', () => {
    const pm = new ProviderManager({ default: 'some-model' }, makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('claude-sonnet-4-6');
  });

  it('returns default list when config.providers is empty', () => {
    const pm = new ProviderManager({ providers: [] }, makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe('claude-sonnet-4-6');
  });

  it('returns all models from a single provider', () => {
    const pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('claude-sonnet-4-6');
    expect(models[1].id).toBe('claude-opus-4');
  });

  it('includes providerName on each model', () => {
    const pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    for (const m of models) {
      expect(m.providerName).toBe('Anthropic');
    }
  });

  it('includes optional description when present', () => {
    const pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    expect(models[0].description).toBe('Balanced');
  });

  it('returns models from all providers in multi-provider config', () => {
    const pm = new ProviderManager(multiProviderConfig(), makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    expect(models).toHaveLength(2);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('claude-sonnet-4-6');
    expect(ids).toContain('llama3-70b');
  });

  it('assigns correct providerName per model in multi-provider config', () => {
    const pm = new ProviderManager(multiProviderConfig(), makeRegistry(), fakeProviderFactory);
    const models = pm.getAvailableModels();
    const anthropicModels = models.filter((m) => m.providerName === 'Anthropic');
    const groqModels = models.filter((m) => m.providerName === 'Groq');
    expect(anthropicModels).toHaveLength(1);
    expect(groqModels).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// setActiveModel
// ---------------------------------------------------------------------------

describe('ProviderManager — setActiveModel()', () => {
  let registry: Registry;
  let pm: InstanceType<typeof ProviderManager>;

  beforeEach(() => {
    registry = makeRegistry();
    pm = new ProviderManager(singleAnthropicConfig(), registry, fakeProviderFactory);
    pm.setApiKey('anthropic', 'sk-test-key');
  });

  it('returns true when model exists in config', () => {
    const result = pm.setActiveModel('claude-sonnet-4-6');
    expect(result).toBe(true);
  });

  it('returns false when model does not exist in config', () => {
    const result = pm.setActiveModel('nonexistent-model');
    expect(result).toBe(false);
  });

  it('updates the active model ID on success', () => {
    pm.setActiveModel('claude-opus-4');
    expect(pm.getActiveModelId()).toBe('claude-opus-4');
  });

  it('does not update the active model ID on failure', () => {
    pm.setActiveModel('claude-sonnet-4-6'); // set to a known good state
    pm.setActiveModel('nonexistent-model');
    expect(pm.getActiveModelId()).toBe('claude-sonnet-4-6');
  });

  it('registers llm-provider in the registry on success', () => {
    pm.setActiveModel('claude-sonnet-4-6');
    const provider = registry.getOptional<{ name: string }>('llm-provider');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('anthropic');
  });

  it('replaces the previously registered llm-provider when switching models', () => {
    pm.setActiveModel('claude-sonnet-4-6');
    pm.setActiveModel('claude-opus-4');
    // Should still be registered (not blown up)
    const provider = registry.getOptional<{ name: string }>('llm-provider');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('anthropic');
  });

  it('returns false when no API key is available and no env var is set', () => {
    // Use a fresh PM with no keys and no env var for anthropic provider
    const savedEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const freshPm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
      const result = freshPm.setActiveModel('claude-sonnet-4-6');
      // Without a key the provider returns null → setActiveModel returns false
      expect(result).toBe(false);
    } finally {
      if (savedEnv !== undefined) process.env.ANTHROPIC_API_KEY = savedEnv;
    }
  });
});

// ---------------------------------------------------------------------------
// activateDefault
// ---------------------------------------------------------------------------

describe('ProviderManager — activateDefault()', () => {
  it('activates the configured default model', () => {
    const registry = makeRegistry();
    const pm = new ProviderManager(singleAnthropicConfig(), registry, fakeProviderFactory);
    pm.setApiKey('anthropic', 'sk-test-key');
    pm.activateDefault();
    const provider = registry.getOptional<{ name: string }>('llm-provider');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('anthropic');
  });

  it('falls back to first model when default model is not in any provider', () => {
    const cfg: RuntimeConfig['models'] = {
      default: 'nonexistent-default',
      providers: [
        {
          type: 'anthropic',
          name: 'Anthropic',
          models: [{ id: 'claude-haiku-3', name: 'Haiku 3' }],
        },
      ],
    };
    const registry = makeRegistry();
    const pm = new ProviderManager(cfg, registry, fakeProviderFactory);
    pm.setApiKey('anthropic', 'sk-test-key');
    pm.activateDefault();
    // Fallback to first model claude-haiku-3 → registers provider
    const provider = registry.getOptional<{ name: string }>('llm-provider');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('anthropic');
    // Active model ID should be updated to the first model
    expect(pm.getActiveModelId()).toBe('claude-haiku-3');
  });

  it('uses ANTHROPIC_API_KEY env var fallback when no config', () => {
    const savedEnv = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-env-key';
    try {
      const registry = makeRegistry();
      const pm = new ProviderManager(undefined, registry, fakeProviderFactory);
      pm.activateDefault();
      const provider = registry.getOptional<{ name: string }>('llm-provider');
      expect(provider).toBeDefined();
      expect(provider!.name).toBe('anthropic');
    } finally {
      if (savedEnv !== undefined) {
        process.env.ANTHROPIC_API_KEY = savedEnv;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it('does not register a provider when no config and no env var', () => {
    const savedEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const registry = makeRegistry();
      const pm = new ProviderManager(undefined, registry, fakeProviderFactory);
      pm.activateDefault();
      const provider = registry.getOptional<{ name: string }>('llm-provider');
      expect(provider).toBeUndefined();
    } finally {
      if (savedEnv !== undefined) process.env.ANTHROPIC_API_KEY = savedEnv;
    }
  });
});

// ---------------------------------------------------------------------------
// setApiKey / getApiKey
// ---------------------------------------------------------------------------

describe('ProviderManager — setApiKey() / getApiKey()', () => {
  let pm: InstanceType<typeof ProviderManager>;

  beforeEach(() => {
    pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
  });

  it('stores and retrieves an API key', () => {
    pm.setApiKey('Anthropic', 'sk-test-key');
    expect(pm.getApiKey('Anthropic')).toBe('sk-test-key');
  });

  it('is case-insensitive on provider name', () => {
    pm.setApiKey('ANTHROPIC', 'sk-upper-key');
    expect(pm.getApiKey('anthropic')).toBe('sk-upper-key');
    expect(pm.getApiKey('Anthropic')).toBe('sk-upper-key');
  });

  it('returns undefined when no key has been set', () => {
    expect(pm.getApiKey('anthropic')).toBeUndefined();
  });

  it('overwrites an existing key', () => {
    pm.setApiKey('anthropic', 'sk-old-key');
    pm.setApiKey('anthropic', 'sk-new-key');
    expect(pm.getApiKey('anthropic')).toBe('sk-new-key');
  });

  it('invalidates the cached provider instance when a new key is set', () => {
    const registry = makeRegistry();
    const freshPm = new ProviderManager(singleAnthropicConfig(), registry, fakeProviderFactory);
    freshPm.setApiKey('anthropic', 'sk-first-key');
    // Warm the cache
    const p1 = freshPm.getProvider('claude-sonnet-4-6');
    expect(p1).toBeDefined();
    // Invalidate by setting a new key
    freshPm.setApiKey('anthropic', 'sk-second-key');
    // A new instance should be created on next access
    const p2 = freshPm.getProvider('claude-sonnet-4-6');
    expect(p2).toBeDefined();
    // The two instances should be different objects (cache was cleared)
    expect(p1).not.toBe(p2);
  });
});

// ---------------------------------------------------------------------------
// getProvider
// ---------------------------------------------------------------------------

describe('ProviderManager — getProvider()', () => {
  let registry: Registry;
  let pm: InstanceType<typeof ProviderManager>;

  beforeEach(() => {
    registry = makeRegistry();
    pm = new ProviderManager(singleAnthropicConfig(), registry, fakeProviderFactory);
    pm.setApiKey('anthropic', 'sk-test-key');
  });

  it('returns undefined for an unknown model ID', () => {
    expect(pm.getProvider('nonexistent-model')).toBeUndefined();
  });

  it('returns a provider instance for a known anthropic model', () => {
    const provider = pm.getProvider('claude-sonnet-4-6');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('anthropic');
  });

  it('lazily creates the provider on first call', () => {
    const countBefore = mockAnthropicInstances.length;
    pm.getProvider('claude-sonnet-4-6');
    expect(mockAnthropicInstances.length).toBeGreaterThan(countBefore);
  });

  it('returns null (no provider) when no API key is available', () => {
    const savedEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const freshPm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
      // No setApiKey call — no env var
      const provider = freshPm.getProvider('claude-sonnet-4-6');
      expect(provider).toBeUndefined();
    } finally {
      if (savedEnv !== undefined) process.env.ANTHROPIC_API_KEY = savedEnv;
    }
  });

  it('caches provider instances (same object on second call)', () => {
    const p1 = pm.getProvider('claude-sonnet-4-6');
    const p2 = pm.getProvider('claude-sonnet-4-6');
    expect(p1).toBe(p2);
  });

  it('returns provider for different models within same provider', () => {
    const p1 = pm.getProvider('claude-sonnet-4-6');
    const p2 = pm.getProvider('claude-opus-4');
    // Both use same provider name, so same cached instance
    expect(p1).toBe(p2);
    expect(p1!.name).toBe('anthropic');
  });
});

// ---------------------------------------------------------------------------
// Multi-provider: correct provider per model
// ---------------------------------------------------------------------------

describe('ProviderManager — multi-provider config', () => {
  let pm: InstanceType<typeof ProviderManager>;

  beforeEach(() => {
    pm = new ProviderManager(multiProviderConfig(), makeRegistry(), fakeProviderFactory);
    pm.setApiKey('anthropic', 'sk-anthropic-key');
    pm.setApiKey('groq', 'sk-groq-key');
  });

  it('returns anthropic provider for claude model', () => {
    const provider = pm.getProvider('claude-sonnet-4-6');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('anthropic');
  });

  it('returns openai-compatible provider for groq model', () => {
    const provider = pm.getProvider('llama3-70b');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('Groq');
  });

  it('creates distinct instances for different provider types', () => {
    const p1 = pm.getProvider('claude-sonnet-4-6');
    const p2 = pm.getProvider('llama3-70b');
    expect(p1).not.toBe(p2);
  });

  it('returns undefined for a model not in any provider', () => {
    expect(pm.getProvider('unknown-model')).toBeUndefined();
  });

  it('setActiveModel works for openai-compatible model', () => {
    const registry = makeRegistry();
    const freshPm = new ProviderManager(multiProviderConfig(), registry, fakeProviderFactory);
    freshPm.setApiKey('groq', 'sk-groq-key');
    const result = freshPm.setActiveModel('llama3-70b');
    expect(result).toBe(true);
    const provider = registry.getOptional<{ name: string }>('llm-provider');
    expect(provider).toBeDefined();
    expect(provider!.name).toBe('Groq');
  });
});

// ---------------------------------------------------------------------------
// openai-compatible edge cases
// ---------------------------------------------------------------------------

describe('ProviderManager — openai-compatible edge cases', () => {
  it('returns undefined when no API key set for openai-compatible provider', () => {
    const pm = new ProviderManager(multiProviderConfig(), makeRegistry(), fakeProviderFactory);
    // Not calling setApiKey for 'groq'
    const provider = pm.getProvider('llama3-70b');
    expect(provider).toBeUndefined();
  });

  it('returns undefined when openai-compatible provider has no baseUrl', () => {
    const cfg: RuntimeConfig['models'] = {
      providers: [
        {
          type: 'openai-compatible',
          name: 'NoBaseUrl',
          // baseUrl intentionally omitted
          models: [{ id: 'some-model', name: 'Some Model' }],
        },
      ],
    };
    const pm = new ProviderManager(cfg, makeRegistry(), fakeProviderFactory);
    pm.setApiKey('nobaseurl', 'sk-key');
    const provider = pm.getProvider('some-model');
    expect(provider).toBeUndefined();
  });

  it('returns undefined for unknown provider type', () => {
    const cfg = {
      providers: [
        {
          type: 'unknown-type' as 'anthropic',
          name: 'Unknown',
          models: [{ id: 'unknown-model', name: 'Unknown Model' }],
        },
      ],
    } as RuntimeConfig['models'];
    const pm = new ProviderManager(cfg, makeRegistry(), fakeProviderFactory);
    pm.setApiKey('unknown', 'sk-key');
    const provider = pm.getProvider('unknown-model');
    expect(provider).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// API key env var fallback
// ---------------------------------------------------------------------------

describe('ProviderManager — ANTHROPIC_API_KEY env var fallback', () => {
  it('uses env var when no key set via setApiKey for anthropic provider', () => {
    const savedEnv = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-from-env';
    try {
      const pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
      // Do NOT call setApiKey — let it fall through to env var
      const provider = pm.getProvider('claude-sonnet-4-6');
      expect(provider).toBeDefined();
      expect(provider!.name).toBe('anthropic');
    } finally {
      if (savedEnv !== undefined) {
        process.env.ANTHROPIC_API_KEY = savedEnv;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it('explicit setApiKey takes priority over env var', () => {
    const savedEnv = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-from-env';
    try {
      const pm = new ProviderManager(singleAnthropicConfig(), makeRegistry(), fakeProviderFactory);
      pm.setApiKey('anthropic', 'sk-explicit-key');
      const provider = pm.getProvider('claude-sonnet-4-6') as FakeAnthropicProvider | undefined;
      expect(provider).toBeDefined();
      // The fake stores the apiKey — verify explicit key was used
      expect(provider!._apiKey).toBe('sk-explicit-key');
    } finally {
      if (savedEnv !== undefined) {
        process.env.ANTHROPIC_API_KEY = savedEnv;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });
});
