# ACP Compliance Report

**Date**: 2026-03-07  
**Spec Reference**: ACP Protocol v1, TypeScript SDK v0.15.0  
**Knowledgebase Docs**: `docs/acp-knowledgebase/01-overview` through `10-implementation-guide`  
**Implementation Files**: `src/extensions/acp/{agent,config-adapter,errors,fs-bridge,terminal-bridge,index}.ts`

---

## Executive Summary

The GoodVibes ACP implementation covers the core protocol lifecycle (initialize, session management, prompt handling, cancellation, config options) with correct structure and patterns. Several areas need attention: MCP server integration is absent, some session update type names diverge from the SDK's actual types, capability declarations are incomplete, and a few extension methods from the implementation guide are missing. The bridges (fs, terminal) are well-structured with proper capability gating.

**Overall Compliance**: ~65-70% of the spec requirements are implemented. The foundation is solid; the gaps are mostly in MCP integration, update type fidelity, and extension method completeness.

---

## 1. Correctly Implemented

### 1.1 Initialization (`02-initialization.md`)

| Requirement | Status | Notes |
|---|---|---|
| `initialize()` stores clientCapabilities | PASS | Line 96: `this._clientCapabilities = params.clientCapabilities ?? {}` |
| Returns `protocolVersion` using SDK constant | PASS | Uses `PROTOCOL_VERSION` from SDK |
| Returns `agentInfo` with name/version | PASS | `name: 'goodvibes', version: '0.1.0'` |
| Returns `agentCapabilities` | PASS | Declares `loadSession: true` |
| Handles missing clientCapabilities gracefully | PASS | Falls back to `{}` |

### 1.2 Authentication (`02-initialization.md`)

| Requirement | Status | Notes |
|---|---|---|
| `authenticate()` implemented as no-op | PASS | No auth required, returns void |

### 1.3 Session Lifecycle (`03-sessions.md`)

| Requirement | Status | Notes |
|---|---|---|
| `newSession()` creates session with UUID | PASS | Uses `crypto.randomUUID()` |
| Returns `sessionId` + `configOptions` | PASS | Delegates to `buildConfigOptions()` |
| `loadSession()` replays history as session/update | PASS | Iterates history, sends user/agent message chunks |
| `loadSession()` returns after history replay | PASS | Returns configOptions after replay loop |
| Session state tracked with AbortController | PASS | Per-session abort controllers in a Map |

### 1.4 Prompt Handling (`04-prompt-turn.md`)

| Requirement | Status | Notes |
|---|---|---|
| `prompt()` extracts text from content blocks | PASS | Filters for `type: 'text'` blocks |
| Records user message in history | PASS | Calls `sessions.addHistory()` |
| Delegates to WRFC runner | PASS | Calls `this.wrfc.run()` |
| Returns `stopReason: 'end_turn'` on success | PASS | |
| Returns `stopReason: 'cancelled'` on abort | PASS | Checks `controller.signal.aborted` in both try/catch |
| Streams error as agent_message_chunk | PASS | Catches errors, sends message, returns `end_turn` |
| Records assistant message in history | PASS | After WRFC completes |

### 1.5 Cancellation (`04-prompt-turn.md`)

| Requirement | Status | Notes |
|---|---|---|
| `cancel()` aborts active controller | PASS | `controller?.abort()` |
| Controller cleaned up in `finally` block | PASS | `_abortControllers.delete(sessionId)` |

### 1.6 Config Options (`03-sessions.md`)

| Requirement | Status | Notes |
|---|---|---|
| `buildConfigOptions()` returns mode + model selectors | PASS | Both with category, type, options |
| `setSessionConfigOption()` returns full config state | PASS | Re-reads state, builds complete options array |
| `setSessionMode()` delegates to session manager | PASS | Calls `sessions.setMode()` |
| Mode values: justvibes, vibecoding, sandbox, plan | PASS | 4 modes defined (spec has 3, plan is extra — acceptable) |
| Uses `category: 'mode'` and `category: 'model'` | PASS | Matches spec-reserved categories |
| `modeFromConfigValue()` with fallback | PASS | Falls back to `'justvibes'` for unknown values |

### 1.7 Error Handling (`02-initialization.md`, `10-implementation-guide.md`)

