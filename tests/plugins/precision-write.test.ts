/**
 * Tests for L3 PrecisionWriteTool.
 * Covers fail_if_exists, overwrite, backup modes, auto-create dirs, batch writes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrecisionWriteTool } from '../../src/plugins/precision/write.ts';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gv-write-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// fail_if_exists mode
// ---------------------------------------------------------------------------

describe('PrecisionWriteTool — fail_if_exists', () => {
  it('writes a new file successfully', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'new.ts');

    const result = await tool.execute({
      files: [{ path: filePath, content: 'export const x = 1;', mode: 'fail_if_exists' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.filesWritten).toBe(1);
    expect(result.data!.filesFailed).toBe(0);
    const written = await readFile(filePath, 'utf-8');
    expect(written).toBe('export const x = 1;');
  });

  it('fails when file already exists in fail_if_exists mode', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'existing.ts');
    await tool.execute({ files: [{ path: filePath, content: 'original' }] });

    const result = await tool.execute({
      files: [{ path: filePath, content: 'new content', mode: 'fail_if_exists' }],
    });

    expect(result.success).toBe(false);
    expect(result.data!.filesFailed).toBe(1);
    expect(result.data!.files[0].error).toContain('fail_if_exists');
    // Original content should be unchanged
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('original');
  });

  it('fail_if_exists is the default mode', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'default.ts');
    await tool.execute({ files: [{ path: filePath, content: 'first' }] });

    const result = await tool.execute({
      files: [{ path: filePath, content: 'second' }], // no mode specified
    });

    expect(result.success).toBe(false);
    expect(result.data!.filesFailed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Overwrite mode
// ---------------------------------------------------------------------------

describe('PrecisionWriteTool — overwrite', () => {
  it('overwrites an existing file', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'overwrite.ts');
    await tool.execute({ files: [{ path: filePath, content: 'original' }] });

    const result = await tool.execute({
      files: [{ path: filePath, content: 'updated', mode: 'overwrite' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.filesWritten).toBe(1);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('updated');
  });

  it('creates file in overwrite mode when it does not exist', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'new-overwrite.ts');

    const result = await tool.execute({
      files: [{ path: filePath, content: 'hello', mode: 'overwrite' }],
    });

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('hello');
  });

  it('reports bytesWritten accurately', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'bytes.ts');
    const content = 'abc';

    const result = await tool.execute({
      files: [{ path: filePath, content, mode: 'overwrite' }],
    });

    expect(result.data!.bytesWritten).toBe(3);
    expect(result.data!.files[0].bytesWritten).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Backup mode
// ---------------------------------------------------------------------------

describe('PrecisionWriteTool — backup', () => {
  it('creates a .bak file when backing up an existing file', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'backup.ts');
    await tool.execute({ files: [{ path: filePath, content: 'original' }] });

    const result = await tool.execute({
      files: [{ path: filePath, content: 'new content', mode: 'backup' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].backedUp).toBe(true);
    expect(result.data!.files[0].backupPath).toContain('.bak');

    // Original is backed up
    const backupContent = await readFile(result.data!.files[0].backupPath!, 'utf-8');
    expect(backupContent).toBe('original');

    // New content is written
    const newContent = await readFile(filePath, 'utf-8');
    expect(newContent).toBe('new content');
  });

  it('does not create backup if file does not exist', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'fresh.ts');

    const result = await tool.execute({
      files: [{ path: filePath, content: 'hello', mode: 'backup' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].backedUp).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Auto-create parent directories
// ---------------------------------------------------------------------------

describe('PrecisionWriteTool — auto-create dirs', () => {
  it('creates nested directories automatically', async () => {
    const tool = new PrecisionWriteTool();
    const filePath = join(tmpDir, 'deep', 'nested', 'dir', 'file.ts');

    const result = await tool.execute({
      files: [{ path: filePath, content: 'export const nested = true;', mode: 'overwrite' }],
    });

    expect(result.success).toBe(true);
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('export const nested = true;');
  });
});

// ---------------------------------------------------------------------------
// Batch writes
// ---------------------------------------------------------------------------

describe('PrecisionWriteTool — batch writes', () => {
  it('writes multiple files in a single call', async () => {
    const tool = new PrecisionWriteTool();
    const fileA = join(tmpDir, 'a.ts');
    const fileB = join(tmpDir, 'b.ts');
    const fileC = join(tmpDir, 'c.ts');

    const result = await tool.execute({
      files: [
        { path: fileA, content: 'const A = 1;', mode: 'overwrite' },
        { path: fileB, content: 'const B = 2;', mode: 'overwrite' },
        { path: fileC, content: 'const C = 3;', mode: 'overwrite' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data!.filesWritten).toBe(3);
    expect(result.data!.filesFailed).toBe(0);
    expect(await readFile(fileA, 'utf-8')).toBe('const A = 1;');
    expect(await readFile(fileB, 'utf-8')).toBe('const B = 2;');
    expect(await readFile(fileC, 'utf-8')).toBe('const C = 3;');
  });

  it('partial batch: continues on failure, reports mixed results', async () => {
    const tool = new PrecisionWriteTool();
    const fileOk = join(tmpDir, 'ok.ts');
    const fileExisting = join(tmpDir, 'existing.ts');
    // Pre-create the conflicting file
    await tool.execute({ files: [{ path: fileExisting, content: 'existing' }] });

    const result = await tool.execute({
      files: [
        { path: fileOk, content: 'new', mode: 'overwrite' },
        { path: fileExisting, content: 'conflict', mode: 'fail_if_exists' },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.data!.filesWritten).toBe(1);
    expect(result.data!.filesFailed).toBe(1);
  });

  it('returns error for empty files array', async () => {
    const tool = new PrecisionWriteTool();
    const result = await tool.execute({ files: [] });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
