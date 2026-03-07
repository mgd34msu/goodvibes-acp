/**
 * @module acp/commands-emitter
 * @layer L2 — ACP available_commands session update emitter
 *
 * Advertises GoodVibes-specific slash commands to ACP clients via the
 * available_commands_update session update.
 */

import type * as acp from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// GoodVibes command registry
// ---------------------------------------------------------------------------

/**
 * The canonical set of slash commands advertised by the GoodVibes runtime.
 * Each entry maps directly to an ACP AvailableCommand.
 */
const GOODVIBES_COMMANDS: acp.AvailableCommand[] = [
  {
    name: '/status',
    description: 'Show runtime status and health',
    _meta: { category: 'info' },
  },
  {
    name: '/agents',
    description: 'List active agent chains',
    _meta: { category: 'info' },
  },
  {
    name: '/analytics',
    description: 'Show token usage and budget',
    _meta: { category: 'info' },
  },
  {
    name: '/mode',
    description: 'Switch runtime mode (justvibes/vibecoding/plan/sandbox)',
    _meta: { category: 'config' },
  },
  {
    name: '/review',
    description: 'Trigger manual code review',
    _meta: { category: 'quality' },
  },
  {
    name: '/cancel',
    description: 'Cancel current operation',
    _meta: { category: 'control' },
  },
];

// ---------------------------------------------------------------------------
// CommandsEmitter
// ---------------------------------------------------------------------------

/**
 * Emits `available_commands_update` session updates so ACP clients know
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
    const update: acp.AvailableCommandsUpdate = {
      availableCommands: GOODVIBES_COMMANDS,
    };

    await this.conn
      .sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'available_commands_update',
          ...update,
        } as acp.SessionUpdate,
      })
      .catch(() => {});
  }
}
