# ACP Compliance Review — Wave 1, Agent 2

**Scope**: ACP Agent & Bridge  
**Files reviewed**:  
- `src/extensions/acp/agent.ts`  
- `src/extensions/acp/session-adapter.ts`  
- `src/extensions/acp/extensions.ts`  
- `src/extensions/acp/commands-emitter.ts`  
- `src/extensions/acp/tool-call-emitter.ts`  
- `src/extensions/acp/config-adapter.ts`  

**KB files referenced**: KB-01, KB-03, KB-04, KB-06, KB-09, KB-10  
**Reviewed by**: ACP Compliance Review Agent (Wave 1, Agent 2)  
**Date**: 2026-03-08  

---

## Overall ACP Compliance Score: 7.5 / 10

The agent implementation is well-structured with good separation of concerns. Most ACP protocol methods are correctly implemented. Key issues involve SessionUpdate discriminator naming divergences, a missing `finish` update in the prompt lifecycle, and incomplete config_options_update naming alignment. The codebase shows awareness of SDK vs. spec divergences with explicit comments documenting authoritative sources.

**Issue count**: 8 (1 Critical, 3 Major, 3 Minor, 1 Nitpick)

---

## Issues

### Issue 1 — Missing `finish` SessionUpdate before PromptResponse (Critical)

**File**: `src/extensions/acp/agent.ts`, lines 403-429  
**KB reference**: KB-09 Section "Complete Agent Example" (lines 798-810), KB-04 Section "session/update Notifications"  
**Severity**: Critical  

**Description**: The agent returns `{ stopReason: 'end_turn' }` in the `PromptResponse` but does not emit a `finish` SessionUpdate notification before returning. The SDK's own example agent (KB-09 lines 798-804) emits a `sessionUpdate` with `{ sessionUpdate: 'finish', stopReason: 'end_turn' }` before returning `{}` from `prompt()`. The code explicitly suppresses this at line 428 ("ISS-103: no 'finish' session update"), but the SDK example treats `finish` as part of the expected protocol flow. Some clients may rely on the `finish` notification to know the turn is ending before receiving the JSON-RPC response.

Note: There is ambiguity between KB-04 (which defines `PromptResponse.stopReason`) and KB-09 (which shows `PromptResponse` as `{}` with `finish` notification carrying the stopReason). The SDK example is authoritative, suggesting both should be emitted.

**Remediation**: Emit a `finish` sessionUpdate notification with the stopReason before returning the PromptResponse, or confirm with the SDK that `PromptResponse.stopReason` makes the `finish` notification redundant.

---

### Issue 2 — `config_option_update` discriminator naming (Major)

**File**: `src/extensions/acp/session-adapter.ts`, lines 182-186; `src/extensions/acp/config-adapter.ts`, lines 160-167  
**KB reference**: KB-03 lines 372-395, KB-04 lines 385-418  
**Severity**: Major  

**Description**: Both KB-03 and KB-04 consistently use `config_options_update` (plural "options") as the sessionUpdate discriminator for agent-initiated config changes. The implementation uses `config_option_update` (singular "option"). The code comments reference the SDK being authoritative for this naming, but the sessionUpdate value is cast via `as schema.SessionUpdate`, suggesting the TypeScript compiler cannot verify the discriminator value. If the SDK actually expects `config_options_update` (plural), the client will not recognize these notifications.

**Remediation**: Verify the exact SDK discriminator for config updates. If it is `config_options_update` (plural, matching KB-03/KB-04), update the discriminator in `session-adapter.ts` line 183 and `config-adapter.ts` line 163. The `as schema.SessionUpdate` casts bypass type checking on this critical value.

---

### Issue 3 — `available_commands_update` discriminator and field name mismatch with spec (Major)

**File**: `src/extensions/acp/commands-emitter.ts`, lines 106-117  
**KB reference**: KB-04 lines 319-354  
**Severity**: Major  

**Description**: KB-04 defines the available commands update with discriminator `available_commands` and field `commands: AgentCommand[]`. The implementation uses discriminator `available_commands_update` and field `availableCommands`. The update is constructed and then cast via `as unknown as acp.SessionUpdate` (line 116), which bypasses all type checking. The double cast (`unknown` then to `SessionUpdate`) is a strong signal that the SDK types don't naturally align with what's being constructed. If the wire format doesn't match client expectations, slash commands won't appear in the client UI.

**Remediation**: Verify the exact SDK SessionUpdate discriminator for available commands. If the SDK uses `available_commands_update` with `availableCommands`, document this. If not, align with KB-04's `available_commands` + `commands` format. Remove the double cast and ensure type-safe construction.

---

### Issue 4 — `session_info_update` vs `session_info` discriminator (Major)

**File**: `src/extensions/acp/agent.ts`, lines 96-102; `src/extensions/acp/session-adapter.ts`, lines 125-131  
**KB reference**: KB-04 lines 289-315  
**Severity**: Major  

**Description**: KB-04 defines `sessionUpdate: "session_info"` with `content: ContentBlock` payload. The implementation uses `sessionUpdate: 'session_info_update'` with a `title: string` payload (no `content` block). This is a dual mismatch: both the discriminator name and the payload shape differ from the spec. The agent.ts comment at line 94 acknowledges this divergence and claims the SDK uses `session_info_update`, but KB-04 explicitly shows `session_info` with a `ContentBlock` content field. If clients follow the spec, they won't recognize `session_info_update` updates.

