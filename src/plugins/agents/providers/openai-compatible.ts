/**
 * @module providers/openai-compatible
 * @layer L3 — plugin implementation
 *
 * OpenAICompatibleProvider — ILLMProvider implementation for any endpoint
 * that speaks the OpenAI Chat Completions API format. Supports OpenAI,
 * Groq, Together, InceptionLabs Mercury-2, Ollama, vLLM, and more.
 *
 * Uses native fetch() — no OpenAI SDK dependency.
 */

import type { ILLMProvider } from '../../../types/registry.js';
import type {
  ChatParams,
  ChatResponse,
  ChatChunk,
  ContentBlock,
  LLMMessage,
  LLMToolDefinition,
  StopReason,
} from '../../../types/llm.js';

// ---------------------------------------------------------------------------
// OpenAI wire-format types (internal, not exported)
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  tools?: OpenAITool[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stream_options?: { include_usage: boolean };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface OpenAIStreamDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta: OpenAIStreamDelta;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

// ---------------------------------------------------------------------------
// Provider options
// ---------------------------------------------------------------------------

export interface OpenAICompatibleProviderOptions {
  /** API key for Authorization: Bearer header */
  apiKey: string;
  /**
   * Base URL for the OpenAI-compatible endpoint.
   * Examples:
   *   'https://api.openai.com/v1'
   *   'https://inceptionlabs.ai/api'
   *   'http://localhost:11434'
   */
  baseUrl: string;
  /** Optional display name (default: 'openai-compatible') */
  name?: string;
}

// ---------------------------------------------------------------------------
// Provider implementation
// ---------------------------------------------------------------------------

export class OpenAICompatibleProvider implements ILLMProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly chatUrl: string;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.name = options.name ?? 'openai-compatible';
    this.apiKey = options.apiKey;
    this.chatUrl = buildChatUrl(options.baseUrl);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const body: OpenAIRequest = this.buildRequest(params, false);

    const response = await fetch(this.chatUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '<unreadable>');
      throw new Error(
        `OpenAI-compatible API error: HTTP ${response.status} ${response.statusText} — ${text}`,
      );
    }

    let data: OpenAIResponse;
    try {
      data = (await response.json()) as OpenAIResponse;
    } catch (err) {
      throw new Error(`OpenAI-compatible API error: failed to parse JSON response — ${String(err)}`);
    }

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('OpenAI-compatible API error: response contained no choices');
    }

    return {
      content: this.fromOpenAIMessage(choice.message),
      stopReason: this.fromOpenAIFinishReason(choice.finish_reason),
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    const body: OpenAIRequest = this.buildRequest(params, true);

    const response = await fetch(this.chatUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '<unreadable>');
      throw new Error(
        `OpenAI-compatible API stream error: HTTP ${response.status} ${response.statusText} — ${text}`,
      );
    }

    if (!response.body) {
      throw new Error('OpenAI-compatible API stream error: response body is null');
    }

    // Accumulated usage from stream (some providers send usage in final chunk)
    let finalUsage: { prompt_tokens: number; completion_tokens: number } | undefined;
    // Track tool call state keyed by index — emits tool_use_start on first delta
    const toolCallStarted = new Map<number, boolean>();
    let finishReason: string | null = null;

    const decoder = new TextDecoder();
    let buffer = '';

    const reader = response.body.getReader();
    try {
      while (true) {
        if (params.signal?.aborted) {
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE lines are separated by \n; a blank line ends an event
        const lines = buffer.split('\n');
        // Keep the incomplete last line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // skip empty / comment lines

          if (!trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice('data: '.length).trim();

          if (dataStr === '[DONE]') {
            // Emit stop chunk
            yield {
              type: 'stop',
              stopReason: this.fromOpenAIFinishReason(finishReason),
              usage: {
                inputTokens: finalUsage?.prompt_tokens ?? 0,
                outputTokens: finalUsage?.completion_tokens ?? 0,
              },
            };
            return;
          }

          let chunk: OpenAIStreamChunk;
          try {
            chunk = JSON.parse(dataStr) as OpenAIStreamChunk;
          } catch {
            // Skip malformed lines
            continue;
          }

          // Capture top-level usage when provided (stream_options.include_usage)
          if (chunk.usage) {
            finalUsage = chunk.usage;
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }

          const delta = choice.delta;

          // Text delta
          if (delta.content != null && delta.content !== '') {
            yield { type: 'text_delta', text: delta.content };
          }

          // Tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallStarted.get(idx)) {
                // First delta for this tool call — emit tool_use_start
                toolCallStarted.set(idx, true);
                yield {
                  type: 'tool_use_start',
                  id: tc.id ?? `tool-${idx}`,
                  name: tc.function?.name ?? '',
                };
              }
              // Emit argument delta if present
              if (tc.function?.arguments != null && tc.function.arguments !== '') {
                yield { type: 'tool_use_delta', input_json: tc.function.arguments };
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // If stream ended without [DONE] (some providers), emit stop
    yield {
      type: 'stop',
      stopReason: this.fromOpenAIFinishReason(finishReason),
      usage: {
        inputTokens: finalUsage?.prompt_tokens ?? 0,
        outputTokens: finalUsage?.completion_tokens ?? 0,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Mappers — package-private (no `private`) for direct unit testing
  // ---------------------------------------------------------------------------

  /**
   * Builds the OpenAI request body from ChatParams.
   */
  buildRequest(params: ChatParams, stream: boolean): OpenAIRequest {
    const messages = this.toOpenAIMessages(params.systemPrompt, params.messages);
    const req: OpenAIRequest = {
      model: params.model,
      messages,
      ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
      ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
      ...(params.tools?.length ? { tools: this.toOpenAITools(params.tools) } : {}),
    };
    if (stream) {
      req.stream = true;
      // Request usage in stream if supported (OpenAI supports this)
      req.stream_options = { include_usage: true };
    }
    return req;
  }

  /**
   * Maps systemPrompt + LLMMessage[] to OpenAI message array.
   *
   * Role mapping:
   * - systemPrompt → { role: 'system', content: systemPrompt }
   * - 'user'       → { role: 'user', content }
   * - 'assistant'  → { role: 'assistant', content, tool_calls? }
   * - 'tool'       → { role: 'tool', tool_call_id, content } per tool_result block
   */
  toOpenAIMessages(systemPrompt: string, messages: LLMMessage[]): OpenAIMessage[] {
    const result: OpenAIMessage[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'tool') {
        // Each tool_result block → separate tool message
        const blocks = Array.isArray(msg.content) ? msg.content : [];
        for (const block of blocks) {
          if (block.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: block.content,
            });
          }
        }
        continue;
      }

      if (msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          result.push({ role: 'assistant', content: msg.content });
          continue;
        }
        // Extract text and tool_use blocks
        let textContent = '';
        const toolCalls: OpenAIToolCall[] = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            textContent += block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: typeof block.input === 'string'
                  ? block.input
                  : JSON.stringify(block.input),
              },
            });
          }
        }
        result.push({
          role: 'assistant',
          content: textContent || null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        });
        continue;
      }

      // 'user' (and 'system' — system goes to top-level; skip any stray system messages)
      if (msg.role === 'system') continue;

      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content });
      } else {
        // Concatenate text blocks for user messages
        const text = msg.content
          .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
          .map((b) => b.text)
          .join('');
        result.push({ role: 'user', content: text });
      }
    }

    return result;
  }

  /** Maps LLMToolDefinition[] to OpenAI tools array */
  toOpenAITools(tools: LLMToolDefinition[]): OpenAITool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          ...(tool.input_schema as object),
        },
      },
    }));
  }

  /**
   * Maps OpenAI response message to our ContentBlock[].
   * Handles text content and tool_calls.
   */
  fromOpenAIMessage(
    message: { content: string | null; tool_calls?: OpenAIToolCall[] },
  ): ContentBlock[] {
    const result: ContentBlock[] = [];

    if (message.content) {
      result.push({ type: 'text', text: message.content });
    }

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        let input: unknown;
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          // If arguments are not valid JSON, keep as-is string
          input = tc.function.arguments;
        }
        result.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
    }

    return result;
  }

  /** Maps OpenAI finish_reason to our StopReason */
  fromOpenAIFinishReason(reason: string | null): StopReason {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'tool_calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        // null or unknown → end_turn
        return 'end_turn';
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

/**
 * Builds the full chat completions URL from a base URL.
 *
 * Handles various forms users might provide:
 *   'https://api.openai.com/v1'              → .../v1/chat/completions
 *   'https://api.openai.com/v1/'             → .../v1/chat/completions
 *   'https://api.openai.com/v1/chat/completions' → same (idempotent)
 *   'https://inceptionlabs.ai/api'           → .../api/chat/completions
 *   'http://localhost:11434'                  → .../chat/completions
 */
export function buildChatUrl(baseUrl: string): string {
  // Strip trailing slashes
  let url = baseUrl.replace(/\/+$/, '');

  // If the URL already ends with the full path, use as-is
  if (url.endsWith('/chat/completions')) {
    return url;
  }

  return `${url}/chat/completions`;
}
