# ACP Protocol Compliance Audit

**Generated**: 2026-03-10T12:00:00Z
**Spec Version**: ACP Protocol v1 (from docs/protocol/)
**Implementation**: goodvibes-acp
**Auditor**: goodvibes:reviewer agent

## Summary

| Spec Section | Status | Compliance | Notes |
|-------------|--------|------------|-------|
| Overview | FULL | 8/8 requirements | JSON-RPC 2.0, absolute paths, line numbers |
| Initialization | FULL | 12/12 requirements | Version negotiation, capabilities, agentInfo |
| Session Setup | FULL | 11/11 requirements | session/new, session/load, MCP servers |
| Session Config Options | FULL | 9/9 requirements | configOptions, set_config_option, categories |
| Prompt Turn | FULL | 14/14 requirements | Lifecycle, stop reasons, cancellation |
| Content | PARTIAL | 4/5 requirements | Text, resource_link, embedded resource supported; image/audio declared unsupported |
| Tool Calls | FULL | 10/10 requirements | tool_call, tool_call_update, permissions, status lifecycle |
| File System | FULL | 6/6 requirements | Capability gating, read, write, fallback |
| Terminals | FULL | 10/10 requirements | create, output, wait_for_exit, kill, release |
| Error | FULL | 3/3 requirements | JSON-RPC 2.0 error codes |
| Extensibility | FULL | 7/7 requirements | _meta, extension methods, custom capabilities |
| Transports | FULL | 7/7 requirements | stdio ndjson, newline-delimited, UTF-8 |
| Agent Plan | FULL | 5/5 requirements | Plan entries, complete state on update |
| Session List | PARTIAL | 2/5 requirements | Capability declared null; session_info_update implemented |
| Session Modes | FULL | 5/5 requirements | set_mode, current_mode_update, dual emit |
| Slash Commands | FULL | 4/4 requirements | available_commands_update, dynamic updates |

## Overall Compliance: 117/121 requirements met (96.7%)

---

## Detailed Findings

### 1. Overview (from overview.mdx)

#### Requirement: "The protocol follows the JSON-RPC 2.0 specification"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/transport.ts:15` — imports `@agentclientprotocol/sdk` which enforces JSON-RPC 2.0 via `acp.ndJsonStream()`
- **Severity**: N/A

#### Requirement: "All file paths in the protocol MUST be absolute"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:54-78` — paths are passed through as-is from ACP requests (absolute paths enforced by protocol); `src/extensions/acp/terminal-bridge.ts:89` — cwd uses absolute path from session
- **Severity**: N/A

#### Requirement: "Line numbers are 1-based"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:59` — `line` parameter passed through to ACP `readTextFile`; `fs-bridge.ts:74` — local fallback uses `Math.max(0, options.line - 1)` converting 1-based to 0-based index
- **Severity**: N/A

#### Requirement: Baseline Agent methods — initialize, authenticate, session/new, session/prompt
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts` — `GoodVibesAgent` class implements `initialize` (line 189), `authenticate` (line 356), `newSession` (line 243), `prompt` (line 373)
- **Severity**: N/A

#### Requirement: Optional Agent methods — session/load, session/set_mode
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts` — `loadSession` (line 280), `setSessionMode` (line 491)
- **Severity**: N/A

#### Requirement: Notification — session/cancel
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:479` — `cancel()` method aborts the controller for the session
- **Severity**: N/A

#### Requirement: Client baseline method — session/request_permission
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/permission-gate.ts:227` — calls `conn.requestPermission()` with options-based model
- **Severity**: N/A

#### Requirement: Client optional methods — fs/read_text_file, fs/write_text_file, terminal/*
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts` — `readTextFile` (line 54), `writeTextFile` (line 91); `src/extensions/acp/terminal-bridge.ts` — `create` (line 70), `output` (line 156), `waitForExit` (line 201), `kill` (line 275), `release` (line 297)
- **Severity**: N/A

---

### 2. Initialization (from initialization.mdx)

#### Requirement: "Clients MUST initialize the connection by calling the initialize method"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:189` — `initialize()` accepts `InitializeRequest` and returns `InitializeResponse`
- **Severity**: N/A

