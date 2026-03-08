# Review: Filesystem & Terminal Bridge (Wave 1, Agent 7 — Iteration 3)

**Reviewer**: goodvibes:reviewer  
**Date**: 2026-03-07  
**Scope**: `src/extensions/acp/fs-bridge.ts`, `src/extensions/acp/terminal-bridge.ts`  
**KB References**: `docs/acp-knowledgebase/07-filesystem-terminal.md`, `docs/acp-knowledgebase/01-overview.md`  
**Spec Reference**: `https://agentclientprotocol.com/llms-full.txt`  
**Score**: 8.2 / 10

---

## Summary

Both bridge files are well-structured with clear capability gating, proper fallback paths, and good documentation. Iteration 2 fixes addressed encoding validation on the write path and stderr inclusion in terminal output. Remaining issues are moderate: an env format mismatch with the KB wire example, a timeout not forwarded to the ACP SDK, a silent exitCode default that could mask failures, shell injection risk in the spawn fallback, and minor output fidelity gaps.

---

## Issues

| # | File | Line(s) | Severity | Category | KB Reference |
|---|------|---------|----------|----------|--------------|
| 1 | `terminal-bridge.ts` | 80-82 | Major | Spec Compliance | KB-07 L223-224 |
| 2 | `terminal-bridge.ts` | 154-158 | Minor | Spec Compliance | KB-07 L276, L285 |
| 3 | `terminal-bridge.ts` | 202 | Major | Error Handling | KB-07 L333 |
| 4 | `terminal-bridge.ts` | 109-115 | Minor | Security | KB-07 L234 |
| 5 | `terminal-bridge.ts` | 179 | Minor | Correctness | KB-07 L302 |
| 6 | `terminal-bridge.ts` | 71-77 | Minor | Spec Compliance | KB-07 L244-245 |
| 7 | `terminal-bridge.ts` | 240 | Nitpick | Error Handling | — |

---

## Issue Details

### 1. [Major] `env` converted to `EnvVariable[]` array but KB-07 wire format shows plain object

**File**: `src/extensions/acp/terminal-bridge.ts:80-82`  
**KB**: KB-07 lines 222-227

The KB wire example for `terminal/create` shows `env` as a plain JSON object:
```json
"env": { "NODE_ENV": "production" }
```

But the code converts `env` to an `EnvVariable[]` array:
```typescript
const envVars: schema.EnvVariable[] | undefined = env
  ? Object.entries(env).map(([name, value]) => ({ name, value }))
  : undefined;
```

This relies on the SDK `schema.EnvVariable` type requiring array format, which may diverge from the wire-level protocol. If the SDK internally converts back to object format, this is fine. If not, the client receives an unexpected shape.

**Fix**: Verify that `conn.createTerminal()` accepts `EnvVariable[]` and the SDK handles serialization to wire format. If the SDK expects a plain object, pass `env` directly instead of converting.

---

### 2. [Minor] `timeout` not forwarded to ACP SDK `currentOutput()` call

**File**: `src/extensions/acp/terminal-bridge.ts:154-158`  
**KB**: KB-07 lines 276, 285

KB-07 shows `terminal/output` accepts an optional `timeout` parameter in the request params. The code documents this as ISS-073 and uses a local `Promise.race` workaround instead of forwarding `timeout` to the SDK.

While the workaround is functional, it means the timeout is enforced client-side rather than server-side. The ACP client may have more efficient timeout handling (e.g., not buffering output until timeout). When the SDK is updated, this should forward the timeout.

**Fix**: Track ISS-073 and update when `currentOutput()` accepts a timeout parameter. The `Promise.race` workaround is acceptable as a temporary measure.

---

### 3. [Major] `waitForExit` silently defaults `exitCode` to 0 when null

**File**: `src/extensions/acp/terminal-bridge.ts:202`  
**KB**: KB-07 line 333

```typescript
exitCode: exitResult.exitCode ?? 0,
```

KB-07 shows `waitForExit` returns `{ "exitCode": 0 }` — the exitCode should always be present in the response. Defaulting `null` to `0` masks potential failures where the ACP client returned null due to an error or signal-based termination. A process killed by signal typically has no numeric exit code, and reporting 0 (success) is misleading.

**Fix**: Use `exitResult.exitCode ?? -1` to indicate abnormal termination, or throw an error if exitCode is null since the spec guarantees it should be present in the response.

---

### 4. [Minor] `shell: true` in spawn fallback creates shell injection risk

**File**: `src/extensions/acp/terminal-bridge.ts:109-115`

