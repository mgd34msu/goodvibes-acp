/**
 * @module acp/commands-emitter
 * @layer L2 — ACP available_commands session update emitter
 *
 * Advertises GoodVibes-specific slash commands to ACP clients via the
 * available_commands session update.
 */

import type * as acp from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// ACP spec-aligned local types
// (SDK may lag behind the spec; casts are documented where required)
// ---------------------------------------------------------------------------

/**
 * Spec-compliant command descriptor.
 * Extends the SDK AvailableCommand with the `id` field added in a later
 * revision of the ACP spec that the installed SDK does not yet reflect.
 */
interface AgentCommand extends acp.AvailableCommand {
  /** Machine-readable identifier (no slash prefix). */
  id: string;
}

/**
 * Spec-compliant available_commands session update payload.
 * The installed SDK spells the field `availableCommands`; the spec uses
 * `commands`. The cast in emitCommands() bridges the gap.
 */
interface AvailableCommandsUpdateSpec {
  commands: AgentCommand[];
}

// ---------------------------------------------------------------------------
// GoodVibes command registry
// ---------------------------------------------------------------------------

/**
 * The canonical set of slash commands advertised by the GoodVibes runtime.
 * Each entry maps directly to an ACP AgentCommand.
 */
const GOODVIBES_COMMANDS: AgentCommand[] = [
  {
    id: 'status',
    name: 'Show runtime status',
    description: 'Show runtime status and health',
    _meta: { category: 'info' },
  },
  {
    id: 'agents',
    name: 'List active agents',
    description: 'List active agent chains',
    _meta: { category: 'info' },
  },
  {
    id: 'analytics',
    name: 'Show token analytics',
    description: 'Show token usage and budget',
    _meta: { category: 'info' },
  },
  {
    id: 'mode',
    name: 'Switch runtime mode',
    description: 'Switch runtime mode (justvibes/vibecoding/plan/sandbox)',
    _meta: { category: 'config' },
  },
  {
    id: 'review',
    name: 'Trigger code review',
    description: 'Trigger manual code review',
    _meta: { category: 'quality' },
  },
  {
    id: 'cancel',
    name: 'Cancel current operation',
    description: 'Cancel current operation',
    _meta: { category: 'control' },
  },
];

// ---------------------------------------------------------------------------
// CommandsEmitter
// ---------------------------------------------------------------------------

/**
 * Emits `available_commands` session updates so ACP clients know
 * which GoodVibes slash commands they can invoke.
 */
export class CommandsEmitter {
  constructor(private readonly conn: acp.AgentSideConnection) {}

  /**
   * Emit the full set of GoodVibes commands to the client.
   *
   * Typically called once at session start (after `newSession`), but may be
   * called again if the command set changes.
   *
   * @param sessionId - ACP session ID
   */
  async emitCommands(sessionId: string): Promise<void> {
    const update: AvailableCommandsUpdateSpec = {
      commands: GOODVIBES_COMMANDS,
    };

    await this.conn
      .sessionUpdate({
        sessionId,
        // Cast required: the installed SDK types the discriminator as
        // 'available_commands_update' and the field as `availableCommands`;
        // the ACP spec uses 'available_commands' + `commands`. Cast bridges
        // the version gap until the SDK catches up.
        update: {
          sessionUpdate: 'available_commands',
          ...update,
        } as unknown as acp.SessionUpdate,
      })
      .catch(() => {});
  }
}