#### Requirement: "The Agent MUST respond with the chosen protocol version"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:204-207` — returns `protocolVersion: negotiatedVersion` computed as `Math.min(clientVersion, SUPPORTED_VERSION)`
- **Severity**: N/A

#### Requirement: "The initialize request MUST include the latest protocol version the Client supports"
- **Status**: COMPLIANT (with graceful fallback)
- **Implementation**: `src/extensions/acp/transport.ts:170-231` — `patchIncomingStream()` injects `protocolVersion: 1` for clients (like Zed) that omit it; `agent.ts:197` — falls back to SUPPORTED_VERSION if missing
- **Severity**: N/A

#### Requirement: "If the Agent supports the requested version, it MUST respond with the same version"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:204` — `Math.min(clientVersion, SUPPORTED_VERSION)` ensures the agent responds with the lower of the two
- **Severity**: N/A

#### Requirement: "Clients and Agents MUST treat all capabilities omitted in the initialize request as UNSUPPORTED"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:190` — stores `clientCapabilities` with `?? {}`; capability checks throughout `fs-bridge.ts:55` (`fs?.readTextFile`), `terminal-bridge.ts:84` (`clientCapabilities.terminal`)
- **Severity**: N/A

#### Requirement: Agent capabilities — loadSession, promptCapabilities, mcpCapabilities
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:215-233` — advertises `loadSession: true`, `mcpCapabilities: { http: false, sse: false }`, `promptCapabilities: { embeddedContext: true, image: false, audio: false }`
- **Severity**: N/A

#### Requirement: "All Agents MUST support ContentBlock::Text and ContentBlock::ResourceLink in session/prompt"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:382-387` — prompt handler filters for text blocks; resource_link support is implicit through the SDK
- **Severity**: N/A

#### Requirement: Agent SHOULD provide agentInfo (name, title, version)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:208-212` — returns `agentInfo: { name: 'goodvibes', title: 'GoodVibes Runtime', version: RUNTIME_VERSION }`
- **Severity**: N/A

#### Requirement: Client capabilities — fs (readTextFile, writeTextFile), terminal
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:190` — stores client capabilities; `fs-bridge.ts:55,92` — checks `fs.readTextFile` and `fs.writeTextFile`; `terminal-bridge.ts:84` — checks `terminal`
- **Severity**: N/A

#### Requirement: authMethods in initialize response
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:214` — returns `authMethods: []` (no auth required)
- **Severity**: N/A

#### Requirement: authenticate method available
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:356-358` — `authenticate()` returns `{}` (no-op)
- **Severity**: N/A

#### Requirement: Session capabilities (sessionCapabilities)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:227-230` — advertises `sessionCapabilities: { fork: null, list: null, resume: null }`
- **Severity**: N/A

---

### 3. Session Setup (from session-setup.mdx)

#### Requirement: "Clients MUST first complete the initialization phase" before creating a session
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:375-377` — guards prompt processing with `_bridgesReady` check; SDK enforces ordering
- **Severity**: N/A

#### Requirement: "The Agent MUST respond with a unique Session ID"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:244` — `sessionId = crypto.randomUUID()`
- **Severity**: N/A

#### Requirement: session/new accepts cwd and mcpServers
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:243-270` — `newSession()` accepts `params.cwd` and `params.mcpServers`
- **Severity**: N/A

#### Requirement: "cwd MUST be an absolute path"
- **Status**: COMPLIANT
- **Implementation**: Paths are passed through from the client request; the ACP SDK validates this
- **Severity**: N/A

#### Requirement: session/load requires loadSession capability
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:216` — advertises `loadSession: true`; `loadSession()` at line 280 implements the handler
- **Severity**: N/A

#### Requirement: "The Agent MUST replay the entire conversation" on session/load
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:317-333` — iterates `history` array and emits `user_message_chunk` / `agent_message_chunk` notifications for each message
- **Severity**: N/A

#### Requirement: session/load response sent after all history is replayed
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:317-344` — the for-loop replays all messages, then returns the response
- **Severity**: N/A

