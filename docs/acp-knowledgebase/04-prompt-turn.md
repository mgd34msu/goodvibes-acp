# ACP Prompt Turn

A prompt turn is a complete interaction cycle: Client sends `session/prompt`, Agent streams `session/update` notifications, then responds with a `stopReason`. Multiple tool calls and LLM round-trips may occur within a single turn.

**Prerequisite:** initialization + session/new (or session/load) must be complete.

## session/prompt

### Request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [
      {
        "type": "text",
        "text": "Can you analyze this code for potential issues?"
      },
      {
        "type": "resource",
        "resource": {
          "uri": "file:///home/user/project/main.py",
          "mimeType": "text/x-python",
          "text": "def process_data(items):\n    for item in items:\n        print(item)"
        }
      }
    ]
  }
}
```

**Params:**
- `sessionId` — session to send the message to
- `prompt` (ContentBlock[]) — content of the user message (text, images, resources, etc.)
  - Clients MUST restrict content types to those established in Prompt Capabilities during initialization

### Response (after turn completes)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "stopReason": "end_turn"
  }
}
```

The response is sent ONLY when the turn is fully complete (all tool calls done, no more LLM requests pending). All streaming happens via `session/update` notifications before this.

### TypeScript Interface

```typescript
interface SessionPromptParams {
  sessionId: string;
  prompt: ContentBlock[];
}

interface SessionPromptResult {
  stopReason: StopReason;
}

type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```

---

## session/update Notifications

All Agent output arrives as JSON-RPC notifications (no `id` field — no response expected). The `sessionUpdate` field discriminates the type.

### Notification Envelope

```typescript
interface SessionUpdateNotification {
  jsonrpc: "2.0";
  method: "session/update";
  params: {
    sessionId: string;
    update: SessionUpdate; // discriminated union on sessionUpdate field
  };
}
```

---

### agent_message_chunk

Streaming text from the LLM. Multiple chunks form the complete agent message.

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {
        "type": "text",
        "text": "I'll analyze your code for potential issues. Let me examine it..."
      }
    }
  }
}
```

```typescript
interface AgentMessageChunkUpdate {
  sessionUpdate: "agent_message_chunk";
  content: ContentBlock; // typically { type: "text", text: string }
}
```

---

### tool_call

Announces a new tool call. Sent immediately when the LLM requests a tool, before execution begins.

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call",
      "toolCallId": "call_001",
      "title": "Analyzing Python code",
      "kind": "other",
      "status": "pending"
    }
  }
}
```

```typescript
interface ToolCallUpdate {
  sessionUpdate: "tool_call";
  toolCallId: string;     // unique ID for this tool call within the session
  title: string;          // human-readable description
  kind: ToolCallKind;     // semantic hint for the UI
  status: "pending";      // always "pending" on initial announcement
}

type ToolCallKind =
  | "read"        // reads data without side effects
  | "write"       // modifies data or files
  | "run"         // executes code or commands
  | "switch_mode" // changes agent mode
  | "other";      // catch-all
```

---

### tool_call_update

Updates the status of a previously announced tool call. Multiple updates may arrive for one `toolCallId`.

**In-progress (execution started):**
```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "tool_call_update",
      "toolCallId": "call_001",
      "status": "in_progress"
    }
  }
}
```

**Completed (with result content):**
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
        {
          "type": "content",
          "content": {
            "type": "text",
            "text": "Analysis complete:\n- No syntax errors found\n- Consider adding type hints"
          }
        }
      ]
    }
  }
}
```

```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";

interface ToolCallUpdateUpdate {
  sessionUpdate: "tool_call_update";
  toolCallId: string;
  status: ToolCallStatus;
  content?: ToolCallContent[]; // present on completed/error
}
```

**Status lifecycle:** `pending` → `in_progress` → `completed` | `cancelled` | `error`

---

### plan

Agent's declared intent before executing. Optional — not all agents emit plans.

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "plan",
      "entries": [
        { "content": "Check for syntax errors",       "priority": "high",   "status": "pending" },
        { "content": "Identify potential type issues",  "priority": "medium", "status": "pending" },
        { "content": "Review error handling patterns",  "priority": "medium", "status": "pending" },
        { "content": "Suggest improvements",            "priority": "low",    "status": "pending" }
      ]
    }
  }
}
```

```typescript
interface PlanUpdate {
  sessionUpdate: "plan";
  entries: PlanEntry[];
}

interface PlanEntry {
  content: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed";
}
```

---

### agent_thought_chunk

Internal reasoning/thinking from the LLM (extended thinking mode). Clients may display or suppress this.

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "agent_thought_chunk",
      "content": {
        "type": "text",
        "text": "Let me think about the best approach..."
      }
    }
  }
}
```

```typescript
interface AgentThoughtChunkUpdate {
  sessionUpdate: "agent_thought_chunk";
  content: ContentBlock;
}
```

---

### session_info

General informational message from the Agent (status updates, warnings, non-message content).

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "session_info",
      "content": {
        "type": "text",
        "text": "Connected to 2 MCP servers"
      }
    }
  }
}
```

```typescript
interface SessionInfoUpdate {
  sessionUpdate: "session_info";
  content: ContentBlock;
}
```

