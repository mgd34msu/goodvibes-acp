# ACP Compliance Review — Iteration 3 Consolidated Issues

## Summary
- Critical: 8
- Major: 51
- Minor: 81
- Nitpick: 23
- Total (deduplicated): 163

---

## Critical Issues

### 1. `setConfigOption` returns wrong `type` value for `SessionConfigOption` (KB-03: Config Options System)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 302
**Description**: The `setConfigOption` method builds its return value with `type: 'text' as const`, but the ACP SDK type `SessionConfigOption` is an intersection that hardcodes `type: "select"`. The only valid value for `type` in the current ACP spec is `"select"`. Using `"text"` produces a response that does not match the wire format.
**Remediation**: Change `type: 'text' as const` to `type: 'select' as const`.

---

### 2. `requestPermission` call uses SDK-specific options/toolCall shape instead of spec-defined permission object (KB-05: Wire Format)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 175-185
**Description**: The ACP wire spec defines `session/request_permission` with a `permission` field containing `type`, `title`, and `description`. The implementation instead sends `options` and `toolCall` fields — an entirely different request structure. While documented as ISS-013/ISS-017 SDK divergence, there is no abstraction layer or feature flag to switch to the spec format.
**Remediation**: Add an abstraction that constructs the spec-compliant `permission` object. Either conditionally use it based on SDK version detection, or structure the code so the spec-compliant path is ready to activate.

---

### 3. `isGranted()` parses outcome-based response instead of spec-defined `{ granted: boolean }` (KB-05: Response Format)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 103-109
**Description**: The ACP spec response is `{ granted: boolean }`. The implementation parses `outcome.outcome === 'cancelled'` and `outcome.optionId` — an entirely different response model. If the SDK aligns with the wire spec in a future version, this function will break because `response.outcome` will not exist.
**Remediation**: Add a version-aware response parser that checks for `response.granted` (spec path) first, falling back to `response.outcome` (current SDK path) only when the boolean field is absent.

---

### 4. `tool_call_update` uses wrong status enum value `'failed'` (KB-04: ToolCallStatus)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 195
**Description**: The post-hook emits `status: 'failed'` for permission-denied tool calls. The canonical ACP spec defines `ToolCallStatus` as `"pending" | "in_progress" | "completed" | "cancelled" | "error"`. The value `'failed'` is not a valid ACP status. The correct value for a permission-denied tool call is `'error'` (or `'cancelled'`).
**Remediation**: Change `status: failed ? 'failed' : 'completed'` to `status: failed ? 'error' : 'completed'`.

---

### 5. Empty content block forwarded on completed tool calls — tool output discarded (KB-06: MCP ContentBlock Forwarding)
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**Lines**: 130
**Description**: The completed `tool_call_update` emits a hardcoded empty content block `[{ type: 'content', content: { type: 'text', text: '' } }]`. Per KB-06, the actual MCP result content should be forwarded directly to the ACP client. The current implementation discards all tool output, meaning the ACP client never sees what the tool returned.
**Remediation**: Pass the actual MCP tool result content blocks from the `tool_complete` progress event into the `emitToolCallUpdate` call.

---

### 6. MCP tool-call-bridge uses `'in_progress'` status instead of ACP spec `'running'` (KB-06: ToolCallStatus)
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**Lines**: 109
**Description**: The code uses `'in_progress'` as the active execution status. The ACP wire protocol defines `'running'` (KB-06 line 114). A non-SDK ACP client receiving `'in_progress'` would not recognize it as a valid status. The ISS-055 comment acknowledges the SDK divergence.
**Remediation**: Use `'running'` as the status value, or verify the SDK version actually sends `'running'` over the wire regardless of the TypeScript type name.

---

### 7. `max_tokens` stop reason collapsed to `end_turn` — truncated responses reported as successful (KB-04: StopReason)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 171-172
**Description**: When the LLM returns `max_tokens`, the loop maps it to `end_turn` in its result. ACP defines `max_tokens` as a distinct StopReason with different semantics ("Maximum token limit reached" vs "LLM finished without requesting more tools"). This causes the ACP layer to misreport truncated responses as successful completions.
**Remediation**: Propagate `max_tokens` as its own stop reason so the ACP layer can surface it correctly to clients.

---

### 8. `session/load` history replay not implemented — MUST-level spec requirement (KB-03: Session Load Behavior)
**File**: `src/extensions/acp/session-adapter.ts`
**Lines**: 93-100
**Description**: History replay during `session/load` is marked as TODO (ISS-056). The ACP spec uses MUST language: the agent MUST replay the entire conversation history as `session/update` notifications (`user_message_chunk`, `agent_message_chunk`) before sending the `session/load` response. Without this, clients resuming a session will see an empty conversation.
**Remediation**: Implement history replay in the `loadSession` handler. Iterate through stored `HistoryMessage[]`, emit `user_message_chunk`/`agent_message_chunk` session updates for each, then return the `session/load` response.

---

## Major Issues

### 9. `SessionConfigOption.currentValue` typed as `string` but spec requires `string | boolean` (KB-01: Session Config Options)
**File**: `src/types/config.ts`
**Lines**: 105
**Description**: `SessionConfigOption.currentValue` is typed as `string` but the ACP spec defines it as `string | boolean`. Boolean-type config options (e.g., `type: 'boolean'`) cannot represent their current value correctly.
**Remediation**: Change line 105 from `currentValue: string;` to `currentValue: string | boolean;`.

---

### 10. `AcpSessionUpdateType` uses wrong discriminator value `'config_options_update'` (KB-01: Session Update Types)
**File**: `src/types/events.ts`
**Lines**: 272
**Description**: The `AcpSessionUpdateType` union includes `'config_options_update'` but the ACP spec uses `'config_option'` (singular, no `_update` suffix). This mismatch would cause ACP clients to ignore config option updates.
**Remediation**: Change `'config_options_update'` to `'config_option'` on line 272.

---

### 11. Barrel export file missing `review-scoring.ts` re-export (KB-09: Module Completeness)
**File**: `src/types/index.ts`
**Lines**: 30
**Description**: The barrel export file does not re-export `review-scoring.ts`. Any consumer importing from `@l0/index` will not have access to `REVIEW_DIMENSIONS`, `computeWeightedScore`, or related types. The barrel file's own documentation states it "Re-exports all L0 type definitions."
**Remediation**: Add `export * from './review-scoring';` to `src/types/index.ts`.

---

### 12. `loadSession` emits config update with wrong discriminator `'config_option_update'` (KB-04: Session Update Discriminators)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 323
**Description**: The `loadSession` method emits a config update with `sessionUpdate: 'config_option_update'` (singular). The ACP spec discriminator is `"config_options_update"` (plural "options"). Clients following the spec will not recognize the update and will silently drop it.
**Remediation**: Change `sessionUpdate: 'config_option_update'` to `sessionUpdate: 'config_options_update'`.

---

### 13. `initialize` rejects clients with lower protocol versions — breaks forward compatibility (KB-01: Protocol Version Negotiation)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 196-202
**Description**: The `initialize` method rejects clients with a protocol version lower than the agent's supported version by throwing an error. The ACP spec's initialize flow does not prescribe rejecting lower versions outright. The agent should respond with its own supported version and let the client decide whether to proceed.
**Remediation**: Remove the version < SUPPORTED_VERSION guard. The `Math.min` negotiation already handles the case correctly.

---

### 14. `setConfigOption` returns incomplete config state — only changed option, not full state (KB-03: Config Options System)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 293-305
**Description**: The ACP spec requires that the `set_config_option` response returns the complete set of config options with full metadata. The current implementation builds a minimal representation with just `id`, `name: id`, `category: 'session'`, and empty `options: []`. The `buildConfigOptions()` function already produces the correct response.
**Remediation**: Use `buildConfigOptions(currentMode, currentModel)` from config-adapter.ts instead of manually constructing the response.

---

### 15. `PermissionOption` type shape mismatches actual SDK usage (KB-05: Permission Object Shape)
**File**: `src/types/permissions.ts`
**Lines**: 41-46
**Description**: The `PermissionOption` type defines `{ id: string; label: string }`, but `permission-gate.ts` constructs options with `{ optionId, kind, name }` using the SDK type. The local type is never used in the actual permission flow — it is dead code creating a false sense of type safety.
**Remediation**: Either align the local `PermissionOption` type with the SDK's actual shape, or remove it if the intent is to always use the SDK type directly.

---

### 16. `PermissionRequest.toolCall` and `PermissionRequest.options` fields are unused dead code (KB-05: Wire Format)
**File**: `src/types/permissions.ts`
**Lines**: 71-81
**Description**: These fields are declared but never consumed by `PermissionGate.check()`. The gate constructs its own `toolCall` object and generates options via `buildPermissionOptions()`. These unused fields add confusion about the actual data flow.
**Remediation**: Remove these fields from the type, or wire them into `PermissionGate.check()`.

---

### 17. Random `toolCallId` generation breaks spec-required linkage to `tool_call` update (KB-05: Relationship to Tool Execution)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 170
**Description**: KB-05: "toolCallId used in permission context should match the tool_call update sent before the request." The code generates a random UUID as fallback. A randomly generated `toolCallId` will not match any preceding `tool_call` update, breaking client UI correlation.
**Remediation**: Make `toolCallId` required on `PermissionRequest` (not optional with random fallback), or throw/warn when it is missing.

---

