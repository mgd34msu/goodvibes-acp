/**
 * @module plugins/precision/grep
 * @layer L3 — plugin
 *
 * PrecisionGrep — content search across files using line-by-line scanning.
 * Supports regex patterns, glob-based file filtering, multiple output formats,
 * and per-file / total result caps.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { createReadStream } from 'node:fs';
import { matchesGlob } from './glob.js';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** A single grep query */
export type GrepQuery = {
  /** Regex pattern to search for */
  pattern: string;
  /** Optional glob pattern to filter which files are searched */
  glob?: string;
  /** Case-sensitive matching (default: false) */
  case_sensitive?: boolean;
  /** Match whole words only (default: false) */
  whole_word?: boolean;
  /** Return files that do NOT match (default: false) */
  negate?: boolean;
};

/** Output detail level */
export type GrepOutputFormat =
  | 'count_only'
  | 'files_only'
  | 'locations'
  | 'matches'
  | 'context';

/** Parameters for PrecisionGrep.search() */
export type GrepParams = {
  /** Queries to execute (all run against the same file set) */
  queries: GrepQuery[];
  /** Base directory to search from (default: cwd) */
  base_path?: string;
  /** Output detail level (default: 'matches') */
  output_format?: GrepOutputFormat;
  /** Maximum total matches across all files (default: 1000) */
  max_results?: number;
  /** Maximum matches per file (default: 100) */
  max_per_file?: number;
  /** Lines of context around each match (only used with 'context' format) */
  context_lines?: number;
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** A single match within a file */
export type GrepMatch = {
  /** Absolute file path */
  file: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number of match start */
  column: number;
  /** Full content of the matching line */
  content: string;
  /** Lines of context before the match (only present with 'context' format) */
  context_before?: string[];
  /** Lines of context after the match (only present with 'context' format) */
  context_after?: string[];
};

/** Results for a single query */
export type GrepQueryResult = {
  /** The query that produced these results */
  query: GrepQuery;
  /** Total number of matches found (before any caps) */
  total_matches: number;
  /** Number of files containing matches */
  matching_files: number;
  /** Whether the result was truncated by max_results or max_per_file */
  truncated: boolean;
  /** Matched file paths (present for all formats except count_only) */
  files?: string[];
  /** Detailed match objects (present for locations, matches, context formats) */
  matches?: GrepMatch[];
};

/** Overall result from PrecisionGrep.search() */
export type GrepResult = {
  /** Results keyed by query index */
  results: GrepQueryResult[];
  /** Total files scanned */
  files_scanned: number;
  /** Execution time in milliseconds */
  duration_ms: number;
};

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

/**
 * Recursively collect all files under `dir`, skipping common ignored directories.
 * Returns absolute paths.
 */
async function collectFiles(
  dir: string,
  skipDirs = new Set(['node_modules', '.git', 'dist', '.next', '.turbo', 'coverage'])
): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

// ---------------------------------------------------------------------------
// Single-file scanning
// ---------------------------------------------------------------------------

/**
 * Scan a single file for lines matching the compiled regex.
 * Returns raw match data including line content and position.
 */
async function scanFile(
  filePath: string,
  regex: RegExp,
  maxPerFile: number,
  contextLines: number
): Promise<{ matches: GrepMatch[]; truncated: boolean }> {
  const matches: GrepMatch[] = [];
  // Ring buffer for context-before lines
  const buffer: string[] = [];
  // Pending context-after: array of [matchIdx, remaining lines needed]
  const pendingAfter: Array<{ idx: number; remaining: number }> = [];

  let lineNum = 0;
  let truncated = false;

  let stream;
  try {
    stream = createReadStream(filePath, { encoding: 'utf8' });
  } catch {
    return { matches: [], truncated: false };
  }

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineNum++;
    const lineContent = line;

    // Feed pending context_after requests
    for (const pending of pendingAfter) {
      if (pending.remaining > 0) {
        const m = matches[pending.idx];
        if (m && m.context_after !== undefined) {
          m.context_after.push(lineContent);
        }
        pending.remaining--;
      }
    }
    // Clean up exhausted pending entries
    for (let i = pendingAfter.length - 1; i >= 0; i--) {
      if (pendingAfter[i]!.remaining === 0) pendingAfter.splice(i, 1);
    }

    // Test this line
    const match = regex.exec(lineContent);
    if (match !== null) {
      if (matches.length >= maxPerFile) {
        truncated = true;
        break;
      }

      const column = match.index + 1;
      const grepMatch: GrepMatch = {
        file: filePath,
        line: lineNum,
        column,
        content: lineContent,
      };

      if (contextLines > 0) {
        grepMatch.context_before = [...buffer];
        grepMatch.context_after = [];
        pendingAfter.push({ idx: matches.length, remaining: contextLines });
      }

      matches.push(grepMatch);
    }

    // Maintain before-context ring buffer
    if (contextLines > 0) {
      buffer.push(lineContent);
      if (buffer.length > contextLines) buffer.shift();
    }
  }

  // Wait for stream to fully close (avoid resource leaks)
  await new Promise<void>((resolve) => {
    rl.on('close', resolve);
    rl.close();
  });

  return { matches, truncated };
}

