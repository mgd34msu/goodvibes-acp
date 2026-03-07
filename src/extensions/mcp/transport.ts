/**
 * @module mcp/transport
 * @layer L2 — MCP transport helpers
 *
 * Provides factory helpers for creating MCP client connections to MCP servers.
 * Implements a minimal JSON-RPC client over stdio (subprocess) without
 * requiring @modelcontextprotocol/sdk.
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
export class McpClient extends EventEmitter {
  private readonly _process: ChildProcess;
  private _idCounter = 0;
  private readonly _pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private _ready = false;
  private _closed = false;

  constructor(process: ChildProcess) {
    super();
    this._process = process;

    const rl = createInterface({ input: this._process.stdout! });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (typeof msg.id === 'number') {
          const pending = this._pending.get(msg.id);
          if (pending) {
            this._pending.delete(msg.id);
            if (msg.error) {
              pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
            } else {
              pending.resolve(msg.result);
            }
          }
        }
      } catch {
        // Ignore non-JSON lines (server stderr noise on stdout is unusual but safe to ignore)
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
    await this._request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'goodvibes', version: '0.1.0' },
    });
    // Send the initialized notification (fire-and-forget)
    this._notify('notifications/initialized', {});
    this._ready = true;
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

  private _request(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this._closed) {
        reject(new Error('MCP client is closed'));
        return;
      }
      const id = ++this._idCounter;
      this._pending.set(id, { resolve, reject });
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      this._process.stdin!.write(JSON.stringify(msg) + '\n', 'utf8');
    });
  }

  private _notify(method: string, params: unknown): void {
    if (this._closed) return;
    const msg = { jsonrpc: '2.0', method, params };
    this._process.stdin!.write(JSON.stringify(msg) + '\n', 'utf8');
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

  // Forward stderr to process stderr so operator can see MCP server logs
  child.stderr?.pipe(process.stderr);

  return new McpClient(child);
}
