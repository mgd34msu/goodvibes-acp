import { describe, it, expect } from 'bun:test';
import {
  serializeMessage,
  deserializeMessage,
  buildRequest,
  buildResponse,
  buildNotification,
} from '../../src/extensions/ipc/protocol.js';
import type { IpcRequest, IpcResponse, IpcNotification } from '../../src/extensions/ipc/protocol.js';

describe('IPC Protocol', () => {
  // ---------------------------------------------------------------------------
  // buildRequest
  // ---------------------------------------------------------------------------

  describe('buildRequest', () => {
    it('creates a well-formed IpcRequest', () => {
      const req = buildRequest('req-1', 'ping', { echo: true });

      expect(req.jsonrpc).toBe('2.0');
      expect(req.type).toBe('request');
      expect(req.id).toBe('req-1');
      expect(req.method).toBe('ping');
      expect(req.params).toEqual({ echo: true });
    });

    it('defaults params to null when not provided', () => {
      const req = buildRequest('r', 'status');
      expect(req.params).toBeNull();
    });

    it('accepts arbitrary params types', () => {
      const req = buildRequest('r2', 'op', [1, 2, 3]);
      expect(req.params).toEqual([1, 2, 3]);
    });
  });

  // ---------------------------------------------------------------------------
  // buildResponse
  // ---------------------------------------------------------------------------

  describe('buildResponse', () => {
    it('creates a success IpcResponse with result', () => {
      const resp = buildResponse('req-1', { value: 42 });

      expect(resp.jsonrpc).toBe('2.0');
      expect(resp.type).toBe('response');
      expect(resp.id).toBe('req-1');
      expect(resp.result).toEqual({ value: 42 });
      expect(resp.error).toBeUndefined();
    });

    it('creates an error IpcResponse with structured error', () => {
      const resp = buildResponse('req-2', null, { code: -32601, message: 'Method not found' });

      expect(resp.id).toBe('req-2');
      expect(resp.error).toEqual({ code: -32601, message: 'Method not found' });
      expect(resp.result).toBeUndefined();
    });

    it('creates a parse-error IpcResponse with id: null', () => {
      const resp = buildResponse(null, null, { code: -32700, message: 'Parse error' });

      expect(resp.id).toBeNull();
      expect(resp.error).toEqual({ code: -32700, message: 'Parse error' });
    });

    it('defaults result to null when not provided', () => {
      const resp = buildResponse('r');
      expect(resp.result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // buildNotification
  // ---------------------------------------------------------------------------

  describe('buildNotification', () => {
    it('creates a well-formed IpcNotification with no id', () => {
      const notif = buildNotification('runtime:status-changed', { state: 'idle' });

      expect(notif.jsonrpc).toBe('2.0');
      expect(notif.type).toBe('notification');
      expect((notif as Record<string, unknown>).id).toBeUndefined();
      expect(notif.method).toBe('runtime:status-changed');
      expect(notif.params).toEqual({ state: 'idle' });
    });

    it('defaults params to null when not provided', () => {
      const notif = buildNotification('some:event');
      expect(notif.params).toBeNull();
    });

    it('uses method field, not event field', () => {
      const notif = buildNotification('agent:started', { agentId: 'a1' });
      expect(notif.method).toBe('agent:started');
      expect((notif as Record<string, unknown>).event).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // serializeMessage
  // ---------------------------------------------------------------------------

  describe('serializeMessage', () => {
    it('serializes to NDJSON with trailing newline', () => {
      const req = buildRequest('req-1', 'ping', null);
      const serialized = serializeMessage(req);

      expect(serialized.endsWith('\n')).toBe(true);
    });

    it('strips the type field from wire output', () => {
      const req = buildRequest('req-1', 'ping', null);
      const serialized = serializeMessage(req);
      const parsed = JSON.parse(serialized.trim()) as Record<string, unknown>;

      expect(parsed.type).toBeUndefined();
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('ping');
    });

    it('strips type from a response', () => {
      const resp = buildResponse('req-1', { ok: true });
      const parsed = JSON.parse(serializeMessage(resp).trim()) as Record<string, unknown>;
      expect(parsed.type).toBeUndefined();
    });

    it('strips type from a notification', () => {
      const notif = buildNotification('runtime:tick', { seq: 1 });
      const parsed = JSON.parse(serializeMessage(notif).trim()) as Record<string, unknown>;
      expect(parsed.type).toBeUndefined();
    });

    it('preserves complex nested params', () => {
      const req = buildRequest('r', 'op', { nested: { deep: true }, arr: [1, 2, 3] });
      const parsed = JSON.parse(serializeMessage(req).trim()) as IpcRequest;
      expect((parsed.params as Record<string, unknown>).nested).toEqual({ deep: true });
      expect((parsed.params as Record<string, unknown>).arr).toEqual([1, 2, 3]);
    });
  });

  // ---------------------------------------------------------------------------
  // deserializeMessage
  // ---------------------------------------------------------------------------

  describe('deserializeMessage', () => {
    it('classifies a request (method + id)', () => {
      const wire = JSON.stringify({ jsonrpc: '2.0', id: 'r1', method: 'ping', params: null });
      const msg = deserializeMessage(wire) as IpcRequest;

      expect(msg.type).toBe('request');
      expect(msg.id).toBe('r1');
      expect(msg.method).toBe('ping');
    });

    it('classifies a response (result + id)', () => {
      const wire = JSON.stringify({ jsonrpc: '2.0', id: 'r1', result: { value: 1 } });
      const msg = deserializeMessage(wire) as IpcResponse;

      expect(msg.type).toBe('response');
      expect(msg.id).toBe('r1');
      expect(msg.result).toEqual({ value: 1 });
    });

    it('classifies a response (error + id)', () => {
      const wire = JSON.stringify({ jsonrpc: '2.0', id: 'r1', error: { code: -32601, message: 'Not found' } });
      const msg = deserializeMessage(wire) as IpcResponse;

      expect(msg.type).toBe('response');
      expect(msg.error).toEqual({ code: -32601, message: 'Not found' });
    });

    it('classifies a parse-error response with id: null', () => {
      const wire = JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      const msg = deserializeMessage(wire) as IpcResponse;

      expect(msg.type).toBe('response');
      expect(msg.id).toBeNull();
    });

    it('classifies a notification (method, no id)', () => {
      const wire = JSON.stringify({ jsonrpc: '2.0', method: 'runtime:tick', params: { seq: 5 } });
      const msg = deserializeMessage(wire) as IpcNotification;

      expect(msg.type).toBe('notification');
      expect(msg.method).toBe('runtime:tick');
      expect(msg.params).toEqual({ seq: 5 });
    });

    it('accepts numeric id (JSON-RPC 2.0 allows number ids)', () => {
      const wire = JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'op', params: null });
      const msg = deserializeMessage(wire) as IpcRequest;

      expect(msg.type).toBe('request');
    });

    it('trims surrounding whitespace before parsing', () => {
      const wire = '  ' + JSON.stringify({ jsonrpc: '2.0', id: 'x', method: 'ping', params: null }) + '  \n';
      const msg = deserializeMessage(wire);
      expect(msg.id).toBe('x');
    });

    it('throws SyntaxError for invalid JSON', () => {
      expect(() => deserializeMessage('not-json')).toThrow(SyntaxError);
    });

    it('throws TypeError when jsonrpc field is missing', () => {
      const line = JSON.stringify({ id: 'x', method: 'ping', params: null });
      expect(() => deserializeMessage(line)).toThrow(TypeError);
    });

    it('throws TypeError for null input', () => {
      expect(() => deserializeMessage('null')).toThrow(TypeError);
    });

    it('throws TypeError when message cannot be classified', () => {
      // Has id but no method, result, or error
      const line = JSON.stringify({ jsonrpc: '2.0', id: 'x' });
      expect(() => deserializeMessage(line)).toThrow(TypeError);
    });
  });

  // ---------------------------------------------------------------------------
  // round-trip: build → serialize → deserialize
  // ---------------------------------------------------------------------------

  describe('round-trip: build → serialize → deserialize', () => {
    it('preserves request fields through serialize → deserialize', () => {
      const req = buildRequest('rt-1', 'ping', { data: 'hello' });
      const parsed = deserializeMessage(serializeMessage(req)) as IpcRequest;

      expect(parsed.type).toBe('request');
      expect(parsed.id).toBe('rt-1');
      expect(parsed.method).toBe('ping');
      expect(parsed.params).toEqual({ data: 'hello' });
    });

    it('preserves response fields through serialize → deserialize', () => {
      const resp = buildResponse('rt-2', { ok: true });
      const parsed = deserializeMessage(serializeMessage(resp)) as IpcResponse;

      expect(parsed.type).toBe('response');
      expect(parsed.id).toBe('rt-2');
      expect(parsed.result).toEqual({ ok: true });
    });

    it('preserves parse-error response with id: null through round-trip', () => {
      const resp = buildResponse(null, null, { code: -32700, message: 'Parse error' });
      const parsed = deserializeMessage(serializeMessage(resp)) as IpcResponse;

      expect(parsed.type).toBe('response');
      expect(parsed.id).toBeNull();
      expect(parsed.error).toEqual({ code: -32700, message: 'Parse error' });
    });

    it('preserves notification fields through serialize → deserialize', () => {
      const notif = buildNotification('agent:done', { agentId: 'a1' });
      const parsed = deserializeMessage(serializeMessage(notif)) as IpcNotification;

      expect(parsed.type).toBe('notification');
      expect(parsed.method).toBe('agent:done');
      expect(parsed.params).toEqual({ agentId: 'a1' });
      expect((parsed as Record<string, unknown>).id).toBeUndefined();
    });
  });
});
