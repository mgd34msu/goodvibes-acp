/**
 * @module plugins/precision/discover
 * @layer L3 — plugin
 *
 * PrecisionDiscover — multi-query discovery combining grep and glob in parallel.
 * Thin orchestration layer over PrecisionGrep and PrecisionGlob.
 */

import { PrecisionGrep } from './grep.js';
import { PrecisionGlob } from './glob.js';
import type { GrepQuery, GrepOutputFormat, GrepQueryResult } from './grep.js';
import type { GlobOutputFormat, GlobResult } from './glob.js';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** A grep-type discovery query */
export type DiscoverGrepQuery = {
  type: 'grep';
  /** Unique identifier for this query — used as result key */
  id: string;
  /** Regex pattern to search for */
  pattern: string;
  /** Optional glob to filter files */
  glob?: string;
  /** Case-sensitive matching (default: false) */
  case_sensitive?: boolean;
  /** Match whole words only (default: false) */
  whole_word?: boolean;
  /** Return files that do NOT match (default: false) */
  negate?: boolean;
  /** Output format for this query (default: 'files_only') */
  output_format?: GrepOutputFormat;
  /** Maximum results for this query (default: 1000) */
  max_results?: number;
  /** Maximum results per file (default: 100) */
  max_per_file?: number;
};

/** A glob-type discovery query */
export type DiscoverGlobQuery = {
  type: 'glob';
  /** Unique identifier for this query — used as result key */
  id: string;
  /** Glob patterns to match */
  patterns: string[];
  /** Glob patterns to exclude */
  exclude?: string[];
  /** Output format for this query (default: 'paths_only') */
  output_format?: GlobOutputFormat;
  /** Maximum results for this query (default: 5000) */
  max_results?: number;
};

/** Union of supported discovery query types */
export type DiscoverQuery = DiscoverGrepQuery | DiscoverGlobQuery;

/** Parameters for PrecisionDiscover.run() */
export type DiscoverParams = {
  /** Queries to execute in parallel */
  queries: DiscoverQuery[];
  /** Base directory for all queries (default: cwd) */
  base_path?: string;
  /** Default output verbosity (overridden by per-query output_format) */
  verbosity?: 'count_only' | 'files_only' | 'locations';
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Result for a single grep query */
export type DiscoverGrepResult = {
  type: 'grep';
  /** The first (and only) query result from the grep execution */
  result: GrepQueryResult;
};

/** Result for a single glob query */
export type DiscoverGlobResult = {
  type: 'glob';
  result: GlobResult;
};

/** Union of possible per-query results */
export type DiscoverQueryResult = DiscoverGrepResult | DiscoverGlobResult;

/** Overall result from PrecisionDiscover.run() */
export type DiscoverResult = {
  /** Results keyed by query ID */
  results: Record<string, DiscoverQueryResult>;
  /** Total number of queries executed */
  total_queries: number;
  /** Number of queries that completed successfully */
  successful: number;
  /** Number of queries that failed */
  failed: number;
  /** Execution time in milliseconds */
  duration_ms: number;
};

// ---------------------------------------------------------------------------
// Verbosity → format mapping
// ---------------------------------------------------------------------------

function verbosityToGrepFormat(
  verbosity: DiscoverParams['verbosity']
): GrepOutputFormat {
  switch (verbosity) {
    case 'count_only': return 'count_only';
    case 'locations': return 'locations';
    case 'files_only':
    default: return 'files_only';
  }
}

function verbosityToGlobFormat(
  verbosity: DiscoverParams['verbosity']
): GlobOutputFormat {
  switch (verbosity) {
    case 'count_only': return 'count_only';
    // locations maps to paths_only for glob (no line numbers)
    case 'locations':
    case 'files_only':
    default: return 'paths_only';
  }
}

// ---------------------------------------------------------------------------
// PrecisionDiscover
// ---------------------------------------------------------------------------

/** Multi-query discovery tool — executes grep and glob queries in parallel */
export class PrecisionDiscover {
  private readonly grep: PrecisionGrep;
  private readonly glob: PrecisionGlob;

  constructor() {
    this.grep = new PrecisionGrep();
    this.glob = new PrecisionGlob();
  }

  /**
   * Execute all queries in parallel and return results keyed by query ID.
   * Never throws — individual query failures are captured in results.
   */
  async run(params: DiscoverParams): Promise<DiscoverResult> {
    const startMs = Date.now();
    const basePath = params.base_path;

    // Dispatch all queries in parallel
    const pending = params.queries.map(async (query) => {
      try {
        if (query.type === 'grep') {
          const grepQuery: GrepQuery = {
            pattern: query.pattern,
            glob: query.glob,
            case_sensitive: query.case_sensitive,
            whole_word: query.whole_word,
            negate: query.negate,
          };

          const outputFormat = query.output_format ??
            verbosityToGrepFormat(params.verbosity);

          const grepResult = await this.grep.search({
            queries: [grepQuery],
            base_path: basePath,
            output_format: outputFormat,
            max_results: query.max_results,
            max_per_file: query.max_per_file,
          });

          const queryResult = grepResult.results[0];
          if (!queryResult) {
            throw new Error('Grep returned no results entry');
          }

          return {
            id: query.id,
            result: { type: 'grep' as const, result: queryResult },
            success: true,
          };
        } else {
          // glob
          const outputFormat = query.output_format ??
            verbosityToGlobFormat(params.verbosity);

          const globResult = await this.glob.match({
            patterns: query.patterns,
            exclude: query.exclude,
            base_path: basePath,
            output_format: outputFormat,
            max_results: query.max_results,
          });

          return {
            id: query.id,
            result: { type: 'glob' as const, result: globResult },
            success: true,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`PrecisionDiscover: query "${query.id}" failed: ${msg}\n`);
        return { id: query.id, result: null, success: false };
      }
    });

    const settled = await Promise.all(pending);

    const resultMap: Record<string, DiscoverQueryResult> = {};
    let successful = 0;
    let failed = 0;

    for (const item of settled) {
      if (item.result !== null) {
        resultMap[item.id] = item.result;
        successful++;
      } else {
        failed++;
      }
    }

    return {
      results: resultMap,
      total_queries: params.queries.length,
      successful,
      failed,
      duration_ms: Date.now() - startMs,
    };
  }
}