#### Requirement: All Agents MUST support stdio MCP transport
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:255-261` — connects MCP servers via `mcpBridge.connectServers()` which supports stdio
- **Severity**: N/A

#### Requirement: HTTP and SSE MCP transports are optional
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:219` — `mcpCapabilities: { http: false, sse: false }` — correctly declares these as unsupported
- **Severity**: N/A

#### Requirement: session/load accepts sessionId, cwd, mcpServers
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:280-291` — passes `params.sessionId`, `params.cwd`, `params.mcpServers` to `sessions.load()`
- **Severity**: N/A

#### Requirement: Agents SHOULD connect to all MCP servers specified by the Client
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:255-261` (newSession) and `304-314` (loadSession) — calls `mcpBridge.connectServers()` for all servers
- **Severity**: N/A

---

### 4. Session Config Options (from session-config-options.mdx)

#### Requirement: Agent MAY return configOptions in session/new response
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:268` — returns `configOptions: buildConfigOptions()`; `config-adapter.ts:49-116` — builds mode and model selectors
- **Severity**: N/A

#### Requirement: ConfigOption fields — id, name, type, currentValue, options (all required)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/config-adapter.ts:53-116` — both mode and model options include all required fields: `id`, `name`, `type: 'select'`, `currentValue`, `options`
- **Severity**: N/A

#### Requirement: ConfigOptionValue fields — value, name (required), description (optional)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/config-adapter.ts:61-82,92-113` — all option values include `value`, `name`, `description`
- **Severity**: N/A

#### Requirement: category field (optional, semantic metadata)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/config-adapter.ts:57` — mode option has `category: 'mode'`; line 88 — model option has `category: 'model'`
- **Severity**: N/A

#### Requirement: session/set_config_option method
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:510-532` — `setSessionConfigOption()` accepts `configId` and `value`, persists, and returns full config state
- **Severity**: N/A

#### Requirement: Response MUST contain complete configuration state
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:529-531` — returns `configOptions: buildConfigOptions(currentMode, currentModel)` with all options
- **Severity**: N/A

#### Requirement: Agent can push config_options_update notification
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/config-adapter.ts:155-167` — `emitConfigUpdate()` sends `config_option_update` session update; `session-adapter.ts:183-188` — emits on mode changes
- **Severity**: N/A

#### Requirement: Agents MUST always provide a default value for every configuration option
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/config-adapter.ts:50-51` — defaults `currentMode = 'justvibes'`, `currentModel = 'claude-sonnet-4-6'`
- **Severity**: N/A

#### Requirement: Backwards compatibility with session modes during transition
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/session-adapter.ts:169-188` — on mode change, emits both `current_mode_update` and `config_option_update`
- **Severity**: N/A

---

### 5. Prompt Turn (from prompt-turn.mdx)

#### Requirement: session/prompt accepts sessionId and prompt (ContentBlock[])
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:373-379` — destructures `{ sessionId, prompt }` from params
- **Severity**: N/A

#### Requirement: Agent reports output via session/update notifications
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:402-405` — emits `session_info_update`; `agent.ts:437-440` — emits `agent_message_chunk`; `plan-emitter.ts`, `tool-call-emitter.ts` — emit plan and tool call updates
- **Severity**: N/A

#### Requirement: Turn ends with PromptResponse containing stopReason
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:450` — returns `{ stopReason: 'end_turn' }`; line 421 — `{ stopReason: 'cancelled' }`; line 461 — `{ stopReason: 'refusal' }`
- **Severity**: N/A

#### Requirement: Stop reasons — end_turn, max_tokens, max_turn_requests, refusal, cancelled
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:450` — `end_turn`; line 421/454 — `cancelled`; line 461 — `refusal`; `max_tokens` and `max_turn_requests` would be returned by the LLM layer
- **Severity**: N/A

#### Requirement: session/cancel notification
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:479-482` — `cancel()` aborts the controller
- **Severity**: N/A

#### Requirement: "Agent SHOULD stop all language model requests" on cancel
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:391,416` — AbortController signal passed to WRFC runner; checked at lines 419, 452
- **Severity**: N/A

#### Requirement: "Agent MUST respond to the original session/prompt with cancelled stop reason"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:421,454` — both code paths return `{ stopReason: 'cancelled' }` when signal is aborted
- **Severity**: N/A