### 18. `rawInput` field in permission toolCall is non-spec (KB-05: Permission Object Shape)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 182
**Description**: The permission request includes `rawInput` in the `toolCall` object. The ACP spec permission object shape defines `type`, `title`, `description`, and `_meta` — there is no `rawInput` field.
**Remediation**: Move `rawInput` into the `_meta` object where custom fields belong, or use the spec-defined `description` field.

---

### 19. `tool_call_update` event payload does not match ACP `ToolCallStatusUpdate` schema (KB-04/KB-06: Schema Mismatch)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 192-198
**Description**: The emitted event uses `output` as a raw field, but ACP's `ToolCallStatusUpdate` specifies `content?: ContentBlock[]`. The event also omits `sessionUpdate: 'tool_call_update'` discriminator. When mapped to a `session/update` notification, the shape will be wrong.
**Remediation**: Use `content: ContentBlock[]` instead of raw `output`, and include the `sessionUpdate: 'tool_call_update'` discriminator field.

---

### 20. Internal `_meta` keys lack `_goodvibes/` namespace prefixing (KB-08: Extensibility)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 70-77, 155-161, 173-175
**Description**: KB-08 states that within `_meta`, implementations should use namespaced keys. The code uses unprefixed keys: `_validationError`, `_abort`, `_permissionDenied`, `_permissionReason`, `_permissionChecked`, `_permissionGateMissing`. These should be prefixed with `_goodvibes/`.
**Remediation**: Prefix all internal `_meta` keys with `_goodvibes/`, e.g., `_goodvibes/validationError`.

---

### 21. `HookEngine` lacks abort/short-circuit mechanism for pre-hooks (KB-08: Extensibility)
**File**: `src/core/hook-engine.ts`
**Lines**: 167-184
**Description**: The registrar documents that callers should check `_meta._abort === true` after execution, but `HookEngine.execute()` has no mechanism to short-circuit the pre-hook chain when abort is signaled. If a validation pre-hook sets `_abort: true`, all subsequent pre-hooks still execute.
**Remediation**: Check for an abort signal between hook executions in the engine, or provide a convention for pre-hooks to signal chain termination.

---

### 22. Post-hook fires indiscriminately after permission denial (KB-05: Permissions)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 184-201
**Description**: The `tool:execute` post-hook always fires, even when the pre-hook denied permission. Per KB-05: "If `granted: false`, the agent MUST NOT execute the action." The post-hook still emits a `tool:call:update` event with potentially undefined result.
**Remediation**: Conditionally skip post-hook emission when tool was never executed due to permission denial, or clearly distinguish between "tool completed" and "tool blocked."

---

### 23. Fire-and-forget `tool_call` lifecycle breaks on partial failure (KB-06: Tool Call Lifecycle)
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**Lines**: 91-113
**Description**: The `emitToolCall` and `emitToolCallUpdate` calls are chained with `.then()` and a shared `.catch()`. If the initial `emitToolCall` (pending) fails, the `.then()` block still attempts to emit `'in_progress'`, potentially creating an orphaned update for a tool_call that was never announced.
**Remediation**: Await both calls sequentially, and skip `tool_call_update` if `emitToolCall` fails. Use async/await with proper error boundaries.

---

### 24. Tool name parse/unparse asymmetry with double-underscore server names (KB-06: Tool Namespacing)
**File**: `src/extensions/mcp/tool-proxy.ts`
**Lines**: 128-136
**Description**: `_parseToolName` splits on the first `__` occurrence. If `serverId` contains `__`, the parse is incorrect. For example, server name `my__server` with tool `read` produces `my__server__read`, which parses as serverId=`my`, rawToolName=`server__read`.
**Remediation**: Use a separator that cannot appear in MCP server or tool names, or document the constraint that server names must not contain `__`.

---

### 25. No write error handling on stdin — pending requests hang until timeout (KB-01: Transport)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 207
**Description**: `stdin.write()` does not handle the write callback or error event. If the subprocess stdin pipe is broken, the pending promise hangs until the 30-second timeout.
**Remediation**: Pass an error callback to `stdin.write()` and reject the pending promise immediately on write failure.

---

### 26. `env` converted to `EnvVariable[]` array but KB-07 wire format shows plain object (KB-07: Terminal Create)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 80-82
**Description**: The KB wire example for `terminal/create` shows `env` as a plain JSON object, but the code converts to `EnvVariable[]` array. This may cause wire-format mismatches.
**Remediation**: Verify that `conn.createTerminal()` accepts `EnvVariable[]` and the SDK handles serialization to wire format.

---

### 27. `waitForExit` silently defaults `exitCode` to 0 when null — masks failures (KB-07: Terminal Exit)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 202
**Description**: `exitCode: exitResult.exitCode ?? 0` masks potential failures. A process killed by signal typically has no numeric exit code, and reporting 0 (success) is misleading.
**Remediation**: Use `exitResult.exitCode ?? -1` to indicate abnormal termination, or throw an error if exitCode is null.

---

### 28. Non-standard `type` discriminant field breaks JSON-RPC 2.0 compliance (KB-01: JSON-RPC 2.0)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 34-35
**Description**: The `IpcMessage` base interface includes a custom `type: string` discriminant field not in JSON-RPC 2.0. The `deserializeMessage` function validates `type` as required, meaning it would reject valid JSON-RPC 2.0 messages from standard-compliant senders.
**Remediation**: Either remove `type` and use structural discrimination per JSON-RPC 2.0, or document this is a JSON-RPC 2.0 superset for internal use only.

---

### 29. Unbounded buffer accumulation in IPC socket — no size limit on `state.buffer` (KB-01: Security)
**File**: `src/extensions/ipc/socket.ts`
**Lines**: 187
**Description**: The `_handleData` method appends incoming chunks to `state.buffer` without any size limit. A malicious or malfunctioning client can grow the buffer indefinitely until the process runs out of memory.
**Remediation**: Add a maximum buffer size constant (e.g., 1MB) and destroy the connection if exceeded.

---

### 30. Race condition in `_stopHealthServer` — server nulled before close completes (KB-10: Graceful Shutdown)
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 289
**Description**: `_stopHealthServer()` sets `this._healthServer = null` before the `close()` callback fires, unlike `_stopTcpServer()` which correctly captures the reference before nulling. If `stop()` is called twice in rapid succession, the second call resolves immediately while the first close may still be in-flight.
**Remediation**: Mirror the pattern used in `_stopTcpServer` — capture the reference, null the field, then call `close()` on the captured reference.

---

### 31. PID file left orphaned if socket binding fails (KB-10: Daemon Lifecycle)
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 144-146
**Description**: The PID file is written before TCP and health servers attempt to bind. If either throws (e.g., EADDRINUSE), the `start()` method rejects but the PID file remains on disk. The `stop()` method is never called because `_running` was never set to `true`.
**Remediation**: Wrap the startup in try/catch that cleans up the PID file on failure.

---

### 32. Fragile SDK type cast for finish event during shutdown (KB-10: Prompt Handling)
**File**: `src/main.ts`
**Lines**: 131
**Description**: The shutdown handler casts `{ sessionUpdate: 'finish', stopReason: 'cancelled' }` through `unknown` to `acp.SessionUpdate`. This double-cast silences all type checking and will not produce a compile error if the wire format changes.
**Remediation**: Create a typed helper that documents the SDK gap and can be updated in one place (e.g., `createFinishUpdate()` in `src/extensions/acp/compat.ts`).

---

### 33. Daemon mode CLI argument parsing does not validate port values (KB-10: Entry Point)
**File**: `src/main.ts`
**Lines**: 411
**Description**: `getArgValue` uses `indexOf` and does not validate that the next element is not another flag. `--port --host 127.0.0.1` would set `port` to `--host`, which `parseInt` turns into `NaN`.
**Remediation**: Validate parsed values with `Number.isNaN()` and range checks (1-65535).

---

### 34. L0 `SessionConfigOptionChoice.label` contradicts SDK `SessionConfigSelectOption.name` (KB-10: ACP SDK Types)
**File**: `src/types/config.ts`
**Lines**: 80
**Description**: The L0 type defines `label?: string` (optional) but the SDK type `SessionConfigSelectOption` uses `name: string` (required). Code using the L0 type to build config options would produce objects missing the required `name` field.
**Remediation**: Rename `label` to `name` and make it required to match the SDK.

---

### 35. L0 `SessionConfigOptionType` declares unsupported types `'boolean'` and `'text'` (KB-10: ACP SDK Types)
**File**: `src/types/config.ts`
**Lines**: 89
**Description**: The L0 type declares `'select' | 'boolean' | 'text'` but the SDK only supports `type: "select"`. The comment stating all three types are natively supported by ACP is factually incorrect.
**Remediation**: Either restrict to `type: 'select'` to match the spec, or document that `'boolean'` and `'text'` are internal extensions that must be serialized as `'select'` on the wire.

---

### 36. `emit()` has no `_meta` parameter — blocks W3C trace context propagation (KB-08: Extensibility)
**File**: `src/core/event-bus.ts`
**Lines**: 167
**Description**: The `emit()` method accepts `type`, `payload`, and `sessionId` but provides no way to pass `_meta` data. The `_meta` field exists on `EventRecord` but is never populated during emission. Without an emit-time path for `_meta`, distributed tracing across the ACP boundary is impossible.
**Remediation**: Add an optional `options` parameter to `emit()` that includes `_meta`.

---

