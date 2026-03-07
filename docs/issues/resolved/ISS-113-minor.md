# ISS-113 — Hooks Barrel Export Omits Built-in Hook Functions

**Severity**: Minor
**File**: src/extensions/hooks/index.ts:9
**KB Topic**: Permissions

## Original Issue

**[src/extensions/hooks/index.ts:9]** Barrel export only exports `HookRegistrar`. Built-in hook functions not re-exported. *(Permissions)*

## Verification

### Source Code Check

`src/extensions/hooks/index.ts` (entire file):

```typescript
/**
 * @module extensions/hooks
 * @layer L2 — extensions
 *
 * Barrel export for the hooks module.
 * Provides HookRegistrar for pre-registering GoodVibes built-in hooks.
 */

export { HookRegistrar } from './registrar.js';
```

The file `src/extensions/hooks/built-ins.ts` exports five functions: `validateAgentConfig`, `emitAgentSpawned`, `emitWrfcReviewScore`, `emitWrfcCompleted`, `emitSessionCreated`, `emitSessionDestroyed`. None are re-exported from the barrel.

### ACP Spec Check

ACP does not define or require a hooks barrel export pattern. Module export organization is entirely an implementation detail. The spec has no concept of a "hook registrar" or built-in hooks — those are GoodVibes-internal constructs.

### Verdict: NOT_ACP_ISSUE

This is a code organization issue: consumers who want to use individual hook functions must import directly from `built-ins.ts` rather than the module barrel. It has no bearing on ACP protocol compliance. The issue is correctly categorized as Minor for code quality but is not an ACP issue.

The issue description incorrectly categorizes this under "Permissions" KB topic — the hook functions in `built-ins.ts` are about agent spawning, WRFC reviews, and session lifecycle events. None are permission-specific.

## Remediation

N/A — not an ACP compliance issue.

For general code quality: add `export * from './built-ins.js';` to `src/extensions/hooks/index.ts` to expose the hook functions from the barrel. This is a convenience change, not a correctness fix.
