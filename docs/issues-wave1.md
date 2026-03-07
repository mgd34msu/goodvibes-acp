# Wave 1 Code Review — All Issues

## Summary
- **Total**: 95 issues (13 Critical, 36 Major, 29 Minor, 17 Nitpick)
- **Average Score**: 6.38/10
- **Reviewed by**: 10 parallel KB-specific review agents
- **Session**: `4280e34c-1fff-458e-8f9b-ea88583c9fb8`

| KB | Topic | Score | Critical | Major | Minor | Nitpick | Total |
|----|-------|-------|----------|-------|-------|---------|-------|
| KB01 | Overview & Architecture | 6.8/10 | 1 | 3 | 3 | 2 | 9 |
| KB02 | Initialization | 6.8/10 | 2 | 3 | 2 | 1 | 8 |
| KB03 | Sessions | 6.2/10 | 2 | 4 | 3 | 2 | 11 |
| KB04 | Prompt Turn | 5.8/10 | 2 | 4 | 3 | 2 | 11 |
| KB05 | Permissions | 5.2/10 | 3 | 3 | 2 | 1 | 9 |
| KB06 | Tools & MCP | 6.8/10 | 0 | 4 | 3 | 2 | 9 |
| KB07 | Filesystem & Terminal | 6.8/10 | 0 | 3 | 3 | 2 | 8 |
| KB08 | Extensibility | 6.2/10 | 0 | 4 | 3 | 2 | 9 |
| KB09 | TypeScript SDK | 6.8/10 | 3 | 3 | 3 | 1 | 10 |
| KB10 | Implementation Guide | 6.4/10 | 0 | 5 | 4 | 2 | 11 |

---

## KB01: Overview & Architecture (Score: 6.8/10)

**KB Reference**: `docs/acp-knowledgebase/01-overview.md`
**Files Reviewed**: `src/types/transport.ts`, `src/types/events.ts`, `src/types/constants.ts`, `src/extensions/acp/transport.ts`, `src/main.ts`

### Critical

1. **[src/types/transport.ts:21-24]** Stream type parameter is `unknown` instead of `AnyMessage`. The KB defines `Stream` as `WritableStream<AnyMessage>` / `ReadableStream<AnyMessage>` where `AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification`. The implementation uses `WritableStream<unknown>`, losing all type safety on message types flowing through the transport. — **Expected**: Define `AnyMessage` type and parameterize Stream as `WritableStream<AnyMessage>` / `ReadableStream<AnyMessage>`. *(KB: Transport Layer > Stream type signature, lines 46-58)*

### Major

2. **[src/types/constants.ts:(entire file)]** Missing JSON-RPC 2.0 error codes. The KB specifies error codes (e.g., -32600 Invalid Request, -32601 Method not found, -32602 Invalid params, -32603 Internal error, -32700 Parse error) as core protocol components. The constants file contains no JSON-RPC error code definitions. — **Expected**: Add `JSON_RPC_ERROR_CODES` constant with PARSE_ERROR=-32700, INVALID_REQUEST=-32600, METHOD_NOT_FOUND=-32601, INVALID_PARAMS=-32602, INTERNAL_ERROR=-32603. *(KB: JSON-RPC 2.0 Message Types > Error Response, lines 96-105)*

3. **[src/types/transport.ts:31]** TransportType includes 'tcp' and 'unix-socket' which are not in the ACP spec. The KB defines only 'ndjson over stdio' (local) and 'HTTP or WebSocket' (remote). 'unix-socket' is absent from the spec, 'tcp' is not a standalone ACP transport. — **Expected**: Align TransportType to `'stdio' | 'http' | 'websocket'` per KB, or document non-spec transports as GoodVibes-specific extensions. *(KB: Transport Layer, lines 35-63)*

4. **[src/types/transport.ts:73-90]** Message type is a single union bag instead of discriminated types. The KB defines three distinct JSON-RPC 2.0 message types: Request (id + method + params), Response (id + result OR error), Notification (method + params, NO id). The implementation collapses all three into a single `Message` type with all fields optional. — **Expected**: Define three separate types (JsonRpcRequest, JsonRpcResponse, JsonRpcNotification) with proper required/optional fields, then create `AnyMessage` union. *(KB: JSON-RPC 2.0 Message Types, lines 67-117)*

### Minor

5. **[src/types/events.ts:32-39]** Missing ACP-specific session/update event types. Does not include event types for the ACP session/update notification types: agent_message_chunk, tool_call, tool_call_update, plan, agent_thought_chunk, session_info, available_commands, current_mode, config_option. — **Expected**: Add `AcpUpdateEventType` union covering session/update discriminants, or document why handled outside L0 event types. *(KB: Notifications the Agent Sends > session/update types, lines 200-215)*

6. **[src/types/events.ts:24]** `_meta` field correctly uses `Record<string, unknown>` but KB-reserved keys (traceparent, tracestate, baggage — W3C trace context) are not documented in the type or as constants. — **Expected**: Add comment or type documenting reserved keys, or add `MetaReservedKeys` type/constant. *(KB: Extensibility > _meta Field, lines 374-390)*

7. **[src/types/constants.ts:(after line 36)]** Missing ACP_PROTOCOL_VERSION constant. The KB states "Protocol Version: 1" and this is needed for the initialize handshake. The file defines RUNTIME_VERSION and STATE_SCHEMA_VERSION but not the protocol version. — **Expected**: Add `export const ACP_PROTOCOL_VERSION = 1 as const;`. *(KB: Protocol Version, line 3; Protocol Lifecycle > initialize, lines 131-132)*

