# ACP Tools and MCP Integration Reference

**Source**: ACP Protocol v1, TypeScript SDK v0.15.0  
**Scope**: Tool call lifecycle via `session/update`, MCP server configuration in `session/new`

---

## Tool Calls Overview

Tool calls are reported by the agent to the client via `session/update` notifications. The client does NOT execute tools — the agent executes them. The client just receives status updates for display. Tool calls have a lifecycle: **pending → running → completed|failed**.

---

## Tool Call Lifecycle

```
pending  →  (optional permission gate)  →  running  →  completed
                                                    →  failed
```

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | LLM has requested the tool; not yet executing |
| `running` | Tool is actively executing |
| `completed` | Tool finished successfully |
| `failed` | Tool errored or was denied/cancelled |

---

## Wire Format

### Creating a Tool Call (pending)

Agent sends when LLM requests a tool invocation:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_001",
      "title": "Reading configuration file",
      "kind": "read",
      "status": "pending"
    }
  }
}
```

### Updating a Tool Call (tool_call_update)

Agent sends to transition status or add content/locations:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "completed",
      "content": [
        { "type": "text", "text": "File contents: {...}" }
      ],
      "locations": [
        {
          "path": "/home/user/project/config.json",
          "startLine": 1,
          "endLine": 45
        }
      ]
    }
  }
}
```

---

## Tool Call Object Shape

### Initial `tool_call` Update

```typescript
interface ToolCallUpdate {
  sessionUpdate: 'tool_call';
  toolCallId: string;           // Unique within session; agent-generated
  title: string;                // Human-readable label (e.g. "Reading config.json")
  kind?: ToolCallKind;          // Category for icon/display selection
  status?: ToolCallStatus;      // Defaults to 'pending'
  content?: ContentBlock[];     // Optional initial content
  locations?: FileLocation[];   // Optional file locations affected
  input?: unknown;              // Raw tool input parameters (for display)
  _meta?: Record<string, unknown>;
}

type ToolCallKind =
  | 'read'      // Reading files or data
  | 'edit'      // Modifying files or content
  | 'delete'    // Removing files or data
  | 'move'      // Moving or renaming
  | 'search'    // Searching for information
  | 'execute'   // Running commands or code
  | 'think'     // Internal reasoning
  | 'fetch'     // Retrieving external data
  | 'other';    // Default

type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
```

### `tool_call_update` Update

```typescript
interface ToolCallStatusUpdate {
  sessionUpdate: 'tool_call_update';
  toolCallId: string;           // Must match an existing tool_call id
  status?: ToolCallStatus;      // New status (optional if only updating content)
  content?: ContentBlock[];     // Output produced by the tool
  locations?: FileLocation[];   // File locations affected
  _meta?: Record<string, unknown>;
}
```

### FileLocation

```typescript
interface FileLocation {
  path: string;       // Absolute path
  startLine?: number; // 1-based, optional
  endLine?: number;   // 1-based, optional
}
```

---

## Tool Call Kind Reference

| Kind | Use Case | Icon Hint |
|------|----------|-----------|
| `read` | `fs/read_text_file`, reading configs | File with eye |
| `edit` | `fs/write_text_file`, patching code | Pencil |
| `delete` | Removing files, clearing caches | Trash |
| `move` | Rename/move operations | Arrow |
| `search` | Grep, glob, symbol search | Magnifier |
| `execute` | Shell commands, npm scripts | Terminal |
| `think` | LLM reasoning steps, planning | Brain/gear |
| `fetch` | HTTP requests, API calls | Network |
| `other` | Default for anything else | Box |

---

## Full Lifecycle Example

### File Edit with Permission Gate

```json
// 1. Announce pending
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_edit_001",
      "title": "Edit src/auth/index.ts",
      "kind": "edit",
      "status": "pending",
      "locations": [{ "path": "/project/src/auth/index.ts" }]
    }
  }
}

// 2. Request permission (agent blocks)
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "file_write",
      "title": "Edit file",
      "description": "/project/src/auth/index.ts"
    }
  }
}

// 2a. Permission granted
{ "jsonrpc": "2.0", "id": 5, "result": { "granted": true } }

// 3. Transition to running
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_edit_001",
      "status": "running"
    }
  }
}

// 4. Completed with output
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_edit_001",
      "status": "completed",
      "content": [
        { "type": "text", "text": "Updated exportAuth function" }
      ],
      "locations": [
        { "path": "/project/src/auth/index.ts", "startLine": 12, "endLine": 38 }
      ]
    }
  }
}
```

