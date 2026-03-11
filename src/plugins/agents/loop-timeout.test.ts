/**
 * @module plugins/agents/loop-timeout
 * @layer L3 — plugin
 *
 * Tests for AgentLoop stream idle/initial timeout behaviour.
 *
 * Tests use very short timeout values (20ms) so they run fast without
 * depending on real wall-clock delays in CI.
 */

import { describe, it, expect } from 'bun:test';
import { AgentLoop } from './loop.js';
import type { AgentLoopConfig } from './loop.js';
import type { ILLMProvider, IToolProvider } from '../../types/registry.js';
import type { ChatChunk, ChatParams } from '../../types/llm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Waits for ms, but resolves early if the signal is aborted. */
function waitMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
    if (signal?.aborted) {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }
  });
}

/** Creates an async generator that yields the given chunks with optional delays between them. */
async function* makeStream(
  chunks: ChatChunk[],
  delayBetweenMs = 0,
  hangAfterIndex = -1,
  hangMs = 10_000,
  signal?: AbortSignal,
): AsyncGenerator<ChatChunk> {
  for (let i = 0; i < chunks.length; i++) {
    if (i === hangAfterIndex) {
      // Simulate a hang — wait hangMs before yielding next chunk
      await waitMs(hangMs, signal);
    }
    if (delayBetweenMs > 0) {
      await waitMs(delayBetweenMs, signal);
    }
    yield chunks[i];
  }
}

/** Creates a mock provider that streams the given chunks. */
function makeMockProvider(
  streamFn: (params: ChatParams) => AsyncGenerator<ChatChunk>,
): ILLMProvider {
  return {
    name: 'mock',
    chat: async () => ({
      content: [{ type: 'text', text: '' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
    }),
    stream: streamFn,
  };
}

const STOP_CHUNK: ChatChunk = {
  type: 'stop',
  stopReason: 'end_turn',
  usage: { inputTokens: 10, outputTokens: 20 },
};

/** Base config for all tests — streaming enabled, no real tools needed. */
function makeConfig(overrides: Partial<AgentLoopConfig> & { provider: ILLMProvider }): AgentLoopConfig {
  return {
    tools: [] as IToolProvider[],
    model: 'test-model',
    systemPrompt: 'test',
    maxTurns: 1,
    streaming: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentLoop stream timeouts', () => {
  describe('stream idle timeout — hangs after first chunk', () => {
    it('aborts with stopReason error when stream hangs mid-way', async () => {
      const chunks: ChatChunk[] = [
        { type: 'text_delta', text: 'Hello ' },
        // chunk index 1 will trigger a 5-second hang
        { type: 'text_delta', text: 'world' },
        STOP_CHUNK,
      ];

      const provider = makeMockProvider(
        (params) => makeStream(chunks, 0, 1, 5_000, params.signal),
      );

      const loop = new AgentLoop(
        makeConfig({
          provider,
          streamIdleTimeoutMs: 30,    // 30ms idle timeout — fires during the 5s hang
          streamInitialTimeoutMs: 10_000,  // high initial, won't fire
        }),
      );

      const result = await loop.run('ping');

      expect(result.stopReason).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('stream initial timeout — no first chunk arrives', () => {
    it('aborts with stopReason error when first chunk never comes', async () => {
      // Provider that never yields anything (infinite hang)
      const provider = makeMockProvider(
        async function* (params) {
          await waitMs(10_000, params.signal);
          // never reached in test
          yield { type: 'text_delta', text: 'late' } as ChatChunk;
        },
      );

      const loop = new AgentLoop(
        makeConfig({
          provider,
          streamIdleTimeoutMs: 10_000,    // high, won't fire first
          streamInitialTimeoutMs: 30,     // 30ms initial timeout — fires quickly
        }),
      );

      const result = await loop.run('ping');

      expect(result.stopReason).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('normal streaming — no timeout', () => {
    it('completes successfully when chunks arrive steadily', async () => {
      const chunks: ChatChunk[] = [
        { type: 'text_delta', text: 'Hello ' },
        { type: 'text_delta', text: 'world' },
        STOP_CHUNK,
      ];

      // Chunks arrive every 5ms — well within the 500ms idle timeout
      const provider = makeMockProvider(
        (params) => makeStream(chunks, 5, -1, 10_000, params.signal),
      );

      const loop = new AgentLoop(
        makeConfig({
          provider,
          streamIdleTimeoutMs: 500,
          streamInitialTimeoutMs: 500,
        }),
      );

      const result = await loop.run('ping');

      expect(result.stopReason).toBe('end_turn');
      expect(result.output).toBe('Hello world');
      expect(result.error).toBeUndefined();
    });
  });

  describe('external abort signal', () => {
    it('propagates external abort as cancelled (no regression)', async () => {
      const controller = new AbortController();

      // Provider that hangs 10 seconds — external signal will fire first
      const provider = makeMockProvider(
        async function* (params) {
          await waitMs(10_000, params.signal);
          yield { type: 'text_delta', text: 'never' } as ChatChunk;
        },
      );

      const loop = new AgentLoop(
        makeConfig({
          provider,
          signal: controller.signal,
          streamIdleTimeoutMs: 10_000,    // won't fire
          streamInitialTimeoutMs: 10_000, // won't fire
        }),
      );

      // Abort after a short delay — capture the timer so we can clear it on early completion
      const abortTimer = setTimeout(() => controller.abort(), 20);

      const result = await loop.run('ping');

      // Clean up the abort timer in case run() returned before it fired
      clearTimeout(abortTimer);

      // External abort → cancelled (not error)
      expect(result.stopReason).toBe('cancelled');
      expect(result.error).toBeUndefined();
    });
  });

  describe('idle timer reset — chunks keep stream alive', () => {
    it('succeeds when chunks arrive faster than the idle timeout even if total duration exceeds idle window', async () => {
      // Each chunk arrives every 20ms; idle timeout is 50ms.
      // With 4 text chunks + stop = 5 chunks × 20ms = ~100ms total.
      // Without idle-reset the stream would time out (100ms > 50ms).
      // With proper reset, each chunk refreshes the timer so it never fires.
      const chunks: ChatChunk[] = [
        { type: 'text_delta', text: 'a' },
        { type: 'text_delta', text: 'b' },
        { type: 'text_delta', text: 'c' },
        { type: 'text_delta', text: 'd' },
        STOP_CHUNK,
      ];

      const provider = makeMockProvider(
        (params) => makeStream(chunks, 20, -1, 10_000, params.signal),
      );

      const loop = new AgentLoop(
        makeConfig({
          provider,
          streamIdleTimeoutMs: 50,       // 50ms idle window — each chunk arrives within it
          streamInitialTimeoutMs: 5_000, // high, won't fire
        }),
      );

      const result = await loop.run('ping');

      // Stream completes successfully — idle timer was reset on each chunk
      expect(result.stopReason).toBe('end_turn');
      expect(result.output).toBe('abcd');
      expect(result.error).toBeUndefined();
    });
  });
});
