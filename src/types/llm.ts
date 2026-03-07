/**
 * @module llm
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Types for the LLM provider abstraction.
 * Used by ILLMProvider (registry.ts) and AgentLoop (L3).
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** Role in a conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A content block within a message */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/** A single message in a conversation */
export type LLMMessage = {
  role: MessageRole;
  content: ContentBlock[] | string;
};

// ---------------------------------------------------------------------------
// Tool definitions (for LLM context)
// ---------------------------------------------------------------------------

/** Tool definition passed to the LLM */
export type LLMToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Chat parameters and response
// ---------------------------------------------------------------------------

/** Parameters for a chat completion request */
export type ChatParams = {
  /** Model identifier (e.g., 'claude-sonnet-4-6') */
  model: string;
  /** System prompt */
  systemPrompt: string;
  /** Conversation history */
  messages: LLMMessage[];
  /** Available tools */
  tools?: LLMToolDefinition[];
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
};

/** Stop reason from the LLM */
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

/** Response from a chat completion request */
export type ChatResponse = {
  /** Response content blocks */
  content: ContentBlock[];
  /** Why the model stopped generating */
  stopReason: StopReason;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

/** A chunk from a streaming chat response */
export type ChatChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; input_json: string }
  | { type: 'stop'; stopReason: StopReason; usage: { inputTokens: number; outputTokens: number } };
