/**
 * Tests for L3 PrecisionToolProvider.
 * Covers IToolProvider interface compliance, tool listing, dispatch, and unknown tool handling.
 */
import { describe, it, expect } from 'bun:test';
import { PrecisionToolProvider } from '../../src/plugins/precision/index.ts';

// ---------------------------------------------------------------------------
// Interface compliance
// ---------------------------------------------------------------------------

describe('PrecisionToolProvider — interface compliance', () => {
  it('has a name property equal to "precision"', () => {
    const provider = new PrecisionToolProvider();
    expect(provider.name).toBe('precision');
  });

  it('has a tools array', () => {
    const provider = new PrecisionToolProvider();
    expect(Array.isArray(provider.tools)).toBe(true);
    expect(provider.tools.length).toBeGreaterThan(0);
  });

  it('has an execute() method', () => {
    const provider = new PrecisionToolProvider();
    expect(typeof provider.execute).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Tool listing
// ---------------------------------------------------------------------------

describe('PrecisionToolProvider — tool listing', () => {
  const EXPECTED_TOOLS = [
    'precision_read',
    'precision_write',
    'precision_edit',
    'precision_grep',
    'precision_glob',
    'precision_exec',
    'precision_fetch',
    'precision_symbols',
    'precision_discover',
    'precision_notebook',
  ];

  it('registers all expected tools', () => {
    const provider = new PrecisionToolProvider();
    const toolNames = provider.tools.map((t) => t.name);
    for (const expectedTool of EXPECTED_TOOLS) {
      expect(toolNames).toContain(expectedTool);
    }
  });

  it('each tool definition has name, description, and inputSchema', () => {
    const provider = new PrecisionToolProvider();
    for (const tool of provider.tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe('object');
    }
  });

  it('tool names are unique', () => {
    const provider = new PrecisionToolProvider();
    const names = provider.tools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ---------------------------------------------------------------------------
// Dispatch to correct handlers
// ---------------------------------------------------------------------------

describe('PrecisionToolProvider — dispatch', () => {
  it('dispatches precision_read and returns a result object', async () => {
    const provider = new PrecisionToolProvider();
    // Intentionally pass empty files array to trigger validation error — proves dispatch works
    const result = await provider.execute('precision_read', { files: [] });
    expect(typeof result.success).toBe('boolean');
    expect(result.success).toBe(false); // empty files
    expect(result.error).toBeDefined();
  });

  it('dispatches precision_write and returns a result object', async () => {
    const provider = new PrecisionToolProvider();
    const result = await provider.execute('precision_write', { files: [] });
    expect(typeof result.success).toBe('boolean');
    expect(result.success).toBe(false); // empty files
  });

  it('dispatches precision_edit and returns a result object', async () => {
    const provider = new PrecisionToolProvider();
    const result = await provider.execute('precision_edit', { edits: [] });
    expect(typeof result.success).toBe('boolean');
    expect(result.success).toBe(false); // empty edits
  });

  it('returns a ToolResult with durationMs', async () => {
    const provider = new PrecisionToolProvider();
    const result = await provider.execute('precision_read', { files: [] });
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Unknown tool handling
// ---------------------------------------------------------------------------

describe('PrecisionToolProvider — unknown tool', () => {
  it('returns success=false for an unknown tool name', async () => {
    const provider = new PrecisionToolProvider();
    const result = await provider.execute('precision_does_not_exist', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('unknown tool');
  });

  it('error message from unknown tool lists available tools', async () => {
    const provider = new PrecisionToolProvider();
    const result = await provider.execute('precision_unknown', {});
    expect(result.error).toContain('precision_read');
  });
});
