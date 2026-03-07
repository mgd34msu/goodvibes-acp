# ACP Compliance Report

**Date**: 2026-03-07  
**Spec Reference**: ACP Protocol v1, TypeScript SDK v0.15.0  
**Knowledgebase Docs**: `docs/acp-knowledgebase/01-overview` through `10-implementation-guide`  
**Implementation Files**: `src/extensions/acp/{agent,config-adapter,errors,fs-bridge,terminal-bridge,index}.ts`

---

## Compliance Summary (Updated 2026-03-07)

- **Overall Coverage**: ~95-97% (up from ~90-95%)
- **Source files**: 107+ across 4 layers
- **Test coverage**: 1490+ tests, 61+ files, 0 failures
- **ESLint boundary enforcement**: Configured and passing

### Recently Resolved
- All 5 `_goodvibes/*` extension methods implemented
- `terminal/release` method added
- `agentCapabilities` expanded with promptCapabilities and mcpCapabilities
- Process mode detection (subprocess vs daemon)
- Runtime events (runtime:started, runtime:shutdown)
- Cross-plugin event types
- State persistence versioning utility
- ACP permission system implemented (PermissionGate with mode-based policies)
- Plan session updates implemented (PlanEmitter)
- Available commands implemented (CommandsEmitter)
- L0/L1 type alignment completed
- LLM provider + agent loop complete (ILLMProvider, AgentLoop, MockProvider, AnthropicProvider)
- Daemon mode + TCP transport implemented (DaemonManager, health endpoints)
- E2E integration tests added (wrfc-e2e.test.ts, wrfc-flow.test.ts, bootstrap.test.ts)
- MCP wiring in agent: McpBridge connected in newSession() and loadSession()

---

## Executive Summary

The GoodVibes ACP implementation covers the full protocol lifecycle (initialize, session management, prompt handling, cancellation, config options) with correct structure and patterns. MCP server integration is now wired: McpBridge, McpClient, and McpToolProxy exist and are connected in both newSession() and loadSession(). The primary remaining gap is ACP-level tool_call/tool_call_update emissions for MCP tool executions (WRFC phases already emit these; MCP-side still pending). The daemon mode (TCP transport + health endpoints) is fully implemented. LLM provider abstraction and agent loop are complete.

**Overall Compliance**: ~95-97% of the spec requirements are implemented. Foundation is solid; the only meaningful remaining gap is ACP tool_call visibility for MCP executions (Phase 7).

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
| `newSession()` connects MCP servers | PASS | Calls `mcpBridge.connectServers(params.mcpServers)` |
| `loadSession()` reconnects MCP servers | PASS | Calls `mcpBridge.connectServers()` with stored server config |

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
| `release()` implemented | PASS | Releases terminal handle |

### 1.10 Extension Methods (`08-extensibility.md`)

| Requirement | Status | Notes |
|---|---|---|
| `extMethod()` handles `_goodvibes/state` | PASS | Returns session context or runtime info |
| `extMethod()` handles `_goodvibes/agents` | PASS | Queries registry for spawner |
| `extMethod()` throws for unknown methods | PASS | Uses METHOD_NOT_FOUND code |
| `extNotification()` handles `_goodvibes/directive` | PASS | Emits to event bus |
| Unknown notifications silently ignored | PASS | Per ACP convention |

### 1.11 Permission System (`05-permissions.md`)

| Requirement | Status | Notes |
|---|---|---|
| `requestPermission()` options-based API | PASS | Adapted to SDK v0.15.0 options-based `requestPermission` API |
| Mode-based auto-approval policies | PASS | `MODE_POLICIES` defined for justvibes/vibecoding/plan/sandbox |
| `PermissionGate` class | PASS | `src/extensions/acp/permission-gate.ts` |
| justvibes mode: minimal auto-approve | PASS | Read-only ops auto-approved; write/exec require confirmation |
| vibecoding mode: broad auto-approve | PASS | Most ops auto-approved |
| plan mode: read-only auto-approve | PASS | Only read ops auto-approved |
| sandbox mode: all auto-approve | PASS | All ops auto-approved in sandbox |

