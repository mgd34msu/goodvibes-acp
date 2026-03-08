import { describe, it, expect } from 'bun:test';
import { patchIncomingStream } from '../transport.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all chunks from a ReadableStream<Uint8Array> into a single string. */
async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let result = '';
  const reader = stream.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return result;
}

/** Create a ReadableStream<Uint8Array> from a plain string. */
function makeStream(input: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(input));
      controller.close();
    },
  });
}

/** Parse ndjson output into an array of objects. */
function parseNdjson(output: string): unknown[] {
  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

// ---------------------------------------------------------------------------
// patchIncomingStream
// ---------------------------------------------------------------------------

describe('patchIncomingStream', () => {
  describe('initialize without protocolVersion', () => {
    it('injects protocolVersion: 1 when field is absent', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: { capabilities: {} },
      });
      const output = await collect(patchIncomingStream(makeStream(msg + '\n')));
      const parsed = parseNdjson(output);
      expect(parsed).toHaveLength(1);
      const result = parsed[0] as Record<string, unknown>;
      expect((result['params'] as Record<string, unknown>)['protocolVersion']).toBe(1);
    });

    it('preserves all other fields on the message', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 42,
        params: { capabilities: { fs: {} }, clientInfo: { name: 'zed' } },
      });
      const output = await collect(patchIncomingStream(makeStream(msg + '\n')));
      const result = parseNdjson(output)[0] as Record<string, unknown>;
      expect(result['id']).toBe(42);
      expect(result['jsonrpc']).toBe('2.0');
      const params = result['params'] as Record<string, unknown>;
      expect(params['protocolVersion']).toBe(1);
      expect(params['clientInfo']).toEqual({ name: 'zed' });
    });
  });

  describe('initialize with protocolVersion already set', () => {
    it('does not overwrite an existing protocolVersion', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: { capabilities: {}, protocolVersion: 2 },
      });
      const output = await collect(patchIncomingStream(makeStream(msg + '\n')));
      const result = parseNdjson(output)[0] as Record<string, unknown>;
      const params = result['params'] as Record<string, unknown>;
      expect(params['protocolVersion']).toBe(2);
    });

    it('does not overwrite protocolVersion: 0', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: { capabilities: {}, protocolVersion: 0 },
      });
      const output = await collect(patchIncomingStream(makeStream(msg + '\n')));
      const result = parseNdjson(output)[0] as Record<string, unknown>;
      const params = result['params'] as Record<string, unknown>;
      expect(params['protocolVersion']).toBe(0);
    });
  });

  describe('non-initialize messages', () => {
    it('passes through a prompt request unchanged', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'agent/prompt',
        id: 5,
        params: { sessionId: 'abc', messages: [] },
      });
      const output = await collect(patchIncomingStream(makeStream(msg + '\n')));
      expect(parseNdjson(output)[0]).toEqual(JSON.parse(msg));
    });

    it('passes through a notification unchanged', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'agent/cancel',
        params: { sessionId: 'xyz' },
      });
      const output = await collect(patchIncomingStream(makeStream(msg + '\n')));
      expect(parseNdjson(output)[0]).toEqual(JSON.parse(msg));
    });
  });

  describe('multiple messages in one stream', () => {
    it('patches only the initialize message in a multi-message stream', async () => {
      const init = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: { capabilities: {} },
      });
      const prompt = JSON.stringify({
        jsonrpc: '2.0',
        method: 'agent/prompt',
        id: 2,
        params: { sessionId: 'abc', messages: [] },
      });
      const input = init + '\n' + prompt + '\n';
      const output = await collect(patchIncomingStream(makeStream(input)));
      const messages = parseNdjson(output) as Record<string, unknown>[];
      expect(messages).toHaveLength(2);
      // initialize was patched
      expect(
        (messages[0]!['params'] as Record<string, unknown>)['protocolVersion'],
      ).toBe(1);
      // prompt was untouched
      expect(messages[1]).toEqual(JSON.parse(prompt));
    });
  });

  describe('robustness', () => {
    it('passes non-JSON lines through unchanged', async () => {
      const input = 'not valid json\n';
      const output = await collect(patchIncomingStream(makeStream(input)));
      expect(output).toBe('not valid json\n');
    });

    it('handles empty lines without error', async () => {
      const msg = JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1, params: {} });
      const input = '\n' + msg + '\n\n';
      const output = await collect(patchIncomingStream(makeStream(input)));
      const messages = parseNdjson(output);
      expect(messages).toHaveLength(1);
    });

    it('handles chunks arriving without trailing newline (flush)', async () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: { capabilities: {} },
      });
      // No trailing newline — relies on the flush() handler
      const output = await collect(patchIncomingStream(makeStream(msg)));
      const result = parseNdjson(output)[0] as Record<string, unknown>;
      const params = result['params'] as Record<string, unknown>;
      expect(params['protocolVersion']).toBe(1);
    });

    it('handles partial chunks split across multiple enqueues', async () => {
      const encoder = new TextEncoder();
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1,
        params: { capabilities: {} },
      }) + '\n';
      // Split mid-message into two chunks
      const mid = Math.floor(msg.length / 2);
      const chunk1 = encoder.encode(msg.slice(0, mid));
      const chunk2 = encoder.encode(msg.slice(mid));
      const partialStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk1);
          controller.enqueue(chunk2);
          controller.close();
        },
      });
      const output = await collect(patchIncomingStream(partialStream));
      const result = parseNdjson(output)[0] as Record<string, unknown>;
      const params = result['params'] as Record<string, unknown>;
      expect(params['protocolVersion']).toBe(1);
    });
  });
});
