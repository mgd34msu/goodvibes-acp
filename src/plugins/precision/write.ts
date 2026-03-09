/**
 * @module plugins/precision/write
 * @layer L3 — plugin
 *
 * PrecisionWriteTool — implements the precision_write tool.
 *
 * Features:
 *   - Write one or more files in a single call
 *   - Automatic parent directory creation
 *   - Three write modes: fail_if_exists, overwrite, backup
 *   - Returns per-file summary with bytes written
 *
 * All file I/O uses node:fs/promises. No external dependencies.
 */

import {
  writeFile,
  mkdir,
  rename,
  access,
} from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import type {
  PrecisionWriteParams,
  PrecisionWriteData,
  PrecisionResult,
  FileWriteResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a path exists (returns false on any error, including ENOENT) */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PrecisionWriteTool
// ---------------------------------------------------------------------------

export class PrecisionWriteTool {
  /**
   * Execute a precision_write operation.
   * Writes one or more files, creating parent directories as needed.
   */
  async execute(params: PrecisionWriteParams): Promise<PrecisionResult<PrecisionWriteData>> {
    const startMs = Date.now();

    if (!Array.isArray(params.files) || params.files.length === 0) {
      return {
        success: false,
        error: 'precision_write: "files" must be a non-empty array',
        durationMs: Date.now() - startMs,
      };
    }

    const results: FileWriteResult[] = [];
    let filesWritten = 0;
    let totalBytesWritten = 0;
    let filesFailed = 0;

    for (const entry of params.files) {
      const mode = entry.mode ?? 'fail_if_exists';
      const encoding = (entry.encoding ?? 'utf-8') as BufferEncoding;
      const rawContent = entry.content ?? '';
      const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2);

      try {
        // Ensure parent directory exists
        const dir = dirname(entry.path);
        await mkdir(dir, { recursive: true });

        const exists = await pathExists(entry.path);

        if (exists && mode === 'fail_if_exists') {
          results.push({
            path: entry.path,
            success: false,
            error: `File already exists and mode is 'fail_if_exists': ${entry.path}`,
          });
          filesFailed++;
          continue;
        }

        let backupPath: string | undefined;

        if (exists && mode === 'backup') {
          // Rename existing file to <name>.bak (overwrite old backup if present)
          const dir2 = dirname(entry.path);
          const name = basename(entry.path);
          backupPath = join(dir2, `${name}.bak`);
          await rename(entry.path, backupPath);
        }

        const encoded = Buffer.from(content, encoding);
        await writeFile(entry.path, encoded);

        const bytesWritten = encoded.length;
        totalBytesWritten += bytesWritten;
        filesWritten++;

        results.push({
          path: entry.path,
          success: true,
          bytesWritten,
          backedUp: backupPath !== undefined,
          backupPath,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          path: entry.path,
          success: false,
          error: message,
        });
        filesFailed++;
      }
    }

    return {
      success: filesFailed === 0,
      data: {
        files: results,
        filesWritten,
        bytesWritten: totalBytesWritten,
        filesFailed,
      },
      error:
        filesFailed > 0
          ? `precision_write: ${filesFailed} file(s) failed to write`
          : undefined,
      durationMs: Date.now() - startMs,
    };
  }
}
