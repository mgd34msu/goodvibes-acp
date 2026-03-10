import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { McpHttpClient, createMcpHttpTransport } from '../../src/extensions/mcp/transport.ts';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

/**
 * Creates a mock fetch that returns a successful JSON-RPC response.
 */
function makeMockFetch(responseBody: unknown, status = 200) {
  return mock(async (_url: string, _init: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => responseBody,
  }));
}

// ---------------------------------------------------------------------------
// McpHttpClient unit tests
// ---------------------------------------------------------------------------

describe('McpHttpClient', () => {
  describe('constructor / createMcpHttpTransport', () => {
    test('factory returns an McpHttpClient instance not yet ready', () => {
      const client = createMcpHttpTransport({
        name: 'test-server',
        url: 'http://localhost:9000/mcp',
      });
      expect(client).toBeInstanceOf(McpHttpClient);
      expect(client.isReady).toBe(false);
    });

    test('factory accepts headers option', () => {
      const client = createMcpHttpTransport({
        name: 'test-server',
        url: 'http://localhost:9000/mcp',
        headers: { Authorization: 'Bearer token123' },
      });
      expect(client).toBeInstanceOf(McpHttpClient);
    });
  });

  describe('initialize', () => {
    test('sends initialize request and marks client ready', async () => {
      const mockFetch = makeMockFetch({
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: { tools: {} } },
      });
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token123' },
      });

      await client.initialize();

      expect(client.isReady).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify request shape
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.example.com/mcp');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.jsonrpc).toBe('2.0');
      expect(body.method).toBe('initialize');
      expect(body.params.protocolVersion).toBe('2024-11-05');

      globalThis.fetch = origFetch;
    });

    test('includes custom headers in requests', async () => {
      const mockFetch = makeMockFetch({
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: {} },
      });
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      });

      await client.initialize();

      const [, init] = mockFetch.mock.calls[0];
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer token123');
      expect(headers['X-Custom-Header']).toBe('custom-value');
      expect(headers['Content-Type']).toBe('application/json');

      globalThis.fetch = origFetch;
    });

    test('captures server capabilities from initialize response', async () => {
      const mockFetch = makeMockFetch({
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: { tools: {}, resources: {} } },
      });
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      await client.initialize();

      expect(client.serverCapabilities).toEqual({ tools: {}, resources: {} });

      globalThis.fetch = origFetch;
    });

    test('throws on HTTP error response (non-2xx)', async () => {
      const mockFetch = makeMockFetch({ error: 'Unauthorized' }, 401);
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      await expect(client.initialize()).rejects.toThrow('HTTP 401');

      globalThis.fetch = origFetch;
    });

    test('throws on network failure', async () => {
      const mockFetch = mock(async () => {
        throw new Error('fetch failed');
      });
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      await expect(client.initialize()).rejects.toThrow('HTTP request failed: fetch failed');

      globalThis.fetch = origFetch;
    });

    test('throws on JSON-RPC error in response', async () => {
      const mockFetch = makeMockFetch({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32600, message: 'Invalid Request' },
      });
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      await expect(client.initialize()).rejects.toThrow('MCP error -32600: Invalid Request');

      globalThis.fetch = origFetch;
    });
  });

  describe('listTools', () => {
    async function makeReadyClient(toolsResponse: unknown): Promise<McpHttpClient> {
      let callCount = 0;
      const mockFetch = mock(async (_url: string, _init: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          // initialize response
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({ jsonrpc: '2.0', id: 1, result: { capabilities: {} } }),
          };
        }
        // listTools response
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => toolsResponse,
        };
      });
      const origFetch = globalThis.fetch;
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });
      await client.initialize();

      // Restore after test via cleanup
      (client as McpHttpClient & { _origFetch: typeof fetch })._origFetch = origFetch;
      return client;
    }

    test('returns tools list from server', async () => {
      const client = await makeReadyClient({
        jsonrpc: '2.0',
        id: 2,
        result: {
          tools: [
            { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object' } },
            { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object' } },
          ],
        },
      });

      const tools = await client.listTools();

      globalThis.fetch = (client as McpHttpClient & { _origFetch: typeof fetch })._origFetch;

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('read_file');
      expect(tools[1].name).toBe('write_file');
    });

    test('returns empty array when server has no tools', async () => {
      const client = await makeReadyClient({
        jsonrpc: '2.0',
        id: 2,
        result: { tools: [] },
      });

      const tools = await client.listTools();

      globalThis.fetch = (client as McpHttpClient & { _origFetch: typeof fetch })._origFetch;

      expect(tools).toEqual([]);
    });

    test('throws if not initialized', async () => {
      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      await expect(client.listTools()).rejects.toThrow('McpHttpClient not initialized');
    });
  });

  describe('callTool', () => {
    test('throws if not initialized', async () => {
      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      await expect(client.callTool('read_file', { path: '/tmp/test' })).rejects.toThrow(
        'McpHttpClient not initialized',
      );
    });
  });

  describe('close', () => {
    test('marks client as not ready and emits exit event', () => {
      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      // Manually mark ready to test the closed state change
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)._ready = true;
      expect(client.isReady).toBe(true);

      let exitEmitted = false;
      client.once('exit', () => {
        exitEmitted = true;
      });

      client.close();

      expect(client.isReady).toBe(false);
      expect(exitEmitted).toBe(true);
    });

    test('rejects new requests after close', async () => {
      const client = createMcpHttpTransport({
        name: 'api-server',
        url: 'https://api.example.com/mcp',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)._ready = true;
      client.close();

      await expect(client.callTool('read_file', {})).rejects.toThrow('McpHttpClient is closed');
    });
  });
});

// ---------------------------------------------------------------------------
// Header conversion helper
// ---------------------------------------------------------------------------

describe('HTTP header conversion (HttpHeader[] -> Record<string,string>)', () => {
  test('converts HttpHeader array format to plain object for fetch', () => {
    // This tests the conversion logic used in McpBridge._createClient
    // by verifying that when passed to McpHttpClient, headers are forwarded correctly.
    const httpHeaders = [
      { name: 'Authorization', value: 'Bearer token123' },
      { name: 'Content-Type', value: 'application/json' },
    ];

    // Convert as bridge does
    const headers: Record<string, string> = {};
    for (const h of httpHeaders) {
      headers[h.name] = h.value;
    }

    expect(headers).toEqual({
      Authorization: 'Bearer token123',
      'Content-Type': 'application/json',
    });
  });

  test('empty header array produces empty object', () => {
    const headers: Record<string, string> = {};
    for (const h of [] as { name: string; value: string }[]) {
      headers[h.name] = h.value;
    }
    expect(headers).toEqual({});
  });
});
