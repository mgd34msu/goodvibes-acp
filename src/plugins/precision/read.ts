/**
 * @module plugins/precision/read
 * @layer L3 — plugin
 *
 * PrecisionReadTool — implements the precision_read tool.
 *
 * Supports four extract modes:
 *   - content: full raw file text
 *   - outline: structural overview (function/class/interface signatures without bodies)
 *   - symbols: exported declarations only
 *   - lines: specific line range
 *
 * All file I/O uses node:fs/promises. No external dependencies.
 */

import { readFile, stat } from 'node:fs/promises';
import type {
  PrecisionReadParams,
  PrecisionReadData,
  PrecisionResult,
  FileReadResult,
  ExtractMode,
} from './types.js';

// ---------------------------------------------------------------------------
// Extract helpers
// ---------------------------------------------------------------------------

/**
 * Apply line numbers to content if requested.
 * Format: "    1 | line text\n    2 | ..."
 */
function applyLineNumbers(content: string): string {
  const lines = content.split('\n');
  const width = String(lines.length).length;
  return lines
    .map((line, i) => `${String(i + 1).padStart(width + 4)} | ${line}`)
    .join('\n');
}

/**
 * Extract outline from file content.
 * Returns top-level function/class/interface/type/enum/const signatures,
 * stripping bodies to give a structural overview.
 */
function extractOutline(content: string): string {
  const lines = content.split('\n');
  const outlineLines: string[] = [];
  let depth = 0;
  let captureSignature = false;
  let signatureBuffer: string[] = [];

  for (const line of lines) {
    // Track brace depth for body skipping
    const openBraces = (line.match(/\{/g) ?? []).length;
    const closeBraces = (line.match(/\}/g) ?? []).length;

    // Detect top-level declarations
    const isTopLevel = depth === 0;
    const isDeclaration =
      isTopLevel &&
      /^\s*(export\s+)?(async\s+)?(function|class|interface|type|enum|const|let|var|abstract\s+class)\b/.test(
        line
      );

    if (isDeclaration || captureSignature) {
      signatureBuffer.push(line);
      captureSignature = true;

      // Check if signature is complete (has opening brace at top level)
      const bufferText = signatureBuffer.join('\n');
      const hasOpenBrace = bufferText.includes('{');
      const isTypeAlias = /^\s*(export\s+)?type\s+\w+/.test(bufferText) && bufferText.includes('=');

      if (hasOpenBrace && !isTypeAlias) {
        // Emit the signature line (up to and including the opening brace)
        const sigLine = signatureBuffer.join(' ').replace(/\s+/g, ' ').trim();
        // Truncate at the opening brace to show just the signature
        const braceIdx = sigLine.indexOf('{');
        const sig = braceIdx !== -1 ? sigLine.slice(0, braceIdx + 1) + ' ... }' : sigLine;
        outlineLines.push(sig);
        signatureBuffer = [];
        captureSignature = false;
      } else if (isTypeAlias && (bufferText.includes(';') || !line.trim().endsWith(','))) {
        // Type aliases end with semicolon or are single-line
        const sigLine = signatureBuffer.join(' ').replace(/\s+/g, ' ').trim();
        outlineLines.push(sigLine);
        signatureBuffer = [];
        captureSignature = false;
      } else if (!hasOpenBrace && !isTypeAlias && signatureBuffer.length > 5) {
        // Bail if we've buffered too many lines without finding a brace
        signatureBuffer = [];
        captureSignature = false;
      }
    }

    depth += openBraces - closeBraces;
    if (depth < 0) depth = 0;
  }

  return outlineLines.join('\n') || '(no outline available)';
}

/**
 * Extract exported symbols from file content.
 * Returns lines that begin with `export` or `export default`.
 */
function extractSymbols(content: string): string {
  const lines = content.split('\n');
  const symbolLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('export ') ||
      trimmed.startsWith('export{') ||
      trimmed.startsWith('export default')
    ) {
      // Include the full line but truncate long function bodies
      const truncated =
        trimmed.length > 120 ? trimmed.slice(0, 120) + '...' : trimmed;
      symbolLines.push(truncated);
    }
  }

  return symbolLines.join('\n') || '(no exports found)';
}

/**
 * Extract a line range from file content.
 * Lines are 1-based. If end exceeds total lines, clamps to EOF.
 */
function extractLines(
  content: string,
  start: number,
  end: number,
  includeLineNumbers: boolean
): string {
  const lines = content.split('\n');
  const from = Math.max(1, start) - 1; // convert to 0-based
  const to = Math.min(lines.length, end); // inclusive, 1-based
  const slice = lines.slice(from, to);

  if (includeLineNumbers) {
    const width = String(to).length;
    return slice
      .map((line, i) => `${String(from + i + 1).padStart(width + 4)} | ${line}`)
      .join('\n');
  }

  return slice.join('\n');
}

// ---------------------------------------------------------------------------
// PrecisionReadTool
// ---------------------------------------------------------------------------

export class PrecisionReadTool {
  /**
   * Execute a precision_read operation.
   * Reads one or more files with the requested extract mode.
   */
  async execute(params: PrecisionReadParams): Promise<PrecisionResult<PrecisionReadData>> {
    const startMs = Date.now();

    if (!Array.isArray(params.files) || params.files.length === 0) {
      return {
        success: false,
        error: 'precision_read: "files" must be a non-empty array',
        durationMs: Date.now() - startMs,
      };
    }

    const defaultExtract: ExtractMode = params.extractMode ?? 'content';
    const includeLineNumbers = params.includeLineNumbers !== false;

    const results: FileReadResult[] = [];
    let filesRead = 0;
    let filesFailed = 0;

    for (const entry of params.files) {
      try {
        const fileStat = await stat(entry.path);
        const rawContent = await readFile(entry.path, { encoding: 'utf-8' });
        const extractMode: ExtractMode = entry.extract ?? defaultExtract;

        let content: string;

        switch (extractMode) {
          case 'outline':
            content = extractOutline(rawContent);
            break;

          case 'symbols':
            content = extractSymbols(rawContent);
            break;

          case 'lines': {
            const range = entry.range ?? { start: 1, end: 50 };
            content = extractLines(rawContent, range.start, range.end, includeLineNumbers);
            break;
          }

          case 'content':
          default:
            content = includeLineNumbers ? applyLineNumbers(rawContent) : rawContent;
            break;
        }

        results.push({
          path: entry.path,
          content,
          lineCount: rawContent.split('\n').length,
          sizeBytes: fileStat.size,
          encoding: 'utf-8',
        });
        filesRead++;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        results.push({
          path: entry.path,
          content: `ERROR: ${message}`,
          lineCount: 0,
          sizeBytes: 0,
          encoding: 'utf-8',
        });
        filesFailed++;
      }
    }

    return {
      success: filesFailed === 0,
      data: {
        files: results,
        filesRead,
        filesFailed,
      },
      error:
        filesFailed > 0
          ? `precision_read: ${filesFailed} file(s) failed to read`
          : undefined,
      durationMs: Date.now() - startMs,
    };
  }
}
