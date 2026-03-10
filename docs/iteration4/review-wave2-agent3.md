# Wave 2 Review — Agent 3: Trigger Engine & Scheduler

**Reviewer**: ACP Compliance Review Agent  
**Files reviewed**:  
- `src/core/trigger-engine.ts`  
- `src/core/scheduler.ts`  
- `src/types/trigger.ts`  

**KB references**: `08-extensibility.md` (_meta usage, custom field prohibition), `04-prompt-turn.md` (event lifecycle), `10-implementation-guide.md` (error handling, timeouts)

---

## Issues

### 1. No timeout enforcement on trigger handler execution
**File**: `src/core/trigger-engine.ts:227`  
**KB**: `10-implementation-guide.md` — error handling; `src/types/registry.ts:197` — "complete within the trigger timeout"  
**Severity**: HIGH  

The `ITriggerHandler` interface documents that implementations "MUST be idempotent and complete within the trigger timeout," but `TriggerEngine.evaluate()` calls `handler.execute()` with no timeout enforcement. A handler that hangs will never be detected or cancelled. The `.catch()` on line 227 only catches rejections, not hangs.

**Fix**: Wrap `handler.execute()` with `Promise.race` against a configurable timeout (e.g., from `TriggerDefinition.metadata.timeoutMs` or a default), and reject with a timeout error if exceeded.

---

### 2. Double-cast event type erasure in TriggerContext
**File**: `src/core/trigger-engine.ts:222`  
**KB**: `08-extensibility.md` — type safety across extension boundaries  
**Severity**: MEDIUM  

The context construction uses `event as unknown as Record<string, unknown>`, which erases the `EventRecord` type. This double-cast bypasses TypeScript's type system entirely. The `TriggerContext.event` field in L0 is typed as `Record<string, unknown>`, creating an impedance mismatch — handlers lose access to `event.type`, `event.timestamp`, and `event.payload` without further casting.

**Fix**: Either widen `TriggerContext.event` in L0 to include `type` and `timestamp` fields, or create an L1 `TriggerContextWithEvent` type that preserves `EventRecord`. The double-cast `as unknown as` should be replaced with a proper type narrowing.

---

### 3. Unbounded regex cache growth
**File**: `src/core/trigger-engine.ts:31`  
**KB**: `10-implementation-guide.md` — resource management  
**Severity**: MEDIUM  

The module-level `_regexCache` Map grows without bound. Each unique regex pattern string adds an entry that is never evicted. In a long-running daemon with dynamic trigger registration/unregistration, this constitutes a memory leak. The cache also survives `TriggerEngine.destroy()`, which clears `_triggers` but not the shared module-level cache.

**Fix**: Either scope the cache to the `TriggerEngine` instance (cleared on `destroy()`), or implement an LRU eviction policy with a reasonable cap (e.g., 256 entries).

---

### 4. Scheduler computes nextRun twice on schedule
**File**: `src/core/scheduler.ts:93,110`  
**Severity**: LOW  

`nextRun` is set to `Date.now() + intervalMs` on line 93 during task construction, then overwritten with a new `Date.now() + intervalMs` on line 110 after the timer is created. The second computation produces a slightly later timestamp (by the time elapsed to create the timer and optionally execute `runImmediately`). This is cosmetically incorrect — the first value is stale by the time line 110 executes.

**Fix**: Remove the line 93 assignment and only set `nextRun` after the timer is created (line 110).

---

### 5. Scheduler error handling uses console.error instead of EventBus
**File**: `src/core/scheduler.ts:239,246`  
**KB**: `08-extensibility.md` — error propagation via _meta; `10-implementation-guide.md` — structured error handling  
**Severity**: MEDIUM  

The Scheduler uses `console.error('[Scheduler] handler error:', err)` for error reporting, while TriggerEngine correctly emits errors to the EventBus with `_meta` fields (line 230-237). This inconsistency means scheduler errors are not observable by other runtime components (analytics, monitoring, error recovery hooks). In a production daemon, stderr output may be lost, but EventBus errors are capturable.

**Fix**: Accept an optional `EventBus` in the Scheduler constructor and emit errors with `_goodvibes/source: 'scheduler'` metadata, mirroring the TriggerEngine pattern.

---

### 6. No cancellation support (AbortController) for in-flight handlers
**File**: `src/core/trigger-engine.ts:227`, `src/core/scheduler.ts:236`  
**KB**: `04-prompt-turn.md:480-486` — cancel flow; `10-implementation-guide.md` — graceful teardown  
**Severity**: MEDIUM  

Neither TriggerEngine nor Scheduler provide an `AbortSignal` to handler functions. On `destroy()`, both clear their internal state but have no way to signal in-flight async handlers to stop. This is particularly problematic for the Scheduler, where the comment on line 115 acknowledges "any in-progress execution will complete" but provides no mechanism to shorten that completion. The ACP cancel flow (KB-04) establishes the pattern that async operations should be cancellable.

