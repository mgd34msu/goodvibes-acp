import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { IpcRouter } from '../../src/extensions/ipc/router.js';
import { buildRequest } from '../../src/extensions/ipc/protocol.js';

describe('IpcRouter', () => {
  let bus: EventBus;
  let router: IpcRouter;

  beforeEach(() => {
    bus = new EventBus();
    router = new IpcRouter(bus);
  });

  // ---------------------------------------------------------------------------
  // Built-in: ping
  // ---------------------------------------------------------------------------

  describe('built-in ping handler', () => {
    it('responds with result.pong=true and echoes the params', async () => {
      const req = buildRequest('ping-1', 'ping', { hello: 'world' });
      const resp = await router.route(req);

      expect(resp.error).toBeUndefined();
      expect(resp.id).toBe('ping-1');
      const result = resp.result as { pong: boolean; echo: unknown };
      expect(result.pong).toBe(true);
      expect(result.echo).toEqual({ hello: 'world' });
    });

    it('ping with null params echoes null', async () => {
      const req = buildRequest('ping-null', 'ping', null);
      const resp = await router.route(req);

      expect(resp.error).toBeUndefined();
      const result = resp.result as { echo: unknown };
      expect(result.echo).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Built-in: status
  // ---------------------------------------------------------------------------

  describe('built-in status handler', () => {
    it('responds with a status snapshot containing expected fields', async () => {
      const req = buildRequest('status-1', 'status');
      const resp = await router.route(req);

      expect(resp.error).toBeUndefined();
      const result = resp.result as Record<string, unknown>;
      expect(typeof result.pid).toBe('number');
      expect(typeof result.uptime).toBe('number');
      expect(result.memoryUsage).toBeDefined();
      expect(typeof result.handlerCount).toBe('number');
      expect(typeof result.timestamp).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown method
  // ---------------------------------------------------------------------------

  describe('unknown method', () => {
    it('returns an error response for unregistered method', async () => {
      const req = buildRequest('u-1', 'nonexistent-method');
      const resp = await router.route(req);

      expect(resp.error).toBeDefined();
      expect(resp.error!.message).toContain('Unknown method: nonexistent-method');
      expect(resp.id).toBe('u-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Custom handler registration
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('registers and routes to a custom handler', async () => {
      router.register('echo', (req) => ({ echo: req.params, reversed: true }));

      const req = buildRequest('echo-1', 'echo', { msg: 'hello' });
      const resp = await router.route(req);

      expect(resp.error).toBeUndefined();
      const result = resp.result as { echo: unknown; reversed: boolean };
      expect(result.echo).toEqual({ msg: 'hello' });
      expect(result.reversed).toBe(true);
    });

    it('overwrites a previously registered handler', async () => {
      router.register('echo', () => 'first');
      router.register('echo', () => 'second');

      const req = buildRequest('ow-1', 'echo');
      const resp = await router.route(req);

      expect(resp.error).toBeUndefined();
      expect(resp.result).toBe('second');
    });

    it('can overwrite a built-in handler', async () => {
      router.register('ping', () => ({ overridden: true }));

      const req = buildRequest('bip-1', 'ping');
      const resp = await router.route(req);

      expect(resp.error).toBeUndefined();
      const result = resp.result as { overridden: boolean };
      expect(result.overridden).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Handler error capture
  // ---------------------------------------------------------------------------

  describe('handler error handling', () => {
    it('captures handler throws and returns error response with message', async () => {
      router.register('explode', () => {
        throw new Error('handler crashed');
      });

      const req = buildRequest('err-1', 'explode');
      const resp = await router.route(req);

      expect(resp.error).toBeDefined();
      expect(resp.error!.message).toBe('handler crashed');
      expect(resp.id).toBe('err-1');
    });

    it('captures async handler rejections and returns error response', async () => {
      router.register('async-fail', async () => {
        throw new Error('async crash');
      });

      const req = buildRequest('af-1', 'async-fail');
      const resp = await router.route(req);

      expect(resp.error).toBeDefined();
      expect(resp.error!.message).toBe('async crash');
    });
  });

  // ---------------------------------------------------------------------------
  // Response structure
  // ---------------------------------------------------------------------------

  describe('response structure', () => {
    it('every response has type=response, an id, and jsonrpc=2.0', async () => {
      const req = buildRequest('struct-1', 'ping');
      const resp = await router.route(req);

      expect(resp.type).toBe('response');
      expect(resp.jsonrpc).toBe('2.0');
      expect(resp.id).toBe('struct-1');
      expect(resp.result).toBeDefined();
    });

    it('successive responses carry the corresponding request id', async () => {
      const r1 = await router.route(buildRequest('a', 'ping'));
      const r2 = await router.route(buildRequest('b', 'ping'));
      expect(r1.id).toBe('a');
      expect(r2.id).toBe('b');
    });
  });
});
