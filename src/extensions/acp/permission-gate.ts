/**
 * @module acp/permission-gate
 * @layer L2 — ACP permission gate
 *
 * Provides policy-driven permission checking before tool execution.
 * Applies auto-approve / always-deny rules, then falls back to asking
 * the ACP client via session/request_permission.
 *
 * The real ACP SDK uses a structured `options`-based permission request
 * rather than a simple granted/denied boolean. This module maps between
 * the application-level PermissionRequest/PermissionResult model and the
 * ACP SDK's RequestPermissionRequest/RequestPermissionResponse wire format.
 */

import { randomUUID } from 'crypto';
import type * as acp from '@agentclientprotocol/sdk';
import type { PermissionRequest, PermissionResult, PermissionPolicy, PermissionType } from '../../types/permissions.js';

// ---------------------------------------------------------------------------
// Mode-based default policies
// ---------------------------------------------------------------------------

/**
 * Default permission policies per GoodVibes mode.
 *
 * - **justvibes**: Auto-approve everything — maximum autonomy, no prompts.
 * - **vibecoding**: Auto-approve most actions; prompt for network access.
 * - **plan**: Only auto-approve reads; deny command execution; prompt for others.
 * - **sandbox**: Auto-approve reads and tool calls; deny network; prompt for others.
 *
 * ACP conceptual mode equivalents (ISS-111):
 * - `justvibes`  → yolo/auto mode (no permission gates; all actions auto-approved)
 * - `vibecoding` → code mode (auto-approve low-risk actions; prompt for unknown)
 * - `plan`       → ask mode (prompt for most actions; only reads pass silently)
 * - `sandbox`    → custom restricted mode (fs/mcp auto-approved; extensions always denied)
 */
// ISS-068: Use spec-defined permission types (file_write, file_delete, network, browser)
// instead of the non-spec 'fs' category. 'mcp' and 'extension' are GoodVibes extensions
// allowed by the spec's open-ended permission type string.
export const MODE_POLICIES: Record<string, PermissionPolicy> = {
  justvibes: {
    autoApprove: ['file_write', 'file_delete', 'network', 'browser', 'shell', 'mcp', 'extension'],
    alwaysDeny: [],
    promptForUnknown: false,
  },
  vibecoding: {
    autoApprove: ['file_write', 'file_delete', 'shell', 'mcp'],
    alwaysDeny: [],
    promptForUnknown: true,
  },
  plan: {
    // ISS-098: Ask mode requires prompting for every gated action (KB-05).
    // file_write was previously auto-approved here, but that violates ACP ask-mode semantics
    // which require every gated action to prompt the user. Removed from autoApprove.
    autoApprove: [],
    alwaysDeny: ['shell', 'file_delete'],
    promptForUnknown: true,
  },
  sandbox: {
    autoApprove: ['mcp', 'file_write'],
    alwaysDeny: ['extension', 'network', 'browser'],
    promptForUnknown: true,
  },
};

// ---------------------------------------------------------------------------
// Option IDs used in ACP permission requests
// ---------------------------------------------------------------------------

const OPTION_ALLOW_ONCE = 'allow_once';
const OPTION_REJECT_ONCE = 'reject_once';

/**
 * Build the standard allow/reject permission option set for an ACP request.
 *
 * SDK divergence note (ISS-014): The ACP wire spec uses simple `{ granted: boolean }`
 * responses, but the SDK (v0.15.0) requires an options-based model with
 * `PermissionOption[]` and outcome-based responses. These helper functions bridge
 * that gap. If the SDK aligns with the wire spec in a future version, these
 * functions can be removed in favor of a direct `response.granted` boolean check.
 */
function buildPermissionOptions(): acp.PermissionOption[] {
  return [
    { optionId: OPTION_ALLOW_ONCE, kind: 'allow_once', name: 'Allow' },
    { optionId: OPTION_REJECT_ONCE, kind: 'reject_once', name: 'Deny' },
  ];
}

/**
 * Interpret an ACP permission response as a simple granted flag.
 *
 * ISS-003/ISS-103 — Version-aware response parser:
 * The ACP wire spec defines the response as `{ granted: boolean }` (KB-05 lines 43-65).
 * The SDK (v0.15.0) instead returns `{ outcome: { outcome, optionId } }`.
 * This function checks for the spec path first so it works when the SDK aligns.
 *
 * Granted when (SDK path):
 * - outcome is 'selected' AND the selected optionId has kind allow_once or allow_always
 *
 * Denied when (SDK path):
 * - outcome is 'cancelled'
 * - outcome is 'selected' AND the selected optionId has kind reject_once or reject_always
 */
function isGranted(response: unknown): boolean {
  // Spec path: { granted: boolean } — check this first for forward compatibility
  if (response !== null && typeof response === 'object' && 'granted' in response) {
    return Boolean((response as { granted: unknown }).granted);
  }
  // SDK fallback path: { outcome: { outcome, optionId } }
  const outcome = (response as acp.RequestPermissionOutcome | undefined);
  if (!outcome) return false;
  if (outcome.outcome === 'cancelled') {
    return false;
  }
  // outcome === 'selected' — check which option was picked
  return outcome.optionId === OPTION_ALLOW_ONCE || outcome.optionId.startsWith('allow');
}

