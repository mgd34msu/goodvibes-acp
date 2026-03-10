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
 * SDK-aligned available_commands_update session update payload.
 * The installed SDK uses `availableCommands` field and `available_commands_update`
 * discriminator (AvailableCommandsUpdate type, types.gen.d.ts:2525-2526).
 */
interface AvailableCommandsUpdateSpec {
  availableCommands: AgentCommand[];
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
    _meta: { '_goodvibes/category': 'info' },
  },
  {
    id: 'agents',
    name: 'List active agents',
    description: 'List active agent chains',
    _meta: { '_goodvibes/category': 'info' },
  },
  {
    id: 'analytics',
    name: 'Show token analytics',
    description: 'Show token usage and budget',
    _meta: { '_goodvibes/category': 'info' },
  },
  {
    id: 'mode',
    name: 'Switch runtime mode',
    description: 'Switch runtime mode (justvibes/vibecoding/plan/sandbox)',
    _meta: { '_goodvibes/category': 'config' },
  },
  {
    id: 'review',
    name: 'Trigger code review',
    description: 'Trigger manual code review',
    _meta: { '_goodvibes/category': 'quality' },
  },
  {
    id: 'cancel',
    name: 'Cancel current operation',
    description: 'Cancel current operation',
    _meta: { '_goodvibes/category': 'control' },
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
    // ISS-063: Use SDK discriminator 'available_commands_update' and field
    // 'availableCommands' (AvailableCommandsUpdate, types.gen.d.ts:2525-2526).
    // The ACP spec prose uses 'available_commands' + 'commands' but the SDK
    // is authoritative for wire format.
    const update: AvailableCommandsUpdateSpec = {
      availableCommands: GOODVIBES_COMMANDS,
    };

    await this.conn
      .sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'available_commands_update',
          ...update,
        } as unknown as acp.SessionUpdate,
      })
      .catch((err) => { console.error('[CommandsEmitter] emitCommands sessionUpdate failed:', String(err)); });
  }
}
