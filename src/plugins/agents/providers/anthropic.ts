/**
 * @module providers/anthropic
 * @layer L3 — plugin implementation
 *
 * AnthropicProvider — ILLMProvider implementation backed by the Claude API
 * via the @anthropic-ai/sdk. Supports both non-streaming (chat) and
 * streaming (stream) completion modes.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ILLMProvider } from '../../../types/registry.js';
import type {
  ChatParams,
  ChatResponse,
  ChatChunk,
  ContentBlock,
  LLMMessage,
  LLMToolDefinition,
} from '../../../types/llm.js';

export class AnthropicProvider implements ILLMProvider {
  readonly name = 'anthropic';
  readonly client: Anthropic;

  constructor(apiKey?: string) {
    // Anthropic SDK auto-reads ANTHROPIC_API_KEY env var when apiKey is omitted
    this.client = new Anthropic(apiKey ? { apiKey } : undefined);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = await this.client.messages.create(
      {
        model: params.model,
        system: params.systemPrompt,
        messages: this.toAnthropicMessages(params.messages),
        max_tokens: params.maxTokens ?? 4096,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.tools?.length ? { tools: this.toAnthropicTools(params.tools) } : {}),
      },
      // Forward AbortSignal so callers can cancel in-flight requests
      params.signal ? { signal: params.signal } : undefined,
    );

    return {
      content: this.fromAnthropicContent(response.content),
      stopReason: this.fromAnthropicStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    const streamInstance = this.client.messages.stream(
      {
        model: params.model,
        system: params.systemPrompt,
        messages: this.toAnthropicMessages(params.messages),
        max_tokens: params.maxTokens ?? 4096,
        ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
        ...(params.tools?.length ? { tools: this.toAnthropicTools(params.tools) } : {}),
      },
      // Forward AbortSignal so callers can cancel in-flight streams
      params.signal ? { signal: params.signal } : undefined,
    );

    for await (const event of streamInstance) {
      // Honour AbortSignal between stream events
      if (params.signal?.aborted) {
        streamInstance.abort();
        return;
      }
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          yield { type: 'tool_use_delta', input_json: event.delta.partial_json };
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          yield {
            type: 'tool_use_start',
            id: event.content_block.id,
            name: event.content_block.name,
          };
        }
      } else if (event.type === 'message_stop') {
        const finalMessage = await streamInstance.finalMessage();
        yield {
          type: 'stop',
          stopReason: this.fromAnthropicStopReason(finalMessage.stop_reason),
          usage: {
            inputTokens: finalMessage.usage.input_tokens,
            outputTokens: finalMessage.usage.output_tokens,
          },
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Mappers — package-private (no `private`) for direct unit testing
  // ---------------------------------------------------------------------------

  /**
   * Maps our LLMMessage[] to Anthropic.MessageParam[].
   *
   * Role mapping:
   * - 'user'      → role: 'user'  (string content or array of user blocks)
   * - 'assistant' → role: 'assistant' (ContentBlock[] mapped to Anthropic blocks)
   * - 'tool'      → role: 'user' with tool_result content blocks
   *   (Anthropic has no 'tool' role; tool results are user-turn messages)
   */
  toAnthropicMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
    return messages.map((msg): Anthropic.MessageParam => {
      if (msg.role === 'tool') {
        // Tool results → user message with tool_result content blocks
        const blocks = Array.isArray(msg.content) ? msg.content : [];
        const toolResultBlocks: Anthropic.ToolResultBlockParam[] = blocks
          .filter((b): b is Extract<ContentBlock, { type: 'tool_result' }> => b.type === 'tool_result')
          .map((b) => ({
            type: 'tool_result' as const,
            tool_use_id: b.tool_use_id,
            content: b.content,
            ...(b.is_error !== undefined ? { is_error: b.is_error } : {}),
          }));
        return { role: 'user', content: toolResultBlocks };
      }

      if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          return { role: 'assistant', content: msg.content };
        }
        const blocks: Anthropic.ContentBlockParam[] = msg.content
          .filter((b): b is Extract<ContentBlock, { type: 'text' | 'tool_use' }> =>
            b.type === 'text' || b.type === 'tool_use',
          )
          .map((b) => {
            if (b.type === 'text') {
              return { type: 'text' as const, text: b.text };
            }
            // tool_use
            return {
              type: 'tool_use' as const,
              id: b.id,
              name: b.name,
              input: b.input as Record<string, unknown>,
            };
          });
        return { role: 'assistant', content: blocks };
      }

      // 'user' (and 'system' guard — system goes in top-level param, not messages)
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content };
      }
      const userBlocks: Anthropic.TextBlockParam[] = msg.content
        .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => ({ type: 'text' as const, text: b.text }));
      return { role: 'user', content: userBlocks };
    });
  }

  /** Maps our LLMToolDefinition[] to Anthropic.Tool[] */
  toAnthropicTools(tools: LLMToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        ...(tool.input_schema as object),
      },
    }));
  }

  /** Maps Anthropic ContentBlock[] to our ContentBlock[] */
  fromAnthropicContent(content: Anthropic.ContentBlock[]): ContentBlock[] {
    const result: ContentBlock[] = [];
    for (const block of content) {
      if (block.type === 'text') {
        result.push({ type: 'text', text: block.text });
      } else if (block.type === 'tool_use') {
        result.push({
          type: 'tool_use',
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
      // Other block types (thinking, etc.) are dropped
    }
    return result;
  }

  /** Maps Anthropic stop_reason string to our StopReason */
  fromAnthropicStopReason(reason: string | null): ChatResponse['stopReason'] {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        // Fallback for null or unknown reasons
        return 'end_turn';
    }
  }
}