### Nitpick

8. **[src/extensions/acp/transport.ts:53]** AcpStream is defined as `ReturnType<typeof acp.ndJsonStream>` coupling the type to SDK implementation detail. If the SDK changes the return type, this silently follows. — **Expected**: Define AcpStream explicitly based on the KB's Stream type, or add a type assertion. *(KB: Transport Layer > Stream type signature, lines 46-58)*

9. **[src/main.ts:410-413]** Duplicated stdio transport creation logic. The subprocess mode stdio transport creation duplicates logic in `_createStdioTransport()` from transport.ts. The `createStdioTransport()` function is exported but not imported in main.ts. — **Expected**: Import and use `createStdioTransport()` instead of inline `acp.ndJsonStream(...)`. *(Code quality)*

---

## KB02: Initialization (Score: 6.8/10)

**KB Reference**: `docs/acp-knowledgebase/02-initialization.md`
**Files Reviewed**: `src/extensions/acp/agent.ts`, `src/extensions/acp/config-adapter.ts`, `src/types/registry.ts`, `src/types/config.ts`

### Critical

10. **[src/extensions/acp/agent.ts:112-127]** Missing `authMethods` field in initialize response. Per KB, `authMethods` is REQUIRED — even the minimal response example includes `"authMethods": []`. The Implementation Checklist states: "`authMethods` must be `[]` if no auth required (not omitted)". — **Expected**: Add `authMethods: []` to the initialize response. *(KB: Initialize Response > Minimal Response; Implementation Checklist bullet 5)*

11. **[src/extensions/acp/agent.ts:120]** MCP capability uses wrong key name `mcpCapabilities` instead of `mcp`. The KB TypeScript type (AgentCapabilities interface) and wire format example both use `mcp: { http: boolean, sse: boolean }`. The key `mcpCapabilities` will be ignored by compliant clients. — **Expected**: Change `mcpCapabilities` to `mcp`. *(KB: Initialize Response > TypeScript Type, AgentCapabilities.mcp)*

### Major

12. **[src/extensions/acp/agent.ts:114-116]** `agentInfo` missing `title` field. The KB TypeScript type specifies three fields: `name` (machine-readable), `title` (display name), `version` (semver). — **Expected**: Add `title: 'GoodVibes Runtime'` to agentInfo. *(KB: Initialize Response > TypeScript Type, agentInfo definition, line 162-165)*

13. **[src/extensions/acp/agent.ts:109-113]** No protocol version negotiation — uses constant without comparing to client's requested version. Per KB: "Client sends HIGHEST version it supports; Agent MUST respond with version <= client's version; If agent can't support any client version -> error." — **Expected**: Add version comparison logic: check `params.protocolVersion >= PROTOCOL_VERSION`, respond with `Math.min()`, or throw -32600 error. *(KB: Protocol Version Negotiation, lines 203-226)*

14. **[src/extensions/acp/agent.ts:118-127]** Missing `sessionCapabilities` declaration. Agents should declare `sessionCapabilities: { fork: false, list: false, resume: false }` to inform clients about unsupported unstable features. — **Expected**: Add `sessionCapabilities: { fork: false, list: false, resume: false }` to agentCapabilities. *(KB: Initialize Response > Wire Format, lines 120-124; Capability Decision Matrix, lines 527-529)*

### Minor

15. **[src/extensions/acp/agent.ts:109-110]** No logging of client capabilities or clientInfo to stderr. KB Implementation Checklist states: "Agent logs client capabilities to stderr (not stdout) for debugging." — **Expected**: Add `console.error()` logging of client capabilities on initialize. *(KB: Implementation Checklist bullet 6, line 508)*

16. **[src/types/config.ts:80]** `SessionConfigOptionChoice` uses `label` instead of `name`. The ACP SDK schema type `SessionConfigSelectOption` uses `name: string`. This inconsistency prevents interchangeable use with ACP types. — **Expected**: Change `label` to `name` or document intentional divergence. *(KB: Schema conformance)*

### Nitpick

17. **[src/extensions/acp/agent.ts:115]** Hardcoded version string `'0.1.0'` will drift from package.json. — **Expected**: Import version from package.json or a shared constants module. *(KB: agentInfo.version should be semver)*

---

## KB03: Sessions (Score: 6.2/10)

**KB Reference**: `docs/acp-knowledgebase/03-sessions.md`
**Files Reviewed**: `src/types/session.ts`, `src/extensions/sessions/modes.ts`, `src/extensions/sessions/manager.ts`, `src/extensions/acp/session-adapter.ts`, `src/extensions/acp/config-adapter.ts`, `src/extensions/acp/agent.ts`

### Critical

18. **[src/types/session.ts:30-43]** MCPServerConfig uses a non-ACP transport model. The KB specifies StdioMcpServer with `{name, command, args, env}` where env is `EnvVariable[] ({name, value})`. The implementation uses a union transport type ('stdio' | 'tcp' | 'websocket') with optional host/port, and completely omits the `env` field. HttpMcpServer `{type, name, url, headers}` is also missing. — **Expected**: Remodel MCPServerConfig as discriminated union (StdioMcpServer | HttpMcpServer | SseMcpServer) matching ACP wire format. *(KB: MCP Server Transports, lines 176-243)*

