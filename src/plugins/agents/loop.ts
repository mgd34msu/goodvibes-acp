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

export interface AgentLoopResult {
  /** Final text output from the agent */
  output: string;
  /** Total turns used */
  turns: number;
  /** Total token usage */
  usage: { inputTokens: number; outputTokens: number };
  /** How the loop ended */
  stopReason: 'complete' | 'max_turns' | 'cancelled' | 'error';
  /** Error message if stopReason is 'error' */
  error?: string;
}

// ---------------------------------------------------------------------------
// AgentLoop
// ---------------------------------------------------------------------------

export class AgentLoop {
  constructor(private readonly config: AgentLoopConfig) {}

  async run(task: string): Promise<AgentLoopResult> {
    const messages: LLMMessage[] = [{ role: 'user', content: task }];
    const toolDefs = this._collectToolDefinitions();
    const totalUsage = { inputTokens: 0, outputTokens: 0 };
    let turns = 0;
    let lastTextOutput = '';

    while (turns < this.config.maxTurns) {
      // Check cancellation before each turn
      if (this.config.signal?.aborted) {
        return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'cancelled' };
      }

      turns++;
      this.config.onProgress?.({ type: 'llm_start', turn: turns });

      let response;
      try {
        const params: ChatParams = {
          model: this.config.model,
          systemPrompt: this.config.systemPrompt,
          messages,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          signal: this.config.signal,
        };
        response = await this.config.provider.chat(params);
      } catch (err) {
        if (this.config.signal?.aborted) {
          return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'cancelled' };
        }
        return {
          output: lastTextOutput,
          turns,
          usage: totalUsage,
          stopReason: 'error',
          error: String(err),
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

      // Append assistant response to history
      messages.push({ role: 'assistant', content: response.content });

      // Extract text output from this response
      const textBlocks = response.content.filter(
        (b): b is ContentBlock & { type: 'text' } => b.type === 'text',
      );
      if (textBlocks.length > 0) {
        lastTextOutput = textBlocks.map(b => b.text).join('\n');
      }

      // end_turn or max_tokens — agent is done
      if (response.stopReason === 'end_turn' || response.stopReason === 'max_tokens') {
        return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'complete' };
      }

      // tool_use — execute tools and feed results back
      if (response.stopReason === 'tool_use') {
        const toolResults = await this._executeToolCalls(response.content, turns);
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Unknown stop reason — treat as complete
      return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'complete' };
    }

    return { output: lastTextOutput, turns, usage: totalUsage, stopReason: 'max_turns' };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

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

  /** Execute all tool_use blocks in parallel order, return tool_result blocks */
  private async _executeToolCalls(
    content: ContentBlock[],
    turn: number,
  ): Promise<ContentBlock[]> {
    const toolUseBlocks = content.filter(
      (b): b is ContentBlock & { type: 'tool_use' } => b.type === 'tool_use',
    );
    const results: ContentBlock[] = [];

    for (const block of toolUseBlocks) {
      const startTime = Date.now();
      this.config.onProgress?.({ type: 'tool_start', turn, toolName: block.name });

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
        this.config.onProgress?.({ type: 'tool_complete', turn, toolName: block.name, durationMs });

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
   * Split a namespaced tool name into [providerName, toolName].
   * e.g. 'precision__read_file' → ['precision', 'read_file']
   * If no '__' separator, returns ['', fullName].
   */
  private _splitToolName(fullName: string): [string, string] {
    const idx = fullName.indexOf('__');
    if (idx === -1) return ['', fullName];
    return [fullName.slice(0, idx), fullName.slice(idx + 2)];
  }
}