**Fix**: Pass an `AbortSignal` to handlers (extend `ScheduleConfig.handler` signature and `ITriggerHandler.execute` to accept one). On `destroy()`, abort the controller.

---

### 7. TriggerEngine silently skips missing handlers
**File**: `src/core/trigger-engine.ts:207-210`  
**KB**: `08-extensibility.md` — forward compatibility; `10-implementation-guide.md` — observability  
**Severity**: LOW  

When `registry.getOptional()` returns null (line 206), the trigger is silently skipped. The comment says "handler may not be loaded yet," but there is no diagnostic output, no event emission, and no way to distinguish between "handler not yet loaded" (transient) and "handler key misspelled" (permanent bug). Over time this creates silent failures that are difficult to debug.

**Fix**: Emit a diagnostic event (e.g., `trigger:handler-missing`) on first miss per handler key, with deduplication to avoid event floods.

---

### 8. Scheduler task status stuck on 'running' if handler throws synchronously
**File**: `src/core/scheduler.ts:235-248`  
**Severity**: LOW  

The `_execute` method correctly calls `done()` in the `catch` block (line 247), but `task.status` is set to `'running'` on line 220 before the handler is called. If `maxConcurrent` is 1 (default) and the handler throws, `done()` sets status back to `'scheduled'` only if `activeCount` drops to 0 and status is not cancelled/paused. This works correctly. However, if `maxConcurrent > 1` and one execution throws while another is still running, `task.status` remains `'running'` — which is correct but means no observer can distinguish "1 of 2 slots failed" from "both slots active."

**Fix**: Consider adding an `errorCount` field to `ScheduledTask` for observability, or emitting error events (ties into issue #5).

---

### 9. TriggerEngine.evaluate() is synchronous O(n) on every event
**File**: `src/core/trigger-engine.ts:165-239`  
**KB**: `10-implementation-guide.md` — performance considerations  
**Severity**: LOW  

Every event emitted on the EventBus causes a full iteration over all registered triggers (line 168). With many triggers and high event throughput, this becomes a performance bottleneck. There is no indexing by event type — the `matchesPattern` function is called for every trigger on every event, even when most triggers use exact-match patterns that could be O(1) via a Map lookup.

**Fix**: Partition triggers into an exact-match Map (O(1) lookup) and a patterns list (only iterated for non-exact matches). This is an optimization, not a correctness issue.

---

### 10. TriggerDefinition.sessionId matching uses unchecked payload cast
**File**: `src/core/trigger-engine.ts:181`  
**KB**: `08-extensibility.md` — custom data in _meta, not root fields  
**Severity**: MEDIUM  

The session scope check casts `event.payload` to `Record<string, unknown>` and reads `sessionId` directly from the payload root (line 181). This assumes that all events carrying a session ID store it as `payload.sessionId`. However, per KB-08, custom fields should not be at the root of protocol types — and different event sources may structure their payload differently. Additionally, there is no null-safety check beyond optional chaining: if `event.payload` is a primitive (number, string), the cast produces incorrect behavior silently.

**Fix**: Either standardize on a well-known event payload shape (e.g., require `payload._meta['_goodvibes/sessionId']`), or accept a configurable session ID extractor function in the trigger definition.

---

## Summary

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | No timeout enforcement on trigger handlers | HIGH | trigger-engine.ts:227 |
| 2 | Double-cast event type erasure | MEDIUM | trigger-engine.ts:222 |
| 3 | Unbounded regex cache (memory leak) | MEDIUM | trigger-engine.ts:31 |
| 4 | nextRun computed twice on schedule | LOW | scheduler.ts:93,110 |
| 5 | Scheduler errors via console.error, not EventBus | MEDIUM | scheduler.ts:239,246 |
| 6 | No AbortController/cancellation for handlers | MEDIUM | trigger-engine.ts:227, scheduler.ts:236 |
| 7 | Missing handler silently skipped, no diagnostics | LOW | trigger-engine.ts:207-210 |
| 8 | No error count observability on scheduler tasks | LOW | scheduler.ts:235-248 |
| 9 | O(n) trigger evaluation on every event | LOW | trigger-engine.ts:165-239 |
| 10 | Session ID matching uses unchecked payload root cast | MEDIUM | trigger-engine.ts:181 |

**HIGH**: 1 | **MEDIUM**: 5 | **LOW**: 4

## Overall Score: 7/10

The trigger engine and scheduler are well-structured with proper error isolation (trigger handler failures don't crash the engine), correct fire-count ordering (fixed from wave 1 — increment now happens after handler validation), and good use of `_meta` for error events per KB-08. The magic number timeout issue from wave 1 has been addressed with `DEFAULT_INTERVAL_MS`. However, the lack of timeout enforcement on trigger handlers is a significant gap given the ITriggerHandler contract explicitly requires it. The missing AbortController support and inconsistent error reporting (EventBus in triggers, console.error in scheduler) reduce production readiness. The session ID matching via unchecked payload cast conflicts with KB-08's guidance on custom field placement.
