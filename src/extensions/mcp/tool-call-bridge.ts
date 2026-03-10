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
import type { AgentProgressEvent } from '../../types/agent.js';
import type { McpCallResult } from './transport.js';

// ---------------------------------------------------------------------------
// PermissionGate
// ---------------------------------------------------------------------------

/**
 * Permission gate interface for tools with side effects.
 *
 * Implement this interface and inject it into McpToolCallBridge to gate
 * destructive or sensitive tool calls between the 'pending' and 'in_progress'
 * ACP lifecycle states.
 */
export interface PermissionGate {
  /**
   * Request permission to run a tool.
   *
   * @param sessionId - ACP session ID
   * @param toolCallId - Stable ID for the pending tool call
   * @param toolName   - MCP tool name (may be namespaced)
   * @returns Promise resolving to true (granted) or false (denied)
   */
  requestPermission(sessionId: string, toolCallId: string, toolName: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// McpToolCallBridge
// ---------------------------------------------------------------------------

/**
 * Bridges AgentLoop progress events to ACP tool_call session updates.
 *
 * Each tool execution becomes a pair of ACP updates:
 *   tool_start    → tool_call        (status: pending)
 *                 → tool_call_update  (status: in_progress)
 *   tool_complete → tool_call_update  (status: completed)
 *   tool_error    → tool_call_update  (status: failed)
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
/**
 * Status terminology note (ISS-055 verified):
 * - ACP SDK (v0.15.0) ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
 * - KB 06-tools-mcp.md uses 'running' instead of 'in_progress'
 * - SDK types confirmed as authoritative: ToolCallStatus does NOT include 'running'.
 *   This implementation uses 'in_progress' as defined by the SDK. If the spec is updated
 *   to align with the SDK, no code change will be needed.
 */
export class McpToolCallBridge {
  constructor(
    private readonly _getEmitter: (sessionId: string) => ToolCallEmitter | null,
    private readonly _permissionGate?: PermissionGate,
  ) {}

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
    // Per-invocation map: namespaced tool name → FIFO queue of ACP toolCallIds.
    // A queue (not a single value) is required so that concurrent calls to the
    // same tool name do not overwrite each other.
    const activeIds = new Map<string, string[]>();

    return (event: AgentProgressEvent): void => {
      const emitter = this._getEmitter(sessionId);
      if (!emitter) return;

      if (event.type === 'tool_start') {
        const toolCallId = randomUUID();
        const queue = activeIds.get(event.toolName) ?? [];
        queue.push(toolCallId);
        activeIds.set(event.toolName, queue);

        // Derive a human-readable title from the namespaced tool name.
        // e.g. 'mcp__filesystem__read_file' → 'filesystem: read_file'
        const title = _formatToolTitle(event.toolName);

        // Announce the tool call with 'pending', then immediately transition
        // to 'in_progress' per ACP lifecycle requirements.
        emitter
          .emitToolCall(
            sessionId,
            toolCallId,
            event.toolName,
            title,
            inferKind(event.toolName),
            { '_goodvibes/turn': event.turn },
          )
          .then(async () => {
            // ISS-021: Permission gate — for tools with side effects, check permission
            // before transitioning from 'pending' to 'in_progress'.
            if (this._permissionGate && requiresPermission(event.toolName)) {
              const granted = await this._permissionGate.requestPermission(
                sessionId,
                toolCallId,
                event.toolName,
              );
              if (!granted) {
                return emitter.emitToolCallUpdate(
                  sessionId,
                  toolCallId,
                  'failed',
                  undefined,
                  [{ type: 'content', content: { type: 'text', text: 'Permission denied' } }],
                );
              }
            }
            return emitter.emitToolCallUpdate(sessionId, toolCallId, 'in_progress');
          })
          .catch((err: unknown) => {
            console.error('[McpToolCallBridge] error:', err);
          });
        return;
      }

      if (event.type === 'tool_complete') {
        const queue = activeIds.get(event.toolName);
        const toolCallId = queue?.shift();
        if (!toolCallId) return;
        if (queue?.length === 0) activeIds.delete(event.toolName);

        emitter
          .emitToolCallUpdate(
            sessionId,
            toolCallId,
            'completed',
            { '_goodvibes/durationMs': event.durationMs },
            // ISS-022: Forward MCP content blocks directly to ACP client.
            // event.result.data is a McpCallResult with a content[] array.
            // Map each MCP content block to an ACP ToolCallContent block.
            event.result != null
              ? _mcpResultToAcpContent(event.result.data as McpCallResult | null | undefined)
              : [],
          )
          .catch((err: unknown) => {
            console.error('[McpToolCallBridge] error:', err);
          });
        return;
      }

      if (event.type === 'agent_thought_chunk') {
        // Forward agent thinking/reasoning as ACP agent_thought_chunk session update.
        // Fire-and-forget: thought chunks are best-effort — do not block the loop.
        emitter
          .emitThoughtChunk(sessionId, event.chunk.text)
          .catch((err: unknown) => {
            console.error('[McpToolCallBridge] agent_thought_chunk emit error:', err);
          });
        return;
      }

      if (event.type === 'tool_error') {
        const queue = activeIds.get(event.toolName);
        const toolCallId = queue?.shift();
        if (!toolCallId) return;
        if (queue?.length === 0) activeIds.delete(event.toolName);

        emitter
          .emitToolCallUpdate(
            sessionId,
            toolCallId,
            'failed',
            { '_goodvibes/error': event.error },
            // ISS-023: pass content blocks as the content parameter, not inside _meta
            [{ type: 'content', content: { type: 'text', text: String(event.error ?? 'Unknown error') } }],
          )
          .catch((err: unknown) => {
            console.error('[McpToolCallBridge] error:', err);
          });
        return;
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine if a tool requires permission before execution.
 *
 * Tools with side effects (write, edit, delete, exec, create, remove)
 * must pass through the permission gate before transitioning to in_progress.
 *
 * @param toolName - MCP tool name (may be namespaced)
 */
export function requiresPermission(toolName: string): boolean {
  // Use the raw tool name part (after last '__') for keyword matching.
  const raw = toolName.includes('__') ? toolName.split('__').pop()! : toolName;
  const n = raw.toLowerCase();
  return (
    n.includes('write') ||
    n.includes('edit') ||
    n.includes('delete') ||
    n.includes('exec') ||
    n.includes('create') ||
    n.includes('remove')
  );
}

/**
 * Convert an MCP call result's content blocks to ACP ToolCallContent[].
 *
 * ISS-022: Forward MCP ContentBlock[] directly rather than re-wrapping
 * into a single text block. Preserves multi-block results and non-text
 * content types (image, resource, etc.).
 *
 * @param mcpResult - Raw McpCallResult or nullish
 */
function _mcpResultToAcpContent(
  mcpResult: McpCallResult | null | undefined,
): import('@agentclientprotocol/sdk').ToolCallContent[] {
  if (!mcpResult || !Array.isArray(mcpResult.content) || mcpResult.content.length === 0) {
    return [];
  }
  // MCP ContentBlock[] is structurally compatible with ACP ToolCallContent[].
  // We use a cast here because McpCallResult uses a minimal open type
  // ({ type: string; text?: string; [key: string]: unknown }) rather than
  // the full ACP ContentBlock union.
  return mcpResult.content.map((block) => ({
    type: 'content' as const,
    content: block as import('@agentclientprotocol/sdk').ContentBlock,
  }));
}

/**
 * Infer an ACP ToolCallKind from an MCP tool name.
 *
 * Maps common tool name patterns to their semantic kind so ACP clients
 * can display appropriate icons and categorize tool operations.
 *
 * @param toolName - MCP tool name (may be namespaced, e.g. 'mcp__fs__read_file')
 */
function inferKind(toolName: string): import('@agentclientprotocol/sdk').ToolKind {
  // Use the raw tool name part (after last '__') for keyword matching.
  const raw = toolName.includes('__') ? toolName.split('__').pop()! : toolName;
  const n = raw.toLowerCase();
  if (n.includes('read') || n.includes('get'))                              return 'read';
  if (n.includes('write') || n.includes('create') || n.includes('edit') ||
      n.includes('update') || n.includes('patch'))                          return 'edit';
  if (n.includes('delete') || n.includes('remove'))                        return 'delete';
  if (n.includes('move') || n.includes('rename'))                          return 'move';
  if (n.includes('search') || n.includes('grep') ||
      n.includes('glob') || n.includes('find'))                            return 'search';
  if (n.includes('exec') || n.includes('run') ||
      n.includes('shell') || n.includes('bash'))                           return 'execute';
  if (n.includes('fetch') || n.includes('http') || n.includes('request')) return 'fetch';
  return 'other';
}

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
