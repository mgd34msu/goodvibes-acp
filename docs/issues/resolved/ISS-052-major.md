# ISS-052: agent.ts extMethod has incomplete implementation that shadows GoodVibesExtensions

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 395-418
**Topic**: Extensibility

## Issue Description
`extMethod` handles only `_goodvibes/state` and `_goodvibes/agents` but does NOT delegate to `GoodVibesExtensions`. That class handles all 5 methods (`_goodvibes/status`, `_goodvibes/state`, `_goodvibes/events`, `_goodvibes/agents`, `_goodvibes/analytics`) but agent's `extMethod` has its own incomplete implementation that shadows it.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (lines 189-198)
- **Spec Says**: The GoodVibes namespace defines 5 extension methods: `_goodvibes/status`, `_goodvibes/state`, `_goodvibes/events`, `_goodvibes/agents`, `_goodvibes/analytics`. All should be handled.
- **Confirmed**: Yes
- **Notes**: The KB table at line 191-198 lists all 5 methods. The agent only handles 2 of them directly and throws for the rest.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `agent.ts:420-437` has a switch statement handling only `_goodvibes/state` and `_goodvibes/agents`. The `default` case throws `METHOD_NOT_FOUND`. `GoodVibesExtensions` (extensions.ts:53-67) has a complete `handle()` method for all 5 methods, but `agent.ts` never imports or calls it. Grep for `extensions.handle` and `GoodVibesExtensions` in agent.ts returns zero matches.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Inject `GoodVibesExtensions` into the agent class (via constructor or registry)
2. Replace the inline switch in `extMethod` with delegation: `return this.extensions.handle(method, params)`
3. Remove the duplicated `_goodvibes/state` and `_goodvibes/agents` logic from agent.ts