19. **[src/extensions/acp/session-adapter.ts:148-166]** Mode change notifications use `session_info_update` instead of KB-specified `current_mode_update` or `config_options_update`. KB mandates `current_mode_update` with `modeId` field and/or `config_options_update` with full configOptions array. — **Expected**: Emit `current_mode_update` with `{sessionUpdate: 'current_mode_update', modeId: newMode}` and `config_options_update` notification. *(KB: Agent-Initiated Mode Change, lines 458-474; Agent-Initiated Config Change, lines 371-397)*

### Major

20. **[src/extensions/acp/agent.ts:137-160]** session/new response does not include legacy `modes` field. KB states: "For backwards compatibility, agents SHOULD send both configOptions and modes during the transition period." — **Expected**: Add `modes: { currentModeId: 'justvibes', availableModes: [...] }` to newSession response alongside configOptions. *(KB: Session Modes (Legacy API), lines 401-442)*

21. **[src/extensions/acp/agent.ts:171-201]** session/load response returns `{configOptions}` but KB specifies response MUST be `{result: null}` after all history has been streamed. — **Expected**: Return `null` or `{}` from loadSession, emit config state via `config_options_update` notification before response. *(KB: Response (after all history streamed), lines 144-151)*

22. **[src/extensions/acp/agent.ts:140-143]** session/new does not forward `mcpServers` to session config. The KB only has cwd/mcpServers in params, but mcpServers are connected via mcpBridge but not persisted in session's config.mcpServers field. — **Expected**: Forward mcpServers to SessionManager for persistence in session config. *(KB: session/new Request, lines 13-31)*

23. **[src/extensions/sessions/modes.ts:23]** Session modes do not map to ACP-standard modes. KB shows standard modes as 'ask', 'architect', 'code'. Implementation uses 'justvibes', 'vibecoding', 'sandbox', 'plan'. Clients expecting standard ACP modes won't recognize these values. — **Expected**: Map GoodVibes modes to ACP-standard mode IDs for wire format, or document as agent-specific values. *(KB: Modes in session/new Response, lines 424-442)*

### Minor

24. **[src/extensions/acp/config-adapter.ts:22-23]** Config option IDs use dotted namespace ('goodvibes.mode', 'goodvibes.model') while KB examples use simple IDs ('mode', 'model'). Clients matching on 'mode' won't find 'goodvibes.mode'. — **Expected**: Use 'mode' and 'model' as IDs to match KB convention. *(KB: Receiving configOptions in session/new Response, lines 286-321)*

25. **[src/extensions/acp/session-adapter.ts:183-188]** All errors in `_safeSessionUpdate` are silently swallowed with empty catch. Makes debugging notification delivery failures impossible. — **Expected**: Add conditional logging for non-connection-closed errors. *(General robustness)*

26. **[src/types/session.ts:60]** SessionConfigOptionValue allows `boolean | number` but ACP ConfigOption only defines `type: "select"` with string values. Creates type mismatch on serialization. — **Expected**: Restrict to string only, or add serialization layer for boolean/number. *(KB: TypeScript Interfaces for ConfigOption, lines 252-275)*

### Nitpick

27. **[src/extensions/acp/config-adapter.ts:38-41]** Default model value 'claude-sonnet-4-6' does not appear in the options list. currentValue won't match any option value, confusing client select dropdowns. — **Expected**: Add 'claude-sonnet-4-6' to options or change default to an existing option value. *(ConfigOption interface)*

28. **[src/extensions/sessions/manager.ts:235]** `setConfigOption` accepts `value: string` but `SessionConfigOptionValue` type is `string | boolean | number`. Internal type inconsistency. — **Expected**: Align parameter type or narrow SessionConfigOptionValue. *(Internal consistency)*

---

## KB04: Prompt Turn (Score: 5.8/10)

**KB Reference**: `docs/acp-knowledgebase/04-prompt-turn.md`
**Files Reviewed**: `src/extensions/acp/agent.ts`, `src/extensions/acp/tool-call-emitter.ts`, `src/extensions/acp/plan-emitter.ts`, `src/extensions/acp/commands-emitter.ts`, `src/extensions/acp/agent-event-bridge.ts`

### Critical

29. **[src/extensions/acp/agent.ts:63-64]** session_info update uses wrong sessionUpdate discriminator. Code emits `'session_info_update'` but KB specifies `'session_info'`. Payload shape also wrong — KB requires `{ sessionUpdate: "session_info", content: ContentBlock }` but code sends `{ sessionUpdate: "session_info_update", title: string, updatedAt: string }`. — **Expected**: Change to `{ sessionUpdate: 'session_info', content: { type: 'text', text: title } }`. *(KB: session_info section, lines 289-315)*

30. **[src/extensions/acp/commands-emitter.ts:72-82]** available_commands update uses wrong discriminator AND wrong field name. Code emits `sessionUpdate: 'available_commands_update'` with field `'availableCommands'`, but KB specifies `sessionUpdate: 'available_commands'` with field `'commands'`. Command object also missing `id` field — KB requires `{ id, name, description }`. — **Expected**: (1) Discriminator to `'available_commands'`, (2) field to `'commands'`, (3) add `id` to each command. *(KB: available_commands section, lines 319-354)*

### Major

31. **[src/extensions/acp/tool-call-emitter.ts:42-52]** tool_call update missing `kind` field. KB specifies `ToolCallUpdate` must include `kind: ToolCallKind` (one of "read" | "write" | "run" | "switch_mode" | "other"). — **Expected**: Add `kind` parameter to emitToolCall() and include in emitted payload. *(KB: tool_call section, lines 142-157)*

