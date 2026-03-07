# GoodVibes ACP — Architecture Plan

## The One Rule

**Dependencies point inward. Never outward. No exceptions.**

```
L0 (Types)        ← imported by ALL layers (zero runtime code)
L1 (Core)         ← imported by L2, L3, main.ts
L2 (Extensions)   ← imported by L3, main.ts
L3 (Plugins)      ← imported by main.ts only
```

You can reach down any number of layers. You can never reach up.

```
✅ L3 → L2, L1, L0
✅ L2 → L1, L0
✅ L1 → L0
❌ L1 → L2, L3
❌ L2 → L3
```

If a lower layer needs to call higher-layer code, it calls through an **interface** defined in L0 and registered at startup.

The **bootstrap** (main.ts) is the composition root — the only place that imports all layers and wires them together.

```
main.ts (bootstrap / composition root)
├── imports L0 (types)
├── imports L1 (core)
├── imports L2 (extensions)
├── imports L3 (plugins)
└── wires implementations into registries, starts services, defines shutdown order
```

## Enforcement

1. **ESLint import boundaries** — automated rule that fails CI if violated
2. **TypeScript project references** — each layer is a separate tsconfig project
3. **Code review** — any upward import is an automatic rejection
4. **This document** — the canonical reference. If code disagrees with this doc, the code is wrong.

---

## Layer 0 — Types

**Purpose**: Shared vocabulary. Interfaces, type definitions, constants, error codes. Zero runtime code.

**Imports**: Nothing. Not even std lib.

**Design principle**: If it has behavior, it doesn't belong here. L0 is pure TypeScript types — no classes, no functions, no side effects. Every layer imports L0 freely because there's nothing to couple to.

### Modules

```
src/types/
├── events.ts               # Event type definitions and payloads
├── session.ts              # Session types, states, context
├── agent.ts                # Agent lifecycle types (spawned/running/completed/failed)
├── wrfc.ts                 # WRFC states, transitions, scores, attempts
├── directive.ts            # Directive types, targets, actions
├── trigger.ts              # Trigger definitions, conditions, actions
├── config.ts               # Configuration schemas
├── memory.ts               # Memory record types (decisions, patterns, failures)
├── errors.ts               # Error types, error codes, error categories
├── registry.ts             # Registry contracts — interfaces that upper layers implement
│                           #   IReviewer, IFixer, IToolProvider, ITriggerHandler,
│                           #   IAuthProvider, IFileSystem, ITerminal, IAgentSpawner
├── transport.ts            # Transport/stream types (ACP, MCP, IPC)
├── plugin.ts               # Plugin manifest types
└── constants.ts            # Shared constants, enums, magic values
```

### Key Interfaces (types/registry.ts)

```typescript
// Upper layers implement these. Lower layers call through them.

interface IReviewer {
  review(workResult: WorkResult): Promise<ReviewResult>;
}

interface IFixer {
  fix(reviewResult: ReviewResult): Promise<FixResult>;
}

interface IToolProvider {
  name: string;
  tools: ToolDefinition[];
  execute(toolName: string, params: unknown): Promise<ToolResult>;
}

interface ITriggerHandler {
  canHandle(trigger: TriggerDefinition): boolean;
  execute(trigger: TriggerDefinition, context: TriggerContext): Promise<void>;
}

interface IAuthProvider {
  methods: AuthMethod[];
  authenticate(params: AuthRequest): Promise<AuthResult>;
}

interface IFileSystem {
  readTextFile(path: string, options?: ReadOptions): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
}

interface ITerminal {
  create(command: string, args?: string[]): Promise<TerminalHandle>;
  output(handle: TerminalHandle): Promise<string>;
  kill(handle: TerminalHandle): Promise<void>;
}

interface IAgentSpawner {
  spawn(config: AgentConfig): Promise<AgentHandle>;
  cancel(handle: AgentHandle): Promise<void>;
  status(handle: AgentHandle): AgentStatus;
}
```

---

## Layer 1 — Core

