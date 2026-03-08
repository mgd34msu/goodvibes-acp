/**
 * @module services/health
 * @layer L2 — extensions, imports from L0 and L1 only
 *
 * Service health checking for registered external services.
 * Performs HTTP HEAD/GET requests with configurable timeout and retry.
 * Emits events via EventBus on health status changes.
 */

import type { EventBus } from '../../core/event-bus.js';
import type { ServiceRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Health status of a single service */
export type ServiceHealthStatus = {
  /** Service name */
  name: string;
  /** Health determination */
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  /** HTTP status code from the health probe, if available */
  httpStatus?: number;
  /** Response latency in milliseconds, if available */
  latencyMs?: number;
  /** Diagnostic message */
  message?: string;
  /** ISO timestamp of this health check */
  checkedAt: string;
};

/** Options for a single health check attempt */
export interface HealthCheckOptions {
  /** Timeout in milliseconds for a single probe (default: 5000) */
  timeout?: number;
  /** Maximum number of retry attempts on network failure (default: 0) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 500) */
  retryDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// ServiceHealthChecker
// ---------------------------------------------------------------------------

/**
 * Checks external HTTP service health via HEAD/GET probes.
 *
 * STATUS: Not yet integrated with ACP (ISS-040).
 * This class is fully implemented but is not wired to any ACP extension method
 * or runtime path. It is exported for future use.
 *
 * To integrate: create a `_goodvibes/health` extension method handler:
 *   case '_goodvibes/health':
 *     const checker = new ServiceHealthChecker(registry, eventBus);
 *     const results = await checker.checkAll();
 *     return { status: 'ok', services: Object.fromEntries(results) };
 *
 * Probes each service's endpoint using an HTTP HEAD request (falls back to GET
 * on 405 Method Not Allowed). A 2xx/3xx response is healthy; 5xx is unhealthy;
 * 4xx is degraded; network errors are unhealthy after retries are exhausted.
 *
 * Events emitted:
 * - `service:health-checked` — after each individual check (success or failure)
 * - `service:health-all-checked` — after checkAll() completes
 */
export class ServiceHealthChecker {
  private readonly _registry: ServiceRegistry;
  private readonly _bus: EventBus;
  private readonly _defaultOptions: Required<HealthCheckOptions>;

  constructor(
    registry: ServiceRegistry,
    eventBus: EventBus,
    options: HealthCheckOptions = {}
  ) {
    this._registry = registry;
    this._bus = eventBus;
    this._defaultOptions = {
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      retries: options.retries ?? DEFAULT_RETRIES,
      retryDelayMs: options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Check the health of a single named service.
   *
   * @param serviceName Registered service name
   * @param options     Per-check overrides for timeout and retry
   * @returns ServiceHealthStatus snapshot
   */
  async check(
    serviceName: string,
    options?: HealthCheckOptions
  ): Promise<ServiceHealthStatus> {
    const config = this._registry.get(serviceName);

    if (!config) {
      const status: ServiceHealthStatus = {
        name: serviceName,
        status: 'unknown',
        message: `Service '${serviceName}' is not registered`,
        checkedAt: new Date().toISOString(),
      };
      this._bus.emit('service:health-checked', { status });
      return status;
    }

    const resolved: Required<HealthCheckOptions> = {
      timeout: options?.timeout ?? this._defaultOptions.timeout,
      retries: options?.retries ?? this._defaultOptions.retries,
      retryDelayMs: options?.retryDelayMs ?? this._defaultOptions.retryDelayMs,
    };

    const status = await this._probe(serviceName, config.endpoint, resolved);
    this._bus.emit('service:health-checked', { status });
    return status;
  }

  /**
   * Check the health of all registered services in parallel.
   *
   * @param options Per-check overrides applied to all services
   * @returns Map from service name to ServiceHealthStatus
   */
  async checkAll(
    options?: HealthCheckOptions
  ): Promise<Map<string, ServiceHealthStatus>> {
    const entries = this._registry.list();
    const results = await Promise.all(
      entries.map((entry) => this.check(entry.name, options))
    );

    const map = new Map<string, ServiceHealthStatus>();
    for (const result of results) {
      map.set(result.name, result);
    }

    this._bus.emit('service:health-all-checked', {
      count: map.size,
      healthy: results.filter((r) => r.status === 'healthy').length,
      unhealthy: results.filter((r) => r.status === 'unhealthy').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      unknown: results.filter((r) => r.status === 'unknown').length,
    });

    return map;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Probe an endpoint with retry support.
   * Attempts HEAD first; falls back to GET on 405.
   */
  private async _probe(
    name: string,
    endpoint: string,
    options: Required<HealthCheckOptions>
  ): Promise<ServiceHealthStatus> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      if (attempt > 0) {
        await this._delay(options.retryDelayMs);
      }

      try {
        const start = Date.now();
        let response = await this._fetchWithTimeout(endpoint, 'HEAD', options.timeout);

        // Some servers reject HEAD — retry with GET
        if (response.status === 405) {
          response = await this._fetchWithTimeout(endpoint, 'GET', options.timeout);
        }

        const latencyMs = Date.now() - start;
        return this._statusFromResponse(name, response.status, latencyMs);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      name,
      status: 'unhealthy',
      message: lastError ?? 'Unknown error',
      checkedAt: new Date().toISOString(),
    };
  }

  /** Perform a fetch with an AbortController-based timeout */
  private async _fetchWithTimeout(
    url: string,
    method: string,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { method, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Map HTTP status code to ServiceHealthStatus */
  private _statusFromResponse(
    name: string,
    httpStatus: number,
    latencyMs: number
  ): ServiceHealthStatus {
    let status: ServiceHealthStatus['status'];
    let message: string;

    if (httpStatus >= 200 && httpStatus < 400) {
      status = 'healthy';
      message = `HTTP ${httpStatus}`;
    } else if (httpStatus >= 400 && httpStatus < 500) {
      status = 'degraded';
      message = `HTTP ${httpStatus} — client error`;
    } else {
      status = 'unhealthy';
      message = `HTTP ${httpStatus} — server error`;
    }

    return { name, status, httpStatus, latencyMs, message, checkedAt: new Date().toISOString() };
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
