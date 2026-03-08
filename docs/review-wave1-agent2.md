# ACP Compliance Review: Agent & Bridge (Wave 1, Agent 2 — Iteration 3)

**Reviewer:** goodvibes:reviewer  
**Date:** 2026-03-07  
**Scope:** ACP Agent, Event Bridge, Emitters, Errors, Event Recorder, Extensions, Index  
**ACP Spec Reference:** https://agentclientprotocol.com/llms-full.txt  
**KB Files:** `01-overview.md`, `04-prompt-turn.md`

---

## Score: 7.8 / 10

## Issues Found: 7

---

### Issue 1

**Severity:** Major  
**File:** `src/extensions/acp/agent.ts`  
**Line:** 323  
**KB Topic:** session/update discriminators (04-prompt-turn.md, lines 385-418)  
**Description:** The `loadSession` method emits a config update with `sessionUpdate: 'config_option_update'` (singular). The ACP spec discriminator is `"config_options_update"` (plural "options"). This means clients following the spec will not recognize the update and will silently drop it, breaking config restoration on session load.  
**ACP Requirement:** The `sessionUpdate` discriminator for config option updates MUST be `"config_options_update"` (KB 04-prompt-turn.md line 396, TypeScript interface line 416).  
**Suggested Fix:** Change line 323 from `sessionUpdate: 'config_option_update'` to `sessionUpdate: 'config_options_update'`.

---

### Issue 2

**Severity:** Major  
**File:** `src/extensions/acp/agent.ts`  
**Line:** 196-202  
**KB Topic:** Protocol version negotiation (01-overview.md, lines 131-132, 195-203)  
**Description:** The `initialize` method rejects clients with a protocol version lower than the agent's supported version by throwing an error. The ACP spec's initialize flow does not prescribe rejecting lower versions outright. The agent should respond with its own supported version and let the client decide whether to proceed. Throwing a JSON-RPC error during initialize for a version mismatch prevents graceful degradation and breaks interoperability with older clients that may still be compatible.  
**ACP Requirement:** Initialize responds with the agent's chosen protocol version (01-overview.md line 131: "Agent -> Client: initialize response (chosen version, caps)"). The agent picks `Math.min(clientVersion, agentVersion)` — but should not reject if client < agent.  
**Suggested Fix:** Remove the version < SUPPORTED_VERSION guard (lines 197-202). The `Math.min` negotiation on line 203 already handles the case correctly — if the client sends version 1 and the agent supports version 1, they match. If a future agent supports version 2, it should still accept version 1 clients per the spec's forward-compatibility model.

---

### Issue 3

**Severity:** Minor  
**File:** `src/extensions/acp/commands-emitter.ts`  
**Line:** 113-116  
**KB Topic:** available_commands session update discriminator (04-prompt-turn.md, lines 319-354)  
**Description:** The code casts through `unknown` to emit `sessionUpdate: 'available_commands'` while the comment on line 109-112 acknowledges the SDK uses `'available_commands_update'`. The double-cast (`as unknown as acp.SessionUpdate`) completely bypasses TypeScript type-checking, hiding potential wire-format errors. If the SDK discriminator is actually the correct wire format, this sends the wrong discriminator to clients.  
**ACP Requirement:** The `sessionUpdate` discriminator for available commands must match what ACP clients expect. KB 04-prompt-turn.md line 329 shows `"available_commands"` in the JSON example but the TypeScript interface (line 344) uses `sessionUpdate: "available_commands"`. The spec and SDK may differ — the `as unknown` cast hides this problem rather than resolving it.  
**Suggested Fix:** Verify the actual wire format expected by ACP clients (check the SDK source for the `SessionUpdate` union discriminator). Use the SDK's discriminator value without casts, or file an issue if the SDK genuinely diverges from the spec.

---

### Issue 4

