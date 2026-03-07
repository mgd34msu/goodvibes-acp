# ISS-124 — No Guard Against Overwriting W3C Reserved _meta Keys in extensions.ts

**Severity**: Minor
**File**: `src/extensions/acp/extensions.ts:1-321`
**KB Topic**: Extensibility

## Original Issue
No guard against overwriting W3C reserved `_meta` keys (`traceparent`, `tracestate`, `baggage`). Add validation utility or document invariant. *(Extensibility)*

## Verification

### Source Code Check
`extensions.ts` adds `_meta: { version: META_VERSION }` to all extension responses:
```typescript
const META = { version: META_VERSION } as const;
```

Every response from `GoodVibesExtensions.handle()` appends `_meta: META`. This uses the key `version` — not a W3C reserved key (`traceparent`, `tracestate`, `baggage`). The code does not write to W3C reserved keys, nor does it guard against callers passing `_meta` with reserved keys.

However, the issue points at the entire file (lines 1-321) as lacking a validation utility that prevents consumers from accidentally overwriting W3C reserved keys in `_meta`.

### ACP Spec Check
KB-08 defines the W3C reserved `_meta` keys:
| Key | Purpose |
|-----|--------|
| `traceparent` | Distributed trace ID + span ID |
| `tracestate` | Vendor-specific trace state |
| `baggage` | Key-value propagation |

KB-08 states: "Using them for other purposes breaks OpenTelemetry interop." The spec recommends namespaced keys for custom data. There is no ACP spec requirement to validate or guard against key collisions in `_meta` — the spec only recommends namespacing. The concern is a best-practice issue, not a compliance requirement.

### Verdict: NOT_ACP_ISSUE
The current implementation does not overwrite W3C reserved keys (it only sets `version`). The issue is a preventive quality concern — adding a runtime guard or lint rule to prevent future accidental collisions. This is a code quality improvement, not an ACP compliance failure. The ACP spec does not require validation of `_meta` key names; it only recommends namespacing conventions.

## Remediation
N/A for ACP compliance. For code quality:
1. Add a `validateMetaKeys()` utility that warns or throws if W3C reserved keys appear in a `_meta` object produced by GoodVibes code.
2. Document the reserved key constraint in a comment near the `META` constant in `extensions.ts`.
3. Consider adding an ESLint rule or TypeScript type to prevent `traceparent`/`tracestate`/`baggage` in GoodVibes `_meta` objects.
