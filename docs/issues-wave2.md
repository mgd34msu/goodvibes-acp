# Wave 2 Code Review — All Issues

## Summary
- **Total**: 105 issues (12 Critical, 33 Major, 39 Minor, 21 Nitpick)
- **Average Score**: 5.96/10
- **Scope**: Domain logic — core, extensions (non-ACP), plugins
- **Reviewed Against**: ACP Knowledgebase (10 files)

---

## KB01: Overview & Architecture — Core (Score: 8.2/10)

### Major (3)
1. **[src/core/event-bus.ts:167-169]** sessionId extraction is fragile — extracted from payload via unsafe cast `(payload as Record<string, unknown>)?.sessionId`. ACP sessions are first-class; EventBus should accept sessionId as explicit `emit()` parameter. Breaks on primitives, arrays, or payloads without sessionId.
2. **[src/core/event-bus.ts:174-176]** Ring buffer uses `shift()` — O(n) per emit. For high-frequency ACP streaming updates, this creates linear degradation. Use circular buffer index or deque.
3. **[src/core/config.ts:146-149]** Env var path mapping incorrect for multi-segment keys — `GOODVIBES_AGENTS_MAX_PARALLEL` maps to `agents.max.parallel` instead of `agents.maxParallel`. Underscore-to-dot conversion conflicts with camelCase conversion. Silent misconfiguration.

### Minor (5)
4. **[src/core/state-machine.ts:159-165]** Async onEnter/onExit hooks are fire-and-forget — errors silently swallowed with `catch(() => {})`. State entry/exit side effects (e.g., persisting session state) can fail silently.
5. **[src/core/trigger-engine.ts:40-48]** Regex pattern creates new RegExp on every event evaluation. Since TriggerEngine subscribes to `*`, this is wasteful. Compile and cache at registration time.
6. **[src/core/state-store.ts:47-72]** Duplicated `deepMerge` implementation between config.ts and state-store.ts. Extract to shared utility.
7. **[src/core/scheduler.ts:232-241]** Scheduler swallows handler errors silently — no EventBus dependency for error reporting.
8. **[src/core/queue.ts:70-80]** O(n) insertion on every enqueue — linear scan for priority position. Use binary search or heap for large queues.

### Nitpick (4)
9. **[src/core/event-bus.ts:283-284]** Event IDs use `Date.now() + counter` — not globally unique across instances/restarts. Consider `crypto.randomUUID()`.
10. **[src/core/config.ts:347-349]** Config swallows listener errors silently — empty `catch {}`.
11. **[src/core/registry.ts:37-39]** Registry uses `unknown` type erasure for `_single` and `_multi` maps. No runtime type safety.
12. **[src/core/index.ts:1-90]** Barrel re-exports types through double-hop (trigger-engine.ts re-exports from ../types/).

---

## KB02: Initialization & Connection Lifecycle (Score: 6.8/10)

### Major (3)
13. **[src/extensions/services/auth.ts (whole file)]** `AuthOrchestrator` exported but never imported outside its module — dead code. More critically, handles outbound service auth, but no ACP inbound `authenticate` method handler exists. KB requires handling `authMethods` flow.
14. **[src/extensions/services/health.ts (whole file)]** `ServiceHealthChecker` exported but never imported outside its module — dead code. Checks external HTTP services, not ACP connection health or initialization state.
15. **[src/extensions/lifecycle/shutdown.ts]** No explicit ACP session cleanup. No evidence of ACP-specific shutdown handlers registered (closing sessions, sending shutdown notifications, draining JSON-RPC requests).

### Minor (4)
16. **[src/extensions/lifecycle/health.ts:41,44]** `_eventBus` injected but never used to emit events. Health state transitions should emit events for ACP transport reactivity.
17. **[src/extensions/lifecycle/daemon.ts:246]** `_stopTcpServer()` sets `this._tcpServer = null` before close callback fires — state inconsistency during close.
18. **[src/extensions/lifecycle/shutdown.ts:103-108]** Timeout timer never cleared on success — timer leak.
19. **[src/extensions/lifecycle/shutdown.ts:87-96]** `registerPlugin` hardcodes L3 (300) shutdown order. No mechanism for plugins to specify custom ordering.