32. **[src/extensions/acp/tool-call-emitter.ts:34-39]** tool_call initial status should always be `"pending"` per KB. The method accepts any ToolCallStatus, allowing non-conforming initial statuses like 'in_progress'. — **Expected**: Hardcode or validate status === 'pending' for initial tool_call announcements. *(KB: tool_call section, line 148)*

33. **[src/extensions/acp/agent-event-bridge.ts:86]** 'cancelled' agent status maps to 'failed' ToolCallStatus, but KB defines 'cancelled' as a valid ToolCallStatus. — **Expected**: Map 'cancelled' -> 'cancelled', not 'cancelled' -> 'failed'. *(KB: tool_call_update section, line 207)*

34. **[src/extensions/acp/agent-event-bridge.ts:83-87]** Agent 'failed' status maps to ToolCallStatus 'failed', but KB defines the status as 'error', not 'failed'. Valid values: `"pending" | "in_progress" | "completed" | "cancelled" | "error"`. — **Expected**: Map 'failed' -> 'error'. *(KB: tool_call_update section, line 207)*

### Minor

35. **[src/extensions/acp/agent.ts:267-272, 296-299, 304-308, 318-321]** Code emits a 'finish' sessionUpdate not defined in the KB. The KB states the turn ends when session/prompt response is returned with stopReason. — **Expected**: Remove 'finish' sessionUpdate emissions; convey stopReason in session/prompt response only. *(KB: Full Turn Lifecycle, lines 498-541)*

36. **[src/extensions/acp/agent.ts:302-323]** On error, prompt handler returns `{ stopReason: 'end_turn' }` instead of more appropriate 'refusal'. KB defines 'refusal' for "Agent refuses to continue." — **Expected**: Map certain error types to 'refusal' or propagate as JSON-RPC errors. *(KB: Stop Reasons table, lines 450-460)*

37. **[src/extensions/acp/agent.ts:226-327]** Missing implementation for `agent_thought_chunk` and `config_options_update` session updates during prompt turns. — **Expected**: Consider emitting config_options_update when mode/model changes during turn; agent_thought_chunk when extended thinking is supported. *(KB: agent_thought_chunk, lines 259-285; config_options_update, lines 385-419)*

### Nitpick

38. **[src/extensions/acp/commands-emitter.ts:19-50]** Commands use 'name' with '/' prefix (e.g., '/status') but KB uses 'id' as primary identifier with 'name' as human-readable. — **Expected**: Use `{ id: 'status', name: 'Show status', description: '...' }` pattern per KB. *(KB: available_commands, lines 349-353)*

39. **[src/extensions/acp/plan-emitter.ts:121-138]** Internal interface uses 'title' mapped to 'content' on emit. Functionally fine but adds cognitive overhead against KB. — **Expected**: Rename InternalPlanEntry.title to .content for wire-format consistency. *(KB: plan section, lines 250-254)*

---

## KB05: Permissions (Score: 5.2/10)

**KB Reference**: `docs/acp-knowledgebase/05-permissions.md`
**Files Reviewed**: `src/extensions/acp/permission-gate.ts`, `src/types/permissions.ts`, `src/extensions/acp/agent.ts`

### Critical

40. **[src/extensions/acp/permission-gate.ts:137-147]** Permission request uses SDK's options-based format (`options[], toolCall{}`) instead of KB-specified wire format. KB specifies request must include a `permission` object with `{type, title, description}`, SDK method returns `{ granted: boolean }`. Implementation instead passes `options: buildPermissionOptions()` and `toolCall: {...}`. — **Expected**: Use `conn.requestPermission({ sessionId, permission: { type, title, description } })` and read `response.granted` as boolean. *(KB: Wire Format, lines 25-41; TypeScript SDK Usage, lines 270-303)*

41. **[src/extensions/acp/permission-gate.ts:63-86]** The entire options-based permission model (buildPermissionOptions, isGranted with outcome/optionId parsing) does not exist in ACP spec. KB defines simple `granted: true|false` response, not outcome-based selection. — **Expected**: Remove buildPermissionOptions() and isGranted(). Use simple boolean check on `response.granted`. *(KB: Response format, lines 43-65; TypeScript SDK Usage, lines 274, 296)*

42. **[src/types/permissions.ts:18-23]** Permission types don't match ACP spec. KB defines: `shell`, `file_write`, `file_delete`, `network`, `browser`, plus custom. Implementation uses: `tool_call`, `file_write`, `file_read`, `command_execute`, `network_access`. Missing: shell, file_delete, network, browser. Non-spec: tool_call, file_read, command_execute, network_access. — **Expected**: Update PermissionType to `'shell' | 'file_write' | 'file_delete' | 'network' | 'browser' | string`. *(KB: Permission Types table, lines 81-92)*

### Major

43. **[src/extensions/acp/agent.ts:1-442]** Agent never instantiates or uses PermissionGate. KB specifies permissions gate tool execution. The prompt() method runs the WRFC loop without any permission checking. No import of PermissionGate in agent.ts. — **Expected**: Import and instantiate PermissionGate; check permissions before tool execution in WRFC loop. *(KB: Relationship to Tool Execution, lines 186-266)*

44. **[src/extensions/acp/permission-gate.ts:80-86]** Cancellation handling doesn't conform to KB spec. KB states: if client sends `session/cancel` while permission is in-flight, pending request should resolve as `granted: false` with `stopReason: "cancelled"`. Implementation catches errors generically without distinguishing cancellation. — **Expected**: Detect cancellation errors, return `{ status: 'denied', reason: 'Session cancelled' }` with `stopReason: "cancelled"`. *(KB: Cancellation During Permission, lines 383-389)*

