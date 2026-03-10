# ACP Compliance Review: Sessions (Wave 1, Agent 3)

**Scope:** `src/extensions/sessions/manager.ts`, `src/extensions/sessions/modes.ts`, `src/types/session.ts`, `src/extensions/acp/agent.ts` (loadSession), `src/extensions/acp/session-adapter.ts`
**KB References:** KB-03 (Sessions & Config), KB-04 (Prompt Turn)
**Reviewer:** Compliance Agent 3

---

## Issues

### 1. `session/load` ignores incoming `cwd` and `mcpServers` from request params
**Severity:** Critical 
**File:** `src/extensions/acp/agent.ts`, lines 279-331 
**KB Reference:** KB-03 — session/load params, Session Persistence and Resumption

The `loadSession()` method uses `context.config.mcpServers` (stored from original session) to reconnect MCP servers, ignoring `params.mcpServers` and `params.cwd` from the `LoadSessionRequest`. KB-03 explicitly states: "MCP server config can differ between original and resumed session. The Agent reconnects to whatever servers are provided in `session/load`." The SDK `LoadSessionRequest` type requires both `cwd` (string) and `mcpServers` (McpServer[]). The implementation should use the params from the load request, not the stored config.

### 2. `session/load` does not update session `cwd` on resume
**Severity:** Major 
**File:** `src/extensions/sessions/manager.ts`, lines 124-136 
**KB Reference:** KB-03 — session/load

The `SessionManager.load()` method retrieves stored context but provides no mechanism to update the session's `cwd` with the value from the `session/load` request. KB-03 states `cwd` is required in `session/load` and "Agent MUST use this as the session's working directory." The loaded session retains its original `cwd`, which may be stale or different from the client's current workspace.

### 3. `HistoryMessage` uses flat `content: string` instead of `ContentBlock`
**Severity:** Major 
**File:** `src/types/session.ts`, lines 94-101 
**KB Reference:** KB-03 — History replay during session/load

`HistoryMessage` stores content as a plain string, but ACP history replay emits `session/update` notifications with `ContentBlock` structure (`{ type: "text", text: "..." }`). The `loadSession()` implementation in agent.ts wraps the string into a ContentBlock at replay time (`{ type: 'text', text: msg.content }`), which works for text but loses any non-text content (images, resources) that may have been in the original message. The type should store `ContentBlock` or `ContentBlock[]` to preserve full fidelity.

### 4. No `session/load` response includes `modes` for legacy client compatibility
**Severity:** Minor 
**File:** `src/extensions/acp/agent.ts`, lines 325-331 
**KB Reference:** KB-03 — Legacy Modes API

KB-03 states: "For backwards compatibility, agents SHOULD send both `configOptions` and `modes` during the transition period." The `loadSession()` response returns `configOptions` but not `modes`. The `session/new` handler should be checked for the same issue. While `modes` is deprecated, the SHOULD-level requirement means it is expected during transition.

### 5. `SessionManager.destroy()` does not validate session state before deletion
**Severity:** Minor 
**File:** `src/extensions/sessions/manager.ts`, lines 146-151 
**KB Reference:** KB-04 — session/cancel protocol rules

The `destroy()` method unconditionally deletes session state without checking if the session is currently `active` (i.e., processing a prompt). If a session is destroyed while a prompt turn is in progress, there is no mechanism to ensure the agent sends the final `session/prompt` response with `stopReason: "cancelled"` before cleanup, as required by KB-04 rule 5.

### 6. `toSessionModeState()` was removed but legacy `modes` support is still needed
**Severity:** Minor 
**File:** `src/extensions/sessions/modes.ts` (removed function) 
**KB Reference:** KB-03 — Session Modes (Legacy API)

The `toSessionModeState()` function that converted mode configs into the ACP `modes` wire format was removed from `modes.ts`. While the function may have been unused, KB-03 states agents SHOULD provide `modes` alongside `configOptions` during the transition period. If the removal was intentional, there should be a replacement mechanism for building the legacy `modes` response shape.

### 7. `setConfigOption` accepts arbitrary keys without validation
**Severity:** Minor 
**File:** `src/extensions/sessions/manager.ts`, lines 292-322 
**KB Reference:** KB-03 — Config Options System

The `setConfigOption()` method accepts any `key` string and stores it without validating against known config option IDs. KB-03 defines `ConfigOptionType = "select"` as the only type, and config options have a fixed set of valid IDs (`mode`, `model`) with defined value constraints. Setting an unknown key silently succeeds. The method should validate that the `configId` matches a known config option and that the value is among the option's valid choices.

### 8. Session state machine lacks `error` handling state
**Severity:** Nitpick 
**File:** `src/extensions/sessions/manager.ts`, lines 40-45 
**KB Reference:** KB-04 — Stop Reasons

The `ALLOWED_TRANSITIONS` table handles `idle`, `active`, `cancelled`, and `completed` but has no `error` state. While ACP does not define explicit session states, the protocol's `stopReason` includes failure cases (`refusal`, `max_tokens`) that may warrant an error/failed session state for internal tracking. Currently, sessions that fail during a prompt turn remain in `active` state until explicitly transitioned.

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | `session/load` ignores incoming `mcpServers` | Critical | Open |
| 2 | `session/load` does not update `cwd` | Major | Open |
| 3 | `HistoryMessage` flat string vs ContentBlock | Major | Open |
| 4 | Missing legacy `modes` in load response | Minor | Open |
| 5 | `destroy()` without state validation | Minor | Open |
| 6 | `toSessionModeState()` removed prematurely | Minor | Open |
| 7 | `setConfigOption` lacks key/value validation | Minor | Open |
| 8 | No error state in session state machine | Nitpick | Open |

**Overall Compliance Score: 6.5/10**

The session layer handles the core lifecycle well — creation, state transitions (with proper validation), config options via `buildConfigOptions()`, and history replay. However, the Critical issue with `session/load` ignoring incoming MCP server and cwd params is a direct spec violation. The HistoryMessage type limitation means non-text content cannot survive session persistence. These issues collectively represent meaningful ACP compliance gaps that should be addressed before production use.
