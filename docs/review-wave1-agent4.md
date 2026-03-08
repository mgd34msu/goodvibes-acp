# ACP Compliance Review: Permissions

**Reviewer**: Agent 4 (Permissions Specialist)
**Scope**: `src/extensions/acp/permission-gate.ts`, `src/types/permissions.ts`
**KB References**: `docs/acp-knowledgebase/05-permissions.md`, `docs/acp-knowledgebase/01-overview.md`
**ACP Spec Source**: `https://agentclientprotocol.com/llms-full.txt` (fetched 2026-03-07)
**Score**: 5.5/10 | **Issues**: 2 critical, 4 major, 3 minor

---

## Issues

### CRITICAL

#### Issue 1: requestPermission call uses SDK-specific options/toolCall shape instead of spec-defined permission object

- **File**: `src/extensions/acp/permission-gate.ts`
- **Lines**: 175-185
- **KB Topic**: KB-05, Wire Format (lines 27-41, 96-103); KB-01 line 224
- **Severity**: Critical

The ACP wire spec defines `session/request_permission` as:
```json
{ "sessionId": "...", "permission": { "type": "shell", "title": "...", "description": "..." } }
```

The implementation instead sends:
```typescript
this.conn.requestPermission({
  sessionId: this.sessionId,
  options: buildPermissionOptions(),
  toolCall: { toolCallId, title, status: 'pending', rawInput, ... },
});
```

This is not just a cosmetic difference -- the entire request structure is wrong relative to the spec. While documented as ISS-013/ISS-017 SDK divergence, the code has no feature flag or abstraction layer to switch to the spec format when the SDK aligns. The `permission` field containing `type`, `title`, and `description` (all required per KB-05 line 96-102) is entirely absent from the actual call.

**Remediation**: Add an abstraction that constructs the spec-compliant `permission` object. Either conditionally use it based on SDK version detection, or at minimum structure the code so the spec-compliant path is ready to activate.

---

#### Issue 2: isGranted() parses outcome-based response instead of spec-defined `{ granted: boolean }`

- **File**: `src/extensions/acp/permission-gate.ts`
- **Lines**: 103-109
- **KB Topic**: KB-05, Response format (lines 43-65, 274)
- **Severity**: Critical

The ACP spec response is `{ granted: boolean }`. The SDK usage in KB-05 line 296 shows:
```typescript
const { granted } = await this.conn.requestPermission({ ... });
```

The implementation instead parses `outcome.outcome === 'cancelled'` and `outcome.optionId`, which is an entirely different response model. If the SDK aligns with the wire spec in a future version, this function will break because `response.outcome` will not exist.

**Remediation**: Add a version-aware response parser that checks for `response.granted` (spec path) first, falling back to `response.outcome` (current SDK path) only when the boolean field is absent.

---

### MAJOR

#### Issue 3: PermissionOption type shape mismatches actual SDK usage

- **File**: `src/types/permissions.ts`
- **Lines**: 41-46
- **KB Topic**: KB-05, Permission object shape (lines 96-103)
- **Severity**: Major

The `PermissionOption` type defines `{ id: string; label: string }`, but `permission-gate.ts:82-83` constructs options with `{ optionId, kind, name }` using the `acp.PermissionOption` SDK type. The local type is never used in the actual permission flow -- it exists on `PermissionRequest.options` (line 81) but `PermissionGate.check()` ignores that field entirely and calls `buildPermissionOptions()` instead.

This is dead code that creates a false sense of type safety.

**Remediation**: Either align the local `PermissionOption` type with the SDK's actual shape (`optionId`, `kind`, `name`), or remove it if the intent is to always use the SDK type directly.

---

#### Issue 4: PermissionRequest.toolCall and PermissionRequest.options fields are unused

- **File**: `src/types/permissions.ts`
- **Lines**: 71-81
- **KB Topic**: KB-05, Wire format (lines 27-41)
- **Severity**: Major

`PermissionRequest.toolCall` (line 75) and `PermissionRequest.options` (line 81) are declared but never consumed by `PermissionGate.check()`. The gate constructs its own `toolCall` object from `request.title`, `request.toolCallId`, and `request._meta`, and generates options via `buildPermissionOptions()`. These unused fields add confusion about the actual data flow.

**Remediation**: Remove these fields from the type, or wire them into `PermissionGate.check()` so callers can override the default options and provide structured tool call context.

---

#### Issue 5: Random toolCallId generation breaks spec-required linkage to tool_call update

- **File**: `src/extensions/acp/permission-gate.ts`
- **Line**: 170
- **KB Topic**: KB-05, Relationship to Tool Execution (lines 186-266, 419)
- **Severity**: Major

KB-05 line 419: "toolCallId used in permission context should match the tool_call update sent before the request." The code generates a random UUID as fallback:
```typescript
const toolCallId = request.toolCallId ?? randomUUID();
```