45. **[src/types/permissions.ts:40-53]** PermissionRequest type includes `arguments` field not in KB's Permission object shape. KB defines: `type` (required), `title` (required), `description` (required), `_meta` (optional). — **Expected**: Remove `arguments` from PermissionRequest. Keep `toolName` as internal routing only, not sent on wire. *(KB: Permission Object Shape, lines 94-103)*

### Minor

46. **[src/extensions/acp/permission-gate.ts:30-51]** Mode naming doesn't align with KB conventions. KB references "ask mode", "code mode", "yolo/auto mode". Implementation uses "justvibes", "vibecoding", "plan", "sandbox". KB warns yolo/auto is "not recommended for production". — **Expected**: Add documentation mapping each mode to KB equivalent. *(KB: Mode-Based Auto-Approval, lines 362-378)*

47. **[src/extensions/acp/permission-gate.ts:136]** toolCallId construction (`request.toolName ?? 'permission-${type}'`) doesn't follow KB guidance. KB states toolCallId should match the tool_call update sent before the request. — **Expected**: Require caller to pass actual toolCallId from preceding tool_call update. *(KB: Key Implementation Notes, line 419)*

### Nitpick

48. **[src/types/permissions.ts:29-30]** PermissionStatus type defines 'granted' | 'denied' but KB uses simple boolean `granted: true|false`. Naming divergence could cause confusion. — **Expected**: Document mapping explicitly: `status: 'granted'` equals `granted: true` on wire. *(KB: Response format, lines 43-65)*

---

## KB06: Tools & MCP (Score: 6.8/10)

**KB Reference**: `docs/acp-knowledgebase/06-tools-mcp.md`
**Files Reviewed**: `src/extensions/acp/tool-call-emitter.ts`, `src/extensions/mcp/bridge.ts`, `src/extensions/mcp/tool-proxy.ts`, `src/extensions/mcp/transport.ts`, `src/extensions/mcp/index.ts`

### Major

49. **[src/extensions/acp/tool-call-emitter.ts:31, 37]** emitToolCall accepts `name` parameter but never includes it in the tool_call update. KB specifies `title` as human-readable label. The `name` param is silently dropped. — **Expected**: Include `name` in emitted update or remove the parameter. KB does not define `name` on tool_call — only `title`, `kind`, etc. *(KB: Tool Call Object Shape, lines 91-101)*

50. **[src/extensions/acp/tool-call-emitter.ts:42-47]** Missing `kind` field on emitted tool_call. KB defines `kind?: ToolCallKind` for client icon/display selection. — **Expected**: Add `kind` parameter (type ToolCallKind) and include in emitted ToolCall. *(KB: Tool Call Object Shape, line 95; Tool Call Kind Reference, lines 142-154)*

51. **[src/extensions/acp/tool-call-emitter.ts:42-47]** Missing `content`, `locations`, and `input` fields on emitted tool_call. KB defines these as optional fields on initial tool_call announcement. `emitToolCallUpdate` (line 63-78) is also missing `content` and `locations`. — **Expected**: Add optional parameters for `content`, `locations`, `input` to both emitToolCall and emitToolCallUpdate. *(KB: Tool Call Object Shape, lines 97-99; tool_call_update, lines 124-125)*

52. **[src/extensions/mcp/bridge.ts:197-219]** `_createClient` handles MCP server env as `EnvVariable[]` with `{name, value}` shape, but KB specifies `env` as `Record<string, string>`. Shape mismatch between implementation and KB. — **Expected**: Verify SDK type for `McpServerStdio.env` and align or document discrepancy. *(KB: MCP Server Object Shape, line 414)*

### Minor

53. **[src/extensions/acp/tool-call-emitter.ts:31]** JSDoc says status can be 'in_progress' but KB defines 'pending', 'running', 'completed', 'failed' — 'in_progress' not in KB. — **Expected**: Update JSDoc to reference 'running' instead of 'in_progress'. *(KB: Status Values, lines 21-28)*

54. **[src/extensions/mcp/transport.ts:119-128]** MCP initialize handshake does not capture or expose server capabilities (`serverCapabilities: { tools, resources, prompts }`). KB specifies agent should receive and act on these. Initialize response is discarded. — **Expected**: Capture initialize response and store `serverCapabilities`. *(KB: MCP Capabilities Negotiation, lines 454-468)*

55. **[src/extensions/mcp/bridge.ts:68]** `connectServers` accepts `McpServer[]` (including HTTP/SSE) but `_createClient` only handles stdio. No capability declaration via `agentCapabilities.mcp` to signal supported transport types. — **Expected**: Declare `agentCapabilities.mcp` with `http: false, sse: false` during ACP initialize. *(KB: MCP Transport Types, lines 420-450)*

### Nitpick

56. **[src/extensions/mcp/tool-proxy.ts:76-116]** execute method wraps MCP results but does not emit ACP tool_call / tool_call_update notifications. No integration between McpToolProxy and ToolCallEmitter. — **Expected**: Integrate ToolCallEmitter into McpToolProxy or document caller responsibility. *(KB: MCP Tool Call -> ACP Update Mapping, lines 472-537)*

57. **[src/extensions/mcp/transport.ts:177-178]** stdin.write uses non-null assertion (`this._process.stdin!`). Unhelpful TypeError on null. — **Expected**: Add guard or assert in constructor that stdin/stdout are available. *(General robustness)*

---

## KB07: Filesystem & Terminal (Score: 6.8/10)

