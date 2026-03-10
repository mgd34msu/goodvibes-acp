import { describe, test, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.ts';
import { McpBridge } from '../../src/extensions/mcp/bridge.ts';
import { McpToolProxy } from '../../src/extensions/mcp/tool-proxy.ts';
import type { McpToolDef, McpCallResult } from '../../src/extensions/mcp/transport.ts';
import type { McpServer } from '@agentclientprotocol/sdk';

// ---------------------------------------------------------------------------
// MockMcpClient
// ---------------------------------------------------------------------------

class MockMcpClient {
  private _initialized = false;
  private _closed = false;

  constructor(
    private readonly _tools: McpToolDef[],
    private readonly _callResult: McpCallResult = {
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    },
    private readonly _failOnInit = false,
  ) {}

  async initialize(): Promise<void> {
    if (this._failOnInit) {
      throw new Error('Connection refused');
    }
    this._initialized = true;
  }

  async listTools(): Promise<McpToolDef[]> {
    return this._tools;
  }

  async callTool(_name: string, _args: unknown): Promise<McpCallResult> {
    return this._callResult;
  }

  close(): void {
    this._closed = true;
    // Fire any pending 'exit' listener immediately when closed
    if (this._exitListener) {
      this._exitListener();
      this._exitListener = undefined;
    }
  }

  private _exitListener: (() => void) | undefined;

  once(event: string, listener: () => void): void {
    if (event === 'exit') {
      this._exitListener = listener;
    }
  }

  get wasClosed(): boolean {
    return this._closed;
  }

  get wasInitialized(): boolean {
    return this._initialized;
  }
}

// ---------------------------------------------------------------------------
// TestMcpBridge — subclass that injects a mock client factory
// ---------------------------------------------------------------------------

class TestMcpBridge extends McpBridge {
  constructor(
    eventBus: EventBus,
    private readonly _mockFactory: (server: McpServer) => MockMcpClient,
  ) {
    super(eventBus);
    // Override private _createClient via JS property (bypasses TypeScript private)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)._createClient = (server: McpServer) => this._mockFactory(server);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStdioServer(name: string): McpServer {
  return { name, command: 'echo', args: [] } as unknown as McpServer;
}

function makeHttpServer(name: string, url = 'https://api.example.com/mcp'): McpServer {
  return {
    type: 'http',
    name,
    url,
    headers: [
      { name: 'Authorization', value: 'Bearer token123' },
    ],
  } as unknown as McpServer;
}

function makeTools(serverName: string, count: number): McpToolDef[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `tool_${i}`,
    description: `Tool ${i} from ${serverName}`,
    inputSchema: { type: 'object' },
  }));
}

// ---------------------------------------------------------------------------
// McpBridge — constructor
// ---------------------------------------------------------------------------

