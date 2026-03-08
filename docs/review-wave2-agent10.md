# Review Wave 2 — Agent 10: External Triggers, Agent Coordination, Skills & Review Plugins

**Reviewer**: goodvibes:reviewer  
**Date**: 2026-03-07  
**Score**: 7.4/10  
**Files Reviewed**: 14  
**Issues Found**: 8  

## ACP Spec Source

Fetched once from `https://agentclientprotocol.com/llms-full.txt` (571,921 bytes, HTTP 200, cached).

## Files Reviewed

| # | File | Lines |
|---|------|-------|
| 1 | `src/extensions/external/file-watcher.ts` | 242 |
| 2 | `src/extensions/external/http-listener.ts` | 306 |
| 3 | `src/extensions/external/index.ts` | 100 |
| 4 | `src/extensions/external/normalizer.ts` | 192 |
| 5 | `src/extensions/agents/coordinator.ts` | 191 |
| 6 | `src/extensions/agents/index.ts` | 18 |
| 7 | `src/extensions/agents/tracker.ts` | 173 |
| 8 | `src/plugins/skills/index.ts` | 39 |
| 9 | `src/plugins/skills/registry.ts` | 333 |
| 10 | `src/plugins/skills/types.ts` | 102 |
| 11 | `src/plugins/review/fixer.ts` | 77 |
| 12 | `src/plugins/review/index.ts` | 37 |
| 13 | `src/plugins/review/reviewer.ts` | 211 |
| 14 | `src/plugins/review/scoring.ts` | 19 |

## Issues

### Issue 1 — HTTP webhook responses use plain text instead of JSON-RPC 2.0 envelope

| Field | Value |
|-------|-------|
| **File** | `src/extensions/external/http-listener.ts` |
| **Lines** | 119-129, 303 |
| **Severity** | Major |
| **KB Topic** | 08-extensibility.md: Extension Methods follow JSON-RPC 2.0 semantics; 10-implementation-guide.md: JSON-RPC 2.0 wire format |

The `reply()` helper sends plain-text HTTP responses (`Content-Type: text/plain`). The existing TODO on lines 15-24 acknowledges this: the IPC protocol uses a custom event-based format, not JSON-RPC 2.0. Per the ACP spec and KB 08, all inter-process communication within the ACP layer must use JSON-RPC 2.0 envelopes (`{"jsonrpc": "2.0", "result": ..., "id": ...}` for success, `{"jsonrpc": "2.0", "error": {...}, "id": ...}` for errors). The webhook endpoint returns `"OK"` as a text string on line 303 instead of a JSON-RPC result object.

**Remediation**: Replace the `reply()` helper with a JSON-RPC 2.0 compliant response function. Success: `{"jsonrpc": "2.0", "result": {"status": "accepted"}, "id": <request-id>}`. Error cases (401, 400, 413) should return `{"jsonrpc": "2.0", "error": {"code": <code>, "message": <msg>}, "id": null}`.

---

### Issue 2 — `toAcpExtensionEvent` output missing `sessionId` field

| Field | Value |
|-------|-------|
| **File** | `src/extensions/external/normalizer.ts` |
| **Lines** | 180-191 |
| **Severity** | Major |
| **KB Topic** | 08-extensibility.md: `_goodvibes/events` notification wire format; `_goodvibes/status` notification requires `sessionId` |

The `toAcpExtensionEvent()` function on line 180 converts a `NormalizedEvent` into ACP extension event params, but the output object lacks a `sessionId` field. KB 08 defines all `_goodvibes/*` notification params as requiring a `sessionId` (see the `_goodvibes/status` wire format on line 247-258 and the extension notification example on lines 130-138). Without `sessionId`, the ACP client cannot associate the event with a specific session.

**Remediation**: Add `sessionId` as a required parameter to `toAcpExtensionEvent(event, sessionId)` and include it in the returned object.

---

### Issue 3 — ExternalEventBridge emits raw payload instead of full NormalizedEvent

| Field | Value |
|-------|-------|
| **File** | `src/extensions/external/index.ts` |
| **Lines** | 64-66 |
| **Severity** | Minor |
| **KB Topic** | 08-extensibility.md: Extension method params structure |

On line 65, the webhook forwarding handler emits `event.payload` onto the `external:event` channel, but the docstring (lines 28-33) and the file-watcher handler (lines 73-80) both emit a full `NormalizedEvent` object. This inconsistency means webhook events arrive on `external:event` as the inner `NormalizedEvent` payload (since `event` is already the `NormalizedEvent` from the bus wrapper, and `event.payload` is the nested normalized payload record), while file-watcher events arrive as a properly constructed `NormalizedEvent`.

**Remediation**: Change line 65 from `this._bus.emit('external:event', event.payload)` to `this._bus.emit('external:event', event.payload)` — but note that `event` here is the EventBus wrapper containing `{ payload: NormalizedEvent }`, so the correct emission is `event.payload` which IS the NormalizedEvent. Verify the EventBus wrapper type to confirm `event.payload` is indeed the full `NormalizedEvent` and not the inner `payload` field of NormalizedEvent. If the EventBus callback receives `(event: { payload: NormalizedEvent })`, the current code is correct. This depends on EventBus generic signature.

---

### Issue 4 — AgentCoordinator does not surface agent data via `_goodvibes/agents` extension method

