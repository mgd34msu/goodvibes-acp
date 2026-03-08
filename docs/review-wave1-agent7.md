# Wave 1 — Agent 7: Filesystem & Terminal Bridge Review

**Reviewer**: ACP Compliance Review Agent (Iteration 4)  
**Files**: `src/extensions/acp/fs-bridge.ts`, `src/extensions/acp/terminal-bridge.ts`, `src/extensions/acp/permission-gate.ts`  
**KB References**: KB-05 (Permissions), KB-06 (Tools & MCP), KB-09 (TypeScript SDK), KB-10 (Implementation Guide)

---

## Issues

### 1. [Critical] fs-bridge.ts L62 — ReadTextFileResponse field mismatch

**File**: `src/extensions/acp/fs-bridge.ts`, line 62  
**KB**: KB-09 L178-183, KB-10 L552

The ACP path returns `response.content` but the SDK `ReadTextFileResponse` type is documented as `{ text: string }` (KB-09 L182). KB-10's reference implementation also uses `result.text`. If the SDK returns `text` rather than `content`, this will silently return `undefined`.

```typescript
// Current (fs-bridge.ts:62)
return response.content;

// Expected per KB-09
return response.text;
```

**Fix**: Verify the actual SDK type at compile-time. If `ReadTextFileResponse` has `text`, change to `response.text`.

---

### 2. [Critical] fs-bridge.ts L101-105 — WriteTextFileRequest field mismatch

**File**: `src/extensions/acp/fs-bridge.ts`, lines 101-105  
**KB**: KB-09 L196-198, KB-10 L561-564

The write call sends `{ path, content, sessionId }` but the SDK `WriteTextFileRequest` type is documented as `{ sessionId, path, text }` (KB-09 L197). KB-10's reference also uses `text: content`. Sending `content` instead of `text` means the SDK receives an unrecognized field and the file content is silently dropped.

```typescript
// Current (fs-bridge.ts:101-105)
await this.conn.writeTextFile({
  path,
  content,       // Wrong field name
  sessionId: this.sessionId,
});

// Expected per KB-09/KB-10
await this.conn.writeTextFile({
  sessionId: this.sessionId,
  path,
  text: content,  // Correct field name
});
```

**Fix**: Change `content` to `text: content`.

---

### 3. [Major] terminal-bridge.ts L229 — Inconsistent null exit code handling between spawn paths

**File**: `src/extensions/acp/terminal-bridge.ts`, lines 134, 204, 229, 241  
**KB**: KB-10 L658

Exit code null-coalescing is inconsistent across the spawn fallback:

| Location | Expression | Null maps to |
|----------|-----------|-------------|
| L134 (on-exit handler) | `code ?? -1` | -1 |
| L204 (ACP waitForExit) | `exitResult.exitCode ?? -1` | -1 |
| L229 (spawn waitForExit) | `internal.exitCode ?? 0` | 0 |
| L238 (spawn already-exited) | `proc.exitCode` (no coalesce) | null passthrough |

Line 229 maps null to `0` (success) while all other paths use `-1` (error sentinel). A process killed by a signal has `exitCode === null` — reporting that as `0` hides the failure. The ISS-146 fix at L204 was applied for the ACP path but the spawn path at L229 was missed.

**Fix**: Change L229 from `internal.exitCode ?? 0` to `internal.exitCode ?? -1` for consistency.

---

### 4. [Major] terminal-bridge.ts L109-115 — Shell injection risk in spawn fallback

**File**: `src/extensions/acp/terminal-bridge.ts`, lines 109-115  
**KB**: KB-05 (Permissions), KB-10 L652-653

The spawn fallback uses `shell: true` with the raw `command` string. While documented in comments (L100-108), there is no input sanitization. If `command` originates from LLM output or user input, arbitrary shell commands can be injected via metacharacters (`;`, `&&`, `|`, `` ` ``, `$()`).

KB-10's reference code also uses `shell: true` (L653), so this matches the reference — but the reference is a minimal skeleton, not a production hardening guide. KB-05 establishes that shell commands should go through a permission gate before execution.

**Mitigation**: The permission gate (KB-05) should catch this at a higher level. However, defense-in-depth suggests either:
1. Validating/escaping `command` before passing to `spawn`, or
2. Splitting `command` into `[executable, ...args]` and using `shell: false` when possible.

---

### 5. [Major] terminal-bridge.ts L160-165, L212-216, L249-254 — Timer leak in timeout race patterns

**File**: `src/extensions/acp/terminal-bridge.ts`, lines 160-165, 212-216, 249-254  
**KB**: General correctness

All three `Promise.race` timeout patterns create a `setTimeout` timer that is never cleared when the primary promise wins the race. This leaks a timer reference per call. In a long-running agent with many terminal operations, this can accumulate.

```typescript
// Current pattern (repeated 3x)
Promise.race([
  primaryPromise,
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(...)), timeout)
  ),
])

