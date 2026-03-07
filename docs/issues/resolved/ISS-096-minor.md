# ISS-096: _meta field missing documentation of W3C reserved keys

**Severity**: Minor
**File**: src/types/events.ts
**Line(s)**: 24
**Topic**: Overview

## Issue Description
`_meta` field uses `Record<string, unknown>` but W3C trace context reserved keys (`traceparent`, `tracestate`, `baggage`) are not documented. Add comment, type, or `MetaReservedKeys` constant.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 01-overview.md, lines 374-390
- **Spec Says**: "All ACP types accept an optional `_meta` field for custom data. Reserved keys follow W3C trace context: `traceparent`, `tracestate`, `baggage`." These keys have specific semantics defined by the W3C Trace Context specification.
- **Confirmed**: Yes
- **Notes**: The spec explicitly identifies three reserved key names that should not be used for custom purposes.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 24: `_meta?: Record<string, unknown>;` with comment `/** Optional metadata (protocol info, trace ids, etc.) */`. No mention of the specific reserved keys or their W3C trace context semantics.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add a JSDoc comment listing the reserved keys:
   ```typescript
   /**
    * Optional metadata. Reserved keys per ACP spec (W3C Trace Context):
    * - `traceparent`: W3C trace parent header
    * - `tracestate`: W3C trace state header  
    * - `baggage`: W3C baggage header
    */
   _meta?: Record<string, unknown>;
   ```
2. Optionally define a `MetaReservedKeys` constant: `export const META_RESERVED_KEYS = ['traceparent', 'tracestate', 'baggage'] as const;`
