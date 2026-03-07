/**
 * @module plugins/precision
 * @layer L3 — plugin
 *
 * Precision plugin registration entry point.
 *
 * Registers a single IToolProvider under the 'precision' registry key.
 * The provider exposes 11 tools:
 *   - precision_read     — file reading with extract modes
 *   - precision_write    — file writing with mode control and auto-mkdir
 *   - precision_edit     — find/replace editing with atomic transactions
 *   - precision_grep     — regex content search across files
 *   - precision_glob     — file pattern matching
 *   - precision_exec     — command execution with batch support
 *   - precision_fetch    — HTTP fetching with extract modes
 *   - precision_symbols  — symbol search in workspace or document
 *   - precision_discover — multi-query discovery (grep + glob combined)
 *   - precision_notebook — Jupyter notebook cell operations
 *
 * Usage from L2/L1:
 *   const precision = registry.get<IToolProvider>('precision');
 *   const result = await precision.execute('precision_read', { files: [...] });
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { IToolProvider, ToolDefinition, ToolResult } from '../../types/registry.js';
import type { Registry } from '../../core/registry.js';
import { PrecisionReadTool } from './read.js';
import { PrecisionWriteTool } from './write.js';
import { PrecisionEditTool } from './edit.js';
import { PrecisionGrep } from './grep.js';
import { PrecisionGlob } from './glob.js';
import { PrecisionExec } from './exec.js';
import { PrecisionFetch } from './fetch.js';
import { PrecisionSymbols } from './symbols.js';
import { PrecisionDiscover } from './discover.js';
import { PrecisionNotebook } from './notebook.js';

// ---------------------------------------------------------------------------
// Tool definitions (JSON Schema input contracts)
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'precision_read',
    description:
      'Read one or more files with support for extract modes: content (full text), outline (signatures), symbols (exports only), lines (range). Batch multiple files in one call.',
    inputSchema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          description: 'Files to read',
          items: {
            type: 'object',
            required: ['path'],
            properties: {
              path: { type: 'string', description: 'Absolute or relative file path' },
              extract: {
                type: 'string',
                enum: ['content', 'outline', 'symbols', 'lines'],
                description: 'Extract mode for this file',
              },
              range: {
                type: 'object',
                description: 'Line range for lines extract mode',
                required: ['start', 'end'],
                properties: {
                  start: { type: 'integer', minimum: 1 },
                  end: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        extractMode: {
          type: 'string',
          enum: ['content', 'outline', 'symbols', 'lines'],
          description: 'Default extract mode applied to all files',
        },
        includeLineNumbers: {
          type: 'boolean',
          description: 'Include line numbers in content output (default: true)',
        },
      },
    },
  },
  {
    name: 'precision_write',
    description:
      'Write one or more files with automatic parent directory creation. Supports fail_if_exists, overwrite, and backup modes.',
    inputSchema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          description: 'Files to write',
          items: {
            type: 'object',
            required: ['path', 'content'],
            properties: {
              path: { type: 'string', description: 'Absolute or relative file path' },
              content: { type: 'string', description: 'Content to write' },
              mode: {
                type: 'string',
                enum: ['fail_if_exists', 'overwrite', 'backup'],
                description: 'Write mode (default: fail_if_exists)',
              },
              encoding: { type: 'string', description: 'File encoding (default: utf-8)' },
            },
          },
        },
      },
    },
  },
  {
    name: 'precision_edit',
    description:
      'Find/replace edit one or more files. Supports first/last/all/N occurrence modes and atomic transactions (rollback all on failure).',
    inputSchema: {
      type: 'object',
      required: ['edits'],
      properties: {
        edits: {
          type: 'array',
          description: 'Edit operations to apply',
          items: {
            type: 'object',
            required: ['path', 'find', 'replace'],
            properties: {
              path: { type: 'string', description: 'File path to edit' },
              find: { type: 'string', description: 'Exact string to find' },
              replace: { type: 'string', description: 'Replacement string' },
              occurrence: {
                description: 'Which occurrence to replace: first, last, all, or a number (1-based)',
                oneOf: [
                  { type: 'string', enum: ['first', 'last', 'all'] },
                  { type: 'integer', minimum: 1 },
                ],
              },
              id: { type: 'string', description: 'Optional identifier for this edit' },
            },
          },
        },
        transaction: {
          type: 'string',
          enum: ['atomic', 'partial'],
          description: 'Transaction mode: atomic (rollback all on failure) or partial (default: atomic)',
        },
      },
    },
  },
  {
    name: 'precision_grep',
    description:
      'Search file content with regex. Supports batch queries, output formats (count_only/files_only/locations/matches/context), and per-file caps.',
    inputSchema: {
      type: 'object',
      required: ['queries'],
      properties: {
        queries: {
          type: 'array',
          description: 'Search queries',
          items: {
            type: 'object',
            required: ['pattern'],
            properties: {
              pattern: { type: 'string', description: 'Regex pattern to search for' },
              glob: { type: 'string', description: 'File glob pattern to restrict search' },
              case_sensitive: { type: 'boolean', description: 'Case-sensitive (default: false)' },
              whole_word: { type: 'boolean', description: 'Match whole words only' },
              negate: { type: 'boolean', description: 'Return files that do NOT match' },
            },
          },
        },
        output_format: {
          type: 'string',
          enum: ['count_only', 'files_only', 'locations', 'matches', 'context'],
          description: 'Output detail level (default: matches)',
        },
        base_path: { type: 'string', description: 'Base directory (default: cwd)' },
        max_results: { type: 'integer', description: 'Max files per query (default: 1000)' },
        max_per_file: { type: 'integer', description: 'Max matches per file (default: 100)' },
        context_lines: { type: 'integer', description: 'Context lines for context format (default: 3)' },
      },
    },
  },
  {
    name: 'precision_glob',
    description:
      'Match files by glob pattern with optional size/date filters. Output formats: count_only, paths_only, with_stats.',
    inputSchema: {
      type: 'object',
      required: ['patterns'],
      properties: {
        patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Glob patterns to match',
        },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude',
        },
        output_format: {
          type: 'string',
          enum: ['count_only', 'paths_only', 'with_stats'],
          description: 'Output detail level (default: paths_only)',
        },
        base_path: { type: 'string', description: 'Base directory (default: cwd)' },
        max_results: { type: 'integer', description: 'Max results (default: 5000)' },
        min_size_bytes: { type: 'integer', description: 'Min file size filter' },
        max_size_bytes: { type: 'integer', description: 'Max file size filter' },
        modified_after: { type: 'string', description: 'ISO date: only files modified after' },
        modified_before: { type: 'string', description: 'ISO date: only files modified before' },
      },
    },
  },
  {
    name: 'precision_exec',
    description:
      'Execute shell commands with batch support, timeout, retry, and expectations checking. Returns stdout, stderr, exit code.',
    inputSchema: {
      type: 'object',
      required: ['commands'],
      properties: {
        commands: {
          type: 'array',
          description: 'Commands to execute',
          items: {
            type: 'object',
            required: ['cmd'],
            properties: {
              cmd: { type: 'string', description: 'Command string to execute' },
              cwd: { type: 'string', description: 'Working directory override' },
              timeout_ms: { type: 'integer', description: 'Per-command timeout in ms' },
              env: { type: 'object', description: 'Environment variable overrides' },
              background: { type: 'boolean', description: 'Run in background (detached)' },
              retry: {
                type: 'object',
                description: 'Retry configuration',
                properties: {
                  max: { type: 'integer', description: 'Max retry attempts (default: 3)' },
                  delay_ms: { type: 'integer', description: 'Base delay between retries' },
                },
              },
              expect: {
                type: 'object',
                description: 'Expectations to verify',
                properties: {
                  exit_code: { type: 'integer', description: 'Expected exit code' },
                  stdout_contains: { type: 'string', description: 'String stdout must contain' },
                  stderr_contains: { type: 'string', description: 'String stderr must contain' },
                },
              },
            },
          },
        },
        working_dir: { type: 'string', description: 'Global working directory' },
        timeout_ms: { type: 'integer', description: 'Global timeout in ms (default: 120000)' },
        fail_fast: { type: 'boolean', description: 'Stop on first error (default: true)' },
        parallel: { type: 'boolean', description: 'Run commands in parallel (default: false)' },
      },
    },
  },
  {
    name: 'precision_fetch',
    description:
      'Fetch one or more URLs in parallel with extract modes: raw, text, json, markdown. Supports custom headers and timeout.',
    inputSchema: {
      type: 'object',
      required: ['urls'],
      properties: {
        urls: {
          type: 'array',
          description: 'URLs to fetch',
          items: {
            type: 'object',
            required: ['url'],
            properties: {
              url: { type: 'string', description: 'URL to fetch' },
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
                description: 'HTTP method (default: GET)',
              },
              body: { type: 'string', description: 'Request body for POST/PUT/PATCH' },
              extract: {
                type: 'string',
                enum: ['raw', 'text', 'json', 'markdown'],
                description: 'Extract mode override for this URL',
              },
              headers: { type: 'object', description: 'Per-URL headers' },
            },
          },
        },
        extract: {
          type: 'string',
          enum: ['raw', 'text', 'json', 'markdown'],
          description: 'Default extract mode (default: text)',
        },
        headers: { type: 'object', description: 'Global headers applied to all requests' },
        timeout_ms: { type: 'integer', description: 'Request timeout in ms (default: 30000)' },
      },
    },
  },
  {
    name: 'precision_symbols',
    description:
      'Search for TypeScript/JavaScript symbols (functions, classes, interfaces, types, enums, constants) across workspace or in a single file.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: 'Symbol name or regex pattern to search for' },
        mode: {
          type: 'string',
          enum: ['workspace', 'document'],
          description: 'Search mode (default: workspace)',
        },
        file: { type: 'string', description: 'File path for document mode' },
        glob: { type: 'string', description: 'Glob pattern for workspace mode' },
        kinds: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['function', 'class', 'interface', 'type', 'enum', 'variable', 'constant'],
          },
          description: 'Filter by symbol kind(s)',
        },
        base_path: { type: 'string', description: 'Base directory (default: cwd)' },
        max_results: { type: 'integer', description: 'Max results (default: 100)' },
        include_content: { type: 'boolean', description: 'Include source line content (default: true)' },
      },
    },
  },
  {
    name: 'precision_discover',
    description:
      'Multi-query discovery combining grep and glob. Executes all queries in parallel and returns results keyed by query ID.',
    inputSchema: {
      type: 'object',
      required: ['queries'],
      properties: {
        queries: {
          type: 'array',
          description: 'Queries to execute',
          items: {
            type: 'object',
            required: ['id', 'type'],
            properties: {
              id: { type: 'string', description: 'Unique query ID' },
              type: {
                type: 'string',
                enum: ['grep', 'glob'],
                description: 'Query type',
              },
              pattern: { type: 'string', description: 'Regex pattern (for grep)' },
              patterns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Glob patterns (for glob)',
              },
              glob: { type: 'string', description: 'File filter (for grep)' },
              case_sensitive: { type: 'boolean', description: 'Case-sensitive match' },
            },
          },
        },
        base_path: { type: 'string', description: 'Base directory (default: cwd)' },
        verbosity: {
          type: 'string',
          enum: ['count_only', 'files_only', 'locations'],
          description: 'Output verbosity (default: files_only)',
        },
      },
    },
  },
  {
    name: 'precision_notebook',
    description:
      'Jupyter notebook (.ipynb) cell operations: read, replace, insert, delete, append.',
    inputSchema: {
      type: 'object',
      required: ['path', 'operation'],
      properties: {
        path: { type: 'string', description: 'Path to the .ipynb file' },
        operation: {
          type: 'string',
          enum: ['read', 'replace', 'insert', 'delete', 'append'],
          description: 'Operation to perform',
        },
        cell_index: {
          type: 'integer',
          description: 'Cell index (0-based) — required for replace, insert, delete',
        },
        content: { type: 'string', description: 'New cell content — required for replace, insert, append' },
        cell_type: {
          type: 'string',
          enum: ['code', 'markdown', 'raw'],
          description: 'Cell type for new cells (default: code)',
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// PrecisionToolProvider
// ---------------------------------------------------------------------------

/**
 * IToolProvider implementation that routes tool calls to the appropriate handler.
 * Registered under the 'precision' key in the L1 Registry.
 */