### 1.12 MCP Integration (`06-tools-mcp.md`, `03-sessions.md`)

| Requirement | Status | Notes |
|---|---|---|
| Connect MCP servers during `session/new` | PASS | `mcpBridge.connectServers(params.mcpServers)` in `newSession()` |
| Reconnect MCP servers during `session/load` | PASS | Added in `loadSession()` via stored `context.mcpServers` |
| Graceful failure on individual server errors | PASS | `Promise.allSettled` in McpBridge.connectServers |
| McpBridge class implemented | PASS | `src/extensions/mcp/bridge.ts` |
| McpClient class implemented | PASS | `src/extensions/mcp/transport.ts` |
| McpToolProxy implements IToolProvider | PASS | `src/extensions/mcp/tool-proxy.ts` |
| Tool name namespacing (`{serverId}__{toolName}`) | PASS | Prevents cross-server collisions |
| Declare MCP capabilities in agentCapabilities | PASS | `mcpCapabilities: { http: false, sse: false }` (stdio only) |
| ACP tool_call/tool_call_update for MCP executions | PARTIAL | WRFC phases emit these; MCP-direct tool execution still pending |

---

## 2. Missing or Incomplete

### 2.1 LOW-MEDIUM — MCP Tool Call ACP Visibility

**Spec Refs**: `06-tools-mcp.md`, `10-implementation-guide.md` (Section 6)

**Status**: PARTIAL — McpBridge, McpClient, McpToolProxy all exist and are wired. MCP servers connect on `newSession()` and reconnect on `loadSession()`. However, when MCP tools are executed directly (outside the WRFC loop), `tool_call`/`tool_call_update` ACP session updates are not emitted.

The WRFC loop already emits these updates via `ToolCallEmitter`. A follow-on implementation should wrap `McpToolProxy.execute()` to emit matching ACP updates for direct MCP tool invocations.

**Priority**: LOW-MEDIUM — MCP tools that run inside WRFC phases are already covered by ToolCallEmitter. This only affects direct MCP tool executions outside the WRFC loop.

### 2.2 RESOLVED — `finish` Session Update

**Status**: RESOLVED — `finish` session update is now emitted on all three paths in `prompt()`:
- Success path: emits `{ sessionUpdate: 'finish', stopReason: 'end_turn' }`
- Cancel path: emits `{ sessionUpdate: 'finish', stopReason: 'cancelled' }`
- Error path: emits `{ sessionUpdate: 'finish', stopReason: 'end_turn' }` after streaming error message

### 2.3 RESOLVED — Incomplete `agentCapabilities` Declaration

**Status**: RESOLVED — `agentCapabilities` now declares both `mcpCapabilities` and `promptCapabilities`:
```typescript
agentCapabilities: {
  loadSession: true,
  mcpCapabilities: { http: false, sse: false },
  promptCapabilities: { embeddedContext: true, image: false, audio: false },
}
```

### 2.4 RESOLVED — Tool Call Updates Not Emitted by Agent

**Status**: RESOLVED — `ToolCallEmitter` class created in `src/extensions/acp/tool-call-emitter.ts` and wired into the WRFC adapter in `main.ts`. The agent now emits `tool_call` and `tool_call_update` session updates for each WRFC phase:
- `goodvibes_work` — pending → running → completed
- `goodvibes_review` — pending → running → completed (with `_meta` score)
- `goodvibes_fix` — pending → running → completed

### 2.5 MEDIUM — Session Update Type Name Discrepancies

**Spec Ref**: `04-prompt-turn.md`, `09-typescript-sdk.md`

The implementation uses `session_info_update` (agent.ts line 64):
```typescript
{ sessionUpdate: 'session_info_update' as const, title, updatedAt }
```

**Note (SDK v0.15.0 verified)**: `session_info_update` is the correct value used with `as const` cast. Verified against actual SDK types in `node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts`. The knowledgebase doc 04 example is illustrative; the SDK discriminated union uses `session_info_update`.

