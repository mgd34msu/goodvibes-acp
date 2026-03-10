# Codebase Quality Review

**Generated**: 2026-03-10T12:00:00Z
**Project**: goodvibes-acp
**Reviewer**: Claude Opus 4.6 (automated)
**Files Analyzed**: 143 source files + 79 test files
**Lines of Code**: 28,449 (source) + 24,725 (tests)

## Executive Summary

Overall Score: **7.4/10**

The goodvibes-acp codebase implements a well-structured 4-layer architecture (L0 types -> L1 core -> L2 extensions -> L3 plugins) with strict layer boundaries enforced by convention. The architecture is sound and layer violations are absent. Test coverage is comprehensive at 79 test files with 1,881 test assertions across 507 describe blocks. TypeScript strict mode is enabled. The primary weaknesses are: the 800-line composition root (`main.ts`) carrying too much inline logic, 28 instances of `as unknown as` type erasure, 17 catch-and-log error swallowing patterns, and incomplete JSDoc documentation on exported symbols.

| Dimension | Score | Grade | Key Findings |
|-----------|-------|-------|-------------|
| Correctness | 8/10 | B | Sound logic; 5 TODO items indicate known incomplete areas |
| Type Safety | 7/10 | B- | Strict mode on, but 28 `as unknown as` casts and 16 non-null assertions |
| Error Handling | 6/10 | C+ | 17 catch-and-log swallows; no structured error propagation in event bridges |
| Security | 8/10 | B | No hardcoded secrets; 0 injection vectors; proper input validation |
| Performance | 7/10 | B- | Timer cleanup managed; 31 setTimeout/setInterval usage points need audit |
| Architecture | 9/10 | A | Zero layer violations; clean L0->L1->L2->L3 dependency flow |
| Maintainability | 6/10 | C+ | main.ts at 800 lines; 6 files over 450 lines; duplicate wrfcAdapter inline |
| Testing | 8/10 | B | 79 test files, 1,881 assertions; 16 skipped tests; 0 `.only()` calls |
| Documentation | 5/10 | D+ | JSDoc present in 16+ files but 100+ exported symbols lack documentation |
| Configuration | 8/10 | B | Env var cascading; config validation; 5 hardcoded URLs (all localhost defaults) |

## Statistics

- Source files: 143 (100 in src/, 43 type definition files)
- Test files: 79
- Test assertions (`it()` calls): 1,881
- Test suites (`describe()` blocks): 507
- Skipped tests: 16 (across 3 files)
- Lines of source code: 28,449
- Lines of test code: 24,725
- Test-to-source ratio: 0.87:1
- Dependencies: 3 runtime (`@agentclientprotocol/sdk`, `@anthropic-ai/sdk`, `zod`)
- Dev dependencies: 4 (`@types/bun`, `@typescript-eslint/*`, `eslint`, `typescript`)

## Detailed Findings

### Correctness

#### TODO Items Indicating Incomplete Logic
- **Severity**: minor
- **Location**: `src/extensions/sessions/manager.ts:122`, `src/extensions/sessions/manager.ts:302`
- **Description**: Two TODO comments (ISS-033) describe a known type cast workaround where `params.mcpServers` is cast via `as unknown as MCPServerConfig[]`. The TODO notes that a proper adapter function should replace the cast.
- **Impact**: The cast is structurally safe today but fragile if either type diverges.
- **Recommendation**: Implement a dedicated `toMCPServerConfig()` adapter function.

#### TODO in Skills Registry
- **Severity**: informational
- **Location**: `src/plugins/skills/registry.ts:65`
- **Description**: Inline TODO present in skills content string.
- **Impact**: Low; this is documentation content, not runtime logic.
- **Recommendation**: Track in issue tracker and remove inline TODO.

#### TODO in Agent Types
- **Severity**: informational
- **Location**: `src/plugins/agents/types.ts:94`
- **Description**: TODO marker in agent type configuration.
- **Impact**: Tracked issue.
- **Recommendation**: Resolve or move to issue tracker.

#### TODO in HTTP Listener
- **Severity**: minor
- **Location**: `src/extensions/external/http-listener.ts:15`
- **Description**: TODO at top of file suggesting incomplete implementation.
- **Impact**: Feature may not be fully production-ready.
- **Recommendation**: Complete implementation or mark as experimental.

### Type Safety

