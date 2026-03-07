/**
 * @module plugins/precision/symbols
 * @layer L3 — plugin
 *
 * PrecisionSymbols — symbol search in workspace or document mode.
 *
 * Extracts TypeScript/JavaScript symbols (functions, classes, interfaces,
 * types, enums, constants) from files using regex-based pattern matching.
 * Supports both workspace-wide search and single-document extraction.
 *
 * All file I/O uses node:fs/promises. No external dependencies.
 */

import * as fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import type { ToolResult } from '../../types/registry.js';
import { matchesGlob } from './glob.js';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** Symbol kind filter */
export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'constant';

/** Parameters for PrecisionSymbols.search() */
export type SymbolsParams = {
  /** Symbol name/pattern to search for (regex supported) */
  query: string;
  /** Search mode: workspace (across files) or document (single file) */
  mode?: 'workspace' | 'document';
  /** File path for document mode (required when mode=document) */
  file?: string;
  /** Glob pattern for workspace mode (default: **\/*.{ts,tsx,js,jsx}) */
  glob?: string;
  /** Filter by symbol kind(s) */
  kinds?: SymbolKind[];
  /** Base path for workspace search (default: cwd) */
  base_path?: string;
  /** Max results to return (default: 100) */
  max_results?: number;
  /** Whether to include line content in results (default: true) */
  include_content?: boolean;
};

/** A matched symbol */
export type SymbolMatch = {
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: SymbolKind;
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** Source line content */
  content?: string;
  /** Whether the symbol is exported */
  exported: boolean;
};