**Priority**: MEDIUM — Confirmed correct for SDK v0.15.0; monitor if SDK updates change this.

### 2.6 RESOLVED — Missing `_goodvibes/analytics` Extension Method

**Status**: RESOLVED — All 5 extension methods are now implemented in `src/extensions/acp/extensions.ts`:
- `_goodvibes/status` — runtime health, uptime, sessions, agents, plugins
- `_goodvibes/state` — full state snapshot
- `_goodvibes/events` — event history with filters (via EventRecorder)
- `_goodvibes/agents` — active agent list
- `_goodvibes/analytics` — token usage and budget data

### 2.7 RESOLVED — Missing `terminal/release` in Terminal Bridge

**Status**: RESOLVED — The `release()` method has been added to the `ITerminal` interface and `AcpTerminal` implementation.

### 2.8 RESOLVED — FS Bridge Capability Path Mismatch

**Status**: RESOLVED — SDK v0.15.0 verified: `ClientCapabilities.fs` is the correct property name (not `filesystem`). Checked against actual SDK types in `node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts`.

### 2.9 LOW — Config Option ID Naming Convention

**Spec Ref**: `03-sessions.md`, `10-implementation-guide.md` (Section 9)

The implementation uses dot-namespaced IDs:
```typescript
const CONFIG_ID_MODE = 'goodvibes.mode';
const CONFIG_ID_MODEL = 'goodvibes.model';
```

The implementation guide uses simple IDs (`id: 'mode'`, `id: 'model'`). The spec does not mandate a naming convention, but using `goodvibes.mode` means clients that hardcode `mode` won't match.

**Priority**: LOW — Functional but may confuse clients that expect standard IDs.

### 2.10 RESOLVED — No `plan` Session Update Emission

**Status**: RESOLVED — `PlanEmitter` class created in `src/extensions/acp/plan-emitter.ts` and wired into `agent.ts` `prompt()`.

### 2.11 RESOLVED — No `available_commands` Update

**Status**: RESOLVED — `CommandsEmitter` class created in `src/extensions/acp/commands-emitter.ts` and wired into `agent.ts` `newSession()`.

### 2.12 RESOLVED — `newSession` Uses `params.cwd` — CONFIRMED CORRECT

**Spec Ref**: `09-typescript-sdk.md`, `03-sessions.md`

**Status**: RESOLVED — Verified against actual SDK types. `NewSessionRequest` in `node_modules/@agentclientprotocol/sdk/dist/schema/types.gen.d.ts` (line 1452) declares:

```typescript
export type NewSessionRequest = {
  /** The working directory for this session. Must be an absolute path. */
  cwd: string;
  /** List of MCP (Model Context Protocol) servers the agent should connect to. */
  mcpServers: Array<McpServer>;
  // ...
};
```

`params.cwd` is the correct field name. `workspaceRoots` does not exist on `NewSessionRequest`. The implementation guide (Section 4) example using `workspaceRoots` was incorrect. Additionally, `mcpServers` is a **required** (non-optional) field on `NewSessionRequest`.

**Priority**: RESOLVED — No action needed.

---

## 3. What Needs Fixing

### Immediate Fixes (can do now)

1. ~~**Add `finish` session update** in `prompt()` before returning~~ — **DONE** (all paths)
2. ~~**Verify and fix capability paths** — `fs` vs `filesystem` in fs-bridge.ts~~ — **DONE** (`fs` confirmed correct)
3. ~~**Verify `session_info_update` vs `session_info`** type name against SDK~~ — **DONE** (`session_info_update` confirmed correct)
4. ~~**Verify `params.cwd` vs `params.workspaceRoots`** in newSession against SDK~~ — **DONE** (`params.cwd` confirmed correct)
5. ~~**Add `terminal.release()`** method to terminal bridge~~ — **DONE**
6. ~~**Expand `agentCapabilities`** in initialize response~~ — **DONE**

### Near-Term (requires new files)

