/**
 * @module acp/config-adapter
 * @layer L2 — ACP session configuration options builder
 *
 * Builds ACP SessionConfigOption arrays for use in NewSession/LoadSession
 * responses and SetSessionConfigOption responses.
 */

import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// GoodVibes mode type
// ---------------------------------------------------------------------------

/**
 * GoodVibes operating modes surfaced as an ACP config option.
 *
 * - `justvibes`  — standard mode with full guardrails (default)
 * - `vibecoding` — relaxed mode optimized for rapid prototyping
 * - `sandbox`    — isolated, unrestricted experimentation mode
 * - `plan`       — plan-and-approve mode; agent proposes actions before
 *                  executing them, giving the user explicit control over
 *                  each step. ISS-147: this mode is an implementation
 *                  extension beyond the three modes referenced in KB-10.
 */
export type GoodVibesMode = 'justvibes' | 'vibecoding' | 'sandbox' | 'plan';

// ---------------------------------------------------------------------------
// Config option IDs
// ---------------------------------------------------------------------------

const CONFIG_ID_MODE = 'goodvibes.mode' as const;
const CONFIG_ID_MODEL = 'goodvibes.model' as const;

/**
 * Default model ID used when no ProviderManager config is available.
 * Single source of truth for the fallback model string.
 */
export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';

// ---------------------------------------------------------------------------
// buildConfigOptions
// ---------------------------------------------------------------------------

/** A model entry for config option generation */
export interface AvailableModelEntry {
  id: string;
  name: string;
  description?: string;
  providerName?: string;
}

/**
 * Minimal fallback model list used only when ProviderManager is not available.
 * The real model list comes from ProviderManager at runtime; this is a
 * last-resort defensive fallback for static/test contexts only.
 */
const DEFAULT_MODELS: AvailableModelEntry[] = [
  { id: DEFAULT_MODEL_ID, name: 'Claude Sonnet 4.6', description: 'Latest Sonnet — balanced performance', providerName: 'Anthropic' },
];

/**
 * Build the full set of ACP config options for a session.
 *
 * Returns a mode selector and a model selector pre-populated with
 * the current values. The model selector is dynamically built from
 * `availableModels` (supplied by ProviderManager) or falls back to
 * a minimal default list.
 *
 * @param currentMode     - Current GoodVibes mode (defaults to 'justvibes')
 * @param currentModel    - Current model identifier (defaults to claude-sonnet-4-6)
 * @param availableModels - Model list from ProviderManager.getAvailableModels()
 */
export function buildConfigOptions(
  currentMode: GoodVibesMode = 'justvibes',
  currentModel: string = DEFAULT_MODEL_ID,
  availableModels?: AvailableModelEntry[],
): schema.SessionConfigOption[] {
  const modeOption: schema.SessionConfigOption = {
    type: 'select',
    id: CONFIG_ID_MODE,
    name: 'Mode',
    category: 'mode',
    description: 'Operating mode for this session. Controls guardrails, tools, and behaviors.',
    currentValue: currentMode,
    options: [
      {
        value: 'justvibes',
        name: 'Just Vibes',
        description: 'Standard mode with full guardrails.',
      },
      {
        value: 'vibecoding',
        name: 'Vibecoding',
        description: 'Relaxed mode optimized for rapid prototyping.',
      },
      {
        value: 'sandbox',
        name: 'Sandbox',
        description: 'Sandbox mode for isolated, unrestricted experimentation.',
      },
      {
        value: 'plan',
        name: 'Plan',
        description: 'Plan mode for reviewing and approving actions before execution.',
      },
    ] satisfies schema.SessionConfigSelectOption[],
  };

  // Build model options from provided list or fall back to defaults.
  const models = availableModels?.length ? availableModels : DEFAULT_MODELS;

  // Group models by provider when multiple providers are present.
  const providerNames = [...new Set(models.map((m) => m.providerName ?? 'Unknown'))];

  // Build flat options list always (SDK SessionConfigSelectGroup type varies by SDK version).
  // When multiple providers exist, model names are prefixed with provider for disambiguation.
  const modelOptions: schema.SessionConfigSelectOption[] =
    providerNames.length > 1
      ? // Multi-provider: flat list with provider-prefixed names
        models.map((m) => ({
          value: m.id,
          name: `${m.providerName ?? 'Unknown'} / ${m.name}`,
          description: m.description,
        }))
      : // Single provider: flat list
        models.map((m) => ({
          value: m.id,
          name: m.name,
          description: m.description,
        }));

  const modelOption: schema.SessionConfigOption = {
    type: 'select',
    id: CONFIG_ID_MODEL,
    name: 'Model',
    category: 'model',
    description: 'LLM model to use for this session.',
    currentValue: currentModel,
    options: modelOptions,
  };

  return [modeOption, modelOption];
}

// ---------------------------------------------------------------------------
// buildLegacyModes
// ---------------------------------------------------------------------------

/**
 * Build the legacy `SessionModeState` shape for session/new and session/load
 * responses.
 *
 * Per the ACP session-modes spec (transition period), agents SHOULD include
 * both the new `configOptions` field AND the legacy `modes` field so that
 * clients that have not yet migrated to `configOptions` continue to work.
 *
 * @param currentMode - Current GoodVibes mode (defaults to 'justvibes')
 */
export function buildLegacyModes(
  currentMode: GoodVibesMode = 'justvibes',
): schema.SessionModeState {
  return {
    currentModeId: currentMode,
    availableModes: [
      {
        id: 'justvibes',
        name: 'Just Vibes',
        description: 'Standard mode with full guardrails.',
      },
      {
        id: 'vibecoding',
        name: 'Vibecoding',
        description: 'Relaxed mode optimized for rapid prototyping.',
      },
      {
        id: 'sandbox',
        name: 'Sandbox',
        description: 'Sandbox mode for isolated, unrestricted experimentation.',
      },
      {
        id: 'plan',
        name: 'Plan',
        description: 'Plan mode for reviewing and approving actions before execution.',
      },
    ] satisfies schema.SessionMode[],
  };
}

// ---------------------------------------------------------------------------
// modeFromConfigValue
// ---------------------------------------------------------------------------

/**
 * Parse a raw ACP config value string into a typed GoodVibesMode.
 *
 * Falls back to 'justvibes' for unrecognized values.
 */
export function modeFromConfigValue(value: string): GoodVibesMode {
  switch (value) {
    case 'justvibes':
    case 'vibecoding':
    case 'sandbox':
    case 'plan':
      return value;
    default:
      return 'justvibes';
  }
}

// ---------------------------------------------------------------------------
// emitConfigUpdate
// ---------------------------------------------------------------------------

/**
 * Emit an agent-initiated config update notification to the client.
 *
 * ISS-091: KB-10 (Implementation Guide) designates this function as part
 * of the config adapter layer. Emits a `config_option_update` sessionUpdate
 * so clients observe config changes triggered by the agent (e.g. mode
 * changes applied via setSessionConfigOption).
 *
 * @param conn      - Active AgentSideConnection to emit through
 * @param sessionId - Target session ID
 * @param options   - Config options to send (use buildConfigOptions())
 */
export async function emitConfigUpdate(
  conn: AgentSideConnection,
  sessionId: string,
  options: schema.SessionConfigOption[],
): Promise<void> {
  await conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'config_option_update',
      configOptions: options,
    } as schema.SessionUpdate,
  });
}

// ---------------------------------------------------------------------------
// Re-exported config IDs (for agent.ts lookups)
// ---------------------------------------------------------------------------

export { CONFIG_ID_MODE, CONFIG_ID_MODEL };
