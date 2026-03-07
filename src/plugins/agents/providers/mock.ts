/**
 * @module providers/mock
 * @layer L3 — plugin implementation
 *
 * MockProvider — a controllable ILLMProvider for testing.
 * Callers enqueue canned ChatResponse objects; the provider returns them
 * in FIFO order and records all ChatParams passed to chat().
 */

import type { ILLMProvider } from '../../../types/registry.js';
import type { ChatParams, ChatResponse, ChatChunk } from '../../../types/llm.js';

/**
 * A test double for ILLMProvider.
 *
 * Usage:
 * ```typescript
 * const mock = new MockProvider();
 * mock.enqueue({ content: [{ type: 'text', text: 'hello' }], stopReason: 'end_turn', usage: { inputTokens: 10, outputTokens: 5 } });
 * const response = await mock.chat(params);
 * const recorded = mock.calls; // readonly snapshot of all params passed
 * ```
 */
export class MockProvider implements ILLMProvider {
  readonly name = 'mock';

  private _responses: ChatResponse[] = [];
  private _calls: ChatParams[] = [];

  /**
   * Enqueue a canned response to be returned by the next chat() or stream() call.
   * Responses are drained in FIFO order.
   */
  enqueue(response: ChatResponse): void {
    this._responses.push(response);
  }

  /** Readonly snapshot of all ChatParams passed to chat() in call order. */
  get calls(): readonly ChatParams[] {
    return this._calls;
  }

  /**
   * Returns the next queued response, recording the params.
   * Throws if the queue is empty.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    this._calls.push(params);
    const response = this._responses.shift();
    if (!response) throw new Error('MockProvider: no responses queued');
    return response;
  }

  /**
   * Streams the next queued response as chunks.
   * Yields text_delta for each text ContentBlock, then a stop chunk.
   * Non-text blocks (tool_use, tool_result) are skipped — only text emits deltas.
   */
  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    const response = await this.chat(params);
    for (const block of response.content) {
      if (block.type === 'text') {
        yield { type: 'text_delta', text: block.text };
      }
    }
    yield { type: 'stop', stopReason: response.stopReason, usage: response.usage };
  }
}
