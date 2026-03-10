/**
 * @module mcp/transport
 * @layer L2 — MCP transport helpers
 *
 * Provides factory helpers for creating MCP client connections to MCP servers.
 * Implements a minimal JSON-RPC client over stdio (subprocess) and over HTTP POST,
 * without requiring @modelcontextprotocol/sdk.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// MCP JSON-RPC protocol types (minimal subset)
// ---------------------------------------------------------------------------

/** A JSON-RPC 2.0 request message */
type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
};

/** A JSON-RPC 2.0 response message */
type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

/** A JSON-RPC 2.0 notification (no id, server-initiated) */
type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
};

/** MCP tool definition as returned by tools/list */
export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

/** Result from an MCP tools/call */
export type McpCallResult = {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
};

// ---------------------------------------------------------------------------
// McpClient
// ---------------------------------------------------------------------------

/**
 * Minimal MCP JSON-RPC client over a spawned subprocess (stdio transport).
 *
 * Handles:
 * - Subprocess lifecycle (spawn, exit, error events)
 * - JSON-RPC request/response correlation via id counter
 * - MCP protocol handshake (initialize + initialized notification)
 * - tools/list and tools/call
 */
// Default timeout for MCP JSON-RPC requests
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class McpClient extends EventEmitter {
  private readonly _process: ChildProcess;
  private _idCounter = 0;
  private readonly _pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private _ready = false;
  private _closed = false;
  private _serverCapabilities: Record<string, unknown> | undefined = undefined;
  /** Consecutive JSON parse failure count — escalates to error after threshold */
  private _parseFailCount = 0;

  constructor(process: ChildProcess) {
    super();
    this._process = process;

    if (!this._process.stdout) {
      throw new Error('[McpClient] spawned process has no stdout — cannot read MCP responses');
    }
    const rl = createInterface({ input: this._process.stdout });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse | JsonRpcNotification;
        // Reset parse failure counter on successful parse
        this._parseFailCount = 0;
        if ('id' in msg && typeof msg.id === 'number') {
          // Response to a pending request
          const response = msg as JsonRpcResponse;
          const pending = this._pending.get(response.id);
          if (pending) {
            this._pending.delete(response.id);
            if (response.error) {
              pending.reject(new Error(`MCP error ${response.error.code}: ${response.error.message}`));
            } else {
              pending.resolve(response.result);
            }
          }
        } else if ('method' in msg && typeof (msg as JsonRpcNotification).method === 'string') {
          // Server-initiated notification (no id) — emit as event
          const notification = msg as JsonRpcNotification;
          this.emit('mcp:notification', notification);
          if (notification.method === 'notifications/tools/list_changed') {
            // Signal that the tool list changed; callers can re-fetch
            this.emit('mcp:tools:changed');
          }
        }
      } catch {
        // Track consecutive parse failures and escalate after threshold (ISS-065)
        this._parseFailCount++;
        const preview = trimmed.substring(0, 100);
        if (this._parseFailCount >= 3) {
          console.error(
            `[McpClient] ${this._parseFailCount} consecutive JSON parse failures — last line: ${preview}`,
          );
        } else {
          console.debug('[McpClient] ignoring non-JSON line:', preview);
        }
      }
    });

    this._process.on('error', (err) => {
      this._closed = true;
      this.emit('error', err);
      this._rejectAll(err);
    });

    this._process.on('exit', (code) => {
      this._closed = true;
      const err = new Error(`MCP server exited with code ${code ?? 'null'}`);
      this.emit('exit', code);
      this._rejectAll(err);
    });
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Perform the MCP initialization handshake.
   * Must be called before listing or calling tools.
   */
  async initialize(): Promise<void> {
    const result = await this._request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'goodvibes', version: '0.1.0' },
    }) as { capabilities?: Record<string, unknown> };
    // Capture server capabilities from the handshake response
    this._serverCapabilities = result.capabilities;
    // Send the initialized notification (fire-and-forget)
    this._notify('notifications/initialized', {});
    this._ready = true;
  }

  /** Server capabilities returned during the initialize handshake */
  get serverCapabilities(): Record<string, unknown> | undefined {
    return this._serverCapabilities;
  }

  /**
   * List all tools exposed by this MCP server.
   */
  async listTools(): Promise<McpToolDef[]> {
    this._assertReady();
    const result = await this._request('tools/list', {}) as { tools?: McpToolDef[] };
    return result.tools ?? [];
  }

  /**
   * Call a named tool with the given arguments.
   */
  async callTool(name: string, args: unknown): Promise<McpCallResult> {
    this._assertReady();
    const result = await this._request('tools/call', {
      name,
      arguments: args,
    }) as McpCallResult;
    return result;
  }

  /**
   * Terminate the subprocess.
   */
  close(): void {
    if (!this._closed) {
      this._closed = true;
      this._process.kill();
    }
  }

  get isReady(): boolean {
    return this._ready && !this._closed;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _request(
    method: string,
    params: unknown,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this._closed) {
        reject(new Error('MCP client is closed'));
        return;
      }
      const id = ++this._idCounter;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`MCP request timeout after ${timeoutMs}ms: ${method}`));
      }, timeoutMs);
      this._pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (reason) => { clearTimeout(timer); reject(reason); },
      });
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      if (!this._process.stdin) {
        // Clean up the pending entry before rejecting
        this._pending.delete(id);
        clearTimeout(timer);
        reject(new Error('stdin is not available'));
        return;
      }
      try {
        this._process.stdin.write(JSON.stringify(msg) + '\n', 'utf8');
      } catch (writeErr) {
        // ISS-067: Write failed — clean up pending entry to avoid leak
        this._pending.delete(id);
        clearTimeout(timer);
        reject(writeErr instanceof Error ? writeErr : new Error(String(writeErr)));
      }
    });
  }

  private _notify(method: string, params: unknown): void {
    if (this._closed) return;
    if (!this._process.stdin) return;
    const msg = { jsonrpc: '2.0', method, params };
    this._process.stdin.write(JSON.stringify(msg) + '\n', 'utf8');
  }

  private _assertReady(): void {
    if (!this._ready) throw new Error('McpClient not initialized — call initialize() first');
    if (this._closed) throw new Error('McpClient is closed');
  }

  private _rejectAll(err: Error): void {
    for (const { reject } of this._pending.values()) {
      reject(err);
    }
    this._pending.clear();
  }
}

