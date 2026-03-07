# Phase 1 Code Review — Issues

## Summary
- **Total**: 200 issues across Wave 1 + Wave 2 (deduplicated to ~185 unique)
- **Severity**: 25 Critical, 69 Major, 68 Minor, 38 Nitpick
- **Wave 1 Score**: 6.38/10 · **Wave 2 Score**: 5.96/10 · **Average**: 6.15/10
- **Reviewed Against**: ACP Knowledgebase (`docs/acp-knowledgebase/`, 10 files)

| Topic | W1 Score | W2 Score |
|-------|----------|----------|
| Overview & Architecture | 6.8 | 8.2 |
| Initialization | 6.8 | 6.8 |
| Sessions | 6.2 | 5.8 |
| Prompt Turn | 5.8 | 6.8 |
| Permissions | 5.2 | 3.8 |
| Tools & MCP | 6.8 | 7.2 |
| Filesystem & Terminal | 6.8 | 6.2 |
| Extensibility | 6.2 | 4.8 |
| TypeScript SDK | 6.8 | 4.2 |
| Implementation Guide | 6.4 | 6.8 |

---

## Critical (25)

### Transport Types
1. **[src/types/transport.ts:21-24]** Stream type parameter is `unknown` instead of `AnyMessage`. Define `AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification` and parameterize as `WritableStream<AnyMessage>` / `ReadableStream<AnyMessage>`. *(Overview)*

2. **[src/types/transport.ts:73-90]** Message type is a flat union bag instead of discriminated types. Define three separate types (`JsonRpcRequest`, `JsonRpcResponse`, `JsonRpcNotification`) with proper required/optional fields, then create `AnyMessage` union. *(Overview)*

### ACP Agent — Initialization
3. **[src/extensions/acp/agent.ts:112-127]** Missing `authMethods` field in initialize response. Per spec, `authMethods` is REQUIRED — even the minimal example includes `"authMethods": []`. Add `authMethods: []`. *(Initialization)*

4. **[src/extensions/acp/agent.ts:120]** MCP capability uses wrong key `mcpCapabilities` instead of `mcp`. Wire format requires `mcp: { http: boolean, sse: boolean }`. Also applies to `promptCapabilities` → `prompt`. The incorrect keys are silently ignored by compliant clients. *(Initialization)*

### ACP Agent — Prompt Turn
5. **[src/extensions/acp/agent.ts:227]** `params.prompt` used to extract content blocks but SDK defines `PromptRequest` with a `messages` field (array of `PromptMessage`). Change to `params.messages.flatMap(m => m.content).filter(b => b.type === 'text').map(b => b.text).join('\n')`. *(Prompt Turn)*

6. **[src/extensions/acp/agent.ts:63-64]** `session_info` update emits wrong discriminator `'session_info_update'` and wrong payload shape. Correct: `{ sessionUpdate: 'session_info', content: { type: 'text', text: title } }`. *(Prompt Turn)*

### ACP Agent — Session Updates
7. **[src/extensions/acp/commands-emitter.ts:72-82]** `available_commands` update uses wrong discriminator (`available_commands_update`) and wrong field name (`availableCommands` instead of `commands`). Command objects also missing `id` field — spec requires `{ id, name, description }`. Fix all three. *(Prompt Turn)*

### Session Manager
8. **[src/extensions/sessions/manager.ts:235-250]** `setConfigOption` does not emit any event. Spec requires `config_options_update` session notification on every config change. *(Sessions)*

9. **[src/extensions/sessions/manager.ts:235-250]** `setConfigOption` stores configOptions as flat `Record<string, string>` instead of ACP `ConfigOption[]` structure with `id`, `name`, `description`, `category`, `type`, `currentValue`, `options[]`. Clients cannot reconstruct full config state. *(Sessions)*

### Session Types
10. **[src/types/session.ts:30-43]** `MCPServerConfig` uses a non-ACP transport model. Spec defines `StdioMcpServer { name, command, args, env: EnvVariable[] }` and `HttpMcpServer { type, name, url, headers }`. Implementation uses a union on transport type with optional host/port and no `env`. Remodel as discriminated union matching wire format. *(Sessions)*

### Session Adapter
11. **[src/extensions/acp/session-adapter.ts:148-166]** Mode change notifications use `session_info_update` instead of spec-mandated `current_mode_update` (with `modeId`) and `config_options_update`. *(Sessions)*

### Permissions
12. **[src/types/permissions.ts:18-23]** `PermissionType` misaligned with ACP spec. Spec: `shell`, `file_write`, `file_delete`, `network`, `browser`. Implementation: `tool_call`, `file_write`, `file_read`, `command_execute`, `network_access`. Only `file_write` matches. Update to `'shell' | 'file_write' | 'file_delete' | 'network' | 'browser' | string`. *(Permissions)*

13. **[src/extensions/acp/permission-gate.ts:137-147]** Permission request uses SDK options-based format (`options[], toolCall{}`) instead of spec wire format. Correct: `conn.requestPermission({ sessionId, permission: { type, title, description } })` with `response.granted` as boolean. *(Permissions)*

14. **[src/extensions/acp/permission-gate.ts:63-86]** Entire options-based permission model (`buildPermissionOptions`, `isGranted` with outcome/optionId parsing) does not exist in ACP spec. Spec defines simple `granted: true|false`. Remove `buildPermissionOptions()` and `isGranted()`; use boolean check on `response.granted`. *(Permissions)*

15. **[src/extensions/acp/agent.ts:1-442]** `PermissionGate` is never instantiated or used. The `prompt()` method runs the WRFC loop with no permission checking. Import and integrate `PermissionGate`; check permissions before tool execution. *(Permissions)*

16. **[src/extensions/hooks/built-ins.ts (entire file)]** No permission-checking hooks exist. Spec requires a pre-hook on `tool:execute` that calls `PermissionGate.check()`. No hooks for `tool:call` or `tool:execute` events exist. *(Permissions)*

17. **[src/types/agent.ts:33-48]** `AgentConfig` carries no permission context. No `permissions`, `permissionPolicy`, `mode`, or `allowedActions` field. Spawned agents cannot know permission rules. *(Permissions)*

