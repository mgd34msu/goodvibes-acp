import { describe, it, expect } from 'bun:test';
import { CommandsEmitter } from '../../src/extensions/acp/commands-emitter.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConn(): { conn: AgentSideConnection; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const conn = {
    sessionUpdate: async (params: Record<string, unknown>) => {
      calls.push(params);
    },
  } as unknown as AgentSideConnection;
  return { conn, calls };
}

// ---------------------------------------------------------------------------
// CommandsEmitter
// ---------------------------------------------------------------------------

describe('CommandsEmitter', () => {
  describe('emitCommands()', () => {
    it('calls sessionUpdate with sessionUpdate: available_commands_update discriminant', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      expect(calls).toHaveLength(1);
      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(update.sessionUpdate).toBe('available_commands_update');
    });

    it('threads the sessionId through to sessionUpdate params', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('my-session-id');

      expect((calls[0] as { sessionId: string }).sessionId).toBe('my-session-id');
    });

    it('includes an availableCommands array', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      expect(Array.isArray(update.availableCommands)).toBe(true);
    });

    it('includes the /status command', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      const status = commands.find((c) => c.id === 'status');
      expect(status).toBeDefined();
      expect(status?.description).toBe('Show runtime status and health');
    });

    it('includes the /agents command', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      const cmd = commands.find((c) => c.id === 'agents');
      expect(cmd).toBeDefined();
      expect(cmd?.description).toBe('List active agent chains');
    });

    it('includes the /analytics command', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      const cmd = commands.find((c) => c.id === 'analytics');
      expect(cmd).toBeDefined();
    });

    it('includes the /mode command', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      const cmd = commands.find((c) => c.id === 'mode');
      expect(cmd).toBeDefined();
    });

    it('includes the /review command', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      const cmd = commands.find((c) => c.id === 'review');
      expect(cmd).toBeDefined();
    });

    it('includes the /cancel command', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      const cmd = commands.find((c) => c.id === 'cancel');
      expect(cmd).toBeDefined();
      expect(cmd?.description).toBe('Cancel current operation');
    });

    it('emits exactly 6 commands', async () => {
      const { conn, calls } = makeConn();
      const emitter = new CommandsEmitter(conn);

      await emitter.emitCommands('sess-1');

      const update = (calls[0] as { update: Record<string, unknown> }).update;
      const commands = update.availableCommands as Array<Record<string, unknown>>;
      expect(commands).toHaveLength(6);
    });

    it('swallows errors from sessionUpdate without throwing', async () => {
      const conn = {
        sessionUpdate: async () => {
          throw new Error('transport error');
        },
      } as unknown as AgentSideConnection;
      const emitter = new CommandsEmitter(conn);

      await expect(emitter.emitCommands('sess-1')).resolves.toBeUndefined();
    });
  });
});