**Purpose**: Generic primitives. The kernel. Knows nothing about WRFC, agents, ACP, or tools.

**Imports**: L0 only. Zero external dependencies. Only Bun/Node std lib.

**Design principle**: If you ripped out everything domain-specific — WRFC, agents, code review — L1 should still be a useful runtime kernel for *any* event-driven system.

### Modules

```
src/core/
├── event-bus.ts            # Publish/subscribe event system
│                           # - Typed events (types from L0)
│                           # - Wildcard and namespaced subscriptions
│                           # - Async event handlers
│                           # - Event history/replay capability
│
├── state-store.ts          # Key-value state with namespaces
│                           # - get/set/delete/merge operations
│                           # - onChange callback (single listener, NOT event-bus)
│                           # - Namespace isolation
│                           # - Serialization to disk (format defined in L0)
│
├── state-machine.ts        # Generic finite state machine
│                           # - Define states, transitions, guards
│                           # - Transition hooks (onEnter, onExit, onTransition)
│                           # - History tracking
│                           # - Serializable state
│                           # - NO domain knowledge — just states and arrows
│
├── config.ts               # Configuration management
│                           # - Layered config (defaults → file → env → runtime)
│                           # - Schema validation
│                           # - onChange callback (NOT event-bus, avoids circular init)
│                           # - Bootstrap wires config.onChange → eventBus.emit
│
├── registry.ts             # Capability registry
│                           # - Typed register<T>(key, impl) / get<T>(key)
│                           # - Simple Map-based — no discovery, no DI framework
│                           # - This is HOW upper layers provide implementations
│                           #   to lower layers without upward imports
│
├── trigger-engine.ts       # Condition → action evaluation engine
│                           # - Register trigger definitions (types from L0)
│                           # - Evaluate conditions against events
│                           # - Fire count tracking and limits
│                           # - Enable/disable triggers
│
├── queue.ts                # Generic FIFO queue
│                           # - Enqueue/dequeue/peek/drain
│                           # - Priority support
│                           # - Target-based filtering
│                           # - Persistence to disk
│
└── scheduler.ts            # Generic task scheduling
                            # - Interval-based tasks
                            # - Cron-like scheduling
                            # - Task lifecycle (start/stop/pause)
                            # - Concurrent task limits
```

### What L1 does NOT contain:
- WRFC machine (domain-specific FSM — belongs in L2, built on L1 state-machine)
- Agent tracker (domain-specific — belongs in L2)
- Memory/logs (domain-specific format — belongs in L2)
- Session manager (domain-specific lifecycle — belongs in L2)
- Directive queue (domain-specific — L2 uses L1 generic queue)

---

## Layer 2 — Extensions

**Purpose**: Domain logic, communication protocols, orchestration. Extends L1 primitives with GoodVibes-specific and protocol-specific behavior.

**Imports**: L0 and L1.

**Design principle**: Adapters, orchestrators, and domain services. Translates between external protocols and L1 primitives. Contains all GoodVibes-specific logic that isn't a deployable plugin.

### Modules

