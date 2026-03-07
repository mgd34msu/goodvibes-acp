/**
 * @module mcp/tool-call-bridge
 * @layer L2 — MCP tool call ACP visibility bridge
 *
 * McpToolCallBridge wraps AgentLoop onProgress events to emit ACP
 * tool_call / tool_call_update session updates so clients can observe
 * MCP tool execution in real time.
 *
 * Usage:
 *   const bridge = new McpToolCallBridge(() => toolCallEmitter);
 *   const onProgress = bridge.makeProgressHandler(sessionId);
 *   // pass onProgress to AgentLoopConfig
 */

import { randomUUID } from 'node:crypto';
import type { ToolCallEmitter } from '../acp/tool-call-emitter.js';
import type { AgentProgressEvent } from '../../plugins/agents/loop.js';

// ---------------------------------------------------------------------------
// McpToolCallBridge
// ---------------------------------------------------------------------------

/**
 * Bridges AgentLoop progress events to ACP tool_call session updates.
 *
 * Each tool execution becomes a pair of ACP updates:
 *   tool_start  → tool_call      (status: in_progress)
 *   tool_complete → tool_call_update (status: completed)
 *   tool_error    → tool_call_update (status: failed)
 *
 * The emitter is resolved lazily via a getter so this bridge can be
 * constructed before the ACP connection exists.
 *
 * @example
 * ```typescript
 * const bridge = new McpToolCallBridge(() => toolCallEmitter);
 * const loop = new AgentLoop({
 *   ...config,
 *   onProgress: bridge.makeProgressHandler(sessionId),
 * });
 * ```
 */
export class McpToolCallBridge {
  constructor(private readonly _getEmitter: () => ToolCallEmitter | null) {}

  // -------------------------------------------------------------------------
  // makeProgressHandler
  // -------------------------------------------------------------------------

  /**
   * Returns an onProgress callback bound to a specific ACP session.
   *
   * The returned handler tracks in-flight tool call IDs keyed by tool name
   * and emits the appropriate ACP updates when tools start, complete, or fail.
   *
   * @param sessionId - ACP session ID to emit updates against
   */
  makeProgressHandler(
    sessionId: string,
  ): (event: AgentProgressEvent) => void {
    // Per-invocation map: namespaced tool name → ACP toolCallId
    const activeIds = new Map<string, string>();

    return (event: AgentProgressEvent): void => {
      const emitter = this._getEmitter();
      if (!emitter) return;

      if (event.type === 'tool_start') {
        const toolCallId = randomUUID();
        activeIds.set(event.toolName, toolCallId);

        // Derive a human-readable title from the namespaced tool name.
        // e.g. 'mcp__filesystem__read_file' → 'filesystem: read_file'
        const title = _formatToolTitle(event.toolName);

        emitter
          .emitToolCall(
            sessionId,
            toolCallId,
            event.toolName,
            title,
            'in_progress',
            { '_goodvibes/turn': event.turn },
          )
          .catch(() => {});
        return;
      }

      if (event.type === 'tool_complete') {
        const toolCallId = activeIds.get(event.toolName);
        if (!toolCallId) return;
        activeIds.delete(event.toolName);

        emitter
          .emitToolCallUpdate(
            sessionId,
            toolCallId,
            'completed',
            { '_goodvibes/durationMs': event.durationMs },
          )
          .catch(() => {});
        return;
      }

      if (event.type === 'tool_error') {
        const toolCallId = activeIds.get(event.toolName);
        if (!toolCallId) return;
        activeIds.delete(event.toolName);

        emitter
          .emitToolCallUpdate(
            sessionId,
            toolCallId,
            'failed',
            { '_goodvibes/error': event.error },
          )
          .catch(() => {});
        return;
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a namespaced tool name as a human-readable title.
 *
 * - 'mcp__filesystem__read_file'   → 'filesystem: read_file'
 * - 'mcp__precision__glob'         → 'precision: glob'
 * - 'unknown_tool'                 → 'unknown_tool'
 */
function _formatToolTitle(toolName: string): string {
  const parts = toolName.split('__');
  // providerName__serverOrTool__rest...
  // AgentLoop namespaces as providerName__toolName, where McpToolProxy further
  // splits as serverId__rawToolName. So the full name is:
  //   mcp__serverId__rawToolName
  if (parts.length >= 3) {
    // mcp__serverId__rawToolName → 'serverId: rawToolName'
    return `${parts[1]}: ${parts.slice(2).join('__')}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}: ${parts[1]}`;
  }
  return toolName;
}
