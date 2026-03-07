import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { ServiceRegistry } from '../../src/extensions/services/registry.js';
import { AuthOrchestrator } from '../../src/extensions/services/auth.js';
import type { ServiceConfig } from '../../src/extensions/services/registry.js';

function makeStack(tmpDir: string = '/tmp/gv-auth-test') {
  const bus = new EventBus();
  const registry = new ServiceRegistry(tmpDir, bus);
  return { bus, registry };
}

describe('AuthOrchestrator', () => {
  let bus: EventBus;
  let registry: ServiceRegistry;
  let auth: AuthOrchestrator;

  beforeEach(() => {
    ({ bus, registry } = makeStack());
    auth = new AuthOrchestrator(registry, bus);
  });

  // ---------------------------------------------------------------------------
  // Unknown service
  // ---------------------------------------------------------------------------

  describe('authenticate — unknown service', () => {
    it('returns failure when service is not registered', async () => {
      const result = await auth.authenticate('not-registered');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('emits auth:failure event for unknown service', async () => {
      const events: unknown[] = [];
      bus.on('auth:failure', (ev) => events.push(ev.payload));

      await auth.authenticate('ghost');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ serviceName: 'ghost' });
    });
  });

  // ---------------------------------------------------------------------------
  // No auth
  // ---------------------------------------------------------------------------

  describe('authenticate — no auth configured', () => {
    it('returns success with no header when config has no auth field', async () => {
      const cfg: ServiceConfig = { endpoint: 'https://open.api.io' };
      registry.register('open-api', cfg);

      const result = await auth.authenticate('open-api');

      expect(result.success).toBe(true);
      expect(result.headerName).toBeUndefined();
      expect(result.headerValue).toBeUndefined();
    });

    it('emits auth:success for no-auth service', async () => {
      const events: unknown[] = [];
      bus.on('auth:success', (ev) => events.push(ev.payload));

      registry.register('free', { endpoint: 'https://free.io' });
      await auth.authenticate('free');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ serviceName: 'free' });
    });
  });

  // ---------------------------------------------------------------------------
  // Bearer auth
  // ---------------------------------------------------------------------------

  describe('authenticate — bearer', () => {
    it('returns correct Authorization: Bearer header', async () => {
      registry.register('bearer-svc', {
        endpoint: 'https://api.io',
        auth: { type: 'bearer', token: 'my-token' },
      });

      const result = await auth.authenticate('bearer-svc');

      expect(result.success).toBe(true);
      expect(result.headerName).toBe('Authorization');
      expect(result.headerValue).toBe('Bearer my-token');
    });

    it('uses refresh callback when token is missing', async () => {
      registry.register('refresh-svc', {
        endpoint: 'https://api.io',
        auth: { type: 'bearer' },
      });

      const refreshAuth = new AuthOrchestrator(registry, bus, {
        onTokenRefresh: async () => 'refreshed-token',
      });

      const result = await refreshAuth.authenticate('refresh-svc');

      expect(result.success).toBe(true);
      expect(result.headerValue).toBe('Bearer refreshed-token');
    });

    it('fails when token is missing and no refresh callback provided', async () => {
      registry.register('no-token', {
        endpoint: 'https://api.io',
        auth: { type: 'bearer' },
      });

      const result = await auth.authenticate('no-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bearer token is missing');
    });

    it('emits auth:success on bearer success', async () => {
      const events: unknown[] = [];
      bus.on('auth:success', (ev) => events.push(ev.payload));

      registry.register('bs', { endpoint: 'https://x.io', auth: { type: 'bearer', token: 'tok' } });
      await auth.authenticate('bs');

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ serviceName: 'bs', headerName: 'Authorization' });
    });
  });

  // ---------------------------------------------------------------------------
  // Basic auth
  // ---------------------------------------------------------------------------

  describe('authenticate — basic', () => {
    it('returns correct Base64-encoded Authorization: Basic header', async () => {
      registry.register('basic-svc', {
        endpoint: 'https://api.io',
        auth: { type: 'basic', username: 'user', password: 'pass' },
      });

      const result = await auth.authenticate('basic-svc');

      expect(result.success).toBe(true);
      expect(result.headerName).toBe('Authorization');
      const decoded = Buffer.from(result.headerValue!.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('user:pass');
    });

    it('fails when username is missing', async () => {
      registry.register('basic-no-user', {
        endpoint: 'https://api.io',
        auth: { type: 'basic', password: 'pass' },
      });

      const result = await auth.authenticate('basic-no-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('username and password');
    });

    it('fails when password is missing', async () => {
      registry.register('basic-no-pass', {
        endpoint: 'https://api.io',
        auth: { type: 'basic', username: 'user' },
      });

      const result = await auth.authenticate('basic-no-pass');

      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // API key auth
  // ---------------------------------------------------------------------------

  describe('authenticate — api-key', () => {
    it('returns correct X-API-Key header by default', async () => {
      registry.register('apikey-svc', {
        endpoint: 'https://api.io',
        auth: { type: 'api-key', key: 'k3y-v4lue' },
      });

      const result = await auth.authenticate('apikey-svc');

      expect(result.success).toBe(true);
      expect(result.headerName).toBe('X-API-Key');
      expect(result.headerValue).toBe('k3y-v4lue');
    });

    it('uses custom header name when specified', async () => {
      registry.register('custom-key', {
        endpoint: 'https://api.io',
        auth: { type: 'api-key', key: 'secret', header: 'X-Custom-Auth' },
      });

      const result = await auth.authenticate('custom-key');

      expect(result.success).toBe(true);
      expect(result.headerName).toBe('X-Custom-Auth');
    });

    it('fails when key is missing', async () => {
      registry.register('no-key', {
        endpoint: 'https://api.io',
        auth: { type: 'api-key' },
      });

      const result = await auth.authenticate('no-key');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key is missing');
    });
  });

  // ---------------------------------------------------------------------------
  // Result always contains timestamp
  // ---------------------------------------------------------------------------

  it('every AuthResult contains an ISO timestamp', async () => {
    registry.register('ts-svc', { endpoint: 'https://x.io' });
    const result = await auth.authenticate('ts-svc');
    expect(typeof result.timestamp).toBe('string');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
