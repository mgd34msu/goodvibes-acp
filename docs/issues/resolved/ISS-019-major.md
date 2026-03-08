# ISS-019 — HookContext Lacks _meta Field — Custom Fields Added at Root

**Severity**: Major
**File**: src/extensions/hooks/built-ins.ts:18-23 (+ registrar.ts:59,117)
**KB Topic**: Extensibility — _meta field (08-extensibility.md lines 14-27, 348)

## Original Issue
`HookContext` has no `_meta` field. Internal metadata like `_validationError` and `_permissionChecked` are added as root-level fields on context objects rather than under `_meta`. KB-08: "Every type in the ACP protocol includes an optional `_meta` field." Implementations MUST NOT add custom fields at the root of protocol-defined types.

## Verification

### Source Code Check
At `built-ins.ts:18-23`:
```typescript
export interface HookContext {
  event: string;
  timestamp: number;
  sessionId?: string;
  [key: string]: unknown;
}
```
The interface has no `_meta` field. The index signature `[key: string]: unknown` allows arbitrary root-level properties like `_validationError` and `_permissionChecked` to be added directly.

### ACP Spec Check
KB-08 (extensibility.md line 348) states:
> "Implementations MUST NOT add custom fields at the root of protocol-defined types. Only add data inside `_meta`."

KB-08 also includes an example showing the correct pattern:
```json
// WRONG — custom field at root of params
{ "method": "session/prompt", "params": { "sessionId": "...", ... } }
```

However, this constraint applies specifically to **protocol-defined types** — types that appear on the ACP wire (JSON-RPC params/results). `HookContext` is an internal type used within the hook engine, not a protocol-defined type transmitted over the wire.

### Verdict: PARTIAL
The ACP `_meta` constraint applies to protocol-defined wire types, not internal implementation types. `HookContext` is never serialized to ACP wire format — it is purely internal to the hook engine. While adding a `_meta` field would be good practice for consistency and would make it easier to forward internal context to ACP wire messages, calling this a direct ACP compliance violation overstates the issue. The real concern is that when these internal fields need to be surfaced in ACP messages, the lack of `_meta` structure makes it harder to do so correctly.

## Remediation
1. Add an optional `_meta?: Record<string, unknown>` field to `HookContext`
2. Move `_validationError`, `_permissionChecked`, and any other custom fields under `_meta`
3. Update `registrar.ts` at lines 59 and 117 to write to `context._meta` instead of root-level fields
4. This is a good-practice improvement rather than a strict ACP compliance fix, since `HookContext` is internal
