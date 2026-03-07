import { describe, it, expect } from 'bun:test';
import {
  serializeMessage,
  deserializeMessage,
  buildRequest,
  buildResponse,
  buildNotification,
} from '../../src/extensions/ipc/protocol.js';
import type { IpcMessage } from '../../src/extensions/ipc/protocol.js';

describe('IPC Protocol', () => {
  // ---------------------------------------------------------------------------
  // serializeMessage
  // ---------------------------------------------------------------------------

  describe('serializeMessage', () => {
    it('serializes a message to JSON followed by a newline', () => {
      const msg: IpcMessage = { type: 'request', id: 'req-1', payload: null, timestamp: 1000 };
      const serialized = serializeMessage(msg);

      expect(serialized.endsWith('\n')).toBe(true);
      const parsed = JSON.parse(serialized.trim());
      expect(parsed).toEqual(msg);
    });

    it('serializes complex payloads correctly', () => {
      const msg: IpcMessage = {
        type: 'notification',
        id: 'notif-1',
        payload: { nested: { deep: true }, arr: [1, 2, 3] },
        timestamp: 9999,
      };
      const serialized = serializeMessage(msg);
      const parsed = JSON.parse(serialized.trim());
      expect(parsed.payload.nested.deep).toBe(true);
      expect(parsed.payload.arr).toEqual([1, 2, 3]);
    });
  });

  // ---------------------------------------------------------------------------
  // deserializeMessage
  // ---------------------------------------------------------------------------

  describe('deserializeMessage', () => {
    it('deserializes a valid NDJSON line into an IpcMessage', () => {
      const msg: IpcMessage = { type: 'response', id: 'r-1', payload: { ok: true }, timestamp: 5000 };
      const line = JSON.stringify(msg) + '\n';
      const result = deserializeMessage(line);

      expect(result.type).toBe('response');
      expect(result.id).toBe('r-1');
      expect(result.timestamp).toBe(5000);
    });

    it('trims surrounding whitespace before parsing', () => {
      const msg: IpcMessage = { type: 'request', id: 'x', payload: null, timestamp: 1 };
      const line = '  ' + JSON.stringify(msg) + '  \n';
      const result = deserializeMessage(line);
      expect(result.id).toBe('x');
    });

    it('throws SyntaxError for invalid JSON', () => {
      expect(() => deserializeMessage('not-json')).toThrow(SyntaxError);
    });

    it('throws TypeError when required fields are missing — type missing', () => {
      const line = JSON.stringify({ id: 'x', payload: null, timestamp: 1 });
      expect(() => deserializeMessage(line)).toThrow(TypeError);
    });

    it('throws TypeError when id is missing', () => {
      const line = JSON.stringify({ type: 'request', payload: null, timestamp: 1 });
      expect(() => deserializeMessage(line)).toThrow(TypeError);
    });

    it('throws TypeError when timestamp is missing', () => {
      const line = JSON.stringify({ type: 'request', id: 'x', payload: null });
      expect(() => deserializeMessage(line)).toThrow(TypeError);
    });

    it('throws TypeError for null input (parsed as null)', () => {
      expect(() => deserializeMessage('null')).toThrow(TypeError);
    });
  });

  // ---------------------------------------------------------------------------
  // buildRequest
  // ---------------------------------------------------------------------------

  describe('buildRequest', () => {
    it('builds a well-formed IpcRequest', () => {
      const req = buildRequest('req-1', 'ping', { echo: true });

      expect(req.type).toBe('request');
      expect(req.id).toBe('req-1');
      expect(req.method).toBe('ping');
      expect(req.payload).toEqual({ echo: true });
      expect(typeof req.timestamp).toBe('number');
    });

    it('defaults payload to null when not provided', () => {
      const req = buildRequest('r', 'status');
      expect(req.payload).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // buildResponse
  // ---------------------------------------------------------------------------

  describe('buildResponse', () => {
    it('builds a successful IpcResponse', () => {
      const resp = buildResponse('resp-1', 'req-1', true, { result: 42 });

      expect(resp.type).toBe('response');
      expect(resp.id).toBe('resp-1');
      expect(resp.correlationId).toBe('req-1');
      expect(resp.ok).toBe(true);
      expect(resp.payload).toEqual({ result: 42 });
      expect(resp.error).toBeUndefined();
    });

    it('builds a failure IpcResponse with error message', () => {
      const resp = buildResponse('resp-2', 'req-2', false, null, 'Something failed');

      expect(resp.ok).toBe(false);
      expect(resp.error).toBe('Something failed');
    });

    it('defaults payload to null when not provided', () => {
      const resp = buildResponse('r', 'c', true);
      expect(resp.payload).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // buildNotification
  // ---------------------------------------------------------------------------

  describe('buildNotification', () => {
    it('builds a well-formed IpcNotification', () => {
      const notif = buildNotification('notif-1', 'runtime:status-changed', { state: 'idle' });

      expect(notif.type).toBe('notification');
      expect(notif.id).toBe('notif-1');
      expect(notif.event).toBe('runtime:status-changed');
      expect(notif.payload).toEqual({ state: 'idle' });
      expect(typeof notif.timestamp).toBe('number');
    });

    it('defaults payload to null when not provided', () => {
      const notif = buildNotification('n', 'some:event');
      expect(notif.payload).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // round-trip
  // ---------------------------------------------------------------------------

  describe('round-trip: serialize then deserialize', () => {
    it('preserves all fields through serialize → deserialize', () => {
      const req = buildRequest('rt-1', 'ping', { data: 'hello' });
      const line = serializeMessage(req);
      const parsed = deserializeMessage(line);

      expect(parsed.type).toBe(req.type);
      expect(parsed.id).toBe(req.id);
      expect(parsed.timestamp).toBe(req.timestamp);
    });
  });
});
