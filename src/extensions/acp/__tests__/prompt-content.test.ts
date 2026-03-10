/**
 * Tests for processPromptBlocks() — ACP embedded resource content processing.
 *
 * Verifies that text, resource (text + blob), resource_link, and mixed
 * prompt content blocks are correctly processed into task strings and rich
 * history content arrays.
 */
import { describe, it, expect } from 'bun:test';
import type * as schema from '@agentclientprotocol/sdk';
import { processPromptBlocks } from '../agent.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textBlock(text: string): schema.ContentBlock {
  return { type: 'text', text } as schema.ContentBlock;
}

function resourceTextBlock(uri: string, text: string, mimeType?: string): schema.ContentBlock {
  return {
    type: 'resource',
    resource: { uri, text, ...(mimeType ? { mimeType } : {}) },
  } as unknown as schema.ContentBlock;
}

function resourceBlobBlock(uri: string, blob: string, mimeType?: string): schema.ContentBlock {
  return {
    type: 'resource',
    resource: { uri, blob, ...(mimeType ? { mimeType } : {}) },
  } as unknown as schema.ContentBlock;
}

function resourceLinkBlock(uri: string, name?: string): schema.ContentBlock {
  return {
    type: 'resource_link',
    resource_link: { uri, ...(name ? { name } : {}) },
  } as unknown as schema.ContentBlock;
}

// ---------------------------------------------------------------------------
// Empty prompt
// ---------------------------------------------------------------------------

