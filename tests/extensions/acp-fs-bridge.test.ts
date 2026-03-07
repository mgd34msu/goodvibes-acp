import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { AcpFileSystem } from '../../src/extensions/acp/fs-bridge.js';
import type { AgentSideConnection } from '@agentclientprotocol/sdk';
import type * as schema from '@agentclientprotocol/sdk';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Minimal mock connection — never called in no-capability tests
// ---------------------------------------------------------------------------

function makeConn(): AgentSideConnection {
  return {
    readTextFile: async () => { throw new Error('should not be called'); },
    writeTextFile: async () => { throw new Error('should not be called'); },
  } as unknown as AgentSideConnection;
}

// No-capability client: no fs capabilities
const NO_CAPS: schema.ClientCapabilities = {};

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gv-fs-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// AcpFileSystem — direct fs fallback (no capabilities)
// ---------------------------------------------------------------------------

describe('AcpFileSystem (no capabilities — direct fs fallback)', () => {
  test('writeTextFile creates a file with the given content', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'hello.txt');
    await fs.writeTextFile(path, 'hello world');
    const content = await readFile(path, 'utf-8');
    expect(content).toBe('hello world');
  });

  test('readTextFile reads the content of an existing file', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'read.txt');
    await fs.writeTextFile(path, 'read me');
    const content = await fs.readTextFile(path);
    expect(content).toBe('read me');
  });

  test('writeTextFile creates parent directories automatically', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'nested', 'deep', 'file.txt');
    await fs.writeTextFile(path, 'nested content');
    const content = await readFile(path, 'utf-8');
    expect(content).toBe('nested content');
  });

  test('readTextFile with explicit utf-8 encoding works', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'encoded.txt');
    await fs.writeTextFile(path, 'encoded text');
    const content = await fs.readTextFile(path, { encoding: 'utf-8' });
    expect(content).toBe('encoded text');
  });

  test('readTextFile with utf8 encoding alias works', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'utf8.txt');
    await fs.writeTextFile(path, 'utf8 test');
    const content = await fs.readTextFile(path, { encoding: 'utf8' });
    expect(content).toBe('utf8 test');
  });

  test('readTextFile throws for unsupported encoding', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'enc.txt');
    await fs.writeTextFile(path, 'data');
    await expect(fs.readTextFile(path, { encoding: 'utf-32' })).rejects.toThrow(
      'Unsupported encoding: utf-32',
    );
  });

  test('writeTextFile throws for unsupported encoding', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'enc2.txt');
    await expect(fs.writeTextFile(path, 'data', { encoding: 'utf-32' })).rejects.toThrow(
      'Unsupported encoding: utf-32',
    );
  });

  test('readTextFile throws when file does not exist', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'nonexistent.txt');
    await expect(fs.readTextFile(path)).rejects.toThrow();
  });

  test('writeTextFile overwrites existing file content', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'overwrite.txt');
    await fs.writeTextFile(path, 'first');
    await fs.writeTextFile(path, 'second');
    const content = await fs.readTextFile(path);
    expect(content).toBe('second');
  });

  test('round-trip write-read preserves unicode content', async () => {
    const fs = new AcpFileSystem(makeConn(), 'sess-1', NO_CAPS);
    const path = join(tmpDir, 'unicode.txt');
    const content = '\u{1F600} hello \u4e2d\u6587';
    await fs.writeTextFile(path, content);
    const result = await fs.readTextFile(path);
    expect(result).toBe(content);
  });
});

// ---------------------------------------------------------------------------
// AcpFileSystem — ACP client fallback (with capabilities)
// ---------------------------------------------------------------------------

describe('AcpFileSystem (with ACP capabilities)', () => {
  test('readTextFile delegates to conn.readTextFile when capability is set', async () => {
    let called = false;
    const conn = {
      readTextFile: async (_params: { path: string; sessionId: string }) => {
        called = true;
        return { content: 'acp content' };
      },
      writeTextFile: async () => {},
    } as unknown as AgentSideConnection;

    const caps: schema.ClientCapabilities = { fs: { readTextFile: true, writeTextFile: false } };
    const fs = new AcpFileSystem(conn, 'sess-acp', caps);
    const result = await fs.readTextFile('/some/path');

    expect(called).toBe(true);
    expect(result).toBe('acp content');
  });

  test('writeTextFile delegates to conn.writeTextFile when capability is set', async () => {
    let calledWith: { path: string; content: string; sessionId: string } | null = null;
    const conn = {
      readTextFile: async () => { throw new Error('not called'); },
      writeTextFile: async (params: { path: string; content: string; sessionId: string }) => {
        calledWith = params;
      },
    } as unknown as AgentSideConnection;

    const caps: schema.ClientCapabilities = { fs: { readTextFile: false, writeTextFile: true } };
    const fs = new AcpFileSystem(conn, 'sess-acp', caps);
    await fs.writeTextFile('/some/path', 'my content');

    expect(calledWith).not.toBeNull();
    expect(calledWith!.path).toBe('/some/path');
    expect(calledWith!.content).toBe('my content');
    expect(calledWith!.sessionId).toBe('sess-acp');
  });
});
