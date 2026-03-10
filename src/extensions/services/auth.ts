/**
 * @module services/auth
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * Authentication orchestration for named external services.
 * Supports bearer token, HTTP basic, and API-key auth methods.
 * Provides callback-based token refresh support.
 * Emits events via EventBus on auth success/failure.
 */

import type { EventBus } from '../../core/event-bus.js';
import type { ServiceConfig, ServiceRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of an authentication attempt */
export interface AuthResult {
  /** Whether authentication succeeded */
  success: boolean;
  /** HTTP Authorization header value or API key header value, if applicable */
  headerValue?: string;
  /** The header name to use (e.g. 'Authorization', 'X-API-Key') */
  headerName?: string;
  /** Error message if auth failed */
  error?: string;
  /** ISO timestamp of this auth result */
  timestamp: string;
}

/**
 * Callback invoked when a token needs refreshing.
 * Should return the new token string, or throw on failure.
 */
export type TokenRefreshCallback = (serviceName: string) => Promise<string>;

/** Options for ServiceAuthOrchestrator construction */
export interface AuthOrchestratorOptions {
  /**
   * Optional callback for bearer token refresh.
   * Called when a bearer token is expired or missing and needs renewal.
   */
  onTokenRefresh?: TokenRefreshCallback;
}

// ---------------------------------------------------------------------------
// AuthOrchestrator
// ---------------------------------------------------------------------------

/**
 * Handles outbound authentication to external services (API keys, tokens).
 * NOT the same as ACP inbound client authentication (which uses authMethods/authenticate).
 *
 * STATUS: Not yet integrated with ACP (ISS-039).
 * This class is fully implemented but is not wired to any ACP extension method
 * or runtime path. It is exported for future use.
 *
 * To integrate: create a `_goodvibes/auth` extension method handler and
 * instantiate this class in the runtime:
 *   case '_goodvibes/auth':
 *     return authOrchestrator.authenticate(serviceName);
 *
 * Builds auth credentials from a ServiceConfig and emits events on
 * success or failure. Supports bearer, basic, and api-key strategies.
 *
 * Events emitted:
 * - `auth:success` — on successful authentication
 * - `auth:failure` — on authentication failure
 */
export class ServiceAuthOrchestrator {
  private readonly _registry: ServiceRegistry;
  private readonly _bus: EventBus;
  private readonly _onTokenRefresh?: TokenRefreshCallback;

  constructor(
    registry: ServiceRegistry,
    eventBus: EventBus,
    options: AuthOrchestratorOptions = {}
  ) {
    this._registry = registry;
    this._bus = eventBus;
    this._onTokenRefresh = options.onTokenRefresh;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Authenticate against a named service.
   *
   * Resolves auth credentials from the registered ServiceConfig.
   * If a bearer token refresh callback is provided and the token is missing,
   * the callback is invoked to obtain a fresh token.
   *
   * @param serviceName Registered service name
   * @returns AuthResult with credential info or error
   */
  async authenticate(serviceName: string): Promise<AuthResult> {
    const config = this._registry.get(serviceName);

    if (!config) {
      const result = this._failure(
        `Service '${serviceName}' is not registered`
      );
      this._bus.emit('auth:failure', { serviceName, error: result.error });
      return result;
    }

    try {
      const result = await this._resolveAuth(serviceName, config);
      if (result.success) {
        this._bus.emit('auth:success', { serviceName, headerName: result.headerName });
      } else {
        this._bus.emit('auth:failure', { serviceName, error: result.error });
      }
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      const result = this._failure(error);
      this._bus.emit('auth:failure', { serviceName, error });
      return result;
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _resolveAuth(
    serviceName: string,
    config: ServiceConfig
  ): Promise<AuthResult> {
    if (!config.auth) {
      // No auth configured — success with no credentials
      return { success: true, timestamp: new Date().toISOString() };
    }

    const { type } = config.auth;

    switch (type) {
      case 'bearer': {
        let token = config.auth.token;
        if (!token && this._onTokenRefresh) {
          token = await this._onTokenRefresh(serviceName);
        }
        if (!token) {
          return this._failure('Bearer token is missing and no refresh callback provided');
        }
        return {
          success: true,
          headerName: 'Authorization',
          headerValue: `Bearer ${token}`,
          timestamp: new Date().toISOString(),
        };
      }

      case 'basic': {
        const { username, password } = config.auth;
        if (!username || !password) {
          return this._failure('Basic auth requires username and password');
        }
        const encoded = Buffer.from(`${username}:${password}`).toString('base64');
        return {
          success: true,
          headerName: 'Authorization',
          headerValue: `Basic ${encoded}`,
          timestamp: new Date().toISOString(),
        };
      }

      case 'api-key': {
        const { key, header } = config.auth;
        if (!key) {
          return this._failure('API key is missing');
        }
        return {
          success: true,
          headerName: header ?? 'X-API-Key',
          headerValue: key,
          timestamp: new Date().toISOString(),
        };
      }

      default: {
        const exhaustive: never = type;
        return this._failure(`Unknown auth type: ${exhaustive}`);
      }
    }
  }

  private _failure(error: string): AuthResult {
    return { success: false, error, timestamp: new Date().toISOString() };
  }
}

/** Alias for backwards compatibility */
export { ServiceAuthOrchestrator as AuthOrchestrator };