### Nitpick (2)
20. **[src/extensions/lifecycle/daemon.ts:65-66]** Health endpoint response lacks ACP metadata (protocol version, capabilities, connected clients).
21. **[src/extensions/services/registry.ts:153]** No validation that `config.endpoint` is a valid URL.

---

## KB03: Sessions (Score: 5.8/10)

### Critical (2)
22. **[src/extensions/sessions/manager.ts:235-250]** `setConfigOption` does not emit any event. KB requires `config_options_update` session notification on config change.
23. **[src/extensions/sessions/manager.ts:235-250]** `setConfigOption` stores configOptions as flat `Record<string, string>` instead of ACP `ConfigOption[]` structure with `id`, `name`, `description`, `category`, `type`, `currentValue`, `options[]`. Clients cannot reconstruct full config state.

### Major (4)
24. **[src/extensions/sessions/manager.ts:104-113]** `load()` does not emit a session event for resumption.
25. **[src/extensions/sessions/manager.ts:104-113]** `load()` does not replay conversation history. KB requires streaming entire history as `session/update` notifications before responding to `session/load`.
26. **[src/types/session.ts:30-43]** `MCPServerConfig` missing ACP transport types (`http`, `sse`) and `env?: EnvVariable[]` field for stdio.
27. **[src/types/events.ts:32-39]** `SessionEventType` union missing `session:state-changed` and `session:mode-changed` — both emitted by SessionManager but not typed.

### Minor (3)
28. **[src/extensions/sessions/manager.ts:235]** `setConfigOption` returns `void` instead of full config state. KB says response must include ALL configOptions.
29. **[src/extensions/sessions/modes.ts]** No legacy `modes` response format produced. KB says agents SHOULD send both `configOptions` and `modes` during transition.
30. **[src/extensions/memory/manager.ts:26]** No schema migration logic. `SCHEMA_VERSION = '1.0.0'` defined but `load()` doesn't validate or migrate between versions.

### Nitpick (2)
31. **[src/types/session.ts:13]** SessionState lacks `paused`/`suspended` state for long-running sessions.
32. **[src/extensions/memory/manager.ts:88-97]** MemoryManager is purely cross-session, no session-scoped state persistence mechanism exists.

---

## KB04: Prompt & Turn Lifecycle (Score: 6.8/10)

### Major (3)
33. **[src/extensions/wrfc/orchestrator.ts:300-312]** Cancellation bypasses state machine integrity — transitions to `failed` via FAIL event then manually overwrites context.state to `escalated`. Split-brain: `machine.current()` returns `failed` but context says `escalated`. KB requires `stopReason: "cancelled"`.
34. **[src/extensions/acp/agent.ts:335-340]** Error condition returns `stopReason: 'end_turn'` instead of distinguishing errors. Masks errors as normal completions.
35. **[src/extensions/acp/tool-call-emitter.ts:42-47]** Missing `kind` field on `tool_call` updates. KB specifies `kind: ToolCallKind` (`read`, `write`, `run`, `switch_mode`, `other`).

### Minor (5)
36. **[src/extensions/acp/agent-event-bridge.ts:86]** Maps `cancelled` agent status to ACP `'failed'` instead of `'cancelled'`. KB defines `cancelled` as valid `ToolCallStatus`.
37. **[src/extensions/acp/agent.ts:317,325,336]** Emits `finish` session update type not in KB spec, cast to `any`.
38. **[src/extensions/directives/queue.ts:217]** `process()` drains ALL directives before processing — misses concurrently enqueued directives.
39. **[src/extensions/wrfc/orchestrator.ts (general)]** No guarantee ACP bridge is registered before orchestrator emits events.
40. **[src/extensions/wrfc/handlers.ts:140-147]** Re-emits `wrfc:state-changed` as `wrfc:phase-changed` — redundant, no consumer found.

### Nitpick (2)
41. **[src/extensions/wrfc/handlers.ts:77]** `event.payload as { ... }` — unsafe cast without runtime validation.
42. **[src/extensions/wrfc/orchestrator.ts:182]** `agentResult.errors.map((e) => e.message ?? ...)` assumes error shape without null guard on array.

