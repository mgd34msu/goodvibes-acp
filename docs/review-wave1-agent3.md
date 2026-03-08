# Review Wave 1 — Agent 3: Sessions

**Reviewer:** goodvibes:reviewer  
**Score:** 7.5 / 10  
**Files Reviewed:** 5  
**Issues Found:** 7 (1 critical, 2 major, 4 minor)  
**Date:** 2026-03-07  
**Spec Source:** https://agentclientprotocol.com/llms-full.txt (fetched), ACP SDK v0.15.0 types.gen.d.ts

---

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 5 source files found on disk |
| Exports used | WARN | `toSessionModeState` exported from modes.ts but never imported anywhere |
| Import chain valid | PASS | All modules connected to entry points via barrel/agent.ts/main.ts |
| No placeholders | WARN | 2 TODOs: ISS-056 (history replay), ISS-033 (MCP cast) |
| Integration verified | PASS | SessionManager used by agent.ts and main.ts; SessionAdapter used by main.ts |

---

## Issues

### 1. CRITICAL — `setConfigOption` returns wrong `type` value for `SessionConfigOption`

**File:** `src/extensions/sessions/manager.ts:302`  
**KB Topic:** KB-03 Config Options System / KB-01 Session Config Options  
**Spec Reference:** SDK `SessionConfigOption = SessionConfigSelect & { type: "select" }` (types.gen.d.ts:2125-2126)

The `setConfigOption` method builds its return value with `type: 'text' as const` (line 302), but the ACP SDK type `SessionConfigOption` is an intersection that hardcodes `type: "select"`. The only valid value for `type` in the current ACP spec is `"select"`. Using `"text"` produces a response that does not match the wire format.

```typescript
// Current (line 298-305)
return Object.entries(updatedOptions).map(([id, currentValue]) => ({
  id,
  name: id,
  category: 'session',
  type: 'text' as const,  // <-- WRONG: SDK only accepts 'select'
  currentValue,
  options: [],
}));
```

**Fix:** Change `type: 'text' as const` to `type: 'select' as const`.

---

### 2. MAJOR — `setConfigOption` returns incomplete config state

**File:** `src/extensions/sessions/manager.ts:293-305`  
**KB Topic:** KB-03 Config Options System, "Setting a Config Option"  
**Spec Reference:** KB-03 lines 342-369: "Response -- always the complete config state (all options, not just the changed one)"

The ACP spec requires that the `set_config_option` response returns the **complete** set of config options with full metadata (name, description, category, options array). The current implementation builds a minimal representation with just `id`, `name: id`, `category: 'session'`, and empty `options: []`. This means the client loses all option metadata (display names, descriptions, available choices) after any config change.

The `buildConfigOptions()` function in `config-adapter.ts` already produces the correct full-fidelity response. The session manager should delegate to it rather than building its own minimal version.

**Fix:** Use `buildConfigOptions(currentMode, currentModel)` from config-adapter.ts instead of manually constructing the response, or pass the builder as a dependency to SessionManager.

---

### 3. MAJOR — `session/load` history replay not implemented

**File:** `src/extensions/acp/session-adapter.ts:93-100`  
**KB Topic:** KB-03 session/load, "Behavior During Load"  
**Spec Reference:** KB-03 line 106: "The Agent MUST replay the entire conversation history as session/update notifications before responding to the session/load request."

History replay during `session/load` is marked as TODO (ISS-056). The ACP spec uses MUST language: the agent MUST replay the entire conversation history as `session/update` notifications (`user_message_chunk`, `agent_message_chunk`) before sending the `session/load` response. Without this, clients resuming a session will see an empty conversation, breaking the session persistence contract.

This is documented with a clear implementation plan in the TODO comment, but remains unimplemented.

**Fix:** Implement history replay in the `loadSession` handler (agent.ts) or SessionAdapter. Iterate through stored `HistoryMessage[]`, emit `user_message_chunk`/`agent_message_chunk` session updates for each, then return the `session/load` response.

---

### 4. MINOR — `toSessionModeState` is dead code

**File:** `src/extensions/sessions/modes.ts:138-150`  
**KB Topic:** KB-03 Session Modes (Legacy API)  

`toSessionModeState` is exported from `modes.ts` but never imported or called anywhere in the codebase (confirmed by grep). It is also NOT re-exported from the barrel `src/extensions/sessions/index.ts`. This function generates the legacy `modes` shape for the `session/new` response, but the actual `session/new` handler in `agent.ts` uses `toSessionModeState` from... nowhere -- it uses `buildConfigOptions` from `config-adapter.ts` instead.

