# ACP Compliance Review — Iteration 4 Consolidated Issues

## Summary
- Critical: 12
- Major: 33
- Minor: 30
- Nitpick: 11
- Total (deduplicated): 86

---

## Critical Issues

### 1. AcpSessionUpdateType discriminator values are wrong (KB-04, KB-09: Session Updates)
**File**: `src/types/events.ts`
**Lines**: 263-273
**Description**: The `AcpSessionUpdateType` union contains multiple incorrect discriminator values. Five values have incorrect suffixes (missing `_update`): `available_commands` should be `available_commands_update`, `current_mode` should be `current_mode_update`, `config_option` should be `config_option_update` (or `config_options_update` — needs SDK verification), `session_info` should be `session_info_update`. Additionally, `user_message_chunk` and `usage_update` are missing, and `finish` is present but not defined in the SDK.
**Remediation**: Replace the union with SDK-authoritative values. Verify exact discriminator strings against `@agentclientprotocol/sdk` v0.15.0 type definitions.

### 2. ToolCallStatus uses 'running'/'error' instead of SDK's 'in_progress'/'failed' (KB-06, KB-09: Tool Calls)
**File**: `src/types/events.ts`, `src/extensions/hooks/registrar.ts:205`, consumers
**Lines**: Various
**Description**: The SDK defines `ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'`. The codebase uses `'running'` (from KB-06 prose) and `'error'` (hooks registrar) instead. Any runtime code emitting these non-standard values produces non-compliant ACP wire messages. Clients expect `'in_progress'` and `'failed'`.
**Remediation**: Define a canonical `ToolCallStatus` type using SDK values and update all consumers.

### 3. Missing `finish` SessionUpdate before PromptResponse (KB-09: Session Updates)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 403-429
**Description**: The agent returns `{ stopReason: 'end_turn' }` in the `PromptResponse` but does not emit a `finish` SessionUpdate notification before returning. The SDK example agent emits `sessionUpdate: 'finish'` with the stopReason before returning `{}` from `prompt()`. Clients may rely on this notification.
**Remediation**: Emit a `finish` sessionUpdate notification with the stopReason before returning the PromptResponse.

### 4. `session/load` ignores incoming `cwd` and `mcpServers` from request params (KB-03: Sessions)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 279-331
**Description**: `loadSession()` uses `context.config.mcpServers` from the original session, ignoring `params.mcpServers` and `params.cwd` from the `LoadSessionRequest`. KB-03 states: "MCP server config can differ between original and resumed session. The Agent reconnects to whatever servers are provided in `session/load`."
**Remediation**: Use params from the load request, not stored config.

### 5. ReadTextFileResponse/WriteTextFileRequest field name mismatch (KB-09: Filesystem)
**File**: `src/extensions/acp/fs-bridge.ts`
**Lines**: 62, 101-105
**Description**: The code uses `response.content` for reads and `{ content }` for writes, but the SDK types use `response.text` and `{ text }` respectively. Reads return `undefined`, writes send empty content on the ACP path. Note: If the SDK's actual types use `content`, these are false positives — verify against SDK v0.15.0.
**Remediation**: Change to `response.text` for reads and `text: content` for writes, or verify SDK types.

### 6. stderr pipe pollutes ACP ndjson transport (KB-06: MCP Transport)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 267
**Description**: `child.stderr?.pipe(process.stderr)` forwards MCP server stderr directly to the agent's stderr. MCP servers can emit noisy debug output that will intermingle with agent diagnostic output. Certain client implementations may capture stderr for error display.
**Remediation**: Route stderr through the EventBus or a structured logger instead of piping directly.

### 7. Missing `mcpCapabilities` declaration in agent initialize response (KB-06: MCP)
**File**: `src/extensions/mcp/bridge.ts`
**Lines**: 224-236
**Description**: The agent MUST declare `agentCapabilities.mcp: { http: boolean, sse: boolean }` during `initialize` so clients know which MCP transports are supported. Only a comment acknowledges this gap.
**Remediation**: Declare `mcpCapabilities` in the agent's initialize response.

### 8. SQL injection in `generateQuery` WHERE clause (KB-05: Safe Execution)
**File**: `src/plugins/project/db.ts`
**Lines**: 187
**Description**: The `where`, `table`, and `columns` parameters are interpolated directly into SQL string templates without sanitization. Attacker-controlled input via ACP tool calls can inject arbitrary SQL.
**Remediation**: Validate identifiers against an allowlist or restrict to identifier characters. For `where`, disallow freeform SQL or clearly document as template-only.

