/**
 * @module acp/fs-bridge
 * @layer L2 — ACP file system bridge
 *
 * Implements ITextFileAccess using ACP client fs methods when the client
 * advertises the capability, falling back to direct Node.js fs otherwise.
 */

import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import type { ITextFileAccess, ReadOptions, WriteOptions } from '../../types/registry.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { RequestTracker } from './terminal-bridge.js';
import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const VALID_ENCODINGS = new Set<BufferEncoding>([
  'utf-8', 'utf8', 'ascii', 'base64', 'hex', 'latin1', 'binary', 'ucs-2', 'ucs2', 'utf16le',
]);

// ---------------------------------------------------------------------------
// AcpFileSystem
// ---------------------------------------------------------------------------

/**
 * ITextFileAccess implementation that routes file operations through the ACP
 * client when the client advertises fs capabilities, and falls back to direct
 * disk I/O otherwise.
 *
 * Capability gates:
 *   - `clientCapabilities.fs?.readTextFile === true`  → use `conn.readTextFile()`
 *   - `clientCapabilities.fs?.writeTextFile === true` → use `conn.writeTextFile()`
 *   - Otherwise → direct `readFile` / `writeFile` from node:fs/promises
 */
export class AcpFileSystem implements ITextFileAccess {
  constructor(
    private readonly conn: AgentSideConnection,
    private readonly sessionId: string,
    private readonly clientCapabilities: schema.ClientCapabilities,
    private readonly _tracker?: RequestTracker,
    private readonly _eventBus?: EventBus,
  ) {}

  // -------------------------------------------------------------------------
  // readTextFile
  // -------------------------------------------------------------------------

  /**
   * Read a text file.
   *
   * Uses ACP client fs bridge if the client advertises `fs.readTextFile`,
   * otherwise reads directly from disk.
   */
  async readTextFile(path: string, options?: ReadOptions): Promise<string> {
    if (this.clientCapabilities.fs?.readTextFile) {
      const _reqId = crypto.randomUUID();
      this._tracker?.add(_reqId);
      this._eventBus?.emit('acp:client-request:start', { sessionId: this.sessionId, requestId: _reqId });
      let response: Awaited<ReturnType<AgentSideConnection['readTextFile']>>;
      try {
        response = await this.conn.readTextFile({
          path,
          sessionId: this.sessionId,
          line: options?.line,
          limit: options?.limit,
        });
      } finally {
        this._tracker?.remove(_reqId);
        this._eventBus?.emit('acp:client-request:end', { sessionId: this.sessionId, requestId: _reqId });
      }
      return response.content;
    }

    // Direct disk fallback
    const encoding = (options?.encoding ?? 'utf-8') as string;
    if (!VALID_ENCODINGS.has(encoding as BufferEncoding)) {
      throw new Error(`Unsupported encoding: ${encoding}`);
    }
    let text = await readFile(path, { encoding: encoding as BufferEncoding });
    // Apply line/limit slicing if requested
    if (options?.line !== undefined || options?.limit !== undefined) {
      const lines = text.split('\n');
      const startIdx = options.line !== undefined ? Math.max(0, options.line - 1) : 0;
      const sliced = options.limit !== undefined ? lines.slice(startIdx, startIdx + options.limit) : lines.slice(startIdx);
      text = sliced.join('\n');
    }
    return text;
  }

  // -------------------------------------------------------------------------
  // writeTextFile
  // -------------------------------------------------------------------------

  /**
   * Write a text file.
   *
   * Uses ACP client fs bridge if the client advertises `fs.writeTextFile`,
   * otherwise writes directly to disk (creating parent directories as needed).
   */
  async writeTextFile(path: string, content: string, options?: WriteOptions): Promise<void> {
    if (this.clientCapabilities.fs?.writeTextFile) {
      // The ACP fs/write_text_file spec (KB-07) does not include an encoding field —
      // the protocol assumes UTF-8. If the caller requests a non-UTF-8 encoding,
      // throw rather than silently producing different behavior on ACP vs disk paths.
      if (options?.encoding && options.encoding !== 'utf-8' && options.encoding !== 'utf8') {
        throw new Error(
          `ACP fs/write_text_file does not support encoding '${options.encoding}' — only UTF-8 is supported on the ACP path`
        );
      }
      const _reqId = crypto.randomUUID();
      this._tracker?.add(_reqId);
      this._eventBus?.emit('acp:client-request:start', { sessionId: this.sessionId, requestId: _reqId });
      try {
        await this.conn.writeTextFile({
          path,
          content,
          sessionId: this.sessionId,
        });
      } finally {
        this._tracker?.remove(_reqId);
        this._eventBus?.emit('acp:client-request:end', { sessionId: this.sessionId, requestId: _reqId });
      }
      return;
    }

    // Direct disk fallback — ensure parent directory exists
    await mkdir(dirname(path), { recursive: true });
    const encoding = (options?.encoding ?? 'utf-8') as string;
    if (!VALID_ENCODINGS.has(encoding as BufferEncoding)) {
      throw new Error(`Unsupported encoding: ${encoding}`);
    }
    await writeFile(path, content, { encoding: encoding as BufferEncoding });
  }
}