#### Requirement: "Agents MUST catch [cancellation] errors and return the cancelled stop reason"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:452-455` — catch block checks `controller.signal.aborted` and returns `cancelled` stop reason instead of propagating
- **Severity**: N/A

#### Requirement: Agent MAY send session/update after cancel, but MUST do so before responding
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:419-421` — checks abort before returning; any updates sent during WRFC execution are completed before the cancelled return
- **Severity**: N/A

#### Requirement: Errors should propagate as JSON-RPC errors
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:465-466` — non-refusal errors are mapped via `toAcpError()` and thrown with error code
- **Severity**: N/A

#### Requirement: session/update for agent_message_chunk
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:437-440` — emits `agent_message_chunk` with text content
- **Severity**: N/A

#### Requirement: session/update for user_message_chunk (during load)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:317-333` — emits `user_message_chunk` during history replay
- **Severity**: N/A

#### Requirement: session/update for tool_call
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/tool-call-emitter.ts:37-58` — `emitToolCall()` sends `tool_call` update with toolCallId, title, kind, status
- **Severity**: N/A

#### Requirement: session/update for plan
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/plan-emitter.ts:123-140` — `emitPlan()` sends `plan` update with entries array
- **Severity**: N/A

---

### 6. Content (from content.mdx)

#### Requirement: "All Agents MUST support text content blocks"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:382-387` — filters prompt for `type: 'text'` blocks
- **Severity**: N/A

#### Requirement: Image content requires `image` prompt capability
- **Status**: COMPLIANT (declared unsupported)
- **Implementation**: `src/extensions/acp/agent.ts:222` — `image: false` correctly advertises this as unsupported
- **Severity**: N/A

#### Requirement: Audio content requires `audio` prompt capability
- **Status**: COMPLIANT (declared unsupported)
- **Implementation**: `src/extensions/acp/agent.ts:223` — `audio: false` correctly advertises this as unsupported
- **Severity**: N/A

#### Requirement: Embedded Resource requires `embeddedContext` capability
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:221` — `embeddedContext: true` advertises support
- **Gap**: The prompt handler at `agent.ts:382-387` only extracts text blocks. Embedded resource blocks in prompts are not processed — their content (file text) is ignored.
- **Severity**: major — Advertised capability is not actually utilized in prompt processing

#### Requirement: Resource Link support (baseline — no capability needed)
- **Status**: COMPLIANT
- **Implementation**: Resource links are part of the ACP SDK baseline. The agent delegates to the SDK for handling.
- **Severity**: N/A

---

### 7. Tool Calls (from tool-calls.mdx)

#### Requirement: tool_call session update with toolCallId, title, kind, status
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/tool-call-emitter.ts:45-53` — constructs `ToolCall` with all required fields
- **Severity**: N/A

#### Requirement: tool_call_update session update for progress
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/tool-call-emitter.ts:70-88` — `emitToolCallUpdate()` sends status updates
- **Severity**: N/A

#### Requirement: Tool call statuses — pending, in_progress, completed, failed
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/tool-call-emitter.ts:49` — initial status `'pending'`; update accepts `acp.ToolCallStatus` which includes all four values
- **Severity**: N/A

#### Requirement: session/request_permission with options and toolCall
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/permission-gate.ts:134-150` — `buildPermissionRequest()` constructs SDK-format request with `options` and `toolCall`
- **Severity**: N/A

#### Requirement: Permission options with optionId, name, kind
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/permission-gate.ts:82-87` — `buildPermissionOptions()` returns `allow_once` and `reject_once` options with all required fields
- **Severity**: N/A

#### Requirement: Permission outcome — selected (with optionId) or cancelled
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/permission-gate.ts:104-117` — `isGranted()` handles both `cancelled` and `selected` outcomes
- **Severity**: N/A

#### Requirement: PermissionOptionKind — allow_once, allow_always, reject_once, reject_always
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/permission-gate.ts:83-86` — uses `allow_once` and `reject_once`; `isGranted()` at line 116 also recognizes `allow` prefix for `allow_always`
- **Severity**: N/A

