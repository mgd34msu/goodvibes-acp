# Code Review: Analytics & Budget Tracking (Wave 2, Agent 6)

**Score: 6.8/10** | **Issues: 2 major, 6 minor, 2 nitpick**

## Scope

Files reviewed:
- `src/plugins/analytics/budget.ts` (128 lines)
- `src/plugins/analytics/dashboard.ts` (112 lines)
- `src/plugins/analytics/engine.ts` (330 lines)
- `src/plugins/analytics/export.ts` (136 lines)
- `src/plugins/analytics/index.ts` (53 lines)
- `src/plugins/analytics/sync.ts` (89 lines)
- `src/plugins/analytics/types.ts` (189 lines)

KB references: `docs/acp-knowledgebase/08-extensibility.md`, `docs/acp-knowledgebase/04-prompt-turn.md`

Spec source: `https://agentclientprotocol.com/llms-full.txt`

---

## Issues

### 1. `_pendingWarnings` map is write-only dead code

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/engine.ts` |
| **Lines** | 48, 132, 141, 147 |
| **KB Topic** | KB-08 Extensibility (extension methods should surface data to clients) |
| **Severity** | Major |

The `_pendingWarnings` map is populated when budget thresholds are crossed (lines 132, 141, 147) but is never read, consumed, or cleared anywhere in the codebase. No public method exposes pending warnings and no notification is emitted. This is dead state that gives the false impression that threshold-crossing alerts are being tracked for delivery.

**Fix:** Either expose a `consumeWarnings(sessionId)` method that returns and clears pending warnings, or remove the `_pendingWarnings` map and integrate threshold notifications into the ACP extension method response or `session/update` notifications.

---

### 2. `getAnalyticsResponse` ignores the `scope` discriminator

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/engine.ts` |
| **Lines** | 266-319 |
| **KB Topic** | KB-08 lines 306-309: `scope: 'session' \| 'workflow' \| 'agent'` with optional `id` field |
| **Severity** | Major |

The `GoodVibesAnalyticsRequest` type defines `scope` as `'session' | 'workflow' | 'agent'` and an `id` field for workflow/agent filtering (matching KB-08 wire format exactly). However, `getAnalyticsResponse()` at line 269 only reads `request?.sessionId` and completely ignores `scope` and `id`. A client sending `{ scope: 'agent', id: 'agent_003' }` gets the same session-level response as `{ scope: 'session' }`. The JSDoc at line 259 acknowledges this ("fall back to session-level data") but this is a protocol compliance gap -- the method signature promises scope support it cannot deliver.

**Fix:** Either dispatch on `scope` (even if workflow/agent scopes initially just filter the session data differently), or narrow the `GoodVibesAnalyticsRequest.scope` type to `'session'` only and document the limitation. Do not accept a contract you cannot fulfill.

---

### 3. Plugin `shutdown` callback does not flush analytics

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/index.ts` |
| **Lines** | 47-51 |
| **KB Topic** | KB-08 Extensibility (plugin lifecycle) |
| **Severity** | Minor |

The `PluginRegistration.shutdown` callback is a no-op. The comment says "graceful flush is called directly via `AnalyticsEngine.shutdown()` from main.ts if the consumer wires it up." This means analytics data loss on shutdown is dependent on external wiring that the plugin cannot guarantee. The `register` callback creates the engine and has access to the registry, but `shutdown` does not retrieve or flush it.

**Fix:** Capture the engine instance during `register` (e.g., in a closure variable) and call `engine.shutdown()` in the `shutdown` callback.

---

### 4. No `session/update` notification emitted for budget threshold crossings

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/engine.ts` |
| **Lines** | 115-151 |
| **KB Topic** | KB-04 `session_info` update type (lines 289-315) |
| **Severity** | Minor |

When a budget threshold is crossed (warning at 75%, alert at 90%, exceeded at 100%), the engine stores warnings in `_pendingWarnings` but never emits a `session/update` notification with `sessionUpdate: 'session_info'`. KB-04 defines `session_info` as the correct vehicle for "status updates, warnings, non-message content." Budget warnings are exactly this kind of informational notification.

**Fix:** Accept an optional notification callback (or event emitter) in the constructor. When a threshold is crossed, emit a `session_info`-shaped notification so the ACP transport can forward it to the client.

---

### 5. `SessionSync.load` deserializes untrusted JSON without validation

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/sync.ts` |
| **Lines** | 48-53 |
| **KB Topic** | KB-08 Forward Compatibility (lines 330-335) |
| **Severity** | Minor |

The `load` method does `JSON.parse(raw) as SessionAnalytics` with no runtime validation. The comment at lines 48-50 acknowledges this risk but takes no action. If the JSON file was written by an older schema version (missing fields) or tampered with (negative token counts, missing `entries` array), the cast will silently produce an invalid object that corrupts the in-memory store.

**Fix:** Add a runtime shape check (e.g., validate that `sessionId` is a string, `entries` is an array, numeric fields are non-negative) before inserting into the store. A lightweight guard function is sufficient -- no need for a full schema library.

---

### 6. Dashboard `getSummary` copies all entries into a single array

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/dashboard.ts` |
| **Lines** | 29, 34 |
| **KB Topic** | KB-08 Extensibility (analytics query performance) |
| **Severity** | Minor |

