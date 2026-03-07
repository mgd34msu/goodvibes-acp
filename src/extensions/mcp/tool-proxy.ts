/**
 * @module mcp/tool-proxy
 * @layer L2 — MCP tool proxy
 *
 * McpToolProxy implements IToolProvider (from L0 types/registry.ts),
 * bridging MCP server tools into the GoodVibes L1 Registry pattern.
 *
 * Tool name convention: `{serverId}__{toolName}`
 * - Registered in the Registry under the key `tool-provider:mcp`
 * - Routes execution to the correct MCP server via McpBridge
 * - Wraps MCP results in the standard ToolResult envelope
 */

import type { IToolProvider, ToolDefinition, ToolResult } from '../../types/registry.js';
import type { McpBridge } from './bridge.js';
import type { McpCallResult } from './transport.js';

// ---------------------------------------------------------------------------
// Separator constant
// ---------------------------------------------------------------------------

/** Separator between server ID and tool name in namespaced tool names */
const NAME_SEP = '__';

// ---------------------------------------------------------------------------
// McpToolProxy
// ---------------------------------------------------------------------------

/**
 * Implements IToolProvider by delegating to McpBridge.
 *
 * Tools from all connected MCP servers are exposed as a flat list using the
 * `{serverId}__{toolName}` naming convention. Execution is routed back to
 * the appropriate server via McpBridge.executeTool().
 *
 * @example
 * ```typescript
 * const proxy = new McpToolProxy(bridge);
 * registry.registerMany('tool-provider', 'mcp', proxy);
 *
 * // List tools
 * const tools = proxy.tools;
 *
 * // Execute
 * const result = await proxy.execute('filesystem__read_file', { path: '/foo' });
 * ```
 */
export class McpToolProxy implements IToolProvider {
  readonly name = 'mcp';

  constructor(private readonly bridge: McpBridge) {}

  // -------------------------------------------------------------------------
  // IToolProvider.tools
  // -------------------------------------------------------------------------

  /**
   * Returns all tool definitions from all connected MCP servers.
   * Names are in `{serverId}__{toolName}` format.
   */
  get tools(): ToolDefinition[] {
    return this.bridge.getTools();
  }

  // -------------------------------------------------------------------------
  // IToolProvider.execute
  // -------------------------------------------------------------------------

  /**
   * Execute a named MCP tool.
   *
   * @param toolName - Namespaced tool name: `{serverId}__{toolName}`
   * @param params   - Tool input parameters
   * @returns ToolResult envelope wrapping the MCP response
   */
  async execute<T = unknown>(toolName: string, params: unknown): Promise<ToolResult<T>> {
    const startMs = Date.now();

    const { serverId, rawToolName } = this._parseToolName(toolName);
    if (!serverId || !rawToolName) {
      return {
        success: false,
        error: `Invalid MCP tool name "${toolName}" — expected format: "{serverId}__${rawToolName ?? 'toolName'}"`,
        durationMs: Date.now() - startMs,
      };
    }

    try {
      const result = await this.bridge.executeTool(serverId, rawToolName, params) as McpCallResult;

      if (result.isError) {
        const errorText = result.content
          .filter((c) => c.type === 'text' && c.text)
          .map((c) => c.text)
          .join('\n');
        return {
          success: false,
          error: errorText || 'MCP tool returned an error',
          data: result as unknown as T,
          durationMs: Date.now() - startMs,
        };
      }

      return {
        success: true,
        data: result as unknown as T,
        durationMs: Date.now() - startMs,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startMs,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _parseToolName(toolName: string): { serverId: string | null; rawToolName: string | null } {
    const idx = toolName.indexOf(NAME_SEP);
    if (idx === -1) {
      return { serverId: null, rawToolName: toolName };
    }
    return {
      serverId: toolName.slice(0, idx),
      rawToolName: toolName.slice(idx + NAME_SEP.length),
    };
  }
}