| Requirement | Status | Notes |
|---|---|---|
| Standard JSON-RPC error codes defined | PASS | -32700 through -32603 |
| Application-defined codes (-32000 to -32004) | PASS | SESSION_NOT_FOUND through AGENT_SPAWN_FAILED |
| `toAcpError()` maps errors to codes | PASS | Pattern matching on error messages |
| Stack traces hidden in production | PASS | Only in `development` env |
| `loadSession()` wraps errors with ACP codes | PASS | try/catch with `toAcpError()` |

### 1.8 File System Bridge (`07-filesystem-terminal.md`)

| Requirement | Status | Notes |
|---|---|---|
| Capability-gated ACP fs access | PASS | Checks `clientCapabilities.fs?.readTextFile` |
| Direct disk fallback when no capability | PASS | Uses `node:fs/promises` |
| Read returns file content | PASS | |
| Write creates parent directories | PASS | `mkdir(dirname(path), { recursive: true })` |
| Encoding validation | PASS | Whitelist of valid BufferEncodings |

### 1.9 Terminal Bridge (`07-filesystem-terminal.md`)

| Requirement | Status | Notes |
|---|---|---|
| Capability-gated ACP terminal access | PASS | Checks `clientCapabilities.terminal` |
| Direct spawn fallback | PASS | Uses `child_process.spawn` |
| `create()` returns handle with ID | PASS | Incremental IDs |
| `output()` returns buffered stdout | PASS | ACP or spawn-backed |
| `waitForExit()` returns exit code + output | PASS | Both paths implemented |
| `kill()` sends SIGTERM | PASS | ACP `.kill()` or process `.kill('SIGTERM')` |

### 1.10 Extension Methods (`08-extensibility.md`)

| Requirement | Status | Notes |
|---|---|---|
| `extMethod()` handles `_goodvibes/state` | PASS | Returns session context or runtime info |
| `extMethod()` handles `_goodvibes/agents` | PASS | Queries registry for spawner |
| `extMethod()` throws for unknown methods | PASS | Uses METHOD_NOT_FOUND code |
| `extNotification()` handles `_goodvibes/directive` | PASS | Emits to event bus |
| Unknown notifications silently ignored | PASS | Per ACP convention |

---

## 2. Missing or Incomplete

### 2.1 CRITICAL — MCP Server Integration

**Spec Refs**: `03-sessions.md`, `06-tools-mcp.md`, `10-implementation-guide.md` (Section 11)

**Status**: NOT IMPLEMENTED

The `newSession()` handler does not process `params.mcpServers`. The spec requires:
- Connecting to MCP servers during `session/new` (before returning)
- Declaring MCP transport capabilities in `agentCapabilities.mcp`
- Bridging MCP tool calls to ACP `tool_call`/`tool_call_update` notifications
- Graceful failure when individual MCP servers fail to connect
- MCP server reconnection during `session/load`

**Files needed**: `src/extensions/acp/mcp-connector.ts` (not yet created)

**Priority**: HIGH — MCP integration is a core ACP feature. Editors pass MCP servers and expect the agent to use them.

### 2.2 CRITICAL — `finish` Session Update

**Spec Ref**: `09-typescript-sdk.md` (SDK example, line 800-804), `10-implementation-guide.md` (Section 5)

The implementation guide shows that `prompt()` should emit a `finish` session update with `stopReason` before returning:
```typescript
await this.conn.sessionUpdate({
  sessionId,
  update: { sessionUpdate: 'finish', stopReason: 'end_turn' },
});
```

**Status**: NOT IMPLEMENTED in `agent.ts`. The `prompt()` method returns `{ stopReason: 'end_turn' }` but does NOT send a `finish` session update notification. Some clients may rely on the notification rather than the response to detect turn completion.

**Priority**: HIGH — Clients that listen for `finish` notifications will not know when the turn ends.

### 2.3 HIGH — Incomplete `agentCapabilities` Declaration

**Spec Ref**: `02-initialization.md`

Current declaration:
```typescript
agentCapabilities: { loadSession: true }
```

Missing capabilities that should be declared:
- `mcp: { http: boolean, sse: boolean }` — once MCP is implemented
- `promptCapabilities: { image: boolean, embeddedContext: boolean }` — if the agent handles these

The implementation guide (Section 4) shows declaring `mcp: { http: true, sse: false }`.

**Priority**: HIGH — Clients use capabilities to decide what they can send to the agent.

### 2.4 HIGH — Tool Call Updates Not Emitted by Agent

**Spec Ref**: `04-prompt-turn.md`, `06-tools-mcp.md`, `10-implementation-guide.md` (Section 6)