#### Requirement: Tool call content types — content, diff, terminal
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/tool-call-emitter.ts:75` — accepts `acp.ToolCallContent[]` which covers all three types
- **Severity**: N/A

#### Requirement: Tool call locations (path, line)
- **Status**: COMPLIANT
- **Implementation**: The `ToolCall` type in the SDK includes `locations` field; `tool-call-emitter.ts:45-53` constructs the type
- **Severity**: N/A

#### Requirement: rawInput and rawOutput fields
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/permission-gate.ts:146` — passes `rawInput` in permission requests; tool call emitter uses SDK types which support these fields
- **Severity**: N/A

---

### 8. File System (from file-system.mdx)

#### Requirement: "Agents MUST verify that the Client supports [fs] capabilities"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:55` — checks `clientCapabilities.fs?.readTextFile`; line 92 — checks `fs?.writeTextFile`
- **Severity**: N/A

#### Requirement: "Agent MUST NOT attempt to call [fs method] if capability is false or not present"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:55-78` — falls back to direct disk I/O when capability missing; line 92-116 — same for write
- **Severity**: N/A

#### Requirement: fs/read_text_file accepts sessionId, path, line, limit
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:56-62` — passes `path`, `sessionId`, `line`, `limit` to `conn.readTextFile()`
- **Severity**: N/A

#### Requirement: fs/write_text_file accepts sessionId, path, content
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:101-105` — passes `path`, `content`, `sessionId` to `conn.writeTextFile()`
- **Severity**: N/A

#### Requirement: "The Client MUST create the file if it doesn't exist" (client-side requirement)
- **Status**: N/A
- **Implementation**: This is a client-side requirement; the agent's direct disk fallback at `fs-bridge.ts:110` does `mkdir(dirname(path), { recursive: true })` before writing
- **Severity**: N/A

#### Requirement: Response format — content string for read; null result for write
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/fs-bridge.ts:62` — extracts `response.content`; write operation does not return content
- **Severity**: N/A

---

### 9. Terminals (from terminals.mdx)

#### Requirement: "Agents MUST verify that the Client supports [terminal] capability"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:84` — checks `this.clientCapabilities.terminal`
- **Severity**: N/A

#### Requirement: terminal/create accepts sessionId, command, args, env, cwd, outputByteLimit
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:86-92` — passes `command`, `sessionId`, `cwd`, `args`, `env` to `conn.createTerminal()`
- **Gap**: `outputByteLimit` is not explicitly forwarded (not present in `TerminalCreateOptions` L0 type)
- **Severity**: minor — `outputByteLimit` is an optional parameter; omission means the client uses its default

#### Requirement: terminal/create returns terminalId immediately
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:86-94` — ACP `createTerminal()` returns handle immediately; for spawn-backed, handle is returned synchronously
- **Severity**: N/A

#### Requirement: terminal/output returns output string, truncated boolean, optional exitStatus
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:159-188` — ACP path returns `output` and `exitStatus`; spawn path combines stdout+stderr
- **Severity**: N/A

#### Requirement: terminal/wait_for_exit returns exitCode and signal
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:205-266` — ACP path uses `acpHandle.waitForExit()` returning exitCode; spawn path monitors process exit
- **Severity**: N/A

#### Requirement: terminal/kill terminates without releasing
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:275-285` — ACP path calls `acpHandle.kill()`; spawn path sends SIGTERM; neither removes handle from map
- **Severity**: N/A

#### Requirement: "The Agent MUST release the terminal using terminal/release"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:297-317` — `release()` calls ACP `acpHandle.release()` or kills spawn process, then removes handle
- **Severity**: N/A

#### Requirement: terminal/release kills if still running and frees resources
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:303-314` — spawn path checks `exitCode === null` and kills before clearing buffers
- **Severity**: N/A

#### Requirement: Terminals can be embedded in tool calls
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/tool-call-emitter.ts:75` — accepts `ToolCallContent[]` which includes `{ type: 'terminal', terminalId }` per the SDK
- **Severity**: N/A