**Severity:** Minor  
**File:** `src/extensions/acp/agent.ts`  
**Line:** 71-102  
**KB Topic:** session_info session update (04-prompt-turn.md, lines 289-315)  
**Description:** The function `sessionInfoUpdate` on line 96-102 uses `sessionUpdate: 'session_info_update'` and constructs a `SessionInfoUpdate` with a `title` field. However, the ACP spec (04-prompt-turn.md line 310-314) defines `SessionInfoUpdate` with a `content: ContentBlock` field — not a `title` field. The spec uses `sessionUpdate: "session_info"` as the discriminator. There is a comment acknowledging the SDK delta, but the `title` field is not part of the spec's `SessionInfoUpdate` type.  
**ACP Requirement:** `session_info` update must carry `content: ContentBlock` (KB 04-prompt-turn.md lines 310-314).  
**Suggested Fix:** If the SDK genuinely uses `title` instead of `content`, document this prominently. Otherwise, change the payload to use `content: { type: 'text', text: title }` to match the spec.

---

### Issue 5

**Severity:** Minor  
**File:** `src/extensions/acp/agent.ts`  
**Line:** 346  
**KB Topic:** authenticate method return type (01-overview.md, lines 182-187)  
**Description:** The `authenticate` method returns `Promise<void>` but the ACP spec describes an authenticate response (01-overview.md line 136: "Agent -> Client: authenticate response"). Returning void means the JSON-RPC response will have `result: null` instead of a structured response object. While this works for a no-op auth implementation, it deviates from the expected response shape if clients expect a result object.  
**ACP Requirement:** The authenticate method should return a proper response object per the ACP SDK's `AuthenticateResponse` type.  
**Suggested Fix:** Return an empty object `{}` or a proper `AuthenticateResponse` shape rather than void, to ensure the JSON-RPC response has a well-formed `result` field.

---

### Issue 6

**Severity:** Minor  
**File:** `src/extensions/acp/extensions.ts`  
**Line:** 73-74  
**KB Topic:** Extension method error handling (01-overview.md, lines 96-105)  
**Description:** Unknown `_goodvibes/*` methods return `{ error: 'unknown_method', _meta: META }` as a successful response (HTTP 200 / JSON-RPC result). Per JSON-RPC 2.0 and the ACP spec, unknown methods should return a JSON-RPC error with code `-32601` (METHOD_NOT_FOUND), not a success response with an error field embedded in the result. The `agent.ts` `extMethod` correctly throws for non-`_goodvibes/` prefixed methods, but this catch-all in the extensions handler masks the error.  
**ACP Requirement:** JSON-RPC 2.0 requires unknown methods to return error responses (01-overview.md lines 96-105, error code -32601).  
**Suggested Fix:** Throw `Object.assign(new Error('Unknown extension method'), { code: -32601 })` instead of returning a result object.

---

### Issue 7

**Severity:** Nitpick  
**File:** `src/extensions/acp/agent.ts`  
**Line:** 328  
**KB Topic:** config_options_update completeness (04-prompt-turn.md, lines 385-418)  
**Description:** The `loadSession` method emits `configOptions` as a session update AND returns them in the response (lines 331-336). The spec says `config_options_update` contains "complete state, not delta" (KB 04-prompt-turn.md line 417). Emitting both the notification and returning in the response is redundant but not harmful — clients may process the config twice. This is a minor efficiency concern.  
**ACP Requirement:** Config options can be communicated via either the notification or the response — both is redundant but spec-compliant.  
**Suggested Fix:** Consider removing the notification emission (lines 320-329) since the response already carries `configOptions`. Alternatively, keep both for reliability but document the intentional redundancy.

---

## Summary

The ACP agent implementation is largely well-structured with good separation of concerns (emitters, bridge, extensions). The most significant compliance issues are:

1. **Wrong discriminator for config updates** (`config_option_update` vs spec's `config_options_update`) — this will cause silent failures on session load.
2. **Overly strict version negotiation** — rejecting lower protocol versions breaks forward compatibility.
3. **Multiple `as unknown` casts** hiding potential wire-format mismatches between SDK and spec.
4. **Returning success for unknown methods** instead of JSON-RPC errors in the extensions handler.

The error handling, tool call lifecycle management, plan emitter, and event recorder are well-implemented and comply with ACP conventions.
