/**
 * Tests for OpenAICompatibleProvider.
 *
 * Tests cover:
 * - buildChatUrl: URL normalization
 * - toOpenAIMessages: system prompt, user, assistant, tool roles
 * - toOpenAITools: tool definition mapping
 * - fromOpenAIMessage: text content, tool_calls, mixed, empty
 * - fromOpenAIFinishReason: all known reasons + null fallback
 * - chat(): request shape, response mapping, HTTP errors, JSON errors, missing choices
 * - stream(): SSE parsing, text deltas, tool call deltas, [DONE], abort signal, HTTP errors
 * - Edge cases: empty content, missing usage, null tool_calls
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  OpenAICompatibleProvider,
  buildChatUrl,
} from '../../src/plugins/agents/providers/openai-compatible.ts';
import type { ChatParams, LLMMessage, LLMToolDefinition, ContentBlock } from '../../src/types/llm.ts';

// ---------------------------------------------------------------------------
// Helpers — mock fetch
// ---------------------------------------------------------------------------

type MockFetchImpl = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

let mockFetchImpl: MockFetchImpl | null = null;
const originalFetch = globalThis.fetch;

function setupMockFetch(impl: MockFetchImpl): void {
  mockFetchImpl = impl;
  globalThis.fetch = (url, init) => impl(url as string, init);
}

function teardownMockFetch(): void {
  mockFetchImpl = null;
  globalThis.fetch = originalFetch;
}

/** Creates a Response with JSON body */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Creates an SSE stream Response from an array of data strings */
function sseResponse(lines: string[], status = 200): Response {
  const body = lines.map((l) => (l === '[DONE]' ? `data: [DONE]\n` : `data: ${l}\n`)).join('\n');
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

/** Collect all chunks from an AsyncIterable */
async function collectChunks<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const chunks: T[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// buildChatUrl tests
// ---------------------------------------------------------------------------

describe('buildChatUrl', () => {
  it('appends /chat/completions to bare base URL', () => {
    expect(buildChatUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('strips trailing slash before appending', () => {
    expect(buildChatUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('is idempotent when URL already ends with /chat/completions', () => {
    expect(buildChatUrl('https://api.openai.com/v1/chat/completions')).toBe(
      'https://api.openai.com/v1/chat/completions',
    );
  });

  it('handles localhost URL without path', () => {
    expect(buildChatUrl('http://localhost:11434')).toBe('http://localhost:11434/chat/completions');
  });

  it('handles non-/v1 base path', () => {
    expect(buildChatUrl('https://inceptionlabs.ai/api')).toBe(
      'https://inceptionlabs.ai/api/chat/completions',
    );
  });
});

// ---------------------------------------------------------------------------
// Constructor tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — constructor', () => {
  it('uses default name when not provided', () => {
    const p = new OpenAICompatibleProvider({ apiKey: 'key', baseUrl: 'https://api.openai.com/v1' });
    expect(p.name).toBe('openai-compatible');
  });

  it('uses custom name when provided', () => {
    const p = new OpenAICompatibleProvider({
      apiKey: 'key',
      baseUrl: 'https://api.openai.com/v1',
      name: 'mercury',
    });
    expect(p.name).toBe('mercury');
  });
});

// ---------------------------------------------------------------------------
// toOpenAIMessages tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — toOpenAIMessages', () => {
  const p = new OpenAICompatibleProvider({ apiKey: 'key', baseUrl: 'https://api.openai.com/v1' });

  it('prepends system message from systemPrompt', () => {
    const result = p.toOpenAIMessages('You are helpful.', []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'system', content: 'You are helpful.' });
  });

  it('omits system message when systemPrompt is empty string', () => {
    const result = p.toOpenAIMessages('', [{ role: 'user', content: 'Hi' }]);
    expect(result[0].role).toBe('user');
  });

  it('maps user message with string content', () => {
    const msgs: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
    const result = p.toOpenAIMessages('', msgs);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('maps user message with ContentBlock[] (concatenates text)', () => {
    const msgs: LLMMessage[] = [
      { role: 'user', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
    ];
    const result = p.toOpenAIMessages('', msgs);
    expect(result[0]).toEqual({ role: 'user', content: 'Hello world' });
  });

  it('maps assistant message with string content', () => {
    const msgs: LLMMessage[] = [{ role: 'assistant', content: 'I can help!' }];
    const result = p.toOpenAIMessages('', msgs);
    expect(result[0]).toEqual({ role: 'assistant', content: 'I can help!' });
  });

  it('maps assistant message with text ContentBlock[]', () => {
    const msgs: LLMMessage[] = [
      { role: 'assistant', content: [{ type: 'text', text: 'Thinking...' }] },
    ];
    const result = p.toOpenAIMessages('', msgs);
    expect(result[0]).toEqual({ role: 'assistant', content: 'Thinking...', });
    expect((result[0] as { tool_calls?: unknown }).tool_calls).toBeUndefined();
  });

  it('maps assistant message with tool_use ContentBlock', () => {
    const msgs: LLMMessage[] = [
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call-1', name: 'read_file', input: { path: '/tmp/x' } },
        ],
      },
    ];
    const result = p.toOpenAIMessages('', msgs);
    expect(result[0].role).toBe('assistant');
    expect((result[0] as { tool_calls: unknown[] }).tool_calls).toHaveLength(1);
    const tc = (result[0] as { tool_calls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }).tool_calls[0];
    expect(tc.id).toBe('call-1');
    expect(tc.type).toBe('function');
    expect(tc.function.name).toBe('read_file');
    expect(JSON.parse(tc.function.arguments)).toEqual({ path: '/tmp/x' });
  });

  it('maps tool role → individual tool messages per tool_result block', () => {
    const msgs: LLMMessage[] = [
      {
        role: 'tool',
        content: [
          { type: 'tool_result', tool_use_id: 'call-1', content: 'file contents' },
          { type: 'tool_result', tool_use_id: 'call-2', content: 'other result' },
        ],
      },
    ];
    const result = p.toOpenAIMessages('', msgs);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ role: 'tool', tool_call_id: 'call-1', content: 'file contents' });
    expect(result[1]).toEqual({ role: 'tool', tool_call_id: 'call-2', content: 'other result' });
  });

  it('skips stray system messages in the messages array', () => {
    const msgs: LLMMessage[] = [
      { role: 'system', content: 'ignored' },
      { role: 'user', content: 'Hello' },
    ];
    const result = p.toOpenAIMessages('', msgs);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
  });

  it('maps multiple messages preserving order', () => {
    const msgs: LLMMessage[] = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Third' },
    ];
    const result = p.toOpenAIMessages('sys', msgs);
    // system + 3 messages
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('system');
    expect(result[1].role).toBe('user');
    expect(result[2].role).toBe('assistant');
    expect(result[3].role).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// toOpenAITools tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — toOpenAITools', () => {
  const p = new OpenAICompatibleProvider({ apiKey: 'key', baseUrl: 'https://api.openai.com/v1' });

  it('maps a single tool definition', () => {
    const tools: LLMToolDefinition[] = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: { properties: { path: { type: 'string' } }, required: ['path'] },
      },
    ];
    const result = p.toOpenAITools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('function');
    expect(result[0].function.name).toBe('read_file');
    expect(result[0].function.description).toBe('Read the contents of a file');
    expect(result[0].function.parameters.type).toBe('object');
    expect((result[0].function.parameters as Record<string, unknown>).required).toEqual(['path']);
  });

  it('maps multiple tools preserving order', () => {
    const tools: LLMToolDefinition[] = [
      { name: 'tool_a', description: 'A', input_schema: {} },
      { name: 'tool_b', description: 'B', input_schema: {} },
    ];
    const result = p.toOpenAITools(tools);
    expect(result).toHaveLength(2);
    expect(result[0].function.name).toBe('tool_a');
    expect(result[1].function.name).toBe('tool_b');
  });

  it('maps empty tools array to empty array', () => {
    expect(p.toOpenAITools([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fromOpenAIMessage tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — fromOpenAIMessage', () => {
  const p = new OpenAICompatibleProvider({ apiKey: 'key', baseUrl: 'https://api.openai.com/v1' });

  it('maps text content block', () => {
    const result = p.fromOpenAIMessage({ content: 'Hello world', tool_calls: undefined });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', text: 'Hello world' });
  });

  it('maps tool_call to tool_use block', () => {
    const result = p.fromOpenAIMessage({
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path":"/tmp/x"}' },
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'tool_use',
      id: 'call-1',
      name: 'read_file',
      input: { path: '/tmp/x' },
    });
  });

  it('maps tool_call with invalid JSON arguments — keeps as string', () => {
    const result = p.fromOpenAIMessage({
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'tool', arguments: 'not-json' },
        },
      ],
    });
    const block = result[0] as Extract<ContentBlock, { type: 'tool_use' }>;
    expect(block.input).toBe('not-json');
  });

  it('maps mixed text and tool_calls', () => {
    const result = p.fromOpenAIMessage({
      content: 'I will call a tool.',
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'do_thing', arguments: '{}' },
        },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('tool_use');
  });

  it('returns empty array for null content and no tool_calls', () => {
    const result = p.fromOpenAIMessage({ content: null });
    expect(result).toEqual([]);
  });

  it('returns empty array for empty content string', () => {
    const result = p.fromOpenAIMessage({ content: '' });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fromOpenAIFinishReason tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — fromOpenAIFinishReason', () => {
  const p = new OpenAICompatibleProvider({ apiKey: 'key', baseUrl: 'https://api.openai.com/v1' });

  it('maps stop → end_turn', () => {
    expect(p.fromOpenAIFinishReason('stop')).toBe('end_turn');
  });

  it('maps tool_calls → tool_use', () => {
    expect(p.fromOpenAIFinishReason('tool_calls')).toBe('tool_use');
  });

  it('maps length → max_tokens', () => {
    expect(p.fromOpenAIFinishReason('length')).toBe('max_tokens');
  });

  it('maps stop_sequence → stop_sequence', () => {
    expect(p.fromOpenAIFinishReason('stop_sequence')).toBe('stop_sequence');
  });

  it('maps null → end_turn fallback', () => {
    expect(p.fromOpenAIFinishReason(null)).toBe('end_turn');
  });

  it('maps unknown string → end_turn fallback', () => {
    expect(p.fromOpenAIFinishReason('unknown_reason')).toBe('end_turn');
  });
});

// ---------------------------------------------------------------------------
// chat() tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — chat()', () => {
  beforeEach(() => {
    // No-op; individual tests call setupMockFetch
  });

  afterEach(() => {
    teardownMockFetch();
  });

  const provider = new OpenAICompatibleProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com/v1',
  });

  const baseParams: ChatParams = {
    model: 'test-model',
    systemPrompt: 'You are helpful.',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('sends POST to correct URL with Authorization header', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};

    setupMockFetch(async (url, init) => {
      capturedUrl = url as string;
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse({
        choices: [{ message: { content: 'Hi!', tool_calls: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    });

    await provider.chat(baseParams);
    expect(capturedUrl).toBe('https://api.test.com/v1/chat/completions');
    expect(capturedHeaders['Authorization']).toBe('Bearer test-key');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
  });

  it('sends correct request body with system message', async () => {
    let capturedBody: Record<string, unknown> = {};

    setupMockFetch(async (_, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        choices: [{ message: { content: 'Hi!', tool_calls: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    });

    await provider.chat(baseParams);
    expect(capturedBody.model).toBe('test-model');
    const messages = capturedBody.messages as Array<{ role: string; content: string }>;
    expect(messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
    expect(messages[1]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('maps text response correctly', async () => {
    setupMockFetch(async () =>
      jsonResponse({
        choices: [{ message: { content: 'Hello there!', tool_calls: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
      }),
    );

    const result = await provider.chat(baseParams);
    expect(result.content).toEqual([{ type: 'text', text: 'Hello there!' }]);
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage.inputTokens).toBe(20);
    expect(result.usage.outputTokens).toBe(10);
  });

  it('maps tool_calls response correctly', async () => {
    setupMockFetch(async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-abc',
                  type: 'function',
                  function: { name: 'read_file', arguments: '{"path":"/tmp/test"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 30, completion_tokens: 15 },
      }),
    );

    const result = await provider.chat(baseParams);
    expect(result.stopReason).toBe('tool_use');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toEqual({
      type: 'tool_use',
      id: 'call-abc',
      name: 'read_file',
      input: { path: '/tmp/test' },
    });
  });

  it('includes tools in request when provided', async () => {
    let capturedBody: Record<string, unknown> = {};

    setupMockFetch(async (_, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        choices: [{ message: { content: 'ok', tool_calls: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    });

    const paramsWithTools: ChatParams = {
      ...baseParams,
      tools: [
        { name: 'read_file', description: 'Read a file', input_schema: { properties: {} } },
      ],
    };
    await provider.chat(paramsWithTools);
    const tools = capturedBody.tools as unknown[];
    expect(tools).toHaveLength(1);
    expect((tools[0] as { type: string }).type).toBe('function');
  });

  it('includes maxTokens and temperature in request when provided', async () => {
    let capturedBody: Record<string, unknown> = {};

    setupMockFetch(async (_, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return jsonResponse({
        choices: [{ message: { content: 'ok', tool_calls: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
    });

    await provider.chat({ ...baseParams, maxTokens: 512, temperature: 0.7 });
    expect(capturedBody.max_tokens).toBe(512);
    expect(capturedBody.temperature).toBe(0.7);
  });

  it('handles missing usage gracefully (defaults to 0)', async () => {
    setupMockFetch(async () =>
      jsonResponse({
        choices: [{ message: { content: 'ok', tool_calls: null }, finish_reason: 'stop' }],
        // no usage field
      }),
    );

    const result = await provider.chat(baseParams);
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  it('throws on HTTP error with status code in message', async () => {
    setupMockFetch(async () =>
      new Response('Rate limit exceeded', { status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(provider.chat(baseParams)).rejects.toThrow('429');
  });

  it('throws when response contains no choices', async () => {
    setupMockFetch(async () => jsonResponse({ choices: [] }));
    await expect(provider.chat(baseParams)).rejects.toThrow('no choices');
  });

  it('throws on JSON parse error', async () => {
    setupMockFetch(async () => new Response('not json', { status: 200 }));
    await expect(provider.chat(baseParams)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// stream() tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — stream()', () => {
  afterEach(() => {
    teardownMockFetch();
  });

  const provider = new OpenAICompatibleProvider({
    apiKey: 'test-key',
    baseUrl: 'https://api.test.com/v1',
  });

  const baseParams: ChatParams = {
    model: 'test-model',
    systemPrompt: 'You are helpful.',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  it('emits text_delta chunks from SSE stream', async () => {
    setupMockFetch(async () =>
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hello' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: { content: ' world' }, finish_reason: null }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        '[DONE]',
      ]),
    );

    const chunks = await collectChunks(provider.stream(baseParams));
    const textChunks = chunks.filter((c) => c.type === 'text_delta');
    expect(textChunks).toHaveLength(2);
    expect(textChunks[0]).toEqual({ type: 'text_delta', text: 'Hello' });
    expect(textChunks[1]).toEqual({ type: 'text_delta', text: ' world' });
  });

  it('emits stop chunk on [DONE]', async () => {
    setupMockFetch(async () =>
      sseResponse([
        JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: null }] }),
        JSON.stringify({
          choices: [{ delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        }),
        '[DONE]',
      ]),
    );

    const chunks = await collectChunks(provider.stream(baseParams));
    const stopChunk = chunks.find((c) => c.type === 'stop');
    expect(stopChunk).toBeDefined();
    expect(stopChunk).toMatchObject({
      type: 'stop',
      stopReason: 'end_turn',
    });
  });

  it('emits tool_use_start and tool_use_delta for tool call streaming', async () => {
    setupMockFetch(async () =>
      sseResponse([
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '' } }],
              },
              finish_reason: null,
            },
          ],
        }),
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: '{"path":' } }],
              },
              finish_reason: null,
            },
          ],
        }),
        JSON.stringify({
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: '"/tmp/x"}' } }],
              },
              finish_reason: null,
            },
          ],
        }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
        '[DONE]',
      ]),
    );

    const chunks = await collectChunks(provider.stream(baseParams));
    const startChunk = chunks.find((c) => c.type === 'tool_use_start');
    expect(startChunk).toBeDefined();
    expect(startChunk).toMatchObject({ type: 'tool_use_start', id: 'call-1', name: 'read_file' });

    const deltaChunks = chunks.filter((c) => c.type === 'tool_use_delta');
    expect(deltaChunks.length).toBeGreaterThanOrEqual(1);

    const stopChunk = chunks.find((c) => c.type === 'stop');
    expect(stopChunk).toMatchObject({ type: 'stop', stopReason: 'tool_use' });
  });

  it('does not emit tool_use_start twice for the same tool index', async () => {
    setupMockFetch(async () =>
      sseResponse([
        JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'tool', arguments: '' } }] }, finish_reason: null }],
        }),
        JSON.stringify({
          choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{}' } }] }, finish_reason: null }],
        }),
        '[DONE]',
      ]),
    );

    const chunks = await collectChunks(provider.stream(baseParams));
    const starts = chunks.filter((c) => c.type === 'tool_use_start');
    expect(starts).toHaveLength(1);
  });

  it('sets stream: true and stream_options in request body', async () => {
    let capturedBody: Record<string, unknown> = {};

    setupMockFetch(async (_, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return sseResponse([
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
        '[DONE]',
      ]);
    });

    await collectChunks(provider.stream(baseParams));
    expect(capturedBody.stream).toBe(true);
    expect((capturedBody.stream_options as { include_usage: boolean }).include_usage).toBe(true);
  });

  it('throws on HTTP error', async () => {
    setupMockFetch(async () => new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }));

    await expect(collectChunks(provider.stream(baseParams))).rejects.toThrow('401');
  });

  it('skips empty and comment SSE lines', async () => {
    setupMockFetch(async () => {
      const body = [
        '',
        ': keep-alive',
        `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: null }] })}`,
        '',
        'data: [DONE]',
      ].join('\n');
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const chunks = await collectChunks(provider.stream(baseParams));
    const textChunks = chunks.filter((c) => c.type === 'text_delta');
    expect(textChunks).toHaveLength(1);
    expect(textChunks[0]).toMatchObject({ type: 'text_delta', text: 'Hi' });
  });

  it('emits stop chunk when stream ends without [DONE]', async () => {
    setupMockFetch(async () => {
      const body = `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop' }] })}\n`;
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const chunks = await collectChunks(provider.stream(baseParams));
    const stopChunk = chunks.find((c) => c.type === 'stop');
    expect(stopChunk).toBeDefined();
    expect(stopChunk).toMatchObject({ type: 'stop', stopReason: 'end_turn' });
  });

  it('handles abort signal gracefully', async () => {
    const controller = new AbortController();

    setupMockFetch(async (_, init) => {
      // Abort before returning the response
      controller.abort();
      // Return a response that honors the signal (fetch throws on abort)
      throw new DOMException('The operation was aborted.', 'AbortError');
    });

    const paramsWithSignal: ChatParams = {
      ...baseParams,
      signal: controller.signal,
    };

    await expect(collectChunks(provider.stream(paramsWithSignal))).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildRequest tests
// ---------------------------------------------------------------------------

describe('OpenAICompatibleProvider — buildRequest', () => {
  const p = new OpenAICompatibleProvider({ apiKey: 'key', baseUrl: 'https://api.openai.com/v1' });

  it('omits stream flag when stream=false', () => {
    const req = p.buildRequest(
      { model: 'gpt-4', systemPrompt: 'sys', messages: [], maxTokens: 1024 },
      false,
    );
    expect(req.stream).toBeUndefined();
    expect(req.stream_options).toBeUndefined();
  });

  it('sets stream=true and stream_options when stream=true', () => {
    const req = p.buildRequest({ model: 'gpt-4', systemPrompt: 'sys', messages: [] }, true);
    expect(req.stream).toBe(true);
    expect(req.stream_options).toEqual({ include_usage: true });
  });

  it('omits tools when tools array is empty', () => {
    const req = p.buildRequest(
      { model: 'gpt-4', systemPrompt: '', messages: [], tools: [] },
      false,
    );
    expect(req.tools).toBeUndefined();
  });

  it('omits maxTokens when not provided', () => {
    const req = p.buildRequest({ model: 'gpt-4', systemPrompt: '', messages: [] }, false);
    expect(req.max_tokens).toBeUndefined();
  });

  it('omits temperature when not provided', () => {
    const req = p.buildRequest({ model: 'gpt-4', systemPrompt: '', messages: [] }, false);
    expect(req.temperature).toBeUndefined();
  });
});
