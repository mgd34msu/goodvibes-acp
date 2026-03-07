/**
 * Tests for L3 AgentLoop.
 * Uses MockProvider for deterministic LLM responses.
 * Covers: text response, tool-use cycle, max-turns, cancellation,
 *         tool error, unknown provider, progress events, multiple tools,
 *         token accumulation.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentLoop } from '../../src/plugins/agents/loop.ts';
import { MockProvider } from '../../src/plugins/agents/providers/mock.ts';
import type { AgentLoopConfig, AgentProgressEvent } from '../../src/plugins/agents/loop.ts';
import type { IToolProvider, ToolResult } from '../../src/types/registry.ts';
import type { ChatResponse } from '../../src/types/llm.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResponse(text: string): ChatResponse {
  return {
    content: [{ type: 'text', text }],
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 5 },
  };
}

function toolUseResponse(toolName: string, toolId: string, input: unknown = {}): ChatResponse {
  return {
    content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    stopReason: 'tool_use',
    usage: { inputTokens: 20, outputTokens: 10 },
  };
}

function makeToolProvider(name: string, toolName: string, result: ToolResult): IToolProvider {
  return {
    name,
    tools: [{ name: toolName, description: 'test tool', inputSchema: {} }],
    execute: async (_toolName: string, _params: unknown) => result,
  };
}

function makeLoop(
  provider: MockProvider,
  overrides: Partial<AgentLoopConfig> = {},
): AgentLoop {
  return new AgentLoop({
    provider,
    tools: [],
    model: 'mock-model',
    systemPrompt: 'You are a test agent.',
    maxTurns: 10,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. Simple text response — one turn, returns output
// ---------------------------------------------------------------------------

describe('AgentLoop — simple text response', () => {
  it('returns the LLM text output after one turn', async () => {
    const provider = new MockProvider();
    provider.enqueue(textResponse('Hello from the agent!'));

    const loop = makeLoop(provider);
    const result = await loop.run('say hello');

    expect(result.output).toBe('Hello from the agent!');
    expect(result.turns).toBe(1);
    expect(result.stopReason).toBe('complete');
    expect(result.error).toBeUndefined();
  });

  it('accumulates text from multiple text blocks', async () => {
    const provider = new MockProvider();
    provider.enqueue({
      content: [
        { type: 'text', text: 'Part one.' },
        { type: 'text', text: 'Part two.' },
      ],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const loop = makeLoop(provider);
    const result = await loop.run('generate');

    expect(result.output).toBe('Part one.\nPart two.');
    expect(result.stopReason).toBe('complete');
  });

  it('stops on max_tokens stop reason and reports complete', async () => {
    const provider = new MockProvider();
    provider.enqueue({
      content: [{ type: 'text', text: 'truncated response' }],
      stopReason: 'max_tokens',
      usage: { inputTokens: 10, outputTokens: 100 },
    });

    const loop = makeLoop(provider);
    const result = await loop.run('write a lot');

    expect(result.output).toBe('truncated response');
    expect(result.stopReason).toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// 2. Tool use cycle — LLM returns tool_use, tool executed, result fed back
// ---------------------------------------------------------------------------

describe('AgentLoop — tool use cycle', () => {
  it('executes a tool and feeds result back to the LLM', async () => {
    const provider = new MockProvider();
    // Turn 1: LLM requests tool
    provider.enqueue(toolUseResponse('mytools__greet', 'tool-1', { name: 'world' }));
    // Turn 2: LLM returns final text after getting tool result
    provider.enqueue(textResponse('Done! Tool result processed.'));

    const toolProvider = makeToolProvider('mytools', 'greet', {
      success: true,
      data: 'Hello, world!',
    });

    const loop = makeLoop(provider, { tools: [toolProvider] });
    const result = await loop.run('greet someone');

    expect(result.output).toBe('Done! Tool result processed.');
    expect(result.turns).toBe(2);
    expect(result.stopReason).toBe('complete');
  });

  it('passes the tool input to the tool provider', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('calc__add', 'tool-2', { a: 3, b: 4 }));
    provider.enqueue(textResponse('The sum is 7.'));

    const capturedInputs: unknown[] = [];
    const toolProvider: IToolProvider = {
      name: 'calc',
      tools: [{ name: 'add', description: 'add two numbers', inputSchema: {} }],
      execute: async (_name: string, params: unknown) => {
        capturedInputs.push(params);
        return { success: true, data: '7' };
      },
    };

    const loop = makeLoop(provider, { tools: [toolProvider] });
    await loop.run('add 3 and 4');

    expect(capturedInputs).toHaveLength(1);
    expect(capturedInputs[0]).toEqual({ a: 3, b: 4 });
  });

  it('serializes non-string tool results to JSON', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('data__fetch', 'tool-3', {}));
    provider.enqueue(textResponse('Got data.'));

    const testProvider: IToolProvider = {
      name: 'data',
      tools: [{ name: 'fetch', description: 'fetch data', inputSchema: {} }],
      execute: async () => ({ success: true, data: { items: [1, 2, 3] } }),
    };

    const loop = makeLoop(provider, { tools: [testProvider] });
    await loop.run('fetch data');

    // Second LLM call messages: [initial_user, assistant_tool_use, user_tool_results]
    // The tool_result message is at index 2 (before assistant final response is appended)
    const secondCallMessages = provider.calls[1].messages;
    // Index 2 = user message with tool_results (present when turn 2 was called)
    const toolResultMessage = secondCallMessages[2];
    expect(toolResultMessage.role).toBe('user');
    const content = toolResultMessage.content as Array<{ type: string; content: string }>;
    expect(content[0].type).toBe('tool_result');
    expect(content[0].content).toBe(JSON.stringify({ items: [1, 2, 3] }));
  });
});

// ---------------------------------------------------------------------------
// 3. Max turns limit
// ---------------------------------------------------------------------------

describe('AgentLoop — max turns', () => {
  it('stops at maxTurns and returns max_turns stop reason', async () => {
    const provider = new MockProvider();
    // Always return tool_use to keep the loop going
    const toolProvider = makeToolProvider('tools', 'noop', { success: true, data: 'ok' });

    for (let i = 0; i < 5; i++) {
      provider.enqueue(toolUseResponse('tools__noop', `tool-${i}`, {}));
    }

    const loop = makeLoop(provider, { maxTurns: 3, tools: [toolProvider] });
    const result = await loop.run('loop forever');

    expect(result.stopReason).toBe('max_turns');
    expect(result.turns).toBe(3);
  });

  it('includes any text output gathered before hitting max turns', async () => {
    const provider = new MockProvider();
    // Turn 1: text + tool_use (text is captured, then tool use continues loop)
    provider.enqueue({
      content: [
        { type: 'text', text: 'Working on it...' },
        { type: 'tool_use', id: 'tool-1', name: 'tools__noop', input: {} },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 10, outputTokens: 10 },
    });
    // Turn 2: another tool_use (will hit maxTurns=2)
    provider.enqueue(toolUseResponse('tools__noop', 'tool-2', {}));

    const toolProvider = makeToolProvider('tools', 'noop', { success: true, data: 'ok' });
    const loop = makeLoop(provider, { maxTurns: 2, tools: [toolProvider] });
    const result = await loop.run('do work');

    expect(result.stopReason).toBe('max_turns');
    expect(result.output).toBe('Working on it...');
  });
});

// ---------------------------------------------------------------------------
// 4. Cancellation via AbortSignal
// ---------------------------------------------------------------------------

describe('AgentLoop — cancellation', () => {
  it('returns cancelled if signal is already aborted before run()', async () => {
    const provider = new MockProvider();
    provider.enqueue(textResponse('should not reach here'));

    const controller = new AbortController();
    controller.abort();

    const loop = makeLoop(provider, { signal: controller.signal });
    const result = await loop.run('do something');

    expect(result.stopReason).toBe('cancelled');
    expect(result.turns).toBe(0);
  });

  it('returns cancelled when signal aborts during tool execution', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('tools__slow', 'tool-1', {}));

    const controller = new AbortController();
    const toolProvider: IToolProvider = {
      name: 'tools',
      tools: [{ name: 'slow', description: 'slow tool', inputSchema: {} }],
      execute: async () => {
        // Abort the signal while tool is executing
        controller.abort();
        return { success: true, data: 'done' };
      },
    };

    // Need a second response for after tool executes (loop checks abort before next LLM call)
    provider.enqueue(textResponse('final'));

    const loop = makeLoop(provider, { signal: controller.signal, tools: [toolProvider] });
    const result = await loop.run('slow task');

    // Loop checks abort before each LLM call, so after tool returns it will detect abort
    expect(result.stopReason).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// 5. Tool execution error
// ---------------------------------------------------------------------------

describe('AgentLoop — tool execution error', () => {
  it('catches tool throws and feeds error back to LLM as tool_result', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('tools__fail', 'tool-1', {}));
    provider.enqueue(textResponse('I encountered an error but recovered.'));

    const toolProvider: IToolProvider = {
      name: 'tools',
      tools: [{ name: 'fail', description: 'fails', inputSchema: {} }],
      execute: async () => {
        throw new Error('tool explosion');
      },
    };

    const loop = makeLoop(provider, { tools: [toolProvider] });
    const result = await loop.run('run failing tool');

    // Should complete (LLM handled the error)
    expect(result.stopReason).toBe('complete');
    expect(result.output).toBe('I encountered an error but recovered.');

    // Second LLM call messages: [initial_user, assistant_tool_use, user_tool_results]
    // Tool result message is at index 2
    const secondCall = provider.calls[1];
    const toolResultMsg = secondCall.messages[2];
    const content = toolResultMsg.content as Array<{ type: string; is_error?: boolean; content: string }>;
    expect(content[0].type).toBe('tool_result');
    expect(content[0].is_error).toBe(true);
    expect(content[0].content).toContain('tool explosion');
  });

  it('emits tool_error progress event on throw', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('tools__fail', 'tool-err', {}));
    provider.enqueue(textResponse('ok'));

    const events: AgentProgressEvent[] = [];
    const toolProvider: IToolProvider = {
      name: 'tools',
      tools: [{ name: 'fail', description: 'fails', inputSchema: {} }],
      execute: async () => { throw new Error('boom'); },
    };

    const loop = makeLoop(provider, {
      tools: [toolProvider],
      onProgress: (e) => events.push(e),
    });
    await loop.run('fail');

    const errorEvent = events.find(e => e.type === 'tool_error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.type).toBe('tool_error');
    if (errorEvent?.type === 'tool_error') {
      expect(errorEvent.error).toContain('boom');
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Unknown tool provider
// ---------------------------------------------------------------------------

describe('AgentLoop — unknown tool provider', () => {
  it('returns error tool_result for unknown provider and continues', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('ghost__do_thing', 'tool-1', {}));
    provider.enqueue(textResponse('Could not find that tool.'));

    // No tool providers registered
    const loop = makeLoop(provider, { tools: [] });
    const result = await loop.run('use ghost tool');

    expect(result.stopReason).toBe('complete');

    // Second LLM call messages: [initial_user, assistant_tool_use, user_tool_results]
    // Tool result message is at index 2
    const secondCall = provider.calls[1];
    const toolResultMsg = secondCall.messages[2];
    const content = toolResultMsg.content as Array<{ type: string; is_error?: boolean; content: string }>;
    expect(content[0].type).toBe('tool_result');
    expect(content[0].is_error).toBe(true);
    expect(content[0].content).toContain('ghost');
  });

  it('emits tool_error progress event for unknown provider', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('ghost__do_thing', 'tool-1', {}));
    provider.enqueue(textResponse('ok'));

    const events: AgentProgressEvent[] = [];
    const loop = makeLoop(provider, { tools: [], onProgress: (e) => events.push(e) });
    await loop.run('use ghost tool');

    const errorEvent = events.find(e => e.type === 'tool_error');
    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'tool_error') {
      expect(errorEvent.toolName).toBe('ghost__do_thing');
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Progress events fire in correct order
// ---------------------------------------------------------------------------

describe('AgentLoop — progress events', () => {
  it('fires events in order: llm_start, llm_complete for a simple response', async () => {
    const provider = new MockProvider();
    provider.enqueue(textResponse('done'));

    const events: AgentProgressEvent[] = [];
    const loop = makeLoop(provider, { onProgress: (e) => events.push(e) });
    await loop.run('task');

    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('llm_start');
    expect(events[1].type).toBe('llm_complete');
    if (events[0].type === 'llm_start') expect(events[0].turn).toBe(1);
    if (events[1].type === 'llm_complete') expect(events[1].turn).toBe(1);
  });

  it('fires tool events between llm events for a tool-use cycle', async () => {
    const provider = new MockProvider();
    provider.enqueue(toolUseResponse('t__op', 'tool-1', {}));
    provider.enqueue(textResponse('done'));

    const toolProvider = makeToolProvider('t', 'op', { success: true, data: 'result' });
    const events: AgentProgressEvent[] = [];
    const loop = makeLoop(provider, {
      tools: [toolProvider],
      onProgress: (e) => events.push(e),
    });
    await loop.run('task');

    const types = events.map(e => e.type);
    expect(types).toEqual([
      'llm_start',    // turn 1
      'llm_complete', // turn 1 (tool_use stop)
      'tool_start',   // tool execution
      'tool_complete',// tool done
      'llm_start',    // turn 2
      'llm_complete', // turn 2 (end_turn)
    ]);
  });

  it('llm_complete event includes usage stats', async () => {
    const provider = new MockProvider();
    provider.enqueue({
      content: [{ type: 'text', text: 'done' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 42, outputTokens: 17 },
    });

    const events: AgentProgressEvent[] = [];
    const loop = makeLoop(provider, { onProgress: (e) => events.push(e) });
    await loop.run('task');

    const complete = events.find(e => e.type === 'llm_complete');
    expect(complete).toBeDefined();
    if (complete?.type === 'llm_complete') {
      expect(complete.usage.inputTokens).toBe(42);
      expect(complete.usage.outputTokens).toBe(17);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Multiple tool calls in one response
// ---------------------------------------------------------------------------

describe('AgentLoop — multiple tool calls in one response', () => {
  it('executes all tool_use blocks from a single response', async () => {
    const provider = new MockProvider();
    provider.enqueue({
      content: [
        { type: 'tool_use', id: 't-1', name: 'tools__a', input: { x: 1 } },
        { type: 'tool_use', id: 't-2', name: 'tools__b', input: { y: 2 } },
        { type: 'tool_use', id: 't-3', name: 'tools__a', input: { x: 3 } },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 30, outputTokens: 20 },
    });
    provider.enqueue(textResponse('all tools executed'));

    const executedTools: string[] = [];
    const toolProvider: IToolProvider = {
      name: 'tools',
      tools: [
        { name: 'a', description: 'tool a', inputSchema: {} },
        { name: 'b', description: 'tool b', inputSchema: {} },
      ],
      execute: async (name: string) => {
        executedTools.push(name);
        return { success: true, data: `${name} done` };
      },
    };

    const loop = makeLoop(provider, { tools: [toolProvider] });
    const result = await loop.run('use multiple tools');

    expect(result.stopReason).toBe('complete');
    expect(executedTools).toEqual(['a', 'b', 'a']);

    // Second LLM call messages: [initial_user, assistant_tool_use, user_tool_results]
    // Tool results message is at index 2
    const secondCall = provider.calls[1];
    const toolResultsMsg = secondCall.messages[2];
    const content = toolResultsMsg.content as Array<{ type: string; tool_use_id: string }>;
    expect(content).toHaveLength(3);
    expect(content.map(c => c.tool_use_id)).toEqual(['t-1', 't-2', 't-3']);
  });
});

// ---------------------------------------------------------------------------
// 9. Token usage accumulation across turns
// ---------------------------------------------------------------------------

describe('AgentLoop — token usage accumulation', () => {
  it('sums token usage across multiple turns', async () => {
    const provider = new MockProvider();
    // Turn 1: 20 in, 10 out
    provider.enqueue({
      content: [{ type: 'tool_use', id: 't-1', name: 'tools__op', input: {} }],
      stopReason: 'tool_use',
      usage: { inputTokens: 20, outputTokens: 10 },
    });
    // Turn 2: 30 in, 15 out
    provider.enqueue({
      content: [{ type: 'tool_use', id: 't-2', name: 'tools__op', input: {} }],
      stopReason: 'tool_use',
      usage: { inputTokens: 30, outputTokens: 15 },
    });
    // Turn 3: 40 in, 20 out
    provider.enqueue({
      content: [{ type: 'text', text: 'final' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 40, outputTokens: 20 },
    });

    const toolProvider = makeToolProvider('tools', 'op', { success: true, data: 'ok' });
    const loop = makeLoop(provider, { tools: [toolProvider] });
    const result = await loop.run('multi-turn task');

    expect(result.turns).toBe(3);
    expect(result.usage.inputTokens).toBe(20 + 30 + 40);
    expect(result.usage.outputTokens).toBe(10 + 15 + 20);
  });

  it('returns zero usage when cancelled before first turn', async () => {
    const controller = new AbortController();
    controller.abort();

    const provider = new MockProvider();
    const loop = makeLoop(provider, { signal: controller.signal });
    const result = await loop.run('task');

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });
});
