# ACP Architecture Analysis for GoodVibes

**Date**: 2026-03-07
**Context**: User wants to split the runtime engine into a standalone program, use MCP bridge for Claude Code, and use ACP for client-agnostic access.

## Current Architecture

```
Claude Code → MCP Plugin → [precision-engine, runtime-engine, project-engine, ...]
                          → hooks (SubagentStart, SubagentStop, UserPromptSubmit)
                          → runtime daemon (tmux)
```

Everything runs inside the Claude Code plugin ecosystem. The runtime engine is embedded as an MCP server within the plugin.

## Proposed Architecture

```
┌─────────────────────────────────────────────────────┐
│                  GoodVibes Runtime                  │
│              (standalone Node.js process)           │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ WRFC     │  │ Triggers │  │ State/Memory/Logs │  │
│  │ Pipeline │  │ & Events │  │                   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Directive│  │ Agent    │  │ Service Registry  │  │
│  │ Queue    │  │ Tracker  │  │                   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │            Communication Layer              │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │    │
│  │  │ ACP     │  │ MCP     │  │ IPC/Socket  │  │    │
│  │  │ Server  │  │ Bridge  │  │ (internal)  │  │    │
│  │  └─────────┘  └─────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌───────────┐    ┌───────────┐
   │ Zed     │    │ Claude    │    │ VS Code   │
   │ (ACP)   │    │ Code      │    │ (ACP)     │
   └─────────┘    │ (MCP      │    └───────────┘
                  │  Bridge)  │
                  └───────────┘
```

## Mapping: GoodVibes → ACP

### Direct Mappings

| GoodVibes Concept | ACP Concept | Notes |
|-------------------|-------------|-------|
| Runtime session | ACP Session | 1:1 mapping, session/new creates runtime context |
| justvibes/sandbox modes | Session Config Options | category: "mode", type: "select" |
| User prompt → orchestrator | session/prompt | Client sends prompt, runtime processes |
| WRFC updates | session/update (tool_call) | Tool call status: pending → running → completed |
| Directive notifications | session/update | Custom update types via extensibility |
| Agent spawning | session/update (tool_call) | Each subagent maps to a tool call |
| Permission requests | session/request_permission | Native ACP permission flow |
| Precision tools (fs ops) | fs/read_text_file, fs/write_text_file | Client-provided file access |
| precision_exec | terminal/create + terminal/output | Client-provided terminal |
| Service registry | MCP server config in session/new | Pass MCP servers to agent |
| Session modes | configOptions with category: "mode" | ask/code/architect pattern |
| Model selection | configOptions with category: "model" | Model picker |
| Analytics/budget | Custom configOptions or _meta | Extensibility mechanism |

### Extension Points Needed

| Feature | ACP Mechanism |
|---------|---------------|
| WRFC pipeline details | `_meta` on tool_call updates |
| Review scores | `_meta` on session/update |
| Directive system | Custom `_goodvibes/directive` notification |
| Agent tracker | Custom `_goodvibes/agents` method |
| Analytics | Custom `_goodvibes/analytics` method |
| Memory/logs | Custom `_goodvibes/memory` method |

## Implementation Plan

### Phase 1: Standalone Runtime
1. Extract runtime engine from MCP plugin into standalone Node.js process
2. Communication via Unix socket or TCP (IPC)
3. Runtime manages: state, triggers, events, WRFC, directives, memory, logs
4. The existing MCP tools become thin proxies to the runtime

### Phase 2: ACP Agent Interface
1. Implement `Agent` interface from `@agentclientprotocol/sdk`
2. Map runtime sessions → ACP sessions
3. Map WRFC pipeline → ACP tool_call lifecycle
4. Map directives → ACP session/update notifications
5. Expose modes/config as ACP configOptions
6. Use ACP extensibility (_meta, custom methods) for GoodVibes-specific features

### Phase 3: MCP Bridge
1. Thin MCP server that translates MCP tool calls → runtime IPC calls
2. Maintains compatibility with Claude Code's MCP plugin system
3. Hooks system continues to work through the bridge
4. Gradually reduce bridge responsibilities as Claude Code potentially gains ACP support

### Phase 4: Multi-Client Support
1. Register in ACP registry
2. Any ACP client (Zed, VS Code, JetBrains) can connect
3. Client-specific adaptations via capability negotiation
4. Same runtime serves multiple simultaneous clients

## Key Benefits

1. **Client-agnostic**: Not locked to Claude Code's MCP plugin system
2. **Process isolation**: Runtime crash doesn't crash the editor
3. **Persistent state**: Runtime survives editor restarts
4. **Multi-client**: Same runtime instance serves Zed, VS Code, Claude Code simultaneously
5. **Standard protocol**: Leverage existing ACP ecosystem (30+ agents, 20+ clients)
6. **MCP compatibility**: ACP has native MCP integration, so precision tools can still use MCP servers
7. **Auth support**: ACP auth methods enable remote/shared runtime scenarios
8. **Registry discovery**: Users can find and install GoodVibes through ACP registry

## Key Risks

1. **ACP maturity**: v0.15.0, still has unstable_ methods, spec evolving
2. **Hook system**: Current hooks depend on Claude Code's hook events. Standalone runtime needs its own hook mechanism
3. **Subagent spawning**: Currently relies on Claude Code's Task/Agent system. Standalone runtime needs its own agent orchestration
4. **Complexity**: Three communication layers (ACP, MCP Bridge, IPC) instead of one (MCP)
5. **Claude Code coupling**: Many features (precision tools, hooks, subagents) are deeply integrated with Claude Code internals

## Recommendations

1. **Start with Phase 1** — extract runtime into standalone process. This is valuable regardless of ACP.
2. **Use ACP's extensibility** heavily — `_meta` fields and `_`-prefixed methods for GoodVibes-specific features.
3. **Keep MCP bridge thin** — it should be a translation layer, not a feature layer.
4. **Design for gradual migration** — don't break existing Claude Code integration while building ACP support.
5. **Consider the subagent problem** — ACP doesn't have a concept of "spawn a subagent". This is the biggest gap. The runtime would need its own agent orchestration (which it already partially has via daemon mode).
6. **File system consideration** — ACP's fs methods go through the Client, meaning the editor provides file access. This is different from precision tools which access the filesystem directly. For a standalone runtime, direct filesystem access is still needed; ACP fs methods add editor integration on top.
