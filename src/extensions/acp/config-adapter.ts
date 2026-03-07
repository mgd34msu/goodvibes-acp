/**
 * @module acp/config-adapter
 * @layer L2 — ACP session configuration options builder
 *
 * Builds ACP SessionConfigOption arrays for use in NewSession/LoadSession
 * responses and SetSessionConfigOption responses.
 */

import type * as schema from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// GoodVibes mode type
// ---------------------------------------------------------------------------

/** GoodVibes operating modes surfaced as an ACP config option */
export type GoodVibesMode = 'justvibes' | 'vibecoding' | 'sandbox';

// ---------------------------------------------------------------------------
// Config option IDs
// ---------------------------------------------------------------------------

const CONFIG_ID_MODE = 'goodvibes.mode' as const;
const CONFIG_ID_MODEL = 'goodvibes.model' as const;

// ---------------------------------------------------------------------------
// buildConfigOptions
// ---------------------------------------------------------------------------

/**
 * Build the full set of ACP config options for a session.
 *
 * Returns a mode selector and a model selector pre-populated with
 * the current values.
 *
 * @param currentMode  - Current GoodVibes mode (defaults to 'justvibes')
 * @param currentModel - Current model identifier (defaults to claude-sonnet-4-6)
 */
export function buildConfigOptions(
  currentMode: GoodVibesMode = 'justvibes',
  currentModel: string = 'claude-sonnet-4-6',
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
    ] satisfies schema.SessionConfigSelectOption[],
  };

  const modelOption: schema.SessionConfigOption = {
    type: 'select',
    id: CONFIG_ID_MODEL,
    name: 'Model',
    category: 'model',
    description: 'Claude model to use for this session.',
    currentValue: currentModel,
    options: [
      {
        value: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        description: 'Most capable model for complex tasks.',
      },
      {
        value: 'claude-sonnet-4-5-20250514',
        name: 'Claude Sonnet 4.5',
        description: 'Balanced performance and speed.',
      },
      {
        value: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        description: 'Fastest model for simple tasks.',
      },
    ] satisfies schema.SessionConfigSelectOption[],
  };

  return [modeOption, modelOption];
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
      return value;
    default:
      return 'justvibes';
  }
}

// ---------------------------------------------------------------------------
// Re-exported config IDs (for agent.ts lookups)
// ---------------------------------------------------------------------------

export { CONFIG_ID_MODE, CONFIG_ID_MODEL };