/** Data payload returned by precision_symbols */
export type SymbolsResult = {
  /** Matched symbols */
  symbols: SymbolMatch[];
  /** Total symbols found */
  count: number;
  /** Whether results were truncated */
  truncated: boolean;
  /** Duration in milliseconds */
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Symbol extraction patterns
// ---------------------------------------------------------------------------

interface SymbolPattern {
  kind: SymbolKind;
  regex: RegExp;
  nameGroup: number;
  exportGroup: number;
}

const SYMBOL_PATTERNS: SymbolPattern[] = [
  {
    kind: 'function',
    regex: /^(\s*)(export\s+)?(async\s+)?function\s+(\w+)/,
    nameGroup: 4,
    exportGroup: 2,
  },
  {
    kind: 'function',
    // Arrow function assigned to const: export const foo = (...) =>
    regex: /^(\s*)(export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(.*\)\s*=>/,
    nameGroup: 3,
    exportGroup: 2,
  },
  {
    kind: 'class',
    regex: /^(\s*)(export\s+)?(?:abstract\s+)?class\s+(\w+)/,
    nameGroup: 3,
    exportGroup: 2,
  },
  {
    kind: 'interface',
    regex: /^(\s*)(export\s+)?interface\s+(\w+)/,
    nameGroup: 3,
    exportGroup: 2,
  },
  {
    kind: 'type',
    regex: /^(\s*)(export\s+)?type\s+(\w+)\s*[=<]/,
    nameGroup: 3,
    exportGroup: 2,
  },
  {
    kind: 'enum',
    regex: /^(\s*)(export\s+)?(?:const\s+)?enum\s+(\w+)/,
    nameGroup: 3,
    exportGroup: 2,
  },
  {
    kind: 'constant',
    regex: /^(\s*)(export\s+)?const\s+(\w+)\s*[:=]/,
    nameGroup: 3,
    exportGroup: 2,
  },
  {
    kind: 'variable',
    regex: /^(\s*)(export\s+)?(?:let|var)\s+(\w+)\s*[:=]/,
    nameGroup: 3,
    exportGroup: 2,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract symbols from a single file's content */
function extractSymbolsFromContent(
  content: string,
  filePath: string,
  queryRegex: RegExp,
  kinds: SymbolKind[] | undefined,
  includeContent: boolean
): SymbolMatch[] {
  const lines = content.split('\n');
  const matches: SymbolMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    for (const pattern of SYMBOL_PATTERNS) {
      if (kinds && !kinds.includes(pattern.kind)) continue;

      const match = pattern.regex.exec(line);
      if (!match) continue;

      const name = match[pattern.nameGroup];
      if (!name) continue;

      // Check if name matches the query
      if (!queryRegex.test(name)) continue;

      const exported = Boolean(match[pattern.exportGroup]?.trim());
      const column = (match[1]?.length ?? 0) + 1;

      matches.push({
        name,
        kind: pattern.kind,
        file: filePath,
        line: i + 1,
        column,
        content: includeContent ? line.trim() : undefined,
        exported,
      });

      // Only match the highest-priority pattern for this line
      break;
    }
  }

  return matches;
}

/** Recursively collect .ts/.tsx/.js/.jsx files */
async function collectSourceFiles(
  dir: string,
  globPattern: string,
  results: string[],
  maxFiles: number
): Promise<boolean> {
  if (results.length >= maxFiles) return true;

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (results.length >= maxFiles) return true;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
        continue;
      }
      const truncated = await collectSourceFiles(fullPath, globPattern, results, maxFiles);
      if (truncated) return true;
    } else if (entry.isFile()) {
      const relPath = path.relative(process.cwd(), fullPath);
      if (matchesGlob(relPath, globPattern) || matchesGlob(entry.name, globPattern)) {
        results.push(fullPath);
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// PrecisionSymbols
// ---------------------------------------------------------------------------

export class PrecisionSymbols {
  /**
   * Search for symbols matching the query.
   * Never throws — errors are captured in the result.
   */
  async search(params: SymbolsParams): Promise<ToolResult<SymbolsResult>> {
    const startMs = Date.now();

    if (!params.query || params.query.trim() === '') {
      return {
        success: false,
        error: 'precision_symbols: "query" must be a non-empty string',
        durationMs: Date.now() - startMs,
      };
    }

    let queryRegex: RegExp;
    try {
      queryRegex = new RegExp(params.query, 'i');
    } catch {
      // Treat as literal string if invalid regex
      queryRegex = new RegExp(params.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const mode = params.mode ?? 'workspace';
    const maxResults = params.max_results ?? 100;
    const includeContent = params.include_content !== false;
    const allSymbols: SymbolMatch[] = [];
    let truncated = false;

    if (mode === 'document') {
      // Single-file mode
      if (!params.file) {
        return {
          success: false,
          error: 'precision_symbols: "file" is required when mode=document',
          durationMs: Date.now() - startMs,
        };
      }

      try {
        const content = await fs.readFile(params.file, { encoding: 'utf-8' });
        const fileSymbols = extractSymbolsFromContent(
          content,
          params.file,
          queryRegex,
          params.kinds,
          includeContent
        );
        allSymbols.push(...fileSymbols);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: `precision_symbols: cannot read file '${params.file}': ${message}`,
          durationMs: Date.now() - startMs,
        };
      }
    } else {
      // Workspace mode
      const basePath = path.resolve(params.base_path ?? process.cwd());
      const globPattern = params.glob ?? '**/*.{ts,tsx,js,jsx}';

      const files: string[] = [];
      await collectSourceFiles(basePath, globPattern, files, 10_000);

      for (const file of files) {
        if (allSymbols.length >= maxResults) {
          truncated = true;
          break;
        }

        try {
          const content = await fs.readFile(file, { encoding: 'utf-8' });
          const fileSymbols = extractSymbolsFromContent(
            content,
            file,
            queryRegex,
            params.kinds,
            includeContent
          );
          allSymbols.push(...fileSymbols);
        } catch {
          // Skip unreadable files silently
        }
      }

      if (allSymbols.length > maxResults) {
        allSymbols.splice(maxResults);
        truncated = true;
      }
    }

    return {
      success: true,
      data: {
        symbols: allSymbols,
        count: allSymbols.length,
        truncated,
        durationMs: Date.now() - startMs,
      },
      durationMs: Date.now() - startMs,
    };
  }
}