### Shell Command Execution

```json
// Announce
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_npm_001",
      "title": "npm run build",
      "kind": "execute",
      "status": "pending",
      "input": { "command": "npm run build", "cwd": "/project" }
    }
  }
}

// ... permission flow ...

// Running
{
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": { "sessionUpdate": "tool_call_update", "toolCallId": "call_npm_001", "status": "running" }
  }
}

// Failed
{
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_npm_001",
      "status": "failed",
      "content": [
        { "type": "text", "text": "Error: TypeScript compilation failed\nTS2345: Argument of type..." }
      ]
    }
  }
}
```

---

## TypeScript SDK: Agent Tool Call API

```typescript
import { AgentSideConnection } from '@agentclientprotocol/sdk';

class MyAgent implements Agent {
  constructor(private conn: AgentSideConnection) {}

  async reportToolCall(sessionId: string, toolCallId: string, cmd: string) {
    // 1. Announce pending
    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId,
        title: cmd,
        kind: 'execute',
        status: 'pending',
      },
    });

    // 2. Gate on permission
    const { granted } = await this.conn.requestPermission({
      sessionId,
      permission: { type: 'shell', title: 'Run command', description: cmd },
    });

    if (!granted) {
      await this.conn.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId,
          status: 'failed',
          content: [{ type: 'text', text: 'Denied by user' }],
        },
      });
      return;
    }

    // 3. Running
    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call_update', toolCallId, status: 'running' },
    });

    // 4. Execute and complete
    const output = await runCommand(cmd);
    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: output.exitCode === 0 ? 'completed' : 'failed',
        content: [{ type: 'text', text: output.stdout + output.stderr }],
      },
    });
  }
}
```

---

## MCP Integration

ACP and MCP are complementary. ACP agents consume MCP servers as their tool source. The client passes MCP server configuration at session creation; the agent connects to those servers and uses their tools.

```
Client → Agent: session/new (includes mcpServers[])
Agent: spawns/connects to each MCP server
Agent: discovers MCP tools via MCP initialize + tools/list
LLM: sees MCP tools in context
LLM: calls MCP tool
Agent: executes via MCP, reports as ACP tool_call updates
```

---

## session/new with MCP Servers

### Full Request Format

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
        "command": "/usr/local/bin/mcp-server-filesystem",
        "args": ["--stdio"],
        "env": { "ALLOWED_DIRS": "/home/user/project" }
      },
      {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "ghp_xxx" }
      },
      {
        "name": "postgres",
        "command": "uvx",
        "args": ["mcp-server-postgres", "postgresql://localhost/mydb"]
      }
    ]
  }
}
```

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

### MCP Server Object Shape

```typescript
interface MCPServer {
  name: string;           // Logical name; used for tool namespacing
  command: string;        // Executable to spawn (e.g. "npx", "uvx", "/path/to/server")
  args?: string[];        // Arguments to pass to command
  env?: Record<string, string>;  // Environment variables for the server process
}
```

---

## MCP Transport Types

The agent declares which MCP transports it supports during `initialize`:

```json
{
  "agentCapabilities": {
    "mcp": {
      "http": true,
      "sse": true
    }
  }
}
```

| Transport | Field | Description |
|-----------|-------|-------------|
| stdio | (always supported) | Server spawned as subprocess, communicate via stdin/stdout |
| HTTP | `mcp.http: true` | MCP server running as HTTP service |
| SSE | `mcp.sse: true` | Server-Sent Events transport for MCP |

For HTTP/SSE MCP servers, the `mcpServers` entry would use a URL instead of a command:

```json
{
  "name": "remote-server",
  "url": "https://mcp.example.com/v1"
}
```

*(Note: exact HTTP/SSE server object shape may vary by implementation; stdio is the universal baseline.)*

---

## MCP Capabilities Negotiation

When the agent connects to an MCP server after `session/new`, it follows the MCP initialization handshake internally:

```
Agent → MCP Server: initialize (MCP protocol)
MCP Server → Agent: initialize response (serverCapabilities: { tools, resources, prompts })
Agent → MCP Server: tools/list
MCP Server → Agent: { tools: [{ name, description, inputSchema }...] }
Agent: injects tool definitions into LLM system prompt
LLM: calls tool by name during generation
Agent → MCP Server: tools/call { name, arguments }
MCP Server → Agent: { content: [...] }
Agent: wraps result in ACP tool_call updates
```

---

## MCP Tool Call → ACP Update Mapping

When the LLM calls an MCP tool, the agent bridges it through ACP tool_call updates:

```typescript
async function callMcpTool(
  sessionId: string,
  toolCallId: string,
  serverName: string,
  toolName: string,
  toolInput: unknown
) {
  // 1. Announce to ACP client
  await acpConn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: `${serverName}: ${toolName}`,
      kind: inferKind(toolName),  // 'read' | 'edit' | 'execute' | ...
      status: 'pending',
      input: toolInput,
    },
  });

  // 2. Optionally gate on permission
  if (requiresPermission(toolName)) {
    const { granted } = await acpConn.requestPermission({
      sessionId,
      permission: {
        type: inferPermissionType(toolName),
        title: `${serverName}: ${toolName}`,
        description: JSON.stringify(toolInput),
      },
    });
    if (!granted) {
      await acpConn.sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'tool_call_update', toolCallId, status: 'failed',
          content: [{ type: 'text', text: 'Permission denied' }] },
      });
      return null;
    }
  }

  // 3. Execute via MCP
  await acpConn.sessionUpdate({
    sessionId,
    update: { sessionUpdate: 'tool_call_update', toolCallId, status: 'running' },
  });

  const mcpResult = await mcpClient.callTool({ name: toolName, arguments: toolInput });

  // 4. Forward MCP content blocks directly to ACP (same ContentBlock schema)
  await acpConn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status: mcpResult.isError ? 'failed' : 'completed',
      content: mcpResult.content,  // MCP ContentBlock[] is directly compatible with ACP
    },
  });

  return mcpResult;
}
```

**Key insight**: ACP uses the same `ContentBlock` schema as MCP. MCP tool output can be forwarded to ACP `content` without transformation.

---

## Session Load with MCP Servers

When resuming an existing session, MCP servers are re-connected:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/load",
  "params": {
    "sessionId": "sess_abc123def456",
    "mcpServers": [
      {
        "name": "filesystem",
        "command": "/usr/local/bin/mcp-server-filesystem",
        "args": ["--stdio"]
      }
    ]
  }
}
```

