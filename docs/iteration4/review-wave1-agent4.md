# Wave 1 Review — Agent 4: Permissions

**Reviewer**: ACP Compliance Review Agent  
**Files**: `src/extensions/acp/permission-gate.ts`, `src/extensions/acp/config-adapter.ts`, `src/types/permissions.ts`  
**KB References**: `05-permissions.md`, `03-sessions.md`, `10-implementation-guide.md`  
**Date**: 2026-03-08

---

## Issues

### 1. `description` field lost in SDK permission request construction
**File**: `src/extensions/acp/permission-gate.ts` lines 139–149  
**KB**: KB-05 line 100 — `description: string` is **Required** on the Permission object  
**Severity**: High

`buildPermissionRequest()` constructs the SDK `toolCall` object with `title`, `status`, and `rawInput`, but never passes `request.description`. The ACP wire spec requires `description` as a mandatory field on the permission object (KB-05 lines 96–103). Even under the SDK's options-based model, description context is lost — the client has no way to show the user what action is being gated.

**Fix**: Add `description: request.description` to the `toolCall` object, or if the SDK doesn't support it there, include it in `_meta`.

---

### 2. `isGranted()` receives full response object but casts as `RequestPermissionOutcome`
**File**: `src/extensions/acp/permission-gate.ts` lines 104–117, 230  
**KB**: KB-10 lines 1029–1034 (mock client shows `{ outcome: { outcome: 'selected', optionId } }`)  
**Severity**: High

Line 230 passes `response` (the full `RequestPermissionResponse`) to `isGranted()`. Inside `isGranted()`, line 110 casts this as `RequestPermissionOutcome`. But the SDK response shape is `{ outcome: RequestPermissionOutcome }` — meaning `response.outcome` is the `RequestPermissionOutcome`, not `response` itself. The function checks `outcome.outcome` at line 112, which would actually be `response.outcome` (the nested object), not `response.outcome.outcome`.

This works **only if** the SDK returns the outcome directly (not wrapped). If the SDK follows the KB-10 mock pattern (`{ outcome: { outcome, optionId } }`), `isGranted(response)` would fail to find `outcome.outcome === 'cancelled'` because `response.outcome` is the inner object and `response.outcome.outcome` is the string. The cast at line 110 papers over this.

**Fix**: Either pass `response.outcome` to `isGranted()`, or update `isGranted()` to unwrap the response first: `const outcome = (response as any)?.outcome ?? response`.

---

### 3. Sandbox mode auto-approves `file_write` — inconsistent with restrictive intent
**File**: `src/extensions/acp/permission-gate.ts` line 61  
**KB**: KB-05 lines 366–368 — mode semantics  
**Severity**: Low

The sandbox policy auto-approves `file_write` alongside `mcp`, while denying `extension`, `network`, and `browser`. The comment (line 35) describes sandbox as "isolated, unrestricted experimentation" but KB-05's mode taxonomy doesn't define a sandbox mode. Auto-approving writes in a mode named "sandbox" could surprise users expecting containment. This is an implementation choice, not a spec violation, but the semantics are potentially misleading.

**Fix**: Consider whether sandbox should prompt for `file_write` or document the rationale more explicitly.

---

### 4. Permission types `mcp` and `extension` not namespaced as custom types
**File**: `src/types/permissions.ts` lines 29–30  
**KB**: KB-05 lines 81–92, line 171 (custom type example uses `_goodvibes/spawn_agent`)  
**Severity**: Medium

KB-05's custom permission type example uses the `_goodvibes/` prefix namespace (line 171). The implementation uses bare `mcp` and `extension` as permission types without namespacing. These could collide with future ACP spec-defined types. The spec says the type field is an open string, but the convention shown in KB-05 suggests namespacing custom types.

**Fix**: Consider renaming to `_goodvibes/mcp` and `_goodvibes/extension` for forward compatibility.

---

### 5. Config adapter mode names diverge from ACP convention
**File**: `src/extensions/acp/config-adapter.ts` lines 60–81  
**KB**: KB-03 lines 298–304 (modes: `ask`, `code`); KB-05 lines 366–368 (ask/code/yolo)  
**Severity**: Medium

The ACP KB examples consistently use `ask`/`code` as mode values (KB-03 line 302). The implementation uses `justvibes`/`vibecoding`/`sandbox`/`plan`. While the spec allows arbitrary config option values, ACP clients that recognize the standard `ask`/`code` mode values for permission UI hints would not understand the GoodVibes-specific names. This reduces interoperability with generic ACP clients.

**Fix**: Either map GoodVibes modes to ACP-standard equivalents in the config options, or document the mapping so clients can adapt.