// ---------------------------------------------------------------------------
// createMcpStdioTransport
// ---------------------------------------------------------------------------

/** Options for spawning an MCP server as a stdio subprocess */
export type McpStdioTransportOptions = {
  /** Logical name for this server (used in logging) */
  name: string;
  /** Executable command to spawn */
  command: string;
  /** Command-line arguments */
  args?: string[];
  /** Additional environment variables for the subprocess */
  env?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// McpHttpClient
// ---------------------------------------------------------------------------

/** Options for connecting to an MCP server over HTTP */
export type McpHttpTransportOptions = {
  /** Logical name for this server (used in logging) */
  name: string;
  /** HTTP endpoint URL of the MCP server */
  url: string;
  /** HTTP headers to include in all requests */
  headers?: Record<string, string>;
};

/**
 * MCP JSON-RPC client over HTTP POST (Streamable HTTP / JSON-RPC 2.0).
 *
 * Each MCP request is sent as an HTTP POST with `Content-Type: application/json`.
 * The response body is parsed as a JSON-RPC 2.0 response.
 *
 * This client implements the same public API as McpClient so the McpBridge
 * can treat both interchangeably.
 */
export class McpHttpClient extends EventEmitter {
  private _idCounter = 0;
  private _ready = false;
  private _closed = false;
  private _serverCapabilities: Record<string, unknown> | undefined = undefined;

  constructor(private readonly _options: McpHttpTransportOptions) {
    super();
  }

  // -------------------------------------------------------------------------
  // Public API (mirrors McpClient)
  // -------------------------------------------------------------------------

  /**
   * Perform the MCP initialization handshake over HTTP.
   * Must be called before listing or calling tools.
   */
  async initialize(): Promise<void> {
    const result = await this._request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'goodvibes', version: '0.1.0' },
    }) as { capabilities?: Record<string, unknown> };
    this._serverCapabilities = result.capabilities;
    this._ready = true;
  }

  /** Server capabilities returned during the initialize handshake */
  get serverCapabilities(): Record<string, unknown> | undefined {
    return this._serverCapabilities;
  }

  /**
   * List all tools exposed by this MCP server.
   */
  async listTools(): Promise<McpToolDef[]> {
    this._assertReady();
    const result = await this._request('tools/list', {}) as { tools?: McpToolDef[] };
    return result.tools ?? [];
  }

  /**
   * Call a named tool with the given arguments.
   */
  async callTool(name: string, args: unknown): Promise<McpCallResult> {
    this._assertReady();
    const result = await this._request('tools/call', {
      name,
      arguments: args,
    }) as McpCallResult;
    return result;
  }

  /**
   * Close the HTTP client (no-op for HTTP — marks as closed to reject new requests).
   */
  close(): void {
    this._closed = true;
    this.emit('exit', 0);
  }

  get isReady(): boolean {
    return this._ready && !this._closed;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _request(
    method: string,
    params: unknown,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    if (this._closed) {
      throw new Error('McpHttpClient is closed');
    }

    const id = ++this._idCounter;
    const body: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(this._options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this._options.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[McpHttpClient:${this._options.name}] HTTP request failed: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(
        `[McpHttpClient:${this._options.name}] HTTP ${response.status} ${response.statusText} for method "${method}"`,
      );
    }

    let rpc: JsonRpcResponse;
    try {
      rpc = (await response.json()) as JsonRpcResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[McpHttpClient:${this._options.name}] Invalid JSON response: ${msg}`);
    }

    if (rpc.error) {
      throw new Error(
        `[McpHttpClient:${this._options.name}] MCP error ${rpc.error.code}: ${rpc.error.message}`,
      );
    }

    return rpc.result;
  }

  private _assertReady(): void {
    if (!this._ready) throw new Error('McpHttpClient not initialized — call initialize() first');
    if (this._closed) throw new Error('McpHttpClient is closed');
  }
}

/**
 * Create an MCP client that connects to a remote HTTP MCP server.
 *
 * The client is NOT yet initialized — call `client.initialize()` after creation.
 *
 * @param options - Connection options including URL and headers
 * @returns An McpHttpClient ready to be initialized
 */
export function createMcpHttpTransport(options: McpHttpTransportOptions): McpHttpClient {
  return new McpHttpClient(options);
}

/**
 * Spawn an MCP server as a subprocess and return a connected McpClient.
 *
 * The client is NOT yet initialized — call `client.initialize()` after creation.
 *
 * @param options - Spawn options for the MCP server
 * @returns An McpClient ready to be initialized
 */
export function createMcpStdioTransport(options: McpStdioTransportOptions): McpClient {
  const child = spawn(options.command, options.args ?? [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...options.env,
    },
  });

  // ISS-006: Forward stderr line-by-line with server name prefix instead of piping
  // directly. Piping pollutes the ACP ndjson transport stream; prefixed lines are
  // distinguishable from protocol traffic in operator logs.
  const serverName = options.name;
  child.stderr?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.error(`[mcp:${serverName}] ${line}`);
    }
  });

  return new McpClient(child);
}
