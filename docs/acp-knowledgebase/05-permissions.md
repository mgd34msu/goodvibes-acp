# ACP Permissions Reference

**Source**: ACP Protocol v1, TypeScript SDK v0.15.0  
**Scope**: `session/request_permission` — the gated checkpoint before tool execution

---

## Overview

Permissions are the mechanism by which an agent pauses execution and asks the client (which presents to the user) whether a sensitive action is allowed. The flow is synchronous from the agent's perspective: the agent sends a `session/request_permission` request and **blocks** until it receives a response.

```
Agent → Client: session/request_permission (JSON-RPC request, has id)
User sees UI prompt (approve / deny)
Client → Agent: session/request_permission response (granted: true|false)
Agent: proceeds or aborts
```

If `granted: false`, the agent MUST NOT execute the action. The agent typically reports a cancelled or error `tool_call_update` and continues to the next LLM turn or ends.

---

## Wire Format

### Request (Agent → Client)

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "shell",
      "title": "Run shell command",
      "description": "rm -rf ./dist && npm run build"
    }
  }
}
```

### Response (Client → Agent)

**Granted:**
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "granted": true
  }
}
```

**Denied:**
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "granted": false
  }
}
```

**Error (client can't handle it):**
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "error": {
    "code": -32603,
    "message": "Internal error"
  }
}
```

---

## Permission Types

The `permission.type` field tells the client (and user) what category of action is being gated. The protocol defines common types but the field is a string — custom types are allowed.

| Type | Meaning | Typical Display |
|------|---------|------------------|
| `shell` | Execute a shell command | Show command string |
| `file_write` | Write/create a file | Show file path + content preview |
| `file_delete` | Delete a file/directory | Show path |
| `network` | Make a network request | Show URL/host |
| `browser` | Open or control a browser | Show URL |
| custom | Anything agent-specific | Use description |

### Permission Object Shape

```typescript
interface Permission {
  type: string;           // Required: categorizes the action
  title: string;          // Required: short label for UI (e.g. "Run shell command")
  description: string;    // Required: full detail of what will happen
  _meta?: Record<string, unknown>;  // Optional: extensibility
}
```

---

## Full Request/Response Examples

### Shell Command

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "shell",
      "title": "Run shell command",
      "description": "npm install && npm run build"
    }
  }
}

// Response (granted)
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": { "granted": true }
}
```

### File Write

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "file_write",
      "title": "Write file",
      "description": "/home/user/project/config.json"
    }
  }
}

// Response (denied)
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": { "granted": false }
}
```

### Custom Permission Type

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "_goodvibes/spawn_agent",
      "title": "Spawn subagent",
      "description": "Start engineer agent for: implement auth module",
      "_meta": {
        "agent_type": "goodvibes:engineer",
        "budget_tokens": 50000
      }
    }
  }
}
```

---

## Relationship to Tool Execution

Permissions gate tool execution. The typical sequence inside a prompt turn:

```
1. LLM decides to call a tool
2. Agent reports tool_call (status: "pending")
3. Agent evaluates if this tool requires permission
4. If yes → Agent sends session/request_permission (BLOCKS)
5a. Granted → Agent reports tool_call_update (status: "running"), executes tool
5b. Denied → Agent reports tool_call_update (status: "failed"), reason: permission denied
6. Agent reports tool_call_update (status: "completed"|"failed") with result content
```

### Full Sequence with Permission Gate

```json
// Step 2: Announce pending tool call
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_001",
      "title": "Delete build artifacts",
      "kind": "delete",
      "status": "pending"
    }
  }
}

// Step 4: Request permission (agent blocks here)
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "session/request_permission",
  "params": {
    "sessionId": "sess_abc123def456",
    "permission": {
      "type": "shell",
      "title": "Run shell command",
      "description": "rm -rf ./dist"
    }
  }
}

// Step 4 response (granted)
{ "jsonrpc": "2.0", "id": 10, "result": { "granted": true } }

