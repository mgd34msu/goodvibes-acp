# Review Wave 2 — Agent 9: Session Management Internals

**Scope**: Memory manager, logs manager, directives queue  
**Files reviewed**: `src/extensions/memory/manager.ts`, `src/extensions/memory/index.ts`, `src/extensions/logs/manager.ts`, `src/extensions/logs/index.ts`, `src/extensions/directives/queue.ts`, `src/extensions/directives/index.ts`, `src/types/directive.ts`  
**KB files**: `docs/acp-knowledgebase/03-sessions.md`, `docs/acp-knowledgebase/04-prompt-turn.md`  
**ACP spec**: https://agentclientprotocol.com/llms-full.txt (fetched 2026-03-07)  
**Iteration**: 3  
**Score**: 8.2 / 10

---

## Issues

### 1. Directives have no `sessionId` field — cannot be scoped to ACP sessions

| Field | Value |
|-------|-------|
| **File** | `src/types/directive.ts` |
| **Line** | 29-46 |
| **KB topic** | 03-sessions.md: Session ID — "The sessionId returned by session/new is used in: session/prompt, session/cancel, session/load, session/update" |
| **ACP spec** | All session-scoped operations require a `sessionId`. The `Directive` type has `workId` and `target` but no `sessionId`, making it impossible to cancel or isolate directives per ACP session. |
| **Severity** | Major |

**Fix**: Add `sessionId: string` to the `Directive` type and use it in `DirectiveQueue.drain()` filtering.

---

### 2. DirectiveQueue has no session isolation — all sessions share one queue

| Field | Value |
|-------|-------|
| **File** | `src/extensions/directives/queue.ts` |
| **Line** | 85-96 |
| **KB topic** | 03-sessions.md: "Multiple independent sessions can coexist with the same Agent" |
| **ACP spec** | Sessions are independent conversation contexts. A single shared `DirectiveQueue` with no session partitioning means `session/cancel` on one session could inadvertently affect directives from another session if drained without filtering. |
| **Severity** | Major |

**Fix**: Either maintain per-session queues or require `sessionId` in `DirectiveFilter` and enforce session isolation in `process()`.

---

### 3. DirectiveQueue.process() silently drops reentrancy without notification

| Field | Value |
|-------|-------|
| **File** | `src/extensions/directives/queue.ts` |
| **Line** | 227 |
| **KB topic** | 04-prompt-turn.md: Cancellation — "Agent MUST respond to the original session/prompt request" |
| **ACP spec** | When `session/cancel` triggers directive processing and `process()` is already running, it silently returns `[]`. The caller receives no indication that directives were not processed, which could cause the Agent to fail to respond to a cancelled `session/prompt` as required by the spec. |
| **Severity** | Minor |

**Fix**: Either throw an error, emit an event (`directive:reentrancy-blocked`), or return a result indicating the reentrancy guard fired.

---

### 4. Logs manager has no session scoping — entries cannot be attributed to ACP sessions

| Field | Value |
|-------|-------|
| **File** | `src/extensions/logs/manager.ts` |
| **Line** | 22-59 |
| **KB topic** | 03-sessions.md: "Each session maintains its own context, conversation history, and state" |
| **ACP spec** | ACP sessions are independent contexts. `ActivityEntry`, `DecisionEntry`, and `ErrorEntry` have no `sessionId` field, making it impossible to trace log entries back to the session that produced them. For a multi-session Agent, logs become an undifferentiated stream. |
| **Severity** | Minor |

**Fix**: Add optional `sessionId?: string` field to all entry types so logs can be filtered or attributed per session.

---

### 5. LogsManager.ensureFiles() called on every log write — redundant I/O

| Field | Value |
|-------|-------|
| **File** | `src/extensions/logs/manager.ts` |
| **Line** | 158-180 |
| **KB topic** | 04-prompt-turn.md: Agent processing lifecycle — tool calls may produce many log entries per turn |
| **ACP spec** | During a prompt turn, multiple tool calls and LLM round-trips may occur. Each `logActivity()`, `logDecision()`, and `logError()` call invokes `ensureFiles()` which does 3 `readFile` checks plus potential `mkdir`. In a busy turn this is wasteful I/O on every single log write. |
| **Severity** | Minor |

**Fix**: Track initialization state with a boolean flag; call `ensureFiles()` once, then skip on subsequent calls.