### IPC / TypeScript SDK
18. **[src/extensions/ipc/protocol.ts:19-53]** IPC protocol uses custom message format, not JSON-RPC 2.0. Uses `type` instead of `jsonrpc: "2.0"`, `correlationId` instead of `id`, `ok: boolean` instead of `result/error` objects. *(TypeScript SDK)*

19. **[src/extensions/ipc/router.ts:78]** Router dispatches on custom `method` field, not ACP method names. Only handles `ping` and `status` built-ins — no ACP method routing. *(TypeScript SDK)*

20. **[src/extensions/agents/coordinator.ts + tracker.ts]** No ACP session lifecycle integration (`initialize` / `newSession` / `prompt`). Uses custom `AgentStatus` values not mapped to ACP session update types. *(TypeScript SDK)*

### File Access (SDK)
21. **[src/extensions/acp/fs-bridge.ts:52]** `ReadTextFileResponse` field accessed as `response.content` but SDK defines it as `{ text: string }`. Change to `response.text`. *(TypeScript SDK)*

22. **[src/extensions/acp/fs-bridge.ts:76-80]** `WriteTextFileRequest` sends `{ path, content, sessionId }` but SDK field is `text`, not `content`. Change `content,` to `text: content,`. *(TypeScript SDK)*

### Plugins — Extensibility
23. **[src/plugins/analytics/engine.ts (entire file)]** `AnalyticsEngine` does not implement `IToolProvider`. No `name`, `tools`, or `execute()`. Cannot be dispatched through the ACP tool system. *(Extensibility)*

24. **[src/plugins/frontend/analyzer.ts (entire file)]** `FrontendAnalyzer` does not implement `IToolProvider`. Unreachable via standard tool invocation. *(Extensibility)*

25. **[All plugin files]** Zero ACP extension method integration. No `handleExtMethod()`, no `onExtNotification()`, no `_goodvibes/`-prefixed methods handled or emitted. Spec defines `_goodvibes/analytics` and `_goodvibes/events` — neither implemented. *(Extensibility)*

---

## Major (69)

### Transport / Wire Format
26. **[src/types/constants.ts:(entire file)]** Missing JSON-RPC 2.0 error codes. Add `JSON_RPC_ERROR_CODES` with `PARSE_ERROR=-32700`, `INVALID_REQUEST=-32600`, `METHOD_NOT_FOUND=-32601`, `INVALID_PARAMS=-32602`, `INTERNAL_ERROR=-32603`. *(Overview)*

27. **[src/types/transport.ts:31]** `TransportType` includes `'tcp'` and `'unix-socket'` which are not in the ACP spec. Align to `'stdio' | 'http' | 'websocket'` or document as GoodVibes-specific extensions. *(Overview)*

### ACP Agent — Initialization
28. **[src/extensions/acp/agent.ts:114-116]** `agentInfo` missing `title` field. Spec type specifies `name`, `title`, `version`. Add `title: 'GoodVibes Runtime'`. *(Initialization)*

29. **[src/extensions/acp/agent.ts:109-113]** No protocol version negotiation. Client sends highest supported version; agent must respond with version ≤ client's version, or error if incompatible. Add version comparison and `-32600` error path. *(Initialization)*

30. **[src/extensions/acp/agent.ts:118-127]** Missing `sessionCapabilities` in initialize response. Add `sessionCapabilities: { fork: false, list: false, resume: false }` to inform clients about unsupported features. *(Initialization)*

### ACP Agent — Sessions
31. **[src/extensions/acp/agent.ts:137-160]** `session/new` response does not include legacy `modes` field. Spec: agents SHOULD send both `configOptions` and `modes` during the transition period. Add `modes: { currentModeId, availableModes }` alongside `configOptions`. *(Sessions)*

32. **[src/extensions/acp/agent.ts:171-201]** `session/load` response returns `{configOptions}` but spec requires response MUST be `{result: null}` after history has been streamed. Return `null`; emit config state via `config_options_update` notification before responding. *(Sessions)*

33. **[src/extensions/acp/agent.ts:140-143]** `session/new` does not forward `mcpServers` to session config. MCP servers are connected via mcpBridge but not persisted in the session's `config.mcpServers` field. *(Sessions)*

34. **[src/extensions/sessions/modes.ts:23]** Session modes don't map to ACP-standard modes. Spec examples: `'ask'`, `'architect'`, `'code'`. Implementation: `'justvibes'`, `'vibecoding'`, `'sandbox'`, `'plan'`. Map GoodVibes modes to ACP-standard IDs for wire format, or document as agent-specific. *(Sessions)*

### Session Manager
35. **[src/extensions/sessions/manager.ts:104-113]** `load()` does not replay conversation history. Spec requires streaming full history as `session/update` notifications before responding to `session/load`. *(Sessions)*

36. **[src/extensions/sessions/manager.ts:104-113]** `load()` does not emit a session event for resumption. *(Sessions)*

### ACP Agent — Prompt Turn
37. **[src/extensions/acp/tool-call-emitter.ts:42-52]** `tool_call` update missing `kind` field. Spec defines `kind: ToolCallKind` (`'read' | 'write' | 'run' | 'switch_mode' | 'other'`). Add `kind` parameter to `emitToolCall()` and include in payload. *(Prompt Turn)*

38. **[src/extensions/acp/tool-call-emitter.ts:34-39]** Initial `tool_call` status should always be `"pending"`. Method accepts any `ToolCallStatus`, allowing non-conforming initial values like `'in_progress'`. Hardcode or validate status to `'pending'` for initial announcements. *(Prompt Turn)*

39. **[src/extensions/acp/agent-event-bridge.ts:83-87]** Agent `'failed'` status maps to `ToolCallStatus 'failed'` but spec defines the value as `'error'`. Also, `'cancelled'` maps to `'failed'` — it should map to `'cancelled'` (a valid spec status). Fix both mappings. *(Prompt Turn)*

40. **[src/extensions/acp/tool-call-emitter.ts:42-47]** Missing `content`, `locations`, and `input` optional fields on emitted `tool_call`. `emitToolCallUpdate` is also missing `content` and `locations`. Add optional parameters for all three. *(Prompt Turn)*