**Remediation**: Verify the SDK type. If the SDK uses `session_info_update` with `title`, document this as an SDK deviation. If the SDK matches KB-04 (`session_info` + `content: ContentBlock`), update the implementation. The `session-adapter.ts` also constructs `session_info_update` with `title` and `updatedAt` fields not present in KB-04.

---

### Issue 5 — `tool_call` emitter spreads into SessionUpdate unsafely (Minor)

**File**: `src/extensions/acp/tool-call-emitter.ts`, lines 55-58, 84-87  
**KB reference**: KB-04 lines 142-157, KB-06 lines 90-115  
**Severity**: Minor  

**Description**: Both `emitToolCall` (line 57) and `emitToolCallUpdate` (line 86) construct the update by spreading a ToolCall/ToolCallUpdate object into a `{ sessionUpdate: 'tool_call', ... }` literal and casting via `as acp.SessionUpdate`. KB-04 defines `tool_call` updates with the fields directly on the update object (not nested under a `toolCall` key), which this spread approach handles correctly. However, the `as acp.SessionUpdate` cast hides any structural mismatches from the compiler. If the SDK ToolCall type includes fields that conflict with SessionUpdate, the spread will silently produce incorrect wire output.

**Remediation**: Use the SDK's typed union construction instead of spread + cast. Construct the update object to match the exact SessionUpdate variant type without using `as` casts.

---

### Issue 6 — `_meta` on commands contains non-standard keys (Minor)

**File**: `src/extensions/acp/commands-emitter.ts`, lines 48-79  
**KB reference**: KB-01 lines 376-390  
**Severity**: Minor  

**Description**: KB-01 specifies that `_meta` reserved keys are `traceparent`, `tracestate`, and `baggage` (W3C trace context). The commands emitter adds `_meta: { category: 'info' }` to each AgentCommand. While `_meta` accepts arbitrary custom data, the `category` field is not prefixed with `_` or a vendor namespace, meaning it could conflict with future ACP spec additions to the `_meta` schema.

**Remediation**: Prefix custom `_meta` keys with a vendor namespace, e.g., `_goodvibes/category` instead of `category`, consistent with the `_goodvibes/tool_name` pattern used in `tool-call-emitter.ts` line 51.

---

### Issue 7 — Extensions `pushStatus` bypasses `_`-prefix validation (Minor)

**File**: `src/extensions/acp/extensions.ts`, lines 333-348  
**KB reference**: KB-01 lines 394-398  
**Severity**: Minor  

**Description**: The `pushStatus` method calls `conn.extNotification('_goodvibes/status', ...)` which correctly uses the `_`-prefix convention per KB-01. However, the payload includes top-level fields like `health`, `uptime`, `activeSessionCount` etc. alongside `sessionId`. These fields are not namespaced. While `extNotification` params are freeform, future ACP spec additions could define reserved fields for notification params. This is a minor concern compared to the `_meta` issue above.

**Remediation**: No immediate action required. Consider namespacing the payload under a `status` or `_goodvibes` key in a future iteration to avoid potential conflicts.

---

### Issue 8 — `bridge.ts` referenced in review scope does not exist (Nitpick)

**File**: N/A (expected `src/extensions/acp/bridge.ts`)  
**KB reference**: N/A  
**Severity**: Nitpick  

**Description**: The review scope specifies `src/extensions/acp/bridge.ts` as a file to review, but this file does not exist. The actual bridge files are `fs-bridge.ts`, `terminal-bridge.ts`, and `agent-event-bridge.ts`. This is a scope specification issue, not a code issue.

**Remediation**: Update the review scope to reference the actual bridge file names.

---

## Summary Table

| # | Severity | File | Lines | Issue |
|---|----------|------|-------|-------|
| 1 | Critical | agent.ts | 403-429 | Missing `finish` SessionUpdate before PromptResponse |
| 2 | Major | session-adapter.ts, config-adapter.ts | 182-186, 160-167 | `config_option_update` vs `config_options_update` discriminator |
| 3 | Major | commands-emitter.ts | 106-117 | `available_commands_update` discriminator + field name mismatch |
| 4 | Major | agent.ts, session-adapter.ts | 96-102, 125-131 | `session_info_update` vs `session_info` discriminator + payload shape |
| 5 | Minor | tool-call-emitter.ts | 55-58, 84-87 | Unsafe spread into SessionUpdate with `as` cast |
| 6 | Minor | commands-emitter.ts | 48-79 | Non-namespaced `_meta` keys on commands |
| 7 | Minor | extensions.ts | 333-348 | pushStatus payload not namespaced |
| 8 | Nitpick | N/A | N/A | `bridge.ts` in scope doesn't exist |

---

## Positive Observations

- **Proper capability storage**: `clientCapabilities` is stored during `initialize` and available for downstream capability gating (agent.ts line 189).
- **Error categorization**: `toStopReason()` correctly differentiates refusals from internal errors (agent.ts lines 77-89), routing refusals to `stopReason: 'refusal'` and propagating other errors as JSON-RPC errors.
- **Cancellation handling**: `cancel()` correctly aborts the in-progress controller and the `prompt()` method returns `stopReason: 'cancelled'` when aborted (agent.ts lines 403-405, 431-434).
- **History replay in loadSession**: Correctly replays user/agent messages as `user_message_chunk`/`agent_message_chunk` notifications before returning (agent.ts lines 309-317).
- **Extension method routing**: `extMethod` correctly prefixes custom methods with `_goodvibes/` and returns `-32601` for unknown methods (agent.ts lines 534-537).
- **Session adapter teardown**: `unregister()` properly disposes all event subscriptions (session-adapter.ts lines 107-112).