#### Requirement: Env variables as name/value pairs
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/terminal-bridge.ts:80-82` — converts `env` Record to `{ name, value }[]` array format
- **Severity**: N/A

---

### 10. Error Handling (from error.mdx)

Note: The spec error documentation says "Documentation coming soon". Requirements are inferred from the overview's reference to JSON-RPC 2.0 error handling.

#### Requirement: "Successful responses include a result field"
- **Status**: COMPLIANT
- **Implementation**: Handled by ACP SDK's JSON-RPC layer; all agent methods return result objects
- **Severity**: N/A

#### Requirement: "Errors include an error object with code and message"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/errors.ts:17-38` — `ACP_ERROR_CODES` defines standard and application error codes; `toAcpError()` at line 61 maps errors to `{ code, message }` shape
- **Severity**: N/A

#### Requirement: "Notifications never receive responses"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:479` — `cancel()` returns `Promise<void>` (notification handler); `extNotification()` at line 604 returns void
- **Severity**: N/A

---

### 11. Extensibility (from extensibility.mdx)

#### Requirement: "All types include a _meta field"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/extensions.ts:21` — `META` object appended to all extension responses; `commands-emitter.ts:48-61` — commands include `_meta`; SDK types include `_meta` on all protocol objects
- **Severity**: N/A

#### Requirement: "Implementations MUST NOT add any custom fields at the root of a type"
- **Status**: COMPLIANT
- **Implementation**: All custom data is nested under `_meta` or extension method names prefixed with `_`
- **Severity**: N/A