7. ~~**Implement MCP connector** — wire `connectServers` into newSession/loadSession~~ — **DONE** (McpBridge wired in both)
8. **Implement MCP tool call ACP visibility** — emit `tool_call`/`tool_call_update` for direct MCP executions
9. ~~**Add `_goodvibes/analytics`** extension method~~ — **DONE**
10. ~~**Add `_goodvibes/status`** emission helper~~ — **DONE**

### Longer-Term (architecture work)

11. ~~**Expose tool call updates from WRFC**~~ — **DONE** (ToolCallEmitter wired in main.ts)
12. ~~**Add `plan` session updates** during WRFC phases~~ — **DONE** (PlanEmitter)
13. ~~**Add `available_commands`** for GoodVibes-specific commands~~ — **DONE** (CommandsEmitter)

---

## 4. Priority Recommendations

### Phase 1: SDK Type Alignment — COMPLETE
Verified all type assumptions against actual `@agentclientprotocol/sdk` v0.15.0 types:
- ~~`ClientCapabilities.fs` vs `filesystem`~~ — `fs` confirmed correct
- ~~`NewSessionRequest.cwd` vs `workspaceRoots`~~ — `cwd` confirmed correct; `workspaceRoots` does not exist
- ~~`SessionUpdate` discriminant values (`session_info` vs `session_info_update`)~~ — `session_info_update` confirmed correct
- ~~`PromptRequest.prompt` vs `messages`~~ — resolved
- ~~`ConfigOption` vs `SessionConfigOption` type names~~ — resolved
- ~~`mcpServers` on NewSessionRequest~~ — confirmed required (not optional), both `cwd` and `mcpServers` present

### Phase 2: Protocol Completeness — COMPLETE
1. ~~Add `finish` update emission~~ — **DONE** (all paths)
2. ~~Expand `agentCapabilities` declaration~~ — **DONE**
3. ~~Add `terminal.release()`~~ — **DONE**
4. ~~Add missing extension methods (`_goodvibes/analytics`, `_goodvibes/status`)~~ — **DONE**

### Phase 3: MCP Integration — MOSTLY COMPLETE
1. ~~**Implement MCP connector**~~ — **DONE** (McpBridge, McpClient, McpToolProxy all implemented)
2. ~~**Wire into `newSession()`**~~ — **DONE** (connectServers called with params.mcpServers)
3. ~~**Wire into `loadSession()`**~~ — **DONE** (reconnects from context.mcpServers)
4. ~~Implement tool call bridging with ACP updates~~ — **DONE** for WRFC phases (ToolCallEmitter); MCP-direct pending
5. ~~Declare `mcp` capabilities in initialize~~ — **DONE** (mcpCapabilities declared)

**Remaining**: ACP `tool_call`/`tool_call_update` emissions for direct MCP tool executions outside WRFC.

### Phase 4: WRFC Visibility — COMPLETE
1. ~~Emit `tool_call`/`tool_call_update` for WRFC phases~~ — **DONE** (ToolCallEmitter)
2. ~~Add `plan` session updates~~ — **DONE** (PlanEmitter)
3. ~~Emit `available_commands` on session start~~ — **DONE** (CommandsEmitter)

### Phase 5: LLM Provider + Agent Loop — COMPLETE
Per `docs/SUBAGENT-DESIGN.md` — resolves Open Question 1 (agent loop architecture):
1. ~~LLM provider abstraction (ILLMProvider interface)~~ — **DONE** (`src/plugins/agents/types.ts`)
2. ~~Anthropic SDK provider (AnthropicProvider)~~ — **DONE** (`src/plugins/agents/providers/anthropic.ts`)
3. ~~Mock provider for tests (MockProvider)~~ — **DONE** (`src/plugins/agents/providers/mock.ts`)
4. ~~Agent loop with streaming response handling (AgentLoop)~~ — **DONE** (`src/plugins/agents/loop.ts`)
5. ~~Tests: llm-anthropic-provider, llm-mock-provider, agent-loop~~ — **DONE**

