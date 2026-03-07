/**
 * @module plugins/precision/notebook
 * @layer L3 — plugin
 *
 * PrecisionNotebook — Jupyter notebook (.ipynb) cell operations.
 *
 * Supports:
 *   - read: get cell content by index or all cells
 *   - replace: replace a cell's source content by index
 *   - insert: insert a new cell at a given index
 *   - delete: remove a cell by index
 *   - append: add a new cell at the end
 *
 * All file I/O uses node:fs/promises. No external dependencies.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type { ToolResult } from '../../types/registry.js';

// ---------------------------------------------------------------------------
// Jupyter notebook types (minimal subset we care about)
// ---------------------------------------------------------------------------

interface JupyterCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  metadata?: Record<string, unknown>;
  outputs?: unknown[];
  execution_count?: number | null;
}

interface JupyterNotebook {
  nbformat: number;
  nbformat_minor: number;
  metadata?: Record<string, unknown>;
  cells: JupyterCell[];
}

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** Operation to perform on the notebook */
export type NotebookOperation = 'read' | 'replace' | 'insert' | 'delete' | 'append';

/** Cell type for new cells */
export type NotebookCellType = 'code' | 'markdown' | 'raw';

/** Parameters for PrecisionNotebook.execute() */
export type NotebookParams = {
  /** Path to the .ipynb file */
  path: string;
  /** Operation to perform */
  operation: NotebookOperation;
  /** Cell index (0-based) — required for replace, insert, delete */
  cell_index?: number;
  /** New cell content (source) — required for replace, insert, append */
  content?: string;
  /** Cell type for new cells (default: code) */
  cell_type?: NotebookCellType;
};

/** A cell summary in read results */
export type NotebookCellSummary = {
  /** Cell index (0-based) */
  index: number;
  /** Cell type */
  cell_type: NotebookCellType;
  /** Cell source content */
  source: string;
  /** Number of outputs (for code cells) */
  output_count: number;
};

/** Data payload returned by precision_notebook */
export type NotebookResult = {
  /** Path of the notebook that was operated on */
  path: string;
  /** Operation that was performed */
  operation: NotebookOperation;
  /** Cells returned for read operations */
  cells?: NotebookCellSummary[];
  /** Total cell count after operation */
  cell_count: number;
  /** Index of cell affected (for insert/replace/delete/append) */
  affected_index?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize cell source to a single string */
function normalizeSource(source: string | string[]): string {
  if (Array.isArray(source)) return source.join('');
  return source;
}

/** Convert a source string to the notebook array format */
function sourceToLines(source: string): string[] {
  const lines = source.split('\n');
  return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line));
}

/** Build a cell summary from a JupyterCell */
function toSummary(cell: JupyterCell, index: number): NotebookCellSummary {
  return {
    index,
    cell_type: cell.cell_type as NotebookCellType,
    source: normalizeSource(cell.source),
    output_count: Array.isArray(cell.outputs) ? cell.outputs.length : 0,
  };
}

/** Create a new cell */
function makeCell(content: string, cellType: NotebookCellType): JupyterCell {
  const base: JupyterCell = {
    cell_type: cellType,
    source: sourceToLines(content),
    metadata: {},
  };
  if (cellType === 'code') {
    base.outputs = [];
    base.execution_count = null;
  }
  return base;
}

// ---------------------------------------------------------------------------
// PrecisionNotebook
// ---------------------------------------------------------------------------

export class PrecisionNotebook {
  /**
   * Execute a notebook operation.
   * Never throws — errors are returned in the ToolResult envelope.
   */
  async execute(params: NotebookParams): Promise<ToolResult<NotebookResult>> {
    const startMs = Date.now();

    if (!params.path) {
      return {
        success: false,
        error: 'precision_notebook: "path" is required',
        durationMs: Date.now() - startMs,
      };
    }

    // Read the notebook
    let notebook: JupyterNotebook;
    try {
      const raw = await readFile(params.path, { encoding: 'utf-8' });
      notebook = JSON.parse(raw) as JupyterNotebook;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `precision_notebook: cannot read notebook '${params.path}': ${message}`,
        durationMs: Date.now() - startMs,
      };
    }

    if (!Array.isArray(notebook.cells)) {
      return {
        success: false,
        error: `precision_notebook: notebook '${params.path}' has no cells array`,
        durationMs: Date.now() - startMs,
      };
    }