---

### 6. LogsManager.prependEntry() has a TOCTOU race on concurrent writes

| Field | Value |
|-------|-------|
| **File** | `src/extensions/logs/manager.ts` |
| **Line** | 81-117 |
| **KB topic** | 04-prompt-turn.md: "Multiple tool calls and LLM round-trips may occur within a single turn" |
| **ACP spec** | The `prependEntry` function reads the file, then writes the file in two separate operations with no locking. If two log entries are written concurrently (e.g., parallel tool calls in a turn), one write will overwrite the other. |
| **Severity** | Minor |

**Fix**: Use a write queue or mutex to serialise file writes, or use `appendFile` instead of read-then-write.

---

### 7. MemoryManager.load() throws opaque error on malformed JSON

| Field | Value |
|-------|-------|
| **File** | `src/extensions/memory/manager.ts` |
| **Line** | 153-154 |
| **KB topic** | 03-sessions.md: Session persistence and resumption |
| **ACP spec** | When `memory.json` contains invalid JSON, `JSON.parse` throws a generic `SyntaxError`. The catch block only handles `ENOENT`; all other errors (including parse errors) propagate with no additional context about which file failed or what went wrong, making debugging difficult for session resumption failures. |
| **Severity** | Minor |

**Fix**: Catch `SyntaxError` separately, wrap it with the file path and a descriptive message, then re-throw or reset to empty store with a warning event.

---

### 8. Directives barrel export omits types needed by consumers

| Field | Value |
|-------|-------|
| **File** | `src/extensions/directives/index.ts` |
| **Line** | 6 |
| **KB topic** | 03-sessions.md: session/cancel — Agents must handle cancellation |
| **ACP spec** | The barrel file only exports `DirectiveQueue`. Consumers (e.g., `src/extensions/wrfc/handlers.ts`) must import `Directive`, `DirectiveFilter`, and `DirectiveResult` directly from `../../types/directive.js` instead of through the extension barrel. This breaks the layer abstraction since L2 consumers should use the L2 barrel. |
| **Severity** | Nitpick |

**Fix**: Add `export type { Directive, DirectiveFilter, DirectiveResult, DirectivePriority } from '../../types/directive.js';` to the barrel.

---

### 9. MemoryManager session cleanup not wired to session/cancel

| Field | Value |
|-------|-------|
| **File** | `src/extensions/memory/manager.ts` |
| **Line** | 118-126 |
| **KB topic** | 04-prompt-turn.md: Cancellation — "Agent SHOULD stop all language model requests and all tool call invocations as soon as possible" |
| **ACP spec** | `clearSession()` is wired to `session:destroyed` but not to `session/cancel`. Per ACP, cancellation should abort operations. If a cancelled session still has pending session-scoped memory writes (via `setForSession`), those writes persist until `session:destroyed`, potentially causing stale data to be visible between cancel and destroy. |
| **Severity** | Nitpick |

**Fix**: Evaluate whether `session/cancel` should also trigger `clearSession()`, or document that session-scoped data intentionally survives cancellation.

---

### 10. MemoryManager.save() does not validate store integrity before writing

| Field | Value |
|-------|-------|
| **File** | `src/extensions/memory/manager.ts` |
| **Line** | 195-202 |
| **KB topic** | 03-sessions.md: Session persistence and resumption |
| **ACP spec** | `save()` writes whatever is in `_store` to disk without validating that the arrays contain well-formed records. If a bug corrupts `_store` (e.g., pushing `undefined` into `decisions`), the corrupted state is persisted and will cause `load()` to fail on the next session, breaking session resumption. |
| **Severity** | Nitpick |

**Fix**: Add a lightweight validation step before serialization (e.g., check each array contains objects with required `id` fields) or use a schema validator.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 2 |
| Minor | 5 |
| Nitpick | 3 |
| **Total** | **10** |

The code is well-structured with clean separation of concerns, proper event bus integration, and good TypeScript typing. The two major issues both relate to the same root cause: the directive and logging subsystems were designed as singleton/global constructs but ACP requires per-session isolation. The memory manager handles this correctly with its `_sessionStore` Map, but the directive queue and logs manager do not follow the same pattern. The minor issues are standard robustness concerns (race conditions, error handling, redundant I/O) that would surface under production load.
