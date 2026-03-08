# ISS-151: `_splitToolName` returns empty provider name for unnamespaced tools

**Source**: `src/plugins/agents/loop.ts` lines 287-291
**KB Reference**: KB-10 (Tool Namespacing)
**Severity**: Minor

## Issue Description
`_splitToolName` returns `['', fullName]` when a tool name has no `__` separator. The subsequent provider lookup at line 234 (`this.config.tools.find(p => p.name === providerName)`) will never match an empty string, producing a generic "unknown tool provider" error that obscures the root cause.

### Verdict: CONFIRMED

The code at line 289 clearly returns `['', fullName]` for unnamespaced tools. At line 234, the empty provider name causes a lookup failure with an unhelpful error message `unknown tool provider ""`. The user sees no indication that the issue is a missing namespace separator.

## Remediation
1. Add a guard in `_splitToolName` or at the call site to detect unnamespaced tool names
2. Provide a descriptive error: `"Tool name '${fullName}' is not namespaced. Expected format: 'provider__toolName'"`
3. Alternatively, support a default provider fallback for unnamespaced tools
