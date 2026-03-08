# ISS-158: Directives barrel export omits consumer-needed types

**Source**: `src/extensions/directives/index.ts` line 6
**KB Reference**: KB-03 (Barrel Exports)
**Severity**: Minor

## Issue Description
The directives barrel only exports `DirectiveQueue`. Consumers that need `Directive`, `DirectiveFilter`, `DirectiveResult`, or `DirectivePriority` must import directly from `../../types/directive.js`, breaking layer abstraction.

### Verdict: CONFIRMED

The barrel file `src/extensions/directives/index.ts` contains only:
```typescript
export { DirectiveQueue } from './queue.js';
```

Meanwhile, `queue.ts` imports `Directive`, `DirectiveFilter`, `DirectiveResult`, and `DirectivePriority` from `../../types/directive.js`. Any consumer of the directives module that needs these types must reach past the barrel into the types layer, violating the encapsulation that barrel exports are meant to provide.

## Remediation
1. Add type re-exports to `src/extensions/directives/index.ts`:
   ```typescript
   export type { Directive, DirectiveFilter, DirectiveResult, DirectivePriority } from '../../types/directive.js';
   ```
2. This allows consumers to import all directive-related types from the barrel: `import type { Directive, DirectiveQueue } from '../directives/index.js'`
