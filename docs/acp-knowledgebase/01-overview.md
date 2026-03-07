# ACP Protocol Overview

**Protocol Version**: 1 (MAJOR, integer only)  
**TypeScript SDK**: `@agentclientprotocol/sdk` v0.15.0  
**Transport**: JSON-RPC 2.0 over newline-delimited JSON (ndjson) on stdio (local), or HTTP/WebSocket (remote)

---

## What is ACP?

The Agent Client Protocol (ACP) standardizes communication between **code editors/IDEs** (Clients) and **AI coding agents** (Agents). Conceptually parallel to LSP (Language Server Protocol), but for AI agent interactions rather than language features.

- Created by Zed, now adopted by 30+ agents and 20+ clients
- Agents implement ACP → work with any compatible editor
- Editors support ACP → gain access to the entire agent ecosystem

## ACP vs MCP

| Aspect | MCP | ACP |
|--------|-----|-----|
| **Level** | Tool/resource protocol | Agent communication protocol |
| **Direction** | Server exposes tools → Client calls them | Bidirectional: Client sends prompts, Agent streams updates |
| **Sessions** | No native session concept | First-class sessions with persistence + load |
| **Streaming** | Limited | Rich: message chunks, tool calls, plans, thoughts |
| **Permissions** | Not built-in | Native `session/request_permission` flow |
| **File System** | Via tools | Native `fs/read_text_file`, `fs/write_text_file` methods |
| **Terminal** | Via tools | Native `terminal/create`, `terminal/output`, `terminal/kill` |
| **Modes** | N/A | Session modes and configOptions |
| **Relationship** | Complementary | ACP agents *consume* MCP servers as tools |

They are complementary. ACP is higher-level; MCP is embedded within it.

---

## Transport Layer

### Local: ndjson over stdio

Each message is a single JSON object terminated by `\n`. The agent runs as a **subprocess** of the editor. The client writes to the agent's stdin; the agent writes to its stdout.

```
Client stdin  →  Agent reads
Agent stdout  →  Client reads
```

Stream type signature (TypeScript SDK):
```typescript
type AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;
type Stream = {
  writable: WritableStream<AnyMessage>;
  readable: ReadableStream<AnyMessage>;
};

// Create a stdio transport:
function ndJsonStream(
  output: WritableStream<Uint8Array>,  // e.g. process.stdout
  input: ReadableStream<Uint8Array>    // e.g. process.stdin
): Stream;
```

### Remote: HTTP or WebSocket

For cloud-hosted agents. Same JSON-RPC message structure, different transport framing.

---

## JSON-RPC 2.0 Message Types

ACP uses JSON-RPC 2.0 with two message patterns:

### Method (Request → Response)

Used for operations that require a result or error.

**Request** (Client → Agent or Agent → Client):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": { ... }
}
```

**Success Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": { ... }
}
```

**Error Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": { ... }
  }
}
```

### Notification (one-way, no response expected)

```json
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": { ... }
}
```

Note: No `id` field on notifications.

---

## Protocol Lifecycle

Complete flow from connection to end of turn:

```
┌─────────────────────────────────────────────────────────────┐
│                    CONNECTION LIFECYCLE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PHASE 1: INITIALIZATION                                    │
│  Client → Agent: initialize (protocolVersion, capabilities) │
│  Agent → Client: initialize response (chosen version, caps) │
│                                                             │
│  PHASE 2: AUTHENTICATION (optional)                         │
│  Client → Agent: authenticate (credentials)                 │
│  Agent → Client: authenticate response                      │
│                                                             │
│  PHASE 3: SESSION SETUP                                     │
│  Client → Agent: session/new (cwd, mcpServers)              │
│    OR                                                       │
│  Client → Agent: session/load (sessionId)  [if supported]   │
│  Agent → Client: session/new|load response (sessionId)      │
│                                                             │
│  PHASE 4: PROMPT TURN (repeats)                             │
│  Client → Agent: session/prompt (user message)              │
│  Agent → Client: session/update* (streaming progress)       │
│  Agent → Client: session/request_permission (if needed)     │
│  Client → Agent: session/cancel (if interrupted)            │
│  Agent → Client: session/prompt response (stopReason)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Prompt Turn Wire Example

**Client sends prompt** (request, waits for response):
```json
{"jsonrpc":"2.0","id":3,"method":"session/prompt","params":{"sessionId":"sess_abc","userMessage":{"content":[{"type":"text","text":"Refactor the auth module"}]}}}
```

**Agent streams progress** (notifications, no id):
```json
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc","update":{"type":"plan","plan":{"entries":[{"id":"1","title":"Analyze auth module","status":"pending"}]}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc","update":{"type":"agent_message_chunk","chunk":{"type":"text","text":"I'll start by reading the auth module..."}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc","update":{"type":"tool_call","toolCall":{"id":"tc_1","name":"read_file","status":"running","input":{"path":"src/auth.ts"}}}}}
{"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"sess_abc","update":{"type":"tool_call_update","toolCallId":"tc_1","status":"completed","output":"...file contents..."}}}
```

