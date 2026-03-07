# ACP (Agent Client Protocol) Research

**Date**: 2026-03-07
**Version researched**: Protocol v1, TypeScript SDK v0.15.0
**Sources**: agentclientprotocol.com, GitHub repos (agent-client-protocol, typescript-sdk, registry)

## What is ACP?

ACP standardizes communication between **code editors** (Clients) and **AI coding agents** (Agents). Created by Zed, now adopted by 30+ agents and 20+ clients. Think LSP but for AI agents.

- **Transport**: JSON-RPC 2.0 over stdio (newline-delimited JSON) or HTTP/WebSocket
- **Architecture**: Client spawns Agent as subprocess, communicates via stdin/stdout
- **SDKs**: TypeScript, Python, Rust, Kotlin
- **npm**: `@agentclientprotocol/sdk`

## Protocol Lifecycle

```
Client → Agent: initialize (version/capability negotiation)
Client → Agent: authenticate (if required)
Client → Agent: session/new or session/load
Client → Agent: session/prompt (user message)
Agent → Client: session/update (streaming progress, tool calls, plans)
Agent → Client: session/request_permission (when needed)
Client → Agent: session/cancel (interrupt)
Agent → Client: session/prompt response (stopReason: end_turn|cancelled)
```

## Agent Interface (what agents implement)

### Baseline Methods
- `initialize` — negotiate protocol version, exchange capabilities
- `authenticate` — handle auth if required
- `session/new` — create a new session (receives cwd, mcpServers)
- `session/prompt` — process user prompt, return stop reason

### Optional Methods
- `session/load` — resume existing session (requires loadSession capability)
- `session/set_mode` — switch operating modes (being replaced by configOptions)
- `session/set_config_option` — set config values
- `session/fork` — fork a session (unstable)
- `session/list` — list sessions (unstable)
- `session/resume` — resume session (unstable)

### Notifications (Agent → Client)
- `session/update` — streaming updates with various types:
  - `agent_message_chunk` — text/image/audio content
  - `tool_call` — tool invocation with status (pending/running/completed/failed)
  - `tool_call_update` — update existing tool call status
  - `plan` — structured plan with entries
  - `agent_thought_chunk` — reasoning/thinking content
  - `session_info` — session metadata updates
  - `available_commands` — available slash commands
  - `current_mode` — mode change notification
  - `config_option` — config value change notification

## Client Interface (what clients implement)

### Baseline Methods
- `session/request_permission` — present permission request to user

### Optional Methods (capability-gated)
- `fs/read_text_file` — read file (includes unsaved editor state)
- `fs/write_text_file` — write file
- `terminal/create` — create terminal session
- `terminal/output` — get terminal output
- `terminal/release` — release terminal
- `terminal/wait_for_exit` — wait for command completion
- `terminal/kill` — kill terminal process

### Notifications (Client receives)
- `session/update` — all the streaming updates listed above

## Capabilities System

### Agent Capabilities
```json
{
  "loadSession": true,
  "promptCapabilities": { "image": true, "audio": true, "embeddedContext": true },
  "mcpCapabilities": { "http": true, "sse": true },
  "sessionCapabilities": { "fork": true, "list": true, "resume": true }
}
```

### Client Capabilities
```json
{
  "fs": { "readTextFile": true, "writeTextFile": true },
  "terminal": true
}
```

## Session Config Options (replaces modes)

Flexible key-value config with UI hints:
```json
{
  "configOptions": [
    { "id": "mode", "name": "Session Mode", "category": "mode", "type": "select",
      "currentValue": "ask", "options": [{"value": "ask"}, {"value": "code"}] },
    { "id": "model", "name": "Model", "category": "model", "type": "select",
      "currentValue": "model-1", "options": [...] }
  ]
}
```

Categories: `mode`, `model`, or custom. Clients render appropriate UI per category.

## MCP Integration

ACP sessions can specify MCP servers to connect to:
```json
{
  "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      { "name": "filesystem", "command": "/path/to/mcp-server", "args": ["--stdio"] }
    ]
  }
}
```

Agents advertise MCP capabilities (http, sse) during initialization.

## Extensibility

- `_meta` field on ALL types — attach custom data (traces, debug info)
- `_`-prefixed method names — custom methods that won't conflict with spec
- Extension methods follow standard JSON-RPC request/notification semantics
- Reserved `_meta` keys: `traceparent`, `tracestate`, `baggage` (W3C trace context)

## Registry

- CDN: `https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json`
- 15+ agents: Amp, Auggie, Claude Code, Codex, Gemini CLI, Goose, etc.
- Distribution: npx, binary, pip
- Auth required for registration (agents must return valid authMethods)
- Hourly version auto-update via cron

## TypeScript SDK Key Classes

### AgentSideConnection (for building agents)
```typescript
const conn = new AgentSideConnection(
  (conn) => new MyAgent(conn),  // factory
  ndJsonStream(process.stdout, process.stdin)  // stdio transport
);
```
Methods: sessionUpdate(), requestPermission(), readTextFile(), writeTextFile(), createTerminal(), extMethod(), extNotification()

### ClientSideConnection (for building clients)
```typescript
const conn = new ClientSideConnection(
  (agent) => new MyClient(),  // factory
  ndJsonStream(writable, readable)  // transport
);
```
Methods: initialize(), newSession(), loadSession(), prompt(), cancel(), setSessionMode(), setSessionConfigOption(), authenticate()

### Stream / ndJsonStream
```typescript
type Stream = { writable: WritableStream<AnyMessage>; readable: ReadableStream<AnyMessage> };
function ndJsonStream(output: WritableStream<Uint8Array>, input: ReadableStream<Uint8Array>): Stream;
```

## Key Differences: ACP vs MCP

| Aspect | MCP | ACP |
|--------|-----|-----|
| Level | Tool/resource protocol | Agent communication protocol |
| Direction | Server exposes tools → Client calls them | Bidirectional: Client sends prompts, Agent sends updates |
| Sessions | No native session concept | First-class sessions with persistence |
| Streaming | Limited | Rich streaming (message chunks, tool calls, plans) |
| Permissions | Not built-in | Native permission request/grant flow |
| File System | Via tools | Native fs/read and fs/write methods |
| Terminal | Via tools | Native terminal create/output/kill methods |
| Modes | N/A | Session modes and config options |
| Relationship | Complementary — ACP agents can use MCP servers | ACP is higher-level, MCP is embedded |

They are **complementary**, not competing. ACP agents consume MCP servers as tools.