---

### 6. `plan` mode denies `shell` but spec says ask-mode should prompt, not deny
**File**: `src/extensions/acp/permission-gate.ts` lines 55–58  
**KB**: KB-05 line 366 — "ask mode: Agent calls session/request_permission for every gated action; user sees every prompt"  
**Severity**: Medium

The `plan` policy sets `alwaysDeny: ['shell', 'file_delete']`. KB-05's ask mode definition says the agent should call `request_permission` for every gated action — meaning the user should see the prompt and have the option to approve. Always-deny removes user agency for these types. If `plan` maps to ACP ask-mode, then shell and file_delete should be prompted, not auto-denied.

**Fix**: Move `shell` and `file_delete` out of `alwaysDeny` and rely on `promptForUnknown: true` to gate them via the client.

---

### 7. `PermissionRequest.sessionId` field is documented as ignored but still present
**File**: `src/types/permissions.ts` lines 72–77  
**KB**: KB-05 lines 32–33 — `sessionId` is a required wire parameter  
**Severity**: Low

The `PermissionRequest` type includes `sessionId?: string` with a comment saying it's ignored at runtime (PermissionGate uses its constructor-injected sessionId). Having an optional field that's documented as ignored creates confusion. Callers might set it expecting it to be used. Since the PermissionGate owns the session context, this field should either be removed or made truly required and read.

**Fix**: Remove `sessionId` from `PermissionRequest` since it's never read, or document it as deprecated.

---

### 8. No concurrent permission request serialization
**File**: `src/extensions/acp/permission-gate.ts` (entire class)  
**KB**: KB-05 line 418 — "Multiple concurrent permission requests are not addressed in spec; in practice serialize them per session"  
**Severity**: Low

The `PermissionGate.check()` method has no serialization mechanism. If two tool calls trigger permission checks concurrently within the same session, both requests would be sent to the client simultaneously. KB-05 recommends serializing permission requests per session.

**Fix**: Add a per-session mutex/queue so `check()` calls are serialized.

---

### 9. Error handling treats all non-AbortError failures as "Permission request failed"
**File**: `src/extensions/acp/permission-gate.ts` lines 235–243  
**KB**: KB-05 lines 67–77 — client can return JSON-RPC error with code/message  
**Severity**: Low

The catch block at line 238 only distinguishes AbortError (cancelled) from everything else (generic "Permission request failed"). KB-05 shows the client can return structured errors (`{ code: -32603, message: "Internal error" }`). The current implementation discards the error details. While not a spec violation, propagating the error code/message in the `reason` field would improve debuggability.

**Fix**: Extract error message from the caught error and include it in the `reason` string.

---

### 10. `buildPermissionOptions` hardcodes only `allow_once`/`reject_once` — no `allow_always`/`reject_always`
**File**: `src/extensions/acp/permission-gate.ts` lines 82–87  
**KB**: KB-10 line 1031 — mock client references `kind !== 'deny'` covering broader option kinds  
**Severity**: Low

The `PermissionOptionKind` type in `src/types/permissions.ts` (line 41) defines four kinds: `allow_once`, `allow_always`, `reject_once`, `reject_always`. However, `buildPermissionOptions()` only offers `allow_once` and `reject_once`. This prevents users from choosing persistent permission grants ("always allow" / "always deny"), which is a common UX pattern in permission systems. The SDK supports it — the implementation artificially limits the options.

**Fix**: Add `allow_always` and `reject_always` options, or accept custom options from the caller.

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | `description` field lost in permission request | High | Open |
| 2 | `isGranted()` response unwrapping incorrect | High | Open |
| 3 | Sandbox auto-approves `file_write` | Low | Open |
| 4 | Custom permission types not namespaced | Medium | Open |
| 5 | Mode names diverge from ACP convention | Medium | Open |
| 6 | Plan mode auto-denies instead of prompting | Medium | Open |
| 7 | Ignored `sessionId` field on PermissionRequest | Low | Open |
| 8 | No concurrent permission request serialization | Low | Open |
| 9 | Error details discarded in catch block | Low | Open |
| 10 | Only once-options offered, no always-options | Low | Open |

**High**: 2 | **Medium**: 3 | **Low**: 5

## Overall Score: 6.5 / 10

The permission system has solid architectural foundations — the policy-based gate pattern, mode mapping, and SDK divergence documentation are well done. The two high-severity issues (missing `description` field and potentially incorrect response unwrapping) are functional correctness problems that could cause client UI failures. The medium issues around naming conventions and ask-mode semantics represent interoperability risks with standard ACP clients. The low-severity items are quality improvements that don't block functionality but would improve robustness.