### MCP Bridge
41. **[src/extensions/mcp/bridge.ts:197-219]** `_createClient` handles MCP server `env` as `EnvVariable[]` (`{name, value}`) but spec shows `env` as `Record<string, string>`. Verify SDK type for `McpServerStdio.env` and align. *(Tools & MCP)*

42. **[src/extensions/mcp/bridge.ts:68]** `connectServers` accepts `McpServer[]` including HTTP/SSE but `_createClient` only handles stdio. Also missing `agentCapabilities.mcp` declaration (`http: false, sse: false`) during ACP initialize. *(Tools & MCP)*

43. **[src/extensions/mcp/transport.ts:169-179]** No request timeout — MCP server hang causes indefinite block. *(Tools & MCP)*

### MCP Tool-Call Bridge
44. **[src/extensions/mcp/tool-call-bridge.ts:82]** Wrong initial status: emits `'in_progress'` on tool_start, skipping `'pending'`. Breaks permission-gated clients expecting `pending` before execution. *(Tools & MCP)*

45. **[src/extensions/mcp/tool-call-bridge.ts:94-101]** `emitToolCallUpdate` for completed/failed missing `content` field. Only sends `_meta` with duration/error — no `ContentBlock[]`. *(Tools & MCP)*

### Filesystem Bridge
46. **[src/extensions/acp/fs-bridge.ts:46-52]** `readTextFile` does not forward `line` and `limit` params to ACP wire call. Spec defines optional `line` and `limit` in `fs/read_text_file` request. Add both to `ReadOptions` and forward in the ACP call. *(Filesystem & Terminal)*

47. **[src/types/registry.ts:221-226]** `ITextFileAccess.readTextFile` signature doesn't match spec interface. Spec: `readTextFile(path, opts?: { line?, limit? })`. Actual `ReadOptions` has `encoding`/`preferBuffer` but lacks `line`/`limit`. *(Filesystem & Terminal)*

48. **[src/types/registry.ts:233-244]** `ITerminal` interface diverges from spec. Spec: `create(opts: { command?, env?, cwd? }): Promise<ITerminalSession>`. Actual: `create(command, args?): Promise<TerminalHandle>`. Align with options-object + `ITerminalSession` pattern. *(Filesystem & Terminal)*

### Project Plugins — Direct FS Bypass
49. **[src/plugins/project/deps.ts:9,20,62]** `readFile` from `node:fs/promises` used directly instead of `ITextFileAccess`. Will never read unsaved editor buffer state. *(Filesystem & Terminal)*

50. **[src/plugins/project/security.ts:9,176,279]** `SecurityScanner` reads files directly. Bypasses `ITextFileAccess`. Scanning unsaved content for secrets is arguably more critical. *(Filesystem & Terminal)*

51. **[src/plugins/project/analyzer.ts:209-216]** `ProjectAnalyzer` instantiates sub-analyzers without injecting `ITextFileAccess`. Makes dual-path pattern impossible. *(Filesystem & Terminal)*

### Extension System
52. **[src/extensions/acp/agent.ts:395-418]** `extMethod` handles only `_goodvibes/state` and `_goodvibes/agents` but does NOT delegate to `GoodVibesExtensions`. That class handles all 5 methods but agent's `extMethod` has its own incomplete implementation that shadows it. Inject and delegate to `extensions.handle()`. *(Extensibility)*

53. **[src/extensions/acp/agent.ts:395-418]** `extMethod` responses for `_goodvibes/state` and `_goodvibes/agents` do NOT include `_meta.version`. `GoodVibesExtensions` correctly adds `_meta: { version: '0.1.0' }` on every response; agent's direct responses return bare objects. Delegate to `GoodVibesExtensions` or add `_meta` to all responses. *(Extensibility)*

54. **[src/extensions/acp/agent.ts:431-440]** `extNotification` only handles `_goodvibes/directive`. No code sends `_goodvibes/status` or `_goodvibes/events` notifications to clients via `conn.extNotification()`. *(Extensibility)*

55. **[src/extensions/acp/extensions.ts:54-56]** `_goodvibes/status` implemented as a request handler but spec defines it as a notification (agent→client, fire-and-forget). Refactor to proactive push via `conn.extNotification()`. *(Extensibility)*

### Analytics Plugin
56. **[src/plugins/analytics/engine.ts]** Analytics response format doesn't match spec `GoodVibesAnalyticsResponse`. Engine returns a different shape. *(Extensibility)*

57. **[src/plugins/analytics/index.ts:43-44]** Registry parameter cast as `unknown`. Should also register as `tool-provider` via `registerMany` for tool dispatch discovery. *(Extensibility)*

58. **[src/plugins/frontend/index.ts:43-45]** Same pattern — registers only in single-value registry, not as `tool-provider`. *(Extensibility)*

59. **[src/plugins/analytics/engine.ts:80-100]** `track()` doesn't emit `_goodvibes/events` notifications on budget threshold crossings. Warnings only returned when polled. *(Extensibility)*

### Dead Code
60. **[src/extensions/services/auth.ts (whole file)]** `AuthOrchestrator` exported but never imported outside its module. Also handles outbound service auth, but no ACP inbound `authenticate` method handler exists. *(Initialization)*

61. **[src/extensions/services/health.ts (whole file)]** `ServiceHealthChecker` exported but never imported — dead code. Checks external HTTP services, not ACP connection health. *(Initialization)*

62. **[src/extensions/external/ (all files)]** Entire module is dead code — zero imports outside its directory. ~690 lines unintegrated. *(TypeScript SDK)*

63. **[src/extensions/external/normalizer.ts:19-30]** `NormalizedEvent` format doesn't align with ACP `SessionNotification`. Has `{source, type, payload}` instead of `{sessionId, update}`. *(TypeScript SDK)*

### Hooks
64. **[src/extensions/hooks/registrar.ts:47-108]** No tool lifecycle hooks registered. Events system defines `tool:called` and `tool:executed` but `registerBuiltins()` registers zero hooks for these. *(Permissions)*

65. **[src/extensions/hooks/built-ins.ts:18-28]** `validateAgentConfig` doesn't check permission-related fields when spawning agents. *(Permissions)*