```
src/extensions/
├── acp/                    # ACP Agent implementation
│   ├── agent.ts            # AgentSideConnection — implements ACP Agent interface
│   │                       # - Maps ACP session/new → L2 session-manager.create()
│   │                       # - Maps ACP session/prompt → L1 event-bus.emit('prompt')
│   │                       # - Maps L1 events → ACP session/update notifications
│   │                       # - Capability negotiation
│   ├── transport.ts        # stdio, TCP, WebSocket transports
│   ├── session-adapter.ts  # Adapts L2 sessions to ACP session semantics
│   └── config-adapter.ts   # Maps L2 config to ACP configOptions
│
├── mcp/                    # MCP Bridge (Claude Code compatibility)
│   ├── bridge.ts           # MCP server that proxies to L1/L2 primitives
│   ├── tool-proxy.ts       # Translates MCP tool calls → L1 registry.execute()
│   ├── hook-adapter.ts     # Translates Claude Code hook events → L1 events
│   │                       # - SubagentStart/Stop → agent lifecycle events
│   │                       # - UserPromptSubmit → directive delivery
│   │                       # - Replaces current hook-to-directive pipeline
│   └── transport.ts        # stdio transport for MCP
│
├── ipc/                    # Internal process communication
│   ├── router.ts           # IPC message routing
│   ├── socket.ts           # Unix socket / TCP server
│   └── protocol.ts         # Internal wire protocol
│
├── wrfc/                   # WRFC domain logic
│   ├── machine.ts          # WRFC state machine (built on L1 state-machine.ts)
│   │                       # - States: idle → working → reviewing → fixing → checking → complete
│   │                       # - WRFC-specific guards (score thresholds, max attempts)
│   ├── orchestrator.ts     # Drives the WRFC machine
│   │                       # - Dispatches work via L1 registry.get<IAgentSpawner>()
│   │                       # - Dispatches review via L1 registry.get<IReviewer>()
│   │                       # - Dispatches fix via L1 registry.get<IFixer>()
│   │                       # - Manages attempt counting and escalation
│   │                       # - Emits events for each state transition
│   └── handlers.ts         # WRFC event handlers (directive creation, notifications)
│
├── sessions/               # Session management
│   ├── manager.ts          # Session lifecycle (create/load/fork/list/destroy)
│   │                       # - Built on L1 state-machine for session states
│   │                       # - Session context (cwd, config, history)
│   │                       # - Session persistence
│   └── modes.ts            # Session mode/config definitions
│                           # - justvibes, vibecoding, sandbox, etc.
│                           # - Maps to ACP configOptions
│
├── agents/                 # Agent lifecycle management
│   ├── tracker.ts          # Agent instance tracking
│   │                       # - Register/unregister agents
│   │                       # - Status: spawned → running → completed/failed
│   │                       # - Metadata (type, task, duration)
│   │                       # - Active agent count and limits
│   └── coordinator.ts      # Agent scheduling and orchestration
│                           # - Max parallel agents
│                           # - Queue overflow agents
│                           # - Context injection
│
├── directives/             # Directive system
│   └── queue.ts            # Directive queue (built on L1 generic queue)
│                           # - Target-based filtering (subagent_stop, etc.)
│                           # - Drain semantics
│
├── memory/                 # Cross-session memory
│   ├── manager.ts          # Memory CRUD (decisions, patterns, failures, preferences)
│   │                       # - JSON schema-based storage
│   │                       # - Query by keywords, date, category
│   └── index.ts            # Search index for fast memory queries
│
├── logs/                   # Structured logging
│   └── manager.ts          # Append-only markdown logs
│                           # - decisions.md, errors.md, activity.md
│                           # - Log rotation
│                           # - Severity levels
│
├── hooks/                  # Hook system
│   ├── engine.ts           # Pre/post hook execution around operations
│   ├── registry.ts         # Register hooks by event type
│   └── built-ins.ts        # Built-in hooks (logging, metrics)
│
├── services/               # External service connections
│   ├── registry.ts         # Named service registry (API keys, endpoints)
│   ├── auth.ts             # Authentication orchestration
│   └── health.ts           # Service health checking
│
├── external/               # External event sources
│   ├── http-listener.ts    # Webhook receiver
│   ├── file-watcher.ts     # File system change detection
│   └── normalizer.ts       # Event normalization from external sources
│
└── lifecycle/              # Process lifecycle
    ├── daemon.ts           # Daemon mode (detached, socket IPC, health)
    ├── shutdown.ts         # Graceful shutdown (L3 → L2 → L1 teardown order)
    └── health.ts           # Health check endpoint
```

---

## Layer 3 — Plugins

**Purpose**: Specialized functionality. Actual tools, reviewers, analyzers. The things that do real work.

**Imports**: L0, L1, and L2.

**Design principle**: Self-contained capabilities. Each plugin registers itself into the L1 registry at startup. Plugins are independent — analytics doesn't import precision, review doesn't import project.

