# ISS-148 — L0 `SessionConfigOptionChoice` missing `_meta` field

**Severity**: nitpick
**File**: `src/types/config.ts`
**Lines**: 76-83
**KB Reference**: KB-08 (Extensibility)

## Issue Description

KB-08 states that every ACP type includes an optional `_meta` field for extensibility. The L0 `SessionConfigOptionChoice` type omits it.

## Source Evidence

- `src/types/config.ts` lines 76-83:
  ```typescript
  export type SessionConfigOptionChoice = {
    value: string;
    label?: string;
    description?: string;
  };
  ```
- KB-08 specifies: "Every type in the ACP protocol includes an optional `_meta` field" with type `{ [key: string]: unknown }`

### Verdict: CONFIRMED

The `SessionConfigOptionChoice` type is missing the `_meta` field that KB-08 requires on all protocol types. This prevents extensibility metadata (e.g., trace context, custom annotations) from being attached to config option choices.

## Remediation

1. Add `_meta?: Record<string, unknown>` to `SessionConfigOptionChoice`:
   ```typescript
   export type SessionConfigOptionChoice = {
     value: string;
     label?: string;
     description?: string;
     _meta?: Record<string, unknown>;
   };
   ```