**KB Reference**: `docs/acp-knowledgebase/07-filesystem-terminal.md`
**Files Reviewed**: `src/extensions/acp/fs-bridge.ts`, `src/extensions/acp/terminal-bridge.ts`, `src/types/registry.ts`

### Major

58. **[src/extensions/acp/fs-bridge.ts:46-52]** readTextFile does not forward `line` and `limit` params to ACP wire call. KB defines optional `line` (number) and `limit` (number) in fs/read_text_file request. Implementation only sends `path` and `sessionId`, making partial-file reads impossible through ACP. — **Expected**: Add `line` and `limit` to ReadOptions and forward in ACP call. *(KB: fs/read_text_file request params, lines 78-83)*

59. **[src/types/registry.ts:221-226]** ITextFileAccess.readTextFile signature doesn't match KB interface. KB: `readTextFile(path, opts?: { line?, limit? })`. Actual: `readTextFile(path, options?: ReadOptions)` where ReadOptions has `encoding`/`preferBuffer` but lacks `line`/`limit`. — **Expected**: Add `line?: number` and `limit?: number` to ReadOptions. *(KB: Mapping to ITextFileAccess, lines 169-195)*

60. **[src/types/registry.ts:233-244]** ITerminal interface signature diverges from KB ITerminal. KB: `create(opts: { command?, env?, cwd? }): Promise<ITerminalSession>`. Actual: `create(command, args?): Promise<TerminalHandle>`. Key differences: (1) options object vs positional args, (2) ITerminalSession vs TerminalHandle return, (3) KB has no `args` param. — **Expected**: Align with KB options-object + ITerminalSession pattern or document divergence. *(KB: Mapping to ITerminal, lines 400-451)*

### Minor

61. **[src/extensions/acp/terminal-bridge.ts:70-86]** terminal/create ACP call passes `args` field not in KB wire format. KB has: sessionId, command, env, cwd. Also, `env` parameter is never forwarded despite KB support. — **Expected**: Remove `args` from ACP call (concatenate into command), add `env` support. *(KB: terminal/create request params, lines 230-236)*

62. **[src/extensions/acp/terminal-bridge.ts:134-143]** output() method does not forward `timeout` parameter to ACP. Also return type is `string` but KB returns `{ output: string; exitCode: number | null }` — exitCode is discarded. — **Expected**: Add optional timeout, consider returning full `{ output, exitCode }` shape. *(KB: terminal/output request and response, lines 280-303)*

63. **[src/extensions/acp/terminal-bridge.ts:156-168]** waitForExit() does not support timeout parameter. KB defines terminal/wait_for_exit with optional `timeout` field. — **Expected**: Add optional timeout parameter and forward to ACP call. *(KB: terminal/wait_for_exit request, lines 316-324)*

### Nitpick

64. **[src/extensions/acp/terminal-bridge.ts:97]** Spawn fallback uses `shell: false`. KB's terminal/create sends command as string that may include shell syntax. `shell: true` would be more consistent. — **Expected**: Consider `shell: true` for spawn fallback. *(KB: terminal/create description)*

65. **[src/extensions/acp/fs-bridge.ts:56, 86]** VALID_ENCODINGS set is recreated on every read/write call. Minor allocation overhead. — **Expected**: Move to module-level constant. *(Code quality)*

---

## KB08: Extensibility (Score: 6.2/10)

**KB Reference**: `docs/acp-knowledgebase/08-extensibility.md`
**Files Reviewed**: `src/extensions/acp/extensions.ts`, `src/extensions/acp/event-recorder.ts`, `src/extensions/acp/agent.ts`, `src/extensions/acp/index.ts`

### Major

66. **[src/extensions/acp/agent.ts:395-418]** extMethod only handles _goodvibes/state and _goodvibes/agents but does NOT delegate to GoodVibesExtensions. The GoodVibesExtensions class handles all 5 methods (_goodvibes/status, _goodvibes/state, _goodvibes/events, _goodvibes/agents, _goodvibes/analytics) but agent's extMethod has its own incomplete implementation that shadows it. — **Expected**: Inject GoodVibesExtensions and delegate extMethod calls to extensions.handle(). *(KB: TypeScript: Receiving Extension Methods, lines 158-181)*

67. **[src/extensions/acp/agent.ts:395-418]** extMethod responses for _goodvibes/state and _goodvibes/agents do NOT include `_meta.version`. GoodVibesExtensions correctly includes `_meta: { version: '0.1.0' }` on every response, but agent's extMethod returns bare objects. — **Expected**: Delegate to GoodVibesExtensions (preferred) or add `_meta: { version: '0.1.0' }` to all responses. *(GoodVibes extension response format)*

68. **[src/extensions/acp/agent.ts:431-440]** extNotification only handles _goodvibes/directive. No code SENDS _goodvibes/status or _goodvibes/events notifications to client via conn.extNotification(). KB defines these as agent->client notifications. — **Expected**: Add methods that send _goodvibes/status notifications during WRFC execution and _goodvibes/events when events fire. *(KB: Planned Extension Methods table, lines 191-198)*

69. **[src/extensions/acp/extensions.ts:54-56]** _goodvibes/status implemented as request handler but KB defines it as notification (agent->client, fire-and-forget, no id). The handle() method treats it as synchronous request returning data. — **Expected**: Refactor to proactive push via conn.extNotification(). Use different method name (e.g., _goodvibes/health) for pull-based query. *(KB: Planned Extension Methods table, line 191; Extension Notification, lines 125-138)*

