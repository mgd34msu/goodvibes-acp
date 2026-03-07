/**
 * @module plugins/precision/glob
 * @layer L3 - plugin
 *
 * PrecisionGlob - file pattern matching with .gitignore support.
 * Recursive directory traversal using node:fs/promises.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** Output detail level */
export type GlobOutputFormat = 'count_only' | 'paths_only' | 'with_stats';

/** Parameters for PrecisionGlob.match() */
export type GlobParams = {
  /** Glob patterns to include, e.g. ["src/**\/**.ts"] */
  patterns: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Base directory for pattern matching (default: cwd) */
  base_path?: string;
  /** Output detail level (default: paths_only) */
  output_format?: GlobOutputFormat;
  /** Minimum file size in bytes */
  min_size?: number;
  /** Maximum file size in bytes */
  max_size?: number;
  /** Include only files modified after this ISO timestamp */
  modified_after?: string;
  /** Include only files modified before this ISO timestamp */
  modified_before?: string;
  /** Maximum number of results (default: 5000) */
  max_results?: number;
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Stats for a single matched file */
export type GlobFileStats = {
  /** Absolute file path */
  path: string;
  /** File size in bytes */
  size_bytes: number;
  /** Last modified timestamp (ISO string) */
  modified_at: string;
};

/** Result from PrecisionGlob.match() */
export type GlobResult = {
  /** Total number of matched files */
  count: number;
  /** Whether result was truncated by max_results */
  truncated: boolean;
  /** File paths (present for paths_only and with_stats formats) */
  files?: string[];
  /** File stats (present for with_stats format only) */
  stats?: GlobFileStats[];
  /** Execution time in milliseconds */
  duration_ms: number;
};

// ---------------------------------------------------------------------------
// Glob pattern matching
// ---------------------------------------------------------------------------

/**
 * Escape a string for use as a literal RegExp substring.
 */
function escapeRegex(s: string): string {
  return s.replace(/[\\^$.*+?()\[\]{}|]/g, '\\$&');
}

/**
 * Convert a glob pattern to a RegExp.
 *
 * Supports:
 *   double-star - match any number of path segments
 *   single-star - match any characters within a single segment
 *   ?    - match a single character
 *   {a,b} - alternation
 *   [abc] - character class
 */
export function globToRegex(pattern: string): RegExp {
  // Normalise separators
  const normalised = pattern.replace(/\\/g, '/');

  let regexStr = '';
  let i = 0;
  while (i < normalised.length) {
    const ch = normalised[i] as string;

    if (ch === '*') {
      if (normalised[i + 1] === '*') {
        // double-star: matches any path (including slashes)
        regexStr += '.*';
        i += 2;
        // Skip optional trailing slash
        if (normalised[i] === '/') i++;
      } else {
        // single-star: matches anything except slash
        regexStr += '[^/]*';
        i++;
      }
    } else if (ch === '?') {
      regexStr += '[^/]';
      i++;
    } else if (ch === '{') {
      // {a,b,c} alternation
      const closeIdx = normalised.indexOf('}', i);
      if (closeIdx === -1) {
        regexStr += escapeRegex('{');
        i++;
      } else {
        const alternatives = normalised
          .slice(i + 1, closeIdx)
          .split(',')
          .map((alt) => escapeRegex(alt))
          .join('|');
        regexStr += `(?:${alternatives})`;
        i = closeIdx + 1;
      }
    } else if (ch === '[') {
      // Character class - pass through as-is until ]
      const closeIdx = normalised.indexOf(']', i);
      if (closeIdx === -1) {
        regexStr += escapeRegex('[');
        i++;
      } else {
        regexStr += normalised.slice(i, closeIdx + 1);
        i = closeIdx + 1;
      }
    } else if (isRegexSpecial(ch)) {
      regexStr += '\\' + ch;
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/** Returns true if the character needs escaping in a regex literal */
function isRegexSpecial(ch: string): boolean {
  return (
    ch === '.' || ch === '+' || ch === '^' || ch === '$' ||
    ch === '(' || ch === ')' || ch === '|' || ch === '\\'
  );
}

/**
 * Returns true if filePath (relative, forward-slash separated) matches pattern.
 * If pattern has no slash, it is matched against the basename only.
 */
export function matchesGlob(filePath: string, pattern: string): boolean {
  const normalised = filePath.replace(/\\/g, '/');
  // Patterns without directory separators match against basename only
  if (!pattern.includes('/') && !pattern.startsWith('**')) {
    const base = normalised.split('/').pop() ?? normalised;
    return globToRegex(pattern).test(base);
  }
  return globToRegex(pattern).test(normalised);
}

// ---------------------------------------------------------------------------
// .gitignore parsing
// ---------------------------------------------------------------------------

/**
 * Parse a .gitignore file and return a list of patterns.
 * Ignores blank lines and comments.
 */
async function readGitignorePatterns(gitignorePath: string): Promise<string[]> {
  let content: string;
  try {
    content = await fs.readFile(gitignorePath, 'utf8');
  } catch {
    return [];
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Returns true if relativePath is ignored by any of the given gitignore patterns.
 */
function isGitignored(relativePath: string, patterns: string[]): boolean {
  const normalised = relativePath.replace(/\\/g, '/');
  for (const pattern of patterns) {
    const stripped = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    const negated = pattern.startsWith('!');
    const matched =
      matchesGlob(normalised, stripped) ||
      matchesGlob(normalised, stripped.replace(/^\/+/, ''));
    if (matched && !negated) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Recursive directory walker
// ---------------------------------------------------------------------------

const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
]);

async function walkDirectory(
  dir: string,
  basePath: string,
  gitignorePatterns: string[],
  includeRegexes: RegExp[],
  excludeRegexes: RegExp[],
  filters: {
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: Date;
    modifiedBefore?: Date;
  },
  maxResults: number,
  results: Array<{ path: string; size_bytes: number; modified_at: string }>
): Promise<boolean> {
  // Return true if truncated
  if (results.length >= maxResults) return true;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return true;

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    // Check gitignore
    if (isGitignored(relativePath, gitignorePatterns)) continue;

    if (entry.isDirectory()) {
      if (DEFAULT_SKIP_DIRS.has(entry.name)) continue;
      const truncated = await walkDirectory(
        fullPath,
        basePath,
        gitignorePatterns,
        includeRegexes,
        excludeRegexes,
        filters,
        maxResults,
        results
      );
      if (truncated) return true;
    } else if (entry.isFile()) {
      // Check include patterns
      const matchesInclude =
        includeRegexes.length === 0 ||
        includeRegexes.some((rx) => rx.test(relativePath));
      if (!matchesInclude) continue;

      // Check exclude patterns
      const matchesExclude = excludeRegexes.some((rx) => rx.test(relativePath));
      if (matchesExclude) continue;

      // Apply stat-based filters
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (filters.minSize !== undefined && stat.size < filters.minSize) continue;
      if (filters.maxSize !== undefined && stat.size > filters.maxSize) continue;
      if (filters.modifiedAfter !== undefined && stat.mtime < filters.modifiedAfter) continue;
      if (filters.modifiedBefore !== undefined && stat.mtime > filters.modifiedBefore) continue;

      results.push({
        path: fullPath,
        size_bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
      });
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// PrecisionGlob
// ---------------------------------------------------------------------------

/** File pattern matching tool */
export class PrecisionGlob {
  /**
   * Match files against glob patterns.
   * Never throws - returns empty results on error.
   */
  async match(params: GlobParams): Promise<GlobResult> {
    const startMs = Date.now();
    const basePath = path.resolve(params.base_path ?? process.cwd());
    const outputFormat = params.output_format ?? 'paths_only';
    const maxResults = params.max_results ?? 5000;

    // Build include/exclude regex matchers
    const includeRegexes = params.patterns.map((p) => globToRegex(p));
    const excludeRegexes = (params.exclude ?? []).map((p) => globToRegex(p));

    // Parse date filters
    const modifiedAfter = params.modified_after
      ? new Date(params.modified_after)
      : undefined;
    const modifiedBefore = params.modified_before
      ? new Date(params.modified_before)
      : undefined;

    // Load .gitignore
    const gitignorePath = path.join(basePath, '.gitignore');
    const gitignorePatterns = await readGitignorePatterns(gitignorePath);

    const rawResults: Array<{
      path: string;
      size_bytes: number;
      modified_at: string;
    }> = [];
    let truncated = false;

    try {
      truncated = await walkDirectory(
        basePath,
        basePath,
        gitignorePatterns,
        includeRegexes,
        excludeRegexes,
        {
          minSize: params.min_size,
          maxSize: params.max_size,
          modifiedAfter,
          modifiedBefore,
        },
        maxResults,
        rawResults
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`PrecisionGlob: walk error: ${msg}\n`);
    }

    const result: GlobResult = {
      count: rawResults.length,
      truncated,
      duration_ms: Date.now() - startMs,
    };

    switch (outputFormat) {
      case 'count_only':
        break;
      case 'paths_only':
        result.files = rawResults.map((r) => r.path);
        break;
      case 'with_stats':
        result.files = rawResults.map((r) => r.path);
        result.stats = rawResults;
        break;
    }

    return result;
  }
}
