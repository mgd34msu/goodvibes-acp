# ISS-155: `ToolCallEmitter.emitToolCall` builds `_meta` unconditionally -- dead ternary branch

**Source**: `src/extensions/acp/tool-call-emitter.ts` lines 50-52
**KB Reference**: KB-06 (Code Quality)
**Severity**: Minor

## Issue Description
The conditional `meta || name` always evaluates truthy because `name` is a required string parameter. The falsy branch (empty spread `{}`) never executes.

### Verdict: CONFIRMED

Lines 50-52 show:
```typescript
...(meta || name
  ? { _meta: { ...(meta ?? {}), '_goodvibes/tool_name': name } }
  : {}),
```
Since `name` is declared as `name: string` in the method signature and is a required parameter, the expression `meta || name` will always be truthy (even empty string `''` would be falsy, but tool names are never empty). The ternary's false branch is dead code.

## Remediation
1. Remove the ternary and always include `_meta`:
   ```typescript
   _meta: { ...(meta ?? {}), '_goodvibes/tool_name': name },
   ```
2. This simplifies the code and makes the intent clearer -- `_meta` is always present per KB-08 extensibility guidelines