**Agent finishes turn** (response to the original request):
```json
{"jsonrpc":"2.0","id":3,"result":{"stopReason":"end_turn"}}
```

**Stop reasons**: `end_turn` | `cancelled`

---

## Agent Interface (what you implement as an agent)

### Baseline Methods (required)

| Method | Direction | Description |
|--------|-----------|-------------|
| `initialize` | Client → Agent | Negotiate protocol version, exchange capabilities |
| `authenticate` | Client → Agent | Handle auth if required |
| `session/new` | Client → Agent | Create new session (receives cwd, mcpServers) |
| `session/prompt` | Client → Agent | Process user prompt, return stopReason |

### Optional Methods (capability-gated)

| Method | Requires Capability | Description |
|--------|---------------------|-------------|
| `session/load` | `loadSession: true` | Resume existing session |
| `session/set_mode` | — | Switch operating modes (deprecated, use configOptions) |
| `session/set_config_option` | — | Set config values |
| `session/fork` | `sessionCapabilities.fork: true` | Fork a session (unstable) |
| `session/list` | `sessionCapabilities.list: true` | List sessions (unstable) |
| `session/resume` | `sessionCapabilities.resume: true` | Resume session (unstable) |

### Notifications the Agent Sends

`session/update` is the streaming notification. The `update.type` field discriminates:

| type | Description |
|------|-------------|
| `agent_message_chunk` | Text/image/audio content chunk |
| `tool_call` | Tool invocation with status (pending/running/completed/failed) |
| `tool_call_update` | Update an existing tool call's status/output |
| `plan` | Structured plan with named entries |
| `agent_thought_chunk` | Reasoning/thinking content |
| `session_info` | Session metadata updates |
| `available_commands` | Available slash commands |
| `current_mode` | Mode change notification |
| `config_option` | Config value change |

---

## Client Interface (what editors implement)

### Baseline Methods (required)

| Method | Direction | Description |
|--------|-----------|-------------|
| `session/request_permission` | Agent → Client | Present permission request to user, return grant/deny |

### Optional Methods (capability-gated)

| Method | Requires Capability | Description |
|--------|---------------------|-------------|
| `fs/read_text_file` | `fs.readTextFile: true` | Read file (includes unsaved editor state) |
| `fs/write_text_file` | `fs.writeTextFile: true` | Write file |
| `terminal/create` | `terminal: true` | Create terminal session |
| `terminal/output` | `terminal: true` | Get terminal output |
| `terminal/release` | `terminal: true` | Release terminal |
| `terminal/wait_for_exit` | `terminal: true` | Wait for command completion |
| `terminal/kill` | `terminal: true` | Kill terminal process |

### Client Notification

`session/cancel` — Client → Agent notification (no response expected). Interrupts current processing.

```json
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": { "sessionId": "sess_abc" }
}
```

---

## Capabilities System

Capabilities are exchanged during `initialize` and gate which methods each side can call.

### Agent Capabilities (declared in initialize response)

```typescript
interface AgentCapabilities {
  loadSession?: boolean;               // can resume sessions
  promptCapabilities?: {
    image?: boolean;                   // accepts image content in prompts
    audio?: boolean;                   // accepts audio content in prompts
    embeddedContext?: boolean;         // accepts embedded context items
  };
  mcp?: {
    http?: boolean;                    // can connect to HTTP MCP servers
    sse?: boolean;                     // can connect to SSE MCP servers
  };
  sessionCapabilities?: {
    fork?: boolean;                    // supports session/fork (unstable)
    list?: boolean;                    // supports session/list (unstable)
    resume?: boolean;                  // supports session/resume (unstable)
  };
}
```

### Client Capabilities (declared in initialize request)

```typescript
interface ClientCapabilities {
  fs?: {
    readTextFile?: boolean;            // client implements fs/read_text_file
    writeTextFile?: boolean;           // client implements fs/write_text_file
  };
  terminal?: boolean;                  // client implements terminal/* methods
}
```

---

## Session Config Options

Flexible key-value configuration (replaces the old `session/set_mode`):

```typescript
interface ConfigOption {
  id: string;
  name: string;
  category: 'mode' | 'model' | string;  // custom categories allowed
  type: 'select' | 'text' | 'boolean';
  currentValue: string | boolean;
  options?: Array<{ value: string; label?: string }>;
}
```

Example from `session/new` response:
```json
{
  "configOptions": [
    {
      "id": "mode",
      "name": "Session Mode",
      "category": "mode",
      "type": "select",
      "currentValue": "ask",
      "options": [{"value": "ask"}, {"value": "code"}, {"value": "architect"}]
    },
    {
      "id": "model",
      "name": "Model",
      "category": "model",
      "type": "select",
      "currentValue": "claude-opus-4",
      "options": [{"value": "claude-opus-4"}, {"value": "claude-sonnet-4"}]
    }
  ]
}
```

