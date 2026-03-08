# ISS-038 — filesModified Always undefined — WRFC _meta File Lists Always Empty

**Severity**: Major
**File**: src/plugins/agents/spawner.ts:51-56, 380-381
**KB Topic**: Implementation Guide — WRFC as Tool Calls (10-implementation-guide.md section 6, lines 414-420)

## Original Issue
`filesModified` is always `undefined` with a TODO comment, defaulting to `[]` in `_buildResult`. ACP `tool_call_update` notifications have empty file modification data.

## Verification

### Source Code Check
At `src/plugins/agents/spawner.ts:51-56`, the `AgentState` type defines:
```typescript
/**
 * Files modified by the agent loop.
 * TODO: Populate from AgentLoopResult once the loop tracks file modifications.
 * Currently undefined because AgentLoopResult does not expose this information.
 */
filesModified: string[] | undefined;
```

At `src/plugins/agents/spawner.ts:380-381`, `_buildResult()` defaults to empty:
```typescript
filesModified: state.filesModified ?? [],
```

Since `filesModified` is never populated (always `undefined`), the nullish coalescing always produces `[]`.

### ACP Spec Check
KB-10 (Implementation Guide, section 6, lines 414-420) shows the WRFC `tool_call_update` notification should include:
```typescript
locations: workResult.filesModified.map(f => ({ path: f })),
_meta: {
  '_goodvibes/files': workResult.filesModified,
},
```
Without real file modification data, the `locations` array is always empty and `_goodvibes/files` metadata is always `[]`. Clients cannot display which files were modified by an agent.

### Verdict: CONFIRMED
`filesModified` has a TODO comment acknowledging it is unimplemented. The field is always `undefined`, defaulting to `[]`. ACP `tool_call_update` notifications will always have empty file lists.

## Remediation
1. Track file modifications in `AgentLoop` by intercepting file write/edit tool calls:
   ```typescript
   // In AgentLoop, track files modified during tool execution
   private _filesModified = new Set<string>();

   // After tool execution, check if it was a file-modifying tool
   if (['write_file', 'edit_file', 'create_file'].includes(toolName)) {
     this._filesModified.add(input.path);
   }
   ```
2. Expose `filesModified` in `AgentLoopResult`.
3. Wire `AgentLoopResult.filesModified` into `AgentState.filesModified` in the spawner.
4. Remove the TODO comments once implemented.