### 37. O(k) prefix wildcard matching on every `emit()` call — performance bottleneck (KB-01: Streaming Notifications)
**File**: `src/core/event-bus.ts`
**Lines**: 198-205
**Description**: Every call to `emit()` iterates over ALL registered handler keys to check for prefix wildcard matches (e.g., `session:*`). This is O(k) where k is the total number of distinct subscriptions. ACP's `session/update` notification fires at high frequency during streaming.
**Remediation**: Pre-index prefix wildcards at subscription time into a separate map keyed by prefix. On emit, check the event type's prefix against this map instead of scanning all keys.

---

### 38. `Registry.get<T>()` casts `unknown` to `T` without runtime type validation (KB-01: Type Safety)
**File**: `src/core/registry.ts`
**Lines**: 97-103
**Description**: `get<T>()` casts `unknown` to `T` with `as T` without any runtime type validation. If a consumer calls `registry.get<IToolProvider>('precision')` but a different type was registered, the bug manifests as a runtime type error far from the source.
**Remediation**: Consider adding an optional type-tag validation mechanism, or add a `validateAll()` method for startup-time verification.

---

### 39. Trigger fire count incremented before handler validation — causes premature exhaustion (KB-08: Error Isolation)
**File**: `src/core/trigger-engine.ts`
**Lines**: 206
**Description**: Fire count is incremented before handler lookup. If the handler is not found or `canHandle` returns false, the fire count is still inflated. For triggers with `maxFires`, this causes premature exhaustion — the trigger stops firing before it has actually executed `maxFires` times.
**Remediation**: Move the increment to after the handler validation, just before handler execution.

---

### 40. Error event emission creates potential infinite recursion loop (KB-08: Error Events)
**File**: `src/core/trigger-engine.ts`
**Lines**: 105-106, 230
**Description**: The engine subscribes to `'*'` (all events) and emits `'error'` events on handler failure. If any trigger has `eventPattern: '*'` or `eventPattern: 'error'`, the engine's own error emission re-enters `evaluate()`, creating potential infinite recursion.
**Remediation**: Add a guard (e.g., skip evaluation when `event.type === 'error'` and source is self, or use a re-entrancy flag).

---

### 41. No `agent_message_chunk` progress events emitted — clients see no incremental output (KB-04: Agent Message Streaming)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 127-136, 152-157
**Description**: The loop uses non-streaming `chat()` and only emits `llm_start`/`llm_complete` progress events. It never emits progress events mapping to ACP `agent_message_chunk` session update type. The entire response appears at once when the turn completes. Acknowledged as ISS-060.
**Remediation**: At minimum, emit a progress event with the completed text content after each LLM call so the ACP layer can send `agent_message_chunk` updates.

---

### 42. Cancelled tool executions not reported via progress callback (KB-04: Session Cancel)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 219-227
**Description**: When cancellation is detected before tool execution, the loop pushes a `tool_result` with `is_error: true` but does not emit an `onProgress` event. The ACP client cannot send `tool_call_update` with `status: 'cancelled'`.
**Remediation**: Emit a progress event with `type: 'tool_cancelled'` before pushing the error tool result.

---

### 43. Unknown LLM stop reasons silently mapped to `end_turn`, masking `refusal` (KB-04: StopReason)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 182-183
**Description**: The fallback maps all unknown stop reasons to `end_turn`. ACP defines `refusal` as a valid StopReason. If the LLM provider returns a refusal-equivalent, it is silently converted to `end_turn`.
**Remediation**: Preserve unknown stop reasons or map provider-specific refusal signals to ACP `refusal`.

---

### 44. Plaintext credential storage without restrictive file permissions (KB-10: Security)
**File**: `src/extensions/services/registry.ts`
**Lines**: 164
**Description**: `save()` writes credentials as plaintext JSON without setting restrictive file permissions (chmod 600). The ISS-042 comment documents the need but does not implement it.
**Remediation**: Pass `{ mode: 0o600 }` to `writeFile` to restrict file permissions.

---

### 45. `_pendingWarnings` map is write-only dead code (KB-08: Extension Methods)
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 48, 132, 141, 147
**Description**: The `_pendingWarnings` map is populated when budget thresholds are crossed but is never read, consumed, or cleared anywhere. No public method exposes pending warnings and no notification is emitted. This is dead state giving a false impression that alerts are tracked.
**Remediation**: Either expose a `consumeWarnings(sessionId)` method, or remove the map and integrate threshold notifications into `session/update` notifications.

---

### 46. `getAnalyticsResponse` ignores the `scope` discriminator (KB-08: Analytics Extension)
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 266-319
**Description**: The `GoodVibesAnalyticsRequest` type defines `scope` as `'session' | 'workflow' | 'agent'` matching KB-08 wire format. However, `getAnalyticsResponse()` only reads `request?.sessionId` and completely ignores `scope` and `id`. The method signature promises scope support it cannot deliver.
**Remediation**: Either dispatch on `scope`, or narrow the accepted type to `'session'` only and document the limitation.

---

### 47. Review failure mapped to `'failed'` tool_call status instead of `'completed'` (KB-06: ToolCallStatus Semantics)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 196
**Description**: When a review does not pass, the bridge maps it to `'failed'` status. Per ACP spec, `failed`/`error` means the tool itself errored during execution — not that its output was unfavorable. A review that completes with a low score is a successful tool execution.
**Remediation**: Always emit `'completed'` for reviews that finish execution. Use `_meta` to distinguish pass from fail.

---

### 48. Tool call ID reuse across multi-attempt WRFC cycles (KB-06: Tool Call Uniqueness)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 254-261
**Description**: The `_toolCallId` method generates IDs as `wrfc_${phase}_${workId}` and caches them. In multi-attempt WRFC chains, the same `workId:review` key maps to the same cached ID. Per ACP spec: `toolCallId` must be unique within a session.
**Remediation**: Include the attempt number in the tool call ID: `wrfc_${phase}_${attempt}_${workId}`. Clear stale entries when a phase re-enters.

---

### 49. Missing `content` field on work-complete `tool_call_update` (KB-06/KB-10: Tool Call Updates)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 183-187
**Description**: The work-complete handler emits a `tool_call_update` with `status: 'completed'` and `_meta` but no `content` field. Per the spec, completed tool calls should include `content` blocks with the tool's output text. No `locations` field is emitted either. Same omission applies to fix-complete (line 213) and review-complete (line 198).
**Remediation**: Pass `content` and `locations` arrays from the event payload through to the `tool_call_update` emission.

---

### 50. `DatabaseTools` lacks `ITextFileAccess` injection — always reads stale disk state (KB-06: ACP File Access)
**File**: `src/plugins/project/db.ts`
**Lines**: 9, 29, 37
**Description**: `DatabaseTools` uses raw `readFile` from `node:fs/promises` while the other three analyzers accept an optional `ITextFileAccess` for ACP-compliant reads. Prisma schema parsing always reads stale disk state rather than editor buffers.
**Remediation**: Add `ITextFileAccess` constructor parameter to `DatabaseTools` and pass `fs` parameter in `analyzer.ts:216`.

---

### 51. No input validation in `_dispatch` before type casting (KB-06: Tool Input Validation)
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 245-246, 250, 259, 263
**Description**: The `_dispatch` method casts `params` to typed params without validating that required fields exist. If `projectRoot` is missing, `undefined` is passed to `join()` producing a malformed path. The tool definitions declare `projectRoot` as required but the runtime never enforces this.
**Remediation**: Add a validation guard that checks required fields before dispatching.

---

### 52. SQL injection risk in `generateQuery` (KB-06: Tool Execution Security)
**File**: `src/plugins/project/db.ts`
**Lines**: 177-215
**Description**: `generateQuery` interpolates `table`, `columns`, and `where` directly into SQL strings with only basic double-quote wrapping. The `where` parameter is inserted raw. Column names with special characters would break or corrupt the output.
**Remediation**: Sanitize identifiers by rejecting characters outside `[a-zA-Z0-9_]`. Add a warning that the output is a template, not safe for direct execution.

---

### 53. HTTP webhook responses use plain text instead of JSON-RPC 2.0 envelope (KB-08/KB-10: JSON-RPC 2.0)
**File**: `src/extensions/external/http-listener.ts`
**Lines**: 119-129, 303
**Description**: The `reply()` helper sends plain-text HTTP responses. Per ACP spec, all inter-process communication within the ACP layer must use JSON-RPC 2.0 envelopes.
**Remediation**: Replace with JSON-RPC 2.0 compliant responses.

---

### 54. `toAcpExtensionEvent` output missing `sessionId` field (KB-08: Extension Notifications)
**File**: `src/extensions/external/normalizer.ts`
**Lines**: 180-191
**Description**: The `toAcpExtensionEvent()` function converts a `NormalizedEvent` into ACP extension event params, but the output lacks a `sessionId` field. All `_goodvibes/*` notification params require `sessionId`.
**Remediation**: Add `sessionId` as a required parameter and include it in the returned object.

---

### 55. `AgentCoordinator` does not surface agent data via `_goodvibes/agents` extension method (KB-08: Extension Methods)
**File**: `src/extensions/agents/coordinator.ts`
**Lines**: 38-190
**Description**: KB-08 defines a `_goodvibes/agents` extension request with a specific response schema. The `AgentCoordinator` and `AgentTracker` provide no method that returns data in the required wire format. `AgentMetadata` uses `spawnedAt` instead of spec-required `startedAt`, and lacks `score`, `minimumScore`, and `files` fields.
**Remediation**: Add a `toAcpAgentsResponse(sessionId)` method that maps internal metadata to the wire format.