### Permissions
66. **[src/types/permissions.ts:40-53]** `PermissionRequest` lacks `sessionId` field. Spec wire format requires `sessionId` in every `session/request_permission`. *(Permissions)*

67. **[src/extensions/acp/permission-gate.ts:80-86]** Cancellation handling doesn't conform to spec. Spec: if client sends `session/cancel` while permission is in-flight, resolve as `granted: false` with `stopReason: "cancelled"`. Implementation catches errors generically. *(Permissions)*

68. **[src/types/permissions.ts:40-53]** `PermissionRequest` includes `arguments` field not in spec's `Permission` object shape. Spec: `type` (required), `title` (required), `description` (required), `_meta` (optional). Remove `arguments`. *(Permissions)*

### WRFC / Main
69. **[src/main.ts:247-266]** WRFC tool_call updates use `'in_progress'` status instead of spec-mandated two-step `pending → running`. Emit two separate updates: first `'pending'`, then `'running'`. *(Implementation Guide)*

70. **[src/main.ts:258-266]** Tool call emissions do not include `_meta` with `_goodvibes/attempt` and `_goodvibes/phase`. Spec explicitly requires these on every tool_call update. *(Implementation Guide)*

71. **[src/main.ts:276-281]** Review completion `tool_call_update` passes `{ score: result.score }` without `_goodvibes/` namespace. Use `{ '_goodvibes/score': result.score, '_goodvibes/minimumScore': wrfcConfig.minReviewScore, '_goodvibes/dimensions': result.dimensions }`. *(Implementation Guide)*

72. **[src/main.ts:221]** Reviewer retrieved via `registry.getAll<IReviewer>('reviewer')` with first-value extraction. Spec uses single-value `registry.get<IReviewer>('reviewer')`. Using `getAll` masks a missing reviewer (falls back to score 10). *(Implementation Guide)*

73. **[src/main.ts:70, 428]** Config instance created but voided/unused. No `config.onChange → eventBus.emit` wiring exists. Config is inert. Wire it or remove. *(Implementation Guide)*

### Lifecycle — Shutdown
74. **[src/extensions/lifecycle/shutdown.ts]** No explicit ACP session cleanup. No ACP-specific shutdown handlers (closing sessions, sending shutdown notifications, draining JSON-RPC requests). *(Initialization)*

### Core EventBus
75. **[src/core/event-bus.ts:167-169]** `sessionId` extraction is fragile — unsafe cast `(payload as Record<string, unknown>)?.sessionId`. EventBus should accept `sessionId` as explicit `emit()` parameter. Breaks on primitives, arrays, or payloads without sessionId. *(Overview)*

76. **[src/core/event-bus.ts:174-176]** Ring buffer uses `shift()` — O(n) per emit. For high-frequency ACP streaming updates this degrades linearly. Use a circular buffer index or deque. *(Overview)*

77. **[src/core/config.ts:146-149]** Env var path mapping incorrect for multi-segment keys. `GOODVIBES_AGENTS_MAX_PARALLEL` maps to `agents.max.parallel` instead of `agents.maxParallel`. Silent misconfiguration. *(Overview)*

### Agent Spawn / Loop
78. **[src/plugins/precision/index.ts:434]** No `tool_call` status emission hook. `execute()` provides no mechanism for L2 ACP layer to emit `pending → running → completed` updates. Needs `onStatus` callback. *(Implementation Guide)*

79. **[src/plugins/agents/spawner.ts:94-210]** Agent spawn doesn't capture `filesModified`. Array initialized empty, never populated. ACP clients cannot display changed files. *(Implementation Guide)*

80. **[src/plugins/agents/loop.ts:175-237]** Tool calls executed sequentially despite comment saying "parallel order". Use `Promise.all` for independent calls. *(Implementation Guide)*

81. **[src/plugins/agents/spawner.ts:118-119]** Immediate `spawned → running` transition with no `pending` state. No window for L2 to emit ACP `pending` tool_call. *(Implementation Guide)*

### IPC
82. **[src/extensions/ipc/protocol.ts:73-88]** Deserializer validation incomplete — no type discriminant validation, no method field check on requests, no message size limit. *(TypeScript SDK)*

### WRFC Orchestrator
83. **[src/extensions/wrfc/orchestrator.ts:300-312]** Cancellation bypasses state machine integrity — transitions to `failed` via FAIL event then manually overwrites context.state to `escalated`. Split-brain: `machine.current()` returns `failed` while context says `escalated`. Spec requires `stopReason: "cancelled"`. *(Prompt Turn)*

84. **[src/extensions/acp/agent.ts:335-340]** Error condition returns `stopReason: 'end_turn'` instead of distinguishing errors from normal completion. Map error types to `'refusal'` or propagate as JSON-RPC errors. *(Prompt Turn)*

85. **[src/extensions/lifecycle/shutdown.ts:87-96]** `registerPlugin` hardcodes L3 (300) shutdown order. No mechanism for plugins to specify custom ordering. *(Initialization)*

86. **[src/extensions/sessions/manager.ts:235]** `setConfigOption` returns `void` instead of full config state. Spec says response must include ALL `configOptions`. *(Sessions)*

87. **[src/types/events.ts:32-39]** `SessionEventType` union missing `session:state-changed` and `session:mode-changed` — both emitted by `SessionManager` but not typed. *(Sessions)*

88. **[src/extensions/mcp/transport.ts:119-128]** MCP initialize handshake does not capture or expose server capabilities (`serverCapabilities: { tools, resources, prompts }`). Initialize response is discarded. *(Tools & MCP)*

89. **[src/extensions/acp/session-adapter.ts:183-188]** All errors in `_safeSessionUpdate` silently swallowed with empty `catch`. Makes debugging notification delivery failures impossible. Add conditional logging for non-connection-closed errors. *(Sessions)*

90. **[src/extensions/acp/tool-call-emitter.ts:31, 37]** `emitToolCall` accepts `name` parameter but never includes it in the `tool_call` update. `name` is silently dropped. Include `name` or remove the parameter. *(Tools & MCP)*

