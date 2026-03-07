# ISS-057: Analytics plugin registry cast as unknown, not registered as tool-provider

**Severity**: Minor
**File**: src/plugins/analytics/index.ts
**Line(s)**: 43-44
**Topic**: Extensibility

## Issue Description
Registry parameter cast as `unknown`. Should also register as `tool-provider` via `registerMany` for tool dispatch discovery.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (general extensibility pattern)
- **Spec Says**: Extension methods and tool providers should be discoverable. The ACP spec itself doesn't mandate a specific registry pattern, but the project's internal architecture uses `registerMany('tool-provider', key, impl)` for tool dispatch.
- **Confirmed**: Partial
- **Notes**: This is a project architecture issue, not directly an ACP spec violation. The ACP spec doesn't define how internal tool providers are registered. However, the pattern is established by `src/extensions/mcp/tool-proxy.ts` and `src/plugins/review/index.ts` which both use `registerMany`.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `index.ts:43` casts registry as `unknown` then as `Registry`: `(registry as Registry).register('analytics', new AnalyticsEngine())`. Uses single-value `register()` instead of `registerMany('tool-provider', 'analytics', ...)`. The spawner at `src/plugins/agents/spawner.ts:128` looks up tools via `registry.getAll<IToolProvider>('tool-provider')` — analytics tools won't be found.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Type the `register` function parameter as `Registry` instead of `unknown`
2. Add `reg.registerMany('tool-provider', 'analytics', analyticsEngine)` if analytics should be discoverable as a tool provider
3. Alternatively, if analytics is not a tool provider, document why it uses single-value registration