#### Widespread `as unknown as` Type Erasure
- **Severity**: major
- **Location**: 28 instances across 13 files, including:
  - `src/extensions/acp/transport.ts:136-137` (Node-to-Web stream interop)
  - `src/extensions/acp/agent.ts:250,289,306` (MCP server config casts)
  - `src/extensions/hooks/registrar.ts:67,89,98` (hook context casts)
  - `src/extensions/hooks/built-ins.ts:57` (2 casts on same line)
  - `src/plugins/agents/loop.ts:471,479` (tool result casts)
  - `src/extensions/ipc/protocol.ts:152` (IPC message cast)
  - `src/extensions/mcp/tool-proxy.ts:104,111` (tool execution casts)
  - `src/core/config.ts:230,272` (config value casts)
  - `src/core/event-bus.ts:297,309` (event payload casts)
  - `src/core/trigger-engine.ts:224` (trigger context cast)
  - `src/plugins/analytics/sync.ts:31` (analytics data cast)
  - `src/extensions/acp/commands-emitter.ts:116` (commands cast)
  - `src/extensions/sessions/manager.ts:303` (session data cast)
- **Description**: The `as unknown as` pattern completely bypasses TypeScript's type checker. While 4 of these (transport.ts) are justified by Node-to-Web stream interop requirements and are well-documented, the remaining 24 represent type safety gaps.
- **Impact**: Silent type mismatches at runtime. If upstream types change, the compiler will not catch breakage.
- **Recommendation**: For each cast site, introduce a type-narrowing function with runtime validation (e.g., using Zod schemas) or a dedicated adapter type that bridges the two interfaces.

#### Non-Null Assertions
- **Severity**: minor
- **Location**: 16 instances across 9 files, notably:
  - `src/main.ts:314,317,320,323` (4 `registry.get<T>('...')!` calls)
  - `src/plugins/agents/spawner.ts:146,147,151` (3 assertions on agent state)
  - `src/core/state-machine.ts:296,313` (state transition assertions)
- **Description**: Non-null assertions (`!.`) suppress TypeScript null checks. The 4 in `main.ts` are on registry lookups after plugin registration, which is safe in practice but fragile if registration order changes.
- **Impact**: Potential runtime `TypeError` if assumptions are violated.
- **Recommendation**: Use explicit null checks with descriptive error messages for registry lookups.

#### `any` Type Usage
- **Severity**: minor
- **Location**: `src/plugins/agents/loop.ts:463` (`: any` annotation)
- **Description**: Single explicit `: any` type annotation found in production source. The `any` grep returned 39 files, but most are legitimate uses in type comments, JSDoc, or within string literals. Only 1 is a genuine `any` type annotation.
- **Impact**: Minimal; isolated to a single location.
- **Recommendation**: Replace with a specific type or `unknown`.

### Error Handling

#### Catch-and-Log Error Swallowing in Event Bridges
- **Severity**: major
- **Location**: `src/extensions/wrfc/wrfc-event-bridge.ts:120,128,143,150,165` (5 instances); `src/extensions/acp/agent-event-bridge.ts:68,98` (2 instances); `src/extensions/acp/plan-emitter.ts:139`; `src/extensions/acp/commands-emitter.ts:118`; `src/extensions/acp/agent.ts:499`
- **Description**: Promise rejections from `emitToolCall()` and `emitToolCallUpdate()` are caught and logged to stderr with `console.error()`, then silently discarded. This pattern appears 17 times across 7 files.
- **Impact**: Failures in ACP session update emission are invisible to the orchestration layer. A broken connection could silently drop all client-facing progress updates without triggering any retry or escalation.
- **Recommendation**: Introduce an error counter or emit a diagnostic event (e.g., `runtime:error`) so the health check system can detect degraded bridge communication.

#### State Machine Hook Errors Swallowed
- **Severity**: minor
- **Location**: `src/core/state-machine.ts:138-141`
- **Description**: `_safeRunHook()` catches both synchronous and asynchronous errors and logs them to `console.error()`, with no re-throw or error event emission.
- **Impact**: Hook failures (including WRFC state transition hooks) are silently absorbed.
- **Recommendation**: Add an optional `onHookError` callback to `StateMachineConfig` for callers that need visibility.

#### Empty Catch Blocks
- **Severity**: informational
- **Location**: 0 instances found.
- **Description**: No empty catch blocks exist in the codebase.
- **Impact**: None. This is a positive finding.

### Security