// Step 5a: Update to running
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "running"
    }
  }
}

// Step 6: Completed
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
        { "type": "text", "text": "Deleted ./dist (1,240 files)" }
      ]
    }
  }
}
```

---

## TypeScript SDK Usage

### Agent Side — Requesting Permission

`AgentSideConnection.requestPermission()` is the SDK method. It returns a `Promise<{ granted: boolean }>` — it's async/await, no manual JSON-RPC id management needed.

```typescript
import { AgentSideConnection } from '@agentclientprotocol/sdk';

class MyAgent implements Agent {
  constructor(private conn: AgentSideConnection) {}

  async executeWithPermission(sessionId: string, command: string): Promise<void> {
    // Report pending first
    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: 'call_001',
        title: `Run: ${command}`,
        kind: 'execute',
        status: 'pending',
      },
    });

    // Gate on permission
    const { granted } = await this.conn.requestPermission({
      sessionId,
      permission: {
        type: 'shell',
        title: 'Run shell command',
        description: command,
      },
    });

    if (!granted) {
      await this.conn.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 'call_001',
          status: 'failed',
          content: [{ type: 'text', text: 'Permission denied by user' }],
        },
      });
      return;
    }

    // Proceed with execution
    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: 'call_001',
        status: 'running',
      },
    });

    // ... execute command ...
  }
}
```

### Client Side — Handling Permission Requests

Clients MUST implement `session/request_permission`. It is the only baseline client method. The client presents the permission to the user and returns `granted: true|false`.

```typescript
import { ClientSideConnection } from '@agentclientprotocol/sdk';

class MyClient implements Client {
  // This is called by the SDK when agent sends session/request_permission
  async requestPermission(params: {
    sessionId: string;
    permission: Permission;
  }): Promise<{ granted: boolean }> {
    const { permission } = params;

    // Show UI to user
    const granted = await showPermissionDialog({
      title: permission.title,
      description: permission.description,
      type: permission.type,
    });

    return { granted };
  }
}
```

---

## Mode-Based Auto-Approval

ACP itself has no built-in auto-approval mechanism — that's agent/client implementation. In practice:

- **ask mode** (default): Agent calls `session/request_permission` for every gated action; user sees every prompt
- **code mode** (trust mode): Agent may skip `session/request_permission` for safe file operations but still calls it for shell/delete/network
- **yolo/auto mode**: Agent may skip `session/request_permission` entirely (not recommended for production)

The mode is exposed as a `configOption` with `category: "mode"`. The agent interprets the mode value and decides whether to call `session/request_permission`.

```typescript
// Agent checks current mode before deciding to request permission
if (this.currentMode === 'ask' || isHighRiskAction(action)) {
  const { granted } = await this.conn.requestPermission(...);
  if (!granted) return;
}
// else: proceed without permission gate
```

---

## Cancellation During Permission

If the client sends a `session/cancel` while `session/request_permission` is in-flight:

1. The SDK delivers the cancel to the agent
2. The pending permission request should be resolved as `granted: false`
3. Agent cleans up and sends final `session/prompt` response with `stopReason: "cancelled"`

---

## _meta Extensibility

The `_meta` field on the permission object can carry custom data. Reserved keys for W3C trace context: `traceparent`, `tracestate`, `baggage`.

```json
{
  "type": "shell",
  "title": "Run build",
  "description": "npm run build",
  "_meta": {
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    "risk_level": "medium",
    "estimated_duration_ms": 30000
  }
}
```

---

## Key Implementation Notes

- `session/request_permission` is a **JSON-RPC request** (has `id`), not a notification — it expects a response
- Agent MUST block on the response before proceeding with the action
- The client is REQUIRED to implement this method — it is the only baseline client method
- There is no timeout in the spec; the agent waits indefinitely (or until session cancel)
- Multiple concurrent permission requests are not addressed in spec; in practice serialize them per session
- `toolCallId` used in permission context should match the `tool_call` update sent before the request
