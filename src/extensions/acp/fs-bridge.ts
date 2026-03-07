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
      const response = await this.conn.readTextFile({
        path,
        sessionId: this.sessionId,
      });
      return response.content;
    }

    // Direct disk fallback
    const encoding = (options?.encoding ?? 'utf-8') as BufferEncoding;
    return readFile(path, { encoding });
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
      await this.conn.writeTextFile({
        path,
        content,
        sessionId: this.sessionId,
      });
      return;
    }

    // Direct disk fallback — ensure parent directory exists
    await mkdir(dirname(path), { recursive: true });
    const encoding = (options?.encoding ?? 'utf-8') as BufferEncoding;
    await writeFile(path, content, { encoding });
  }
}