---

### 56. Directives have no `sessionId` field — cannot be scoped to ACP sessions (KB-03: Session Isolation)
**File**: `src/types/directive.ts`
**Lines**: 29-46
**Description**: The `Directive` type has `workId` and `target` but no `sessionId`, making it impossible to cancel or isolate directives per ACP session. All sessions share one queue.
**Remediation**: Add `sessionId: string` to the `Directive` type and use it in `DirectiveQueue.drain()` filtering.

---

### 57. `DirectiveQueue` has no session isolation — all sessions share one queue (KB-03: Session Independence)
**File**: `src/extensions/directives/queue.ts`
**Lines**: 85-96
**Description**: Sessions are independent conversation contexts per ACP. A single shared `DirectiveQueue` with no session partitioning means `session/cancel` on one session could inadvertently affect directives from another session.
**Remediation**: Either maintain per-session queues or require `sessionId` in `DirectiveFilter` and enforce session isolation.

---

### 58. `StateStore.restore()` skips `$schema` version validation (KB-02: Version Management)
**File**: `src/core/state-store.ts`
**Lines**: 233-243
**Description**: The method accepts any `SerializedState` and blindly loads it without checking whether `$schema` matches `STATE_SCHEMA_VERSION`. If persisted state was serialized with an incompatible schema version, restoring it could silently corrupt state.
**Remediation**: Check `state.$schema` against `STATE_SCHEMA_VERSION` and throw or migrate when they differ.

---

### 59. `StateStore.restore()` does not fire change events (KB-08: Observable Contract)
**File**: `src/core/state-store.ts`
**Lines**: 233-243
**Description**: When state is restored from a snapshot, the method silently replaces all internal state without calling `_notifyChange()`. Any `onChange` subscribers (ACP extensions, analytics, persistence hooks) will be unaware that state changed.
**Remediation**: Fire change events for each key during restore, or fire a bulk "restore" event.

---

## Minor Issues

### 60. Protocol version constant ambiguity — integer `1` vs SDK string `"0.15"` (KB-01/KB-09: Protocol Version)
**File**: `src/types/constants.ts`
**Lines**: 39
**Description**: `ACP_PROTOCOL_VERSION` is the integer `1` but the SDK's `PROTOCOL_VERSION` is the string `"0.15"`. This dual representation could cause wire-format mismatches if the integer constant is used directly in `initialize` responses.
**Remediation**: Either change to string `'0.15'` to match SDK wire format, or add a separate `ACP_SDK_PROTOCOL_VERSION` constant.

---

### 61. `computeWeightedScore` runtime function violates L0 pure-types contract (KB-00: Layer Discipline)
**File**: `src/types/review-scoring.ts`
**Lines**: 62
**Description**: The module header declares `@layer L0 -- pure types, no runtime code, no imports` but `computeWeightedScore` is a runtime function. Constants are exempted per `constants.ts`, but executable functions are not.
**Remediation**: Move `computeWeightedScore` to an L1 or L2 utility module.

---

### 62. `AcpSessionUpdateType` union missing `'session_info'` value (KB-01: Session Update Types)
**File**: `src/types/events.ts`
**Lines**: 263
**Description**: KB-01 lists `session_info` as a valid session update type, but it is not present in the `AcpSessionUpdateType` union.
**Remediation**: Add `'session_info'` to the union.

---

### 63. `available_commands` discriminator casted through `unknown` to bypass type-checking (KB-04: Session Update Discriminators)
**File**: `src/extensions/acp/commands-emitter.ts`
**Lines**: 113-116
**Description**: The code casts through `unknown` to emit `sessionUpdate: 'available_commands'` while acknowledging the SDK uses a different discriminator. The double-cast hides potential wire-format errors.
**Remediation**: Verify the actual wire format and use the SDK's discriminator value without casts.

---

### 64. `sessionInfoUpdate` uses non-spec `title` field instead of `content: ContentBlock` (KB-04: SessionInfoUpdate)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 71-102
**Description**: The function uses `sessionUpdate: 'session_info_update'` and constructs a `SessionInfoUpdate` with a `title` field. The ACP spec defines `SessionInfoUpdate` with a `content: ContentBlock` field, not `title`, and the discriminator should be `"session_info"`.
**Remediation**: Change the payload to use `content: { type: 'text', text: title }` to match the spec.

---

### 65. `authenticate` method returns `Promise<void>` instead of response object (KB-01: Authentication)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 346
**Description**: The ACP spec describes an authenticate response. Returning void means the JSON-RPC response will have `result: null` instead of a structured response object.
**Remediation**: Return an empty object `{}` or a proper `AuthenticateResponse` shape.

---

### 66. Unknown `_goodvibes/*` methods return success instead of JSON-RPC error (KB-01: JSON-RPC 2.0)
**File**: `src/extensions/acp/extensions.ts`
**Lines**: 73-74
**Description**: Unknown methods return `{ error: 'unknown_method', _meta: META }` as a successful response. Per JSON-RPC 2.0, unknown methods should return a JSON-RPC error with code `-32601` (METHOD_NOT_FOUND).
**Remediation**: Throw `Object.assign(new Error('Unknown extension method'), { code: -32601 })` instead of returning a result.

---

### 67. `toSessionModeState` is dead code — exported but never imported (KB-03: Legacy Modes API)
**File**: `src/extensions/sessions/modes.ts`
**Lines**: 138-150
**Description**: `toSessionModeState` is exported but never imported or called. KB-03 says agents SHOULD send both `configOptions` and `modes` during the transition period. If legacy modes support is intentionally omitted, the function should be removed.
**Remediation**: Either remove as dead code or use it in the `session/new` response for backwards compatibility.

---

### 68. `setConfigOption` uses non-standard `category: 'session'` (KB-03: Config Option Categories)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 301
**Description**: The manually constructed config options use `category: 'session'`, not one of the standard ACP categories (`mode`, `model`, `thought_level`, or `_`-prefixed custom). This issue is moot if issue #14 is fixed.
**Remediation**: Use standard categories or prefix custom categories with `_`.

---

### 69. Mode change does not emit dual `configOptions` + `modes` notification (KB-03: Backwards Compatibility)
**File**: `src/extensions/acp/session-adapter.ts`
**Lines**: 165-178
**Description**: The `_onSessionModeChanged` handler emits only `current_mode_update`. KB-03 recommends that during the transition period, agents SHOULD send both formats so clients supporting either API receive updates.
**Remediation**: When mode changes, emit both `current_mode_update` and `config_option_update`.

---

### 70. `setState` allows arbitrary state transitions without validation (KB-03: Session Lifecycle)
**File**: `src/extensions/sessions/manager.ts`
**Lines**: 194-202
**Description**: `setState` allows any state transition without validation. A session in `completed` state could be transitioned back to `idle`. Reverse transitions are likely bugs.
**Remediation**: Add a transition validation map that defines allowed `from -> to` transitions.

---

### 71. `console.error` used for warning-level message (KB-08: Logging)
**File**: `src/extensions/hooks/built-ins.ts`
**Lines**: 50
**Description**: Missing permission context is a warning, not an error. Using `console.error` inflates error-level noise.
**Remediation**: Change to `console.warn`.

---

### 72. Permission type silently defaults to `'mcp'` (KB-05: Permission Types)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 142
**Description**: A missing `permissionType` is silently defaulted to `'mcp'`. ACP defines multiple permission types. A missing value is likely a caller bug that should be logged.
**Remediation**: Log a warning when the default is used.

---

### 73. `HookContext` index signature enables root-level custom field leakage (KB-08: Protocol Types)
**File**: `src/extensions/hooks/built-ins.ts`
**Lines**: 28
**Description**: The `[key: string]: unknown` index signature allows arbitrary root-level keys that may leak into protocol types during serialization. KB-08 states custom fields belong in `_meta`.
**Remediation**: Use a stricter type with explicit optional fields, forcing dynamic data through `_meta`.

---

### 74. Missing error detail in `tool_call_update` for permission denial (KB-05: Observability)
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 192-198
**Description**: When permission is denied, `reason` is a top-level field. ACP's `ToolCallStatusUpdate` does not have a `reason` field — error details should go in `content` or `_meta`.
**Remediation**: Move `reason` to `content` as a text content block or into `_meta`.

---

### 75. Silent JSON parse error swallowing in MCP transport (KB-01: Error Handling)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 99
**Description**: Empty `catch {}` block silently ignores all parse failures on stdout lines. Repeated parse failures could indicate a misconfigured server.
**Remediation**: Add a debug-level log for parse failures.

---

### 76. MCP stderr pipe may pollute agent output (KB-01: Transport)
**File**: `src/extensions/mcp/transport.ts`
**Lines**: 265
**Description**: `child.stderr?.pipe(process.stderr)` forwards MCP server diagnostic output to the agent's stderr. If downstream components parse agent stderr, MCP noise could cause parse errors.
**Remediation**: Consider a separate log channel for MCP server stderr.

---

### 77. Missing MCP capability declaration in agent initialize (KB-06: MCP Capabilities)
**File**: `src/extensions/mcp/bridge.ts`
**Lines**: 223-241
**Description**: `mcp: { http: false, sse: false }` should be declared in `agentCapabilities` during `initialize` but is not implemented. Clients may send HTTP/SSE server configs that will be silently dropped.
**Remediation**: Declare `mcp: { http: false, sse: false }` in agent capabilities.