### 9. `description` field lost in SDK permission request construction (KB-05: Permissions)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 139-149
**Description**: `buildPermissionRequest()` constructs the SDK `toolCall` object but never passes `request.description`. ACP requires `description` as mandatory on the Permission object. The client has no way to show the user what action is being gated.
**Remediation**: Add `description: request.description` to the `toolCall` object.

### 10. `isGranted()` receives full response object but casts incorrectly (KB-10: Permissions)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 104-117, 230
**Description**: `isGranted(response)` receives the full `RequestPermissionResponse` and casts it as `RequestPermissionOutcome`. The SDK response shape is `{ outcome: RequestPermissionOutcome }`, so `response.outcome` is the inner object. The cast papers over a potential unwrapping bug.
**Remediation**: Pass `response.outcome` to `isGranted()`, or update the function to unwrap correctly.

### 11. No `agent_message_chunk` streaming during LLM inference (KB-04: Prompt Turn)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 139-148
**Description**: The loop uses non-streaming `provider.chat()` and never emits `agent_message_chunk` session updates. ACP clients expect streaming text deltas during inference. Tracked as ISS-060.
**Remediation**: Implement streaming via the provider and emit `agent_message_chunk` updates.

### 12. IpcNotification uses `event` instead of `method` — violates JSON-RPC 2.0 (KB-01: JSON-RPC 2.0)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 64-71
**Description**: The module claims JSON-RPC 2.0 compliance but `IpcNotification` uses an `event` field instead of the required `method` field. Any JSON-RPC 2.0 compliant parser would reject these notifications.
**Remediation**: Rename `event` to `method` or drop the JSON-RPC 2.0 compliance claim.

---

## Major Issues

### 13. `session_info_update` vs `session_info` discriminator and payload mismatch (KB-04: Session Updates)
**File**: `src/extensions/acp/agent.ts`, `src/extensions/acp/session-adapter.ts`
**Lines**: 96-102, 125-131
**Description**: KB-04 defines `sessionUpdate: "session_info"` with `content: ContentBlock` payload. Implementation uses `session_info_update` with `title: string` payload — both discriminator name and payload shape differ.
**Remediation**: Verify SDK type. If SDK matches KB-04, update implementation.

### 14. `available_commands_update` discriminator and field name mismatch (KB-04: Session Updates)
**File**: `src/extensions/acp/commands-emitter.ts`
**Lines**: 106-117
**Description**: KB-04 uses discriminator `available_commands` and field `commands`. Implementation uses `available_commands_update` and `availableCommands`, with a double-cast (`as unknown as acp.SessionUpdate`) bypassing type checking.
**Remediation**: Verify SDK discriminator and align. Remove double cast.

### 15. `config_option_update` vs `config_options_update` discriminator (KB-03, KB-04: Config Options)
**File**: `src/extensions/acp/session-adapter.ts`, `src/extensions/acp/config-adapter.ts`
**Lines**: 182-186, 160-167
**Description**: KB-03 and KB-04 use `config_options_update` (plural). Implementation uses `config_option_update` (singular). The `as schema.SessionUpdate` cast bypasses type checking on the discriminator value.
**Remediation**: Verify SDK discriminator. If plural, update implementation.

### 16. SessionConfigOption.options is optional but should be required (KB-03, KB-09: Config Options)
**File**: `src/types/config.ts`
**Lines**: 119-120
**Description**: `options?:` is declared optional but both KB-03 and the SDK require it as non-optional for `type: 'select'` config options.
**Remediation**: Change `options?:` to `options:`.

### 17. SessionConfigOption missing `_meta` field (KB-08: Extensibility)
**File**: `src/types/config.ts`
**Lines**: 103-123
**Description**: The SDK includes `_meta?: { [key: string]: unknown } | null` on `SessionConfigOption`. Our type omits it, preventing extensibility metadata on config options.
**Remediation**: Add `_meta?: Record<string, unknown>` to `SessionConfigOption`.

### 18. MCPServerConfig stdio variant requires wrong discriminator (KB-09: MCP Servers)
**File**: `src/types/session.ts`
**Lines**: 48-60
**Description**: The type uses `type: 'stdio'` discriminator for stdio servers, but the SDK's `McpServerStdio` has no `type` field. Also, `args` and `env` are optional in our type but required in the SDK.
**Remediation**: Restructure to match SDK union pattern. Make `args`/`env` required.

### 19. `session/load` does not update session `cwd` on resume (KB-03: Sessions)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 124-136
**Description**: `SessionManager.load()` retrieves stored context but provides no mechanism to update `cwd` with the `session/load` request value. KB-03 states `cwd` is required and "Agent MUST use this as the session's working directory."
**Remediation**: Update session `cwd` from load request params.