---

### available_commands

Agent advertises commands the Client can invoke (agent-specific extensibility).

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "sessionUpdate": "available_commands",
      "commands": [
        {
          "id": "compact",
          "name": "Compact conversation",
          "description": "Summarize and compress conversation history"
        }
      ]
    }
  }
}
```

```typescript
interface AvailableCommandsUpdate {
  sessionUpdate: "available_commands";
  commands: AgentCommand[];
}

interface AgentCommand {
  id: string;
  name: string;
  description?: string;
}
```

---

### current_mode (legacy)

Legacy notification — use `config_options_update` for new implementations. Announces the current active mode.

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

```typescript
interface CurrentModeUpdateUpdate {
  sessionUpdate: "current_mode_update";
  modeId: string;
}
```

---

### config_option (config_options_update)

Agent-initiated config change notification. Contains complete config state — not just the changed option.

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
          "options": [
            { "value": "ask",  "name": "Ask" },
            { "value": "code", "name": "Code" }
          ]
        }
      ]
    }
  }
}
```

```typescript
interface ConfigOptionsUpdateUpdate {
  sessionUpdate: "config_options_update";
  configOptions: ConfigOption[]; // complete state, not delta
}
```

---

### user_message_chunk

Only emitted during `session/load` history replay. Represents a historical user message being replayed.

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

---

## Stop Reasons

The `session/prompt` response `stopReason` field:

| Value               | Meaning                                                  |
|---------------------|----------------------------------------------------------|
| `end_turn`          | LLM finished without requesting more tools               |
| `max_tokens`        | Maximum token limit reached                              |
| `max_turn_requests` | Maximum model requests per turn exceeded                 |
| `refusal`           | Agent refuses to continue                                |
| `cancelled`         | Client cancelled via `session/cancel`                    |

```typescript
type StopReason = "end_turn" | "max_tokens" | "max_turn_requests" | "refusal" | "cancelled";
```

**Implementation note:** API client libraries often throw an exception when aborted. Agents MUST catch these and return `cancelled` — not an error response. Clients display unrecognized errors to users, which is undesirable for intentional cancellations.

---

## session/cancel

Client cancels an in-progress prompt turn. Sent as a notification (no `id` — no response).

```json
{
  "jsonrpc": "2.0",
  "method": "session/cancel",
  "params": {
    "sessionId": "sess_abc123def456"
  }
}
```

**Protocol rules after sending `session/cancel`:**

1. Client SHOULD preemptively mark all non-finished tool calls for the current turn as `cancelled`.
2. Client MUST respond to all pending `session/request_permission` requests with the `cancelled` outcome.
3. Agent SHOULD stop all LLM requests and tool invocations as soon as possible.
4. Agent MAY still send `session/update` notifications after receiving `session/cancel` — Client SHOULD still accept them.
5. Agent MUST eventually respond to the original `session/prompt` request with `{ stopReason: "cancelled" }`.
6. Agent MUST ensure all pending updates are sent BEFORE responding to `session/prompt`.

```typescript
interface SessionCancelParams {
  sessionId: string;
}
// No result — notification only
```

---

## Full Turn Lifecycle (TypeScript pseudo-code)

```typescript
async function sendPrompt(client: AcpClient, sessionId: string, text: string) {
  // Start listening for notifications before sending the request
  const updateHandler = client.on("session/update", (notification) => {
    const { update } = notification.params;
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        process.stdout.write(update.content.text);
        break;
      case "tool_call":
        console.log(`Tool announced: ${update.title} [${update.status}]`);
        break;
      case "tool_call_update":
        console.log(`Tool ${update.toolCallId}: ${update.status}`);
        break;
      case "plan":
        console.log("Plan:", update.entries);
        break;
      case "agent_thought_chunk":
        // optionally display thinking
        break;
      case "config_options_update":
        updateConfigState(update.configOptions);
        break;
      case "current_mode_update":
        updateModeState(update.modeId);
        break;
    }
  });

  try {
    const result = await client.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text }],
    });
    // result.stopReason tells you why the turn ended
    return result.stopReason;
  } finally {
    updateHandler.dispose();
  }
}
```

---

## Update Type Reference

| `sessionUpdate` value   | Direction       | When emitted                                     |
|-------------------------|-----------------|--------------------------------------------------|
| `agent_message_chunk`   | Agent → Client  | LLM text output (streaming)                      |
| `agent_thought_chunk`   | Agent → Client  | LLM internal thinking (extended thinking mode)   |
| `tool_call`             | Agent → Client  | New tool call announced (status: pending)        |
| `tool_call_update`      | Agent → Client  | Tool status change (in_progress/completed/etc.)  |
| `plan`                  | Agent → Client  | Agent's declared plan before execution           |
| `session_info`          | Agent → Client  | General informational messages                   |
| `available_commands`    | Agent → Client  | Commands the Client can invoke                   |
| `config_options_update` | Agent → Client  | Agent-initiated config change (complete state)   |
| `current_mode_update`   | Agent → Client  | Legacy: active mode changed                      |
| `user_message_chunk`    | Agent → Client  | History replay during session/load only          |
