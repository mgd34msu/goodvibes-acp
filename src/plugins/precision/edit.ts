/**
 * @module plugins/precision/edit
 * @layer L3 — plugin
 *
 * PrecisionEditTool — implements the precision_edit tool.
 *
 * Features:
 *   - Exact string find/replace
 *   - Occurrence modes: first, last, all, or specific number (1-based)
 *   - Atomic transactions: read all files, apply all changes in memory,
 *     write all on success — rollback means simply not writing
 *   - Partial mode: apply successful edits, skip failures
 *   - Batch multiple edits across multiple files in one call
 *
 * All file I/O uses node:fs/promises. No external dependencies.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type {
  PrecisionEditParams,
  PrecisionEditData,
  PrecisionResult,
  EditResult,
  OccurrenceMode,
} from './types.js';

// ---------------------------------------------------------------------------
// String replacement helpers
// ---------------------------------------------------------------------------

/**
 * Apply find/replace to `content` with the given occurrence mode.
 * Returns the modified string and the number of replacements made.
 */
function applyReplacement(
  content: string,
  find: string,
  replace: string,
  occurrence: OccurrenceMode
): { result: string; replacements: number } {
  if (find === '') {
    return { result: content, replacements: 0 };
  }

  if (occurrence === 'all') {
    // Replace all non-overlapping occurrences
    const parts = content.split(find);
    const replacements = parts.length - 1;
    return { result: parts.join(replace), replacements };
  }

  // Collect all occurrence indices
  const indices: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = content.indexOf(find, searchFrom);
    if (idx === -1) break;
    indices.push(idx);
    searchFrom = idx + find.length;
  }

  if (indices.length === 0) {
    return { result: content, replacements: 0 };
  }

  let targetIdx: number;

  if (occurrence === 'first') {
    targetIdx = indices[0]!;
  } else if (occurrence === 'last') {
    targetIdx = indices[indices.length - 1]!;
  } else {
    // Numeric occurrence (1-based)
    const n = occurrence as number;
    if (n < 1 || n > indices.length) {
      return { result: content, replacements: 0 };
    }
    targetIdx = indices[n - 1]!;
  }

  const result =
    content.slice(0, targetIdx) +
    replace +
    content.slice(targetIdx + find.length);

  return { result, replacements: 1 };
}

// ---------------------------------------------------------------------------
// PrecisionEditTool
// ---------------------------------------------------------------------------

export class PrecisionEditTool {
  /**
   * Execute a precision_edit operation.
   *
   * In atomic mode (default):
   *   1. Read all files involved
   *   2. Apply all edits in memory
   *   3. If any edit fails → return error, write nothing
   *   4. If all succeed → write all modified files
   *
   * In partial mode:
   *   - Write files for successful edits; skip failed ones
   */
  async execute(params: PrecisionEditParams): Promise<PrecisionResult<PrecisionEditData>> {
    const startMs = Date.now();

    if (!Array.isArray(params.edits) || params.edits.length === 0) {
      return {
        success: false,
        error: 'precision_edit: "edits" must be a non-empty array',
        durationMs: Date.now() - startMs,
      };
    }

    const transaction = params.transaction ?? 'atomic';
    const editResults: EditResult[] = [];
    let editsApplied = 0;
    let editsFailed = 0;
    let rolledBack = false;

    // -------------------------------------------------------------------------
    // Phase 1: Read all unique files
    // -------------------------------------------------------------------------
    const uniquePaths = [...new Set(params.edits.map((e) => e.path))];
    const fileContents = new Map<string, string>();
    const fileReadErrors = new Map<string, string>();

    for (const filePath of uniquePaths) {
      try {
        const content = await readFile(filePath, { encoding: 'utf-8' });
        fileContents.set(filePath, content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        fileReadErrors.set(filePath, message);
      }
    }

    // -------------------------------------------------------------------------
    // Phase 2: Apply edits in memory
    // -------------------------------------------------------------------------
    // Work on a mutable copy so we can roll back by discarding
    const pendingWrites = new Map<string, string>(fileContents);

    for (const edit of params.edits) {
      const editId =
        edit.id ?? `${edit.path}:${edit.find.slice(0, 40)}`;

      // Check if file was readable
      const readError = fileReadErrors.get(edit.path);
      if (readError !== undefined) {
        editResults.push({
          id: editId,
          path: edit.path,
          success: false,
          replacements: 0,
          error: `Cannot read file: ${readError}`,
        });
        editsFailed++;
        continue;
      }

      const current = pendingWrites.get(edit.path);
      if (current === undefined) {
        editResults.push({
          id: editId,
          path: edit.path,
          success: false,
          replacements: 0,
          error: 'File content not available (internal error)',
        });
        editsFailed++;
        continue;
      }

      const occurrence: OccurrenceMode = edit.occurrence ?? 'first';
      const { result, replacements } = applyReplacement(
        current,
        edit.find,
        edit.replace,
        occurrence
      );

      if (replacements === 0) {
        editResults.push({
          id: editId,
          path: edit.path,
          success: false,
          replacements: 0,
          error: `Find string not found in ${edit.path}: ${JSON.stringify(edit.find.slice(0, 80))}`,
        });
        editsFailed++;
        continue;
      }

      pendingWrites.set(edit.path, result);
      editResults.push({
        id: editId,
        path: edit.path,
        success: true,
        replacements,
      });
      editsApplied++;
    }

    // -------------------------------------------------------------------------
    // Phase 3: Write phase — honour transaction mode
    // -------------------------------------------------------------------------
    if (editsFailed > 0 && transaction === 'atomic') {
      // Rollback: discard all pending writes, return error
      rolledBack = true;
      return {
        success: false,
        data: {
          edits: editResults,
          editsApplied: 0,
          editsFailed,
          rolledBack,
        },
        error: `precision_edit: ${editsFailed} edit(s) failed — atomic transaction rolled back`,
        durationMs: Date.now() - startMs,
      };
    }

    // Determine which files need to be written
    const successfulPaths = new Set(
      editResults.filter((r) => r.success).map((r) => r.path)
    );

    const writeErrors: string[] = [];

    for (const filePath of successfulPaths) {
      const newContent = pendingWrites.get(filePath);
      if (newContent === undefined) continue;

      try {
        await writeFile(filePath, newContent, { encoding: 'utf-8' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeErrors.push(`${filePath}: ${message}`);
        // Mark associated edits as failed
        for (const r of editResults) {
          if (r.path === filePath && r.success) {
            r.success = false;
            r.error = `Write failed: ${message}`;
            editsApplied--;
            editsFailed++;
          }
        }
      }
    }

    const overallSuccess = editsFailed === 0;

    return {
      success: overallSuccess,
      data: {
        edits: editResults,
        editsApplied,
        editsFailed,
        rolledBack: false,
      },
      error:
        writeErrors.length > 0
          ? `precision_edit: write errors: ${writeErrors.join('; ')}`
          : editsFailed > 0
          ? `precision_edit: ${editsFailed} edit(s) failed`
          : undefined,
      durationMs: Date.now() - startMs,
    };
  }
}