The `agent.ts` `prompt()` method delegates to `this.wrfc.run()` but does NOT emit `tool_call` or `tool_call_update` session updates. The implementation guide shows the agent should emit these during WRFC phases:
- `goodvibes_work` — pending → running → completed
- `goodvibes_review` — pending → running → completed (with `_meta` score)
- `goodvibes_fix` — pending → running → completed

**Status**: The `WRFCRunner` interface is abstracted, so tool call updates may be emitted by the WRFC implementation. However, the agent itself has no `updateToolCall()` helper and the WRFC runner interface does not carry the `conn` reference.

**Assessment**: UNCLEAR — depends on whether the WRFC runner emits updates. If it does not, this is a significant gap. The agent should at minimum emit `tool_call` updates for visibility.

**Priority**: HIGH — Tool call visibility is essential for ACP client UIs.

### 2.5 MEDIUM — Session Update Type Name Discrepancies

**Spec Ref**: `04-prompt-turn.md`, `09-typescript-sdk.md`

The implementation uses `session_info_update` (agent.ts line 59):
```typescript
{ sessionUpdate: 'session_info_update' as const, title, updatedAt }
```

The knowledgebase doc 04 defines the type as `session_info`:
```typescript
{ sessionUpdate: 'session_info', content: { type: 'text', text: '...' } }
```

The SDK v0.15 may use different type names. The `as const` cast suggests the type wasn't matching the SDK's discriminated union. This needs verification against the actual SDK types.

**Priority**: MEDIUM — May cause client-side rendering issues if the type name doesn't match.

### 2.6 MEDIUM — Missing `_goodvibes/analytics` Extension Method

**Spec Ref**: `08-extensibility.md`, `10-implementation-guide.md` (Section 10)

The implementation guide lists 6 extension methods. The implementation handles 3:
- `_goodvibes/state` — implemented
- `_goodvibes/agents` — implemented
- `_goodvibes/directive` — implemented (notification)

Missing:
- `_goodvibes/analytics` — query budget/token usage
- `_goodvibes/status` — emission during WRFC (notification, agent → client)
- `_goodvibes/events` — event bus stream (notification, agent → client)

**Priority**: MEDIUM — These provide observability. Not protocol-breaking but reduces client capabilities.

### 2.7 MEDIUM — Missing `terminal/release` in Terminal Bridge

**Spec Ref**: `07-filesystem-terminal.md`

The terminal bridge implements `create`, `output`, `waitForExit`, and `kill` but does NOT implement `release()`. The spec defines `terminal/release` as a method to free client-side terminal resources.

The `ITerminal` interface in the codebase may not require it, but the ACP spec does.

**Priority**: MEDIUM — Resource leak potential in long-running sessions.

### 2.8 MEDIUM — FS Bridge Capability Path Mismatch

**Spec Ref**: `07-filesystem-terminal.md`, `09-typescript-sdk.md`

The fs-bridge checks:
```typescript
this.clientCapabilities.fs?.readTextFile
this.clientCapabilities.fs?.writeTextFile
```

The SDK v0.15 `ClientCapabilities` type uses `filesystem` not `fs`:
```typescript
clientCapabilities.filesystem?.readTextFile
```

The knowledgebase docs 01/02 use `fs` while doc 09 (SDK reference) uses `filesystem`. The actual SDK type should be the source of truth.

**Status**: NEEDS VERIFICATION — If the SDK uses `filesystem`, the capability check will always be `false`, meaning the bridge always falls back to direct disk I/O.

**Priority**: MEDIUM-HIGH — If the capability path is wrong, ACP fs routing is completely broken.

### 2.9 LOW — Config Option ID Naming Convention

**Spec Ref**: `03-sessions.md`, `10-implementation-guide.md` (Section 9)

The implementation uses dot-namespaced IDs:
```typescript
const CONFIG_ID_MODE = 'goodvibes.mode';
const CONFIG_ID_MODEL = 'goodvibes.model';
```

The implementation guide uses simple IDs:
```typescript
id: 'mode'
id: 'model'
```

The spec does not mandate a naming convention for config option IDs, but using `goodvibes.mode` means clients that hardcode `mode` (as some do for the `category: 'mode'` pattern) won't match.

**Priority**: LOW — Functional but may confuse clients that expect standard IDs.

### 2.10 LOW — No `plan` Session Update Emission

**Spec Ref**: `04-prompt-turn.md`