### Minor

70. **[src/extensions/acp/agent.ts:188-191]** session/update notifications during loadSession do not include _meta with GoodVibes-specific data (_goodvibes/score, _goodvibes/phase, etc.). — **Expected**: Add _meta with `_goodvibes/phase: 'replay'` or similar context. *(KB: _meta Usage for GoodVibes Data, lines 200-224)*

71. **[src/extensions/acp/extensions.ts:1-321]** No guard against overwriting reserved _meta keys (traceparent, tracestate, baggage). Currently safe with static META, but no validation for merged _meta. — **Expected**: Add validation utility or document invariant. *(KB: Reserved Keys (W3C Trace Context), lines 48-67)*

72. **[src/extensions/acp/event-recorder.ts:52-57]** RecordedEvent does not capture _meta from source events. Any _meta attached to original events is lost. — **Expected**: Add optional _meta field to RecordedEvent type. *(KB: _goodvibes/events, line 195)*

### Nitpick

73. **[src/extensions/acp/extensions.ts:20]** META version key is un-namespaced ("version" not "_goodvibes/version"). KB naming convention recommends namespaced keys within _meta. — **Expected**: Rename to `_goodvibes/version` for namespace consistency. *(KB: Naming Convention for Custom Keys, lines 69-77)*

74. **[src/extensions/acp/index.ts:21]** GoodVibesExtensions exported but not wired to GoodVibesAgent. No visible integration point for extensions.handle() from agent extMethod. — **Expected**: Document or implement composition root wiring. *(KB: TypeScript: Receiving Extension Methods, lines 158-181)*

---

## KB09: TypeScript SDK (Score: 6.8/10)

**KB Reference**: `docs/acp-knowledgebase/09-typescript-sdk.md`
**Files Reviewed**: All `src/extensions/acp/*.ts` files (15 total)

### Critical

75. **[src/extensions/acp/agent.ts:227]** PromptRequest uses `params.prompt` to extract content blocks, but SDK defines PromptRequest as having a `messages` field (array of PromptMessage), not `prompt`. Each PromptMessage has `role` and `content` (array of ContentBlock). Code treats `prompt` as flat ContentBlock array. — **Expected**: Change to `params.messages.flatMap(m => m.content).filter(b => b.type === 'text').map(b => b.text).join('\n')`. *(KB: Agent Interface > prompt)*

76. **[src/extensions/acp/fs-bridge.ts:52]** ReadTextFileResponse field accessed as `response.content` but SDK defines it as `{ text: string }`. — **Expected**: Change `response.content` to `response.text`. *(KB: readTextFile section)*

77. **[src/extensions/acp/fs-bridge.ts:76-80]** WriteTextFileRequest sends `{ path, content, sessionId }` but SDK field is `text`, not `content`. — **Expected**: Change `content,` to `text: content,`. *(KB: writeTextFile section)*

### Major

78. **[src/extensions/acp/agent.ts:118-126]** AgentCapabilities uses non-standard field names: `mcpCapabilities` and `promptCapabilities` instead of SDK's `mcp` and `prompt`. Silently ignored by clients. — **Expected**: Rename to `mcp` and `prompt`. *(KB: AgentCapabilities Fields)*

79. **[src/extensions/acp/terminal-bridge.ts:10]** `TerminalHandle` imported as value but only used as type annotation. Risk with tree-shaking or SDK export map. — **Expected**: Use `import type { TerminalHandle }` if only for type annotations. *(KB: TerminalHandle section)*

80. **[src/extensions/acp/terminal-bridge.ts:138-139]** `currentOutput()` response accessed as `result.output` — field name on TerminalOutputResponse needs verification against SDK. — **Expected**: Verify actual field name from SDK types. *(KB: TerminalHandle section)*

### Minor

81. **[src/extensions/acp/agent.ts:270, 298, 306, 320]** The `finish` session update uses `as any` cast. Should type-check without cast if correct SDK types imported. — **Expected**: Remove `as any` cast; fix underlying type mismatch. *(KB: Session Update Reference)*

82. **[src/extensions/acp/agent.ts:301, 323]** PromptResponse returns `{ stopReason: string }` but SDK defines it as `{}` (empty). Content comes via sessionUpdate notifications. — **Expected**: Return `{}` instead; convey stop reason via `finish` sessionUpdate only. *(KB: prompt section)*

83. **[src/extensions/acp/agent.ts:63-64]** `session_info_update` discriminant has comment noting uncertainty about SDK name. Should be resolved, not left as runtime surprise. — **Expected**: Verify exact discriminant against SDK's SessionUpdate type definition. *(KB: Session Update Reference)*

### Nitpick

84. **[src/extensions/acp/agent.ts:63-64]** session_info_update discriminant uncertainty documented in comment but unresolved. — **Expected**: Resolve by checking SDK types. *(KB: Session Update Reference)*

---

## KB10: Implementation Guide (Score: 6.4/10)

**KB Reference**: `docs/acp-knowledgebase/10-implementation-guide.md`
**Files Reviewed**: `src/main.ts`, `src/extensions/wrfc/orchestrator.ts`, `src/extensions/wrfc/machine.ts`, `src/extensions/wrfc/handlers.ts`, `src/core/registry.ts`, `src/core/event-bus.ts`

### Major