#### No Hardcoded Secrets
- **Severity**: informational
- **Location**: 0 instances found.
- **Description**: Grep for `api_key`, `secret`, `password`, `token` with assigned string values returned 0 matches. The `ServiceAuth` interface in `src/extensions/services/registry.ts:20-32` properly models credentials as optional fields loaded at runtime.
- **Impact**: None. This is a positive finding.

#### Hardcoded localhost Defaults
- **Severity**: informational
- **Location**: `src/main.ts:717`, `src/core/config.ts:21`, `src/types/constants.ts:124`, `src/types/transport.ts:49`, `src/extensions/lifecycle/daemon.ts:30,166`
- **Description**: 6 instances of hardcoded `127.0.0.1` or `localhost`, all used as fallback default values with environment variable or config overrides available.
- **Impact**: None; these are safe defaults for a local-first runtime.
- **Recommendation**: No action needed; defaults are appropriate.

#### Input Validation
- **Severity**: informational
- **Description**: Port validation exists in `main.ts:710-713` and `main.ts:723-726` with range checks (1-65535) and NaN guards. Config validation runs at startup via `config.validate()`.
- **Impact**: Positive finding.

### Performance

#### Timer Usage Across Codebase
- **Severity**: minor
- **Location**: 31 instances of `setTimeout`/`setInterval`/`Promise.race` across 12 files:
  - `src/main.ts:671,680,687` (shutdown grace periods)
  - `src/extensions/acp/terminal-bridge.ts:162,165,167,170,219` (5 instances for terminal execution timeouts)
  - `src/extensions/lifecycle/shutdown.ts:103,105,112` (handler timeouts)
  - `src/plugins/agents/spawner.ts:64,66,204,249,254` (agent timeout management)
  - `src/core/scheduler.ts:71,103,168` (job scheduling)
  - `src/core/trigger-engine.ts:230,233` (trigger delays)
- **Description**: Timer-based concurrency is used extensively. Shutdown timers use `.unref()` correctly. The spawner uses `Promise.race` for timeout management.
- **Impact**: Timers in terminal-bridge.ts were previously identified (ISS-044,045) and fixed with proper cleanup. Current usage appears managed.
- **Recommendation**: Verify that all `setInterval` calls have corresponding cleanup in shutdown handlers.

#### Event Listener Cleanup
- **Severity**: minor
- **Location**: 14 `removeListener`/`off`/`unsubscribe` calls across 5 files.
- **Description**: Event listener cleanup exists but the ratio of event subscriptions to cleanups is imbalanced. With 31+ console.error logging subscribers and connection-scoped event handlers, leak potential exists for long-running daemon mode.
- **Impact**: In daemon mode with many connections over time, unremoved listeners could accumulate.
- **Recommendation**: Audit daemon-mode connection lifecycle to ensure all per-connection event subscriptions are removed on disconnect.

### Architecture

#### Zero Layer Violations
- **Severity**: informational
- **Location**: Entire codebase.
- **Description**: Grep for L0 types importing from extensions/plugins returned 0 matches. L1 core importing from L2 extensions returned 0 matches. L1 core importing from L3 plugins returned 0 matches. L2 extensions importing from L3 plugins returned 0 matches. The 4-layer dependency hierarchy is strictly maintained.
- **Impact**: Highly positive finding. This enables independent testing and evolution of each layer.

#### Clean Module Boundaries
- **Severity**: informational
- **Description**: Each layer has barrel `index.ts` exports. The types layer exports 16 type modules. Core exports 11 modules. Extensions are organized into 13 sub-domains. Plugins span 7 domains.
- **Impact**: Well-organized module structure supports maintainability.

#### Composition Root Complexity
- **Severity**: major
- **Location**: `src/main.ts` (800 lines)
- **Description**: The composition root performs wiring, WRFC adapter construction (lines 306-634 = 328 lines of inline adapter logic), mode detection, shutdown handling, and transport setup. The `wrfcAdapter` object literal spans 328 lines and contains the full review/fix orchestration logic as inline closures.
- **Impact**: The inline WRFC adapter makes `main.ts` difficult to test independently, hard to navigate, and violates single responsibility.
- **Recommendation**: Extract the WRFC adapter into its own module (e.g., `src/extensions/wrfc/adapter.ts`), reducing `main.ts` to pure wiring.

### Maintainability