    const op = params.operation;

    switch (op) {
      case 'read': {
        const cells = notebook.cells.map((cell, i) => toSummary(cell, i));
        return {
          success: true,
          data: {
            path: params.path,
            operation: op,
            cells,
            cell_count: cells.length,
          },
          durationMs: Date.now() - startMs,
        };
      }

      case 'replace': {
        const idx = params.cell_index;
        if (idx === undefined || idx === null) {
          return {
            success: false,
            error: 'precision_notebook: "cell_index" is required for replace',
            durationMs: Date.now() - startMs,
          };
        }
        if (idx < 0 || idx >= notebook.cells.length) {
          return {
            success: false,
            error: `precision_notebook: cell_index ${idx} out of range (0–${notebook.cells.length - 1})`,
            durationMs: Date.now() - startMs,
          };
        }
        if (params.content === undefined) {
          return {
            success: false,
            error: 'precision_notebook: "content" is required for replace',
            durationMs: Date.now() - startMs,
          };
        }
        const existing = notebook.cells[idx]!;
        existing.source = sourceToLines(params.content);
        if (existing.cell_type === 'code') {
          existing.outputs = [];
          existing.execution_count = null;
        }
        await writeFile(params.path, JSON.stringify(notebook, null, 1), { encoding: 'utf-8' });
        return {
          success: true,
          data: {
            path: params.path,
            operation: op,
            cell_count: notebook.cells.length,
            affected_index: idx,
          },
          durationMs: Date.now() - startMs,
        };
      }

      case 'insert': {
        const idx = params.cell_index;
        if (idx === undefined || idx === null) {
          return {
            success: false,
            error: 'precision_notebook: "cell_index" is required for insert',
            durationMs: Date.now() - startMs,
          };
        }
        if (params.content === undefined) {
          return {
            success: false,
            error: 'precision_notebook: "content" is required for insert',
            durationMs: Date.now() - startMs,
          };
        }
        const clampedIdx = Math.max(0, Math.min(idx, notebook.cells.length));
        const newCell = makeCell(params.content, params.cell_type ?? 'code');
        notebook.cells.splice(clampedIdx, 0, newCell);
        await writeFile(params.path, JSON.stringify(notebook, null, 1), { encoding: 'utf-8' });
        return {
          success: true,
          data: {
            path: params.path,
            operation: op,
            cell_count: notebook.cells.length,
            affected_index: clampedIdx,
          },
          durationMs: Date.now() - startMs,
        };
      }

      case 'delete': {
        const idx = params.cell_index;
        if (idx === undefined || idx === null) {
          return {
            success: false,
            error: 'precision_notebook: "cell_index" is required for delete',
            durationMs: Date.now() - startMs,
          };
        }
        if (idx < 0 || idx >= notebook.cells.length) {
          return {
            success: false,
            error: `precision_notebook: cell_index ${idx} out of range (0–${notebook.cells.length - 1})`,
            durationMs: Date.now() - startMs,
          };
        }
        notebook.cells.splice(idx, 1);
        await writeFile(params.path, JSON.stringify(notebook, null, 1), { encoding: 'utf-8' });
        return {
          success: true,
          data: {
            path: params.path,
            operation: op,
            cell_count: notebook.cells.length,
            affected_index: idx,
          },
          durationMs: Date.now() - startMs,
        };
      }

      case 'append': {
        if (params.content === undefined) {
          return {
            success: false,
            error: 'precision_notebook: "content" is required for append',
            durationMs: Date.now() - startMs,
          };
        }
        const newCell = makeCell(params.content, params.cell_type ?? 'code');
        notebook.cells.push(newCell);
        const appendedIdx = notebook.cells.length - 1;
        await writeFile(params.path, JSON.stringify(notebook, null, 1), { encoding: 'utf-8' });
        return {
          success: true,
          data: {
            path: params.path,
            operation: op,
            cell_count: notebook.cells.length,
            affected_index: appendedIdx,
          },
          durationMs: Date.now() - startMs,
        };
      }

      default: {
        const _exhaustive: never = op;
        return {
          success: false,
          error: `precision_notebook: unknown operation '${String(_exhaustive)}'`,
          durationMs: Date.now() - startMs,
        };
      }
    }
  }
}
