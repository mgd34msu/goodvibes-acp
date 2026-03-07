/**
 * @module acp/tool-call-emitter
 * @layer L2 — ACP tool call session update emitter
 *
 * Emits tool_call / tool_call_update session notifications over an
 * AgentSideConnection so ACP clients can observe WRFC phase progress.
 */

import type * as acp from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// ToolCallEmitter
// ---------------------------------------------------------------------------

/**
 * Emits tool_call and tool_call_update session updates for WRFC phases.
 *
 * Each WRFC phase (work, review, fix) is represented as an ACP tool call
 * so clients can render progress UI.
 */
export class ToolCallEmitter {
  constructor(private readonly conn: acp.AgentSideConnection) {}

  /**
   * Emit a tool_call session update to announce a new phase.
   *
   * @param sessionId   - ACP session ID
   * @param toolCallId  - Stable ID for this tool call (use crypto.randomUUID())
   * @param name        - Tool name (e.g. 'goodvibes_work')
   * @param title       - Human-readable title
   * @param status      - Initial status ('pending' | 'in_progress')
   * @param meta        - Optional _meta payload for structured data
   */
  async emitToolCall(
    sessionId: string,
    toolCallId: string,
    name: string,
    title: string,
    status: acp.ToolCallStatus,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const toolCall: acp.ToolCall = {
      toolCallId,
      title,
      status,
      ...(meta ? { _meta: meta } : {}),
    };

    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call', ...toolCall } as acp.SessionUpdate,
    });
  }

  /**
   * Emit a tool_call_update session update to mutate an existing phase.
   *
   * @param sessionId   - ACP session ID
   * @param toolCallId  - ID of the tool call to update
   * @param status      - New status
   * @param meta        - Optional _meta payload for structured data
   */
  async emitToolCallUpdate(
    sessionId: string,
    toolCallId: string,
    status: acp.ToolCallStatus,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const update: acp.ToolCallUpdate = {
      toolCallId,
      status,
      ...(meta ? { _meta: meta } : {}),
    };

    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call_update', ...update } as acp.SessionUpdate,
    });
  }
}