### 20. `HistoryMessage` uses flat `content: string` instead of `ContentBlock` (KB-03: Sessions)
**File**: `src/types/session.ts`
**Lines**: 94-101
**Description**: ACP history replay emits ContentBlock structures. Storing content as plain string loses non-text content (images, resources).
**Remediation**: Store `ContentBlock` or `ContentBlock[]` instead of plain string.

### 21. MCP permission gate is a TODO placeholder (KB-06: MCP Tools)
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**Lines**: 101-108
**Description**: The KB mandates a permission gate between `pending` and `running` for tools with side effects. Only a TODO comment exists (ISS-024/ISS-018).
**Remediation**: Implement permission gate before tool execution.

### 22. MCP content blocks not forwarded directly to ACP (KB-06: MCP Tools)
**File**: `src/extensions/mcp/tool-call-bridge.ts`, `src/extensions/mcp/tool-proxy.ts`
**Lines**: 131-133, 94-111
**Description**: KB-06 states "MCP ContentBlock[] is directly compatible with ACP" and should be forwarded without transformation. The bridge re-wraps content as text strings, losing image/resource blocks. Empty content blocks are also forwarded incorrectly.
**Remediation**: Forward `mcpResult.content` directly as ACP `ToolCallContent[]`.

### 23. Health endpoint not integrated with HealthCheck module (KB-10: Implementation)
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 66-73
**Description**: The `/health` endpoint returns static `{ status: 'ok' }` and never queries `HealthCheck.check()`. A runtime with failing sub-checks still reports healthy.
**Remediation**: Inject `HealthCheck` and return `healthCheck.check()` from `/health`.

### 24. No `conn.signal` integration for graceful teardown (KB-10: Implementation)
**File**: `src/main.ts`
**Lines**: N/A (missing)
**Description**: KB-10 requires `conn.signal` abort to trigger graceful teardown. The codebase handles `SIGINT`/`SIGTERM` but not connection abort. In subprocess mode, client closing stdin causes no shutdown.
**Remediation**: Listen for `conn.signal` abort and trigger `shutdownManager.shutdown()`.

### 25. Config file never loaded at startup (KB-10: Implementation)
**File**: `src/main.ts`
**Lines**: 71
**Description**: `Config` is instantiated but `config.load()` is never called. Any `goodvibes.config.json` file is silently ignored.
**Remediation**: Call `await config.load()` before reading config values.

### 26. Daemon port/host bypass Config system (KB-10: Config)
**File**: `src/main.ts`
**Lines**: 465-491
**Description**: Daemon mode reads port/host directly from `process.env` and CLI args, bypassing the Config system. Creates two parallel config paths that can disagree.
**Remediation**: Read from `config.get('runtime.port')` with env/CLI as overrides.

### 27. Non-standard `type` discriminator on IPC message types (KB-01: JSON-RPC 2.0)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 34-35, 44, 55, 66
**Description**: All IPC messages include a non-standard `type` field. Standard JSON-RPC 2.0 discriminates structurally. The deserializer rejects valid JSON-RPC 2.0 messages lacking `type`.
**Remediation**: Remove `type` field and discriminate structurally, or drop JSON-RPC 2.0 compliance claim.

### 28. IpcResponse does not extend IpcMessage — no `_meta` support (KB-08: Extensibility)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 52-62
**Description**: `IpcResponse` is standalone, duplicating fields and missing `_meta` from the `IpcMessage` base.
**Remediation**: Have `IpcResponse` extend `IpcMessage`.

### 29. No buffer size limit on IPC socket connections (KB-10: Implementation)
**File**: `src/extensions/ipc/socket.ts`
**Lines**: 186-198
**Description**: `_handleData` appends to buffer without size limit. Unbounded memory growth possible from malicious or buggy clients.
**Remediation**: Add maximum buffer size (e.g., 1MB) with error handling on overflow.

### 30. ToolResult lacks `_meta` field (KB-08: Extensibility)
**File**: `src/types/registry.ts`
**Lines**: 29-40
**Description**: KB-08 states `_meta` is available on "every type in the ACP protocol" including tool calls. `ToolResult` should carry `_meta` for trace context propagation.
**Remediation**: Add `_meta?: Record<string, unknown>` to `ToolResult`.

### 31. No timeout enforcement on trigger handler execution (KB-10: Implementation)
**File**: `src/core/trigger-engine.ts`
**Lines**: 227
**Description**: The `ITriggerHandler` contract requires completion within the trigger timeout, but `TriggerEngine.evaluate()` has no timeout enforcement. Hanging handlers are never detected.
**Remediation**: Wrap `handler.execute()` with `Promise.race` against a configurable timeout.