---

### 78. Permission gate is a TODO placeholder — ISS-024 (KB-06: Tool Permissions)
**File**: `src/extensions/mcp/tool-call-bridge.ts`
**Lines**: 101-108
**Description**: The permission gate flow is described but not implemented. All tools transition from pending to in_progress without any permission check. Destructive operations (file writes, shell commands) should request permission.
**Remediation**: Implement the permission gate per ISS-024.

---

### 79. `timeout` not forwarded to ACP SDK `currentOutput()` call (KB-07: Terminal Output)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 154-158
**Description**: KB-07 shows `terminal/output` accepts an optional `timeout` parameter. The code uses a local `Promise.race` workaround (ISS-073) instead of forwarding timeout to the SDK.
**Remediation**: Track ISS-073 and update when SDK supports timeout parameter.

---

### 80. `shell: true` in spawn fallback creates shell injection risk (KB-07: Security)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 109-115
**Description**: The spawn fallback uses `shell: true` because `command` is a bare string. No input sanitization at the bridge layer.
**Remediation**: Add basic command validation or parse the command string into `[executable, ...args]` and use `shell: false`.

---

### 81. Spawn fallback output concatenates stdout+stderr instead of interleaving (KB-07: Terminal Output)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 179
**Description**: All stderr is appended after all stdout. Error messages appear after the full stdout rather than at the point they occurred.
**Remediation**: Push both stdout and stderr chunks into a single buffer in arrival order.

---

### 82. `TerminalHandle` does not include ACP `terminalId` for debugging (KB-07: Terminal Create)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 71-77
**Description**: The ACP `terminalId` from the client response is stored internally but not accessible from the returned `TerminalHandle`, making debugging harder.
**Remediation**: Add an optional `acpTerminalId` field to `TerminalHandle`.

---

### 83. IPC `id` typed as `string` only — JSON-RPC 2.0 allows `number | string | null` (KB-01: JSON-RPC 2.0)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 37, 57
**Description**: JSON-RPC 2.0 allows `id` to be string, number, or null. The IPC types restrict to `string` only.
**Remediation**: Change to `id: string | number` on IpcMessage.

---

### 84. IPC notifications use `event` instead of `method` (KB-01: JSON-RPC 2.0)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 65-71
**Description**: JSON-RPC 2.0 notifications use a `method` field. The IpcNotification uses `event` instead.
**Remediation**: Rename `event` to `method` to align with JSON-RPC 2.0.

---

### 85. `console.warn` used instead of `console.error` for ACP diagnostic output (KB-02: Diagnostic Output)
**File**: `src/extensions/lifecycle/daemon.ts`, `src/extensions/lifecycle/shutdown.ts`
**Lines**: daemon.ts:230, shutdown.ts:116
**Description**: `console.warn` is used inconsistently with the rest of the codebase which uses `console.error` for all diagnostic output per ACP convention.
**Remediation**: Replace `console.warn` with `console.error` for consistency.

---

### 86. Health endpoint hardcodes `protocolVersion: 1` instead of using SDK constant (KB-02: Protocol Version)
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 71
**Description**: The `/health` endpoint includes `protocolVersion: 1` as a hardcoded literal instead of using `acp.PROTOCOL_VERSION`. If the protocol version is bumped, this reports stale information.
**Remediation**: Import and use `PROTOCOL_VERSION` from the ACP SDK.

---

### 87. Redundant shutdown calls from uncaught exception/rejection handlers (KB-10: Error Handling)
**File**: `src/main.ts`
**Lines**: 442-454
**Description**: Both `uncaughtException` and `unhandledRejection` handlers unconditionally start a 5-second safety timer. If a legitimate shutdown is already in progress, the safety timer will force-exit prematurely.
**Remediation**: Check `shutdownManager.isShuttingDown()` before starting the safety timer.

---

### 88. `markReady()` silently ignored in non-starting states (KB-10: Health Check Lifecycle)
**File**: `src/extensions/lifecycle/health.ts`
**Lines**: 62
**Description**: `markReady()` only transitions from `starting` to `ready`. If called in other states, it is silently ignored with no logging, making debugging difficult.
**Remediation**: Add a debug-level log when the call is ignored.

---

### 89. Arbitrary 2-second exit delay after graceful shutdown (KB-10: Graceful Shutdown)
**File**: `src/main.ts`
**Lines**: 436
**Description**: After `shutdownManager.shutdown()` completes, a 2-second `setTimeout` delays `process.exit(0)`. This is arbitrary and may be too short or unnecessarily long.
**Remediation**: Use `setImmediate` or a shorter timeout since shutdown handlers already handle their own cleanup.

---

### 90. `buildConfigOptions` default mode contradicts KB-10 (KB-10: Config Defaults)
**File**: `src/extensions/acp/config-adapter.ts`
**Lines**: 39
**Description**: KB-10 specifies default mode as `'vibecoding'` but the implementation defaults to `'justvibes'` without documented rationale.
**Remediation**: Change default to `'vibecoding'` per KB-10, or document why `'justvibes'` was chosen.

---

### 91. Missing `emitConfigUpdate` function from KB-10 (KB-10: Config Adapter)
**File**: `src/extensions/acp/config-adapter.ts`
**Lines**: 133
**Description**: KB-10 describes an `emitConfigUpdate` function for agent-initiated config updates. This function is not present in `config-adapter.ts`.
**Remediation**: Add `emitConfigUpdate` to `config-adapter.ts` or document where this capability is implemented.

---

### 92. `Config.validate()` does not validate `logging.level` (KB-00: Config Validation)
**File**: `src/core/config.ts`
**Lines**: 296-314
**Description**: `validate()` does not validate `logging.level` against the `LogLevel` union. Env var overrides can set arbitrary string values that would silently become invalid.
**Remediation**: Add validation for `logging.level` against `LogLevel` enum values.

---

### 93. `applyEnvOverrides` number coercion too narrow — only matches integers (KB-00: Config Env Overrides)
**File**: `src/core/config.ts`
**Lines**: 142
**Description**: The regex `/^\d+$/` only matches positive integers. Floating-point values like `GOODVIBES_WRFC__MIN_REVIEW_SCORE=9.5` will be treated as strings.
**Remediation**: Use `/^-?\d+(\.\d+)?$/` and `parseFloat` instead of `parseInt`.

---

### 94. `can()` does not evaluate guards but name implies it does (KB-02: State Machine)
**File**: `src/core/state-machine.ts`
**Lines**: 243-250
**Description**: The method checks if a transition exists structurally but ignores guard conditions. The JSDoc warns but the name is misleading. In ACP initialization flows with capability guards, `can()` returning `true` for a guarded-out transition could cause incorrect branching.
**Remediation**: Either add `canStrict()` that evaluates guards, or rename to `hasTransition()`.

---

### 95. Async lifecycle hooks are fire-and-forget — failures silently swallowed (KB-08: Extension Hooks)
**File**: `src/core/state-machine.ts`
**Lines**: 156-165, 186-193
**Description**: `onEnter`/`onExit` hooks that return Promises have rejections caught and logged to `console.error`, but the transition proceeds regardless. Extension hook failures are silently swallowed.
**Remediation**: Consider an option to propagate errors, or emit failures through a structured error channel.

---

### 96. `_notifyChange` swallows listener errors silently (KB-08: Observability)
**File**: `src/core/state-store.ts`
**Lines**: 257-265
**Description**: The empty `catch {}` block means a failing `onChange` listener produces no diagnostic output at all. Per KB-08, extension code attaches via hooks; zero observability on failure.
**Remediation**: Log the error to `console.error` matching the pattern used in `state-machine.ts`.

---

### 97. `description` field not passed in permission request to SDK (KB-05: Permission Object Shape)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 175-185
**Description**: The `PermissionRequest` type includes a `description` field and the ACP spec requires it in the permission object. However, `PermissionGate.check()` never passes `request.description` anywhere.
**Remediation**: Include `description` in the permission request payload.

---

### 98. `plan` mode auto-approves `file_write`, contradicting ask-mode semantics (KB-05: Mode-Based Auto-Approval)
**File**: `src/extensions/acp/permission-gate.ts`
**Lines**: 52-56
**Description**: Plan mode maps to ACP "ask mode" which means every gated action should prompt the user. Yet plan mode auto-approves `file_write`.
**Remediation**: Remove `file_write` from plan mode's `autoApprove` list, or document the deliberate deviation.

---

### 99. `sessionId` optional on `PermissionRequest` but required on wire (KB-05: Wire Format)
**File**: `src/types/permissions.ts`
**Lines**: 60-61
**Description**: `sessionId?: string` is optional but the wire format requires it. The `PermissionGate` class receives `sessionId` in its constructor, making this field redundant and potentially misleading.
**Remediation**: Remove `sessionId` from `PermissionRequest` or document it is ignored.

---

### 100. `_Config.notifyChange` swallows listener errors (KB-00: Error Handling)
**File**: `src/core/config.ts`
**Lines**: 333-338
**Description**: Listener errors are caught and logged to `console.error` but not propagated. A failing config change listener could silently break functionality with only stderr evidence.
**Remediation**: Emit an event on EventBus for listener failures or use structured logging.

---