91. **[src/extensions/mcp/tool-call-bridge.ts:70]** `activeIds` keyed by tool name — concurrent same-tool calls overwrite each other's tracking state. *(Tools & MCP)*

92. **[src/plugins/agents/providers/anthropic.ts:30-38]** No `AbortSignal` forwarding to Anthropic API in `chat()`. Cancellation flow broken. *(Implementation Guide)*

93. **[src/plugins/agents/providers/anthropic.ts:50-87]** No `AbortSignal` forwarding in `stream()`. Same issue as #92. *(Implementation Guide)*

94. **[src/plugins/skills/registry.ts:23-112]** Skill content is placeholder-level — single sentences. Not actionable for agents. *(Implementation Guide)*

---

## Minor (68)

### Transport / Protocol Types
95. **[src/types/events.ts:32-39]** Missing ACP-specific session/update event types: `agent_message_chunk`, `tool_call`, `tool_call_update`, `plan`, `agent_thought_chunk`, `session_info`, `available_commands`, `current_mode`, `config_option`. Add `AcpUpdateEventType` union or document why handled outside L0 event types. *(Overview)*

96. **[src/types/events.ts:24]** `_meta` field uses `Record<string, unknown>` but W3C trace context reserved keys (`traceparent`, `tracestate`, `baggage`) are not documented. Add comment, type, or `MetaReservedKeys` constant. *(Overview)*

97. **[src/types/constants.ts:(after line 36)]** Missing `ACP_PROTOCOL_VERSION` constant. Spec states "Protocol Version: 1". Add `export const ACP_PROTOCOL_VERSION = 1 as const`. *(Overview)*

### ACP Agent — Initialization
98. **[src/extensions/acp/agent.ts:109-110]** No logging of client capabilities or `clientInfo` to stderr on initialize. Spec implementation checklist: "Agent logs client capabilities to stderr for debugging." *(Initialization)*

99. **[src/types/config.ts:80]** `SessionConfigOptionChoice` uses `label` instead of `name`. ACP SDK type `SessionConfigSelectOption` uses `name: string`. *(Initialization)*

### Sessions
100. **[src/extensions/acp/config-adapter.ts:22-23]** Config option IDs use dotted namespace (`'goodvibes.mode'`, `'goodvibes.model'`) while spec examples use simple IDs (`'mode'`, `'model'`). Clients matching on `'mode'` won't find `'goodvibes.mode'`. *(Sessions)*

101. **[src/types/session.ts:60]** `SessionConfigOptionValue` allows `boolean | number` but ACP `ConfigOption` only defines `type: "select"` with string values. Creates type mismatch on serialization. Restrict to string, or add serialization layer. *(Sessions)*

102. **[src/extensions/memory/manager.ts:26]** No schema migration logic. `SCHEMA_VERSION = '1.0.0'` defined but `load()` doesn't validate or migrate between versions. *(Sessions)*

### Prompt Turn
103. **[src/extensions/acp/agent.ts:267-272, 296-299, 304-308, 318-321]** Code emits a `'finish'` `sessionUpdate` not defined in spec. Turn ends when `session/prompt` response is returned with `stopReason`. Remove `'finish'` emissions. *(Prompt Turn)*

104. **[src/extensions/acp/agent.ts:302-323]** On error, prompt handler returns `{ stopReason: 'end_turn' }` instead of `'refusal'`. Spec defines `'refusal'` for "Agent refuses to continue." *(Prompt Turn)*

105. **[src/extensions/acp/agent.ts:226-327]** Missing `agent_thought_chunk` and `config_options_update` emissions during prompt turns. Consider emitting `config_options_update` when mode/model changes during a turn. *(Prompt Turn)*

106. **[src/extensions/acp/agent-event-bridge.ts:86]** Maps `cancelled` agent status to ACP `'failed'` ToolCallStatus. Spec defines `'cancelled'` as valid. *(Prompt Turn)*

107. **[src/extensions/wrfc/handlers.ts:140-147]** Re-emits `wrfc:state-changed` as `wrfc:phase-changed` — redundant, no consumer found. *(Prompt Turn)*

108. **[src/extensions/directives/queue.ts:217]** `process()` drains ALL directives before processing — misses concurrently enqueued directives during drain window. *(Prompt Turn)*

109. **[src/extensions/wrfc/orchestrator.ts (general)]** No guarantee ACP bridge is registered before orchestrator emits events. *(Prompt Turn)*

### Permissions
110. **[src/types/permissions.ts:60-64]** `PermissionResult` uses `status: 'granted' | 'denied'` instead of spec `{ granted: boolean }`. *(Permissions)*

111. **[src/extensions/acp/permission-gate.ts:30-51]** Mode naming doesn't align with spec. Spec references "ask mode", "code mode", "yolo/auto mode". Implementation uses `'justvibes'`, `'vibecoding'`, `'plan'`, `'sandbox'`. Add documentation mapping each mode to its spec equivalent. *(Permissions)*

112. **[src/extensions/acp/permission-gate.ts:136]** `toolCallId` construction (`request.toolName ?? 'permission-${type}'`) doesn't follow spec. `toolCallId` should match the `tool_call` update sent before the request. Require caller to pass the actual `toolCallId`. *(Permissions)*

113. **[src/extensions/hooks/index.ts:9]** Barrel export only exports `HookRegistrar`. Built-in hook functions not re-exported. *(Permissions)*

### Tools & MCP
114. **[src/extensions/mcp/tool-call-bridge.ts:85,101,117]** `.catch(() => {})` silently swallows emission errors throughout. *(Tools & MCP)*

115. **[src/extensions/mcp/bridge.ts:200-213]** `McpServerStdio.env` treated as array `{name, value}` vs spec `Record<string,string>`. SDK is reportedly correct; KB docs may be stale. Document the discrepancy. *(Tools & MCP)*

116. **[src/plugins/review/scoring.ts:24-35]** Dimension names/weights differ from the 10-Category Framework defined in the review skill. Align or document deviation. *(Tools & MCP)*