### Modules

```
src/plugins/
├── precision/              # Precision engine tools
│   ├── index.ts            # Plugin registration (registers IToolProvider)
│   ├── read.ts             # File reading with extract modes
│   ├── write.ts            # File writing with modes
│   ├── edit.ts             # Find/replace editing
│   ├── grep.ts             # Content search
│   ├── glob.ts             # File pattern matching
│   ├── exec.ts             # Command execution
│   ├── fetch.ts            # HTTP fetching with extraction
│   ├── symbols.ts          # Symbol search
│   ├── discover.ts         # Multi-query discovery
│   └── notebook.ts         # Jupyter notebook operations
│
├── analytics/              # Analytics engine
│   ├── index.ts            # Plugin registration
│   ├── budget.ts           # Token budget tracking
│   ├── dashboard.ts        # Analytics dashboard
│   ├── export.ts           # Data export
│   └── sync.ts             # Session sync
│
├── project/                # Project analysis tools
│   ├── index.ts            # Plugin registration
│   ├── deps.ts             # Dependency analysis
│   ├── security.ts         # Security scanning
│   ├── test.ts             # Test discovery/coverage
│   └── db.ts               # Database tools
│
├── frontend/               # Frontend analysis tools
│   ├── index.ts            # Plugin registration
│   ├── components.ts       # Component tree analysis
│   ├── accessibility.ts    # A11y checking
│   └── layout.ts           # Layout analysis
│
├── review/                 # Code review implementations
│   ├── index.ts            # Registers IReviewer + IFixer
│   ├── reviewer.ts         # 10-dimension scoring reviewer
│   ├── fixer.ts            # Fix implementation
│   └── scoring.ts          # Scoring rubric
│
├── agents/                 # Agent type definitions
│   ├── index.ts            # Registers IAgentSpawner
│   ├── spawner.ts          # Agent spawning implementation
│   ├── engineer.ts         # Engineer agent config/prompt
│   ├── reviewer.ts         # Reviewer agent config/prompt
│   ├── tester.ts           # Tester agent config/prompt
│   ├── architect.ts        # Architect agent config/prompt
│   ├── integrator.ts       # Integrator agent config/prompt
│   └── deployer.ts         # Deployer agent config/prompt
│
└── skills/                 # Skill definitions
    ├── index.ts            # Skill registration
    └── ...                 # Individual skills
```

---

## Bootstrap (Composition Root)

```
src/
├── main.ts                 # Entry point
│   │
│   │  1. Load config (L1)
│   │  2. Initialize L1 core primitives
│   │  3. Initialize L2 extensions, wire to L1
│   │  4. Initialize L3 plugins, register into L1 registry
│   │  5. Wire config.onChange → eventBus.emit (avoids circular init)
│   │  6. Determine process mode (ACP agent / daemon / MCP bridge)
│   │  7. Start appropriate transports
│   │  8. Register shutdown handlers (L3 → L2 → L1 teardown order)
│   │  9. Emit 'runtime:started' event
│   │
│   └── The ONLY file that imports from all layers.
│       Every other file respects strict layer boundaries.
```

---

## Process Model

The runtime supports two modes, selectable at startup:

### ACP Agent Mode (primary)
- Spawned by an ACP client (Zed, VS Code) as a subprocess
- Communicates via stdio (ndjson)
- One process per client connection
- Client manages the process lifecycle

### Daemon Mode (backward compat / advanced)
- Long-running background process
- Communicates via Unix socket or TCP
- Survives editor restarts
- Multiple clients connect simultaneously
- Tick driver for heartbeats, scheduled tasks, webhook delivery
- MCP bridge connects Claude Code to the daemon

Both modes use the same L0/L1/L2/L3 stack. The only difference is which L2 transport is activated.

---

## Dual-Path File System

Two paths for file access, selected by transport:

| Path | When | How | Sees unsaved buffers? |
|------|------|-----|----------------------|
| **ACP client fs** | Connected via ACP | `fs/read_text_file`, `fs/write_text_file` through client | Yes |
| **Direct fs** | Always available | Node/Bun `fs` module directly | No |

L0 defines `IFileSystem`. L2 provides two implementations:
- `AcpFileSystem` — proxies through ACP client methods
- `DirectFileSystem` — direct disk access

L3 plugins call `registry.get<IFileSystem>()` and don't care which one they get. The bootstrap wires the appropriate implementation based on the active transport. For ACP connections, the ACP implementation is preferred (editor-aware). For daemon/MCP bridge mode, direct fs is used.

Same pattern applies to terminal access (`ITerminal`):
- `AcpTerminal` — creates terminals visible in the editor
- `DirectTerminal` — headless process spawning

Rule of thumb: user-visible operations (build, test, deploy) use ACP terminal. Internal operations (typecheck verification, lint checks) use direct terminal.

---

## WRFC ↔ ACP Mapping

WRFC phases map to ACP `session/update` notifications with `tool_call` lifecycle:

```
WRFC Phase    → ACP tool_call status    → _meta payload
─────────────────────────────────────────────────────────
start_work    → tool_call (pending)     → { phase: "work", attempt: 1 }
working       → tool_call (running)     → { agent_type: "engineer" }
work_complete → tool_call (completed)   → { files_modified: [...] }
start_review  → tool_call (pending)     → { phase: "review" }
reviewing     → tool_call (running)     → { reviewer: "code-review" }
review_done   → tool_call (completed)   → { score: 8.5, dimensions: {...} }
start_fix     → tool_call (pending)     → { phase: "fix", attempt: 2 }
fixing        → tool_call (running)     → { issues: [...] }
fix_complete  → tool_call (completed)   → { resolved: [...] }
complete      → stopReason: end_turn    → { final_score: 9.9 }
escalate      → stopReason: end_turn    → { escalation_reason: "..." }
```

Each WRFC chain is a single ACP prompt turn. The ACP client sees a stream of tool_call updates with rich `_meta` payloads carrying review scores, attempt counts, and phase information.

---

## Error Handling

### Error Boundaries

Each layer boundary is an error boundary:

- **L3 → L2**: Plugin errors are caught by L2 orchestration. A failing plugin doesn't crash the runtime. L2 logs the error, marks the operation as failed, and continues.
- **L2 → L1**: Extension errors are caught by L1 event handlers. A failing protocol adapter doesn't corrupt core state.
- **L1**: Core errors are fatal. If the event bus or state store fails, the process exits.

### Error Propagation

```
L3 plugin throws → L2 catches → emits error event via L1 event-bus
                              → sends ACP session/update with error
                              → logs to L2 error log
                              → WRFC machine transitions to appropriate state
```

### ACP Error Mapping

Errors cross the ACP wire as JSON-RPC error responses:
- Plugin errors → application error (code -32000)
- Validation errors → invalid params (code -32602)
- Internal errors → internal error (code -32603)
- Tool failures → tool_call with status: "failed" + error in _meta

---

## Concurrency Model

- **Single-threaded event loop** (Bun/Node). No worker threads by default.
- **Concurrent sessions** are isolated via L1 state-store namespaces.
- **Concurrent agents** within a session are managed by L2 agent coordinator (max parallel limits, queuing).
- **I/O concurrency** via async/await — L1 event bus, L2 protocol adapters, L3 tool execution are all async.
- **Future**: Worker threads can be added for CPU-intensive L3 plugins (AST analysis, large file parsing) without changing the layer model.

---

## Graceful Shutdown

Shutdown tears down in reverse layer order:

```
1. Stop accepting new connections/prompts
2. Cancel in-progress WRFC chains (with timeout)
3. L3: Deregister plugins, flush plugin state
4. L2: Close ACP connections, close MCP bridge, flush memory/logs,
       stop daemon tick driver, close IPC sockets
5. L1: Flush state-store to disk, drain event bus, stop scheduler
6. Exit
```

