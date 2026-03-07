# ISS-053: agent.ts extMethod responses missing _meta.version

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 395-418
**Topic**: Extensibility

## Issue Description
`extMethod` responses for `_goodvibes/state` and `_goodvibes/agents` do NOT include `_meta.version`. `GoodVibesExtensions` correctly adds `_meta: { version: '0.1.0' }` on every response; agent's direct responses return bare objects.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (lines 16-27)
- **Spec Says**: Every type in ACP includes an optional `_meta` field. The `GoodVibesExtensions` class establishes a convention of including `_meta: { version }` on all responses (line 20 of extensions.ts: `const META = { version: META_VERSION } as const`). This is a project convention for versioning extension responses.
- **Confirmed**: Yes
- **Notes**: While `_meta` is technically optional per ACP, the project's own `GoodVibesExtensions` class treats it as mandatory for all responses. The agent's inline implementation breaks this internal consistency.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `agent.ts:427` returns `{ session: context ?? null }` and `agent.ts:431` returns `{ agents: spawners ?? [] }` — neither includes `_meta`. Meanwhile, `extensions.ts:20` defines `const META = { version: META_VERSION }` and all methods in `GoodVibesExtensions` append it.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. If keeping inline implementation: add `_meta: { version: '0.1.0' }` to all returned objects
2. Better: delegate to `GoodVibesExtensions.handle()` (resolves ISS-052 simultaneously)
