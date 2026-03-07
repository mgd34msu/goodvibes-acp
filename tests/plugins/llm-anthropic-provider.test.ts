/**
 * Tests for AnthropicProvider mapper methods.
 *
 * We test the mapper methods directly (they are package-private — no `private`
 * keyword) rather than mocking the network, keeping tests fast and deterministic.
 *
 * Tests cover:
 * - toAnthropicMessages: user text, assistant content blocks, tool results
 * - toAnthropicTools: tool definition mapping
 * - fromAnthropicContent: text blocks, tool_use blocks
 * - fromAnthropicStopReason: all four stop reasons + null fallback
 * - Constructor: no-arg (reads env), explicit apiKey
 */
import { describe, it, expect } from 'bun:test';
import { AnthropicProvider } from '../../src/plugins/agents/providers/anthropic.ts';
import type { LLMMessage, LLMToolDefinition, ContentBlock } from '../../src/types/llm.ts';
import type Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Constructor tests
// ---------------------------------------------------------------------------

describe('AnthropicProvider — constructor', () => {
  it('creates client without throwing when no apiKey provided', () => {
    // SDK reads ANTHROPIC_API_KEY env var; constructor should not throw
    expect(() => new AnthropicProvider()).not.toThrow();
  });

  it('creates client with explicit apiKey without throwing', () => {
    expect(() => new AnthropicProvider('sk-ant-test-key')).not.toThrow();
  });

  it('exposes name = "anthropic"', () => {
    const provider = new AnthropicProvider('sk-ant-test-key');
    expect(provider.name).toBe('anthropic');
  });
});

// ---------------------------------------------------------------------------
// toAnthropicMessages
// ---------------------------------------------------------------------------

describe('AnthropicProvider — toAnthropicMessages', () => {
  const provider = new AnthropicProvider('sk-ant-test-key');

  it('maps user message with string content', () => {
    const messages: LLMMessage[] = [{ role: 'user', content: 'Hello world' }];
    const result = provider.toAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello world' });
  });

  it('maps user message with ContentBlock[] (text blocks only)', () => {
    const messages: LLMMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hi there' }],
      },
    ];
    const result = provider.toAnthropicMessages(messages);
    expect(result[0]).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'Hi there' }],
    });
  });

  it('maps assistant message with string content', () => {
    const messages: LLMMessage[] = [{ role: 'assistant', content: 'I can help!' }];
    const result = provider.toAnthropicMessages(messages);
    expect(result[0]).toEqual({ role: 'assistant', content: 'I can help!' });
  });

  it('maps assistant message with text ContentBlock[]', () => {
    const messages: LLMMessage[] = [
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Thinking...' }],
      },
    ];
    const result = provider.toAnthropicMessages(messages);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Thinking...' }],
    });
  });

  it('maps assistant message with tool_use ContentBlock', () => {
    const messages: LLMMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool-abc', name: 'read_file', input: { path: '/tmp/foo' } },
        ],
      },
    ];
    const result = provider.toAnthropicMessages(messages);
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'tool-abc', name: 'read_file', input: { path: '/tmp/foo' } },
      ],
    });
  });

  it('maps tool role → user role with tool_result content blocks', () => {
    const messages: LLMMessage[] = [
      {
        role: 'tool',
        content: [
          { type: 'tool_result', tool_use_id: 'tool-abc', content: 'file contents here' },
        ],
      },
    ];
    const result = provider.toAnthropicMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    const content = result[0].content as Anthropic.ToolResultBlockParam[];
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('tool_result');
    expect(content[0].tool_use_id).toBe('tool-abc');
    expect(content[0].content).toBe('file contents here');
  });

  it('maps tool result with is_error flag', () => {
    const messages: LLMMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-xyz',
            content: 'error: file not found',
            is_error: true,
          },
        ],
      },
    ];
    const result = provider.toAnthropicMessages(messages);
    const content = result[0].content as Anthropic.ToolResultBlockParam[];
    expect(content[0].is_error).toBe(true);
  });

  it('maps multiple messages in order', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Third' },
    ];
    const result = provider.toAnthropicMessages(messages);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// toAnthropicTools
// ---------------------------------------------------------------------------

describe('AnthropicProvider — toAnthropicTools', () => {
  const provider = new AnthropicProvider('sk-ant-test-key');

  it('maps a single tool definition', () => {
    const tools: LLMToolDefinition[] = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    ];
    const result = provider.toAnthropicTools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('read_file');
    expect(result[0].description).toBe('Read the contents of a file');
    expect(result[0].input_schema.type).toBe('object');
    expect((result[0].input_schema as Record<string, unknown>).properties).toEqual({
      path: { type: 'string' },
    });
    expect((result[0].input_schema as Record<string, unknown>).required).toEqual(['path']);
  });

  it('maps multiple tools preserving order', () => {
    const tools: LLMToolDefinition[] = [
      { name: 'tool_a', description: 'A', input_schema: {} },
      { name: 'tool_b', description: 'B', input_schema: {} },
    ];
    const result = provider.toAnthropicTools(tools);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('tool_a');
    expect(result[1].name).toBe('tool_b');
  });

  it('maps empty tools array to empty array', () => {
    expect(provider.toAnthropicTools([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fromAnthropicContent
// ---------------------------------------------------------------------------

describe('AnthropicProvider — fromAnthropicContent', () => {
  const provider = new AnthropicProvider('sk-ant-test-key');

  it('maps text block', () => {
    const blocks: Anthropic.ContentBlock[] = [{ type: 'text', text: 'Hello' }];
    const result = provider.fromAnthropicContent(blocks);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', text: 'Hello' });
  });

  it('maps tool_use block', () => {
    const blocks: Anthropic.ContentBlock[] = [
      {
        type: 'tool_use',
        id: 'toolu_01',
        name: 'read_file',
        input: { path: '/tmp/test.ts' },
      },
    ];
    const result = provider.fromAnthropicContent(blocks);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'tool_use',
      id: 'toolu_01',
      name: 'read_file',
      input: { path: '/tmp/test.ts' },
    });
  });

  it('maps mixed text and tool_use blocks preserving order', () => {
    const blocks: Anthropic.ContentBlock[] = [
      { type: 'text', text: 'I will read the file.' },
      { type: 'tool_use', id: 'toolu_02', name: 'read_file', input: { path: '/tmp/x' } },
    ];
    const result = provider.fromAnthropicContent(blocks);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('tool_use');
  });

  it('maps empty content array to empty array', () => {
    expect(provider.fromAnthropicContent([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fromAnthropicStopReason
// ---------------------------------------------------------------------------

describe('AnthropicProvider — fromAnthropicStopReason', () => {
  const provider = new AnthropicProvider('sk-ant-test-key');

  it('maps end_turn', () => {
    expect(provider.fromAnthropicStopReason('end_turn')).toBe('end_turn');
  });

  it('maps tool_use', () => {
    expect(provider.fromAnthropicStopReason('tool_use')).toBe('tool_use');
  });

  it('maps max_tokens', () => {
    expect(provider.fromAnthropicStopReason('max_tokens')).toBe('max_tokens');
  });

  it('maps stop_sequence', () => {
    expect(provider.fromAnthropicStopReason('stop_sequence')).toBe('stop_sequence');
  });

  it('maps null to end_turn fallback', () => {
    expect(provider.fromAnthropicStopReason(null)).toBe('end_turn');
  });

  it('maps unknown string to end_turn fallback', () => {
    expect(provider.fromAnthropicStopReason('unknown_reason')).toBe('end_turn');
  });
});