Update a config option:
```json
{"jsonrpc":"2.0","id":5,"method":"session/set_config_option","params":{"sessionId":"sess_abc","id":"mode","value":"code"}}
```

---

## MCP Integration

ACP sessions carry MCP server configuration. The agent connects to them during `session/new`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--stdio"]
      },
      {
        "name": "postgres",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://..."]
      }
    ]
  }
}
```

Agent declares MCP capabilities during `initialize` so the client knows what protocols it accepts:
```json
"mcp": { "http": true, "sse": true }
```

---

## Extensibility

### `_meta` Field

All ACP types accept an optional `_meta` field for custom data. Reserved keys follow W3C trace context:

```json
{
  "type": "tool_call",
  "toolCall": { "id": "tc_1", "name": "read_file", "status": "running" },
  "_meta": {
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "tracestate": "rojo=00f067aa0ba902b7",
    "customField": "value"
  }
}
```

Reserved `_meta` keys: `traceparent`, `tracestate`, `baggage` (W3C trace context spec)

### Custom Methods

Prefix custom methods with `_` to avoid conflicts with the spec:

```json
{"jsonrpc":"2.0","id":99,"method":"_goodvibes/agents","params":{"action":"list"}}
{"jsonrpc":"2.0","method":"_goodvibes/directive","params":{"type":"spawn","agentId":"eng-1"}}
```

---

## TypeScript SDK: Agent Side

```typescript
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';

class MyAgent {
  constructor(private conn: AgentSideConnection) {}

  async onInitialize(params: InitializeParams): Promise<InitializeResult> {
    return {
      protocolVersion: 1,
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: { image: true, embeddedContext: true },
        mcp: { http: true, sse: true }
      },
      agentInfo: { name: 'my-agent', title: 'My Agent', version: '1.0.0' },
      authMethods: []
    };
  }

  async onSessionNew(params: SessionNewParams): Promise<SessionNewResult> {
    return { sessionId: crypto.randomUUID(), configOptions: [] };
  }

  async onSessionPrompt(params: SessionPromptParams): Promise<SessionPromptResult> {
    // Stream updates while processing
    await this.conn.sessionUpdate({
      sessionId: params.sessionId,
      update: { type: 'agent_message_chunk', chunk: { type: 'text', text: 'Working...' } }
    });
    return { stopReason: 'end_turn' };
  }
}

// Wire up:
const conn = new AgentSideConnection(
  (conn) => new MyAgent(conn),
  ndJsonStream(process.stdout, process.stdin)
);
```

**AgentSideConnection methods** (calls into the Client):
- `sessionUpdate(params)` — send streaming update notification
- `requestPermission(params)` — request user permission (returns grant/deny)
- `readTextFile(params)` — read file via client
- `writeTextFile(params)` — write file via client
- `createTerminal(params)` — create terminal via client
- `extMethod(name, params)` — call custom `_`-prefixed method on client
- `extNotification(name, params)` — send custom notification to client

## TypeScript SDK: Client Side

```typescript
import { ClientSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';

const conn = new ClientSideConnection(
  (agent) => new MyClient(),
  ndJsonStream(writable, readable)  // streams to/from agent subprocess
);

// Full client API:
await conn.initialize({ protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true } } });
await conn.newSession({ cwd: '/project', mcpServers: [] });
await conn.prompt({ sessionId, userMessage: { content: [{ type: 'text', text: '...' }] } });
await conn.cancel({ sessionId });         // notification, no await needed
await conn.authenticate({ credentials }); // if agent requires auth
await conn.setSessionConfigOption({ sessionId, id: 'mode', value: 'code' });
```

---

## Registry

Public registry of ACP-compatible agents:

```
https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
```

- 15+ registered agents: Amp, Auggie, Claude Code, Codex, Gemini CLI, Goose, etc.
- Distribution formats: `npx`, binary, `pip`
- Auth required for registration (agent must return valid `authMethods` in initialize)
- Registry auto-updates hourly via cron

---

## Key Implementation Notes

1. **IDs are correlation keys** — `id` in request must match `id` in response. Use incrementing integers or UUIDs.
2. **Notifications have no `id`** — no response is expected or sent
3. **ndjson = one JSON object per line** — each message ends with exactly one `\n`
4. **Protocol version is a single integer** — only bumped on breaking changes
5. **Capabilities gate everything** — never call a method the other side didn't advertise
6. **`_meta` is always optional** — omit when not needed, ignore unknown keys when present
7. **Default text format is Markdown** — `agent_message_chunk` content is Markdown by convention
8. **`_`-prefixed methods are safe extensions** — they will never conflict with future spec additions