### 32. `_analytics()` returns wrong wire format (KB-08: Extensibility)
**File**: `src/extensions/acp/extensions.ts`
**Lines**: 259-308
**Description**: Returns `{ totalTokensUsed, activeBudgets, topTools }` instead of the KB-defined `GoodVibesAnalyticsResponse` shape. The engine's `getAnalyticsResponse()` produces the correct shape but is not used.
**Remediation**: Use `getAnalyticsResponse()` in the handler.

### 33. Analytics `scope` and `id` fields from request are ignored (KB-08: Extensibility)
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 266-268
**Description**: `GoodVibesAnalyticsRequest` defines `scope: 'session' | 'workflow' | 'agent'` and optional `id`. The engine only branches on `sessionId` presence, ignoring these fields entirely.
**Remediation**: Implement scope-based filtering in `getAnalyticsResponse()`.

### 34. Cancelled tools missing ACP `tool_call_update` status events (KB-04, KB-06: Tool Calls)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 234-244
**Description**: When cancellation is detected before tool execution, no `tool_call_update` with `status: 'cancelled'` is emitted. Clients see phantom pending tool calls.
**Remediation**: Emit `tool_call_update` with `status: 'cancelled'` for all cancelled tools.

### 35. Tool Call ID reuse across WRFC retry cycles (KB-06: Tool Calls)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 263-271
**Description**: `_toolCallId()` generates deterministic IDs as `wrfc_${phase}_${workId}`. On retry cycles, the second review phase reuses the same ID, violating the ACP requirement for unique tool call IDs within a session.
**Remediation**: Append an attempt counter or generate a fresh UUID per phase invocation.

### 36. Webhook responses use plain-text instead of JSON-RPC 2.0 (KB-08: Extensibility)
**File**: `src/extensions/external/http-listener.ts`
**Lines**: 118-129, 301-303
**Description**: The `reply()` helper sends `Content-Type: text/plain`. Per KB, all ACP communication uses JSON-RPC 2.0 envelopes.
**Remediation**: Return JSON-RPC 2.0 formatted responses.

### 37. ExternalEventBridge drops NormalizedEvent fields on webhook forwarding (KB-08: Extensibility)
**File**: `src/extensions/external/index.ts`
**Lines**: 65
**Description**: Emits `event.payload` only, dropping `source`, `type`, `id`, and `timestamp` — all required for downstream `_goodvibes/events` notifications.
**Remediation**: Emit the full `NormalizedEvent` object.

### 38. No `_goodvibes/agents` wire format adapter in agents plugin (KB-08: Extensibility)
**File**: `src/plugins/agents/spawner.ts`
**Lines**: Entire file
**Description**: KB defines `_goodvibes/agents` extension method with specific wire format. The spawner has no method to produce this shape — missing `completedAt`, `score`, `minimumScore` fields.
**Remediation**: Add a wire format adapter method producing the KB-defined response shape.

### 39. `_dispatch` casts params without runtime validation (KB-06: Tool Calls)
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 259, 282-349
**Description**: Tool params are cast to typed interfaces without schema validation. Tool definitions declare JSON Schema but `execute` never validates against it.
**Remediation**: Add runtime schema validation before dispatching.

### 40. No permission gating for security-sensitive project tools (KB-05: Permissions)
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 239-256
**Description**: Tools like `project_security_secrets` and `project_code_surface` perform filesystem-wide reads without `session/request_permission` gate.
**Remediation**: Implement permission callback before executing filesystem-scanning tools.

### 41. No tool call lifecycle updates emitted by project plugin (KB-06: Tool Calls)
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 239-256
**Description**: The `execute` method does not emit any `tool_call`/`tool_call_update` session updates. ACP clients cannot show progress or status for project analysis operations.
**Remediation**: Emit lifecycle updates or document that lifecycle management is the caller's responsibility.

### 42. `ProjectAnalyzer` constructor does not receive `ITextFileAccess` from plugin registration (KB-08: Extensibility)
**File**: `src/plugins/project/index.ts`
**Lines**: 81
**Description**: `new ProjectAnalyzer()` is constructed without `ITextFileAccess`, so all sub-analyzers fall back to raw `node:fs/promises`, bypassing ACP file access.
**Remediation**: Resolve `ITextFileAccess` from the registry and inject it.

### 43. Force exit timeout (2s) conflicts with per-handler timeout (10s) (KB-10: Implementation)
**File**: `src/main.ts`
**Lines**: 436
**Description**: The 2-second force exit fires before shutdown handlers complete (10s per handler, 10+ handlers registered), potentially interrupting mid-shutdown operations.
**Remediation**: Increase timeout to exceed total handler time or use `config.get('runtime.agentGracePeriodMs')`.