85. **[src/main.ts:247-266]** WRFC tool_call updates use 'in_progress' status instead of KB-mandated 'pending' -> 'running' two-step emission. KB shows two separate sessionUpdate calls: first 'pending', then 'running'. Implementation uses single emitToolCall with 'in_progress', which is not a valid ACP tool_call status. — **Expected**: Emit two separate tool_call updates: first 'pending', then 'running'. *(KB: Section 6 — WRFC as Tool Calls, lines 364-397)*

86. **[src/main.ts:258-266]** Tool call emissions do not include `_meta` with `_goodvibes/attempt` and `_goodvibes/phase` keys. KB explicitly requires these on every tool_call update. — **Expected**: Add `_meta: { '_goodvibes/phase': 'work', '_goodvibes/attempt': attempt }` to all tool_call emissions. *(KB: Section 6, lines 370-373, 436-439, 470-472)*

87. **[src/main.ts:276-281]** Review completion tool_call_update passes `{ score: result.score }` without `_goodvibes/` namespace prefix. KB requires `_goodvibes/score`, `_goodvibes/minimumScore`, `_goodvibes/dimensions`. — **Expected**: Use `{ '_goodvibes/score': result.score, '_goodvibes/minimumScore': wrfcConfig.minReviewScore, '_goodvibes/dimensions': result.dimensions }` as _meta. *(KB: Section 6, lines 453-462)*

88. **[src/main.ts:221]** Reviewer retrieved via `registry.getAll<IReviewer>('reviewer')` using multi-value lookup with first-value extraction. KB specifies `registry.get<IReviewer>('reviewer')` as single-value lookup. Using getAll masks missing reviewer (fallback score of 10). — **Expected**: Use `registry.get<IReviewer>('reviewer')` for direct lookup. *(KB: Section 6, line 445)*

89. **[src/main.ts:70, 428]** Config instance created but voided/unused. KB describes `config.onChange -> eventBus.emit` wiring. No such wiring exists. Config object is inert. — **Expected**: Wire config.onChange to eventBus.emit('config:changed', ...) or remove unused Config. *(KB: Section 9 — Config Options)*

### Minor

90. **[src/main.ts:203]** Registry key 'agent-spawner' uses kebab-case. KB uses snake_case: `registry.get<IAgentSpawner>('agent_spawner')`. — **Expected**: Use 'agent_spawner' to match KB convention. *(KB: Section 6, line 399)*

91. **[src/main.ts:96-102]** Shutdown handlers don't include L3 plugin teardown. KB implies L3 -> L2 -> L1 shutdown order. L3 plugins (ReviewPlugin, AgentsPlugin, etc.) have no shutdown handlers. — **Expected**: Register L3 plugin shutdown handlers with lower priorities (5-9). *(KB: Section 14 — Bootstrap checklist)*

92. **[src/extensions/wrfc/handlers.ts:75-110]** Event handlers use untyped payload casting (`event.payload as { ... }`). KB's EventBus pattern implies typed event handling. Risks runtime type mismatches. — **Expected**: Define typed event maps or use Zod schemas at subscription boundaries. *(KB: Section 14 — event bus wiring)*

93. **[src/main.ts:99]** Shutdown handler references variable 'mcpBridge' declared 40 lines later. Works due to lazy closure capture but creates fragile ordering dependency. — **Expected**: Move shutdown registrations after all service instantiations. *(KB: Section 14 — Bootstrap order)*

### Nitpick

94. **[src/main.ts:99]** (Addressed above as minor #93)

95. **[src/extensions/wrfc/orchestrator.ts:165-168]** Agent config hardcodes type as 'engineer' for initial spawn. KB uses 'engineer' for attempt 1 and 'fixer' for subsequent. Orchestrator delegates fix to separate IFixer — acceptable deviation. — **Expected**: Document as intentional design decision. *(KB: Section 6, lines 400-402)*

---

## Cross-Cutting Themes

The following patterns recur across multiple KB reviews:

### 1. Field Name Mismatches with SDK (Critical)
Multiple files use incorrect field names that will cause runtime failures:
- `params.prompt` vs `params.messages` (KB09 #75)
- `response.content` vs `response.text` for file reads (KB09 #76)
- `content` vs `text` for file writes (KB09 #77)
- `mcpCapabilities` vs `mcp` (KB02 #11, KB09 #78)
- `promptCapabilities` vs `prompt` (KB09 #78)

### 2. Wrong SessionUpdate Discriminators (Critical)
- `session_info_update` should be `session_info` (KB04 #29)
- `available_commands_update` should be `available_commands` (KB04 #30)
- `current_mode_update` missing entirely (KB03 #19)

### 3. Missing Wire Format Fields (Major)
- Missing `kind` on tool_call (KB04 #31, KB06 #50)
- Missing `content`, `locations`, `input` on tool_call (KB06 #51)
- Missing `authMethods` in initialize (KB02 #10)
- Missing `_meta` with `_goodvibes/` keys on WRFC tool calls (KB10 #86, #87)

### 4. PermissionGate Disconnected (Critical)
- Wrong wire format (options-based vs boolean) (KB05 #40, #41)
- Wrong permission types (KB05 #42)
- Never integrated into agent (KB05 #43)

### 5. Type Safety Gaps (Major)
- Stream uses `unknown` instead of `AnyMessage` (KB01 #1)
- Message type is flat union instead of discriminated types (KB01 #4)
- Missing JSON-RPC error codes (KB01 #2)

### 6. Extension System Disconnect (Major)
- GoodVibesExtensions not wired to GoodVibesAgent (KB08 #66)
- Status/events implemented as requests, should be notifications (KB08 #69)
- No outbound _goodvibes/status notifications during WRFC (KB08 #68)
