/**
 * @module plugins/agents/dossier
 * @layer L3 — plugin
 *
 * Dossier builder — assembles project context for agent injection.
 *
 * Reads GOODVIBES.md (project instruction file), .goodvibes/memory/ summaries,
 * and a compact project structure tree, then assembles them into a single
 * markdown string to prepend to agent system prompts.
 *
 * Pure async function — no side effects beyond file reads.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DossierOptions {
  /** Working directory of the session (project root) */
  cwd: string;
  /** Agent type for role-specific sections */
  agentType: string;
  /** Max tokens budget for the dossier (to prevent context overflow). Default: 4000 */
  maxTokens?: number;
}

export interface Dossier {
  /** The assembled markdown content to inject */
  content: string;
  /** Sources that contributed to this dossier */
  sources: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate chars per token for budget estimation */
const CHARS_PER_TOKEN = 4;

/** Default max token budget */
const DEFAULT_MAX_TOKENS = 4000;

/** Max failures to include from memory */
const MAX_FAILURES = 5;

/** Max depth for project structure tree */
const MAX_TREE_DEPTH = 3;

// ---------------------------------------------------------------------------
// Memory JSON shapes
// ---------------------------------------------------------------------------

interface MemoryPattern {
  name?: string;
  description?: string;
  when_to_use?: string;
  [key: string]: unknown;
}

interface MemoryDecision {
  what?: string;
  why?: string;
  category?: string;
  status?: string;
  [key: string]: unknown;
}

interface MemoryFailure {
  description?: string;
  root_cause?: string;
  resolution?: string;
  [key: string]: unknown;
}

interface MemoryPreference {
  key?: string;
  value?: string;
  note?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/** Read a file, returning undefined on any error */
async function tryReadFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/** Parse JSON file, returning undefined on any error */
async function tryReadJson<T>(filePath: string): Promise<T | undefined> {
  const content = await tryReadFile(filePath);
  if (!content) return undefined;
  try {
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Project structure
// ---------------------------------------------------------------------------

interface DirEntry {
  name: string;
  fileCount: number;
  subdirs: DirEntry[];
}

/** Recursively scan a directory up to maxDepth levels */
async function scanDir(dirPath: string, depth: number): Promise<DirEntry | undefined> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    let fileCount = 0;
    const subdirs: DirEntry[] = [];

    for (const entry of entries) {
      // Skip hidden dirs and common noise dirs
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      if (entry.isDirectory()) {
        if (depth < MAX_TREE_DEPTH) {
          const sub = await scanDir(join(dirPath, entry.name), depth + 1);
          if (sub) subdirs.push(sub);
        } else {
          // At max depth, just count subdirs as 1
          subdirs.push({ name: entry.name, fileCount: 0, subdirs: [] });
        }
      } else {
        fileCount++;
      }
    }

    return { name: basename(dirPath), fileCount, subdirs };
  } catch {
    return undefined;
  }
}

/** Render a DirEntry tree to compact markdown lines */
function renderTree(entry: DirEntry, indent: string): string[] {
  const lines: string[] = [];
  const fileNote = entry.fileCount > 0 ? ` (${entry.fileCount} files)` : '';
  lines.push(`${indent}${entry.name}/${fileNote}`);
  for (const sub of entry.subdirs) {
    lines.push(...renderTree(sub, indent + '  '));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/** Build the GOODVIBES.md section */
async function buildGoodvibesSection(
  cwd: string,
): Promise<{ content: string; source: string } | undefined> {
  const content = await tryReadFile(join(cwd, 'GOODVIBES.md'));
  if (!content) return undefined;
  return {
    content: `## Project Instructions (GOODVIBES.md)\n\n${content.trimEnd()}`,
    source: 'GOODVIBES.md',
  };
}

/** Build the memory summaries section */
async function buildMemorySection(
  cwd: string,
): Promise<{ content: string; sources: string[] } | undefined> {
  const memDir = join(cwd, '.goodvibes', 'memory');
  const parts: string[] = [];
  const sources: string[] = [];

  // Patterns
  const patterns = await tryReadJson<MemoryPattern[]>(join(memDir, 'patterns.json'));
  if (patterns && patterns.length > 0) {
    const lines = patterns
      .filter(p => p.name || p.description)
      .map(p => {
        let line = `- **${p.name ?? 'Pattern'}**: ${p.description ?? ''}`;
        if (p.when_to_use) line += ` (Use when: ${p.when_to_use})`;
        return line;
      });
    if (lines.length > 0) {
      parts.push(`### Patterns\n${lines.join('\n')}`);
      sources.push('.goodvibes/memory/patterns.json');
    }
  }

  // Decisions
  const decisions = await tryReadJson<MemoryDecision[]>(join(memDir, 'decisions.json'));
  if (decisions && decisions.length > 0) {
    const active = decisions.filter(d => d.status !== 'superseded');
    const lines = active
      .filter(d => d.what)
      .map(d => {
        let line = `- **${d.category ?? 'Decision'}**: ${d.what ?? ''}`;
        if (d.why) line += ` — ${d.why}`;
        return line;
      });
    if (lines.length > 0) {
      parts.push(`### Decisions\n${lines.join('\n')}`);
      sources.push('.goodvibes/memory/decisions.json');
    }
  }

  // Failures (last N)
  const failures = await tryReadJson<MemoryFailure[]>(join(memDir, 'failures.json'));
  if (failures && failures.length > 0) {
    const recent = failures.slice(-MAX_FAILURES);
    const lines = recent
      .filter(f => f.description || f.root_cause)
      .map(f => {
        let line = `- ${f.description ?? f.root_cause ?? ''}`;
        if (f.resolution) line += ` → ${f.resolution}`;
        return line;
      });
    if (lines.length > 0) {
      parts.push(`### Recent Failures (avoid repeating)\n${lines.join('\n')}`);
      sources.push('.goodvibes/memory/failures.json');
    }
  }

  // Preferences
  const preferences = await tryReadJson<MemoryPreference[]>(join(memDir, 'preferences.json'));
  if (preferences && preferences.length > 0) {
    const lines = preferences
      .filter(p => p.key || p.note)
      .map(p => {
        let line = `- **${p.key ?? 'Preference'}**`;
        if (p.value) line += `: ${p.value}`;
        if (p.note) line += ` (${p.note})`;
        return line;
      });
    if (lines.length > 0) {
      parts.push(`### Preferences\n${lines.join('\n')}`);
      sources.push('.goodvibes/memory/preferences.json');
    }
  }

  if (parts.length === 0) return undefined;
  return {
    content: `## Project Memory\n\n${parts.join('\n\n')}`,
    sources,
  };
}

/** Build the project structure section */
async function buildStructureSection(
  cwd: string,
): Promise<{ content: string; source: string } | undefined> {
  // Prefer src/ if it exists, else use cwd
  let rootPath = join(cwd, 'src');
  let rootName = 'src';
  try {
    await readdir(rootPath);
  } catch {
    rootPath = cwd;
    rootName = basename(cwd);
  }

  const tree = await scanDir(rootPath, 1);
  if (!tree) return undefined;

  tree.name = rootName;
  const lines = renderTree(tree, '');
  if (lines.length === 0) return undefined;

  return {
    content: `## Project Structure\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``,
    source: 'src/',
  };
}

/** Build role-specific guidance section */
function buildRoleSection(agentType: string): string | undefined {
  switch (agentType) {
    case 'reviewer':
      return '## Reviewer Guidance\n\nFocus on the files listed in the task. Read each file before judging. Use submit_review tool to submit your structured review.';
    case 'engineer':
      return '## Engineer Guidance\n\nFollow existing patterns. Check .goodvibes/memory/ for conventions before implementing. Use precision_engine tools.';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildDossier(options: DossierOptions): Promise<Dossier> {
  const { cwd, agentType, maxTokens = DEFAULT_MAX_TOKENS } = options;
  const charBudget = maxTokens * CHARS_PER_TOKEN;

  const sources: string[] = [];
  const sections: string[] = [];

  // Section 1: GOODVIBES.md (highest priority — never truncate)
  const goodvibesSection = await buildGoodvibesSection(cwd);
  if (goodvibesSection) {
    sections.push(goodvibesSection.content);
    sources.push(goodvibesSection.source);
  }

  // Section 2: Memory summaries
  const memorySection = await buildMemorySection(cwd);
  if (memorySection) {
    sections.push(memorySection.content);
    sources.push(...memorySection.sources);
  }

  // Section 3: Project structure
  const structureSection = await buildStructureSection(cwd);
  if (structureSection) {
    sections.push(structureSection.content);
    sources.push(structureSection.source);
  }

  // Section 4: Role-specific guidance
  const roleSection = buildRoleSection(agentType);
  if (roleSection) {
    sections.push(roleSection);
  }

  if (sections.length === 0) {
    return { content: '', sources: [] };
  }

  // Assemble and apply budget — truncate from bottom (structure first, then memory)
  // GOODVIBES.md is never truncated.
  const header = `# Project Context\n`;
  let assembled = header + '\n' + sections.join('\n\n---\n\n');

  if (assembled.length > charBudget) {
    // Progressive truncation: remove sections from the end until we fit
    // Always keep at minimum: header + GOODVIBES.md (index 0)
    const permanentSections = goodvibesSection ? [sections[0]] : [];
    const removableSections = goodvibesSection ? sections.slice(1) : sections.slice();

    while (removableSections.length > 0) {
      const candidate = header + '\n' + [...permanentSections, ...removableSections].join('\n\n---\n\n');
      if (candidate.length <= charBudget) break;
      removableSections.pop();
      // Remove corresponding source
      sources.pop();
    }

    assembled = header + '\n' + [...permanentSections, ...removableSections].join('\n\n---\n\n');
  }

  const charCount = assembled.length;
  console.error(`[Dossier] Built dossier for ${agentType}: ${sources.length} sources, ~${charCount} chars`);

  return { content: assembled, sources };
}