---

## KB05: Permissions (Score: 3.8/10)

### Critical (3)
43. **[src/extensions/hooks/built-ins.ts (entire file)]** No permission-checking hooks exist. KB requires pre-hook on `tool:execute` that calls `PermissionGate.check()`. Hook system has zero hooks for `tool:call` or `tool:execute` events.
44. **[src/types/permissions.ts:18-23]** `PermissionType` enum misaligned with ACP spec. KB: `shell`, `file_write`, `file_delete`, `network`, `browser`. Code: `tool_call`, `file_write`, `file_read`, `command_execute`, `network_access`. Only `file_write` matches.
45. **[src/types/agent.ts:33-48]** `AgentConfig` carries no permission context. No `permissions`, `permissionPolicy`, `mode`, or `allowedActions` field. Spawned agents cannot know permission rules.

### Major (3)
46. **[src/extensions/hooks/registrar.ts:47-108]** No tool lifecycle hooks registered. Events system defines `tool:called` and `tool:executed` but `registerBuiltins()` registers zero hooks for these.
47. **[src/types/permissions.ts:40-53]** `PermissionRequest` lacks `sessionId` field. KB wire format requires `sessionId` in every `session/request_permission`.
48. **[src/extensions/hooks/built-ins.ts:18-28]** `validateAgentConfig` doesn't check permission-related fields when spawning agents.

### Minor (2)
49. **[src/types/permissions.ts:60-64]** `PermissionResult` uses `status: 'granted' | 'denied'` instead of KB's `{ granted: boolean }`.
50. **[src/extensions/hooks/index.ts:9]** Barrel export only exports `HookRegistrar`. Built-in hook functions not re-exported.

### Nitpick (1)
51. **[src/extensions/hooks/built-ins.ts:19]** `context` parameter typed as `Record<string, unknown>` — loses type safety. Should use `AgentConfig`.

---

## KB06: Tools & MCP (Score: 7.2/10)

### Critical (1)
52. **[src/extensions/mcp/tool-call-bridge.ts:82]** Wrong initial status: emits `'in_progress'` on tool_start, skipping `'pending'`. Breaks permission-gated clients expecting `pending` before execution.

### Major (3)
53. **[src/extensions/acp/tool-call-emitter.ts:34-53]** `emitToolCall` missing `kind` parameter. KB defines `kind?: ToolCallKind`. Clients cannot render tool-specific icons.
54. **[src/extensions/mcp/tool-call-bridge.ts:94-101]** `emitToolCallUpdate` for completed/failed missing `content` field. Only sends `_meta` with duration/error — no `ContentBlock[]`.
55. **[src/extensions/mcp/transport.ts:169-179]** No request timeout — MCP server hang causes indefinite block.

### Minor (4)
56. **[src/extensions/mcp/tool-call-bridge.ts:70]** `activeIds` keyed by tool name — concurrent same-tool calls overwrite each other.
57. **[src/extensions/mcp/bridge.ts:200-213]** `McpServerStdio.env` treated as array `{name, value}` vs KB spec `Record<string,string>` (SDK is actually correct here, KB docs misleading).
58. **[src/extensions/mcp/tool-call-bridge.ts:85,101,117]** `.catch(() => {})` silently swallows emission errors.
59. **[src/plugins/review/scoring.ts:24-35]** Dimension names/weights differ from 10-Category Framework in review skill.

### Nitpick (2)
60. **[src/extensions/mcp/tool-call-bridge.ts:27-29]** Comment says `status: in_progress` but KB uses `running` (SDK actually uses `in_progress` — KB is stale here).
61. **[src/extensions/mcp/bridge.ts:191]** Uses `console.error` directly instead of structured logging.

---

## KB07: Filesystem & Terminal (Score: 6.2/10)

### Major (3)
62. **[src/plugins/project/deps.ts:9,20,62]** Uses `readFile` from `node:fs/promises` directly. Does not use `ITextFileAccess` — will never read unsaved editor buffer state.
63. **[src/plugins/project/security.ts:9,176,279]** Same pattern — `SecurityScanner` reads files directly. Scanning for secrets in unsaved content is arguably more critical.
64. **[src/plugins/project/analyzer.ts:209-216]** `ProjectAnalyzer` directly instantiates sub-analyzers without injecting `ITextFileAccess`. Makes dual-path pattern impossible.