### 44. Terminal bridge timer leak in Promise.race timeout patterns (KB-10: Implementation)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 160-165, 212-216, 249-254
**Description**: Three `Promise.race` timeout patterns create timers that are never cleared when the primary promise wins. Accumulates leaked timer references.
**Remediation**: Store setTimeout return value and clearTimeout when primary promise resolves.

### 45. Terminal bridge missing `args` array support (KB-09: Terminal)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 72, 110
**Description**: ACP `CreateTerminalRequest` supports `args?: string[]` but `TerminalCreateOptions` lacks this field. Forces all arguments into command string with `shell: true`.
**Remediation**: Add `args?: string[]` to `TerminalCreateOptions` and support `shell: false` when args present.

---

## Minor Issues

### 46. SessionConfigOption.options doesn't support grouped options (KB-09: Config Options)
**File**: `src/types/config.ts`
**Lines**: 119-120
**Description**: SDK supports both flat and grouped option lists. Our type only supports flat options, preventing visual grouping (e.g., models by provider).
**Remediation**: Define `SessionConfigOptionGroup` type and update options to accept either.

### 47. ToolKind/ToolCallKind missing 'switch_mode' (KB-09: Tool Calls)
**File**: `src/types/events.ts`
**Lines**: N/A
**Description**: SDK defines `ToolKind` including `'switch_mode'`. If a runtime `ToolCallKind` type exists, it should include this value.
**Remediation**: Add `'switch_mode'` to any ToolCallKind type definition.

### 48. `_meta` on commands contains non-namespaced keys (KB-01: Extensibility)
**File**: `src/extensions/acp/commands-emitter.ts`
**Lines**: 48-79
**Description**: Uses `_meta: { category: 'info' }` without vendor namespace prefix. Could conflict with future ACP spec additions.
**Remediation**: Use `_goodvibes/category` instead of bare `category`.

### 49. Extensions `pushStatus` payload not namespaced (KB-01: Extensibility)
**File**: `src/extensions/acp/extensions.ts`
**Lines**: 333-348
**Description**: Status notification includes top-level fields like `health`, `uptime` that are not namespaced. Future ACP spec additions could define reserved fields.
**Remediation**: Consider namespacing payload under `_goodvibes` key in future.

### 50. tool_call_update emits non-spec fields (rawOutput, toolName) (KB-06: Tool Calls)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 202-211
**Description**: Includes `rawOutput` and `toolName` not in ACP `ToolCallStatusUpdate` schema. Non-spec fields should go in `_meta`.
**Remediation**: Move non-spec fields to `_meta` per KB-08.

### 51. Missing sessionUpdate discriminator in hook tool_call_update (KB-06: Tool Calls)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 202
**Description**: Emitted event lacks `sessionUpdate: 'tool_call_update'` discriminator. Cannot be serialized to compliant ACP wire messages.
**Remediation**: Add the discriminator field.

### 52. Permission type defaults to non-spec 'mcp' (KB-05: Permissions)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 144-151
**Description**: Defaulting to `'mcp'` when `permissionType` is unset uses a non-standard permission type not in the ACP spec.
**Remediation**: Require the field or use an ACP-defined default.

### 53. Permission types `mcp` and `extension` not namespaced as custom types (KB-05: Permissions)
**File**: `src/types/permissions.ts`
**Lines**: 29-30
**Description**: Custom permission types should use `_goodvibes/` prefix per KB-05 convention. Bare `mcp` and `extension` could collide with future ACP types.
**Remediation**: Rename to `_goodvibes/mcp` and `_goodvibes/extension`.

### 54. Config adapter mode names diverge from ACP convention (KB-03: Sessions)
**File**: `src/extensions/acp/config-adapter.ts`
**Lines**: 60-81
**Description**: ACP uses `ask`/`code` mode values. Implementation uses `justvibes`/`vibecoding`/`sandbox`/`plan`. Reduces interoperability with generic ACP clients.
**Remediation**: Map GoodVibes modes to ACP-standard equivalents or document mapping.

### 55. `plan` mode denies `shell` instead of prompting per ask-mode semantics (KB-05: Permissions)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 55-58
**Description**: Always-deny removes user agency for shell and file_delete. KB-05 ask mode says agent should call `request_permission` for every gated action.
**Remediation**: Move `shell`/`file_delete` out of `alwaysDeny` and rely on `promptForUnknown: true`.

### 56. No legacy `modes` in session/load response (KB-03: Sessions)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 325-331
**Description**: KB-03 states agents SHOULD send both `configOptions` and `modes` during transition period.
**Remediation**: Include `modes` alongside `configOptions` in load response.

### 57. `SessionManager.destroy()` does not validate session state (KB-04: Sessions)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 146-151
**Description**: Unconditionally deletes session state without checking if a prompt turn is in progress. No mechanism ensures `stopReason: "cancelled"` response.
**Remediation**: Check session state and ensure proper cancellation before cleanup.