### Phase 6: Daemon Mode — COMPLETE
TCP transport + health endpoints for long-running server mode:
1. ~~DaemonManager — TCP server lifecycle, PID file, port management~~ — **DONE** (`src/extensions/lifecycle/daemon.ts`)
2. ~~Health endpoints — /health, /health/ready, /health/live~~ — **DONE** (`src/extensions/lifecycle/health.ts`)
3. ~~IPC socket protocol — Unix domain socket for local control~~ — **DONE** (`src/extensions/ipc/socket.ts`)
4. ~~DaemonOptions.onConnection callback — bridges TCP socket to ACP transport~~ — **DONE**
5. ~~createConnection() helper in main.ts — shared wiring for subprocess + daemon modes~~ — **DONE**
6. ~~Tests: lifecycle-daemon, lifecycle-health, lifecycle-shutdown~~ — **DONE**

### Phase 7: MCP Tool Call ACP Visibility (Pending)
Emit `tool_call`/`tool_call_update` for direct MCP tool executions:
1. Wrap `McpToolProxy.execute()` to emit ACP session updates via AgentSideConnection
2. This requires threading the connection reference through the tool proxy or using the event bus
3. Affects: `src/extensions/mcp/tool-proxy.ts` and/or a new `McpToolCallEmitter`

**Priority**: LOW-MEDIUM — Only relevant for MCP tools executed outside the WRFC loop.

---

## 5. File Reference

| File | Lines | Status |
|---|---|---|
| `src/extensions/acp/agent.ts` | 460+ | Core agent — MCP wired (newSession + loadSession), all lifecycle complete |
| `src/extensions/acp/config-adapter.ts` | 128 | Config options — complete and correct |
| `src/extensions/acp/errors.ts` | 99 | Error codes — complete and correct |
| `src/extensions/acp/fs-bridge.ts` | 94 | FS bridge — capability path verified correct (`fs`) |
| `src/extensions/acp/terminal-bridge.ts` | 229 | Terminal bridge — release() method added |
| `src/extensions/acp/extensions.ts` | — | Extension methods — all 5 `_goodvibes/*` methods implemented |
| `src/extensions/acp/permission-gate.ts` | — | Permission system with mode-based auto-approval policies |
| `src/extensions/acp/plan-emitter.ts` | — | Plan session updates — WRFC phases mapped to plan entries |
| `src/extensions/acp/commands-emitter.ts` | — | Available commands — emitted on newSession() |
| `src/extensions/acp/tool-call-emitter.ts` | — | WRFC tool call updates — wired into WRFC adapter in main.ts |
| `src/extensions/acp/index.ts` | 18 | Barrel export — fine |
| `src/extensions/mcp/bridge.ts` | 231 | McpBridge — connects/disconnects MCP servers, aggregates tools |
| `src/extensions/mcp/transport.ts` | — | McpClient + createMcpStdioTransport — stdio transport |
| `src/extensions/mcp/tool-proxy.ts` | 133 | McpToolProxy — implements IToolProvider via McpBridge |
| `src/extensions/mcp/index.ts` | 14 | Barrel export |
| `src/extensions/lifecycle/daemon.ts` | 285 | DaemonManager — TCP server, health server, PID file |
| `src/extensions/lifecycle/health.ts` | 109 | HealthManager — /health, /health/ready, /health/live endpoints |
| `src/extensions/lifecycle/shutdown.ts` | — | ShutdownManager — graceful shutdown lifecycle |
| `src/extensions/ipc/socket.ts` | 241 | IPC socket — Unix domain socket protocol |
| `src/plugins/agents/types.ts` | — | ILLMProvider, LLMMessage, AgentConfig types (L0/L3) |
| `src/plugins/agents/providers/anthropic.ts` | — | AnthropicProvider — streams Anthropic API responses |
| `src/plugins/agents/providers/mock.ts` | — | MockProvider — deterministic test provider |
| `src/plugins/agents/loop.ts` | — | AgentLoop — tool execution + streaming response loop |
| `src/types/permissions.ts` | — | Permission types (L0 layer) |
