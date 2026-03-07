/**
 * Tests for L3 PrecisionEditTool.
 * Covers find/replace, occurrence modes, atomic rollback, partial mode, batch edits.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrecisionEditTool } from '../../src/plugins/precision/edit.ts';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gv-edit-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Basic find/replace
// ---------------------------------------------------------------------------

describe('PrecisionEditTool — find/replace', () => {
  it('replaces first occurrence by default', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'edit.ts');
    await writeFile(filePath, 'foo bar foo', 'utf-8');

    const result = await tool.execute({
      edits: [{ path: filePath, find: 'foo', replace: 'baz' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.editsApplied).toBe(1);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('baz bar foo');
  });

  it('returns error when find string is not found', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'notfound.ts');
    await writeFile(filePath, 'hello world', 'utf-8');

    const result = await tool.execute({
      edits: [{ path: filePath, find: 'NOTHERE', replace: 'x' }],
    });

    expect(result.success).toBe(false);
    expect(result.data!.editsFailed).toBe(1);
    expect(result.data!.edits[0].error).toContain('not found');
  });

  it('returns error for empty edits array', async () => {
    const tool = new PrecisionEditTool();
    const result = await tool.execute({ edits: [] });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Occurrence modes
// ---------------------------------------------------------------------------

describe('PrecisionEditTool — occurrence modes', () => {
  it('occurrence=first replaces only first match', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'first.ts');
    await writeFile(filePath, 'a a a', 'utf-8');

    await tool.execute({
      edits: [{ path: filePath, find: 'a', replace: 'X', occurrence: 'first' }],
    });

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('X a a');
  });

  it('occurrence=last replaces only last match', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'last.ts');
    await writeFile(filePath, 'a a a', 'utf-8');

    await tool.execute({
      edits: [{ path: filePath, find: 'a', replace: 'X', occurrence: 'last' }],
    });

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('a a X');
  });

  it('occurrence=all replaces all matches', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'all.ts');
    await writeFile(filePath, 'a a a', 'utf-8');

    await tool.execute({
      edits: [{ path: filePath, find: 'a', replace: 'X', occurrence: 'all' }],
    });

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('X X X');
  });

  it('occurrence=2 (numeric) replaces second match', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'second.ts');
    await writeFile(filePath, 'a a a', 'utf-8');

    await tool.execute({
      edits: [{ path: filePath, find: 'a', replace: 'X', occurrence: 2 }],
    });

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('a X a');
  });

  it('out-of-range numeric occurrence returns failure (not found)', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'oob.ts');
    await writeFile(filePath, 'a a', 'utf-8');

    const result = await tool.execute({
      edits: [{ path: filePath, find: 'a', replace: 'X', occurrence: 99 }],
    });

    expect(result.success).toBe(false);
    expect(result.data!.editsFailed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Atomic transaction rollback
// ---------------------------------------------------------------------------

describe('PrecisionEditTool — atomic transaction', () => {
  it('rolls back all edits when one fails in atomic mode', async () => {
    const tool = new PrecisionEditTool();
    const fileA = join(tmpDir, 'atomic-a.ts');
    const fileB = join(tmpDir, 'atomic-b.ts');
    await writeFile(fileA, 'hello world', 'utf-8');
    await writeFile(fileB, 'foo bar', 'utf-8');

    const result = await tool.execute({
      edits: [
        { path: fileA, find: 'hello', replace: 'CHANGED' },
        { path: fileB, find: 'NOTFOUND', replace: 'X' }, // this will fail
      ],
      transaction: 'atomic',
    });

    expect(result.success).toBe(false);
    expect(result.data!.rolledBack).toBe(true);
    expect(result.error).toContain('rolled back');

    // File A should be unchanged despite first edit succeeding in memory
    const contentA = await readFile(fileA, 'utf-8');
    expect(contentA).toBe('hello world');
  });

  it('editsApplied is 0 after rollback', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'rollback.ts');
    await writeFile(filePath, 'keep this', 'utf-8');

    const result = await tool.execute({
      edits: [
        { path: filePath, find: 'MISSING', replace: 'X' },
      ],
      transaction: 'atomic',
    });

    expect(result.data!.editsApplied).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Partial transaction mode
// ---------------------------------------------------------------------------

describe('PrecisionEditTool — partial transaction', () => {
  it('applies successful edits and skips failures in partial mode', async () => {
    const tool = new PrecisionEditTool();
    const fileA = join(tmpDir, 'partial-a.ts');
    const fileB = join(tmpDir, 'partial-b.ts');
    await writeFile(fileA, 'hello world', 'utf-8');
    await writeFile(fileB, 'foo bar', 'utf-8');

    const result = await tool.execute({
      edits: [
        { path: fileA, find: 'hello', replace: 'HI' },
        { path: fileB, find: 'NOTFOUND', replace: 'X' },
      ],
      transaction: 'partial',
    });

    expect(result.success).toBe(false); // overall fails
    expect(result.data!.editsApplied).toBe(1);
    expect(result.data!.editsFailed).toBe(1);
    expect(result.data!.rolledBack).toBe(false);

    // File A should be modified
    const contentA = await readFile(fileA, 'utf-8');
    expect(contentA).toBe('HI world');

    // File B unchanged
    const contentB = await readFile(fileB, 'utf-8');
    expect(contentB).toBe('foo bar');
  });
});

// ---------------------------------------------------------------------------
// Batch edits across files
// ---------------------------------------------------------------------------

describe('PrecisionEditTool — batch edits', () => {
  it('applies edits to multiple files in one call', async () => {
    const tool = new PrecisionEditTool();
    const fileA = join(tmpDir, 'batch-a.ts');
    const fileB = join(tmpDir, 'batch-b.ts');
    await writeFile(fileA, 'version: 1', 'utf-8');
    await writeFile(fileB, 'version: 1', 'utf-8');

    const result = await tool.execute({
      edits: [
        { path: fileA, find: 'version: 1', replace: 'version: 2' },
        { path: fileB, find: 'version: 1', replace: 'version: 2' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data!.editsApplied).toBe(2);
    expect(await readFile(fileA, 'utf-8')).toBe('version: 2');
    expect(await readFile(fileB, 'utf-8')).toBe('version: 2');
  });

  it('multiple edits to the same file are applied sequentially', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'multi.ts');
    await writeFile(filePath, 'a b c', 'utf-8');

    const result = await tool.execute({
      edits: [
        { path: filePath, find: 'a', replace: 'X' },
        { path: filePath, find: 'b', replace: 'Y' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data!.editsApplied).toBe(2);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('X Y c');
  });

  it('handles non-existent file gracefully', async () => {
    const tool = new PrecisionEditTool();
    const filePath = join(tmpDir, 'ghost.ts');

    const result = await tool.execute({
      edits: [{ path: filePath, find: 'hello', replace: 'world' }],
    });

    expect(result.success).toBe(false);
    expect(result.data!.editsFailed).toBe(1);
    expect(result.data!.edits[0].error).toContain('Cannot read file');
  });
});
