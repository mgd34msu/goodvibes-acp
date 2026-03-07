/**
 * @module logs/manager
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * LogsManager — structured log writer for activity, decision, and error logs.
 * Writes human-readable Markdown entries to files in a configurable basePath directory.
 *
 * Uses direct fs (readFile/writeFile/appendFile) for .goodvibes/ runtime log files.
 * This is intentional — log files are runtime-generated artifacts, not editor-managed
 * source files. ITextFileAccess editor buffer awareness is not applicable here
 * (per ACP KB dual-path guidance).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '../../core/event-bus.js';

// ---------------------------------------------------------------------------
// Entry types
// ---------------------------------------------------------------------------

export type ActivityEntry = {
  title: string;
  task: string;
  plan?: string;
  status: 'COMPLETE' | 'PARTIAL' | 'IN_PROGRESS';
  completedItems: string[];
  filesModified: string[];
  reviewScore?: number;
  commit?: string;
};

export type DecisionEntry = {
  title: string;
  context: string;
  options: Array<{ name: string; pros: string; cons: string }>;
  decision: string;
  rationale: string;
  implications: string;
};

export type ErrorEntry = {
  category:
    | 'TOOL_FAILURE'
    | 'AGENT_FAILURE'
    | 'BUILD_ERROR'
    | 'TEST_FAILURE'
    | 'VALIDATION_ERROR'
    | 'EXTERNAL_ERROR'
    | 'UNKNOWN';
  error: string;
  taskContext: string;
  agent?: string;
  files?: string[];
  rootCause: string;
  resolution: string;
  prevention?: string;
  status: 'RESOLVED' | 'UNRESOLVED' | 'WORKAROUND';
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowDateTime(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return `${date} ${time}`;
}

function bulletList(items: string[]): string {
  if (items.length === 0) return '- (none)';
  return items.map((i) => `- ${i}`).join('\n');
}

async function prependEntry(
  filePath: string,
  header: string,
  entry: string,
): Promise<void> {
  // Read existing content (skip the file header line if present).
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    // file may not exist yet; ensureFiles handles creation
  }

  // Normalise: ensure existing content ends with a newline when non-empty
  // so concatenation never produces a run-together line.
  if (existing.length > 0 && !existing.endsWith('\n')) {
    existing += '\n';
  }

  const newBlock = `${entry}\n\n---\n`;

  if (existing === '') {
    // Empty file: write header + first entry.
    await writeFile(filePath, `${header}${newBlock}`, 'utf-8');
  } else if (existing.includes('\n\n')) {
    // Insert after the first blank line (after the file-level header).
    const firstBreak = existing.indexOf('\n\n');
    const before = existing.slice(0, firstBreak + 2);
    const after = existing.slice(firstBreak + 2);
    await writeFile(filePath, `${before}${newBlock}${after}`, 'utf-8');
  } else {
    // File exists but has no blank line separator (unexpected / corrupted);
    // append a separator then the new block rather than silently mangling.
    await writeFile(filePath, `${existing}\n${newBlock}`, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// LogsManager
// ---------------------------------------------------------------------------

export class LogsManager {
  private readonly _basePath: string;
  private readonly _bus: EventBus;

  constructor(basePath: string, eventBus: EventBus) {
    this._basePath = basePath;
    this._bus = eventBus;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async ensureFiles(): Promise<void> {
    await mkdir(this._basePath, { recursive: true });

    const files: Array<{ name: string; header: string }> = [
      { name: 'activity.md', header: '# GoodVibes ACP — Activity Log\n\n' },
      { name: 'decisions.md', header: '# GoodVibes ACP — Decision Log\n\n' },
      { name: 'errors.md', header: '# GoodVibes ACP — Error Log\n\n' },
    ];

    await Promise.all(
      files.map(async ({ name, header }) => {
        const filePath = join(this._basePath, name);
        try {
          await readFile(filePath, 'utf-8');
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
          await writeFile(filePath, header, 'utf-8');
        }
      }),
    );
  }

  async logActivity(entry: ActivityEntry): Promise<void> {
    await this.ensureFiles();
    const filePath = join(this._basePath, 'activity.md');
    const block = this._formatActivity(entry);
    await prependEntry(filePath, '# GoodVibes ACP — Activity Log\n\n', block);
    this._bus.emit('log:activity', { entry });
  }

  async logDecision(entry: DecisionEntry): Promise<void> {
    await this.ensureFiles();
    const filePath = join(this._basePath, 'decisions.md');
    const block = this._formatDecision(entry);
    await prependEntry(filePath, '# GoodVibes ACP — Decision Log\n\n', block);
    this._bus.emit('log:decision', { entry });
  }

  async logError(entry: ErrorEntry): Promise<void> {
    await this.ensureFiles();
    const filePath = join(this._basePath, 'errors.md');
    const block = this._formatError(entry);
    await prependEntry(filePath, '# GoodVibes ACP — Error Log\n\n', block);
    this._bus.emit('log:error', { entry });
  }

  // -------------------------------------------------------------------------
  // Formatting helpers
  // -------------------------------------------------------------------------

  private _formatActivity(e: ActivityEntry): string {
    const lines: string[] = [
      `## ${today()}: ${e.title}`,
      '',
      `**Task**: ${e.task}`,
      `**Plan**: ${e.plan ?? 'N/A'}`,
      `**Status**: ${e.status}`,
      '',
      '**Completed Items**:',
      bulletList(e.completedItems),
      '',
      '**Files Modified**:',
      bulletList(e.filesModified),
    ];

    if (e.reviewScore !== undefined) {
      lines.push('');
      lines.push(`**Review Score**: ${e.reviewScore}/10`);
    }

    if (e.commit) {
      if (e.reviewScore === undefined) lines.push('');
      lines.push(`**Commit**: ${e.commit}`);
    }

    return lines.join('\n');
  }

  private _formatDecision(e: DecisionEntry): string {
    const optionLines = e.options.map((o, idx) => {
      return [
        `${idx + 1}. **${o.name}**`,
        `   - Pros: ${o.pros}`,
        `   - Cons: ${o.cons}`,
      ].join('\n');
    });

    const lines: string[] = [
      `## ${today()}: ${e.title}`,
      '',
      `**Context**: ${e.context}`,
      '',
      '**Options Considered**:',
      optionLines.join('\n'),
      '',
      `**Decision**: ${e.decision}`,
      `**Rationale**: ${e.rationale}`,
      `**Implications**: ${e.implications}`,
    ];

    return lines.join('\n');
  }

  private _formatError(e: ErrorEntry): string {
    const agentLine = e.agent ? `- Agent: ${e.agent}` : '- Agent: N/A';
    const filesLine =
      e.files && e.files.length > 0
        ? `- File(s): ${e.files.join(', ')}`
        : '- File(s): N/A';
    const preventionLine = e.prevention
      ? `**Prevention**: ${e.prevention}`
      : '**Prevention**: N/A';

    const lines: string[] = [
      `## ${nowDateTime()} - ${e.category}`,
      '',
      `**Error**: ${e.error}`,
      '**Context**:',
      `- Task: ${e.taskContext}`,
      agentLine,
      filesLine,
      '',
      `**Root Cause**: ${e.rootCause}`,
      `**Resolution**: ${e.resolution}`,
      preventionLine,
      `**Status**: ${e.status}`,
    ];

    return lines.join('\n');
  }
}
