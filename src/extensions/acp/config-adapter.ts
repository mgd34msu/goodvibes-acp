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
      {
        value: 'plan',
        name: 'Plan',
        description: 'Plan mode for reviewing and approving actions before execution.',
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
        value: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        description: 'Latest Sonnet model with balanced performance.',
      },
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