// Correct pattern
Promise.race([
  primaryPromise.finally(() => clearTimeout(timer)),
  new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(...)), timeout);
  }),
])
```

**Fix**: Store `setTimeout` return value and `clearTimeout` it when the primary promise resolves.

---

### 6. [Major] terminal-bridge.ts — No `args` array in TerminalCreateOptions

**File**: `src/extensions/acp/terminal-bridge.ts`, line 72, line 110  
**KB**: KB-09 L213-221, KB-10 L606

The ACP `CreateTerminalRequest` supports `args?: string[]` (KB-09 L217) and KB-10's reference passes `args` separately (L611-612). However, `TerminalCreateOptions` (L0 type at `src/types/registry.ts`) appears to only expose `command` as a bare string — no `args` field. The spawn fallback at L110 passes an empty args array: `spawn(command, [], ...)`, meaning all arguments must be embedded in the command string, forcing `shell: true`.

The ACP path at L86-91 also doesn't forward any args — the `createTerminal` call only sends `command` with no `args` field.

**Fix**: Add `args?: string[]` to `TerminalCreateOptions` in L0 types. Forward it in both the ACP path (`args: opts.args`) and spawn path (`spawn(command, args, { shell: false })` when args are present).

---

### 7. [Minor] terminal-bridge.ts L179 — stdout/stderr not interleaved temporally

**File**: `src/extensions/acp/terminal-bridge.ts`, line 179  
**KB**: KB-10 L654-655 (reference uses single combined buffer)

The `output()` method concatenates all stdout chunks followed by all stderr chunks: `internal.stdout.join('') + internal.stderr.join('')`. This does not preserve temporal interleaving — stderr that appeared mid-stdout will be appended at the end.

KB-10's reference implementation (L654-655) pushes both stdout and stderr into a single `outputBuffer`, preserving temporal order.

**Fix**: Use a single combined output buffer that captures both streams in order, as shown in KB-10.

---

### 8. [Minor] terminal-bridge.ts L154-158 — Timeout not forwarded to ACP SDK currentOutput()

**File**: `src/extensions/acp/terminal-bridge.ts`, lines 154-158  
**KB**: KB-09 L563-564

Documented as ISS-073 in the code. The SDK's `currentOutput()` accepts 0 arguments, so timeout is implemented via `Promise.race` locally. This is a known SDK limitation, not a code defect, but it means the client is unaware of the agent's timeout constraint. Severity is minor since the workaround is functionally correct.

---

### 9. [Minor] fs-bridge.ts — No permission gate integration for file operations

**File**: `src/extensions/acp/fs-bridge.ts`  
**KB**: KB-05 L186-197, KB-06 L160-161

KB-05 establishes that `file_write` operations should be gated behind `session/request_permission` (L186-197). KB-06 shows the full lifecycle: pending tool_call -> permission request -> execute. The `AcpFileSystem` class performs reads and writes without any permission check.

This is likely intentional — permission gating happens at a higher layer (the HookEngine/PermissionGate integration mentioned in permission-gate.ts ISS-018). However, there's no documentation in fs-bridge.ts indicating that callers are responsible for gating.

**Fix**: Add a JSDoc comment noting that callers must gate write operations through the PermissionGate before calling `writeTextFile()`.

---

### 10. [Nitpick] fs-bridge.ts L56-61 — readTextFile passes line/limit but SDK type may not support them

**File**: `src/extensions/acp/fs-bridge.ts`, lines 56-61  
**KB**: KB-09 L178-179

The ACP path forwards `options?.line` and `options?.limit` to `conn.readTextFile()`. However, KB-09 L178-179 documents `ReadTextFileRequest` as simply `{ sessionId, path }` with no `line`/`limit` fields. These extra fields may be silently ignored by the SDK, or may cause a type error.

The direct disk fallback correctly implements line/limit slicing (L72-77), so the feature works in fallback mode. The ACP path may silently return full file content when line/limit are specified.

**Fix**: Either confirm the SDK accepts `line`/`limit` and update KB-09, or remove them from the ACP call and apply the slicing logic to the ACP response as well.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | Critical | fs-bridge.ts:62 | ReadTextFileResponse uses `content` instead of `text` |
| 2 | Critical | fs-bridge.ts:101-105 | WriteTextFileRequest uses `content` instead of `text` |
| 3 | Major | terminal-bridge.ts:229 | Null exit code maps to 0 (success) instead of -1 |
| 4 | Major | terminal-bridge.ts:109-115 | Shell injection risk with unsanitized command + shell:true |
| 5 | Major | terminal-bridge.ts | Timer leak in 3x Promise.race timeout patterns |
| 6 | Major | terminal-bridge.ts | No args array support; forces shell:true |
| 7 | Minor | terminal-bridge.ts:179 | stdout/stderr not interleaved temporally |
| 8 | Minor | terminal-bridge.ts:154-158 | Timeout not forwarded to SDK (ISS-073, known) |
| 9 | Minor | fs-bridge.ts | No permission gate documentation for callers |
| 10 | Nitpick | fs-bridge.ts:56-61 | line/limit params may not be supported by SDK |

**Critical**: 2 | **Major**: 4 | **Minor**: 3 | **Nitpick**: 1

---

## Overall Score: 5/10

Two critical field-name mismatches in fs-bridge.ts would cause silent data loss on the ACP path (reads return undefined, writes send empty content). These are likely masked during development if tests only exercise the disk fallback path. The terminal-bridge has good structure and documented ISS-tracking, but carries four major issues around exit code consistency, security, timer leaks, and missing args support. The permission-gate module is well-implemented with proper SDK/spec divergence handling.

**Note on Critical issues**: If the SDK's actual TypeScript types use `content` (not `text`) for ReadTextFileResponse/WriteTextFileRequest — contradicting KB-09's documentation — then issues #1 and #2 are false positives caused by KB-09 inaccuracy, not code defects. The score would improve to ~7/10 in that case. Recommend verifying against the actual `@agentclientprotocol/sdk` v0.15.0 type definitions.