### 101. Scheduler errors logged to console.error and silently swallowed (KB-08: Observability)
**File**: `src/core/scheduler.ts`
**Lines**: 236, 243
**Description**: Errors in scheduled task handlers are silently swallowed. The Scheduler has no EventBus dependency to emit errors, making task failures invisible to the system.
**Remediation**: Accept an optional `onError` callback or EventBus reference.

---

### 102. Trigger session scoping uses `(event.payload).sessionId` instead of `event.sessionId` (KB-04: EventRecord)
**File**: `src/core/trigger-engine.ts`
**Lines**: 181
**Description**: Session scoping inspects `event.payload` internals instead of the canonical top-level `event.sessionId` field from `EventRecord`.
**Remediation**: Use `event.sessionId !== definition.sessionId`.

---

### 103. Module-level `_regexCache` is unbounded and never cleared (KB-08: Memory)
**File**: `src/core/trigger-engine.ts`
**Lines**: 31
**Description**: `Map<string, RegExp | null>` grows without limit if many distinct patterns are registered/unregistered over a long-running process.
**Remediation**: Add a size cap or evict entries on unregister.

---

### 104. Error payload in trigger `_meta` discards stack trace (KB-08: Error Payloads)
**File**: `src/core/trigger-engine.ts`
**Lines**: 230-237
**Description**: Error payload converts to `err.message` but discards the stack trace. Include `'_goodvibes/stack'` for production debugging.
**Remediation**: Include `err.stack` in the `_meta` error payload.

---

### 105. Redundant `task.nextRun` assignment (KB-00: Correctness)
**File**: `src/core/scheduler.ts`
**Lines**: 90, 107
**Description**: `task.nextRun` is set on line 90 then immediately overwritten on line 107. The first assignment is redundant.
**Remediation**: Remove the redundant assignment on line 90.

---

### 106. `task.status` set to `'running'` unconditionally on every `_execute()` (KB-00: Status Accuracy)
**File**: `src/core/scheduler.ts`
**Lines**: 217
**Description**: Overwrites the already-correct `'running'` status when `maxConcurrent > 1` and the task is already running.
**Remediation**: Only transition from `'scheduled'` to `'running'` on the first concurrent start.

---

### 107. `filesModified` always empty due to unimplemented tracking — ISS-038 (KB-10: WRFC Work Phase)
**File**: `src/plugins/agents/spawner.ts`
**Lines**: 55-59, 394-396
**Description**: The `filesModified` field always falls back to `[]`. The ACP client receives no information about which files the agent modified.
**Remediation**: Implement `filesModified` tracking.

---

### 108. Extended thinking blocks silently dropped (KB-04: Agent Thought Chunks)
**File**: `src/plugins/agents/providers/anthropic.ts`
**Lines**: 191
**Description**: The `fromAnthropicContent` mapper drops all block types except `text` and `tool_use`, including `thinking` blocks. ACP defines `agent_thought_chunk` for internal reasoning. This makes the feature permanently unreachable.
**Remediation**: Map `thinking` blocks to a `thought` content type for the progress event.

---

### 109. Timeout produces non-ACP `error` stop reason (KB-04: StopReason)
**File**: `src/plugins/agents/spawner.ts`
**Lines**: 174-181
**Description**: Timeout results in `stopReason: 'error'` which has no ACP translation path. The L2 ACP layer must handle this translation but the contract is implicit.
**Remediation**: Document the internal-to-ACP stop reason mapping in the type system.

---

### 110. Empty `input_schema` fallback `{}` is not valid JSON Schema (KB-10: Tool Definitions)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 199
**Description**: When a tool has no `inputSchema`, the fallback is `{}`. A valid JSON Schema should at minimum be `{ type: 'object' }`.
**Remediation**: Change fallback to `{ type: 'object' }`.

---

### 111. `ServiceAuthOrchestrator` not wired to any ACP extension method (KB-08: Extension Methods)
**File**: `src/extensions/services/auth.ts`
**Lines**: 55-66
**Description**: Class is implemented but not connected to any `_goodvibes/auth` handler. ISS-039 documents this as future work.
**Remediation**: Wire to ACP extension method dispatch or document as pending integration.

---

### 112. `ServiceHealthChecker` not wired to any ACP extension method (KB-08: Extension Methods)
**File**: `src/extensions/services/health.ts`
**Lines**: 57-66
**Description**: Class is implemented but disconnected from the ACP layer. ISS-040 documents this.
**Remediation**: Wire to ACP extension method dispatch.

---

### 113. `ServiceRegistry.load()` does not validate individual `ServiceEntry` fields (KB-10: Validation)
**File**: `src/extensions/services/registry.ts`
**Lines**: 131
**Description**: Validates store structure but not individual entries. A corrupted entry with missing `name` or `endpoint` could cause runtime errors.
**Remediation**: Add per-entry validation for required fields.

---

### 114. Basic auth does not validate colon in username per RFC 7617 (KB-10: Security)
**File**: `src/extensions/services/auth.ts`
**Lines**: 164
**Description**: `username:password` encoding does not sanitize username for colon characters. Per RFC 7617, username MUST NOT contain a colon.
**Remediation**: Add validation rejecting colons in username.

---

### 115. Plugin `shutdown` callback does not flush analytics (KB-08: Plugin Lifecycle)
**File**: `src/plugins/analytics/index.ts`
**Lines**: 47-51
**Description**: The `shutdown` callback is a no-op. Analytics data loss on shutdown depends on external wiring.
**Remediation**: Capture the engine instance during `register` and call `engine.shutdown()` in the `shutdown` callback.

---

### 116. No `session/update` notification for budget threshold crossings (KB-04: Session Info Updates)
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 115-151
**Description**: Budget threshold crossings (75%, 90%, 100%) store warnings but never emit `session/update` with `session_info`. Budget warnings are exactly the kind of status update `session_info` is designed for.
**Remediation**: Accept a notification callback and emit `session_info`-shaped notification on threshold crossing.

---

### 117. `SessionSync.load` deserializes untrusted JSON without validation (KB-08: Forward Compatibility)
**File**: `src/plugins/analytics/sync.ts`
**Lines**: 48-53
**Description**: `JSON.parse(raw) as SessionAnalytics` with no runtime validation. Corrupted data silently produces invalid objects.
**Remediation**: Add a runtime shape check before inserting into store.

---

### 118. Dashboard `getSummary` copies all entries into single array — memory pressure (KB-08: Performance)
**File**: `src/plugins/analytics/dashboard.ts`
**Lines**: 29, 34
**Description**: `allEntries.push(...session.entries)` spreads every entry from every session, sorts, then slices to 20. For long-running agents, this creates unnecessary memory pressure.
**Remediation**: Use a bounded merge approach keeping only top N entries.

---

### 119. Analytics `_goodvibes/analytics` endpoint unreachable via ACP (KB-08: Extension Method Dispatch)
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 30-39
**Description**: `getAnalyticsResponse()` exists but nothing wires it to the ACP extension method dispatch. The endpoint is unreachable.
**Remediation**: Register a `_goodvibes/analytics` handler in the extension method dispatch during plugin registration.

---

### 120. Missing `_meta` budget format alignment — `totalBudget` vs spec `maxTokens` (KB-08: Budget Wire Format)
**File**: `src/plugins/analytics/types.ts`
**Lines**: 13-26, 79-89
**Description**: KB-08 shows `_meta` budget as `{ maxTokens, maxTurns }`. The `TokenBudget` type uses `totalBudget` (not `maxTokens`) and has no `maxTurns`. No mapping layer exists.
**Remediation**: Add a conversion function and implement `maxTurns` tracking.

---

### 121. All WRFC phases use `kind: 'other'` instead of semantically appropriate kinds (KB-06/KB-10: ToolCallKind)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 114, 136, 158
**Description**: All three WRFC phases use `kind: 'other'`. The ACP `ToolCallKind` provides: `'execute'` for work, `'think'` for review, `'edit'` for fix.
**Remediation**: Map phases to kinds: work -> `'execute'`, review -> `'think'`, fix -> `'edit'`.

---

### 122. Swallowed errors in WRFC bridge event handlers via `.catch(() => {})` (KB-10: Error Handling)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 120, 128, 143, 150, 165, 172, 187, 203, 217
**Description**: All `emitToolCall` and `emitToolCallUpdate` calls silently swallow errors. No logging, no metrics, no fallback.
**Remediation**: Replace with `.catch((err) => console.error('[WRFCEventBridge] Failed to emit tool call update', err))`.

---

### 123. `WRFCEventBridge` does not handle `'checking'` state transition (KB-10: WRFC Lifecycle)
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 106-173
**Description**: The state-changed handler emits tool_call announcements for `working`, `reviewing`, and `fixing`, but not `checking`. This creates a visibility gap in the WRFC lifecycle.
**Remediation**: Add a `checking` branch that emits a tool_call with descriptive title.

---

### 124. Circular import detection uses O(n) array lookup (KB-06: Performance)
**File**: `src/plugins/project/deps.ts`
**Lines**: 190-195
**Description**: `files.includes(candidate)` is O(n) per candidate inside nested loops. Converting to `Set<string>` reduces to O(1).
**Remediation**: Add `const fileSet = new Set(files)` and use `fileSet.has(candidate)`.

---

### 125. Gitignore pattern matching is overly simplistic — no glob support (KB-08: Forward Compatibility)
**File**: `src/plugins/project/security.ts`
**Lines**: 197-199
**Description**: Only matches exact line equality. A `.gitignore` containing `.env*` would not match `.env.local`, causing false-positive security warnings.
**Remediation**: Use a gitignore-compatible matching library or handle `*` wildcards.

