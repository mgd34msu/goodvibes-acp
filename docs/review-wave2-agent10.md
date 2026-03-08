# ACP Compliance Review — Wave 2, Agent 10

**Topic**: External Integration, Agents Plugin & Skills Plugin  
**Files reviewed**:
- `src/extensions/external/http-listener.ts`
- `src/extensions/external/normalizer.ts`
- `src/extensions/external/file-watcher.ts`
- `src/extensions/external/index.ts`
- `src/plugins/agents/index.ts`
- `src/plugins/skills/index.ts`
- `src/plugins/skills/registry.ts`

**KB references**: `08-extensibility.md`, `06-tools-mcp.md`, `05-permissions.md`

---

## Issues

### Issue 1 — Webhook responses use plain-text, not JSON-RPC 2.0
**File**: `src/extensions/external/http-listener.ts` L118-129, L301-303  
**KB**: `08-extensibility.md` — Extension methods follow standard JSON-RPC 2.0 semantics  
**Severity**: HIGH  

The `reply()` helper sends `Content-Type: text/plain` responses (e.g., `reply(res, 200, 'OK')`). Per KB, all ACP communication uses JSON-RPC 2.0 envelopes. Success should return `{"jsonrpc":"2.0","result":{...},"id":...}` and errors should return `{"jsonrpc":"2.0","error":{"code":...,"message":...},"id":...}`. The module's own TODO (L15-24) acknowledges this gap.

### Issue 2 — ExternalEventBridge drops NormalizedEvent fields on webhook forwarding
**File**: `src/extensions/external/index.ts` L65  
**KB**: `08-extensibility.md` — `_goodvibes/events` notification params include `source`, `type`, `payload`, `timestamp`, `eventId`  
**Severity**: HIGH  

Line 65 emits `event.payload` (the inner payload only) instead of the full `NormalizedEvent` object. This drops `source`, `type`, `id`, and `timestamp` — all required fields for downstream ACP `_goodvibes/events` notifications.

### Issue 3 — No `_goodvibes/agents` wire format adapter in agents plugin
**File**: `src/plugins/agents/spawner.ts` (entire file)  
**KB**: `08-extensibility.md` L282-300 — `GoodVibesAgentsRequest/Response` wire format  
**Severity**: HIGH  

The KB defines a `_goodvibes/agents` extension method with a specific wire format: `{ agents: [{ id, type, status, startedAt?, completedAt?, score?, minimumScore?, files?, error? }] }`. The spawner plugin has no method to produce this shape. `_buildResult()` returns an internal `AgentResult` type that doesn't conform — missing `completedAt`, `score`, `minimumScore` fields, and uses `filesModified` instead of `files`.

### Issue 4 — File watcher ignore uses substring matching, not glob
**File**: `src/extensions/external/file-watcher.ts` L238-239  
**KB**: General best practice  
**Severity**: MEDIUM  

`_shouldIgnore()` uses `fullPath.includes(pattern)` for filtering. The `WatchOptions.ignore` JSDoc says "Glob-style substring patterns" but the implementation only does substring matching. Patterns like `*.log` or `**/*.tmp` would not work. This creates false positives (e.g., a path containing "node_modules" in a directory name unrelated to actual node_modules).

### Issue 5 — File-watcher bridge uses non-unique event IDs
**File**: `src/extensions/external/index.ts` L78  
**KB**: `08-extensibility.md` — events need unique `eventId`  
**Severity**: MEDIUM  

The file-watcher bridge constructs event IDs as `fw-${timestamp}-${path}`. If two changes to the same path occur at the same millisecond (e.g., debounce race), IDs collide. Should use `randomUUID()` for guaranteed uniqueness, consistent with `normalizer.ts` which already uses `randomUUID()`.