### Filesystem & Terminal
117. **[src/extensions/acp/terminal-bridge.ts:70-86]** `terminal/create` ACP call passes `args` field not in spec wire format. Spec params: `sessionId`, `command`, `env`, `cwd`. Also `env` is never forwarded despite spec support. Remove `args` (concatenate into command), add `env`. *(Filesystem & Terminal)*

118. **[src/extensions/acp/terminal-bridge.ts:134-143]** `output()` does not forward `timeout`. Return type is `string` but spec returns `{ output: string; exitCode: number | null }` — `exitCode` is discarded. *(Filesystem & Terminal)*

119. **[src/extensions/acp/terminal-bridge.ts:156-168]** `waitForExit()` does not support `timeout` parameter. Spec defines `terminal/wait_for_exit` with optional `timeout`. *(Filesystem & Terminal)*

120. **[src/plugins/project/db.ts:9,29]** `DatabaseTools.parsePrismaSchema` reads via direct `readFile`. Dual-path pattern should apply for consistency with `ITextFileAccess`. *(Filesystem & Terminal)*

121. **[src/plugins/project/test.ts:8,99,127]** `TestAnalyzer` reads test files directly — misses editor buffer state. *(Filesystem & Terminal)*

122. **[src/extensions/logs/manager.ts:9,84,97,100]** `LogsManager` uses direct `readFile`/`writeFile`/`appendFile`. Routing through `ITextFileAccess.writeTextFile` would notify editor of changes. *(Filesystem & Terminal)*

### Extensibility
123. **[src/extensions/acp/agent.ts:188-191]** `session/update` notifications during `loadSession` do not include `_meta` with GoodVibes-specific data (`_goodvibes/phase: 'replay'`). *(Extensibility)*

124. **[src/extensions/acp/extensions.ts:1-321]** No guard against overwriting W3C reserved `_meta` keys (`traceparent`, `tracestate`, `baggage`). Add validation utility or document invariant. *(Extensibility)*

125. **[src/extensions/acp/event-recorder.ts:52-57]** `RecordedEvent` does not capture `_meta` from source events — any `_meta` is lost on recording. Add optional `_meta` field. *(Extensibility)*

126. **[src/plugins/analytics/engine.ts]** No `_meta` field support for trace context propagation. *(Extensibility)*

### TypeScript SDK
127. **[src/extensions/acp/agent.ts:270, 298, 306, 320]** `finish` session update uses `as any` cast. Fix underlying type mismatch; remove cast. *(TypeScript SDK)*

128. **[src/extensions/acp/agent.ts:301, 323]** `PromptResponse` returns `{ stopReason: string }` but SDK defines it as `{}`. Content comes via sessionUpdate notifications. Return `{}`. *(TypeScript SDK)*

129. **[src/extensions/acp/agent.ts:63-64]** `session_info_update` discriminant uncertainty noted in comment but unresolved. Verify exact discriminant against SDK's `SessionUpdate` type definition. *(TypeScript SDK)*

130. **[src/extensions/acp/terminal-bridge.ts:10]** `TerminalHandle` imported as value but only used as type annotation. Use `import type { TerminalHandle }`. *(TypeScript SDK)*

131. **[src/extensions/acp/terminal-bridge.ts:138-139]** `currentOutput()` response accessed as `result.output` — verify actual field name from SDK types. *(TypeScript SDK)*

132. **[src/extensions/ipc/socket.ts:152]** `setEncoding('utf-8')` forces all data through string decoding. Malformed UTF-8 silently replaced. *(TypeScript SDK)*

133. **[src/extensions/agents/tracker.ts:140-146]** `activeCount()` iterates all keys twice (get + filter) — N+1 store lookups. *(TypeScript SDK)*

134. **[src/extensions/agents/coordinator.ts:84]** `_pendingResolvers` uses object reference equality for Map keys — breaks if configs are cloned. *(TypeScript SDK)*

135. **[src/extensions/external/file-watcher.ts:198-199]** `rename` event always mapped to `created`, never `deleted`. Needs `stat` check to distinguish. *(TypeScript SDK)*

### Implementation Guide
136. **[src/main.ts:203]** Registry key `'agent-spawner'` uses kebab-case. Spec uses snake_case: `'agent_spawner'`. *(Implementation Guide)*

137. **[src/main.ts:96-102]** Shutdown handlers don't include L3 plugin teardown. Spec implies L3 → L2 → L1 shutdown order. L3 plugins have no shutdown handlers. Register with lower priorities (5–9). *(Implementation Guide)*

138. **[src/extensions/wrfc/handlers.ts:75-110]** Event handlers use untyped payload casting (`event.payload as { ... }`). Define typed event maps or use Zod schemas at subscription boundaries. *(Implementation Guide)*

139. **[src/main.ts:99]** Shutdown handler references `mcpBridge` declared 40 lines later. Works via lazy closure but creates fragile ordering dependency. Move shutdown registrations after all service instantiations. *(Implementation Guide)*

140. **[src/plugins/agents/loop.ts:82]** No system prompt enrichment with task context (cwd, workspace roots, available tools). *(Implementation Guide)*

141. **[src/plugins/agents/providers/mock.ts:59-67]** Mock `stream()` skips `tool_use` blocks — tests cannot exercise the tool execution loop via streaming. *(Implementation Guide)*

### Core
142. **[src/core/state-machine.ts:159-165]** Async `onEnter`/`onExit` hooks are fire-and-forget — errors silently swallowed with `catch(() => {})`. State entry/exit side effects (e.g., persisting session state) can fail silently. *(Overview)*

143. **[src/core/trigger-engine.ts:40-48]** Regex pattern creates new `RegExp` on every event evaluation. `TriggerEngine` subscribes to `*`, making this wasteful. Compile and cache at registration time. *(Overview)*

144. **[src/core/state-store.ts:47-72]** Duplicated `deepMerge` implementation between `config.ts` and `state-store.ts`. Extract to shared utility. *(Overview)*

145. **[src/core/scheduler.ts:232-241]** Scheduler swallows handler errors silently with no EventBus dependency for error reporting. *(Overview)*

146. **[src/core/queue.ts:70-80]** O(n) insertion on every enqueue — linear scan for priority position. Use binary search or heap for large queues. *(Overview)*