Bootstrap registers shutdown handlers at startup. Each layer provides a `shutdown()` method that cleans up its resources.

---

## Dependency Flow Examples

### Example 1: User sends a prompt via ACP

```
[ACP Client] → session/prompt
    ↓
L2: acp/agent.ts receives JSON-RPC call
    ↓
L2: sessions/manager.ts validates session
    ↓
L1: event-bus.emit('session:prompt', { sessionId, prompt })
    ↓
L2: wrfc/orchestrator.ts handles event
    ↓
L2: wrfc/machine.ts transitions to 'working' (built on L1 state-machine)
    ↓
L2: agents/coordinator.ts schedules agent spawn
    ↓
L1: registry.get<IAgentSpawner>() → L3 agents/spawner.ts
    ↓
L3: agents/spawner.ts spawns agent, returns handle
    ↓
L2: agents/tracker.ts registers agent
    ↓
L1: event-bus.emit('agent:completed')
    ↓
L2: wrfc/machine.ts transitions to 'reviewing'
    ↓
L1: registry.get<IReviewer>() → L3 review/reviewer.ts
    ↓
L3: review/reviewer.ts scores the work
    ↓
L2: acp/agent.ts sends session/update notifications throughout
```

### Example 2: Claude Code calls an MCP tool

```
[Claude Code] → MCP tool call: precision_read
    ↓
L2: mcp/bridge.ts receives MCP request
    ↓
L2: mcp/tool-proxy.ts looks up tool in L1 registry
    ↓
L1: registry.get<IToolProvider>('precision').execute('read', params)
    ↓
L3: precision/read.ts handles the read operation
    ↓
L2: mcp/bridge.ts returns MCP response
```

### Example 3: Plugin registration at startup

```
main.ts:
    import { Registry } from './core/registry'        // L1
    import { PrecisionPlugin } from './plugins/precision' // L3
    import { ReviewPlugin } from './plugins/review'       // L3

    const registry = new Registry()

    // L3 registers its capabilities into L1
    PrecisionPlugin.register(registry)   // registers IToolProvider
    ReviewPlugin.register(registry)       // registers IReviewer, IFixer

    // L2 uses L1 registry to find implementations
    const orchestrator = new WRFCOrchestrator(registry, eventBus)
```

---

## Layer Boundary Rules

### What each layer CAN import:

| | L0 Types | L1 Core | L2 Extensions | L3 Plugins |
|---|---|---|---|---|
| **L0 Types** | — | ❌ | ❌ | ❌ |
| **L1 Core** | ✅ | self | ❌ | ❌ |
| **L2 Extensions** | ✅ | ✅ | self | ❌ |
| **L3 Plugins** | ✅ | ✅ | ✅ | self |
| **main.ts** | ✅ | ✅ | ✅ | ✅ |

### Additional rules:

- Circular imports within a layer are forbidden.
- L3 plugins do not import each other (precision doesn't import analytics).
- L0 contains zero runtime code — only types, interfaces, constants.
- L1 has zero external npm dependencies.

### Import path patterns (for ESLint enforcement):

```typescript
// ALLOWED:
import type { SessionState } from '@l0/session'         // anyone → L0
import { EventBus } from '@l1/event-bus'                 // L2/L3 → L1
import { WRFCOrchestrator } from '@l2/wrfc'              // L3 → L2
import { Registry } from '@l1/registry'                  // L3 → L1 (direct)

// FORBIDDEN:
import { PrecisionRead } from '@l3/precision'            // L2 → L3 ❌
import { AcpAgent } from '@l2/acp'                       // L1 → L2 ❌
import { AnalyticsPlugin } from '@l3/analytics'          // L3 → L3 (cross-plugin) ❌
```

---

## External Dependencies Policy

### L0 — Zero deps (types only, no runtime)

### L1 — Zero external deps
- Bun/Node std lib only (crypto, fs, path, events, etc.)
- If we need a utility (deep merge, etc.), we write it.

### L2 — Minimal, protocol-specific deps
- `@agentclientprotocol/sdk` — ACP protocol implementation
- Transport-specific deps only. Nothing else without explicit justification.

### L3 — As needed, scoped to plugin
- Each plugin can have its own dependencies
- Dependencies are scoped — analytics deps don't affect precision
- Heavy deps (tree-sitter, ast-grep, pdf-parse) live here

---

## Testing Strategy

### L0
- No tests needed (no runtime code)

### L1
- Pure unit tests, no mocks needed (no external deps)
- State machine property tests (all valid transitions, guard conditions)
- Event bus concurrency tests
- Queue ordering and persistence tests

### L2
- Integration tests with L1
- Protocol conformance tests (ACP, MCP)
- Mock L3 implementations via L1 registry
- WRFC orchestration tests (full state machine flows)
- Shutdown ordering tests

### L3
- Plugin-specific unit tests
- Register into test L1 registry, verify behavior
- Integration tests with real L2 orchestration

---

## Directory Structure

```
goodvibes-acp/
├── src/
│   ├── types/              # L0 — pure types, zero runtime
│   ├── core/               # L1 — generic primitives
│   ├── extensions/         # L2 — domain logic, protocols, orchestration
│   ├── plugins/            # L3 — tools, reviewers, analyzers
│   └── main.ts             # Bootstrap (composition root)
├── tests/
│   ├── core/               # L1 unit tests
│   ├── extensions/         # L2 unit + integration tests
│   ├── plugins/            # L3 unit tests
│   └── integration/        # Cross-layer integration tests
├── docs/
│   ├── ARCHITECTURE.md     # This document
│   └── SUBAGENT-DESIGN.md  # (TODO) Subagent spawning design
├── .goodvibes/             # Runtime state, logs, memory
├── package.json
├── tsconfig.json           # Root config
├── tsconfig.l0.json        # L0 project reference
├── tsconfig.l1.json        # L1 project reference
├── tsconfig.l2.json        # L2 project reference
├── tsconfig.l3.json        # L3 project reference
└── bunfig.toml             # Bun configuration
```

---

## Migration Path from Current Plugin

### Phase 1: Core extraction
- Build L0 types from current runtime-engine types
- Port EventBus, StateStore, TriggerEngine to L1 (genericized)
- Build generic state machine and queue in L1
- Test exhaustively — this is the foundation

### Phase 2: Domain logic
- Port WRFC machine to L2 (built on L1 generic state machine)
- Port session manager, agent tracker, memory, logs to L2
- Port directive system to L2 (built on L1 generic queue)
- Wire L2 to L1, test orchestration flows

### Phase 3: ACP agent
- Implement ACP agent using @agentclientprotocol/sdk
- Map sessions, prompts, config to ACP protocol
- Map WRFC to tool_call lifecycle
- Test with Zed

### Phase 4: MCP bridge + Claude Code compat
- Build MCP bridge for backward compatibility
- Port hook-to-directive pipeline to bridge adapter
- Test with Claude Code

### Phase 5: Plugin migration
- Port precision engine to L3
- Port review/scoring to L3
- Port analytics, project, frontend to L3
- Each plugin registers into L1 registry

### Phase 6: Multi-client
- Register in ACP registry
- Test with multiple simultaneous clients
- Documentation and onboarding

---

## Open Questions

1. **Subagent spawning** — ACP has no concept of "spawn a subagent." This is the biggest unsolved problem. Options:
   - Use ACP's MCP integration to manage agent subprocesses
   - Build custom agent spawner with direct Claude API calls
   - Use `_goodvibes/spawn_agent` ACP extension method
   - Needs its own design doc (SUBAGENT-DESIGN.md)

2. **Plugin isolation** — Directories now, promote to separate packages if needed.

3. **Config location** — Global (~/.goodvibes/) for runtime config + per-project for project state.

4. **State persistence format** — Need schema versioning from day 1. Define migration strategy before writing the first state file.
