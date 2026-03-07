# ACP Sessions

Sessions represent a conversation thread between Client and Agent. Each session maintains its own context, conversation history, and state. Multiple independent sessions can coexist with the same Agent.

**Prerequisite:** Client MUST complete the initialization handshake before creating sessions.

## session/new

Creates a new session context.

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/new",
  "params": {
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--stdio"],
        "env": [
          { "name": "API_KEY", "value": "secret123" }
        ]
      }
    ]
  }
}
```

**Params:**
- `cwd` (string, required) — Absolute path. Agent MUST use this as the session's working directory regardless of where the Agent subprocess was spawned. SHOULD serve as a boundary for file system tool operations.
- `mcpServers` (array) — MCP server connections for this session.

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456"
  }
}
```

The response MAY also include `configOptions` and/or `modes` — see sections below.

**Full response with optional fields:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "configOptions": [...],
    "modes": {
      "currentModeId": "ask",
      "availableModes": [...]
    }
  }
}
```

## session/load

Resumes a previous conversation. Agent MUST advertise the `loadSession` capability in the initialize response.

**Check capability first:**
```json
{
  "agentCapabilities": {
    "loadSession": true
  }
}
```

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/load",
  "params": {
    "sessionId": "sess_789xyz",
    "cwd": "/home/user/project",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/path/to/mcp-server",
        "args": ["--mode", "filesystem"],
        "env": []
      }
    ]
  }
}
```

### Behavior During Load

The Agent MUST replay the entire conversation history as `session/update` notifications before responding to the `session/load` request.

**History replay — user message:**
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_789xyz",
    "update": {
      "sessionUpdate": "user_message_chunk",
      "content": {
        "type": "text",
        "text": "What's the capital of France?"
      }
    }
  }
}
```

**History replay — agent message:**
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_789xyz",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "The capital of France is Paris."
      }
    }
  }
}
```

**Response (after all history streamed):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": null
}
```

After the response, the Client can send prompts as normal.

## session/list

Not present in the current protocol spec documents. Likely agent-specific or not yet standardized — check agent capabilities during initialization.

## session/fork

Not present in the current protocol spec documents. Likely agent-specific or not yet standardized.

## Session ID

The `sessionId` returned by `session/new` is used in:
- `session/prompt` — send user messages
- `session/cancel` — cancel ongoing operations
- `session/load` — resume the session
- `session/update` notifications from Agent
- `session/set_config_option` — change config
- `session/set_mode` — change mode (legacy)

---

## MCP Server Transports

### Stdio (all Agents MUST support)

```typescript
interface StdioMcpServer {
  name: string;           // human-readable identifier
  command: string;        // absolute path to executable
  args: string[];         // command-line arguments
  env?: EnvVariable[];    // optional environment variables
}

interface EnvVariable {
  name: string;
  value: string;
}
```

### HTTP (requires `mcpCapabilities.http`)

```typescript
interface HttpMcpServer {
  type: "http";
  name: string;
  url: string;
  headers: HttpHeader[];
}

interface HttpHeader {
  name: string;
  value: string;
}
```

```json
{
  "type": "http",
  "name": "api-server",
  "url": "https://api.example.com/mcp",
  "headers": [
    { "name": "Authorization", "value": "Bearer token123" }
  ]
}
```

### SSE (requires `mcpCapabilities.sse`) — DEPRECATED by MCP spec

```json
{
  "type": "sse",
  "name": "event-stream",
  "url": "https://events.example.com/mcp",
  "headers": [
    { "name": "X-API-Key", "value": "apikey456" }
  ]
}
```

Check transport capability in initialize response:
```json
{
  "agentCapabilities": {
    "mcpCapabilities": {
      "http": true,
      "sse": true
    }
  }
}
```

---

## Config Options System

ConfigOptions is the **preferred** (modern) way to expose session-level configuration. It replaces the legacy `modes` API. If an Agent provides `configOptions`, Clients SHOULD use them instead of `modes`. Modes will be removed in a future protocol version.

### TypeScript Interfaces

```typescript
type ConfigOptionCategory = "mode" | "model" | "thought_level" | `_${string}`;
// Categories starting with _ are free for custom use
// Categories without _ prefix are reserved for ACP spec

type ConfigOptionType = "select"; // only type currently defined

interface ConfigOption {
  id: string;                        // unique identifier, used when setting
  name: string;                      // human-readable label
  description?: string;              // optional detail
  category?: ConfigOptionCategory;   // semantic hint for UI placement
  type: ConfigOptionType;            // currently only "select"
  currentValue: string;              // currently selected value
  options: ConfigOptionValue[];      // available values
}

