/**
 * Tests for L3 PrecisionReadTool.
 * Covers content, outline, symbols, lines extract modes, error handling, and batch reads.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrecisionReadTool } from '../../src/plugins/precision/read.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gv-read-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const SAMPLE_TS = `export interface User {
  id: string;
  name: string;
}

export function greet(user: User): string {
  return 'Hello, ' + user.name;
}

const INTERNAL = 'not exported';
`;

// ---------------------------------------------------------------------------
// Content extract mode
// ---------------------------------------------------------------------------

describe('PrecisionReadTool — content extract', () => {
  it('reads a file with content extract mode', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'sample.ts');
    await writeFile(filePath, SAMPLE_TS, 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'content' }],
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.filesRead).toBe(1);
    expect(result.data!.filesFailed).toBe(0);
    expect(result.data!.files[0].path).toBe(filePath);
    expect(result.data!.files[0].content).toContain('export interface User');
    expect(result.data!.files[0].content).toContain('export function greet');
  });

  it('includes line numbers by default', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'sample.ts');
    await writeFile(filePath, 'line one\nline two\n', 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'content' }],
      includeLineNumbers: true,
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].content).toContain('| line one');
    expect(result.data!.files[0].content).toContain('| line two');
  });

  it('omits line numbers when includeLineNumbers=false', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'sample.ts');
    await writeFile(filePath, 'line one\nline two\n', 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'content' }],
      includeLineNumbers: false,
    });

    expect(result.success).toBe(true);
    const content = result.data!.files[0].content;
    expect(content).not.toMatch(/\d+ \|/);
    expect(content).toContain('line one');
  });

  it('returns correct lineCount and sizeBytes', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'sample.ts');
    const content = 'a\nb\nc\n';
    await writeFile(filePath, content, 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath }],
    });

    expect(result.data!.files[0].lineCount).toBe(4); // 3 lines + empty after last \n
    expect(result.data!.files[0].sizeBytes).toBeGreaterThan(0);
    expect(result.data!.files[0].encoding).toBe('utf-8');
  });
});

// ---------------------------------------------------------------------------
// Lines extract mode
// ---------------------------------------------------------------------------

describe('PrecisionReadTool — lines extract', () => {
  it('extracts specific line range', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'lines.ts');
    const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];
    await writeFile(filePath, lines.join('\n'), 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'lines', range: { start: 2, end: 4 } }],
    });

    expect(result.success).toBe(true);
    const content = result.data!.files[0].content;
    expect(content).toContain('line2');
    expect(content).toContain('line3');
    expect(content).toContain('line4');
    expect(content).not.toContain('line1');
    expect(content).not.toContain('line5');
  });

  it('clamps end range to EOF gracefully', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'clamp.ts');
    await writeFile(filePath, 'a\nb\nc', 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'lines', range: { start: 1, end: 9999 } }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].content).toContain('a');
    expect(result.data!.files[0].content).toContain('c');
  });

  it('uses default range start=1 end=50 when no range provided', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'default-range.ts');
    const manyLines = Array.from({ length: 60 }, (_, i) => `line${i + 1}`).join('\n');
    await writeFile(filePath, manyLines, 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'lines' }],
    });

    expect(result.success).toBe(true);
    const content = result.data!.files[0].content;
    expect(content).toContain('line1');
    expect(content).toContain('line50');
    expect(content).not.toContain('line51');
  });
});

// ---------------------------------------------------------------------------
// Outline extract mode
// ---------------------------------------------------------------------------

describe('PrecisionReadTool — outline extract', () => {
  it('extracts function and interface signatures', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'outline.ts');
    await writeFile(filePath, SAMPLE_TS, 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'outline' }],
    });

    expect(result.success).toBe(true);
    const content = result.data!.files[0].content;
    // Outline should capture top-level declarations
    expect(content).toContain('User');
    expect(content).toContain('greet');
  });

  it('returns (no outline available) for empty file', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'empty.ts');
    await writeFile(filePath, '', 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'outline' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].content).toContain('no outline available');
  });
});

// ---------------------------------------------------------------------------
// Symbols extract mode
// ---------------------------------------------------------------------------

describe('PrecisionReadTool — symbols extract', () => {
  it('returns only export lines', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'symbols.ts');
    await writeFile(filePath, SAMPLE_TS, 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'symbols' }],
    });

    expect(result.success).toBe(true);
    const content = result.data!.files[0].content;
    expect(content).toContain('export interface User');
    expect(content).toContain('export function greet');
    expect(content).not.toContain('INTERNAL');
  });

  it('returns (no exports found) for file without exports', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'no-exports.ts');
    await writeFile(filePath, 'const x = 42;\nconst y = x + 1;\n', 'utf-8');

    const result = await tool.execute({
      files: [{ path: filePath, extract: 'symbols' }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].content).toContain('no exports found');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('PrecisionReadTool — error handling', () => {
  it('handles non-existent file gracefully', async () => {
    const tool = new PrecisionReadTool();
    const filePath = join(tmpDir, 'does-not-exist.ts');

    const result = await tool.execute({
      files: [{ path: filePath }],
    });

    expect(result.success).toBe(false);
    expect(result.data!.filesFailed).toBe(1);
    expect(result.data!.filesRead).toBe(0);
    expect(result.data!.files[0].content).toContain('ERROR');
    expect(result.error).toContain('failed to read');
  });

  it('returns error for empty files array', async () => {
    const tool = new PrecisionReadTool();

    const result = await tool.execute({ files: [] });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('partial success: valid + invalid file in batch', async () => {
    const tool = new PrecisionReadTool();
    const validPath = join(tmpDir, 'valid.ts');
    const missingPath = join(tmpDir, 'missing.ts');
    await writeFile(validPath, 'export const x = 1;', 'utf-8');

    const result = await tool.execute({
      files: [
        { path: validPath },
        { path: missingPath },
      ],
    });

    expect(result.success).toBe(false); // overall fails because one file failed
    expect(result.data!.filesRead).toBe(1);
    expect(result.data!.filesFailed).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Batch file reads
// ---------------------------------------------------------------------------

describe('PrecisionReadTool — batch reads', () => {
  it('reads multiple files in a single call', async () => {
    const tool = new PrecisionReadTool();
    const fileA = join(tmpDir, 'a.ts');
    const fileB = join(tmpDir, 'b.ts');
    await writeFile(fileA, 'export const A = 1;', 'utf-8');
    await writeFile(fileB, 'export const B = 2;', 'utf-8');

    const result = await tool.execute({
      files: [{ path: fileA }, { path: fileB }],
    });

    expect(result.success).toBe(true);
    expect(result.data!.filesRead).toBe(2);
    expect(result.data!.files).toHaveLength(2);
    const paths = result.data!.files.map((f) => f.path);
    expect(paths).toContain(fileA);
    expect(paths).toContain(fileB);
  });

  it('uses default extractMode for all files unless overridden per-file', async () => {
    const tool = new PrecisionReadTool();
    const fileA = join(tmpDir, 'a.ts');
    const fileB = join(tmpDir, 'b.ts');
    await writeFile(fileA, 'export const A = 1;', 'utf-8');
    await writeFile(fileB, 'const internal = 2;', 'utf-8');

    const result = await tool.execute({
      files: [
        { path: fileA, extract: 'symbols' }, // override
        { path: fileB },                      // uses default
      ],
      extractMode: 'content',
    });

    expect(result.success).toBe(true);
    expect(result.data!.files[0].content).toContain('export const A');
    expect(result.data!.files[1].content).toContain('internal');
  });
});
