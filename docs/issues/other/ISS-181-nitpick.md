# ISS-181 — Plugin Register Casts `registry as Registry` from `unknown`

**Severity**: Nitpick
**File**: `src/plugins/project/index.ts:77`
**KB Topic**: Filesystem & Terminal

## Original Issue
`[src/plugins/project/index.ts:77]` `register` casts `registry as Registry` — couples L3 to L1 internals. *(Filesystem & Terminal)*

## Verification

### Source Code Check
Line 77–78 of `src/plugins/project/index.ts`:
```typescript
register: (registry: unknown) => {
  (registry as Registry).register('project-analyzer', new ProjectAnalyzer());
},
```
The `PluginRegistration` interface types the `register` callback as `(registry: unknown) => void`, so the cast from `unknown` to `Registry` is necessary to call `.register()`. The `Registry` import is at line 28. The cast is real.

### ACP Spec Check
The ACP knowledgebase (KB 07 — Filesystem & Terminal, KB 08 — Extensibility, KB 10 — Implementation Guide) contains no mention of plugin registration interfaces or the layer coupling concern described here. This is a TypeScript architecture concern, not a protocol concern.

### Verdict: NOT_ACP_ISSUE
The code does exactly what the issue describes: it receives `unknown` and casts to `Registry`. This is a layer-coupling and type-safety smell (L3 plugin directly importing L1 `Registry` type), but it has no bearing on ACP wire protocol compliance. The KB topic annotation of "Filesystem & Terminal" is a mislabeling — this file has nothing to do with filesystem operations.

## Remediation
N/A — not an ACP compliance issue.

For code quality: define a `IPluginRegistry` interface in L0 types that exposes only `register(key: string, value: unknown): void`, and type the `PluginRegistration.register` callback against that interface instead of `unknown`. This removes the L3→L1 coupling.
