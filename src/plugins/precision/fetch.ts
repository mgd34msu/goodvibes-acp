/**
 * @module plugins/precision/fetch
 * @layer L3 — plugin
 *
 * PrecisionFetch — HTTP fetching with batch URL support and multiple extract modes.
 *
 * Features:
 *   - Batch multiple URLs in a single call (fetched in parallel)
 *   - Extract modes: raw (bytes as base64), text (utf-8), json (parsed), markdown (html→md)
 *   - Per-URL extract mode override
 *   - Configurable timeout and headers
 *
 * Uses the global fetch() API (available in Bun and Node 18+). No external deps.
 */

import type { ToolResult } from '../../types/registry.js';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

/** Extract mode for HTTP responses */
export type FetchExtractMode = 'raw' | 'text' | 'json' | 'markdown';

/** A single URL entry in a FetchParams request */
export type FetchUrlEntry = {
  /** URL to fetch */
  url: string;
  /** HTTP method (default: GET) */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  /** Request body (for POST/PUT/PATCH) */
  body?: string;
  /** Per-URL extract mode (overrides default) */
  extract?: FetchExtractMode;
  /** Per-URL headers (merged with global headers) */
  headers?: Record<string, string>;
};

/** Parameters for PrecisionFetch.fetch() */
export type FetchParams = {
  /** URLs to fetch (batched in parallel) */
  urls: FetchUrlEntry[];
  /** Default extract mode (default: text) */
  extract?: FetchExtractMode;
  /** Global headers applied to all requests */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds (default: 30000) */
  timeout_ms?: number;
};

/** Result for a single URL fetch */
export type FetchUrlResult = {
  /** The URL that was fetched */
  url: string;
  /** HTTP status code */
  status: number;
  /** Whether the fetch succeeded (status 2xx) */
  ok: boolean;
  /** Extracted content */
  content?: unknown;
  /** Content-Type header from response */
  contentType?: string;
  /** Error message on failure */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
};

/** Data payload returned by precision_fetch */
export type FetchResult = {
  /** Per-URL results */
  urls: FetchUrlResult[];
  /** Total URLs successfully fetched */
  urlsFetched: number;
  /** Total URLs that failed */
  urlsFailed: number;
  /** Total duration */
  durationMs: number;
};

// ---------------------------------------------------------------------------
// HTML to Markdown conversion (minimal, no deps)
// ---------------------------------------------------------------------------

/** Convert HTML to a simplified markdown representation */
function htmlToMarkdown(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
    // Bold/italic
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '_$2_')
    // Code
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
    // Links
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Images
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*\/?>/gi, '![$1]')
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Paragraphs and line breaks
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// PrecisionFetch
// ---------------------------------------------------------------------------

export class PrecisionFetch {
  /**
   * Fetch one or more URLs in parallel.
   * Never throws — errors are captured in per-URL results.
   */
  async fetch(params: FetchParams): Promise<ToolResult<FetchResult>> {
    const overallStart = Date.now();

    if (!Array.isArray(params.urls) || params.urls.length === 0) {
      return {
        success: false,
        error: 'precision_fetch: "urls" must be a non-empty array',
        durationMs: Date.now() - overallStart,
      };
    }

    const defaultExtract: FetchExtractMode = params.extract ?? 'text';
    const globalHeaders: Record<string, string> = params.headers ?? {};
    const timeoutMs = params.timeout_ms ?? 30_000;

    // Fetch all URLs in parallel
    const urlResults = await Promise.all(
      params.urls.map((entry) => this._fetchOne(entry, defaultExtract, globalHeaders, timeoutMs))
    );

    const urlsFetched = urlResults.filter((r) => r.ok).length;
    const urlsFailed = urlResults.length - urlsFetched;

    return {
      success: urlsFailed === 0,
      data: {
        urls: urlResults,
        urlsFetched,
        urlsFailed,
        durationMs: Date.now() - overallStart,
      },
      error:
        urlsFailed > 0
          ? `precision_fetch: ${urlsFailed} URL(s) failed`
          : undefined,
      durationMs: Date.now() - overallStart,
    };
  }

  private async _fetchOne(
    entry: FetchUrlEntry,
    defaultExtract: FetchExtractMode,
    globalHeaders: Record<string, string>,
    timeoutMs: number
  ): Promise<FetchUrlResult> {
    const start = Date.now();
    const extractMode = entry.extract ?? defaultExtract;
    const mergedHeaders = { ...globalHeaders, ...(entry.headers ?? {}) };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(entry.url, {
        method: entry.method ?? 'GET',
        headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
        body: entry.body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const contentType = response.headers.get('content-type') ?? undefined;
      let content: unknown;

      switch (extractMode) {
        case 'raw': {
          const buffer = await response.arrayBuffer();
          content = Buffer.from(buffer).toString('base64');
          break;
        }
        case 'json': {
          content = await response.json();
          break;
        }
        case 'markdown': {
          const html = await response.text();
          content = htmlToMarkdown(html);
          break;
        }
        case 'text':
        default: {
          content = await response.text();
          break;
        }
      }

      return {
        url: entry.url,
        status: response.status,
        ok: response.ok,
        content,
        contentType,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      return {
        url: entry.url,
        status: 0,
        ok: false,
        error: message,
        durationMs: Date.now() - start,
      };
    }
  }
}
