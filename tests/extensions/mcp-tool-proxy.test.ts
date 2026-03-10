import { describe, it, expect, beforeEach } from 'bun:test';
import { McpToolProxy } from '../../src/extensions/mcp/tool-proxy.ts';
import type { McpBridge } from '../../src/extensions/mcp/bridge.ts';
import type { McpCallResult } from '../../src/extensions/mcp/transport.ts';
import type { ToolDefinition } from '../../src/types/registry.ts';

// ---------------------------------------------------------------------------
// Mock McpBridge
// ---------------------------------------------------------------------------

function makeMockBridge(
  tools: ToolDefinition[] = [],
  callResult: McpCallResult = { content: [{ type: 'text', text: 'success' }], isError: false },
  shouldThrow: Error | null = null,
): McpBridge {
  return {
    getTools: () => tools,
    async executeTool(_serverId: string, _toolName: string, _params: unknown) {
      if (shouldThrow) throw shouldThrow;
      return callResult;
    },
    // unused methods — satisfy type with minimal stubs
    connectServers: async () => [],
    disconnect: async () => {},
    disconnectAll: async () => {},
    getConnection: () => undefined,
    getConnections: () => [],
  } as unknown as McpBridge;
}

const SAMPLE_TOOL: ToolDefinition = {
  name: 'filesystem__read_file',
  description: 'Read a file',
  inputSchema: { type: 'object', properties: {} },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('McpToolProxy', () => {
  describe('name property', () => {
    it('is always "mcp"', () => {
      const proxy = new McpToolProxy(makeMockBridge());
      expect(proxy.name).toBe('mcp');
    });
  });

  describe('tools getter', () => {
    it('delegates to bridge.getTools() and returns all tools', () => {
      const proxy = new McpToolProxy(makeMockBridge([SAMPLE_TOOL]));
      expect(proxy.tools).toEqual([SAMPLE_TOOL]);
    });

    it('returns an empty array when bridge has no tools', () => {
      const proxy = new McpToolProxy(makeMockBridge([]));
      expect(proxy.tools).toEqual([]);
    });

    it('returns multiple tools from multiple servers', () => {
      const tools: ToolDefinition[] = [
        { name: 'server_a__tool_1', description: 'T1', inputSchema: {} },
        { name: 'server_b__tool_2', description: 'T2', inputSchema: {} },
      ];
      const proxy = new McpToolProxy(makeMockBridge(tools));
      expect(proxy.tools).toHaveLength(2);
    });
  });

  describe('execute — success path', () => {
    it('returns success: true with data when bridge.executeTool succeeds', async () => {
      const result: McpCallResult = {
        content: [{ type: 'text', text: 'file contents here' }],
        isError: false,
      };
      const proxy = new McpToolProxy(makeMockBridge([SAMPLE_TOOL], result));
      const out = await proxy.execute('filesystem__read_file', { path: '/foo.txt' });

      expect(out.success).toBe(true);
      expect(out.data).toEqual(result);
      expect(typeof out.durationMs).toBe('number');
    });

    it('includes a non-negative durationMs in the result', async () => {
      const proxy = new McpToolProxy(makeMockBridge());
      const out = await proxy.execute('srv__tool', {});
      expect(out.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute — MCP error response', () => {
    it('returns success: false with extracted error text when isError is true', async () => {
      const errorResult: McpCallResult = {
        content: [{ type: 'text', text: 'Permission denied' }],
        isError: true,
      };
      const proxy = new McpToolProxy(makeMockBridge([], errorResult));
      const out = await proxy.execute('srv__tool', {});

      expect(out.success).toBe(false);
      expect(out.error).toBe('Permission denied');
    });

    it('returns fallback error text when isError content is empty', async () => {
      const errorResult: McpCallResult = {
        content: [],
        isError: true,
      };
      const proxy = new McpToolProxy(makeMockBridge([], errorResult));
      const out = await proxy.execute('srv__tool', {});

      expect(out.success).toBe(false);
      expect(out.error).toBe('MCP tool returned an error');
    });

    it('joins multiple error text blocks with newline', async () => {
      const errorResult: McpCallResult = {
        content: [
          { type: 'text', text: 'line 1' },
          { type: 'text', text: 'line 2' },
        ],
        isError: true,
      };
      const proxy = new McpToolProxy(makeMockBridge([], errorResult));
      const out = await proxy.execute('srv__tool', {});

      expect(out.error).toBe('line 1\nline 2');
    });
  });

  describe('execute — bridge throws', () => {
    it('catches Error and returns success: false with message', async () => {
      const proxy = new McpToolProxy(
        makeMockBridge([], { content: [], isError: false }, new Error('Network error'))
      );
      const out = await proxy.execute('srv__tool', {});

      expect(out.success).toBe(false);
      expect(out.error).toBe('Network error');
    });

    it('catches non-Error throws and returns string representation', async () => {
      const bridge = {
        getTools: () => [],
        async executeTool() { throw 'string-error'; },
      } as unknown as McpBridge;
      const proxy = new McpToolProxy(bridge);
      const out = await proxy.execute('srv__tool', {});

      expect(out.success).toBe(false);
      expect(out.error).toBe('string-error');
    });
  });

  describe('execute — invalid tool name', () => {
    it('returns success: false when tool name has no "__" separator', async () => {
      const proxy = new McpToolProxy(makeMockBridge());
      const out = await proxy.execute('toolWithoutSeparator', {});

      expect(out.success).toBe(false);
      expect(out.error).toContain('Invalid MCP tool name');
    });

    it('handles tool name that starts with "__" (empty serverId)', async () => {
      const proxy = new McpToolProxy(makeMockBridge());
      const out = await proxy.execute('__tool', {});

      // serverId is empty string → falsy → invalid
      expect(out.success).toBe(false);
    });

    it('correctly parses serverId with embedded "__" in tool name', async () => {
      // e.g. "server__tool__with__underscores" → serverId=server, tool=tool__with__underscores
      const bridge = {
        getTools: () => [],
        async executeTool(serverId: string, toolName: string) {
          return { content: [{ type: 'text', text: `${serverId}::${toolName}` }], isError: false };
        },
      } as unknown as McpBridge;
      const proxy = new McpToolProxy(bridge);
      const out = await proxy.execute('server__tool__sub', {});

      expect(out.success).toBe(true);
      // data.content should confirm correct routing
      const data = out.data as McpCallResult;
      expect(data.content[0].text).toBe('server::tool__sub');
    });
  });
});