---

### 126. Shared mutable regex state in concurrent `Promise.all` (KB-06: Concurrent Execution)
**File**: `src/plugins/project/security.ts`
**Lines**: 287-316
**Description**: `Promise.all` over files uses shared `/g` regex patterns. Though unlikely in Node.js single-threaded execution, the pattern is fragile.
**Remediation**: Create fresh `RegExp` instances per iteration or use `String.prototype.match()`.

---

### 127. Tool definitions lack `additionalProperties: false` constraint (KB-08: Protocol Types)
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 38-203
**Description**: All `inputSchema` objects omit `additionalProperties: false`. Schemas silently accept arbitrary extra fields.
**Remediation**: Add `additionalProperties: false` to each `inputSchema`.

---

### 128. `DirectiveQueue.process()` silently drops reentrancy without notification (KB-04: Cancellation)
**File**: `src/extensions/directives/queue.ts`
**Lines**: 227
**Description**: When `process()` is already running and called again (e.g., from `session/cancel`), it silently returns `[]`. The caller has no indication directives were not processed.
**Remediation**: Throw, emit an event, or return a result indicating the reentrancy guard fired.

---

### 129. Logs manager has no session scoping — entries cannot be attributed to sessions (KB-03: Session Context)
**File**: `src/extensions/logs/manager.ts`
**Lines**: 22-59
**Description**: `ActivityEntry`, `DecisionEntry`, and `ErrorEntry` have no `sessionId` field. For a multi-session agent, logs become undifferentiated.
**Remediation**: Add optional `sessionId?: string` field to all entry types.

---

### 130. `LogsManager.ensureFiles()` called on every log write — redundant I/O (KB-04: Performance)
**File**: `src/extensions/logs/manager.ts`
**Lines**: 158-180
**Description**: Each log write invokes `ensureFiles()` which does 3 `readFile` checks plus potential `mkdir`. Wasteful during busy turns.
**Remediation**: Track initialization with a boolean flag; call `ensureFiles()` once.

---

### 131. `LogsManager.prependEntry()` has TOCTOU race on concurrent writes (KB-04: Concurrent Tool Calls)
**File**: `src/extensions/logs/manager.ts`
**Lines**: 81-117
**Description**: Read-then-write without locking. Concurrent log entries from parallel tool calls will overwrite each other.
**Remediation**: Use a write queue or mutex, or use `appendFile` instead.

---

### 132. `MemoryManager.load()` throws opaque error on malformed JSON (KB-03: Session Persistence)
**File**: `src/extensions/memory/manager.ts`
**Lines**: 153-154
**Description**: `JSON.parse` throws a generic `SyntaxError`. The catch block only handles `ENOENT`; parse errors propagate with no context about which file failed.
**Remediation**: Catch `SyntaxError` separately, wrap with file path and descriptive message.

---

### 133. ExternalEventBridge emits inconsistent payload format (KB-08: Extension Method Params)
**File**: `src/extensions/external/index.ts`
**Lines**: 64-66
**Description**: Webhook events emit `event.payload` while file-watcher events emit a full `NormalizedEvent`. This inconsistency depends on EventBus wrapper typing.
**Remediation**: Verify EventBus wrapper type and ensure consistent emission format.

---

### 134. `AgentTracker` status transitions allow invalid state machine paths (KB-10: Phase Transitions)
**File**: `src/extensions/agents/tracker.ts`
**Lines**: 82-121
**Description**: `updateStatus()` accepts any transition without validation. Allows `completed -> running` or skipping `running` entirely.
**Remediation**: Add transition validation guard rejecting invalid transitions.

---

### 135. `PluginRegistration.register` typed as `(registry: unknown)` — forces unsafe casts (KB-10: Type Safety)
**File**: `src/plugins/skills/index.ts`, `src/plugins/review/index.ts`, `src/plugins/project/index.ts`
**Lines**: skills:34-35, review:30-31, project:77-81
**Description**: Multiple plugins cast `registry` from `unknown` to `Registry`. The `PluginRegistration` type should be updated to accept a typed registry interface.
**Remediation**: Update `PluginRegistration.register` in `src/types/plugin.ts` to accept `Registry`.

---

### 136. `CodeReviewer._detectPattern` false positives on common substrings (KB-10: Review Accuracy)
**File**: `src/plugins/review/reviewer.ts`
**Lines**: 82-99
**Description**: Simple `text.includes()` matching. `'secret'` matches any mention of the word; `'password'` is overly broad. Can artificially deflate review scores.
**Remediation**: Use regex with `\b` word boundaries or context-aware matching.

---

### 137. `FileWatcher._shouldIgnore` uses substring matching, not glob patterns (KB-08: Extension Quality)
**File**: `src/extensions/external/file-watcher.ts`
**Lines**: 238-240
**Description**: The `ignore` field is documented as "Glob-style substring patterns" but only does substring matching. `*.log` would never match actual `.log` files.
**Remediation**: Implement glob matching or update JSDoc to accurately describe behavior.

---

### 138. `isVersioned()` does not validate semver format (KB-02: Version Management)
**File**: `src/core/versioned-store.ts`
**Lines**: 31-39
**Description**: The guard only checks `$schema` is a string, not a valid semver. Accepts `"banana"` as valid.
**Remediation**: Add basic semver format check or document that validation is the caller's responsibility.

---

### 139. `Queue.restore()` does not validate `$schema` version (KB-01: Version Management)
**File**: `src/core/queue.ts`
**Lines**: 188-193
**Description**: Accepts any `SerializedQueue<T>` without checking `$schema` against `QUEUE_SCHEMA_VERSION`. Could silently produce corrupted state on version mismatch.
**Remediation**: Validate schema version and throw on mismatch.

---

### 140. `deepMerge` skips `undefined` values, preventing key deletion (KB-08: Extensibility)
**File**: `src/core/utils.ts`
**Lines**: 36
**Description**: When `srcVal` is `undefined`, the key is not written. This prevents using `StateStore.merge()` to remove keys from nested objects, limiting `_meta` field management.
**Remediation**: Document this behavior or add a sentinel value for deletion.

---

## Nitpick Issues

### 141. Redundant `Message` type alias identical to `AnyMessage` (KB-01: Transport Types)
**File**: `src/types/transport.ts`
**Lines**: 137
**Description**: The `Message` type alias on line 137 is identical to `AnyMessage`. The ACP SDK uses `AnyMessage` as the canonical name.
**Remediation**: Remove `Message` or deprecate in favor of `AnyMessage`.

---

### 142. Redundant config notification emission alongside response (KB-04: Config Options Update)
**File**: `src/extensions/acp/agent.ts`
**Lines**: 328
**Description**: The `loadSession` method emits `configOptions` as both a notification and in the response. Both is redundant but spec-compliant.
**Remediation**: Consider removing the notification or documenting the intentional redundancy.

---

### 143. Barrel export uses wildcard re-export, exposing internals (KB-08: API Surface)
**File**: `src/extensions/hooks/index.ts`
**Lines**: 10
**Description**: `export * from './built-ins.js'` re-exports everything including internal types.
**Remediation**: Use named export list to make public API explicit.

---

### 144. IPC `_meta` only supports `timestamp` — should allow trace context (KB-01: _meta Field)
**File**: `src/extensions/ipc/protocol.ts`
**Lines**: 39
**Description**: IPC `_meta` type is narrowed to `{ timestamp?: number }` only, preventing W3C trace context propagation.
**Remediation**: Widen to `Record<string, unknown> & { timestamp?: number }`.

---

### 145. `handlerCount` property assumption on EventBus (KB-00: Correctness)
**File**: `src/extensions/ipc/router.ts`
**Lines**: 116
**Description**: The `status` handler accesses `this._eventBus.handlerCount`. If EventBus renames this property, it fails at runtime.
**Remediation**: Verify `handlerCount` exists on the EventBus interface, or use optional chaining.

---

### 146. Exit code sentinel inconsistency between spawn and ACP paths (KB-07: Terminal Exit)
**File**: `src/extensions/acp/terminal-bridge.ts`
**Lines**: 240
**Description**: Spawn path uses `-1` for null exit codes, ACP path uses `0`. Same condition reports differently.
**Remediation**: Use consistent `-1` across both paths.

---

### 147. `GoodVibesMode` includes `'plan'` which is not in KB-10 (KB-10: Mode Definitions)
**File**: `src/extensions/acp/config-adapter.ts`
**Lines**: 16
**Description**: KB-10 defines 3 modes but implementation adds `'plan'`. Not wrong but undocumented in KB.
**Remediation**: Update KB-10 or add a comment explaining the addition.

---

### 148. L0 `SessionConfigOptionChoice` missing `_meta` field (KB-08: Extensibility)
**File**: `src/types/config.ts`
**Lines**: 76-83
**Description**: The SDK's `SessionConfigSelectOption` includes `_meta` for extensibility. The L0 type omits it.
**Remediation**: Add `_meta?: Record<string, unknown>`.

---

### 149. L1 Core barrel re-exports L0 types, blurring layer boundary (KB-00: Layer Discipline)
**File**: `src/core/index.ts`
**Lines**: 58-59
**Description**: The L1 barrel re-exports types from `../types/` (L0). While architecturally valid, it blurs layer boundaries.
**Remediation**: Document the re-exports or create a separate `@l0/index` barrel.

---