The agent replays conversation history as `session/update` notifications before responding to the load.

---

## Multiple Tool Calls in Parallel

The spec does not prohibit concurrent tool calls. When the LLM requests multiple tool uses in the same response, the agent may report multiple `tool_call` updates with distinct `toolCallId` values, then update each independently:

```json
// Announce both at once
{ "update": { "sessionUpdate": "tool_call", "toolCallId": "call_a", "title": "Read file A", "kind": "read", "status": "pending" } }
{ "update": { "sessionUpdate": "tool_call", "toolCallId": "call_b", "title": "Read file B", "kind": "read", "status": "pending" } }

// Execute in parallel, update independently
{ "update": { "sessionUpdate": "tool_call_update", "toolCallId": "call_a", "status": "running" } }
{ "update": { "sessionUpdate": "tool_call_update", "toolCallId": "call_b", "status": "running" } }

{ "update": { "sessionUpdate": "tool_call_update", "toolCallId": "call_a", "status": "completed", "content": [...] } }
{ "update": { "sessionUpdate": "tool_call_update", "toolCallId": "call_b", "status": "completed", "content": [...] } }
```

---

## Using ACP Client File System Instead of MCP

For file reads/writes, ACP provides client-native methods (no MCP server needed) when the client supports them:

```typescript
// Check capability first (from initialize response)
if (clientCapabilities.fs?.readTextFile) {
  // Use ACP client fs (gets unsaved editor state)
  const file = await acpConn.readTextFile({
    sessionId,
    path: '/project/src/main.ts',
    line: 1,
    limit: 100,
  });
} else {
  // Fall back to MCP filesystem server
  const result = await mcpClient.callTool({
    name: 'read_file',
    arguments: { path: '/project/src/main.ts' },
  });
}
```

ACP `fs/read_text_file` advantages over MCP filesystem:
- Returns unsaved editor buffer (not just disk state)
- Client tracks which files agent read/wrote (editor can highlight changes)
- No MCP server process to spawn

---

## Key Implementation Notes

- `toolCallId` is agent-generated; must be unique within a session (use nanoid/uuid)
- `tool_call` (create) and `tool_call_update` (update) are both `sessionUpdate` notification types
- MCP `ContentBlock` is identical to ACP `ContentBlock` — forward directly, no transform needed
- Agent connects to MCP servers during `session/new` handler, before returning the response
- If an MCP server fails to connect, agent should still complete `session/new` but note the failure
- `kind` on tool_call is informational only — clients use it to pick icons, not for logic
- `input` field on tool_call is for display only (show user what the tool received)