### Minor (3)
65. **[src/plugins/project/db.ts:9,29]** `DatabaseTools.parsePrismaSchema` reads via direct `readFile`. Dual-path pattern should apply for consistency.
66. **[src/plugins/project/test.ts:8,99,127]** `TestAnalyzer` reads test files directly — misses editor buffer state.
67. **[src/extensions/logs/manager.ts:9,84,97,100]** LogsManager uses direct `readFile`/`writeFile`/`appendFile`. These are internal files, but routing through `ITextFileAccess.writeTextFile` would notify editor of changes.

### Nitpick (2)
68. **[src/plugins/project/index.ts:77]** `register` casts `registry as Registry` — couples L3 to L1 internals.
69. **[src/extensions/logs/manager.ts:76-102]** `prependEntry` has fragile insertion strategy (splitting on first `\n\n`).

---

## KB08: Extensibility (Score: 4.8/10)

### Critical (3)
70. **[src/plugins/analytics/engine.ts (entire file)]** AnalyticsEngine does not implement `IToolProvider`. No `name`, `tools`, or `execute()`. Cannot be dispatched through ACP tool system.
71. **[src/plugins/frontend/analyzer.ts (entire file)]** FrontendAnalyzer does not implement `IToolProvider`. Unreachable via standard tool invocation.
72. **[All plugin files]** Zero ACP extension method integration. No `handleExtMethod()`, no `onExtNotification()`, no `_goodvibes/`-prefixed methods handled or emitted. KB defines `_goodvibes/analytics` and `_goodvibes/events` — neither implemented.

### Major (4)
73. **[src/plugins/analytics/engine.ts]** Analytics response format doesn't match KB's `GoodVibesAnalyticsResponse`. Engine returns different shape from spec.
74. **[src/plugins/analytics/index.ts:43-44]** Registry parameter cast as `unknown`. Should also register as `tool-provider` via `registerMany` for tool dispatch discovery.
75. **[src/plugins/frontend/index.ts:43-45]** Same — registers only in single-value registry, not as `tool-provider`.
76. **[src/plugins/analytics/engine.ts:80-100]** `track()` doesn't emit `_goodvibes/events` notifications on budget threshold crossings. Warnings only returned when polled.

### Minor (3)
77. **[src/plugins/analytics/engine.ts]** No `_meta` field support for trace context propagation.
78. **[src/plugins/analytics/export.ts:136-140]** Dead method `_formatEntry()` — always returns `''`, suppressed with eslint-disable.
79. **[src/plugins/frontend/accessibility.ts:317]** Empty `catch` block silently swallows file read errors.

### Nitpick (2)
80. **[src/plugins/analytics/sync.ts:48]** `JSON.parse(raw) as SessionAnalytics` — unsafe cast with no runtime validation.
81. **[src/plugins/frontend/components.ts:62-70]** Sequential file processing — could use `Promise.all` with batching.

---

## KB09: TypeScript SDK (Score: 4.2/10)

### Critical (3)
82. **[src/extensions/ipc/protocol.ts:19-53]** IPC protocol uses custom message format, not JSON-RPC 2.0. Uses `type` instead of `jsonrpc: "2.0"`, `correlationId` instead of `id`, `ok: boolean` instead of `result/error` objects.
83. **[src/extensions/ipc/router.ts:78]** Router dispatches by custom `method` field, not ACP method names. Only dispatches `ping` and `status` built-ins.
84. **[src/extensions/agents/coordinator.ts + tracker.ts]** No ACP session lifecycle integration (initialize/newSession/prompt). Uses custom `AgentStatus` values not mapped to ACP session update types.

### Major (3)
85. **[src/extensions/external/ (all files)]** Entire module is dead code — zero imports outside its directory. ~690 lines unintegrated.
86. **[src/extensions/external/normalizer.ts:19-30]** `NormalizedEvent` format doesn't align with ACP `SessionNotification`. Has `{source, type, payload}` instead of `{sessionId, update}`.
87. **[src/extensions/ipc/protocol.ts:73-88]** Deserializer validation incomplete — no type discriminant validation, no method field check on requests, no message size limit.