#### Large Files
- **Severity**: minor
- **Location**: 6 files exceed 450 lines:
  - `src/main.ts`: 800 lines
  - `src/plugins/precision/index.ts`: 657 lines
  - `src/extensions/acp/agent.ts`: 615 lines
  - `src/plugins/agents/loop.ts`: 501 lines
  - `src/plugins/agents/types.ts`: 469 lines
  - `src/plugins/agents/spawner.ts`: 449 lines
- **Description**: These files carry significant cognitive load. The precision plugin at 657 lines bundles all tool registrations into a single file.
- **Impact**: Harder to navigate, review, and maintain.
- **Recommendation**: Extract `precision/index.ts` tool registrations into per-tool registration files. Consider splitting `agent.ts` (the ACP agent class) into protocol handler vs. session management.

#### Console.log in Core
- **Severity**: minor
- **Location**: `src/core/event-bus.ts:66`, `src/core/hook-engine.ts:74`
- **Description**: Two `console.log()` calls in L1 core modules (not `console.error`). These may produce output on stdout, potentially corrupting the ACP ndjson stream in subprocess mode.
- **Impact**: Could break ACP protocol communication if triggered during active sessions.
- **Recommendation**: Replace with `console.error()` or route through a structured logging interface.

#### Diagnostic console.error Proliferation
- **Severity**: minor
- **Location**: 31 files contain `console.error`/`console.warn`/`console.debug` calls.
- **Description**: Diagnostic logging is implemented via direct `console.error()` calls rather than a unified logging abstraction. While stderr is the correct channel (preserving stdout for ACP), the lack of log levels, structured output, or conditional verbosity limits operational observability.
- **Impact**: Cannot filter, aggregate, or control log verbosity at runtime.
- **Recommendation**: Introduce a lightweight logger wrapper (e.g., `logger.debug()`, `logger.info()`, `logger.error()`) that respects the `LogLevel` type already defined in `src/types/config.ts:13`.

### Testing

#### Comprehensive Coverage
- **Severity**: informational
- **Description**: 79 test files cover all 4 layers: 11 core tests, 43 extension tests, 21 plugin tests, 4 integration tests. The test-to-source line ratio is 0.87:1, indicating substantial investment in testing.
- **Impact**: Strong regression detection capability.

#### Skipped Tests
- **Severity**: minor
- **Location**: 16 skipped tests across 3 files:
  - `tests/extensions/mcp-transport.test.ts:88,413,425` (3 skips)
  - `tests/extensions/acp-terminal-bridge.test.ts:39,45,52,57,63` (6+ skips)
  - `tests/core/state-machine.test.ts:219,234` (2 skips)
- **Description**: Skipped tests indicate either known failures, platform-specific limitations, or deferred work.
- **Impact**: Reduced effective coverage in MCP transport, terminal bridge, and state machine areas.
- **Recommendation**: Triage skipped tests: fix or remove with a tracking issue.

#### No `.only()` Calls
- **Severity**: informational
- **Description**: Zero `.only()` calls found in test files.
- **Impact**: Positive finding; no tests are accidentally exclusive.

#### No ESLint Configuration
- **Severity**: minor
- **Location**: Project root (missing `.eslintrc.*`)
- **Description**: Despite `eslint` and `@typescript-eslint/*` being listed as devDependencies, no `.eslintrc` configuration file exists. The `lint` script in `package.json:16` will use default rules or fail.
- **Impact**: The lint script is non-functional without configuration, and code style consistency is not enforced.
- **Recommendation**: Create an ESLint configuration file aligned with the TypeScript strict mode settings.

### Documentation

#### Incomplete JSDoc Coverage
- **Severity**: major
- **Location**: 100+ exported symbols across 27 files lack JSDoc documentation.
- **Description**: While JSDoc comments exist in 16+ files (notably in types and core modules), the majority of exported functions, classes, and types in the extensions and plugins layers lack documentation. The L0 types layer has good documentation with descriptive comments on each type.
- **Impact**: Developers must read implementation to understand API contracts. Plugin authors have no reference documentation.
- **Recommendation**: Prioritize JSDoc for all public interfaces in `src/types/registry.ts` (300 lines, the central registry contract) and all plugin `index.ts` files.

#### Inline Comments Quality
- **Severity**: informational
- **Description**: Where comments exist, they are high quality: ISS-xxx issue references, rationale explanations (e.g., the double-cast comment in `transport.ts:120-122`), and architectural decisions. The `main.ts` header comment clearly explains the 4-layer wiring.
- **Impact**: Positive finding where present.

### Configuration

