/**
 * @module mcp/bridge
 * @layer L2 — MCP bridge orchestrator
 *
 * McpBridge is the top-level coordinator for MCP server connections.
 * It connects to multiple MCP servers in parallel, aggregates their tool
 * definitions, and routes tool execution calls to the correct server.
 *
 * Events emitted on the provided EventBus:
 *   - `mcp:connected`    — { serverId: string; toolCount: number }
 *   - `mcp:disconnected` — { serverId: string }
 *   - `mcp:error`        — { serverId: string; error: string }
 */

import type { EventBus } from '../../core/event-bus.js';
import type { ToolDefinition } from '../../types/registry.js';
import type { McpServer, McpServerStdio } from '@agentclientprotocol/sdk';
import { McpClient, createMcpStdioTransport, type McpToolDef } from './transport.js';

// ---------------------------------------------------------------------------
// McpConnection
// ---------------------------------------------------------------------------

/** Represents an active connection to a single MCP server */
export type McpConnection = {
  /** Logical server name from the session config */
  serverId: string;
  /** Tools discovered from this server */
  tools: ToolDefinition[];
  /** The underlying client (internal use by bridge) */
  client: McpClient;
};

// ---------------------------------------------------------------------------
// McpBridge
// ---------------------------------------------------------------------------

/**
 * Orchestrates connections to one or more MCP servers.
 *
 * Usage:
 * ```typescript
 * const bridge = new McpBridge(eventBus);
 * const connections = await bridge.connectServers(params.mcpServers);
 * const tools = bridge.getTools();
 * const result = await bridge.executeTool('filesystem', 'read_file', { path: '/foo' });
 * await bridge.disconnectAll();
 * ```
 */
export class McpBridge {
  private readonly _connections = new Map<string, McpConnection>();

  constructor(private readonly eventBus: EventBus) {}

  // -------------------------------------------------------------------------
  // connectServers
  // -------------------------------------------------------------------------

  /**
   * Connect to multiple MCP servers in parallel.
   *
   * Failures are logged and skipped — a partial connection set is returned.
   * The session continues even if some MCP servers fail to connect.
   *
   * @param servers - MCP server configurations from the ACP session request
   * @returns Array of successfully established connections
   */
  async connectServers(servers: McpServer[]): Promise<McpConnection[]> {
    const results = await Promise.allSettled(
      servers.map((server) => this._connectOne(server)),
    );

    const connections: McpConnection[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        connections.push(result.value);
      }
    }
    return connections;
  }

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  /**
   * Disconnect a specific MCP server by its logical name.
   *
   * @param serverId - The server's logical name
   */
  async disconnect(serverId: string): Promise<void> {
    const conn = this._connections.get(serverId);
    if (!conn) return;
    conn.client.close();
    this._connections.delete(serverId);
    this.eventBus.emit('mcp:disconnected', { serverId });
  }

  // -------------------------------------------------------------------------
  // disconnectAll
  // -------------------------------------------------------------------------

  /**
   * Disconnect all connected MCP servers.
   * Called during session shutdown or agent teardown.
   */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this._connections.keys());
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
  }

  // -------------------------------------------------------------------------
  // getTools
  // -------------------------------------------------------------------------

  /**
   * Aggregate tool definitions from all connected servers.
   *
   * Tool names are namespaced as `{serverId}__{toolName}` to avoid collisions
   * across servers that expose tools with the same name.
   */
  getTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const conn of this._connections.values()) {
      tools.push(...conn.tools);
    }
    return tools;
  }

  // -------------------------------------------------------------------------
  // executeTool
  // -------------------------------------------------------------------------

  /**
   * Execute a tool on a specific MCP server.
   *
   * @param serverId  - Logical server name
   * @param toolName  - Tool name (without namespace prefix)
   * @param params    - Tool input parameters
   * @returns Raw MCP tool result
   * @throws Error if the server is not connected
   */
  async executeTool(serverId: string, toolName: string, params: unknown): Promise<unknown> {
    const conn = this._connections.get(serverId);
    if (!conn) {
      throw new Error(`MCP server not connected: ${serverId}`);
    }
    return conn.client.callTool(toolName, params);
  }

  // -------------------------------------------------------------------------
  // getConnection / getConnections
  // -------------------------------------------------------------------------

  /**
   * Get a specific connection by server ID.
   */
  getConnection(serverId: string): McpConnection | undefined {
    return this._connections.get(serverId);
  }

  /**
   * Get all active connections.
   */
  getConnections(): McpConnection[] {
    return Array.from(this._connections.values());
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _connectOne(server: McpServer): Promise<McpConnection | null> {
    const serverId = server.name;

    try {
      const client = this._createClient(server);
      await client.initialize();

      const mcpTools = await client.listTools();
      const tools = this._adaptTools(serverId, mcpTools);

      const conn: McpConnection = { serverId, tools, client };
      this._connections.set(serverId, conn);

      this.eventBus.emit('mcp:connected', { serverId, toolCount: tools.length });

      return conn;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[McpBridge] Failed to connect to MCP server "${serverId}": ${error}`);
      this.eventBus.emit('mcp:error', { serverId, error });
      return null;
    }
  }

  private _createClient(server: McpServer): McpClient {
    // Only stdio is supported in the baseline implementation.
    // HTTP/SSE transports require additional dependencies not yet available.
    if ('command' in server) {
      // McpServerStdio
      const stdio = server as McpServerStdio;
      const env: Record<string, string> = {};
      for (const v of stdio.env ?? []) {
        // EnvVariable has { name: string; value: string } shape
        env[v.name] = (v as { name: string; value: string }).value;
      }
      return createMcpStdioTransport({
        name: stdio.name,
        command: stdio.command,
        args: stdio.args,
        env,
      });
    }

    // HTTP/SSE: not supported yet
    throw new Error(
      `MCP transport "${'type' in server ? (server as { type: string }).type : 'unknown'}" is not yet supported. Only stdio is currently implemented.`,
    );
  }

  private _adaptTools(serverId: string, mcpTools: McpToolDef[]): ToolDefinition[] {
    return mcpTools.map((tool) => ({
      // Namespace the name to avoid cross-server collisions
      name: `${serverId}__${tool.name}`,
      description: tool.description ?? `${tool.name} (from ${serverId})`,
      inputSchema: tool.inputSchema,
    }));
  }
}
