# ISS-076 — EnvVariable and HttpHeader missing `_meta` field
**Severity**: Nitpick
**File**: `src/types/session.ts`
**KB Topic**: KB-08: Extensibility

## Original Issue
SDK includes optional `_meta` on these types. Omitting prevents metadata roundtrip.

## Verification

### Source Code Check
`src/types/session.ts` lines 33 and 39:
```
export type EnvVariable = { name: string; value: string };
export type HttpHeader = { name: string; value: string };
```
Neither type includes an optional `_meta` field.

### ACP Spec Check
KB-08 states: "Every type in the ACP protocol includes an optional `_meta` field." This includes nested types like content blocks, tool calls, and capability objects. `EnvVariable` and `HttpHeader` are ACP types used in session configuration.

### Verdict: CONFIRMED
Both types lack the optional `_meta` field that KB-08 requires on all ACP protocol types. While these are simple configuration types where `_meta` is rarely used, the spec requirement is clear.

## Remediation
1. Add `_meta?: Record<string, unknown>` to both `EnvVariable` and `HttpHeader` types.