#### Proper Config Cascading
- **Severity**: informational
- **Location**: `src/main.ts:705-729`
- **Description**: Configuration follows a clear precedence: config file -> environment variable -> CLI argument -> default value. Port validation includes range and NaN checks.
- **Impact**: Robust configuration handling.

#### TypeScript Configuration
- **Severity**: informational
- **Location**: `tsconfig.json`
- **Description**: `strict: true` enabled, path aliases defined for all layers (`@l0/*`, `@l1/*`, `@l2/*`, `@l3/*`), `composite: true` for project references. Tests excluded from compilation (separate compilation context).
- **Impact**: Strong type safety foundation.

#### Missing ESLint Configuration
- **Severity**: minor
- **Location**: Project root
- **Description**: ESLint dependencies installed but no configuration file exists.
- **Impact**: `npm run lint` is non-functional.
- **Recommendation**: Create `.eslintrc.json` with `@typescript-eslint/recommended` ruleset.

## Strengths

1. **Architecture discipline**: Zero layer violations across 143 source files. The L0->L1->L2->L3 hierarchy is strictly enforced.
2. **Test investment**: 79 test files with 1,881 assertions and a 0.87:1 test-to-source ratio demonstrate serious testing commitment.
3. **Type safety foundation**: TypeScript strict mode, no explicit `any` parameters, and only 1 genuine `: any` annotation.
4. **Security posture**: Zero hardcoded secrets, proper credential modeling via `ServiceAuth`, input validation on ports and configs.
5. **Dependency minimalism**: Only 3 runtime dependencies, all well-known and maintained.
6. **Issue tracking discipline**: ISS-xxx references in code comments link implementation decisions to tracked issues.
7. **Graceful shutdown**: Ordered shutdown with timeouts, `.unref()` on safety timers, and signal handling for both SIGINT and SIGTERM.
8. **ACP protocol compliance**: Proper ndjson transport, stream patching for Node/Web interop, and protocol version negotiation.
9. **Zero empty catch blocks**: All exception handlers contain meaningful logic.
10. **Clean barrel exports**: Each module domain exposes a clean public API via `index.ts` files.

## Architecture Assessment

The 4-layer architecture is the codebase's strongest feature:

- **L0 (types)**: 16 type modules defining the entire domain vocabulary. Pure types with zero runtime imports. Well-documented with JSDoc.
- **L1 (core)**: 11 infrastructure primitives (EventBus, StateStore, Registry, Config, HookEngine, TriggerEngine, Scheduler, Queue, StateMachine, VersionedStore, utils). Zero imports from L2 or L3.
- **L2 (extensions)**: 13 domain modules across ACP, agents, directives, external, hooks, IPC, lifecycle, logs, MCP, memory, review, services, sessions, and WRFC. Imports only from L0 and L1.
- **L3 (plugins)**: 7 plugin domains (agents, analytics, frontend, precision, project, review, skills). Each follows the `PluginRegistration` pattern with manifest, register, and shutdown.

The composition root (`main.ts`) wires all layers together. Its 800-line length is the primary architectural concern -- the 328-line inline WRFC adapter should be extracted.

Dependency flow is strictly downward: L3 -> L2 -> L1 -> L0. This is verified by grep analysis showing zero upward imports.

## Risk Areas

1. **WRFC adapter in main.ts (lines 306-634)**: 328 lines of untestable inline orchestration logic. This is the highest-risk area because it orchestrates the core WRFC review loop (spawn engineer, spawn reviewer, parse review, fix, re-review) and cannot be unit tested independently.

2. **Event bridge error swallowing (17 catch-and-log sites)**: Silent failures in ACP session updates mean a broken connection could produce no visible error while the orchestration continues executing. In daemon mode with concurrent sessions, this could lead to ghost sessions.

3. **`as unknown as` casts (28 instances)**: 24 non-justified type erasure points create silent failure potential if upstream types evolve. The hooks/registrar.ts casts (lines 67, 89, 98) are particularly concerning as they bypass type checking in the hook execution path.

4. **console.log in L1 core (2 instances)**: `src/core/event-bus.ts:66` and `src/core/hook-engine.ts:74` write to stdout, which is the ACP protocol channel. If these log statements fire during an active ACP session, they will corrupt the ndjson stream.

5. **16 skipped tests**: Reduced coverage in MCP transport, terminal bridge, and state machine areas. The terminal bridge (6 skips) was recently fixed for timer leaks (ISS-044,045), suggesting the skips may be outdated.
