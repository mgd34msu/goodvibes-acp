/**
 * Tests for src/plugins/agents/dossier.ts
 *
 * Uses real temp directories to exercise the filesystem-reading logic.
 * Each test group creates a fresh tmpdir and cleans up after itself.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDossier } from '../../src/plugins/agents/dossier.ts';
import type { DossierOptions, Dossier } from '../../src/plugins/agents/dossier.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'gv-dossier-test-'));
}

async function writeMemoryFile(
  cwd: string,
  filename: string,
  content: unknown,
): Promise<void> {
  const memDir = join(cwd, '.goodvibes', 'memory');
  await mkdir(memDir, { recursive: true });
  await writeFile(join(memDir, filename), JSON.stringify(content), 'utf-8');
}

async function cleanupDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ---------------------------------------------------------------------------
// Happy path — GOODVIBES.md present
// ---------------------------------------------------------------------------

describe('buildDossier — happy path with GOODVIBES.md', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Project Instructions\n\nBe good.', 'utf-8');
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('returns a Dossier with content and sources', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('sources');
    expect(typeof result.content).toBe('string');
    expect(Array.isArray(result.sources)).toBe(true);
  });

  it('includes GOODVIBES.md content in the dossier', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Be good.');
    expect(result.content).toContain('Project Instructions (GOODVIBES.md)');
  });

  it('includes GOODVIBES.md in sources', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).toContain('GOODVIBES.md');
  });

  it('wraps content with Project Context header', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('# Project Context');
  });

  it('includes engineer role guidance when agentType is engineer', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Engineer Guidance');
  });
});

// ---------------------------------------------------------------------------
// Missing GOODVIBES.md — graceful degradation
// ---------------------------------------------------------------------------

describe('buildDossier — missing GOODVIBES.md', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
    // No GOODVIBES.md written
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('returns empty content and empty sources when nothing is present and role is unknown', async () => {
    // Use a truly empty non-existent dir so no structure section fires,
    // and unknown-type has no role section.
    const fakeCwd = join(tmpdir(), 'gv-empty-no-exist-' + Date.now());
    const result = await buildDossier({ cwd: fakeCwd, agentType: 'unknown-type' });
    expect(result.content).toBe('');
    expect(result.sources).toHaveLength(0);
  });

  it('does not include GOODVIBES.md in sources', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).not.toContain('GOODVIBES.md');
  });

  it('still returns role guidance as content when role is known and structure exists', async () => {
    // Create a src/ dir so structure section is populated
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'index.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'reviewer' });
    expect(result.content).toContain('Reviewer Guidance');
  });
});

// ---------------------------------------------------------------------------
// Memory files
// ---------------------------------------------------------------------------

describe('buildDossier — memory files', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Instructions', 'utf-8');
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('includes patterns.json content in dossier', async () => {
    await writeMemoryFile(cwd, 'patterns.json', [
      { name: 'GPA Loop', description: 'Always Gather-Plan-Apply', when_to_use: 'every task' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('GPA Loop');
    expect(result.content).toContain('Always Gather-Plan-Apply');
    expect(result.sources).toContain('.goodvibes/memory/patterns.json');
  });

  it('includes decisions.json content in dossier', async () => {
    await writeMemoryFile(cwd, 'decisions.json', [
      { what: 'Use Bun runtime', why: 'Faster than Node', category: 'runtime', status: 'active' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Use Bun runtime');
    expect(result.content).toContain('Faster than Node');
    expect(result.sources).toContain('.goodvibes/memory/decisions.json');
  });

  it('filters out superseded decisions', async () => {
    await writeMemoryFile(cwd, 'decisions.json', [
      { what: 'Old decision', why: 'old', category: 'old', status: 'superseded' },
      { what: 'New decision', why: 'new', category: 'arch', status: 'active' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).not.toContain('Old decision');
    expect(result.content).toContain('New decision');
  });

  it('includes failures.json content in dossier', async () => {
    await writeMemoryFile(cwd, 'failures.json', [
      { description: 'Bun not in PATH', root_cause: 'env issue', resolution: 'Use absolute path' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Bun not in PATH');
    expect(result.sources).toContain('.goodvibes/memory/failures.json');
  });

  it('includes preferences.json content in dossier', async () => {
    await writeMemoryFile(cwd, 'preferences.json', [
      { key: 'indent', value: '2 spaces', note: 'project standard' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('indent');
    expect(result.content).toContain('2 spaces');
    expect(result.sources).toContain('.goodvibes/memory/preferences.json');
  });

  it('only includes last 5 failures', async () => {
    const failures = Array.from({ length: 8 }, (_, i) => ({
      description: `Failure ${i + 1}`,
      root_cause: `cause ${i + 1}`,
    }));
    await writeMemoryFile(cwd, 'failures.json', failures);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    // Last 5: Failure 4-8 should appear, Failure 1-3 should not
    expect(result.content).toContain('Failure 8');
    expect(result.content).toContain('Failure 4');
    expect(result.content).not.toContain('Failure 3');
    expect(result.content).not.toContain('Failure 1');
  });

  it('includes memory section header', async () => {
    await writeMemoryFile(cwd, 'patterns.json', [
      { name: 'SomePat', description: 'desc' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Project Memory');
  });

  it('handles all four memory files at once', async () => {
    await writeMemoryFile(cwd, 'patterns.json', [{ name: 'P1', description: 'desc1' }]);
    await writeMemoryFile(cwd, 'decisions.json', [{ what: 'D1', why: 'because', category: 'arch' }]);
    await writeMemoryFile(cwd, 'failures.json', [{ description: 'F1', resolution: 'fixed' }]);
    await writeMemoryFile(cwd, 'preferences.json', [{ key: 'pref1', value: 'v1' }]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).toContain('.goodvibes/memory/patterns.json');
    expect(result.sources).toContain('.goodvibes/memory/decisions.json');
    expect(result.sources).toContain('.goodvibes/memory/failures.json');
    expect(result.sources).toContain('.goodvibes/memory/preferences.json');
  });
});

// ---------------------------------------------------------------------------
// Project structure section
// ---------------------------------------------------------------------------

describe('buildDossier — project structure section', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Instructions', 'utf-8');
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('includes project structure when src/ exists', async () => {
    await mkdir(join(cwd, 'src', 'core'), { recursive: true });
    await writeFile(join(cwd, 'src', 'core', 'index.ts'), '', 'utf-8');
    await writeFile(join(cwd, 'src', 'main.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Project Structure');
    expect(result.content).toContain('src/');
    expect(result.sources).toContain('src/');
  });

  it('shows file counts in structure', async () => {
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'a.ts'), '', 'utf-8');
    await writeFile(join(cwd, 'src', 'b.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    // Should show (2 files) for src root
    expect(result.content).toContain('2 files');
  });

  it('falls back to cwd scan when src/ does not exist', async () => {
    // No src/ dir, just a top-level file
    await writeFile(join(cwd, 'index.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    // Structure section should still be present (uses cwd)
    expect(result.content).toContain('Project Structure');
  });

  it('wraps structure in code block', async () => {
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'index.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('```');
  });

  it('skips hidden directories in structure', async () => {
    await mkdir(join(cwd, 'src'), { recursive: true });
    await mkdir(join(cwd, 'src', '.hidden'), { recursive: true });
    await writeFile(join(cwd, 'src', 'main.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).not.toContain('.hidden');
  });

  it('skips node_modules in structure', async () => {
    await mkdir(join(cwd, 'src'), { recursive: true });
    await mkdir(join(cwd, 'src', 'node_modules'), { recursive: true });
    await writeFile(join(cwd, 'src', 'main.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).not.toContain('node_modules');
  });
});

// ---------------------------------------------------------------------------
// Role-specific guidance
// ---------------------------------------------------------------------------

describe('buildDossier — role-specific guidance', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Instructions', 'utf-8');
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('includes Engineer Guidance for agentType=engineer', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Engineer Guidance');
    expect(result.content).toContain('precision_engine tools');
  });

  it('includes Reviewer Guidance for agentType=reviewer', async () => {
    const result = await buildDossier({ cwd, agentType: 'reviewer' });
    expect(result.content).toContain('Reviewer Guidance');
    expect(result.content).toContain('submit_review');
  });

  it('includes no role section for unknown agentType', async () => {
    const result = await buildDossier({ cwd, agentType: 'unknown-role-xyz' });
    expect(result.content).not.toContain('Guidance');
  });

  it('engineer guidance mentions goodvibes memory', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('.goodvibes/memory/');
  });

  it('reviewer guidance mentions reading files before judging', async () => {
    const result = await buildDossier({ cwd, agentType: 'reviewer' });
    expect(result.content).toContain('Read each file before judging');
  });
});

// ---------------------------------------------------------------------------
// Token budget truncation
// ---------------------------------------------------------------------------

describe('buildDossier — token budget truncation', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
    // Large GOODVIBES.md
    const bigContent = 'A'.repeat(2000);
    await writeFile(join(cwd, 'GOODVIBES.md'), bigContent, 'utf-8');
    // Memory content
    await writeMemoryFile(cwd, 'patterns.json', [
      { name: 'Pattern1', description: 'B'.repeat(500) },
    ]);
    // Structure
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'index.ts'), '', 'utf-8');
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('truncates lower-priority sections when maxTokens is small', async () => {
    // Very small budget — should only keep GOODVIBES.md header + content (permanent section)
    const result = await buildDossier({ cwd, agentType: 'engineer', maxTokens: 10 });
    // Content should not exceed budget chars (maxTokens * 4)
    // Budget is 40 chars — result will be truncated to just the header + GOODVIBES section
    // The permanent sections never get removed; the assembled result may exceed budget
    // but that is by design (GOODVIBES.md is never truncated)
    expect(typeof result.content).toBe('string');
    // Structure section should be removed to fit budget
    expect(result.content).not.toContain('Project Structure');
  });

  it('respects maxTokens=0 by leaving only the permanent section', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer', maxTokens: 0 });
    // With 0 chars budget, all removable sections are stripped
    expect(result.content).not.toContain('Project Memory');
    expect(result.content).not.toContain('Project Structure');
  });

  it('returns full content when maxTokens is large enough', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer', maxTokens: 10000 });
    expect(result.content).toContain('Project Memory');
    expect(result.content).toContain('Project Structure');
    expect(result.content).toContain('GOODVIBES.md');
  });

  it('GOODVIBES.md is never removed by truncation', async () => {
    const result = await buildDossier({ cwd, agentType: 'engineer', maxTokens: 1 });
    // Even with 1 token budget (4 chars), GOODVIBES.md section is permanent
    expect(result.content).toContain('AAAA');
  });
});

// ---------------------------------------------------------------------------
// Sources array tracking
// ---------------------------------------------------------------------------

describe('buildDossier — sources array tracking', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('sources is empty when no content is found and role is unknown', async () => {
    // Use non-existent dir + unknown role so no sections fire
    const fakeCwd = join(tmpdir(), 'gv-no-sources-' + Date.now());
    const result = await buildDossier({ cwd: fakeCwd, agentType: 'noop' });
    expect(result.sources).toHaveLength(0);
  });

  it('sources contains GOODVIBES.md when no memory is present', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'noop' });
    // GOODVIBES.md is always included; structure section may also appear if cwd has content
    expect(result.sources).toContain('GOODVIBES.md');
    expect(result.sources).not.toContain('.goodvibes/memory/patterns.json');
    expect(result.sources).not.toContain('.goodvibes/memory/decisions.json');
  });

  it('sources includes all contributing files', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    await writeMemoryFile(cwd, 'patterns.json', [{ name: 'P', description: 'D' }]);
    await writeMemoryFile(cwd, 'decisions.json', [{ what: 'W', why: 'Y', category: 'c' }]);
    await mkdir(join(cwd, 'src'), { recursive: true });
    await writeFile(join(cwd, 'src', 'a.ts'), '', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).toContain('GOODVIBES.md');
    expect(result.sources).toContain('.goodvibes/memory/patterns.json');
    expect(result.sources).toContain('.goodvibes/memory/decisions.json');
    expect(result.sources).toContain('src/');
  });

  it('sources does not contain duplicates for the same file', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    const gvCount = result.sources.filter((s) => s === 'GOODVIBES.md').length;
    expect(gvCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('buildDossier — edge cases', () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await makeTmpDir();
  });

  afterEach(async () => {
    await cleanupDir(cwd);
  });

  it('handles invalid JSON in patterns.json gracefully', async () => {
    const memDir = join(cwd, '.goodvibes', 'memory');
    await mkdir(memDir, { recursive: true });
    await writeFile(join(memDir, 'patterns.json'), '{ NOT VALID JSON !!!', 'utf-8');
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    // Should not throw
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).toContain('Hello');
    expect(result.sources).not.toContain('.goodvibes/memory/patterns.json');
  });

  it('handles invalid JSON in decisions.json gracefully', async () => {
    const memDir = join(cwd, '.goodvibes', 'memory');
    await mkdir(memDir, { recursive: true });
    await writeFile(join(memDir, 'decisions.json'), '[bad json', 'utf-8');
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).not.toContain('.goodvibes/memory/decisions.json');
  });

  it('handles invalid JSON in failures.json gracefully', async () => {
    const memDir = join(cwd, '.goodvibes', 'memory');
    await mkdir(memDir, { recursive: true });
    await writeFile(join(memDir, 'failures.json'), 'null-pointer!', 'utf-8');
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).not.toContain('.goodvibes/memory/failures.json');
  });

  it('handles invalid JSON in preferences.json gracefully', async () => {
    const memDir = join(cwd, '.goodvibes', 'memory');
    await mkdir(memDir, { recursive: true });
    await writeFile(join(memDir, 'preferences.json'), '{broken}', 'utf-8');
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).not.toContain('.goodvibes/memory/preferences.json');
  });

  it('handles empty arrays in memory files (no section added)', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    await writeMemoryFile(cwd, 'patterns.json', []);
    await writeMemoryFile(cwd, 'decisions.json', []);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.content).not.toContain('Project Memory');
    expect(result.sources).not.toContain('.goodvibes/memory/patterns.json');
  });

  it('handles memory entries without required fields (filtered out)', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    // Pattern with no name or description should be filtered
    await writeMemoryFile(cwd, 'patterns.json', [
      { when_to_use: 'always' }, // no name or description
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    // No pattern lines = no section
    expect(result.sources).not.toContain('.goodvibes/memory/patterns.json');
  });

  it('handles non-existent cwd gracefully (returns empty for unknown role)', async () => {
    // With non-existent dir and unknown role, no sections fire at all
    const fakeCwd = join(tmpdir(), 'gv-nonexistent-' + Date.now());
    const result = await buildDossier({ cwd: fakeCwd, agentType: 'noop' });
    expect(result.content).toBe('');
    expect(result.sources).toHaveLength(0);
  });

  it('handles non-existent cwd gracefully (role section still emitted for known role)', async () => {
    // Known roles (engineer, reviewer) produce a role section even with missing cwd
    const fakeCwd = join(tmpdir(), 'gv-nonexistent-eng-' + Date.now());
    const result = await buildDossier({ cwd: fakeCwd, agentType: 'engineer' });
    expect(result.content).toContain('Engineer Guidance');
    expect(result.sources).toHaveLength(0); // no file sources, just role section
  });

  it('uses default maxTokens of 4000 when not specified', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    // Default 4000 tokens = 16000 chars. A small dossier should fit.
    expect(result.content.length).toBeLessThanOrEqual(4000 * 4 + 100);
  });

  it('returns Dossier interface shape (content string, sources array)', async () => {
    const result = await buildDossier({ cwd, agentType: 'noop' });
    expect(result).toMatchObject<Dossier>({ content: expect.any(String), sources: expect.any(Array) });
  });

  it('handles GOODVIBES.md with only whitespace (trimmed, section still included)', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '   \n\t  \n   ', 'utf-8');
    // tryReadFile returns the content, trimEnd is applied; section is still created
    // (non-empty string even after read, just whitespace)
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    // GOODVIBES.md source should appear since content was read successfully
    expect(result.sources).toContain('GOODVIBES.md');
  });

  it('handles decisions with all entries superseded (no section added)', async () => {
    await writeFile(join(cwd, 'GOODVIBES.md'), '# Hello', 'utf-8');
    await writeMemoryFile(cwd, 'decisions.json', [
      { what: 'Old1', status: 'superseded' },
      { what: 'Old2', status: 'superseded' },
    ]);
    const result = await buildDossier({ cwd, agentType: 'engineer' });
    expect(result.sources).not.toContain('.goodvibes/memory/decisions.json');
    expect(result.content).not.toContain('Old1');
  });
});