`allEntries.push(...session.entries)` spreads every entry from every session into a single flat array, then sorts it, then slices to `recentEntriesLimit` (default 20). For long-running agents with thousands of entries across many sessions, this creates unnecessary memory pressure and O(n log n) sort overhead just to find the 20 most recent.

**Fix:** Use a bounded merge approach: maintain a max-heap or simply iterate all sessions keeping only the top N entries by timestamp. Alternatively, sort in descending order per-session and merge the first N from each.

---

### 7. No ACP `handleExtMethod` dispatch integration

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/engine.ts` |
| **Lines** | 30-39 |
| **KB Topic** | KB-08 lines 162-173 (TypeScript receiving extension methods) |
| **Severity** | Minor |

KB-08 shows that `_goodvibes/analytics` should be handled via `handleExtMethod` on the Agent. The engine's class comment at lines 30-39 documents two integration options but neither is implemented. The `getAnalyticsResponse()` method exists but nothing in the plugin wires it to the ACP transport layer's extension method dispatch. This means the `_goodvibes/analytics` endpoint is effectively unreachable via ACP.

**Fix:** Either implement `IToolProvider` on the engine or register a `_goodvibes/analytics` handler in the extension method dispatch during plugin registration. The `GoodVibesExtensions` class mentioned in the comment should be wired up.

---

### 8. Missing `_meta` budget format alignment

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/types.ts` |
| **Lines** | 13-26, 79-89 |
| **KB Topic** | KB-08 line 238: `_goodvibes/budget: { maxTokens, maxTurns }` |
| **Severity** | Minor |

KB-08 shows the `_meta` budget format as `{ maxTokens: 100000, maxTurns: 20 }`. The `TokenBudget` type uses `totalBudget` (not `maxTokens`) and has no concept of `maxTurns`. The `BudgetParams` type similarly uses `totalBudget`. There is no mapping layer between the ACP `_meta` budget wire format and the internal budget representation.

**Fix:** Add a conversion function that maps from the ACP `_meta._goodvibes/budget` format (`{ maxTokens, maxTurns }`) to the internal `TokenBudget` format, and add `maxTurns` tracking to the budget system.

---

### 9. `getAnalyticsResponse` hard-codes `agentCount: 1` for single-session queries

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/engine.ts` |
| **Lines** | 289 |
| **KB Topic** | KB-08 lines 312-322 (GoodVibesAnalyticsResponse wire format) |
| **Severity** | Nitpick |

For single-session queries, `agentCount` is hard-coded to `1`. While this may be a reasonable default, it is not derived from actual agent tracking data. If a session involves multiple sub-agents, this value will be incorrect. The aggregate path (line 316) correctly uses `this._store.sessions.size`.

**Fix:** Track actual agent count per session (e.g., via a counter incremented when sub-agents are spawned) or document the `1` as a known simplification.

---

### 10. `GoodVibesAnalyticsResponse.duration_ms` uses snake_case inconsistently

| Field | Value |
|-------|-------|
| **File** | `src/plugins/analytics/types.ts` |
| **Lines** | 177 |
| **KB Topic** | KB-08 lines 312-322 (wire format field naming) |
| **Severity** | Nitpick |

The `GoodVibesAnalyticsResponse` type uses `duration_ms` (snake_case) while all other fields use camelCase (`tokenUsage`, `turnCount`, `agentCount`). The KB-08 spec at line 322 does show `duration_ms` with snake_case, so this matches the spec exactly. However, the mixed convention within the same type is worth noting -- this is a spec-level inconsistency that the implementation faithfully reproduces.

**Fix:** No code change needed -- the implementation correctly matches the spec. Flag this as a spec-level inconsistency for future ACP spec feedback.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 7/10 | Untrusted JSON deserialization (#5) |
| Error Handling | 7/10 | Budget warnings silently discarded (#1, #4) |
| Testing | N/A | No tests in scope |
| Organization | 8/10 | Clean separation of concerns across files |
| Performance | 7/10 | Unbounded array copy in dashboard (#6) |
| SOLID/DRY | 7/10 | Plugin shutdown violates SRP (#3) |
| Naming | 8/10 | Consistent naming, minor snake_case mix (#10) |
| Maintainability | 7/10 | Dead code in _pendingWarnings (#1) |
| Documentation | 8/10 | Good JSDoc, honest TODO comments |
| Dependencies | 9/10 | Minimal deps, clean imports |

## Recommendations

1. **Immediate:** Remove or integrate `_pendingWarnings` -- dead state is a maintenance hazard
2. **This iteration:** Wire `getAnalyticsResponse` to ACP extension method dispatch so `_goodvibes/analytics` is reachable
3. **This iteration:** Handle `scope` discriminator in `getAnalyticsResponse` or narrow the accepted type
4. **Follow-up:** Add runtime validation in `SessionSync.load` before trusting deserialized data
5. **Follow-up:** Add `maxTurns` tracking to align with `_meta._goodvibes/budget` format from KB-08