class PrecisionToolProvider implements IToolProvider {
  readonly name = 'precision';
  readonly tools: ToolDefinition[] = TOOL_DEFINITIONS;

  // Handler instances
  private readonly _read = new PrecisionReadTool();
  private readonly _write = new PrecisionWriteTool();
  private readonly _edit = new PrecisionEditTool();
  private readonly _grep = new PrecisionGrep();
  private readonly _glob = new PrecisionGlob();
  private readonly _exec = new PrecisionExec();
  private readonly _fetch = new PrecisionFetch();
  private readonly _symbols = new PrecisionSymbols();
  private readonly _discover = new PrecisionDiscover();
  private readonly _notebook = new PrecisionNotebook();

  async execute<T = unknown>(toolName: string, params: unknown): Promise<ToolResult<T>> {
    const startMs = Date.now();

    try {
      switch (toolName) {
        case 'precision_read': {
          const result = await this._read.execute(
            params as Parameters<PrecisionReadTool['execute']>[0]
          );
          return { success: result.success, data: result.data as T, error: result.error, durationMs: result.durationMs };
        }

        case 'precision_write': {
          const result = await this._write.execute(
            params as Parameters<PrecisionWriteTool['execute']>[0]
          );
          return { success: result.success, data: result.data as T, error: result.error, durationMs: result.durationMs };
        }

        case 'precision_edit': {
          const result = await this._edit.execute(
            params as Parameters<PrecisionEditTool['execute']>[0]
          );
          return { success: result.success, data: result.data as T, error: result.error, durationMs: result.durationMs };
        }

        case 'precision_grep': {
          const result = await this._grep.search(params as Parameters<PrecisionGrep['search']>[0]);
          return {
            success: true,
            data: result as T,
            durationMs: result.duration_ms,
          };
        }

        case 'precision_glob': {
          const result = await this._glob.match(params as Parameters<PrecisionGlob['match']>[0]);
          return {
            success: true,
            data: result as T,
            durationMs: result.duration_ms,
          };
        }

        case 'precision_exec': {
          const result = await this._exec.run(params as Parameters<PrecisionExec['run']>[0]);
          return {
            success: result.all_passed,
            data: result as T,
            error: result.all_passed ? undefined : 'precision_exec: one or more commands failed',
            durationMs: result.duration_ms,
          };
        }

        case 'precision_fetch': {
          const result = await this._fetch.fetch(params as Parameters<PrecisionFetch['fetch']>[0]);
          return { success: result.success, data: result.data as T, error: result.error, durationMs: result.durationMs };
        }

        case 'precision_symbols': {
          const result = await this._symbols.search(
            params as Parameters<PrecisionSymbols['search']>[0]
          );
          return { success: result.success, data: result.data as T, error: result.error, durationMs: result.durationMs };
        }

        case 'precision_discover': {
          const result = await this._discover.run(
            params as Parameters<PrecisionDiscover['run']>[0]
          );
          return {
            success: true,
            data: result as T,
            durationMs: result.duration_ms,
          };
        }

        case 'precision_notebook': {
          const result = await this._notebook.execute(
            params as Parameters<PrecisionNotebook['execute']>[0]
          );
          return { success: result.success, data: result.data as T, error: result.error, durationMs: result.durationMs };
        }

        default:
          return {
            success: false,
            error: `precision: unknown tool '${toolName}'. Available: ${TOOL_DEFINITIONS.map((t) => t.name).join(', ')}`,
            durationMs: Date.now() - startMs,
          };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `precision: unhandled error in '${toolName}': ${message}`,
        durationMs: Date.now() - startMs,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

export { PrecisionToolProvider };
export { PrecisionReadTool } from './read.js';
export { PrecisionWriteTool } from './write.js';
export { PrecisionEditTool } from './edit.js';
export { PrecisionGrep } from './grep.js';
export { PrecisionGlob } from './glob.js';
export { PrecisionExec } from './exec.js';
export { PrecisionFetch } from './fetch.js';
export { PrecisionSymbols } from './symbols.js';
export { PrecisionDiscover } from './discover.js';
export { PrecisionNotebook } from './notebook.js';
export type {
  PrecisionReadParams,
  PrecisionWriteParams,
  PrecisionEditParams,
  PrecisionResult,
  ExtractMode,
  WriteMode,
  OccurrenceMode,
  FileReadResult,
  FileWriteResult,
  EditResult,
  PrecisionReadData,
  PrecisionWriteData,
  PrecisionEditData,
} from './types.js';
export type {
  GrepQuery,
  GrepParams,
  GrepOutputFormat,
  GrepMatch,
  GrepQueryResult,
  GrepResult,
} from './grep.js';
export type {
  GlobParams,
  GlobOutputFormat,
  GlobFileStats,
  GlobResult,
} from './glob.js';
export type {
  CommandSpec,
  CommandExpect,
  ExecParams,
  CommandResult,
  ExecResult,
} from './exec.js';
export type {
  FetchParams,
  FetchUrlEntry,
  FetchExtractMode,
  FetchUrlResult,
  FetchResult,
} from './fetch.js';
export type {
  SymbolsParams,
  SymbolKind,
  SymbolMatch,
  SymbolsResult,
} from './symbols.js';
export type {
  DiscoverParams,
  DiscoverQuery,
  DiscoverGrepQuery,
  DiscoverGlobQuery,
  DiscoverResult,
  DiscoverQueryResult,
  DiscoverGrepResult,
  DiscoverGlobResult,
} from './discover.js';
export type {
  NotebookParams,
  NotebookOperation,
  NotebookCellType,
  NotebookCellSummary,
  NotebookResult,
} from './notebook.js';

/** Precision plugin registration object */
export const PrecisionPlugin: PluginRegistration = {
  manifest: {
    name: 'precision',
    version: '0.1.0',
    description: 'Precision engine: file operations, search, exec, fetch, symbols, notebook tools',
    layer: 'L3',
    dependencies: [],
    capabilities: ['tools', 'file-access'],
  },
  register: (registry: unknown) => {
    (registry as Registry).register('precision', new PrecisionToolProvider());
  },
  shutdown: async () => {},
};
