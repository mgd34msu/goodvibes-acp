# ISS-143 — Barrel export uses wildcard re-export, exposing internals

**Severity**: nitpick
**File**: `src/extensions/hooks/index.ts`
**Line**: 10
**KB Reference**: KB-08 (API Surface)

## Issue Description

Line 10 uses `export * from './built-ins.js'` which re-exports everything from `built-ins.ts`, including the internal `HookContext` interface alongside the public hook functions.

## Source Evidence

- `src/extensions/hooks/index.ts` line 10: `export * from './built-ins.js';`
- `src/extensions/hooks/built-ins.ts` exports: `HookContext` (interface), `validateAgentConfig`, `emitAgentSpawned`, `emitWrfcReviewScore`, `emitWrfcCompleted`, `emitSessionCreated`, `emitSessionDestroyed`

### Verdict: CONFIRMED

The wildcard re-export exposes all 7 exports from `built-ins.ts`. `HookContext` is an implementation-level interface that consumers outside the hooks module likely should not depend on.

## Remediation

1. Replace `export * from './built-ins.js'` with a named export list:
   ```typescript
   export { validateAgentConfig, emitAgentSpawned, emitWrfcReviewScore, emitWrfcCompleted, emitSessionCreated, emitSessionDestroyed } from './built-ins.js';
   ```
2. If `HookContext` is intentionally public, add it to the named list with a JSDoc comment