describe('processPromptBlocks — empty prompt', () => {
  it('returns empty task and empty richContent for empty array', () => {
    const result = processPromptBlocks([]);
    expect(result.task).toBe('');
    expect(result.richContent).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Text-only prompts (existing behaviour preserved)
// ---------------------------------------------------------------------------

describe('processPromptBlocks — text-only', () => {
  it('single text block: task equals text, richContent has one text block', () => {
    const result = processPromptBlocks([textBlock('Hello world')]);
    expect(result.task).toBe('Hello world');
    expect(result.richContent).toHaveLength(1);
    expect(result.richContent[0]).toMatchObject({ type: 'text', text: 'Hello world' });
  });

  it('multiple text blocks: joined with newline', () => {
    const result = processPromptBlocks([
      textBlock('First line'),
      textBlock('Second line'),
    ]);
    expect(result.task).toBe('First line\nSecond line');
    expect(result.richContent).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Embedded text resource extraction
// ---------------------------------------------------------------------------

describe('processPromptBlocks — embedded text resource', () => {
  it('extracts resource text with URI delimiter in task', () => {
    const uri = 'file:///home/user/script.py';
    const code = 'def hello():\n    print(\'Hello, world!\')';
    const result = processPromptBlocks([resourceTextBlock(uri, code, 'text/x-python')]);

    expect(result.task).toContain(`--- Resource: ${uri} ---`);
    expect(result.task).toContain(code);
  });

  it('preserves resource block in richContent', () => {
    const uri = 'file:///readme.md';
    const result = processPromptBlocks([resourceTextBlock(uri, '# Readme', 'text/markdown')]);
    expect(result.richContent).toHaveLength(1);
    expect(result.richContent[0]).toMatchObject({ type: 'resource' });
  });

  it('handles resource without mimeType', () => {
    const uri = 'file:///data.txt';
    const result = processPromptBlocks([resourceTextBlock(uri, 'raw text')]);
    expect(result.task).toContain(`--- Resource: ${uri} ---`);
    expect(result.task).toContain('raw text');
  });
});

// ---------------------------------------------------------------------------
// Embedded blob resource — text mimeType → decoded
// ---------------------------------------------------------------------------

describe('processPromptBlocks — blob resource (text mimeType)', () => {
  it('decodes base64 blob for text/plain mimeType', () => {
    const uri = 'file:///hello.txt';
    const original = 'Hello from blob!';
    const blob = Buffer.from(original, 'utf-8').toString('base64');
    const result = processPromptBlocks([resourceBlobBlock(uri, blob, 'text/plain')]);

    expect(result.task).toContain(`--- Resource: ${uri} ---`);
    expect(result.task).toContain(original);
  });

  it('decodes base64 blob for application/json mimeType', () => {
    const uri = 'file:///config.json';
    const original = '{"key": "value"}';
    const blob = Buffer.from(original, 'utf-8').toString('base64');
    const result = processPromptBlocks([resourceBlobBlock(uri, blob, 'application/json')]);

    expect(result.task).toContain(original);
  });

  it('decodes base64 blob for application/javascript mimeType', () => {
    const uri = 'file:///script.js';
    const original = 'console.log("hi");';
    const blob = Buffer.from(original, 'utf-8').toString('base64');
    const result = processPromptBlocks([resourceBlobBlock(uri, blob, 'application/javascript')]);

    expect(result.task).toContain(original);
  });
});

// ---------------------------------------------------------------------------
// Embedded blob resource — binary mimeType → placeholder
// ---------------------------------------------------------------------------

describe('processPromptBlocks — blob resource (binary mimeType)', () => {
  it('uses placeholder for image/png mimeType', () => {
    const uri = 'file:///image.png';
    const blob = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    const result = processPromptBlocks([resourceBlobBlock(uri, blob, 'image/png')]);

    expect(result.task).toContain(`[binary resource: ${uri}]`);
    expect(result.task).not.toContain('PNG');
  });

  it('uses placeholder for application/octet-stream mimeType', () => {
    const uri = 'file:///data.bin';
    const blob = Buffer.from([0x00, 0x01, 0x02]).toString('base64');
    const result = processPromptBlocks([resourceBlobBlock(uri, blob, 'application/octet-stream')]);

    expect(result.task).toContain(`[binary resource: ${uri}]`);
  });

  it('uses placeholder for blob with no mimeType', () => {
    const uri = 'file:///unknown';
    const blob = Buffer.from([0x00]).toString('base64');
    const result = processPromptBlocks([resourceBlobBlock(uri, blob)]);

    expect(result.task).toContain(`[binary resource: ${uri}]`);
  });
});

// ---------------------------------------------------------------------------
// Resource link handling
// ---------------------------------------------------------------------------

describe('processPromptBlocks — resource_link', () => {
  it('includes resource link as placeholder with URI and name', () => {
    const uri = 'https://example.com/api/docs';
    const name = 'API Documentation';
    const result = processPromptBlocks([resourceLinkBlock(uri, name)]);

    expect(result.task).toContain(`[Resource link: ${uri} - ${name}]`);
  });

  it('falls back to URI when name is absent', () => {
    const uri = 'https://example.com/docs';
    const result = processPromptBlocks([resourceLinkBlock(uri)]);

    expect(result.task).toContain(`[Resource link: ${uri} - ${uri}]`);
  });

  it('preserves resource_link block in richContent', () => {
    const result = processPromptBlocks([resourceLinkBlock('https://example.com', 'Example')]);
    expect(result.richContent).toHaveLength(1);
    expect(result.richContent[0]).toMatchObject({ type: 'resource_link' });
  });
});

// ---------------------------------------------------------------------------
// Mixed content
// ---------------------------------------------------------------------------

describe('processPromptBlocks — mixed content', () => {
  it('processes text + resource + resource_link in order', () => {
    const uri = 'file:///code.ts';
    const linkUri = 'https://docs.example.com';
    const linkName = 'Docs';
    const code = 'export const x = 1;';

    const blocks = [
      textBlock('Please review this code:'),
      resourceTextBlock(uri, code, 'text/typescript'),
      resourceLinkBlock(linkUri, linkName),
    ];

    const result = processPromptBlocks(blocks);

    expect(result.task).toContain('Please review this code:');
    expect(result.task).toContain(`--- Resource: ${uri} ---`);
    expect(result.task).toContain(code);
    expect(result.task).toContain(`[Resource link: ${linkUri} - ${linkName}]`);
    expect(result.richContent).toHaveLength(3);
    expect(result.richContent[0]).toMatchObject({ type: 'text' });
    expect(result.richContent[1]).toMatchObject({ type: 'resource' });
    expect(result.richContent[2]).toMatchObject({ type: 'resource_link' });
  });

  it('task string order matches block order', () => {
    const result = processPromptBlocks([
      textBlock('A'),
      resourceLinkBlock('https://b.com', 'B'),
      textBlock('C'),
    ]);

    const aIdx = result.task.indexOf('A');
    const bIdx = result.task.indexOf('[Resource link: https://b.com');
    const cIdx = result.task.lastIndexOf('C');
    expect(aIdx).toBeLessThan(bIdx);
    expect(bIdx).toBeLessThan(cIdx);
  });
});