KB-03 line 403 says: "For backwards compatibility, agents SHOULD send both configOptions and modes during the transition period." If the legacy modes response is not being sent, this is a minor spec compliance gap.

**Fix:** Either (a) remove `toSessionModeState` as dead code if legacy modes support is intentionally omitted, or (b) import and use it in the `session/new` response to include the `modes` field alongside `configOptions` for backwards compatibility.

---

### 5. MINOR — `setState` lacks transition validation

**File:** `src/extensions/sessions/manager.ts:194-202`  
**KB Topic:** KB-03 Session state lifecycle  

`setState` allows any state transition without validation. For example, a session in `completed` state could be transitioned back to `idle`, or a `cancelled` session could move to `active`. While the ACP spec does not explicitly define a state machine, allowing arbitrary transitions risks inconsistent session state.

The `SessionState` type defines four states (`idle`, `active`, `cancelled`, `completed`) that imply a natural lifecycle: `idle -> active -> completed|cancelled`. Reverse transitions (e.g., `completed -> idle`) are likely bugs.

**Fix:** Add a transition validation map that defines allowed `from -> to` transitions and throws on invalid ones.

---

### 6. MINOR — Mode change does not emit dual `configOptions` + `modes` notification

**File:** `src/extensions/acp/session-adapter.ts:165-178`  
**KB Topic:** KB-03 Session Modes (Legacy API), "Mode <-> ConfigOption Mapping"  
**Spec Reference:** KB-03 line 403: "For backwards compatibility, agents SHOULD send both configOptions and modes during the transition period."

The `_onSessionModeChanged` handler emits only a `current_mode_update` notification (legacy modes). It does not also emit a `config_option_update` notification. Conversely, `_onSessionConfigChanged` emits only `config_option_update`. KB-03 recommends that during the transition period, agents SHOULD send both formats so that clients supporting either API receive updates.

**Fix:** When mode changes, emit both `current_mode_update` (with `currentModeId`) and `config_option_update` (with full `configOptions` array). Consider consolidating mode and config change handling.

---

### 7. MINOR — `setConfigOption` uses non-standard `category: 'session'`

**File:** `src/extensions/sessions/manager.ts:301`  
**KB Topic:** KB-03 Config Options System, "Standard Categories"  
**Spec Reference:** KB-03 lines 277-284, SDK `SessionConfigOptionCategory = "mode" | "model" | "thought_level" | string`

The manually constructed config options in `setConfigOption` use `category: 'session'`, which is not one of the standard ACP categories (`mode`, `model`, `thought_level`, or `_`-prefixed custom). While the type allows arbitrary strings, using a non-standard category without the `_` prefix may cause unexpected UI behavior in clients that key off category for layout/grouping.

This issue is moot if issue #2 is fixed (delegating to `buildConfigOptions`), since that function uses the correct categories.

**Fix:** Use standard categories (`mode`, `model`) or prefix custom categories with `_` (e.g., `_session`).

---

## Category Breakdown

| Category | Score | Deductions | Key Issues |
|----------|-------|------------|------------|
| Security | 10/10 | 0 | No security concerns in session management |
| Error Handling | 8/10 | -2.0 | `_safeSessionUpdate` swallows errors appropriately; no state transition validation |
| Testing | N/A | — | Tests not in review scope |
| Organization | 9/10 | -1.0 | Clean separation; dead code in modes.ts |
| Performance | 9/10 | -1.0 | History append copies full array each time (minor) |
| SOLID/DRY | 7/10 | -3.0 | `setConfigOption` duplicates config building vs config-adapter.ts |
| Naming | 9/10 | -1.0 | Non-standard category value |
| Maintainability | 8/10 | -2.0 | TODOs documented well; transition validation missing |
| Documentation | 9/10 | -1.0 | Good JSDoc; TODO comments are detailed |
| Dependencies | 10/10 | 0 | Clean layer separation |

---

## Recommendations

1. **Immediate (before merge):** Fix `type: 'text'` to `type: 'select'` in manager.ts:302 -- this is a type error that will produce invalid ACP responses.
2. **This PR:** Refactor `setConfigOption` to delegate to `buildConfigOptions()` for the response, eliminating the DRY violation and fixing issues #1, #2, and #7 simultaneously.
3. **Follow-up:** Implement session/load history replay (ISS-056) -- this is a MUST-level spec requirement.
4. **Follow-up:** Add state transition validation to `setState`.
5. **Follow-up:** Decide whether to support legacy `modes` API during transition period and either use or remove `toSessionModeState`.