### 58. `setConfigOption` accepts arbitrary keys without validation (KB-03: Config Options)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 292-322
**Description**: Accepts any key string without validating against known config option IDs or valid choices.
**Remediation**: Validate `configId` and value against known options.

### 59. `SessionConfigOption.category` not typed to ACP standard categories (KB-03: Config Options)
**File**: `src/types/config.ts`
**Lines**: 109
**Description**: Typed as plain `string` instead of `'mode' | 'model' | 'thought_level' | \`_\${string}\``.
**Remediation**: Define proper `SessionConfigOptionCategory` type.

### 60. `category` required but KB-03 says optional (KB-03: Config Options)
**File**: `src/types/config.ts`
**Lines**: 109
**Description**: Implementation requires `category` but KB-03 specifies it as optional.
**Remediation**: Make `category` optional.

### 61. Config validation never invoked at startup (KB-10: Implementation)
**File**: `src/main.ts`
**Lines**: After line 71
**Description**: `Config.validate()` exists but is never called. Invalid config values propagate silently.
**Remediation**: Call `config.validate()` after loading.

### 62. `GOODVIBES_MODE` env var collision with env override system (KB-10: Config)
**File**: `src/main.ts`, `src/core/config.ts`
**Lines**: 411, 123
**Description**: Direct `process.env.GOODVIBES_MODE` check happens before config loading, creating ambiguity with the env override system.
**Remediation**: Use `GOODVIBES_RUNTIME__MODE` or read from config after loading.

### 63. Shutdown grace period ignores `agentGracePeriodMs` config (KB-10: Implementation)
**File**: `src/main.ts`
**Lines**: 436
**Description**: Uses hardcoded 2-second timer. `RuntimeConfig.runtime.agentGracePeriodMs` (default 10000ms) is never consulted.
**Remediation**: Use the config value for the timeout.

### 64. Config instance not passed to GoodVibesAgent (KB-03: Sessions)
**File**: `src/main.ts`
**Lines**: 206
**Description**: Agent cannot derive session-level `configOptions` defaults from runtime configuration.
**Remediation**: Pass `config` as a constructor parameter.

### 65. JSON parse errors in MCP transport silently consumed (KB-06: MCP)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 99-103
**Description**: Non-JSON lines from MCP servers are logged at debug level only. Persistent failures could indicate a malfunctioning server.
**Remediation**: Count consecutive failures and emit `mcp:error` event after threshold.

### 66. MCP server notifications dropped (KB-06: MCP)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 83-104
**Description**: MCP server notifications (no `id` field) like `notifications/tools/list_changed` are silently ignored, causing stale tool lists.
**Remediation**: Handle at least `list_changed` notifications.

### 67. IPC `_request` timeout does not clean up pending entry on write failure (KB-10: Implementation)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 204-210
**Description**: Write failure leaves pending entry in map leading to double-reject.
**Remediation**: Delete pending entry and clear timeout on write failure.

### 68. `disconnect()` does not await subprocess exit (KB-06: MCP)
**File**: `src/extensions/mcp/bridge.ts`
**Lines**: 91-97
**Description**: MCP server processes may still be running when session shutdown is reported complete.
**Remediation**: Await process exit event with timeout guard.

### 69. Terminal bridge null exit code maps to 0 (success) instead of -1 (KB-10: Implementation)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 229
**Description**: Inconsistent with other paths that map null to -1. A signal-killed process reports success.
**Remediation**: Change `internal.exitCode ?? 0` to `internal.exitCode ?? -1`.

### 70. Shell injection risk in terminal spawn fallback (KB-05: Permissions)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 109-115
**Description**: Uses `shell: true` with raw command string. No input sanitization for metacharacters.
**Remediation**: Validate/escape command or split into `[executable, ...args]` with `shell: false`.

### 71. stdout/stderr not interleaved temporally in terminal output (KB-10: Implementation)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 179
**Description**: Concatenates all stdout then all stderr, losing temporal order. KB-10 reference uses combined buffer.
**Remediation**: Use a single combined output buffer.

### 72. No permission gate documentation for fs-bridge callers (KB-05: Permissions)
**File**: `src/extensions/acp/fs-bridge.ts`
**Lines**: Entire file
**Description**: Performs reads/writes without permission checks. No documentation that callers must gate through PermissionGate.
**Remediation**: Add JSDoc noting caller responsibility for permission gating.

### 73. `_meta` propagation lost in EventBus `_emitError` (KB-08: Extensibility)
**File**: `src/core/event-bus.ts`
**Lines**: 345-350
**Description**: Error events don't carry forward `_meta` from originating events, breaking W3C trace context propagation.
**Remediation**: Propagate source event's `_meta` to error records.

