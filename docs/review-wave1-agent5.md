# ACP Compliance Review: Hooks

**Reviewer**: Agent 5 (Hooks Specialist)  
**Iteration**: 3  
**Scope**: `src/extensions/hooks/built-ins.ts`, `src/extensions/hooks/index.ts`, `src/extensions/hooks/registrar.ts`, `src/core/hook-engine.ts`  
**KB References**: KB-01 (Overview), KB-08 (Extensibility), KB-04 (Prompt Turn), KB-05 (Permissions), KB-06 (Tools/MCP)  
**ACP Spec**: https://agentclientprotocol.com/llms-full.txt (fetched)

---

## Summary

The hooks subsystem is well-structured with clear separation between the generic L1 HookEngine and the L2 GoodVibes-specific registrar. Error isolation in the engine is solid. However, there are several ACP compliance gaps in the tool_call_update emission, status enum mismatches with the spec, and missing namespace prefixing on internal metadata keys.

**Score: 6.8/10** | **Issues: 1 critical, 4 major, 4 minor, 1 nitpick**

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 4 files found on disk |
| Exports used | PASS | HookRegistrar imported in main.ts; HookEngine imported in registrar.ts and main.ts |
| Import chain valid | PASS | All modules traced to main.ts entry point |
| No placeholders | PASS | Previous TODO placeholders resolved in Iteration 2 |
| Integration verified | PASS | registerBuiltins() called during startup in main.ts |

---

## Critical Issues

### 1. tool_call_update uses wrong status enum value

**File:** `src/extensions/hooks/registrar.ts:195`  
**KB:** KB-04 (Prompt Turn), KB-06 (Tools/MCP)  
**Severity:** Critical (ACP Compliance)

The post-hook emits `status: 'failed'` for permission-denied tool calls. However, ACP KB-04 defines `ToolCallStatus` as:

```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

`'failed'` is not a valid ACP status. The correct value for a permission-denied tool call is `'error'` (or arguably `'cancelled'`). Note: KB-06 defines a slightly different enum (`'pending' | 'running' | 'completed' | 'failed'`), creating an internal KB inconsistency. The canonical ACP spec uses `'error'`, not `'failed'`.

**Current:**
```typescript
status: failed ? 'failed' : 'completed',
```

**Required:**
```typescript
status: failed ? 'error' : 'completed',
```

---

## Major Issues

### 2. tool_call_update event payload does not match ACP ToolCallStatusUpdate schema

**File:** `src/extensions/hooks/registrar.ts:192-198`  
**KB:** KB-04, KB-06  
**Severity:** Major (Schema Mismatch)

The emitted event uses `output` as a raw field, but ACP's `ToolCallStatusUpdate` specifies `content?: ContentBlock[]` (an array of content blocks). The event also omits `sessionUpdate: 'tool_call_update'` which is the discriminator field. When this event is eventually mapped to a `session/update` notification, the shape will be wrong.

**Current:**
```typescript
bus.emit('tool:call:update', {
  toolCallId,
  toolName,
  status: failed ? 'failed' : 'completed',
  output: result ?? null,
  reason: failed ? (meta._permissionReason as string | undefined) : undefined,
});
```

**Required fields per ACP:**
- `sessionUpdate: 'tool_call_update'` (discriminator)
- `toolCallId: string`
- `status?: ToolCallStatus`
- `content?: ContentBlock[]` (not raw `output`)
- Missing: `sessionId` (required in enclosing `session/update` params)

### 3. Internal _meta keys lack namespace prefixing

**File:** `src/extensions/hooks/registrar.ts:70-77, 155-161, 173-175`  
**KB:** KB-08 (Extensibility)  
**Severity:** Major (Convention Violation)

KB-08 states that within `_meta`, implementations should use namespaced keys: `"vendor.com/key"` or `"_namespace/key"`. The code uses unprefixed keys:

- `_validationError` (line 75)
- `_abort` (line 76)
- `_permissionDenied` (line 158)
- `_permissionReason` (line 159)
- `_permissionChecked` (line 165, 175)
- `_permissionGateMissing` (line 175)

These should be prefixed with `_goodvibes/` to avoid collisions, e.g., `_goodvibes/validationError`, `_goodvibes/abort`.

### 4. HookEngine lacks abort/short-circuit mechanism for pre-hooks

**File:** `src/core/hook-engine.ts:167-184`  
**KB:** KB-08  
**Severity:** Major (Design Gap)

The registrar documents (lines 60-62) that callers should check `_meta._abort === true` after execution. However, `HookEngine.execute()` has no mechanism to short-circuit the pre-hook chain when abort is signaled. If a validation pre-hook sets `_abort: true` at priority 50, all subsequent pre-hooks at lower priority still execute. This means:

1. A pre-hook that aborts has no way to prevent later pre-hooks from running
2. Side effects from later pre-hooks may occur on an already-aborted context

The engine should check for an abort signal between hook executions, or provide a convention for pre-hooks to signal chain termination.

### 5. Post-hook fires indiscriminately after permission denial

**File:** `src/extensions/hooks/registrar.ts:184-201`  
**KB:** KB-05 (Permissions)  
**Severity:** Major (Logic)

The `tool:execute` post-hook always fires, even when the pre-hook denied permission. Per KB-05: "If `granted: false`, the agent MUST NOT execute the action." If the tool was never executed (permission denied), the post-hook should either not fire or clearly distinguish between "tool completed after execution" and "tool blocked before execution." Currently, the post-hook checks `meta._permissionDenied` to set status, but it still emits a `tool:call:update` event with `output: result`, where `result` would be undefined/the pre-hook context rather than an actual tool result.

---

## Minor Issues

### 6. console.error used for warning-level message

**File:** `src/extensions/hooks/built-ins.ts:50`  
**KB:** KB-08 (log for debugging)  
**Severity:** Minor (Logging)

Missing permission context is a warning, not an error. Using `console.error` for an advisory message inflates error-level noise.

**Current:**
```typescript
console.error('[Hooks] Warning: Agent spawned without permission context');
```

**Required:**
```typescript
console.warn('[Hooks] Agent spawned without permission context');
```

### 7. Permission type silently defaults to 'mcp'

**File:** `src/extensions/hooks/registrar.ts:142`  
**KB:** KB-05  
**Severity:** Minor (Silent Default)

The fallback `type: (context.permissionType as string | undefined) ?? 'mcp'` silently defaults every tool execution permission request to type `'mcp'`. ACP defines multiple permission types (`'shell'`, `'mcp'`, `'file'`). A missing `permissionType` on the context is likely a caller bug that should be logged, not silently defaulted.

### 8. HookContext index signature enables root-level custom field leakage

**File:** `src/extensions/hooks/built-ins.ts:28`  
**KB:** KB-08  
**Severity:** Minor (Type Safety)

The `[key: string]: unknown` index signature on `HookContext` allows any key at the root level. While this is internal (not protocol wire format), it creates a pattern where developers can attach arbitrary root-level fields that may later leak into protocol types during serialization. KB-08 explicitly states: "Implementations MUST NOT add custom fields at the root of protocol-spec types."

Consider using a stricter type with explicit optional fields and forcing all dynamic data through `_meta`.

### 9. Missing error detail in tool_call_update for permission denial

**File:** `src/extensions/hooks/registrar.ts:192-198`  
**KB:** KB-05  
**Severity:** Minor (Observability)

When permission is denied, the emitted event includes `reason` as a top-level field. ACP's `ToolCallStatusUpdate` does not have a `reason` field — error details should go in `content` as a text content block, or in `_meta`. The current shape will be silently dropped by any ACP-compliant consumer.

---

## Nitpicks

### 10. Barrel export uses wildcard re-export

**File:** `src/extensions/hooks/index.ts:10`  
**Severity:** Nitpick (Maintainability)

`export * from './built-ins.js'` re-exports everything including internal types. A named export list would make the public API explicit and prevent accidental exposure of internals.

---

## Category Breakdown

| Category | Score | Deductions | Key Issues |
|----------|-------|------------|------------|
| Security | 8/10 | -2.0 | Permission type silent default |
| Error Handling | 7/10 | -3.0 | No abort short-circuit, post-hook fires after denial |
| Testing | N/A | — | Not in scope |
| Organization | 9/10 | -1.0 | Clean L1/L2 separation |
| Performance | 9/10 | -1.0 | No short-circuit wastes cycles on aborted chains |
| SOLID/DRY | 8/10 | -2.0 | Post-hook conflates blocked vs completed |
| Naming | 7/10 | -3.0 | Unprefixed _meta keys, wrong status enum |
| Maintainability | 8/10 | -2.0 | Index signature too permissive |
| Documentation | 9/10 | -1.0 | Good JSDoc, clear comments |
| Dependencies | 10/10 | 0 | Clean import chain |

---

## Recommendations

1. **Immediate (blocks ACP compliance):** Fix `'failed'` to `'error'` in tool_call_update status, and align event payload to ACP `ToolCallStatusUpdate` schema.
2. **This iteration:** Add `_goodvibes/` namespace prefix to all internal `_meta` keys.
3. **This iteration:** Add abort short-circuit to `HookEngine.execute()` — check for `_meta._abort` (or `_meta['_goodvibes/abort']`) between pre-hook executions.
4. **Follow-up:** Conditionally skip post-hook emission when tool was never executed due to permission denial.
5. **Follow-up:** Tighten `HookContext` type to discourage root-level custom fields.
