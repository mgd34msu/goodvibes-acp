# GoodVibes ACP Runtime

A standalone Agent Client Protocol (ACP) runtime for AI-assisted coding workflows.

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Bun](https://img.shields.io/badge/Bun-runtime-orange)
![Tests](https://img.shields.io/badge/Tests-1292%20passing-green)
![ACP](https://img.shields.io/badge/ACP-v1-purple)

---

## Overview

GoodVibes ACP Runtime is a standalone implementation of the [Agent Client Protocol (ACP)](docs/acp-knowledgebase/) that manages AI agent orchestration for coding workflows. It runs as a subprocess or daemon, communicates with ACP clients (such as the Zed editor) over stdio using NDJSON, and exposes a structured agent runtime with quality gates, tool bridging, and multi-provider LLM inference.

### What It Does

- **Agent lifecycle management** — Tracks spawned agents through L0-typed state machines with configurable concurrency limits
- **WRFC quality-gate loop** — Enforces a Work → Review → Fix → Check loop with minimum score thresholds and attempt caps
- **MCP tool bridging** — Spawns and bridges MCP server tools into the agent runtime via a pluggable `IToolProvider` interface
- **LLM provider abstraction** — Wraps the Anthropic Claude SDK with a structured inference layer, extensible to other providers
- **Real-time observability** — Emits structured events over an internal EventBus, surfaced to ACP clients via `_goodvibes/*` extension methods
- **Permission system** — Mode-based auto-approval policies that gate file, terminal, and agent operations

### Architecture

The runtime uses a strict 4-layer dependency model:

```
L0 (Types)        Pure types, interfaces, constants — zero runtime code
L1 (Core)         Generic primitives: EventBus, Registry, StateStore, Config, HookEngine
L2 (Extensions)   Domain logic: ACP agent, WRFC orchestrator, MCP bridge, agent coordinator
L3 (Plugins)      Pluggable implementations: precision, analytics, project, frontend, skills, review, agents
```

Dependencies point inward only. L3 imports L2/L1/L0. L2 imports L1/L0. L1 imports L0. Nothing imports upward. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

### ACP Compatibility

- ACP Protocol v1 (`@agentclientprotocol/sdk` v0.15.0)
- Compatible with ACP clients: Zed editor, and any client implementing the ACP protocol

---

## Features

- **ACP Protocol v1 compliance** — ~90-95% coverage of the ACP spec (see [ACP Compliance Report](docs/ACP-COMPLIANCE-REPORT.md))
- **WRFC quality-gate loop** — Work → Review → Fix → Check with configurable score thresholds and attempt limits
- **LLM provider abstraction** — Anthropic Claude integration via `@anthropic-ai/sdk`, designed for extension to OpenAI and others
- **MCP server integration** — Spawn and bridge MCP tool servers; tools are exposed to the agent via the `IToolProvider` interface
- **7 L3 plugins** — precision engine, analytics, project analysis, frontend inspection, skills registry, code review, and agent spawning
- **Permission system** — Mode-based auto-approval policies (justvibes, vibecoding, plan, sandbox)
- **Real-time observability** — `_goodvibes/*` ACP extension methods expose runtime state, agent tracking, and event streaming
- **1292+ tests with 0 failures** — Full test suite across core, extensions, plugins, and integration layers
- **ESLint import boundary enforcement** — Automated layer boundary checks prevent architectural violations

---

## Quick Start

**Prerequisites**: [Bun](https://bun.sh) runtime

```bash
# Install dependencies
bun install

# Run the full test suite
bun test

# Type check
bunx tsc --noEmit

# Start the runtime (subprocess mode — receives ACP messages over stdio)
bun run src/main.ts

# Start in daemon mode
bun run src/main.ts --daemon

# Run with watch (development)
bun run dev
```

**Required environment variable:**

```bash
export ANTHROPIC_API_KEY=your_key_here
```

---

## Architecture

The runtime is organized into four strict layers:

```
L0 — Types (src/types/)
     Pure TypeScript interfaces, enums, and constants.
     Imported by all layers. Has zero runtime code.
     Key modules: events, session, agent, wrfc, directive, registry, errors, config

L1 — Core (src/core/)
     Generic, domain-agnostic primitives.
     EventBus, Registry, StateStore, Config, HookEngine, and supporting utilities.

L2 — Extensions (src/extensions/)
     Domain logic wired to the ACP protocol and WRFC state machine.
     GoodVibesAgent (ACP handler), WRFCOrchestrator, McpBridge, AgentCoordinator,
     SessionManager, PermissionGate, MemoryManager, LogsManager, and more.

L3 — Plugins (src/plugins/)
     Concrete implementations registered into the L1 Registry.
     Each plugin exposes tools via the IToolProvider interface.
```

The bootstrap (`src/main.ts`) is the composition root — the only module that imports all four layers and wires them together at startup.

For the full architecture plan including layer contracts, enforcement strategy, and open questions, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Project Structure

```
goodvibes-acp/
├── src/
│   ├── types/          # L0 — Pure types, interfaces, constants
│   ├── core/           # L1 — Generic primitives (EventBus, Registry, StateStore, etc.)
│   ├── extensions/     # L2 — Domain logic (ACP agent, WRFC, MCP bridge, session, etc.)
│   │   └── acp/        # ACP protocol handler, permission gate, FS/terminal bridges
│   └── plugins/        # L3 — Pluggable implementations
│       ├── precision/  # Precision engine (file ops, search, exec, fetch)
│       ├── analytics/  # Usage analytics and budgeting
│       ├── project/    # Project analysis (deps, DB, API, security, tests)
│       ├── frontend/   # Frontend inspection (component tree, layout, accessibility)
│       ├── skills/     # Skills registry and content delivery
│       ├── review/     # Code review and scoring
│       └── agents/     # Agent spawning and lifecycle
├── tests/              # Test suite (core/, extensions/, plugins/, integration/)
├── docs/               # Architecture docs and ACP knowledgebase
│   └── acp-knowledgebase/  # ACP protocol reference (01-overview through 10-implementation-guide)
├── package.json
└── tsconfig.json
```

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | API key for Anthropic Claude LLM inference |
| `GOODVIBES_MODE` | No | Set to `daemon` to start in daemon mode |

### Runtime Modes

Modes control the permission auto-approval policy applied to agent operations:

| Mode | Description |
|---|---|
| `justvibes` | Default. Read-only operations auto-approved; write/exec require confirmation |
| `vibecoding` | Broad auto-approval — most operations proceed without confirmation |
| `plan` | Read-only auto-approval only; all write/exec ops require confirmation |
| `sandbox` | All operations auto-approved; for isolated/trusted environments |

The active mode is set via the ACP `setSessionConfigOption` call with `category: 'mode'`.

### Config Options

The runtime exposes configuration options to ACP clients via `newSession()` and `setSessionConfigOption()`:

- **Mode selector** — `justvibes` | `vibecoding` | `plan` | `sandbox`
- **Model selector** — LLM model to use for inference (e.g., Claude Sonnet, Claude Opus)

---

## ACP Extension Methods

The runtime implements ACP's extensibility mechanism (`extMethod` / `extNotification`) using the `_goodvibes/*` namespace:

| Method | Type | Description |
|---|---|---|
| `_goodvibes/state` | `extMethod` | Returns current session context or runtime-level state (sessions, agents, config) |
| `_goodvibes/agents` | `extMethod` | Queries the agent registry — lists active agents, statuses, and results |
| `_goodvibes/directive` | `extNotification` | Receives a directive from the client and emits it onto the internal EventBus |

Unknown `extMethod` calls return a `METHOD_NOT_FOUND` ACP error. Unknown `extNotification` calls are silently ignored per ACP convention.

---

## Documentation

| Document | Description |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full architecture plan — layers, contracts, enforcement, open questions |
| [docs/SUBAGENT-DESIGN.md](docs/SUBAGENT-DESIGN.md) | Subagent spawning design — LLM provider integration and WRFC agent loop architecture |
| [docs/ACP-COMPLIANCE-REPORT.md](docs/ACP-COMPLIANCE-REPORT.md) | ACP protocol compliance status — what is implemented, what is missing, and why |
| [docs/acp-knowledgebase/](docs/acp-knowledgebase/) | ACP protocol reference documentation (01-overview through 10-implementation-guide) |

---

## Development

**Prerequisites**: [Bun](https://bun.sh) — the runtime, bundler, and test runner.

```bash
# Install dependencies
bun install

# Run all tests
bun test

# Run tests by layer
bun run test:core
bun run test:extensions
bun run test:plugins
bun run test:integration

# Type check
bunx tsc --noEmit
# or:
bun run typecheck

# Lint (ESLint with TypeScript and import boundary rules)
bunx eslint src/
# or:
bun run lint

# Run everything (typecheck + lint + tests)
bun run check
```

### TypeScript Path Aliases

The project uses layer-scoped import aliases defined in `tsconfig.json`:

| Alias | Layer | Path |
|---|---|---|
| `@l0/*` | Types | `src/types/*` |
| `@l1/*` | Core | `src/core/*` |
| `@l2/*` | Extensions | `src/extensions/*` |
| `@l3/*` | Plugins | `src/plugins/*` |

Importing across layer aliases in the wrong direction is caught by ESLint import boundary rules.

---

## License

MIT
