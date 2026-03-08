# Review: Trigger Engine & Scheduler (Wave 2, Agent 3 — Iteration 3)

**Score: 7.8/10** | **Issues: 0 critical, 4 major, 5 minor, 1 nitpick**

**Files reviewed:**
- `src/core/trigger-engine.ts` (289 lines)
- `src/core/scheduler.ts` (261 lines)

**KB references:** `docs/acp-knowledgebase/08-extensibility.md`, `docs/acp-knowledgebase/04-prompt-turn.md`
**ACP spec:** fetched from `https://agentclientprotocol.com/llms-full.txt`

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | Both source files present on disk |
| Exports used | PASS | `TriggerEngine` and `Scheduler` imported in `src/core/index.ts` |
| Import chain valid | PASS | Connected to barrel export |
| No placeholders | PASS | No TODO/FIXME/stub implementations |
| Integration verified | PASS | Both classes exported and instantiable |

---

## Issues

### Major Issues

| # | File | Line | KB/Spec Topic | Severity | Issue |
|---|------|------|---------------|----------|-------|
| 1 | `src/core/trigger-engine.ts` | 181 | KB-04: EventRecord structure | Major | Session scoping uses `(event.payload as Record<string, unknown>)?.sessionId` but `EventRecord` has a top-level `sessionId` field (event-bus.ts:26). This bypasses the canonical field and inspects payload internals, which may not contain `sessionId` at all. Should use `event.sessionId !== definition.sessionId`. |
| 2 | `src/core/trigger-engine.ts` | 206 | KB-08: error isolation | Major | Fire count is incremented (line 206) before handler lookup (line 209). If the handler is not found (line 210-213) or `canHandle` returns false (line 216-218), the fire count is still inflated. For triggers with `maxFires`, this causes premature exhaustion — the trigger stops firing before it has actually executed `maxFires` times. Move the increment to after line 218, just before handler execution. |
| 3 | `src/core/trigger-engine.ts` | 105-106, 230 | KB-08: error events | Major | The engine subscribes to `'*'` (all events) and emits `'error'` events on handler failure. If any trigger has `eventPattern: '*'` or `eventPattern: 'error'`, the engine's own error emission re-enters `evaluate()`, creating a potential infinite recursion loop. Add a guard (e.g., skip evaluation when `event.type === 'error'` and source is self, or use a re-entrancy flag). |
| 4 | `src/core/scheduler.ts` | 236, 243 | KB-08: extensibility / observability | Major | Errors in scheduled task handlers are logged to `console.error` and silently swallowed. In an ACP-aligned runtime, errors should be observable through the event/notification system. The Scheduler has no EventBus dependency to emit errors, making task failures invisible to the rest of the system. Consider accepting an optional `onError` callback or EventBus reference. |

### Minor Issues

| # | File | Line | KB/Spec Topic | Severity | Issue |
|---|------|------|---------------|----------|-------|
| 5 | `src/core/trigger-engine.ts` | 222 | KB-04: TriggerContext typing | Minor | `event: event as unknown as Record<string, unknown>` uses a double cast (`as unknown as`) to strip the `EventRecord` type down to the L0 `TriggerContext.event` type. While type-correct for the interface contract, this erases the typed `id`, `type`, `timestamp`, and `_meta` fields from the handler's perspective. Consider widening the L0 `TriggerContext.event` type to include at least `type` and `timestamp`, or provide a typed accessor. |
| 6 | `src/core/trigger-engine.ts` | 31 | General: memory | Minor | Module-level `_regexCache` (`Map<string, RegExp | null>`) is never bounded and never cleared. If many distinct regex patterns are registered and unregistered over a long-running process, this cache grows without limit. Add a size cap or use the trigger lifecycle (unregister) to evict entries. |
| 7 | `src/core/trigger-engine.ts` | 230-237 | KB-08: `_meta` error payload | Minor | Error payload in `_meta` converts the error to a string message (`err.message`) but discards the stack trace. For production debugging, include `'_goodvibes/stack': err instanceof Error ? err.stack : undefined` to preserve diagnostic information. |
| 8 | `src/core/scheduler.ts` | 90, 107 | General: correctness | Minor | `task.nextRun` is set to `Date.now() + intervalMs` on line 90, then immediately overwritten to the same value on line 107 after the `setInterval` call. The first assignment is redundant. If `runImmediately` is true (line 96-98), the value on line 90 is stale by the time line 107 executes. Remove line 90's assignment or consolidate. |
| 9 | `src/core/scheduler.ts` | 217 | General: status accuracy | Minor | `task.status` is set to `'running'` unconditionally on every `_execute()` call, even when `maxConcurrent > 1` and the task is already running from a prior concurrent invocation. This overwrites the already-correct `'running'` status, which is benign but semantically incorrect — `status` should only transition from `'scheduled'` to `'running'` on the first concurrent start, not on subsequent ones. |

### Nitpick

| # | File | Line | KB/Spec Topic | Severity | Issue |
|---|------|------|---------------|----------|-------|
| 10 | `src/core/scheduler.ts` | 84 | General: documentation | Nitpick | Default `intervalMs` of `60000` (1 minute) is a magic number used in three places (lines 84, 161, 222). Extract to a named constant (`DEFAULT_INTERVAL_MS`) and document it in the `ScheduleConfig` JSDoc (the current JSDoc says "Interval in milliseconds for recurring tasks" but doesn't mention the default). |

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 9/10 | Regex cache is unbounded but low risk |
| Error Handling | 6/10 | Scheduler swallows errors; trigger fire count inflated on failures |
| Testing | N/A | Tests not in scope |
| Organization | 9/10 | Clean separation, proper layering |
| Performance | 8/10 | Re-entrancy risk on error events; unbounded cache |
| SOLID/DRY | 7/10 | Magic number repeated 3x; redundant nextRun assignment |
| Naming | 9/10 | Clear, consistent naming throughout |
| Maintainability | 8/10 | Double cast reduces type safety for handlers |
| Documentation | 8/10 | Good JSDoc; missing default value documentation |
| Dependencies | 10/10 | Zero external deps, clean imports |

---

## Positive Notes

- KB-08 compliance on `_meta` usage is correct — custom fields are properly namespaced under `_goodvibes/` within `_meta`, not at root level
- Error isolation pattern (catch on handler.execute promise) prevents one trigger from crashing others
- Proper lifecycle management with `destroy()` and `_assertNotDestroyed()` guards
- Scheduler's `Disposable` pattern aligns well with the EventBus subscription model
- Clean L0/L1 layer separation maintained in type imports

---

## Recommendations

1. **Immediate (before merge):** Fix fire count increment placement (issue 2) — this is a correctness bug that causes triggers with `maxFires` to exhaust prematurely
2. **Immediate (before merge):** Add re-entrancy guard for error event recursion (issue 3)
3. **Immediate (before merge):** Use `event.sessionId` instead of payload cast for session scoping (issue 1)
4. **This PR:** Add error observability to Scheduler (issue 4) — even an `onError` callback would suffice
5. **Follow-up:** Bound the regex cache and add stack traces to error payloads