/**
 * Build the SDK-format permission request payload.
 *
 * ISS-002/ISS-097/ISS-102 — Abstraction layer for spec/SDK divergence:
 * The ACP wire spec defines `session/request_permission` as:
 *   `{ sessionId, permission: { type, title, description } }`
 * The SDK (v0.15.0) uses:
 *   `{ sessionId, options: PermissionOption[], toolCall: { toolCallId, title, description, ... } }`
 *
 * This function centralises the SDK format construction. When the SDK aligns with the wire
 * spec, replace the return value with:
 *   `{ sessionId, permission: { type: request.type, title: request.title, description: request.description } }`
 *
 * @spec-divergence ISS-013/ISS-017 — SDK v0.15.0 uses options-based model, not spec wire format.
 */
function buildPermissionRequest(
  sessionId: string,
  request: PermissionRequest,
  toolCallId: string,
): Parameters<acp.AgentSideConnection['requestPermission']>[0] {
  return {
    sessionId,
    options: buildPermissionOptions(),
    toolCall: {
      toolCallId,
      title: request.title,
      status: 'pending',
      rawInput: request._meta?.rawInput ?? null,
      ...(request._meta ? { _meta: request._meta } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// PermissionGate
// ---------------------------------------------------------------------------

/**
 * Gates actions behind policy checks and ACP client permission requests.
 *
 * Resolution order:
 * 1. Auto-approve list → granted immediately (no round-trip to client)
 * 2. Always-deny list  → denied immediately (no round-trip to client)
 * 3. promptForUnknown=false → granted (silent pass-through)
 * 4. Prompt client via conn.requestPermission()
 *
 * If the client request throws (e.g., session cancelled), the action is denied.
 *
 * @integration ISS-018 — Wired into the agent tool-execution lifecycle via
 * HookRegistrar (hooks/registrar.ts). Pass a PermissionGate instance to the
 * HookRegistrar constructor to activate permission checks before each tool
 * invocation. Without a wired instance, the hook logs a warning and passes through.
 */
export class PermissionGate {
  constructor(
    private readonly conn: acp.AgentSideConnection,
    private readonly sessionId: string,
    private readonly policy: PermissionPolicy,
  ) {}

  /**
   * Check whether an action is permitted.
   *
   * @param request - Description of the action to gate.
   * @returns Resolved PermissionResult (never throws).
   */
  async check(request: PermissionRequest): Promise<PermissionResult> {
    const { type } = request;

    // 1. Auto-approve
    if (this.policy.autoApprove.includes(type)) {
      return { granted: true };
    }

    // 2. Always-deny
    if (this.policy.alwaysDeny.includes(type)) {
      return { granted: false, reason: 'Policy: always denied' };
    }

    // 3. Silent pass-through for unknown types when prompting is disabled
    if (!this.policy.promptForUnknown) {
      return { granted: true };
    }

    // 4. Prompt the ACP client using the SDK's structured permission request
    // SDK/Spec divergence (ISS-013): The ACP wire spec defines requestPermission as
    // { sessionId, permission: { type, title, description } } → { granted: boolean }.
    // The SDK (v0.15.0) instead uses { sessionId, options: PermissionOption[], toolCall }
    // → { outcome: { outcome, optionId } }. We follow the SDK API since it's the actual
    // TypeScript interface we compile against. When the SDK aligns with the wire spec,
    // this code should be simplified to use the boolean response directly.
    try {
      // ISS-017: toolCallId must match the preceding tool_call update for client UI correlation.
      // If absent, fall back to a random UUID but emit a warning so this is visible during development.
      let toolCallId = request.toolCallId;
      if (toolCallId === undefined) {
        toolCallId = randomUUID();
        console.warn(
          '[permission-gate] ISS-017: toolCallId missing on PermissionRequest — generated random UUID %s. ' +
          'This breaks ACP client UI correlation between tool calls and their permission gates.',
          toolCallId,
        );
      }
      // ISS-002/ISS-102: ACP wire spec expects permission: { type, title, description }.
      // SDK v0.15.0 uses options: PermissionOption[], toolCall instead (documented divergence).
      // buildPermissionRequest() below encapsulates the SDK format; when the SDK aligns with
      // the wire spec it can be replaced with: permission: { type, title, description }.
      const sdkRequest = buildPermissionRequest(this.sessionId, request, toolCallId);
      const response = await this.conn.requestPermission(sdkRequest);
      // ISS-003/ISS-103: spec response is { granted: boolean }; SDK returns { outcome: {...} }.
      // isGranted() checks both shapes for forward compatibility.
      const granted = isGranted(response);
      return {
        granted,
        ...(granted ? {} : { reason: 'Permission denied by user' }),
      };
    } catch (err) {
      // ISS-069: Simplified cancellation check — err.name === 'AbortError' covers both
      // browser DOMException and Node.js AbortError without redundant instanceof checks.
      const isCancelled = err instanceof Error && err.name === 'AbortError';
      return {
        granted: false,
        reason: isCancelled ? 'cancelled' : 'Permission request failed',
      };
    }
  }
}

// Re-export policy type and permission types for convenience
export type { PermissionRequest, PermissionResult, PermissionPolicy, PermissionType };