// ---------------------------------------------------------------------------
// PrecisionGrep
// ---------------------------------------------------------------------------

/** Content search tool — searches files using regex patterns */
export class PrecisionGrep {
  /**
   * Execute grep queries against the filesystem.
   * Never throws — returns error details in the result.
   */
  async search(params: GrepParams): Promise<GrepResult> {
    const startMs = Date.now();
    const basePath = path.resolve(params.base_path ?? process.cwd());
    const maxResults = params.max_results ?? 1000;
    const maxPerFile = params.max_per_file ?? 100;
    const outputFormat = params.output_format ?? 'matches';
    const contextLines = outputFormat === 'context' ? (params.context_lines ?? 3) : 0;

    // Collect all candidate files once
    let allFiles: string[];
    try {
      allFiles = await collectFiles(basePath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        results: params.queries.map((q) => ({
          query: q,
          total_matches: 0,
          matching_files: 0,
          truncated: false,
          error: `Failed to collect files: ${msg}`,
        })),
        files_scanned: 0,
        duration_ms: Date.now() - startMs,
      };
    }

    // Process each query
    const queryResults: GrepQueryResult[] = [];

    for (const query of params.queries) {
      // Build regex
      let pattern = query.pattern;
      if (query.whole_word) pattern = `\\b(?:${pattern})\\b`;
      const flags = query.case_sensitive ? '' : 'i';

      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        queryResults.push({
          query,
          total_matches: 0,
          matching_files: 0,
          truncated: false,
          files: [],
          matches: [],
        });
        // Log invalid regex and continue
        process.stderr.write(`PrecisionGrep: invalid regex "${query.pattern}": ${msg}\n`);
        continue;
      }

      // Filter files by glob
      const candidateFiles = query.glob
        ? allFiles.filter((f) => matchesGlob(path.relative(basePath, f), query.glob!))
        : allFiles;

      const allMatches: GrepMatch[] = [];
      const matchingFileSet = new Set<string>();
      let totalTruncated = false;
      let totalCount = 0;

      for (const filePath of candidateFiles) {
        if (totalCount >= maxResults) {
          totalTruncated = true;
          break;
        }

        const remaining = maxResults - totalCount;
        const effectiveMax = Math.min(maxPerFile, remaining);

        let scanResult;
        try {
          scanResult = await scanFile(filePath, regex, effectiveMax, contextLines);
        } catch {
          continue;
        }

        if (scanResult.matches.length > 0) {
          // Count total before applying negate logic
          totalCount += scanResult.matches.length;
          if (scanResult.truncated) totalTruncated = true;

          if (!query.negate) {
            matchingFileSet.add(filePath);
            allMatches.push(...scanResult.matches);
          }
        } else if (query.negate) {
          // File has no matches — include it in negate results
          matchingFileSet.add(filePath);
          // For negate mode, we record a file-level pseudo-match
          allMatches.push({
            file: filePath,
            line: 0,
            column: 0,
            content: '',
          });
        }
      }

      const result: GrepQueryResult = {
        query,
        total_matches: query.negate ? matchingFileSet.size : totalCount,
        matching_files: matchingFileSet.size,
        truncated: totalTruncated,
      };

      switch (outputFormat) {
        case 'count_only':
          // No files or matches — just counts
          break;
        case 'files_only':
          result.files = [...matchingFileSet];
          break;
        case 'locations':
          result.files = [...matchingFileSet];
          result.matches = allMatches.map(({ file, line, column }) => ({
            file, line, column, content: '',
          }));
          break;
        case 'matches':
        case 'context':
          result.files = [...matchingFileSet];
          result.matches = allMatches;
          break;
      }

      queryResults.push(result);
    }

    return {
      results: queryResults,
      files_scanned: allFiles.length,
      duration_ms: Date.now() - startMs,
    };
  }
}