| Field | Value |
|-------|-------|
| **File** | `src/extensions/agents/coordinator.ts` |
| **Lines** | 38-190 (entire class) |
| **Severity** | Major |
| **KB Topic** | 08-extensibility.md: `_goodvibes/agents` request/response wire format (lines 282-301) |

KB 08 defines a `_goodvibes/agents` extension request with a specific response schema: `{ agents: Array<{ id, type, status, startedAt?, completedAt?, score?, minimumScore?, files?, error? }> }`. The `AgentCoordinator` and `AgentTracker` store agent metadata in `StateStore` but provide no method that returns data in the `_goodvibes/agents` response format. The `AgentMetadata` type uses `spawnedAt` (tracker.ts:58) rather than `startedAt` as required by the wire format, and lacks `score`, `minimumScore`, and `files` fields.

**Remediation**: Add a `toAcpAgentsResponse(sessionId)` method to `AgentCoordinator` or `AgentTracker` that maps internal `AgentMetadata` to the KB-specified `GoodVibesAgentsResponse` wire format. Map `spawnedAt` to the response `startedAt` field. Extend `AgentMetadata` with optional `score`, `minimumScore`, and `files` fields.

---

### Issue 5 — AgentTracker status transitions allow invalid state machine paths

| Field | Value |
|-------|-------|
| **File** | `src/extensions/agents/tracker.ts` |
| **Lines** | 82-121 |
| **Severity** | Minor |
| **KB Topic** | 10-implementation-guide.md: WRFC phase transitions (pending -> running -> completed/failed) |

The `updateStatus()` method on line 82 accepts any `AgentStatus` transition without validating the state machine. KB 10 (section 6, lines 341-345) defines strict phase transitions: `pending -> running -> completed` or `pending -> running -> failed`. The tracker allows transitions like `completed -> running` or `spawned -> completed` (skipping `running`) without guard checks. While not a protocol wire-format violation, it can lead to inconsistent metadata emitted via `_goodvibes/agents`.

**Remediation**: Add a transition validation guard at the top of `updateStatus()` that rejects invalid transitions (e.g., terminal -> active, or skipping `running`).

---

### Issue 6 — SkillsPlugin `register` uses opaque `registry: unknown` cast

| Field | Value |
|-------|-------|
| **File** | `src/plugins/skills/index.ts` |
| **Lines** | 34-35 |
| **Severity** | Minor |
| **KB Topic** | 10-implementation-guide.md: Type safety in plugin registration |

The `register` callback casts `registry` from `unknown` to `Registry` via `(registry as Registry)`. The same pattern appears in `src/plugins/review/index.ts` lines 30-31. This bypasses TypeScript's type system. If `PluginRegistration.register` is typed as `(registry: unknown) => void`, the type definition should be updated to `(registry: Registry) => void` to avoid unsafe casts at every registration site.

**Remediation**: Update the `PluginRegistration` type in `src/types/plugin.ts` to type `register` as `(registry: Registry) => void`, or use a generic constraint.

---

### Issue 7 — CodeReviewer `_detectPattern` false positives on common substrings

| Field | Value |
|-------|-------|
| **File** | `src/plugins/review/reviewer.ts` |
| **Lines** | 82-99 |
| **Severity** | Minor |
| **KB Topic** | 10-implementation-guide.md: Review scoring accuracy |

The `_detectPattern` method on line 207 does simple `text.includes()` matching. Several patterns will produce false positives: `'secret'` (line 95) matches any mention of the word "secret" in legitimate comments or variable names; `'expect('` (line 89) matches the Jest/Vitest assertion function name even in passing test output; `'token exposed'` is overly specific while `'password'` is overly broad. This can artificially deflate review scores for compliant code.

**Remediation**: Use more specific patterns with word boundaries or context-aware matching. For example, match `'secret'` only when it appears near `=` or `:` assignment operators, or use regex with `\b` word boundaries.

---

### Issue 8 — FileWatcher `_shouldIgnore` uses substring matching instead of glob patterns

| Field | Value |
|-------|-------|
| **File** | `src/extensions/external/file-watcher.ts` |
| **Lines** | 238-240 |
| **Severity** | Minor |
| **KB Topic** | 08-extensibility.md: Extension implementation quality |

The `_shouldIgnore` method on line 238 uses `fullPath.includes(pattern)`, but the `WatchOptions.ignore` field is documented on lines 33-36 as accepting "Glob-style substring patterns". The term "glob-style" is misleading since the implementation only does substring matching — no wildcards, no `*` or `**` support. A path ignore pattern like `*.log` would be treated as a literal substring match, never matching actual `.log` files unless the path literally contains `*.log`.

**Remediation**: Either update the JSDoc to accurately describe the behavior as "substring patterns" (removing "Glob-style"), or implement actual glob matching using a lightweight glob-to-regex conversion.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 3 |
| Minor | 5 |
| **Total** | **8** |

The codebase demonstrates solid architecture with clean layer separation (L1/L2/L3), proper EventBus decoupling, and defensive error handling (CodeReviewer never throws, FileWatcher catches watch errors). The three major issues center on ACP protocol compliance: (1) webhook responses need JSON-RPC 2.0 envelopes, (2) extension event params need `sessionId`, and (3) agent metadata needs a wire-format adapter for `_goodvibes/agents`. The minor issues are documentation/type-safety improvements that reduce risk of subtle bugs.