interface ConfigOptionValue {
  value: string;    // identifier used when setting
  name: string;     // human-readable label
  description?: string;
}
```

### Standard Categories

| Category       | Purpose                          |
|----------------|----------------------------------|
| `mode`         | Session mode selector            |
| `model`        | Model selector                   |
| `thought_level`| Thought/reasoning level selector |
| `_*`           | Agent-defined custom categories  |

### Receiving configOptions in session/new Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "configOptions": [
      {
        "id": "mode",
        "name": "Session Mode",
        "description": "Controls how the agent requests permission",
        "category": "mode",
        "type": "select",
        "currentValue": "ask",
        "options": [
          { "value": "ask",  "name": "Ask",  "description": "Request permission before making any changes" },
          { "value": "code", "name": "Code", "description": "Write and modify code with full tool access" }
        ]
      },
      {
        "id": "model",
        "name": "Model",
        "category": "model",
        "type": "select",
        "currentValue": "model-1",
        "options": [
          { "value": "model-1", "name": "Model 1", "description": "The fastest model" },
          { "value": "model-2", "name": "Model 2", "description": "The most powerful model" }
        ]
      }
    ]
  }
}
```

**Array ordering is significant.** Agents place higher-priority options first. Clients SHOULD display options in provided order, use ordering for tie-breaking when multiple options share a category.

### Setting a Config Option (Client → Agent)

Can be called at any point — even while the Agent is generating a response.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/set_config_option",
  "params": {
    "sessionId": "sess_abc123def456",
    "configId": "mode",
    "value": "code"
  }
}
```

**Response** — always the complete config state (all options, not just the changed one):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "configOptions": [
      {
        "id": "mode",
        "name": "Session Mode",
        "type": "select",
        "currentValue": "code",
        "options": []
      },
      {
        "id": "model",
        "name": "Model",
        "type": "select",
        "currentValue": "model-1",
        "options": []
      }
    ]
  }
}
```

The complete response allows Agents to reflect dependent changes (e.g., changing model affects available reasoning options).

### Agent-Initiated Config Change (Agent → Client)

Agent sends a `config_options_update` session notification:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "config_options_update",
      "configOptions": [
        {
          "id": "mode",
          "name": "Session Mode",
          "type": "select",
          "currentValue": "code",
          "options": []
        }
      ]
    }
  }
}
```

Common reasons: mode switch after planning phase, model fallback on rate limits, adjusting available options based on runtime context.

---

## Session Modes (Legacy API)

**Deprecated in favor of configOptions.** Dedicated mode methods will be removed in a future protocol version. For backwards compatibility, agents SHOULD send both `configOptions` and `modes` during the transition period.

**Priority rule:** If an Agent provides both `configOptions` and `modes`, Clients that support configOptions SHOULD use configOptions exclusively and ignore `modes`.

### TypeScript Interfaces

```typescript
type SessionModeId = string;

interface SessionMode {
  id: SessionModeId;
  name: string;
  description?: string;
}

interface SessionModeState {
  currentModeId: SessionModeId;
  availableModes: SessionMode[];
}
```

### Modes in session/new Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "sessionId": "sess_abc123def456",
    "modes": {
      "currentModeId": "ask",
      "availableModes": [
        { "id": "ask",       "name": "Ask",       "description": "Request permission before making any changes" },
        { "id": "architect", "name": "Architect", "description": "Design and plan software systems without implementation" },
        { "id": "code",      "name": "Code",      "description": "Write and modify code with full tool access" }
      ]
    }
  }
}
```

### Setting Mode (Client → Agent)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/set_mode",
  "params": {
    "sessionId": "sess_abc123def456",
    "modeId": "code"
  }
}
```

### Agent-Initiated Mode Change (Agent → Client)

Sent as a `current_mode_update` notification:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "current_mode_update",
      "modeId": "code"
    }
  }
}
```

### Mode ↔ ConfigOption Mapping

| Legacy Mode Field | ConfigOption Equivalent        |
|-------------------|--------------------------------|
| `modes.currentModeId` | `configOptions[].currentValue` where `category: "mode"` |
| `modes.availableModes` | `configOptions[].options` where `category: "mode"` |
| `session/set_mode` | `session/set_config_option` with `configId` = the mode option's `id` |
| `current_mode_update` notification | `config_options_update` notification |

---

## Session Persistence and Resumption

1. Agent returns `sessionId` from `session/new` — Client stores it.
2. Client stores `sessionId` persistently (e.g., local file, database).
3. On reconnect, Client checks `loadSession: true` in Agent capabilities.
4. Client calls `session/load` with the stored `sessionId` and current MCP servers.
5. Agent streams full history as `session/update` notifications, then responds `null`.
6. Client can continue sending `session/prompt` on the resumed session.

**Key:** MCP server config can differ between original and resumed session. The Agent reconnects to whatever servers are provided in `session/load`.
