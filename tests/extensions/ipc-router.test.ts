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
    it('responds ok=true with pong:true and echoes the payload', async () => {
      const req = buildRequest('ping-1', 'ping', { hello: 'world' });
      const resp = await router.route(req);

      expect(resp.ok).toBe(true);
      expect(resp.correlationId).toBe('ping-1');
      const result = resp.payload as { pong: boolean; echo: unknown };
      expect(result.pong).toBe(true);
      expect(result.echo).toEqual({ hello: 'world' });
    });

    it('ping with null payload echoes null', async () => {
      const req = buildRequest('ping-null', 'ping', null);
      const resp = await router.route(req);

      expect(resp.ok).toBe(true);
      const result = resp.payload as { echo: unknown };
      expect(result.echo).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Built-in: status
  // ---------------------------------------------------------------------------

  describe('built-in status handler', () => {
    it('responds ok=true with a status snapshot containing expected fields', async () => {
      const req = buildRequest('status-1', 'status');
      const resp = await router.route(req);

      expect(resp.ok).toBe(true);
      const result = resp.payload as Record<string, unknown>;
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
    it('returns ok=false with error message for unregistered method', async () => {
      const req = buildRequest('u-1', 'nonexistent-method');
      const resp = await router.route(req);

      expect(resp.ok).toBe(false);
      expect(resp.error).toContain('Unknown method: nonexistent-method');
      expect(resp.correlationId).toBe('u-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Custom handler registration
  // ---------------------------------------------------------------------------

  describe('register', () => {
    it('registers and routes to a custom handler', async () => {
      router.register('echo', (req) => ({ echo: req.payload, reversed: true }));

      const req = buildRequest('echo-1', 'echo', { msg: 'hello' });
      const resp = await router.route(req);

      expect(resp.ok).toBe(true);
      const result = resp.payload as { echo: unknown; reversed: boolean };
      expect(result.echo).toEqual({ msg: 'hello' });
      expect(result.reversed).toBe(true);
    });

    it('overwrites a previously registered handler', async () => {
      router.register('echo', () => 'first');
      router.register('echo', () => 'second');

      const req = buildRequest('ow-1', 'echo');
      const resp = await router.route(req);

      expect(resp.ok).toBe(true);
      expect(resp.payload).toBe('second');
    });

    it('can overwrite a built-in handler', async () => {
      router.register('ping', () => ({ overridden: true }));

      const req = buildRequest('bip-1', 'ping');
      const resp = await router.route(req);

      expect(resp.ok).toBe(true);
      const result = resp.payload as { overridden: boolean };
      expect(result.overridden).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Handler error capture
  // ---------------------------------------------------------------------------

  describe('handler error handling', () => {
    it('captures handler throws and returns ok=false with error message', async () => {
      router.register('explode', () => {
        throw new Error('handler crashed');
      });

      const req = buildRequest('err-1', 'explode');
      const resp = await router.route(req);

      expect(resp.ok).toBe(false);
      expect(resp.error).toBe('handler crashed');
      expect(resp.correlationId).toBe('err-1');
    });

    it('captures async handler rejections and returns ok=false', async () => {
      router.register('async-fail', async () => {
        throw new Error('async crash');
      });

      const req = buildRequest('af-1', 'async-fail');
      const resp = await router.route(req);

      expect(resp.ok).toBe(false);
      expect(resp.error).toBe('async crash');
    });
  });

  // ---------------------------------------------------------------------------
  // Response structure
  // ---------------------------------------------------------------------------

  describe('response structure', () => {
    it('every response has type=response, an id, correlationId, ok, timestamp', async () => {
      const req = buildRequest('struct-1', 'ping');
      const resp = await router.route(req);

      expect(resp.type).toBe('response');
      expect(typeof resp.id).toBe('string');
      expect(resp.correlationId).toBe('struct-1');
      expect(typeof resp.ok).toBe('boolean');
      expect(typeof resp.timestamp).toBe('number');
    });

    it('successive responses have different ids', async () => {
      const r1 = await router.route(buildRequest('a', 'ping'));
      const r2 = await router.route(buildRequest('b', 'ping'));
      expect(r1.id).not.toBe(r2.id);
    });
  });
});
