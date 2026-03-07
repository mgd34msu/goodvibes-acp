# ISS-058: Frontend plugin registers only in single-value registry, not as tool-provider

**Severity**: Minor
**File**: src/plugins/frontend/index.ts
**Line(s)**: 43-45
**Topic**: Extensibility

## Issue Description
Same pattern as ISS-057 — registers only in single-value registry, not as `tool-provider`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (general extensibility pattern)
- **Spec Says**: Same as ISS-057 — this is a project architecture issue, not a direct ACP spec violation.
- **Confirmed**: Partial
- **Notes**: Same rationale as ISS-057. The `tool-provider` multi-value registry pattern is the project's established convention for tool dispatch discovery.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `index.ts:43-45` shows `(registry as Registry).register('frontend-analyzer', new FrontendAnalyzer())` — single-value registration, same `unknown` cast pattern. Not registered under `tool-provider` collection, so spawner's `getAll<IToolProvider>('tool-provider')` won't find it.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Type the `register` function parameter as `Registry` instead of `unknown`
2. Add `reg.registerMany('tool-provider', 'frontend', analyzer)` for tool dispatch discovery
3. Consider creating a shared plugin registration helper to enforce consistent registration patterns