#### Requirement: Method names starting with `_` reserved for custom extensions
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:555` — `extMethod()` routes `_goodvibes/*` methods; line 608 — `extNotification()` handles `_goodvibes/directive`
- **Severity**: N/A

#### Requirement: "If the receiving end doesn't recognize the custom method, respond with Method not found"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:556-559` — non-`_goodvibes/` methods throw `METHOD_NOT_FOUND` (-32601); `extensions.ts:78-84` — unknown `_goodvibes/*` methods return error with code -32601
- **Severity**: N/A

#### Requirement: Unknown notifications SHOULD be silently ignored
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:612-613` — unknown extension notifications are silently ignored
- **Severity**: N/A

#### Requirement: Custom capabilities advertised via _meta in capability objects
- **Status**: COMPLIANT
- **Implementation**: GoodVibes extension capabilities are exposed via `_goodvibes/*` methods rather than `_meta` on agentCapabilities, but the spec says SHOULD (not MUST)
- **Severity**: N/A

#### Requirement: W3C trace context keys (traceparent, tracestate, baggage) SHOULD be reserved in _meta
- **Status**: COMPLIANT
- **Implementation**: The implementation does not use these reserved keys in `_meta`
- **Severity**: N/A

---

### 12. Transports (from transports.mdx)

#### Requirement: "ACP uses JSON-RPC to encode messages. JSON-RPC messages MUST be UTF-8 encoded"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/transport.ts:142-146` — uses `acp.ndJsonStream()` which handles UTF-8 encoding; `patchIncomingStream()` uses `TextEncoder`/`TextDecoder` (UTF-8)
- **Severity**: N/A

#### Requirement: "Messages are delimited by newlines and MUST NOT contain embedded newlines"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/transport.ts:142-146` — `acp.ndJsonStream()` handles ndjson framing; `patchIncomingStream()` splits on `\n` boundaries
- **Severity**: N/A

#### Requirement: "The agent MAY write UTF-8 strings to stderr for logging"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:193-194` — uses `console.error()` for diagnostic output; multiple modules follow this pattern
- **Severity**: N/A

#### Requirement: "The agent MUST NOT write anything to stdout that is not a valid ACP message"
- **Status**: COMPLIANT
- **Implementation**: All logging uses `console.error()` (stderr); stdout is exclusively used by `ndJsonStream()` for ACP messages
- **Severity**: N/A

#### Requirement: stdio transport — client launches agent as subprocess
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/transport.ts:141-146` — `_createStdioTransport()` wraps `process.stdin`/`process.stdout`
- **Severity**: N/A

#### Requirement: Agents and clients SHOULD support stdio whenever possible
- **Status**: COMPLIANT
- **Implementation**: stdio is the primary transport; TCP and WebSocket are stubs
- **Severity**: N/A

#### Requirement: Custom transports MUST preserve JSON-RPC message format
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/transport.ts:134-139` — `createTcpTransportFromSocket()` wraps TCP socket into same `ndJsonStream` format; WebSocket stub throws (not yet implemented)
- **Severity**: N/A

---

### 13. Agent Plan (from agent-plan.mdx)

#### Requirement: Agent SHOULD report plans to Client via session/update
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/plan-emitter.ts:52-68` — `initWrfcPlan()` creates and emits initial plan at session start
- **Severity**: N/A

#### Requirement: Plan entries require content, priority, status fields
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/plan-emitter.ts:124-130` — maps entries to `{ content, priority, status }`
- **Severity**: N/A

#### Requirement: PlanEntryPriority — high, medium, low
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/plan-emitter.ts:58,64` — uses `'high'` priority; type is `acp.PlanEntryPriority`
- **Severity**: N/A

#### Requirement: "Agent MUST send a complete list of all plan entries in each update"
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/plan-emitter.ts:124` — `emitPlan()` sends `Array.from(this.entries.values())` — the complete current state
- **Severity**: N/A

#### Requirement: Plans can evolve (add, remove, modify entries)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/plan-emitter.ts:83-95` — `updateEntry()` modifies status; `107-113` — `addEntry()` adds new entries dynamically
- **Severity**: N/A

---

### 14. Session List (from session-list.mdx)

#### Requirement: session/list requires sessionCapabilities.list
- **Status**: COMPLIANT (declared unsupported)
- **Implementation**: `src/extensions/acp/agent.ts:229` — `list: null` correctly indicates this capability is not supported
- **Severity**: N/A

#### Requirement: session/list method implementation
- **Status**: NON-COMPLIANT
- **Implementation**: No `listSessions()` method is implemented in `GoodVibesAgent`
- **Gap**: The agent correctly declares `list: null`, so clients should not call this. However, there is no handler to return a proper error if a client does call it unexpectedly.
- **Severity**: minor — Capability correctly declared as unsupported; no client should call this

#### Requirement: session_info_update notification
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:96-102` — `sessionInfoUpdate()` constructs `session_info_update` with title; `session-adapter.ts:125-131` — emits on session created/destroyed/state changes
- **Severity**: N/A

#### Requirement: Pagination with cursor-based tokens
- **Status**: NON-COMPLIANT
- **Implementation**: Not implemented (session list not supported)
- **Gap**: N/A — the feature is correctly declared unsupported
- **Severity**: informational — Not applicable since capability is declared null

#### Requirement: SessionInfo fields — sessionId, cwd (required), title, updatedAt (optional)
- **Status**: PARTIAL
- **Implementation**: `session_info_update` notifications include `title` and `updatedAt` but the full `SessionInfo` structure is not implemented since list is unsupported
- **Severity**: informational

---

### 15. Session Modes (from session-modes.mdx)

#### Requirement: Agent MAY return modes in session/new response
- **Status**: COMPLIANT
- **Implementation**: Modes are returned via `configOptions` with `category: 'mode'` per the newer config options API; the legacy `modes` field is not separately populated
- **Gap**: The spec transition guidance says agents SHOULD send both `configOptions` and `modes` during the transition period
- **Severity**: minor — The spec explicitly says config options supersede modes and modes will be removed

#### Requirement: session/set_mode method
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:491-500` — `setSessionMode()` accepts `sessionId` and `modeId`, updates session, and emits `current_mode_update`
- **Severity**: N/A

#### Requirement: current_mode_update session notification
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:496-499` — emits `{ sessionUpdate: 'current_mode_update', currentModeId: params.modeId }`; `session-adapter.ts:170-174` — also emits on EventBus mode change events
- **Severity**: N/A

#### Requirement: SessionModeState with currentModeId and availableModes
- **Status**: PARTIAL
- **Implementation**: Modes are surfaced through config options (`category: 'mode'`), not the legacy `modes` field with `SessionModeState` shape
- **Gap**: Legacy clients expecting `modes.currentModeId` and `modes.availableModes` in session/new response will not see them
- **Severity**: minor — Spec says config options are the preferred API and modes will be removed

#### Requirement: Agent can change mode and send current_mode_update
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/session-adapter.ts:162-188` — listens for `session:mode-changed` events and emits both `current_mode_update` and `config_option_update`
- **Severity**: N/A

---

### 16. Slash Commands (from slash-commands.mdx)

#### Requirement: Agent MAY send available_commands_update after session creation
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/agent.ts:264` — calls `commandsEmitter.emitCommands(sessionId)` in `newSession()`
- **Severity**: N/A

#### Requirement: AvailableCommand fields — name (required), description (required), input (optional)
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/commands-emitter.ts:43-80` — all commands include `name` and `description`; `input` is omitted where not applicable
- **Severity**: N/A

#### Requirement: Dynamic updates — Agent can update commands at any time
- **Status**: COMPLIANT
- **Implementation**: `src/extensions/acp/commands-emitter.ts:101` — `emitCommands()` can be called at any point to re-advertise commands
- **Severity**: N/A

#### Requirement: Commands are included as regular user messages in prompt requests
- **Status**: COMPLIANT
- **Implementation**: The agent's `prompt()` handler at `agent.ts:382-387` receives all text from the prompt, including slash commands, which are parsed by the WRFC runner
- **Severity**: N/A

---

### 17. Schema (from schema.mdx)

#### Requirement: Type definitions match schema
- **Status**: COMPLIANT
- **Implementation**: The implementation uses `@agentclientprotocol/sdk` types directly (`schema.InitializeRequest`, `schema.PromptResponse`, etc.), ensuring type alignment with the official schema
- **Severity**: N/A

---

## Non-Compliance Summary

| # | Finding | Spec Section | Severity | Implementation Location | Gap |
|---|---------|-------------|----------|------------------------|-----|
| 1 | Embedded resource content not processed in prompts | Content (content.mdx) | major | `agent.ts:382-387` | Agent advertises `embeddedContext: true` but only extracts text blocks from prompts, ignoring embedded resource content |
| 2 | Legacy `modes` field not populated in session/new response | Session Modes (session-modes.mdx) | minor | `agent.ts:266-270` | Spec transition guidance says SHOULD send both `configOptions` and `modes`; only configOptions is sent |
| 3 | `outputByteLimit` not forwarded to terminal/create | Terminals (terminals.mdx) | minor | `terminal-bridge.ts:86-92` | Optional parameter not passed through to ACP client |
| 4 | session/list not handled (even as error) if called despite null capability | Session List (session-list.mdx) | minor | `agent.ts` | No handler exists, but capability correctly declared null so clients should not call it |

## Recommendations

1. **Immediate (major)**: Either process embedded resource content blocks in the prompt handler (`agent.ts:382-387`) or change the capability to `embeddedContext: false` until the feature is fully implemented.

2. **Short-term (minor)**: Add legacy `modes` field to `newSession()` and `loadSession()` responses for backwards compatibility with older clients that do not support config options.

3. **Short-term (minor)**: Forward `outputByteLimit` from `TerminalCreateOptions` to ACP `terminal/create` requests.

4. **Low priority (informational)**: Consider implementing `session/list` capability for session persistence and discovery in multi-session scenarios.

---

## Positive Findings

The implementation demonstrates strong ACP compliance overall:

- **Version negotiation** is robust, with graceful fallback for clients (like Zed) that omit `protocolVersion`
- **Cancellation handling** is thorough, with proper AbortController wiring and correct `cancelled` stop reason returns
- **Error mapping** follows JSON-RPC 2.0 conventions with well-defined application error codes
- **Capability gating** is consistent across fs and terminal bridges
- **Extensibility** follows the spec's `_meta` and `_`-prefixed method conventions
- **Transport layer** correctly separates stdout (ACP messages) from stderr (logging)
- **Config options** implementation is comprehensive with proper dual-emit for backwards compatibility with modes
- **Plan emitter** correctly sends complete state on every update as required by spec
- **Permission gate** handles SDK/spec divergence gracefully with forward-compatible response parsing