The spec defines a `plan` session update type with structured entries (content, priority, status). The agent does not emit plan updates, even though the WRFC loop has well-defined phases that map naturally to plan entries.

**Priority**: LOW — Optional but improves client UX significantly.

### 2.11 LOW — No `available_commands` Update

**Spec Ref**: `04-prompt-turn.md`

The agent never emits `available_commands` session updates. These advertise slash commands or actions the client can invoke.

**Priority**: LOW — Optional feature.

### 2.12 LOW — `newSession` Uses `params.cwd` Instead of `params.workspaceRoots`

**Spec Ref**: `09-typescript-sdk.md`, `03-sessions.md`

The knowledgebase doc 03 uses `params.cwd` (from the protocol spec). The SDK v0.15 `NewSessionRequest` uses `params.workspaceRoots`. The implementation passes `params.cwd` which may not exist on the SDK type.

**Status**: NEEDS VERIFICATION against actual SDK types. The implementation guide (Section 4) uses `params.workspaceRoots?.[0]`.

**Priority**: LOW-MEDIUM — If the SDK doesn't have `cwd`, this will be `undefined`.

---

## 3. What Needs Fixing

### Immediate Fixes (can do now)

1. **Add `finish` session update** in `prompt()` before returning — both success and cancel paths
2. **Verify and fix capability paths** — `fs` vs `filesystem` in fs-bridge.ts based on actual SDK types
3. **Verify `session_info_update` vs `session_info`** type name against SDK
4. **Verify `params.cwd` vs `params.workspaceRoots`** in newSession against SDK
5. **Add `terminal.release()`** method to terminal bridge
6. **Expand `agentCapabilities`** in initialize response (at minimum add `promptCapabilities`)

### Near-Term (requires new files)

7. **Implement MCP connector** — `src/extensions/acp/mcp-connector.ts`
8. **Wire MCP into newSession/loadSession** — connect servers, collect tools
9. **Implement MCP tool call bridging** — tool_call/tool_call_update for MCP executions
10. **Add `_goodvibes/analytics`** extension method
11. **Add `_goodvibes/status`** emission helper

### Longer-Term (architecture work)

12. **Expose tool call updates from WRFC** — either pass `conn` to the runner or use event bus
13. **Add `plan` session updates** during WRFC phases
14. **Add `available_commands`** for GoodVibes-specific commands

---

## 4. Priority Recommendations

### Phase 1: SDK Type Alignment (1-2 hours)
Verify all type assumptions against actual `@agentclientprotocol/sdk` v0.15.0 types:
- `ClientCapabilities.fs` vs `filesystem`
- `NewSessionRequest.cwd` vs `workspaceRoots`
- `SessionUpdate` discriminant values (e.g., `session_info` vs `session_info_update`)
- `PromptRequest.prompt` vs `messages`
- `ConfigOption` vs `SessionConfigOption` type names

This is the highest-value work because type mismatches silently break functionality.

### Phase 2: Protocol Completeness (2-4 hours)
1. Add `finish` update emission
2. Expand `agentCapabilities` declaration
3. Add `terminal.release()`
4. Add missing extension methods (`_goodvibes/analytics`, `_goodvibes/status`)

### Phase 3: MCP Integration (4-8 hours)
1. Create `mcp-connector.ts`
2. Wire into `newSession()` and `loadSession()`
3. Implement tool call bridging with ACP updates
4. Declare `mcp` capabilities in initialize

### Phase 4: WRFC Visibility (2-4 hours)
1. Emit `tool_call`/`tool_call_update` for WRFC phases
2. Add `plan` session updates
3. Emit `_goodvibes/status` notifications during execution

---

## 5. File Reference

| File | Lines | Status |
|---|---|---|
| `src/extensions/acp/agent.ts` | 388 | Core agent — mostly complete, needs finish update + MCP |
| `src/extensions/acp/config-adapter.ts` | 128 | Config options — complete and correct |
| `src/extensions/acp/errors.ts` | 99 | Error codes — complete and correct |
| `src/extensions/acp/fs-bridge.ts` | 94 | FS bridge — needs capability path verification |
| `src/extensions/acp/terminal-bridge.ts` | 229 | Terminal bridge — needs release() method |
| `src/extensions/acp/index.ts` | 18 | Barrel export — fine |
| `src/extensions/acp/mcp-connector.ts` | N/A | NOT YET CREATED — needed for MCP integration |