### 74. EventBus `handlerCount` omits prefix handlers (KB-08: Extensibility)
**File**: `src/core/event-bus.ts`
**Lines**: 319-326
**Description**: Only iterates `_handlers`, missing `_prefixHandlers`. Gives inaccurate count after O(1) prefix optimization.
**Remediation**: Also iterate `_prefixHandlers` in the count.

### 75. Review not-passed maps to `'failed'` tool call status (KB-06: Tool Calls)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 199
**Description**: A below-threshold review score is semantically `'completed'` (the tool ran successfully), not `'failed'` (tool errored). Misleads ACP clients.
**Remediation**: Always use `'completed'` for reviews that ran. Encode pass/fail in content and `_meta`.

---

## Nitpick Issues

### 76. EnvVariable and HttpHeader missing `_meta` field (KB-08: Extensibility)
**File**: `src/types/session.ts`
**Lines**: 33, 39
**Description**: SDK includes optional `_meta` on these types. Omitting prevents metadata roundtrip.
**Remediation**: Add `_meta?: Record<string, unknown>` to both types.

### 77. `bridge.ts` referenced in review scope does not exist (KB-N/A: Scope)
**File**: N/A (expected `src/extensions/acp/bridge.ts`)
**Description**: Review scope references non-existent file. Actual files are `fs-bridge.ts`, `terminal-bridge.ts`, `agent-event-bridge.ts`.
**Remediation**: Update review scope to reference actual file names.

### 78. Session state machine lacks `error` handling state (KB-04: Sessions)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 40-45
**Description**: No `error` state for sessions that fail during prompt turn. Failed sessions remain `active`.
**Remediation**: Consider adding an error/failed state for internal tracking.

### 79. Stale `_meta` doc comment references un-namespaced keys (KB-08: Extensibility)
**File**: `src/extensions/hooks/built-ins.ts`
**Lines**: 24-25
**Description**: JSDoc references `_validationError`, `_permissionChecked`, `_abort` but code correctly uses `_goodvibes/` prefix.
**Remediation**: Update comment to match actual namespaced keys.

### 80. `tool-proxy.ts` `_parseToolName` fragile on `__` in server names (KB-06: MCP)
**File**: `src/extensions/mcp/tool-proxy.ts`
**Lines**: 128-136
**Description**: Splits on first `__`. If server ID contains `__`, split is incorrect.
**Remediation**: Validate server names don't contain `__` during registration.

### 81. readTextFile passes line/limit but SDK type may not support them (KB-09: Filesystem)
**File**: `src/extensions/acp/fs-bridge.ts`
**Lines**: 56-61
**Description**: SDK `ReadTextFileRequest` is `{ sessionId, path }` with no `line`/`limit`. Extra fields may be silently ignored.
**Remediation**: Verify SDK support or apply slicing to ACP response.

### 82. `_meta` lacks W3C trace context reserved key documentation (KB-08: Extensibility)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 38-39
**Description**: `_meta` type documents `timestamp` but not the W3C reserved keys (`traceparent`, `tracestate`, `baggage`).
**Remediation**: Add typed optional fields or JSDoc reference.

### 83. Hardcoded protocolVersion in health endpoint (KB-02: Initialization)
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 71
**Description**: Hardcodes `protocolVersion: 1` instead of using `ACP_PROTOCOL_VERSION` constant.
**Remediation**: Import and use the constant.

### 84. EventBus prefix wildcard only matches last colon segment (KB-08: Extensibility)
**File**: `src/core/event-bus.ts`
**Lines**: 217-223
**Description**: `a:*` does not match `a:b:c` due to `lastIndexOf(':')` approach. Multi-level wildcards don't work.
**Remediation**: Document limitation or iterate all possible prefix segments.

### 85. `PermissionRequest.sessionId` documented as ignored but still present (KB-05: Permissions)
**File**: `src/types/permissions.ts`
**Lines**: 72-77
**Description**: Optional field that's never read creates confusion.
**Remediation**: Remove or make truly required.

### 86. Skill registry content is placeholder-quality for non-protocol skills (KB-N/A: Completeness)
**File**: `src/plugins/skills/registry.ts`
**Lines**: 122-144
**Description**: Outcome and quality skill `content` fields are single-sentence placeholders, not actionable guidance.
**Remediation**: Provide substantive content matching protocol skill quality.

---

## Appendix: Cross-Reference Patterns

