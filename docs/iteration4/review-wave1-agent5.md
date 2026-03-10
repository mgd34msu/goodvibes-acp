# ACP Compliance Review: Hooks (Wave 1, Agent 5)

**Files reviewed:**
- `src/extensions/hooks/registrar.ts`
- `src/extensions/hooks/built-ins.ts`
- `src/extensions/hooks/index.ts`

**KB references:** `08-extensibility.md`, `05-permissions.md`, `06-tools-mcp.md`

---

## Issues

### 1. tool_call_update status uses 'error' instead of ACP 'failed'
**File:** `src/extensions/hooks/registrar.ts` line 205  
**KB:** KB-06 `ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed'`  
**Severity:** HIGH  
The code emits `status: 'error'` for permission-denied tool calls. ACP defines the terminal failure status as `'failed'`, not `'error'`. Clients parsing ACP-compliant status values will not recognize `'error'` as a valid state.

### 2. tool_call_update emits non-spec fields (rawOutput, toolName)
**File:** `src/extensions/hooks/registrar.ts` lines 202-211  
**KB:** KB-06 `ToolCallStatusUpdate` schema  
**Severity:** MEDIUM  
The emitted `tool:call:update` event includes `rawOutput` and `toolName` fields that are not part of the ACP `ToolCallStatusUpdate` schema. ACP defines: `sessionUpdate`, `toolCallId`, `status`, `content`, `locations`, `_meta`. Non-spec fields should go in `_meta` per KB-08 extensibility rules.

### 3. Missing sessionUpdate discriminator in tool_call_update
**File:** `src/extensions/hooks/registrar.ts` line 202  
**KB:** KB-06 `ToolCallStatusUpdate` requires `sessionUpdate: 'tool_call_update'`  
**Severity:** MEDIUM  
The emitted event object lacks the `sessionUpdate: 'tool_call_update'` discriminator field. ACP session/update notifications use this field to determine the update type. Without it, the update cannot be serialized to a compliant ACP wire message.

### 4. Permission type defaults to 'mcp' (non-spec type)
**File:** `src/extensions/hooks/registrar.ts` lines 144-151  
**KB:** KB-05 permission types: `shell`, `file_write`, `file_delete`, `network`, `browser`  
**Severity:** MEDIUM  
`'mcp'` is a GoodVibes internal extension type, not an ACP-defined permission type. Defaulting to it when `permissionType` is unset means the fallback is a non-standard value. A more ACP-aligned default (or requiring the field) would be safer. The `console.warn` added for this case is an improvement over silent defaulting.

### 5. console.warn for operational logging instead of EventBus
**File:** `src/extensions/hooks/registrar.ts` lines 146-148, 159-161, 179-180  
**KB:** KB-08 extensibility — event-based notification patterns  
**Severity:** LOW  
Multiple `console.warn` calls for operational conditions (missing permission type, permission denied, no gate wired). These should emit structured events via the EventBus (e.g., `hook:warning`) for observability. Console output is not capturable by ACP clients.

### 6. HookContext type not re-exported from barrel
**File:** `src/extensions/hooks/index.ts` line 10  
**KB:** General API design  
**Severity:** LOW  
The `HookContext` interface is defined in `built-ins.ts` and imported by `registrar.ts`, but not re-exported from `index.ts`. External consumers needing to type hook contexts must import from the internal `built-ins.ts` module rather than the public barrel.

### 7. _meta doc comment references un-namespaced keys
**File:** `src/extensions/hooks/built-ins.ts` lines 24-25  
**KB:** KB-08 `_meta` naming convention — use `_namespace/key` or `vendor.com/key`  
**Severity:** LOW  
The JSDoc comment for `_meta` still references `_validationError`, `_permissionChecked`, `_abort` — the old un-namespaced keys. The actual code correctly uses `_goodvibes/validationError`, `_goodvibes/abort`, etc. The comment is stale and misleading.

### 8. Post-hook EventBus.emit errors are fire-and-forget
**File:** `src/extensions/hooks/registrar.ts` lines 88-91, 106-108, 115-117, 124-126  
**KB:** KB-08 error isolation  
**Severity:** LOW  
Post-hook handlers call `eventBus.emit()` synchronously and return `void`. If `EventBus.emit` throws (e.g., a listener throws), the error propagates to `HookEngine.executePost` which catches it. However, the hook registrar has no visibility into these failures. This is partially mitigated by the HookEngine's try/catch but means hook-level error handling is opaque.

### 9. No hook for tool_call (initial pending state)
**File:** `src/extensions/hooks/registrar.ts`  
**KB:** KB-06 tool call lifecycle: `pending -> running -> completed|failed`  
**Severity:** LOW  
The registrar only handles `tool:execute` (pre for permission, post for update). There is no hook to emit the initial `tool_call` update (with `sessionUpdate: 'tool_call'`, `status: 'pending'`) that starts the ACP tool call lifecycle. The `tool_call_update` is emitted without a preceding `tool_call` — clients may reject an update for a tool call they never received.

### 10. HookEngine not wired into application flow
**File:** `src/main.ts` line 552 (`void hookEngine`)  
**KB:** KB-08 extensibility  
**Severity:** INFO  
The `hookEngine` is instantiated and hooks are registered, but `main.ts` line 552 shows `void hookEngine` — the engine is not called from any actual tool execution or agent spawn path. The hooks exist but are never triggered. This may be intentional (pending wiring), but means the hook system is currently inert.

---

## Summary

| # | Issue | Severity |
|---|-------|----------|
| 1 | Status 'error' vs ACP 'failed' | HIGH |
| 2 | Non-spec fields in tool_call_update | MEDIUM |
| 3 | Missing sessionUpdate discriminator | MEDIUM |
| 4 | Default permission type 'mcp' | MEDIUM |
| 5 | console.warn instead of EventBus | LOW |
| 6 | HookContext not in barrel export | LOW |
| 7 | Stale _meta doc comment | LOW |
| 8 | Post-hook emit fire-and-forget | LOW |
| 9 | No initial tool_call hook | LOW |
| 10 | HookEngine not wired in app flow | INFO |

**Overall Score: 6/10**

The hooks module has been significantly improved from previous iterations — the `_goodvibes/` namespaced `_meta` keys, `console.warn` replacing `console.error`, and explicit `HookContext` typing are all correct. However, the `tool_call_update` emission has three separate ACP compliance issues (wrong status value, non-spec fields, missing discriminator) that would cause wire-protocol failures. The permission type default and missing initial tool_call lifecycle step are additional concerns that affect ACP conformance.
