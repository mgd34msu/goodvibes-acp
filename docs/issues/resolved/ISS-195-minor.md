# ISS-195 — Barrel Re-exports Types Through Double-hop

**Severity**: Minor
**File**: src/core/index.ts:1-90
**KB Topic**: Overview

## Original Issue

**[src/core/index.ts:1-90]** Barrel re-exports types through double-hop (`trigger-engine.ts` re-exports from `../types/`). *(Overview)*

## Verification

### Source Code Check

In `src/core/trigger-engine.ts` lines 9-12:
```typescript
import type { TriggerDefinition, TriggerContext } from '../types/trigger.js';
import type { ITriggerHandler } from '../types/registry.js';

export type { TriggerDefinition, TriggerContext, ITriggerHandler };
```

And in `src/core/index.ts` lines 55-62:
```typescript
export type {
  TriggerDefinition,
  TriggerContext,
  ITriggerHandler,
  TriggerDefinitionWithCondition,
} from './trigger-engine.js';
export { TriggerEngine } from './trigger-engine.js';
```

So the chain is: `src/types/trigger.ts` → exported by `src/core/trigger-engine.ts` → re-exported by `src/core/index.ts`. This is a confirmed double-hop re-export for `TriggerDefinition` and `TriggerContext`.

### ACP Spec Check

The ACP Overview KB covers protocol architecture, not TypeScript module organization patterns. Barrel file organization, re-export patterns, and module graph structure are purely internal TypeScript/build system concerns. The ACP specification has no requirements about how agents structure their internal TypeScript modules.

This does not affect ACP wire-format compliance, capability negotiation, session management, or any other protocol-level behavior.

### Verdict: NOT_ACP_ISSUE

The issue is real: double-hop re-exports can cause TypeScript declaration emit issues in some configurations, create confusing import paths, and increase bundle analysis complexity. However, this is a code organization / TypeScript best practice issue. The ACP specification does not govern internal module structure. This is not an ACP compliance issue.

## Remediation

N/A (not an ACP compliance issue)

For cleaner module structure, re-export directly from the source:
```typescript
// In src/core/index.ts — import directly from types source:
export type { TriggerDefinition, TriggerContext } from '../types/trigger.js';
export type { ITriggerHandler } from '../types/registry.js';
// Keep TriggerDefinitionWithCondition and TriggerEngine from trigger-engine.ts
export type { TriggerDefinitionWithCondition } from './trigger-engine.js';
export { TriggerEngine } from './trigger-engine.js';
```
