# ACP Compliance Review — Wave 2, Agent 9
## Topic: Session Management Internals

**Files Reviewed:**
- `src/extensions/memory/manager.ts`
- `src/extensions/logs/manager.ts`
- `src/extensions/directives/queue.ts`
- `src/extensions/directives/index.ts`

**KB References:** `03-sessions.md`, `08-extensibility.md`

---

## Issues

### 1. [MEDIUM] LogsManager.prependEntry — TOCTOU race on file writes
**File:** `src/extensions/logs/manager.ts`, lines 81-117
**KB Topic:** Session data integrity, concurrent access

The `prependEntry` helper reads the file, then writes the modified content. If two concurrent log writes target the same file (e.g., two agents logging activity simultaneously), the second write will silently overwrite the first entry. No file lock, atomic rename, or append-only strategy is used.

**Recommendation:** Use an in-process write queue per file path, or switch to append-only writes (newest entries at end) to eliminate the read-modify-write pattern.

---

### 2. [MEDIUM] LogsManager.ensureFiles called on every write
**File:** `src/extensions/logs/manager.ts`, lines 158-180
**KB Topic:** Performance, session lifecycle

Every call to `logActivity()`, `logDecision()`, and `logError()` invokes `ensureFiles()`, which performs `mkdir` + three `readFile` existence checks. This is redundant after the first call and adds unnecessary filesystem overhead on every log write.

**Recommendation:** Track initialization state with a boolean flag or `Promise` and skip `ensureFiles()` after the first successful call.

---

### 3. [MEDIUM] LogsManager — no sessionId on log entries
**File:** `src/extensions/logs/manager.ts`, lines 22-59
**KB Topic:** `03-sessions.md` — session isolation, session ID required on all session-scoped operations

ACP sessions are identified by `sessionId` (KB 03-sessions, line 164-171). The `ActivityEntry`, `DecisionEntry`, and `ErrorEntry` types lack a `sessionId` field. In a multi-session runtime, log entries cannot be attributed to specific sessions, making debugging and audit impossible.

**Recommendation:** Add `sessionId: string` to all entry types and include it in formatted output.

---

### 4. [LOW] MemoryManager.save() — no validation before write
**File:** `src/extensions/memory/manager.ts`, lines 195-202
**KB Topic:** Data integrity, persistence

`save()` writes the in-memory store directly to disk without validating the data structure. A corrupted in-memory state (e.g., `decisions` set to `null` by a buggy caller) would persist a broken file, making future `load()` calls fail.

**Recommendation:** Validate the store shape (arrays exist, schema version present) before serializing.

---

### 5. [LOW] MemoryManager.load() — JSON.parse error lacks file path context
**File:** `src/extensions/memory/manager.ts`, lines 152-186
**KB Topic:** Error handling, observability

When `JSON.parse` throws (malformed JSON), the raw SyntaxError propagates without the file path. In a runtime managing multiple memory stores, the operator cannot determine which file is corrupted.

**Recommendation:** Catch `SyntaxError` separately and wrap it with the file path:
```typescript
catch (err) {
  if (err instanceof SyntaxError) {
    throw new Error(`Failed to parse ${filePath}: ${err.message}`);
  }
  // ... existing ENOENT handling
}
```

---

### 6. [MEDIUM] DirectiveQueue.clear() does not flush _pending buffer
**File:** `src/extensions/directives/queue.ts`, lines 207-210
**KB Topic:** Session lifecycle, directive cleanup

`clear()` empties the main `_queue` but does not clear the `_pending` buffer. If `clear()` is called during an active `process()` cycle, buffered directives in `_pending` will be re-enqueued on the next loop iteration of `process()`, violating the caller's intent to clear all directives.

**Recommendation:** Also clear `this._pending = []` inside `clear()`.

---

### 7. [LOW] DirectiveQueue — no max queue size or backpressure
**File:** `src/extensions/directives/queue.ts`, lines 112-121
**KB Topic:** Resource management, session stability

The queue accepts unlimited directives with no upper bound. A misbehaving directive source (or a stuck handler in `process()`) could cause unbounded memory growth. ACP sessions should be resilient to resource exhaustion.

**Recommendation:** Accept an optional `maxSize` in the constructor; reject or drop-oldest when exceeded.

---

### 8. [LOW] MemoryManager — unbounded array growth in persistent store
**File:** `src/extensions/memory/manager.ts`, lines 212-298
**KB Topic:** Resource management, persistence

All `add*` methods push to arrays without any size limit or eviction policy. Over long-running deployments, the `memory.json` file will grow without bound. The `save()` call will eventually become slow or fail due to file size.

**Recommendation:** Implement a configurable max-records-per-category with FIFO eviction, or archive old records to separate files.

---

### 9. [LOW] LogsManager — no machine-parseable log format
**File:** `src/extensions/logs/manager.ts`, lines 186-265
**KB Topic:** `08-extensibility.md` — interoperability, observability

Logs are written exclusively as Markdown. While human-readable, there is no structured format (JSON, NDJSON) that external tools, dashboards, or the `_goodvibes/analytics` extension method could consume programmatically. The `_meta` extensibility pattern from KB 08 suggests structured data is expected for tool interop.

**Recommendation:** Emit a parallel NDJSON log stream (or at minimum, emit structured event payloads via EventBus that consumers can serialize).

---

### 10. [LOW] MemoryManager — session-scoped store not included in save/load
**File:** `src/extensions/memory/manager.ts`, lines 362-406
**KB Topic:** `03-sessions.md` — session persistence and resumption

The session-scoped key-value store (`_sessionStore`) is explicitly documented as in-memory only. However, KB 03-sessions describes `session/load` for resuming sessions. If a session is resumed after a runtime restart, all session-scoped memory is lost with no mechanism to restore it. The `clearSession` handler on `session:destroyed` is correct for cleanup, but there is no corresponding persistence path for `session/load` resumption.

**Recommendation:** Either document this as intentional (ephemeral session state) or provide an opt-in persistence mechanism for session-scoped data that should survive restarts.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | MEDIUM | logs/manager.ts | prependEntry TOCTOU race |
| 2 | MEDIUM | logs/manager.ts | ensureFiles on every write |
| 3 | MEDIUM | logs/manager.ts | No sessionId on log entries |
| 4 | LOW | memory/manager.ts | save() without validation |
| 5 | LOW | memory/manager.ts | JSON.parse error lacks file path |
| 6 | MEDIUM | directives/queue.ts | clear() skips _pending buffer |
| 7 | LOW | directives/queue.ts | No max queue size |
| 8 | LOW | memory/manager.ts | Unbounded array growth |
| 9 | LOW | logs/manager.ts | No machine-parseable format |
| 10 | LOW | memory/manager.ts | Session store not persisted for session/load |

**MEDIUM issues:** 4
**LOW issues:** 6

## Overall Score: 7/10

The session management internals are functionally correct and well-structured with clean layer separation. The `DirectiveQueue` now properly supports `sessionId` filtering (addressing a prior review finding). The `MemoryManager` has good migration support and session cleanup via EventBus. However, several concurrency and robustness gaps remain: the TOCTOU race in log writes is the most operationally concerning, the missing `_pending` flush in `clear()` is a correctness bug, and the lack of `sessionId` on log entries undermines multi-session observability required by the ACP session model.
