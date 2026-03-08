# ISS-149 — L1 Core barrel re-exports L0 types, blurring layer boundary

**Severity**: nitpick
**File**: `src/core/index.ts`
**Lines**: 58-59
**KB Reference**: KB-00 (Layer Discipline)

## Issue Description

The L1 core barrel (`src/core/index.ts`) re-exports types from `../types/` (L0), which blurs the boundary between layers.

## Source Evidence

- Line 58: `export type { TriggerDefinition, TriggerContext } from '../types/trigger.js';`
- Line 59: `export type { ITriggerHandler } from '../types/registry.js';`

These re-export L0 types through the L1 barrel, making it ambiguous whether a consumer is importing from L0 or L1.

### Verdict: CONFIRMED

The re-exports are present. This is architecturally valid (L1 may depend on L0) but blurs the import boundary. Consumers importing from `src/core` get L0 types mixed with L1 implementations.

## Remediation

1. Document the intentional re-exports with a comment block explaining the convenience rationale
2. Alternatively, have consumers import L0 types directly from `src/types/` and L1 implementations from `src/core/`
3. If a unified entry point is desired, create a top-level barrel that explicitly aggregates both layers
