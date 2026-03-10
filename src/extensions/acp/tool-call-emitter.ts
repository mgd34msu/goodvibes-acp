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
   * The initial status is always 'pending' per ACP spec. To transition to
   * other statuses, use {@link emitToolCallUpdate}.
   *
   * @param sessionId   - ACP session ID
   * @param toolCallId  - Stable ID for this tool call (use crypto.randomUUID())
   * @param name        - Tool name (e.g. 'goodvibes_work')
   * @param title       - Human-readable title
   * @param kind        - Tool call kind (default: 'other')
   * @param meta        - Optional _meta payload for structured data
   */
  async emitToolCall(
    sessionId: string,
    toolCallId: string,
    name: string,
    title: string,
    kind: acp.ToolKind = 'other',
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const toolCall: acp.ToolCall = {
      toolCallId,
      title,
      kind,
      status: 'pending',
      ...(meta || name
        ? { _meta: { ...(meta ?? {}), '_goodvibes/tool_name': name } }
        : {}),
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
   * @param content     - Optional content array (e.g. tool output blocks)
   */
  async emitToolCallUpdate(
    sessionId: string,
    toolCallId: string,
    status: acp.ToolCallStatus,
    meta?: Record<string, unknown>,
    content?: acp.ToolCallContent[],
  ): Promise<void> {
    const update: acp.ToolCallUpdate = {
      toolCallId,
      status,
      ...(meta ? { _meta: meta } : {}),
      ...(content ? { content } : {}),
    };

    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call_update', ...update } as acp.SessionUpdate,
    });
  }

  /**
   * Emit an agent_thought_chunk session update to stream agent thinking/reasoning
   * content to the client.
   *
   * Per ACP prompt-turn spec, this allows clients to display the agent's
   * extended thinking in real time during LLM inference.
   *
   * @param sessionId - ACP session ID
   * @param text      - Thinking text delta
   */
  async emitThoughtChunk(sessionId: string, text: string): Promise<void> {
    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'agent_thought_chunk',
        content: { type: 'text', text },
      } as acp.SessionUpdate,
    });
  }
}