### Minor (4)
88. **[src/extensions/ipc/socket.ts:152]** String encoding assumption — `setEncoding('utf-8')` forces all data through string decoding. Malformed UTF-8 silently replaced.
89. **[src/extensions/external/file-watcher.ts:198-199]** `rename` event always mapped to `created`, never `deleted`. Needs `stat` check to distinguish.
90. **[src/extensions/agents/tracker.ts:140-146]** `activeCount()` iterates all keys twice (get + filter) — N+1 store lookups.
91. **[src/extensions/agents/coordinator.ts:84]** `_pendingResolvers` uses object reference equality for Map keys — breaks if configs are cloned.

### Nitpick (1)
92. **[src/extensions/ipc/router.ts:66]** Parameter named `type` shadows message `type` field concept. Use `methodName`.

---

## KB10: Implementation Guide (Score: 6.8/10)

### Major (4)
93. **[src/plugins/precision/index.ts:434]** No tool_call status emission hook. `execute()` provides no mechanism for L2 to emit `pending -> running -> completed` ACP updates. Needs `onStatus` callback.
94. **[src/plugins/agents/spawner.ts:94-210]** Agent spawn doesn't capture `filesModified`. Array initialized empty, never populated. ACP clients cannot display changed files.
95. **[src/plugins/agents/loop.ts:175-237]** Tool calls executed sequentially, not in parallel. `for...of` loop despite comment saying "parallel order". Use `Promise.all` for independent calls.
96. **[src/plugins/agents/spawner.ts:118-119]** Immediate `spawned -> running` transition without `pending` state. No window for L2 to emit ACP `pending` tool_call.

### Minor (6)
97. **[src/plugins/agents/providers/anthropic.ts:30-38]** No AbortSignal forwarding to Anthropic API in `chat()`. Cancellation flow broken.
98. **[src/plugins/agents/providers/anthropic.ts:50-87]** No AbortSignal forwarding in `stream()`. Same issue.
99. **[src/plugins/skills/registry.ts:23-112]** Skill content is placeholder-level — single sentences. Not actionable for agents.
100. **[src/plugins/agents/loop.ts:82]** No system prompt enrichment with task context (cwd, workspace roots, available tools).
101. **[src/plugins/precision/index.ts:628-632]** Plugin `register()` uses unsafe cast `(registry as Registry)`. All three plugin entry points repeat this.
102. **[src/plugins/agents/providers/mock.ts:59-67]** Mock `stream()` skips `tool_use` blocks — tests cannot exercise tool execution loop via streaming.

### Nitpick (3)
103. **[src/plugins/precision/types.ts:22]** `ExtractMode` missing `'ast'` which appears in MCP tool schema.
104. **[src/plugins/agents/loop.ts:241-242]** Comment says `'precision__read_file'` but actual names would be `'precision__precision_read'`.
105. **[src/plugins/skills/types.ts:21]** `SkillDefinition.content` typed as `string` with no max length constraint.

---

## Cross-Cutting Themes

### 1. Missing ACP Bridging Hooks (12 issues)
L3 plugins lack callbacks/events for L2 ACP layer to emit tool_call lifecycle, file tracking, and `_meta` data.

### 2. Dead/Orphaned Code (4 issues)
- `AuthOrchestrator` — never imported
- `ServiceHealthChecker` — never imported  
- `src/extensions/external/` — entire module (~690 lines) orphaned
- `export.ts:_formatEntry()` — dead method

### 3. Silent Error Swallowing (8 issues)
Widespread `.catch(() => {})` and empty catch blocks across core, hooks, lifecycle, and MCP modules.

### 4. Permission System Disconnected (5 issues)
PermissionGate exists but hooks don't enforce it. Types misaligned with spec. Agents carry no permission context.

### 5. IToolProvider Not Implemented (3 issues)
Analytics and frontend plugins unreachable via standard tool dispatch.

### 6. Direct FS Instead of ITextFileAccess (5 issues)
Project plugins bypass the ACP filesystem abstraction entirely.