### Lifecycle
147. **[src/extensions/lifecycle/health.ts:41,44]** `_eventBus` injected but never used to emit events. Health state transitions should emit events for ACP transport reactivity. *(Initialization)*

148. **[src/extensions/lifecycle/daemon.ts:246]** `_stopTcpServer()` sets `this._tcpServer = null` before close callback fires — state inconsistency during close. *(Initialization)*

149. **[src/extensions/lifecycle/shutdown.ts:103-108]** Timeout timer never cleared on success — timer leak. *(Initialization)*

150. **[src/extensions/wrfc/handlers.ts:77]** `event.payload as { ... }` — unsafe cast without runtime validation. *(Prompt Turn)*

151. **[src/extensions/wrfc/orchestrator.ts:182]** `agentResult.errors.map((e) => e.message ?? ...)` assumes error shape without null guard on array. *(Prompt Turn)*

152. **[src/plugins/precision/types.ts:22]** `ExtractMode` missing `'ast'` which appears in the MCP tool schema. *(Implementation Guide)*

153. **[src/plugins/agents/loop.ts:241-242]** Comment says `'precision__read_file'` but actual names would be `'precision__precision_read'`. *(Implementation Guide)*

154. **[src/plugins/analytics/export.ts:136-140]** Dead method `_formatEntry()` — always returns `''`, suppressed with eslint-disable. *(Extensibility)*

155. **[src/plugins/frontend/accessibility.ts:317]** Empty `catch` block silently swallows file read errors. *(Extensibility)*

156. **[src/plugins/analytics/sync.ts:48]** `JSON.parse(raw) as SessionAnalytics` — unsafe cast with no runtime validation. *(Extensibility)*

157. **[src/plugins/frontend/components.ts:62-70]** Sequential file processing — could use `Promise.all` with batching. *(Extensibility)*

158. **[src/extensions/mcp/tool-call-bridge.ts:27-29]** Comment says `status: in_progress` but KB uses `running` (SDK may use `in_progress` — KB is stale here). Resolve the discrepancy. *(Tools & MCP)*

159. **[src/extensions/sessions/modes.ts]** No legacy `modes` response format produced. Spec says agents SHOULD send both `configOptions` and `modes` during transition. *(Sessions)*

160. **[src/extensions/lifecycle/daemon.ts:65-66]** Health endpoint response lacks ACP metadata (protocol version, capabilities, connected clients). *(Initialization)*

161. **[src/extensions/services/registry.ts:153]** No validation that `config.endpoint` is a valid URL. *(Initialization)*

162. **[src/plugins/agents/loop.ts:175-237]** Sequential tool execution contradicts "parallel order" comment. Refer to issue #80 for context; this is the minor form noted separately in W2. *(Implementation Guide)*

---

## Nitpick (38)

### Transport / Types
163. **[src/extensions/acp/transport.ts:53]** `AcpStream` defined as `ReturnType<typeof acp.ndJsonStream>` — couples the type to SDK implementation detail. Define explicitly based on spec Stream type, or add a type assertion. *(Overview)*

164. **[src/main.ts:410-413]** Duplicated stdio transport creation in subprocess mode. `createStdioTransport()` is exported but not imported in `main.ts`. Use it instead of inline `acp.ndJsonStream(...)`. *(Overview)*

### ACP Agent — Initialization
165. **[src/extensions/acp/agent.ts:115]** Hardcoded version string `'0.1.0'` will drift from `package.json`. Import version from `package.json` or a shared constants module. *(Initialization)*

### Sessions
166. **[src/extensions/acp/config-adapter.ts:38-41]** Default model `'claude-sonnet-4-6'` does not appear in the options list. `currentValue` won't match any option, confusing client select dropdowns. Add to options or change the default. *(Sessions)*

167. **[src/extensions/sessions/manager.ts:235]** `setConfigOption` accepts `value: string` but `SessionConfigOptionValue` is `string | boolean | number`. Type inconsistency. Align parameter type or narrow the union. *(Sessions)*

168. **[src/types/session.ts:13]** `SessionState` lacks `'paused'`/`'suspended'` states for long-running sessions. *(Sessions)*

169. **[src/extensions/memory/manager.ts:88-97]** `MemoryManager` is purely cross-session; no session-scoped state persistence mechanism exists. *(Sessions)*

### Prompt Turn
170. **[src/extensions/acp/commands-emitter.ts:19-50]** Commands use `'name'` with `'/'` prefix (e.g., `'/status'`) but spec uses `'id'` as primary identifier and `'name'` as human-readable. Use `{ id: 'status', name: 'Show status', description: '...' }` pattern. *(Prompt Turn)*

171. **[src/extensions/acp/plan-emitter.ts:121-138]** Internal interface uses `title` mapped to `content` on emit. Rename `InternalPlanEntry.title` to `.content` for wire-format consistency. *(Prompt Turn)*

