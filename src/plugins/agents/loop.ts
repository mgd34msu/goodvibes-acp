/**
 * @module plugins/agents/loop
 * @layer L3 — plugin
 *
 * AgentLoop — the core agentic execution loop.
 *
 * Drives the prompt → tool_use → execute → repeat cycle:
 *   1. Call LLM with current message history and tool definitions
 *   2. If stop reason is end_turn or max_tokens: return result
 *   3. If stop reason is tool_use: execute all tool_use blocks, append results, loop
 *   4. Check cancellation before each turn
 *   5. Enforce maxTurns limit
 *
 * Tool names are namespaced as `providerName__toolName`.
 * Progress events enable ACP visibility via onProgress callback.
 */

import type { ILLMProvider, IToolProvider } from '../../types/registry.js';
import type {
  ChatParams,
  LLMMessage,
  ContentBlock,
  LLMToolDefinition,
} from '../../types/llm.js';
import type { AgentProgressEvent } from '../../types/agent.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default idle timeout between consecutive stream chunks (2 minutes). */
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 120_000;

/** Default initial timeout waiting for the very first stream chunk (3 minutes). */
const DEFAULT_STREAM_INITIAL_TIMEOUT_MS = 180_000;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AgentLoopConfig {
  /** LLM provider for inference */
  provider: ILLMProvider;
  /** Tool providers available to this agent */
  tools: IToolProvider[];
  /** Model to use */
  model: string;
  /** System prompt */
  systemPrompt: string;
  /** Maximum turns (LLM calls) before forced stop */
  maxTurns: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback for progress events */
  onProgress?: (event: AgentProgressEvent) => void;
  /** Working directory for context enrichment */
  cwd?: string;
  /** Workspace root paths for context enrichment */
  workspaceRoots?: string[];
  /** Called whenever the agent successfully reads a file (for reference tracking) */
  onFileRead?: (path: string) => void;
  /** Maximum tokens for LLM responses */
  maxTokens?: number;
  /**
   * Whether to use streaming inference via provider.stream().
   * When true (default), emits agent_message_chunk progress events for each
   * text delta during LLM inference. Set to false to use non-streaming chat()
   * (useful in tests or when the provider does not support streaming).
   */
  streaming?: boolean;
  /**
   * Maximum milliseconds to wait for the **first chunk** from provider.stream().
   * Covers cold-start latency. If no chunk arrives within this window the stream
   * is aborted and the turn returns stopReason 'error'.
   * Default: 180_000 (3 minutes).
   */
  streamInitialTimeoutMs?: number;
  /**
   * Maximum milliseconds allowed between consecutive chunks during streaming.
   * Resets on every received chunk. If the connection goes silent (e.g. an API
   * hangs mid-stream without closing) the stream is aborted after this window.
   * Default: 120_000 (2 minutes).
   */
  streamIdleTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Progress events
// ---------------------------------------------------------------------------

// AgentProgressEvent is defined at L0 (src/types/agent.ts) and re-exported
// here for backward compatibility with existing consumers.
export type { AgentProgressEvent } from '../../types/agent.js';

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * ACP-defined stop reasons (KB-04 lines 446-460).
 * These values are safe to send to clients on the wire.
 */
export type AcpStopReason = 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';

/**
 * Internal stop reason type used by the agent loop.
 * Extends AcpStopReason with 'error' for internal error reporting.
 * 'error' is NEVER sent to clients — it is translated at the L2 ACP layer.
 */
export type InternalStopReason = AcpStopReason | 'error';

export interface AgentLoopResult {
  /** Final text output from the agent */
  output: string;
  /** Total turns used */
  turns: number;
  /** Total token usage */
  usage: { inputTokens: number; outputTokens: number };
  /**
   * How the loop ended.
   * Uses ACP-defined stop reason values (see KB-04 lines 446-460).
   * 'error' is an internal extension value — ACP has no error stop reason.
   * It is translated at the L2 ACP layer and never sent to clients directly.
   */
  stopReason: InternalStopReason;
  /** Error message if stopReason is 'error' */
  error?: string;
  /**
   * Files modified during the loop execution.
   * Populated by intercepting file-writing tool calls (precision_write, precision_edit,
   * and any tool with 'write' or 'edit' in the name that carries a path/files input).
   */
  filesModified: string[];
}

// ---------------------------------------------------------------------------
// AgentLoop
// ---------------------------------------------------------------------------

export class AgentLoop {
  /** Tracks unique file paths written or edited during this loop run */
  private readonly _filesModified = new Set<string>();

  constructor(private readonly config: AgentLoopConfig) {}

  /** Public read-only view of files modified so far (e.g. for timeout capture) */
  get filesModified(): string[] {
    return Array.from(this._filesModified);
  }

  async run(task: string): Promise<AgentLoopResult> {
    const messages: LLMMessage[] = [{ role: 'user', content: task }];
    const toolDefs = this._collectToolDefinitions();
    const totalUsage = { inputTokens: 0, outputTokens: 0 };
    let turns = 0;
    let lastTextOutput = '';

    const contextLines: string[] = [];
    if (this.config.cwd) contextLines.push(`Working directory: ${this.config.cwd}`);
    if (this.config.workspaceRoots?.length) {
      contextLines.push(`Workspace roots: ${this.config.workspaceRoots.join(', ')}`);
    }
    if (toolDefs.length > 0) {
      contextLines.push(`Available tools: ${toolDefs.map(t => t.name).join(', ')}`);
    }
    const enrichedPrompt = contextLines.length > 0
      ? `${contextLines.join('\n')}\n\n${this.config.systemPrompt}`
      : this.config.systemPrompt;

    console.error(`[AgentLoop] Starting: model=${this.config.model}, maxTurns=${this.config.maxTurns}, tools=${toolDefs.length}, cwd=${this.config.cwd ?? 'none'}`);

    while (turns < this.config.maxTurns) {
      // Check cancellation before each turn
      if (this.config.signal?.aborted) {
        return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'cancelled', filesModified: Array.from(this._filesModified) };
      }

      turns++;
      this.config.onProgress?.({ type: 'llm_start', turn: turns });

      let response;
      try {
        const params: ChatParams = {
          model: this.config.model,
          systemPrompt: enrichedPrompt,
          messages,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          signal: this.config.signal,
          maxTokens: this.config.maxTokens,
        };
        const useStreaming = this.config.streaming !== false && typeof this.config.provider.stream === 'function';
        if (useStreaming) {
          response = await this._runStreaming(params);
        } else {
          response = await this.config.provider.chat(params);
        }
      } catch (err) {
        if (this.config.signal?.aborted) {
          return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'cancelled', filesModified: Array.from(this._filesModified) };
        }
        console.error('[AgentLoop] LLM call failed:', String(err));
        return {
          output: lastTextOutput,
          turns,
          usage: totalUsage,
          stopReason: 'error',
          error: String(err),
          filesModified: Array.from(this._filesModified),
        };
      }

      totalUsage.inputTokens += response.usage.inputTokens;
      totalUsage.outputTokens += response.usage.outputTokens;
      this.config.onProgress?.({
        type: 'llm_complete',
        turn: turns,
        stopReason: response.stopReason,
        usage: response.usage,
      });
      console.error(`[AgentLoop] Turn ${turns}: stopReason=${response.stopReason}, input=${response.usage.inputTokens}, output=${response.usage.outputTokens}`);

      // Append assistant response to history
      messages.push({ role: 'assistant', content: response.content });

      // Extract text output from this response
      const textBlocks = response.content.filter(
        (b): b is ContentBlock & { type: 'text' } => b.type === 'text',
      );
      if (textBlocks.length > 0) {
        lastTextOutput = textBlocks.map(b => b.text).join('\n');
      }

      // end_turn — agent completed normally
      if (response.stopReason === 'end_turn') {
        console.error(`[AgentLoop] Done: turns=${turns}, stopReason='end_turn', filesModified=${this._filesModified.size}`);
        return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn', filesModified: Array.from(this._filesModified) };
      }

      // max_tokens — response was truncated; propagate as distinct stop reason (KB-04)
      if (response.stopReason === 'max_tokens') {
        console.error(`[AgentLoop] Done: turns=${turns}, stopReason='max_tokens', filesModified=${this._filesModified.size}`);
        return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'max_tokens', filesModified: Array.from(this._filesModified) };
      }

      // tool_use — execute tools and feed results back
      if (response.stopReason === 'tool_use') {
        const toolResults = await this._executeToolCalls(response.content, turns);
        messages.push({ role: 'tool', content: toolResults });
        continue;
      }

      // Unknown stop reason — treat as end_turn
      return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'end_turn', filesModified: Array.from(this._filesModified) };
    }

    console.error(`[AgentLoop] Done: turns=${turns}, stopReason='max_turn_requests', filesModified=${this._filesModified.size}`);
    return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'max_turn_requests', filesModified: Array.from(this._filesModified) };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Run a single LLM turn via provider.stream(), accumulating chunks into a
   * ChatResponse-equivalent. Emits agent_message_chunk progress events for
   * each text_delta chunk so ACP clients receive streaming text deltas.
   *
   * Idle/initial timeouts abort the stream if the provider goes silent:
   *   - streamInitialTimeoutMs: max wait for the very first chunk (cold-start)
   *   - streamIdleTimeoutMs: max silence between consecutive chunks (hang detection)
   */
  private async _runStreaming(params: ChatParams): Promise<import('../../types/llm.js').ChatResponse> {
    const content: ContentBlock[] = [];
    let stopReason: import('../../types/llm.js').StopReason = 'end_turn';
    let usage = { inputTokens: 0, outputTokens: 0 };

    // State for assembling tool_use blocks from streaming chunks
    let currentToolUse: { id: string; name: string; inputParts: string[] } | null = null;

    // Accumulate text for the current text block
    let currentText = '';

    // -------------------------------------------------------------------------
    // Timeout setup — idle and initial response timeouts
    // -------------------------------------------------------------------------
    const idleMs = this.config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    const initialMs = this.config.streamInitialTimeoutMs ?? DEFAULT_STREAM_INITIAL_TIMEOUT_MS;

    // Internal abort controller — merged with the external signal
    const internalController = new AbortController();
    const onExternalAbort = () => internalController.abort();
    this.config.signal?.addEventListener('abort', onExternalAbort, { once: true });

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let firstChunkReceived = false;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.error(
          `[AgentLoop] Stream idle timeout — no data received for ${idleMs}ms`,
        );
        internalController.abort();
      }, idleMs);
    };

    // Start with the initial (cold-start) timeout
    idleTimer = setTimeout(() => {
      console.error(
        `[AgentLoop] Stream initial response timeout — no first chunk received within ${initialMs}ms`,
      );
      internalController.abort();
    }, initialMs);

    try {
      // Pass the merged signal to the provider so fetch/http aborts cleanly
      const streamParams: ChatParams = { ...params, signal: internalController.signal };

      for await (const chunk of this._abortableStream(this.config.provider.stream!(streamParams), internalController.signal)) {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          // Switch from initial timeout to idle timeout on first chunk
        }
        // Reset idle timer on every received chunk
        resetIdleTimer();

        if (chunk.type === 'text_delta') {
          currentText += chunk.text;
          // Emit streaming progress event for ACP clients
          this.config.onProgress?.({ type: 'agent_message_chunk', chunk: { type: 'text', text: chunk.text } });
        } else if (chunk.type === 'thinking_delta') {
          // Emit agent_thought_chunk progress event for ACP clients (prompt-turn spec)
          this.config.onProgress?.({ type: 'agent_thought_chunk', chunk: { type: 'text', text: chunk.thinking } });
        } else if (chunk.type === 'tool_use_start') {
          // Flush any accumulated text block before starting a tool_use block
          if (currentText) {
            content.push({ type: 'text', text: currentText });
            currentText = '';
          }
          // Flush any previous pending tool_use block (shouldn't happen, but safe)
          if (currentToolUse) {
            content.push({
              type: 'tool_use',
              id: currentToolUse.id,
              name: currentToolUse.name,
              input: this._parseToolInput(currentToolUse.inputParts.join('')),
            });
          }
          currentToolUse = { id: chunk.id, name: chunk.name, inputParts: [] };
        } else if (chunk.type === 'tool_use_delta') {
          if (currentToolUse) {
            currentToolUse.inputParts.push(chunk.input_json);
          }
        } else if (chunk.type === 'stop') {
          stopReason = chunk.stopReason;
          usage = chunk.usage;
        }
      }
    } finally {
      // Always clean up timers and external abort listener
      if (idleTimer) clearTimeout(idleTimer);
      this.config.signal?.removeEventListener('abort', onExternalAbort);
    }

    // Flush any remaining accumulated content.
    // This code only runs on the success path — if an error was thrown above,
    // control never reaches here (the throw propagates out of _runStreaming).
    if (currentText) {
      content.push({ type: 'text', text: currentText });
    }
    if (currentToolUse) {
      content.push({
        type: 'tool_use',
        id: currentToolUse.id,
        name: currentToolUse.name,
        input: this._parseToolInput(currentToolUse.inputParts.join('')),
      });
    }

    return { content, stopReason, usage };
  }

  /**
   * Wraps an async iterable with abort-signal awareness so that each `.next()`
   * call is raced against the signal. When the signal fires, the iterator is
   * interrupted immediately — even if the underlying generator is mid-`await`.
   *
   * This ensures idle/initial timeouts and external abort signals can
   * actually interrupt a hung provider, regardless of whether the provider
   * itself honours the signal (e.g. mock providers in tests).
   */
  private async *_abortableStream<T>(
    source: AsyncIterable<T>,
    signal: AbortSignal,
  ): AsyncGenerator<T> {
    const iterator = source[Symbol.asyncIterator]();

    // A promise that rejects as soon as the signal is aborted
    let abortReject!: (reason: unknown) => void;
    const abortPromise = new Promise<never>((_resolve, reject) => {
      abortReject = reject;
    });

    const onAbort = () => abortReject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      while (true) {
        const result = await Promise.race([iterator.next(), abortPromise]);
        if (result.done) break;
        yield result.value;
      }
    } finally {
      signal.removeEventListener('abort', onAbort);
      // Best-effort cleanup of the underlying iterator
      await iterator.return?.();
    }
  }

  /** Safely parse accumulated input JSON from tool_use_delta chunks. */
  private _parseToolInput(json: string): unknown {
    if (!json) return {};
    try {
      return JSON.parse(json);
    } catch {
      return {};
    }
  }

  /** Collect tool definitions from all providers, namespaced as providerName__toolName */
  private _collectToolDefinitions(): LLMToolDefinition[] {
    return this.config.tools.flatMap(provider =>
      provider.tools.map(t => ({
        name: `${provider.name}__${t.name}`,
        description: t.description,
        input_schema: t.inputSchema ?? {},
      })),
    );
  }

  /**
   * Execute all tool_use blocks sequentially, return tool_result blocks.
   * Sequential execution is intentional — prevents race conditions on file-modifying tools.
   */
  private async _executeToolCalls(
    content: ContentBlock[],
    turn: number,
  ): Promise<ContentBlock[]> {
    const toolUseBlocks = content.filter(
      (b): b is ContentBlock & { type: 'tool_use' } => b.type === 'tool_use',
    );
    const results: ContentBlock[] = [];

    for (const block of toolUseBlocks) {
      // ISS-036: Check cancellation before each tool execution (ACP KB-04 session/cancel protocol)
      if (this.config.signal?.aborted) {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: 'Cancelled',
          is_error: true,
        });
        continue;
      }

      const startTime = Date.now();
      this.config.onProgress?.({ type: 'tool_start', turn, toolName: block.name });
      console.error(`[AgentLoop] Tool: ${block.name}`);

      try {
        const [providerName, toolName] = this._splitToolName(block.name);
        const provider = this.config.tools.find(p => p.name === providerName);

        if (!provider) {
          this.config.onProgress?.({
            type: 'tool_error',
            turn,
            toolName: block.name,
            error: `unknown tool provider "${providerName}"`,
          });
          results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: unknown tool provider "${providerName}"`,
            is_error: true,
          });
          continue;
        }

        const result = await provider.execute(toolName, block.input);
        const durationMs = Date.now() - startTime;
        this.config.onProgress?.({ type: 'tool_complete', turn, toolName: block.name, durationMs, result: { data: result.data } });

        // Track file reads for reference validation (reviewer agents)
        if (this.config.onFileRead && (block.name === 'precision__precision_read' || block.name.endsWith('__precision_read'))) {
          const inp = block.input as Record<string, unknown>;
          const files = inp['files'];
          if (Array.isArray(files)) {
            for (const f of files) {
              if (typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>)['path'] === 'string') {
                this.config.onFileRead((f as Record<string, unknown>)['path'] as string);
              }
            }
          }
        }

        // Track file modifications for write/edit tool calls
        this._trackFileModifications(block.name, block.input);

        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content:
            typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
        });
      } catch (err) {
        const durationMs = Date.now() - startTime;
        this.config.onProgress?.({
          type: 'tool_error',
          turn,
          toolName: block.name,
          error: String(err),
        });
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Error: ${String(err)}`,
          is_error: true,
        });
      }
    }

    return results;
  }

  /**
   * Inspect a successfully-executed tool call and record any file paths
   * that were written or edited.
   *
   * Handles:
   *   - precision__precision_write : input.files[].path
   *   - precision__precision_edit  : input.edits[].path
   *   - Any tool whose name contains 'write' or 'edit' with a top-level
   *     `path` string or `files`/`edits` array carrying `.path` strings.
   */
  private _trackFileModifications(toolName: string, input: unknown): void {
    if (typeof input !== 'object' || input === null) return;
    const inp = input as Record<string, unknown>;
    const name = toolName.toLowerCase();

    // precision__precision_write — input.files[].path
    if (toolName === 'precision__precision_write' || name.endsWith('__precision_write')) {
      const files = inp['files'];
      if (Array.isArray(files)) {
        for (const f of files) {
          if (typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>)['path'] === 'string') {
            this._filesModified.add((f as Record<string, unknown>)['path'] as string);
          }
        }
      }
      return;
    }

    // precision__precision_edit — input.edits[].path
    if (toolName === 'precision__precision_edit' || name.endsWith('__precision_edit')) {
      const edits = inp['edits'];
      if (Array.isArray(edits)) {
        for (const e of edits) {
          if (typeof e === 'object' && e !== null) {
            const ed = e as Record<string, unknown>;
            const p = ed['path'] ?? ed['file'];
            if (typeof p === 'string') this._filesModified.add(p);
          }
        }
      }
      return;
    }

    // Generic fallback: any tool whose lowercased name contains 'write' or 'edit'
    if (name.includes('write') || name.includes('edit')) {
      // Top-level path field
      if (typeof inp['path'] === 'string') {
        this._filesModified.add(inp['path']);
      }
      // files[].path array
      if (Array.isArray(inp['files'])) {
        for (const f of inp['files'] as unknown[]) {
          if (typeof f === 'object' && f !== null && typeof (f as Record<string, unknown>)['path'] === 'string') {
            this._filesModified.add((f as Record<string, unknown>)['path'] as string);
          }
        }
      }
      // edits[].path array
      if (Array.isArray(inp['edits'])) {
        for (const e of inp['edits'] as unknown[]) {
          if (typeof e === 'object' && e !== null) {
            const ed = e as Record<string, unknown>;
            const p = ed['path'] ?? ed['file'];
            if (typeof p === 'string') this._filesModified.add(p);
          }
        }
      }
    }
  }

  /**
   * Split a namespaced tool name into [providerName, toolName].
   * e.g. 'filesystem__read_file' → ['filesystem', 'read_file']
   * If no '__' separator, returns ['', fullName].
   */
  private _splitToolName(fullName: string): [string, string] {
    const idx = fullName.indexOf('__');
    if (idx === -1) return ['', fullName];
    return [fullName.slice(0, idx), fullName.slice(idx + 2)];
  }
}
