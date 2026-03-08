/**
 * modes.ts — Session mode definitions
 *
 * L2 Extension — imports from L0 types only.
 * Defines GoodVibes operating modes with their default runtime configurations.
 */

import type { SessionMode } from '../../types/session.js';

// ---------------------------------------------------------------------------
// ModeConfig
// ---------------------------------------------------------------------------

/** Runtime configuration defaults for a GoodVibes operating mode */
export type ModeConfig = {
  /** Canonical mode name */
  name: SessionMode;
  /** Human-readable display label */
  displayName: string;
  /** Mode description surfaced in UI / config pickers */
  description: string;
  /** Maximum number of parallel agents allowed in this mode */
  maxAgents: number;
  /** Minimum acceptable review score (0–10) before accepting work */
  minReviewScore: number;
  /** Whether WRFC chains run automatically without user confirmation */
  autoChain: boolean;
  /** Whether file writes require user confirmation before applying */
  confirmWrites: boolean;
  /** Whether sandbox isolation is active for agent execution */
  sandboxed: boolean;
};

// ---------------------------------------------------------------------------
// ModeName — convenience alias
// ---------------------------------------------------------------------------

export type ModeName = SessionMode;

// ---------------------------------------------------------------------------
// MODE_DEFINITIONS
// ---------------------------------------------------------------------------

/**
 * Canonical mode definitions.
 *
 * These are the authoritative defaults — individual sessions may override
 * specific fields via setConfigOption().
 *
 * Mode ID note: GoodVibes uses its own mode IDs (`justvibes`, `vibecoding`,
 * `plan`, `sandbox`) rather than the illustrative IDs in ACP spec examples
 * (`yolo`, `code`, `architect`). This is spec-compliant — `SessionModeId` is
 * typed as `string`, so any identifier is valid. Approximate mapping:
 *   justvibes  ≈ yolo       (standard, full guardrails)
 *   vibecoding ≈ code       (rapid prototyping, reduced guardrails)
 *   plan       ≈ architect  (review-before-execute)
 *   sandbox    = custom     (isolated experimentation, no production access)
 */
export const MODE_DEFINITIONS: Readonly<Record<ModeName, ModeConfig>> = {
  justvibes: {
    name: 'justvibes',
    displayName: 'Just Vibes',
    description: 'Standard mode with full guardrails. Suitable for production work.',
    maxAgents: 3,
    minReviewScore: 9.5,
    autoChain: false,
    confirmWrites: true,
    sandboxed: false,
  },

  vibecoding: {
    name: 'vibecoding',
    displayName: 'Vibecoding',
    description: 'Relaxed mode optimized for rapid prototyping. Reduced guardrails.',
    maxAgents: 6,
    minReviewScore: 7.0,
    autoChain: true,
    confirmWrites: false,
    sandboxed: false,
  },

  sandbox: {
    name: 'sandbox',
    displayName: 'Sandbox',
    description: 'Sandbox mode for isolated, unrestricted experimentation. No production access.',
    maxAgents: 8,
    minReviewScore: 5.0,
    autoChain: true,
    confirmWrites: false,
    sandboxed: true,
  },

  plan: {
    name: 'plan',
    displayName: 'Plan',
    description: 'Plan mode for reviewing and approving actions before execution.',
    maxAgents: 1,
    minReviewScore: 9.5,
    autoChain: false,
    confirmWrites: true,
    sandboxed: false,
  },
};

// ---------------------------------------------------------------------------
// getModeConfig
// ---------------------------------------------------------------------------

/**
 * Return the ModeConfig for the given mode name.
 *
 * Falls back to 'justvibes' for unrecognized values.
 *
 * @param modeName - A SessionMode string (or any string from external input)
 * @returns The corresponding ModeConfig
 */
export function getModeConfig(modeName: string): ModeConfig {
  const known = modeName as ModeName;
  return MODE_DEFINITIONS[known] ?? MODE_DEFINITIONS['justvibes'];
}