describe('McpBridge', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('constructor', () => {
    test('creates without error and returns empty collections', () => {
      const bridge = new McpBridge(bus);
      expect(bridge.getTools()).toEqual([]);
      expect(bridge.getConnections()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // connectServers
  // -------------------------------------------------------------------------

  describe('connectServers', () => {
    test('connects to a mock server and discovers its tools', async () => {
      const tools = makeTools('fs', 2);
      const bridge = new TestMcpBridge(bus, () => new MockMcpClient(tools));

      const conns = await bridge.connectServers([makeStdioServer('fs')]);

      expect(conns).toHaveLength(1);
      expect(conns[0].serverId).toBe('fs');
      expect(conns[0].tools).toHaveLength(2);
    });

    test('handles connection failure gracefully — returns empty array, emits mcp:error', async () => {
      const errors: unknown[] = [];
      bus.on('mcp:error', (ev) => errors.push(ev.payload));

      const bridge = new TestMcpBridge(
        bus,
        () => new MockMcpClient([], { content: [], isError: false }, true /* failOnInit */),
      );

      const conns = await bridge.connectServers([makeStdioServer('failing')]);

      expect(conns).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect((errors[0] as { serverId: string }).serverId).toBe('failing');
      expect((errors[0] as { error: string }).error).toContain('Connection refused');
    });

    test('connects to multiple servers in parallel', async () => {
      const bridge = new TestMcpBridge(bus, (server) => {
        const s = server as unknown as { name: string };
        return new MockMcpClient(makeTools(s.name, 1));
      });

      const conns = await bridge.connectServers([
        makeStdioServer('serverA'),
        makeStdioServer('serverB'),
        makeStdioServer('serverC'),
      ]);

      expect(conns).toHaveLength(3);
      const ids = conns.map((c) => c.serverId).sort();
      expect(ids).toEqual(['serverA', 'serverB', 'serverC']);
    });

    test('emits mcp:connected event with serverId and toolCount', async () => {
      const events: unknown[] = [];
      bus.on('mcp:connected', (ev) => events.push(ev.payload));

      const tools = makeTools('svc', 3);
      const bridge = new TestMcpBridge(bus, () => new MockMcpClient(tools));

      await bridge.connectServers([makeStdioServer('svc')]);

      expect(events).toHaveLength(1);
      expect((events[0] as { serverId: string }).serverId).toBe('svc');
      expect((events[0] as { toolCount: number }).toolCount).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // getTools
  // -------------------------------------------------------------------------

  describe('getTools', () => {
    test('returns all namespaced tools from connected servers', async () => {
      const bridge = new TestMcpBridge(bus, (server) => {
        const s = server as unknown as { name: string };
        return new MockMcpClient(makeTools(s.name, 2));
      });

      await bridge.connectServers([makeStdioServer('alpha'), makeStdioServer('beta')]);

      const tools = bridge.getTools();
      expect(tools).toHaveLength(4);
    });

    test('tool names follow the serverId__toolName pattern', async () => {
      const bridge = new TestMcpBridge(bus, () => new MockMcpClient(makeTools('myserver', 1)));

      await bridge.connectServers([makeStdioServer('myserver')]);

      const tools = bridge.getTools();
      expect(tools[0].name).toBe('myserver__tool_0');
    });
  });

  // -------------------------------------------------------------------------
  // executeTool
  // -------------------------------------------------------------------------

  describe('executeTool', () => {
    test('executes tool on the correct server and returns result', async () => {
      const callResult: McpCallResult = {
        content: [{ type: 'text', text: 'file contents' }],
        isError: false,
      };
      const bridge = new TestMcpBridge(
        bus,
        () => new MockMcpClient(makeTools('fs', 1), callResult),
      );

      await bridge.connectServers([makeStdioServer('fs')]);

      const result = await bridge.executeTool('fs', 'tool_0', { path: '/tmp/test' });
      expect(result).toEqual(callResult);
    });

    test('throws for an unknown server', async () => {
      const bridge = new TestMcpBridge(bus, () => new MockMcpClient([]));

      await expect(
        bridge.executeTool('nonexistent', 'tool_0', {}),
      ).rejects.toThrow('MCP server not connected: nonexistent');
    });
  });

  // -------------------------------------------------------------------------
  // disconnect
  // -------------------------------------------------------------------------

  describe('disconnect', () => {
    test('disconnects specific server and emits mcp:disconnected event', async () => {
      const disconnected: unknown[] = [];
      bus.on('mcp:disconnected', (ev) => disconnected.push(ev.payload));

      const bridge = new TestMcpBridge(bus, () => new MockMcpClient(makeTools('svc', 1)));
      await bridge.connectServers([makeStdioServer('svc')]);

      expect(bridge.getConnections()).toHaveLength(1);

      await bridge.disconnect('svc');

      expect(bridge.getConnections()).toHaveLength(0);
      expect(disconnected).toHaveLength(1);
      expect((disconnected[0] as { serverId: string }).serverId).toBe('svc');
    });

    test('disconnectAll removes all connections', async () => {
      const bridge = new TestMcpBridge(bus, (server) => {
        const s = server as unknown as { name: string };
        return new MockMcpClient(makeTools(s.name, 1));
      });

      await bridge.connectServers([
        makeStdioServer('a'),
        makeStdioServer('b'),
        makeStdioServer('c'),
      ]);

      expect(bridge.getConnections()).toHaveLength(3);

      await bridge.disconnectAll();

      expect(bridge.getConnections()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// McpToolProxy
// ---------------------------------------------------------------------------

describe('McpToolProxy', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  async function makeBridgeWithTools(
    serverId: string,
    tools: McpToolDef[],
    callResult?: McpCallResult,
  ): Promise<McpBridge> {
    const defaultResult: McpCallResult = {
      content: [{ type: 'text', text: 'result' }],
      isError: false,
    };
    const bridge = new TestMcpBridge(
      bus,
      () => new MockMcpClient(tools, callResult ?? defaultResult),
    );
    await bridge.connectServers([makeStdioServer(serverId)]);
    return bridge;
  }

  test('tools getter returns all bridge tools', async () => {
    const bridge = await makeBridgeWithTools('svc', makeTools('svc', 2));
    const proxy = new McpToolProxy(bridge);

    expect(proxy.tools).toHaveLength(2);
    expect(proxy.tools[0].name).toBe('svc__tool_0');
    expect(proxy.tools[1].name).toBe('svc__tool_1');
  });

  test('execute parses namespaced tool name correctly and returns success ToolResult', async () => {
    const callResult: McpCallResult = {
      content: [{ type: 'text', text: 'data' }],
      isError: false,
    };
    const bridge = await makeBridgeWithTools('fs', makeTools('fs', 1), callResult);
    const proxy = new McpToolProxy(bridge);

    const result = await proxy.execute('fs__tool_0', { path: '/tmp' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(callResult);
    expect(typeof result.durationMs).toBe('number');
  });

  test('execute returns failure ToolResult when MCP tool returns isError=true', async () => {
    const errorResult: McpCallResult = {
      content: [{ type: 'text', text: 'Permission denied' }],
      isError: true,
    };
    const bridge = await makeBridgeWithTools('fs', makeTools('fs', 1), errorResult);
    const proxy = new McpToolProxy(bridge);

    const result = await proxy.execute('fs__tool_0', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Permission denied');
  });

  test('execute returns failure ToolResult for invalid tool name format (no separator)', async () => {
    const bridge = await makeBridgeWithTools('svc', makeTools('svc', 1));
    const proxy = new McpToolProxy(bridge);

    const result = await proxy.execute('notnamespaced', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid MCP tool name');
  });

  // -------------------------------------------------------------------------
  // ISS-022: MCP content block preservation
  // -------------------------------------------------------------------------

  test('ISS-022: execute preserves full McpCallResult content array on ToolResult.data', async () => {
    const multiBlockResult: McpCallResult = {
      content: [
        { type: 'text', text: 'block one' },
        { type: 'text', text: 'block two' },
      ],
      isError: false,
    };
    const bridge = await makeBridgeWithTools('fs', makeTools('fs', 1), multiBlockResult);
    const proxy = new McpToolProxy(bridge);

    const result = await proxy.execute('fs__tool_0', {});

    expect(result.success).toBe(true);
    const data = result.data as McpCallResult;
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content).toHaveLength(2);
    expect(data.content[0].text).toBe('block one');
    expect(data.content[1].text).toBe('block two');
  });

  test('ISS-022: execute preserves empty content array on ToolResult.data', async () => {
    const emptyResult: McpCallResult = {
      content: [],
      isError: false,
    };
    const bridge = await makeBridgeWithTools('fs', makeTools('fs', 1), emptyResult);
    const proxy = new McpToolProxy(bridge);

    const result = await proxy.execute('fs__tool_0', {});

    expect(result.success).toBe(true);
    const data = result.data as McpCallResult;
    expect(Array.isArray(data.content)).toBe(true);
    expect(data.content).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// McpBridge HTTP routing
// ---------------------------------------------------------------------------

describe('McpBridge HTTP routing', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('routes http server to mock client via factory override', async () => {
    const tools = makeTools('api', 2);
    const bridge = new TestMcpBridge(bus, () => new MockMcpClient(tools));

    const conns = await bridge.connectServers([makeHttpServer('api')]);

    expect(conns).toHaveLength(1);
    expect(conns[0].serverId).toBe('api');
    expect(conns[0].tools).toHaveLength(2);
  });

  test('routes mixed stdio + http servers correctly', async () => {
    const bridge = new TestMcpBridge(bus, (server) => {
      const s = server as unknown as { name: string };
      return new MockMcpClient(makeTools(s.name, 1));
    });

    const conns = await bridge.connectServers([
      makeStdioServer('local'),
      makeHttpServer('remote'),
    ]);

    expect(conns).toHaveLength(2);
    const ids = conns.map((c) => c.serverId).sort();
    expect(ids).toEqual(['local', 'remote']);
  });

  test('emits mcp:connected for http server with correct toolCount', async () => {
    const events: unknown[] = [];
    bus.on('mcp:connected', (ev) => events.push(ev.payload));

    const bridge = new TestMcpBridge(bus, () => new MockMcpClient(makeTools('api', 3)));
    await bridge.connectServers([makeHttpServer('api')]);

    expect(events).toHaveLength(1);
    expect((events[0] as { serverId: string }).serverId).toBe('api');
    expect((events[0] as { toolCount: number }).toolCount).toBe(3);
  });

  test('handles http server connection failure gracefully', async () => {
    const errors: unknown[] = [];
    bus.on('mcp:error', (ev) => errors.push(ev.payload));

    const bridge = new TestMcpBridge(
      bus,
      () => new MockMcpClient([], { content: [], isError: false }, true),
    );

    const conns = await bridge.connectServers([makeHttpServer('failing-api')]);

    expect(conns).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect((errors[0] as { serverId: string }).serverId).toBe('failing-api');
  });

  test('real _createClient returns null and emits mcp:error for sse server', () => {
    const bridge = new McpBridge(bus);
    const errors: unknown[] = [];
    bus.on('mcp:error', (ev) => errors.push(ev.payload));

    const sseServer = {
      type: 'sse',
      name: 'sse-server',
      url: 'https://api.example.com/sse',
      headers: [],
    } as unknown as McpServer;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (bridge as any)._createClient(sseServer);

    expect(client).toBeNull();
    expect(errors).toHaveLength(1);
    expect((errors[0] as { error: string }).error).toContain('SSE transport not supported');
  });
});
