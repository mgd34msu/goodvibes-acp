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
 */
export const MODE_POLICIES: Record<string, PermissionPolicy> = {
  justvibes: {
    autoApprove: ['tool_call', 'file_read', 'file_write', 'command_execute', 'network_access'],
    alwaysDeny: [],
    promptForUnknown: false,
  },
  vibecoding: {
    autoApprove: ['tool_call', 'file_read', 'file_write', 'command_execute'],
    alwaysDeny: [],
    promptForUnknown: true,
  },
  plan: {
    autoApprove: ['file_read'],
    alwaysDeny: ['command_execute'],
    promptForUnknown: true,
  },
  sandbox: {
    autoApprove: ['tool_call', 'file_read'],
    alwaysDeny: ['network_access'],
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
 */
function buildPermissionOptions(): acp.PermissionOption[] {
  return [
    { optionId: OPTION_ALLOW_ONCE, kind: 'allow_once', name: 'Allow' },
    { optionId: OPTION_REJECT_ONCE, kind: 'reject_once', name: 'Deny' },
  ];
}

/**
 * Interpret an ACP RequestPermissionOutcome as a simple granted flag.
 *
 * Granted when:
 * - outcome is 'selected' AND the selected optionId has kind allow_once or allow_always
 *
 * Denied when:
 * - outcome is 'cancelled'
 * - outcome is 'selected' AND the selected optionId has kind reject_once or reject_always
 */
function isGranted(outcome: acp.RequestPermissionOutcome): boolean {
  if (outcome.outcome === 'cancelled') {
    return false;
  }
  // outcome === 'selected' — check which option was picked
  return outcome.optionId === OPTION_ALLOW_ONCE || outcome.optionId.startsWith('allow');
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
      return { status: 'granted' };
    }

    // 2. Always-deny
    if (this.policy.alwaysDeny.includes(type)) {
      return { status: 'denied', reason: 'Policy: always denied' };
    }

    // 3. Silent pass-through for unknown types when prompting is disabled
    if (!this.policy.promptForUnknown) {
      return { status: 'granted' };
    }

    // 4. Prompt the ACP client using the SDK's structured permission request
    try {
      const toolCallId = request.toolName ?? `permission-${type}`;
      const response = await this.conn.requestPermission({
        sessionId: this.sessionId,
        options: buildPermissionOptions(),
        toolCall: {
          toolCallId,
          title: request.title,
          status: 'pending',
          rawInput: request.arguments ?? null,
          ...(request._meta ? { _meta: request._meta } : {}),
        },
      });
      const granted = isGranted(response.outcome);
      return {
        status: granted ? 'granted' : 'denied',
        ...(granted ? {} : { reason: 'Permission denied by user' }),
      };
    } catch {
      return { status: 'denied', reason: 'Permission request failed' };
    }
  }
}

// Re-export policy type and permission types for convenience
export type { PermissionRequest, PermissionResult, PermissionPolicy, PermissionType };