### Pattern A: SessionUpdate Discriminator Naming Mismatches
**Issues**: #1, #13, #14, #15
**Affected files**: `src/types/events.ts`, `src/extensions/acp/agent.ts`, `src/extensions/acp/session-adapter.ts`, `src/extensions/acp/commands-emitter.ts`, `src/extensions/acp/config-adapter.ts`
**Root cause**: KB-03/KB-04 and SDK disagree on exact discriminator strings. Code follows one source inconsistently. Type assertions (`as schema.SessionUpdate`) bypass compile-time verification.
**Recommended fix**: Verify all discriminator values against SDK source, update the `AcpSessionUpdateType` union, and remove type assertions.

### Pattern B: Missing `_meta` on ACP Types
**Issues**: #17, #30, #73, #76, #82
**Affected files**: `src/types/config.ts`, `src/types/registry.ts`, `src/types/session.ts`, `src/core/event-bus.ts`, `src/extensions/ipc/protocol.ts`
**Root cause**: KB-08 requires `_meta` on all ACP types, but it was added selectively.
**Recommended fix**: Audit all L0 types and add `_meta?: Record<string, unknown>` where missing.

### Pattern C: Type Assertions Bypassing Safety
**Issues**: #14, #15, #50, #51
**Affected files**: `src/extensions/acp/commands-emitter.ts`, `src/extensions/acp/tool-call-emitter.ts`, `src/extensions/hooks/registrar.ts`
**Root cause**: SessionUpdate construction uses `as acp.SessionUpdate` or `as unknown as acp.SessionUpdate` casts instead of type-safe construction.
**Recommended fix**: Use SDK typed union construction without casts.

### Pattern D: Missing Permission Gates
**Issues**: #21, #40, #72
**Affected files**: `src/extensions/mcp/tool-call-bridge.ts`, `src/plugins/project/analyzer.ts`, `src/extensions/acp/fs-bridge.ts`
**Root cause**: Tool execution paths lack `session/request_permission` integration for side-effecting operations.
**Recommended fix**: Implement permission gate callbacks at tool execution boundaries.

### Pattern E: Missing Tool Call Lifecycle Events
**Issues**: #34, #41, #51
**Affected files**: `src/plugins/agents/loop.ts`, `src/plugins/project/analyzer.ts`, `src/extensions/hooks/registrar.ts`
**Root cause**: Tool execution does not emit `tool_call`/`tool_call_update` session updates per KB-06 lifecycle.
**Recommended fix**: Emit lifecycle events at each tool execution boundary.

### Pattern F: console.warn/error Instead of EventBus
**Issues**: #50 (hooks), #52 (hooks), daemon.ts, scheduler.ts, registry.ts
**Affected files**: `src/extensions/hooks/registrar.ts`, `src/extensions/lifecycle/daemon.ts`, `src/core/scheduler.ts`, `src/extensions/services/registry.ts`
**Root cause**: Operational logging uses console output instead of structured EventBus events. Console output may corrupt ndjson transport or be lost in headless mode.
**Recommended fix**: Emit structured events via EventBus for all operational conditions.

### Pattern G: Unbounded Growth / No Backpressure
**Issues**: #29 (IPC buffer), #31 (trigger timeout), queue sizes
**Affected files**: `src/extensions/ipc/socket.ts`, `src/core/trigger-engine.ts`, `src/core/queue.ts`, `src/extensions/directives/queue.ts`, `src/extensions/memory/manager.ts`
**Root cause**: Buffers, queues, and caches grow without limits. No eviction or backpressure mechanisms.
**Recommended fix**: Add configurable size limits with overflow behavior.

### Pattern H: Plugin Registration Type Safety
**Issues**: #39, #42
**Affected files**: `src/plugins/project/analyzer.ts`, `src/plugins/project/index.ts`, `src/plugins/agents/index.ts`, `src/plugins/skills/index.ts`
**Root cause**: `register(registry: unknown)` signature with immediate cast to `Registry`. No runtime type guard.
**Recommended fix**: Accept `Registry` directly in the signature or add method-existence type guard.

### Pattern I: Credential / Security Gaps
**Issues**: #8 (SQL injection), #9 (description lost), #10 (response unwrapping)
**Affected files**: `src/plugins/project/db.ts`, `src/extensions/acp/permission-gate.ts`, `src/extensions/services/registry.ts`
**Root cause**: Input validation and sanitization gaps in security-sensitive paths.
**Recommended fix**: Add input validation, identifier allowlists, and correct response unwrapping.

### Pattern J: Shutdown / Teardown Gaps
**Issues**: #24, #43, #63, #68
**Affected files**: `src/main.ts`, `src/extensions/mcp/bridge.ts`
**Root cause**: Inconsistent timeout handling, missing `conn.signal` integration, ungraceful subprocess termination.
**Recommended fix**: Unify shutdown timeout from config, integrate `conn.signal`, await subprocess exit.