A randomly generated `toolCallId` will not match any preceding `tool_call` update, breaking the client's ability to correlate the permission prompt with the pending tool call in its UI.

**Remediation**: Make `toolCallId` required on `PermissionRequest` (not optional with random fallback), or throw/warn when it is missing to enforce the spec linkage.

---

#### Issue 6: rawInput field in toolCall is non-spec

- **File**: `src/extensions/acp/permission-gate.ts`
- **Line**: 182
- **KB Topic**: KB-05, Permission Object Shape (lines 96-103)
- **Severity**: Major

The permission request includes `rawInput: request._meta?.rawInput ?? null` in the `toolCall` object. The ACP spec permission object shape (KB-05 lines 96-103) defines `type`, `title`, `description`, and `_meta` -- there is no `rawInput` field. This non-spec field may cause strict clients to reject the request or silently ignore it.

**Remediation**: Move `rawInput` into the `_meta` object where custom fields belong, or use the spec-defined `description` field to convey tool input details.

---

### MINOR

#### Issue 7: plan mode auto-approves file_write, contradicting ask-mode semantics

- **File**: `src/extensions/acp/permission-gate.ts`
- **Lines**: 52-56
- **KB Topic**: KB-05, Mode-Based Auto-Approval (lines 362-379)
- **Severity**: Minor

The `plan` mode is documented as mapping to ACP "ask mode" (line 34). KB-05 line 366 says ask mode means "Agent calls `session/request_permission` for every gated action; user sees every prompt." Yet plan mode auto-approves `file_write`, meaning file write operations skip the permission prompt entirely.

The code comment says "Auto-approve writes but not deletes" but this contradicts the ask-mode semantics the mode claims to implement.

**Remediation**: Either remove `file_write` from plan mode's `autoApprove` list to match ask-mode behavior, or update the mode documentation/mapping to clarify this is a deliberate deviation from strict ask-mode.

---

#### Issue 8: sessionId is optional on PermissionRequest but required on the wire

- **File**: `src/types/permissions.ts`
- **Lines**: 60-61
- **KB Topic**: KB-05, Wire Format (lines 27-41)
- **Severity**: Minor

`sessionId?: string` is optional on `PermissionRequest`, but KB-05 wire format (line 33) shows `sessionId` as a required field in the `session/request_permission` params. The `PermissionGate` class receives `sessionId` in its constructor, so this field on the request type is redundant and potentially misleading -- a caller might set it expecting it to override the gate's session, but it is never read.

**Remediation**: Remove `sessionId` from `PermissionRequest` (since the gate manages it), or document explicitly that it is ignored in favor of the gate's constructor-injected value.

---

#### Issue 9: description field not passed in the permission request to the SDK

- **File**: `src/extensions/acp/permission-gate.ts`
- **Lines**: 175-185
- **KB Topic**: KB-05, Permission Object Shape (lines 96-103)
- **Severity**: Minor

The `PermissionRequest` type includes a `description` field (types/permissions.ts:69), and the ACP spec requires `description` in the permission object (KB-05 line 100). However, `PermissionGate.check()` never passes `request.description` anywhere in the SDK call. The title is passed via `toolCall.title`, but the description -- which should contain the full detail of what will happen -- is silently dropped.

**Remediation**: Include `description` in the permission request payload, either via the SDK's current format or a future spec-aligned `permission` object.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Spec Compliance | 4/10 | Request/response shape diverges from ACP wire spec (Issues 1, 2) |
| Type Safety | 5/10 | Dead types, shape mismatch between local and SDK types (Issues 3, 4) |
| Data Integrity | 5/10 | Random toolCallId, dropped description (Issues 5, 9) |
| Extensibility | 7/10 | Non-spec fields in wrong location (Issue 6) |
| Policy Design | 7/10 | Plan mode semantics questionable (Issue 7) |
| Documentation | 8/10 | ISS comments are thorough and well-explained |

---

## Positive Observations

1. ISS-tagged divergence comments are thorough -- every SDK/spec gap is documented with issue numbers and migration notes
2. Error handling in the catch block (lines 191-198) correctly distinguishes cancellation from unexpected errors
3. The policy resolution order (auto-approve, always-deny, promptForUnknown, client prompt) is clean and well-documented
4. PermissionType union is correctly open-ended with `(string & {})` to allow custom types per spec
5. Mode policies use spec-defined permission types (file_write, file_delete, network, browser) as fixed in ISS-068

---

## Summary

The permissions module has strong internal architecture (clean policy resolution, good error handling, thorough documentation of known divergences) but significant spec compliance gaps. The core issue is that the `requestPermission` call and response parsing follow the SDK's options/outcome model rather than the ACP wire spec's `permission`/`granted` model. While these gaps are documented via ISS comments, there is no abstraction layer or feature flag to facilitate migration when the SDK aligns with the spec. Additionally, several type declarations (`PermissionOption`, `toolCall`, `options` on `PermissionRequest`) are defined but unused, creating dead code that misleads about the actual data flow.
