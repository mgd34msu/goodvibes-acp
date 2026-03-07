/**
 * @module plugins/precision/types
 * @layer L3 — plugin
 *
 * Shared parameter and result types for the precision file operation tools.
 * These are the input/output contracts for precision_read, precision_write,
 * and precision_edit tool calls.
 */

// ---------------------------------------------------------------------------
// Extract modes
// ---------------------------------------------------------------------------

/**
 * How to extract content from a file during a read operation.
 *
 * - content: full raw file content
 * - outline: structural overview (signatures, no bodies)
 * - symbols: exported declarations only
 * - ast: abstract syntax tree representation (structural patterns)
 * - lines: specific line range only
 */
export type ExtractMode = 'content' | 'outline' | 'symbols' | 'ast' | 'lines';

/**
 * Write mode controlling behaviour when the target file already exists.
 *
 * - fail_if_exists: return an error without writing (default)
 * - overwrite: replace the file unconditionally
 * - backup: rename the existing file to <name>.bak before writing
 */
export type WriteMode = 'fail_if_exists' | 'overwrite' | 'backup';

/**
 * Which occurrence(s) to replace during an edit operation.
 *
 * - first: replace the first occurrence only (default)
 * - last: replace the last occurrence only
 * - all: replace all occurrences
 * - number: replace the Nth occurrence (1-based)
 */
export type OccurrenceMode = 'first' | 'last' | 'all' | number;

// ---------------------------------------------------------------------------
// Read types
// ---------------------------------------------------------------------------

/** A single file entry in a PrecisionReadParams request */
export type ReadFileEntry = {
  /** Absolute or relative path to the file */
  path: string;
  /** Extract mode override for this file (defaults to parent extractMode) */
  extract?: ExtractMode;
  /** Line range for 'lines' extract mode */
  range?: { start: number; end: number };
};

/** Parameters for a precision_read tool call */
export type PrecisionReadParams = {
  /** Files to read */
  files: ReadFileEntry[];
  /** Default extract mode applied to all files (can be overridden per-file) */
  extractMode?: ExtractMode;
  /** Whether to include line numbers in content output (default: true) */
  includeLineNumbers?: boolean;
};

/** Result for a single file read */
export type FileReadResult = {
  /** Path that was read */
  path: string;
  /** Extracted content (format depends on extract mode) */
  content: string;
  /** Total line count of the file */
  lineCount: number;
  /** File size in bytes */
  sizeBytes: number;
  /** Encoding used to read the file */
  encoding: string;
};

/** Data payload returned by precision_read */
export type PrecisionReadData = {
  /** Per-file results */
  files: FileReadResult[];
  /** Total files successfully read */
  filesRead: number;
  /** Files that failed to read */
  filesFailed: number;
};

// ---------------------------------------------------------------------------
// Write types
// ---------------------------------------------------------------------------

/** A single file entry in a PrecisionWriteParams request */
export type WriteFileEntry = {
  /** Absolute or relative path to write */
  path: string;
  /** Content to write */
  content: string;
  /** Write mode (default: fail_if_exists) */
  mode?: WriteMode;
  /** File encoding (default: utf-8) */
  encoding?: string;
};

/** Parameters for a precision_write tool call */
export type PrecisionWriteParams = {
  /** Files to write */
  files: WriteFileEntry[];
};

/** Result for a single file write */
export type FileWriteResult = {
  /** Path that was written */
  path: string;
  /** Whether this file was written successfully */
  success: boolean;
  /** Bytes written (on success) */
  bytesWritten?: number;
  /** Whether a backup was created */
  backedUp?: boolean;
  /** Backup path (when mode=backup and file existed) */
  backupPath?: string;
  /** Error message (on failure) */
  error?: string;
};

/** Data payload returned by precision_write */
export type PrecisionWriteData = {
  /** Per-file results */
  files: FileWriteResult[];
  /** Total files successfully created or updated */
  filesWritten: number;
  /** Total bytes written across all files */
  bytesWritten: number;
  /** Total files that failed */
  filesFailed: number;
};

// ---------------------------------------------------------------------------
// Edit types
// ---------------------------------------------------------------------------

/** A single edit operation in a PrecisionEditParams request */
export type EditEntry = {
  /** Absolute or relative path to the file to edit */
  path: string;
  /** Exact string to find */
  find: string;
  /** Replacement string */
  replace: string;
  /** Which occurrence(s) to replace (default: first) */
  occurrence?: OccurrenceMode;
  /** Optional identifier for tracking this edit in results */
  id?: string;
};

/** Parameters for a precision_edit tool call */
export type PrecisionEditParams = {
  /** Edit operations to apply */
  edits: EditEntry[];
  /**
   * Transaction mode (default: atomic).
   * - atomic: apply all edits or none (rollback all on any failure)
   * - partial: apply successful edits, skip failures
   */
  transaction?: 'atomic' | 'partial';
};

/** Result for a single edit operation */
export type EditResult = {
  /** Edit id (if provided) or path+find summary */
  id: string;
  /** Path of the file edited */
  path: string;
  /** Whether this edit was applied */
  success: boolean;
  /** Number of occurrences replaced */
  replacements: number;
  /** Error message (on failure) */
  error?: string;
};

/** Data payload returned by precision_edit */
export type PrecisionEditData = {
  /** Per-edit results */
  edits: EditResult[];
  /** Total edits applied */
  editsApplied: number;
  /** Total edits that failed */
  editsFailed: number;
  /** Whether a rollback occurred (only relevant when transaction=atomic) */
  rolledBack: boolean;
};

// ---------------------------------------------------------------------------
// Generic result wrapper
// ---------------------------------------------------------------------------

/**
 * Generic result wrapper for all precision tool calls.
 * Mirrors the ToolResult<T> shape from L0 registry.ts but is typed
 * to the specific data payload for each tool.
 */
export type PrecisionResult<T> = {
  /** Whether the overall operation succeeded */
  success: boolean;
  /** Tool-specific output data */
  data?: T;
  /** Top-level error message (when success is false) */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Additional metadata */
  meta?: Record<string, unknown>;
};