172. **[src/extensions/wrfc/handlers.ts:77]** `event.payload as { ... }` — unsafe cast. (Also noted as minor #150; this entry notes the nitpick-level incidence in a separate location.) *(Prompt Turn)*

### Permissions
173. **[src/types/permissions.ts:29-30]** `PermissionStatus` defines `'granted' | 'denied'` but spec uses simple boolean `granted: true|false`. Document mapping explicitly: `status: 'granted'` equals `granted: true` on wire. *(Permissions)*

174. **[src/extensions/hooks/built-ins.ts:19]** `context` parameter typed as `Record<string, unknown>` — loses type safety. Should use `AgentConfig`. *(Permissions)*

### Tools & MCP
175. **[src/extensions/mcp/tool-proxy.ts:76-116]** `execute` method wraps MCP results but does not emit ACP `tool_call`/`tool_call_update` notifications. No integration between `McpToolProxy` and `ToolCallEmitter`. Document caller responsibility or integrate. *(Tools & MCP)*

176. **[src/extensions/mcp/transport.ts:177-178]** `stdin.write` uses non-null assertion (`this._process.stdin!`). Unhelpful `TypeError` on null. Add guard or assert in constructor that stdin/stdout are available. *(Tools & MCP)*

177. **[src/extensions/mcp/bridge.ts:191]** Uses `console.error` directly instead of structured logging. *(Tools & MCP)*

178. **[src/extensions/mcp/tool-call-bridge.ts:60]** Comment says `status: in_progress` but KB uses `running`. *(Tools & MCP)*

### Filesystem & Terminal
179. **[src/extensions/acp/terminal-bridge.ts:97]** Spawn fallback uses `shell: false`. Spec's `terminal/create` sends command as string that may include shell syntax. Consider `shell: true` for the spawn fallback. *(Filesystem & Terminal)*

180. **[src/extensions/acp/fs-bridge.ts:56, 86]** `VALID_ENCODINGS` set recreated on every read/write call. Move to module-level constant. *(Filesystem & Terminal)*

181. **[src/plugins/project/index.ts:77]** `register` casts `registry as Registry` — couples L3 to L1 internals. *(Filesystem & Terminal)*

182. **[src/extensions/logs/manager.ts:76-102]** `prependEntry` has fragile insertion strategy (splitting on first `\n\n`). *(Filesystem & Terminal)*

### Extensibility
183. **[src/extensions/acp/extensions.ts:20]** META version key is un-namespaced (`"version"` not `"_goodvibes/version"`). Rename to `_goodvibes/version` for namespace consistency. *(Extensibility)*

184. **[src/extensions/acp/index.ts:21]** `GoodVibesExtensions` exported but not wired to `GoodVibesAgent`. No visible integration point for `extensions.handle()` from agent `extMethod`. Document or implement the composition root wiring. *(Extensibility)*

### TypeScript SDK
185. **[src/extensions/acp/agent.ts:63-64]** `session_info_update` discriminant uncertainty documented in comment but unresolved. Check SDK types. (Duplicates minor #129 at nitpick severity.) *(TypeScript SDK)*

186. **[src/extensions/ipc/router.ts:66]** Parameter named `type` shadows message `type` field concept. Rename to `methodName`. *(TypeScript SDK)*

### Implementation Guide
187. **[src/main.ts:99]** Shutdown handler references `mcpBridge` 40 lines before its declaration. Works via lazy closure but fragile. (Also noted as minor #139.) *(Implementation Guide)*

188. **[src/extensions/wrfc/orchestrator.ts:165-168]** Agent config hardcodes type as `'engineer'` for initial spawn. Spec uses `'engineer'` for attempt 1 and `'fixer'` for subsequent. Document as intentional design decision. *(Implementation Guide)*

189. **[src/plugins/precision/types.ts:22]** `ExtractMode` missing `'ast'` (also noted as minor #152 — this is the nitpick-category occurrence). *(Implementation Guide)*

190. **[src/plugins/agents/loop.ts:241-242]** Comment says `'precision__read_file'` but actual names would be `'precision__precision_read'`. *(Implementation Guide)*

191. **[src/plugins/skills/types.ts:21]** `SkillDefinition.content` typed as `string` with no max length constraint. *(Implementation Guide)*

### Core
192. **[src/core/event-bus.ts:283-284]** Event IDs use `Date.now() + counter` — not globally unique across instances/restarts. Use `crypto.randomUUID()`. *(Overview)*

193. **[src/core/config.ts:347-349]** Config swallows listener errors silently — empty `catch {}`. *(Overview)*

194. **[src/core/registry.ts:37-39]** Registry uses `unknown` type erasure for `_single` and `_multi` maps. No runtime type safety. *(Overview)*

195. **[src/core/index.ts:1-90]** Barrel re-exports types through double-hop (`trigger-engine.ts` re-exports from `../types/`). *(Overview)*

### Lifecycle
196. **[src/extensions/lifecycle/daemon.ts:65-66]** Health endpoint response lacks ACP metadata. (Also noted as minor #160.) *(Initialization)*

197. **[src/extensions/services/registry.ts:153]** No validation that `config.endpoint` is a valid URL. (Also noted as minor #161.) *(Initialization)*

---

## Cross-Cutting Themes

### 1. Field Name Mismatches with SDK
Multiple files use incorrect field names causing runtime failures:
- `params.prompt` → `params.messages` (issue #5)
- `response.content` → `response.text` for file reads (issue #21)
- `content` → `text` for file writes (issue #22)
- `mcpCapabilities` → `mcp`, `promptCapabilities` → `prompt` (issue #4, #78)

### 2. Wrong SessionUpdate Discriminators
- `session_info_update` → `session_info` (issue #6)
- `available_commands_update` → `available_commands` (issue #7)
- `current_mode_update` missing entirely (issue #11)

### 3. PermissionGate Disconnected
- Wrong wire format — options-based vs boolean (issues #13, #14)
- Wrong permission types (issue #12)
- Never integrated into agent (issue #15)
- No pre-hook on tool execution (issue #16)

### 4. Missing Wire Format Fields
- Missing `kind` on `tool_call` (issues #37, #44)
- Missing `content`, `locations`, `input` on `tool_call` (issue #40)
- Missing `authMethods` in initialize (issue #3)
- Missing `_meta` with `_goodvibes/` keys on WRFC tool calls (issues #70, #71)

### 5. Extension System Disconnect
- `GoodVibesExtensions` not wired to `GoodVibesAgent` (issue #52)
- Status/events implemented as requests, should be notifications (issue #55)
- No outbound `_goodvibes/status` notifications during WRFC (issue #54)
- Plugins don't implement `IToolProvider` (issues #23, #24, #25)

### 6. Direct FS Instead of ITextFileAccess
Project plugins bypass the ACP filesystem abstraction:
- `deps.ts`, `security.ts`, `analyzer.ts` (issues #49–51)
- `db.ts`, `test.ts`, `logs/manager.ts` (issues #120–122)

### 7. Silent Error Swallowing
Widespread `.catch(() => {})` and empty catch blocks across core, hooks, lifecycle, and MCP modules (issues #25, #89, #114, #142, #145, #155).

### 8. Dead / Orphaned Code
- `AuthOrchestrator` — never imported (issue #60)
- `ServiceHealthChecker` — never imported (issue #61)
- `src/extensions/external/` — ~690 lines orphaned (issue #62)
- `export.ts:_formatEntry()` — dead method (issue #154)