The spawn fallback uses `shell: true` because `command` is a bare string. The comment at lines 100-108 documents this tradeoff explicitly, noting callers must sanitize untrusted input.

However, there is no input sanitization at the bridge layer. If any caller passes user-controlled input as `command`, shell injection is possible.

**Fix**: Consider adding basic command validation (e.g., reject commands containing `; && || | \` or backticks`) or document the security boundary more prominently. Alternatively, parse the command string into `[executable, ...args]` and use `shell: false`.

---

### 5. [Minor] Spawn fallback output concatenates stdout+stderr instead of interleaving

**File**: `src/extensions/acp/terminal-bridge.ts:179`  
**KB**: KB-07 line 302

```typescript
output: internal.stdout.join('') + internal.stderr.join(''),
```

KB-07 states the `output` field contains terminal output (which in a real terminal is interleaved stdout+stderr). The current approach appends all stderr after all stdout, which can produce confusing output where error messages appear after the full stdout rather than at the point they occurred.

The comment at lines 174-177 acknowledges this and suggests a fix (single combined buffer).

**Fix**: Push both stdout and stderr chunks into a single `output: string[]` buffer in arrival order to match real terminal behavior.

---

### 6. [Minor] Returned `TerminalHandle` does not include ACP `terminalId` for debugging

**File**: `src/extensions/acp/terminal-bridge.ts:71-77`  
**KB**: KB-07 lines 244-245

The `create()` method generates a local `id` (`term-1`, `term-2`, etc.) and returns it as the handle. The ACP `terminalId` from the client response is stored internally in `AcpBackedHandle.acpHandle` but is not accessible from the returned `TerminalHandle`.

This makes debugging harder — when inspecting a handle, there is no way to correlate it with the ACP client's terminal ID.

**Fix**: Consider adding an optional `acpTerminalId` field to `TerminalHandle` or logging the mapping at creation time.

---

### 7. [Nitpick] Exit code -1 sentinel inconsistency between `create` and `waitForExit`

**File**: `src/extensions/acp/terminal-bridge.ts:240`

In the spawn fallback `exit` handler:
```typescript
proc.once('exit', (code) => {
  internal.exitCode = code ?? -1;
```

But in `waitForExit` for the ACP path (line 202):
```typescript
exitCode: exitResult.exitCode ?? 0,
```

The spawn path uses `-1` for null exit codes (signal termination) while the ACP path uses `0`. This inconsistency means the same abnormal termination condition reports differently depending on whether the ACP path or spawn path was used.

**Fix**: Use a consistent sentinel value across both paths. `-1` is more appropriate for abnormal termination.

---

## What's Done Well

- **Capability gating**: Both bridges correctly check `clientCapabilities` before routing to ACP, with clean fallback to direct I/O (KB-07 requirement).
- **Encoding validation**: `fs-bridge.ts` validates encodings against a whitelist (line 19-21) and correctly rejects non-UTF-8 on the ACP write path (lines 96-100).
- **Resource cleanup**: `terminal-bridge.ts` `release()` properly kills running processes, clears buffers, and removes handles.
- **ISS-073 documentation**: The SDK limitation for `currentOutput()` timeout is clearly documented with a workaround and upgrade path.
- **Comment quality**: Both files have thorough JSDoc and inline comments explaining design decisions and tradeoffs.

---

## Category Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| Spec Compliance | 7/10 | env format question, timeout not forwarded, terminalId not exposed |
| Error Handling | 7/10 | exitCode 0 default masks failures, inconsistent sentinel values |
| Security | 8/10 | shell injection documented but not mitigated at bridge layer |
| Organization | 9/10 | Clean separation, clear module structure |
| Naming | 9/10 | Clear, consistent naming throughout |
| Documentation | 9/10 | Excellent comments, KB references, tradeoff documentation |
| Testing | N/A | No test files in scope |
| Performance | 9/10 | No unnecessary allocations or copies |
| SOLID/DRY | 9/10 | Clean single-responsibility, no duplication |
| Dependencies | 9/10 | Minimal imports, no circular references |

---

## Recommendations

1. **Immediate**: Fix exitCode default from `?? 0` to `?? -1` on the ACP path (Issue 3) — this can mask real failures.
2. **This PR**: Verify `EnvVariable[]` vs plain object wire format with the SDK (Issue 1).
3. **Follow-up**: Implement interleaved output buffer for spawn fallback (Issue 5).
4. **Track**: ISS-073 for SDK timeout parameter support (Issue 2).
