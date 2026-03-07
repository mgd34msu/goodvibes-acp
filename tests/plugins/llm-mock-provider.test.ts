/**
 * Tests for MockProvider (L3 ILLMProvider test double).
 * Covers enqueue/drain, call recording, empty-queue error,
 * streaming, and FIFO ordering.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { MockProvider } from '../../src/plugins/agents/providers/mock.ts';
import type { ChatParams, ChatResponse } from '../../src/types/llm.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(overrides: Partial<ChatParams> = {}): ChatParams {
  return {
    model: 'claude-sonnet-4-6',
    systemPrompt: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    ...overrides,
  };
}

function makeResponse(text: string): ChatResponse {
  return {
    content: [{ type: 'text', text }],
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 5 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MockProvider — enqueue + chat', () => {
  let mock: MockProvider;

  beforeEach(() => {
    mock = new MockProvider();
  });

  it('returns queued response', async () => {
    const response = makeResponse('hello');
    mock.enqueue(response);
    const result = await mock.chat(makeParams());
    expect(result).toEqual(response);
  });

  it('records params in calls array', async () => {
    mock.enqueue(makeResponse('hi'));
    const params = makeParams({ model: 'test-model' });
    await mock.chat(params);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]).toEqual(params);
  });

  it('throws when queue is empty', async () => {
    await expect(mock.chat(makeParams())).rejects.toThrow('MockProvider: no responses queued');
  });

  it('drains multiple responses in FIFO order', async () => {
    const r1 = makeResponse('first');
    const r2 = makeResponse('second');
    const r3 = makeResponse('third');
    mock.enqueue(r1);
    mock.enqueue(r2);
    mock.enqueue(r3);

    expect(await mock.chat(makeParams())).toEqual(r1);
    expect(await mock.chat(makeParams())).toEqual(r2);
    expect(await mock.chat(makeParams())).toEqual(r3);
  });

  it('calls array grows with each chat call', async () => {
    mock.enqueue(makeResponse('a'));
    mock.enqueue(makeResponse('b'));
    const p1 = makeParams({ model: 'model-a' });
    const p2 = makeParams({ model: 'model-b' });
    await mock.chat(p1);
    await mock.chat(p2);
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls[0].model).toBe('model-a');
    expect(mock.calls[1].model).toBe('model-b');
  });
});

describe('MockProvider — calls array is readonly', () => {
  it('returns a readonly snapshot (array, not mutable reference)', async () => {
    const mock = new MockProvider();
    mock.enqueue(makeResponse('hello'));
    await mock.chat(makeParams());
    const snapshot = mock.calls;
    // TypeScript enforces readonly, but at runtime it's still an array
    // Verify the getter returns the same reference (snapshot reflects live state)
    mock.enqueue(makeResponse('world'));
    await mock.chat(makeParams());
    expect(mock.calls).toHaveLength(2);
    // The original snapshot also reflects the same backing array
    expect(snapshot).toHaveLength(2);
  });
});

describe('MockProvider — stream', () => {
  let mock: MockProvider;

  beforeEach(() => {
    mock = new MockProvider();
  });

  it('yields text_delta chunks then stop chunk', async () => {
    const response: ChatResponse = {
      content: [{ type: 'text', text: 'hello world' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
    mock.enqueue(response);

    const chunks = [];
    for await (const chunk of mock.stream(makeParams())) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ type: 'text_delta', text: 'hello world' });
    expect(chunks[1]).toEqual({
      type: 'stop',
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    });
  });

  it('yields only stop chunk when content has no text blocks (tool_use only)', async () => {
    const response: ChatResponse = {
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'read_file', input: { path: '/tmp/foo' } },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 15, outputTokens: 8 },
    };
    mock.enqueue(response);

    const chunks = [];
    for await (const chunk of mock.stream(makeParams())) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      type: 'stop',
      stopReason: 'tool_use',
      usage: { inputTokens: 15, outputTokens: 8 },
    });
  });

  it('stream records params in calls array', async () => {
    mock.enqueue(makeResponse('streamed'));
    const params = makeParams({ model: 'streaming-model' });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of mock.stream(params)) { /* drain */ }
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].model).toBe('streaming-model');
  });

  it('yields multiple text_delta chunks for multiple text blocks', async () => {
    const response: ChatResponse = {
      content: [
        { type: 'text', text: 'part one' },
        { type: 'tool_use', id: 'tool-1', name: 'exec', input: {} },
        { type: 'text', text: 'part two' },
      ],
      stopReason: 'end_turn',
      usage: { inputTokens: 20, outputTokens: 10 },
    };
    mock.enqueue(response);

    const chunks = [];
    for await (const chunk of mock.stream(makeParams())) {
      chunks.push(chunk);
    }

    // 2 text blocks emit deltas, tool_use is skipped, then stop
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ type: 'text_delta', text: 'part one' });
    expect(chunks[1]).toEqual({ type: 'text_delta', text: 'part two' });
    expect(chunks[2].type).toBe('stop');
  });
});