### Issue 6 — `toAcpExtensionEvent` omits `_meta` for trace context
**File**: `src/extensions/external/normalizer.ts` L180-192  
**KB**: `08-extensibility.md` L48-67 — Reserved `_meta` keys for W3C trace context (`traceparent`, `tracestate`, `baggage`)  
**Severity**: LOW  

The ACP adapter function produces extension event params but does not propagate or include a `_meta` field. Any trace context attached to the original event is lost. The function should accept an optional `_meta` parameter and include it in the output for distributed tracing interoperability.

### Issue 7 — Plugin `register` functions use `unknown` cast for Registry
**File**: `src/plugins/agents/index.ts` L30, `src/plugins/skills/index.ts` L34  
**KB**: General type safety  
**Severity**: LOW  

Both plugins declare `register: (registry: unknown) =>` then immediately cast to `Registry`. This bypasses TypeScript's type checking at the call site. The `PluginRegistration.register` signature should accept `Registry` directly, or a base interface that Registry implements, to preserve type safety.

### Issue 8 — Skill registry content is placeholder-quality for non-protocol skills
**File**: `src/plugins/skills/registry.ts` L122-144  
**KB**: N/A (functional completeness)  
**Severity**: LOW  

Outcome and quality skill `content` fields are single-sentence placeholders (e.g., `'Integrate AI capabilities with proper streaming and error handling.'`). These are not functional skill prompts. The registry will return content that provides no actionable guidance to agents. Protocol skills (L23-101) have substantive multi-paragraph content, creating an inconsistency.

### Issue 9 — No permission gating for external webhook event injection
**File**: `src/extensions/external/http-listener.ts` (entire handler flow)  
**KB**: `05-permissions.md` — sensitive actions should go through `session/request_permission`  
**Severity**: MEDIUM  

External webhooks inject events directly onto the EventBus without any permission check. An external HTTP caller can trigger arbitrary event processing. While HMAC signature verification provides authentication, there is no ACP-level permission gate to let the client/user approve or deny external event injection, which could trigger agent spawns or state changes.

### Issue 10 — ExternalEventBridge inconsistent event types between webhook and file-watcher
**File**: `src/extensions/external/index.ts` L64-81  
**KB**: `08-extensibility.md` — unified event format  
**Severity**: MEDIUM  

The webhook handler emits `event.payload` (raw payload object, see Issue 2), while the file-watcher handler constructs a full `NormalizedEvent` object. Downstream subscribers on `external:event` receive fundamentally different shapes depending on the source — one gets a raw payload, the other gets a `NormalizedEvent`. This breaks the unified event channel contract.

---

## Summary

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | HIGH | http-listener.ts | Plain-text responses instead of JSON-RPC 2.0 |
| 2 | HIGH | index.ts (external) | Bridge drops NormalizedEvent fields |
| 3 | HIGH | spawner.ts | No `_goodvibes/agents` wire format |
| 4 | MEDIUM | file-watcher.ts | Substring matching, not glob |
| 5 | MEDIUM | index.ts (external) | Non-unique event IDs |
| 6 | LOW | normalizer.ts | No `_meta` trace context propagation |
| 7 | LOW | agents/index.ts, skills/index.ts | `unknown` cast bypasses type safety |
| 8 | LOW | skills/registry.ts | Placeholder content for non-protocol skills |
| 9 | MEDIUM | http-listener.ts | No ACP permission gating for webhook injection |
| 10 | MEDIUM | index.ts (external) | Inconsistent event shapes between sources |

**HIGH**: 3 | **MEDIUM**: 4 | **LOW**: 3

---

## Overall Score: 5/10

The external integration layer has significant ACP compliance gaps. The three HIGH issues (plain-text responses, dropped event fields, missing wire format adapter) represent protocol violations that would prevent correct interop with ACP clients. The ExternalEventBridge is the most problematic module — it loses data on forwarding and produces inconsistent shapes. The plugins are structurally sound but lack wire format adapters required by the KB extensibility spec. The skill registry is functionally complete for protocol skills but outcome/quality skills are stubs.