### 150. `AgentLoopResult.stopReason` includes `error` but ACP `StopReason` does not (KB-04: StopReason)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 72-78
**Description**: The type includes `'error'` as an internal extension value. Using a branded type would prevent accidental leakage to the wire.
**Remediation**: Use a separate internal enum or branded type.

---

### 151. `_splitToolName` returns empty provider name for unnamespaced tools (KB-10: Tool Namespacing)
**File**: `src/plugins/agents/loop.ts`
**Lines**: 287-291
**Description**: Returns `['', fullName]` for tools without `__`. The subsequent `find` will never match, producing an unhelpful error.
**Remediation**: Add a defensive check or clearer error message.

---

### 152. `register()` emits full config including credentials in event payload (KB-08: Security)
**File**: `src/extensions/services/registry.ts`
**Lines**: 198
**Description**: `service:registered` event includes auth credentials. Event listeners could inadvertently log or transmit them.
**Remediation**: Emit a redacted config without credential fields.

---

### 153. `_fetchWithTimeout` does not consume response body (KB-10: Resource Management)
**File**: `src/extensions/services/health.ts`
**Lines**: 217
**Description**: For HTTP responses with large bodies (GET fallback), the response body is not drained, potentially causing connection leaks.
**Remediation**: Call `response.body?.cancel()` or `response.text()` to drain the stream.

---

### 154. `getAnalyticsResponse` hard-codes `agentCount: 1` (KB-08: Analytics Wire Format)
**File**: `src/plugins/analytics/engine.ts`
**Lines**: 289
**Description**: Not derived from actual agent tracking data. Multi-sub-agent sessions will report incorrectly.
**Remediation**: Track actual agent count or document as known simplification.

---

### 155. `ToolCallEmitter.emitToolCall` builds `_meta` unconditionally — dead ternary branch (KB-06: Code Quality)
**File**: `src/extensions/acp/tool-call-emitter.ts`
**Lines**: 50-52
**Description**: The conditional `meta || name` always evaluates truthy since `name` is required. The falsy branch never executes.
**Remediation**: Simplify to always include `_meta`.

---

### 156. Double file read in test framework detection (KB-06: I/O Efficiency)
**File**: `src/plugins/project/test.ts`
**Lines**: 103-127, 137-166
**Description**: `findTests` reads each file twice — once for framework detection, once for test counting.
**Remediation**: Read once and pass content to both functions.

---

### 157. No `_meta` support on `ToolResult` responses (KB-08: Extensibility)
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 226-243
**Description**: `ToolResult<T>` lacks a `_meta` field. Per KB-08, every protocol type should support `_meta`.
**Remediation**: Add `_meta?: Record<string, unknown>` to `ToolResult` type.

---

### 158. Directives barrel export omits consumer-needed types (KB-03: Barrel Exports)
**File**: `src/extensions/directives/index.ts`
**Lines**: 6
**Description**: Only exports `DirectiveQueue`. Consumers must import `Directive`, `DirectiveFilter`, etc. directly from `../../types/directive.js`, breaking layer abstraction.
**Remediation**: Add type re-exports to the barrel.

---

### 159. `MemoryManager` session cleanup not wired to `session/cancel` (KB-04: Cancellation)
**File**: `src/extensions/memory/manager.ts`
**Lines**: 118-126
**Description**: `clearSession()` is wired to `session:destroyed` but not `session/cancel`. Pending session-scoped memory writes persist between cancel and destroy.
**Remediation**: Evaluate whether cancel should trigger cleanup, or document the behavior.

---

### 160. `MemoryManager.save()` does not validate store integrity before writing (KB-03: Persistence)
**File**: `src/extensions/memory/manager.ts`
**Lines**: 195-202
**Description**: Writes whatever is in `_store` without validation. Corrupted state is persisted and breaks future `load()`.
**Remediation**: Add lightweight validation before serialization.

---

### 161. Default `intervalMs` of 60000 is a magic number repeated 3x (KB-00: Code Quality)
**File**: `src/core/scheduler.ts`
**Lines**: 84, 161, 222
**Description**: Undocumented magic number used in three places.
**Remediation**: Extract to `DEFAULT_INTERVAL_MS` constant.

---

### 162. `StateMachine.restore()` does not validate `data.current` against config states (KB-02: State Validation)
**File**: `src/core/state-machine.ts`
**Lines**: 370-378
**Description**: If serialized data contains a state name removed from config, the machine enters an invalid state with no transitions.
**Remediation**: Validate `data.current` against `config.states` keys.

---

### 163. `TriggerContext.event` type loses typed fields via double cast (KB-04: Type Safety)
**File**: `src/core/trigger-engine.ts`
**Lines**: 222
**Description**: `event as unknown as Record<string, unknown>` erases `id`, `type`, `timestamp`, and `_meta` fields.
**Remediation**: Widen the L0 `TriggerContext.event` type to include at least `type` and `timestamp`.

---

---

## Appendix: Cross-Reference Patterns

### Pattern: ToolCallStatus Enum Inconsistency
Multiple files use non-canonical `ToolCallStatus` values due to contradictory KB definitions (KB-04 vs KB-06) and SDK divergence.
- Issue #4 (`registrar.ts` — `'failed'` instead of `'error'`)
- Issue #6 (`tool-call-bridge.ts` — `'in_progress'` instead of `'running'`)
- Issue #47 (`wrfc-event-bridge.ts` — `'failed'` for review not-passed)

### Pattern: Session Update Discriminator Mismatches
Multiple files use incorrect discriminator values for `session/update` notifications.
- Issue #10 (`events.ts` — `'config_options_update'` vs spec `'config_option'`)
- Issue #12 (`agent.ts` — `'config_option_update'` singular vs spec plural)
- Issue #63 (`commands-emitter.ts` — `as unknown` cast to bypass type-checking)
- Issue #64 (`agent.ts` — `'session_info_update'` vs spec `'session_info'`)

### Pattern: Missing `_meta` Propagation / Namespace Prefixing
The `_meta` field is either absent, not propagated, or uses non-namespaced keys across multiple modules.
- Issue #20 (`registrar.ts` — unprefixed `_meta` keys)
- Issue #36 (`event-bus.ts` — `emit()` has no `_meta` parameter)
- Issue #74 (`registrar.ts` — `reason` at root instead of `_meta`)
- Issue #148 (`config.ts` — L0 type missing `_meta`)
- Issue #157 (`analyzer.ts` — `ToolResult` missing `_meta`)

### Pattern: Schema Version Validation Missing on `restore()`
Serialized state/queue restoration skips version validation, risking silent data corruption.
- Issue #58 (`state-store.ts` — `StateStore.restore()` skips `$schema`)
- Issue #139 (`queue.ts` — `Queue.restore()` skips `$schema`)
- Issue #162 (`state-machine.ts` — `StateMachine.restore()` skips state validation)
- Issue #138 (`versioned-store.ts` — `isVersioned()` does not validate semver)

### Pattern: Error Swallowing / Silent Failures
Multiple modules catch errors and either silently discard them or log only to `console.error` without structured error reporting.
- Issue #22 (`registrar.ts` — post-hook fires after permission denial)
- Issue #75 (`transport.ts` — empty `catch {}` on JSON parse)
- Issue #95 (`state-machine.ts` — async hooks fire-and-forget)
- Issue #96 (`state-store.ts` — `_notifyChange` empty catch)
- Issue #100 (`config.ts` — `_notifyChange` swallows errors)
- Issue #101 (`scheduler.ts` — errors silently swallowed)
- Issue #122 (`wrfc-event-bridge.ts` — `.catch(() => {})`)

### Pattern: `as unknown as T` Double Casts Hiding SDK/Spec Divergence
Multiple files use double type casts to work around SDK type mismatches, silencing type-checking.
- Issue #32 (`main.ts` — finish event cast)
- Issue #63 (`commands-emitter.ts` — available_commands cast)
- Issue #64 (`agent.ts` — session_info_update cast)

### Pattern: Missing Session Isolation
Several subsystems lack per-session scoping, breaking ACP's multi-session contract.
- Issue #56 (`directive.ts` — no `sessionId` on Directive)
- Issue #57 (`queue.ts` — shared queue for all sessions)
- Issue #129 (`logs/manager.ts` — no session scoping)

### Pattern: `PluginRegistration.register` Forces Unsafe `unknown` Cast
Multiple plugins cast registry from `unknown` due to a shared type definition issue.
- Issue #135 (`skills/index.ts`, `review/index.ts`, `project/index.ts`)

### Pattern: Dead Code / Unused Type Declarations
Types and functions declared but never consumed in the actual runtime flow.
- Issue #15 (`permissions.ts` — `PermissionOption` type shape unused)
- Issue #16 (`permissions.ts` — `toolCall` and `options` fields unused)
- Issue #45 (`engine.ts` — `_pendingWarnings` write-only)
- Issue #67 (`modes.ts` — `toSessionModeState` never imported)

### Pattern: Protocol Version Constant Ambiguity
Multiple representations of protocol version create confusion.
- Issue #60 (`constants.ts` — integer `1` vs SDK string `"0.15"`)
- Issue #86 (`daemon.ts` — hardcoded `protocolVersion: 1`)

### Pattern: State Transition Validation Missing
State machines accept arbitrary transitions without guard checks.
- Issue #70 (`manager.ts` — session state allows reverse transitions)
- Issue #134 (`tracker.ts` — agent status allows invalid transitions)
