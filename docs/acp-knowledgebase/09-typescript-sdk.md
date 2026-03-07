# ACP TypeScript SDK — Implementation Reference

**Package**: `@agentclientprotocol/sdk`  
**Version**: 0.15.0  
**License**: Apache-2.0  
**Author**: Zed Industries  
**Entry point**: `dist/acp.js` / `dist/acp.d.ts`  
**Module type**: ESM (`"type": "module"`)

## Installation

```bash
npm install @agentclientprotocol/sdk
# Peer dependency required:
npm install zod
```

Peer dependency: `zod ^3.25.0 || ^4.0.0`

## Import Pattern

```typescript
import * as acp from "@agentclientprotocol/sdk";

// Or named imports:
import {
  AgentSideConnection,
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";

// Types only (no runtime cost):
import type {
  Agent,
  Client,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  PromptRequest,
  PromptResponse,
} from "@agentclientprotocol/sdk";

// Schema validators (Zod):
import * as validate from "@agentclientprotocol/sdk/schema";
```

---

## Core Architecture

The SDK has two primary classes depending on which side of the protocol you're implementing:

| Class | Use When |
|---|---|
| `AgentSideConnection` | You are building the **agent** (AI assistant, coding agent) |
| `ClientSideConnection` | You are building the **client** (code editor, IDE, CLI) |

Communication flows over a `Stream` (bidirectional message channel). For stdio-based agents, use `ndJsonStream` to create the stream from Node.js stdin/stdout.

---

## AgentSideConnection

The agent's view of an ACP connection. Implements the `Client` interface — agents call these methods to make requests to the client (editor).

### Constructor

```typescript
new AgentSideConnection(
  toAgent: (conn: AgentSideConnection) => Agent,
  stream: Stream
)
```

**Factory pattern**: `toAgent` is a factory function that receives the fully-constructed connection and must return an object implementing the `Agent` interface. This allows the agent implementation to hold a reference to the connection for making outbound calls.

```typescript
import * as acp from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

const connection = new acp.AgentSideConnection(
  (conn) => new MyAgent(conn),  // factory receives the connection
  stream
);

await connection.closed; // blocks until connection closes
```

### Accessors

```typescript
// AbortSignal that fires when connection closes
get signal(): AbortSignal

// Promise that resolves when connection is closed
get closed(): Promise<void>
```

### Methods (Agent → Client calls)

#### `sessionUpdate`

Send a session update notification to the client. Used to stream content chunks, tool calls, plan updates, etc.

```typescript
async sessionUpdate(params: SessionNotification): Promise<void>
```

The `SessionNotification` contains a `sessionId` and an `update` discriminated union:

```typescript
// Common update types:
{
  sessionId: string,
  update: {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: string } | { type: "image", ... }
  }
}

{
  sessionId: string,
  update: {
    sessionUpdate: "finish",
    stopReason: string
  }
}
```

#### `requestPermission`

Request user permission for a tool call before executing it.

```typescript
async requestPermission(
  params: RequestPermissionRequest
): Promise<RequestPermissionResponse>
```

```typescript
// Request shape:
{
  sessionId: string,
  toolCall: {
    title: string,
    // tool-specific fields
  },
  options: PermissionOption[]
}

// Response shape:
{
  outcome: {
    outcome: "selected",
    optionId: string  // matches one of the option IDs sent
  }
}
```

#### `readTextFile`

Read a file from the client's filesystem.

```typescript
async readTextFile(
  params: ReadTextFileRequest
): Promise<ReadTextFileResponse>
```

```typescript
// Request:
{ sessionId: string, path: string }

// Response:
{ text: string }
```

#### `writeTextFile`

Write content to a file on the client's filesystem.

```typescript
async writeTextFile(
  params: WriteTextFileRequest
): Promise<WriteTextFileResponse>
```

```typescript
// Request:
{ sessionId: string, path: string, text: string }

// Response: {} (empty object)
```

#### `createTerminal`

Create a terminal in the client and run a command. Returns a `TerminalHandle` for monitoring.

```typescript
async createTerminal(
  params: CreateTerminalRequest
): Promise<TerminalHandle>
```

```typescript
// Request:
{
  sessionId: string,
  command: string,
  args?: string[],
  cwd?: string,
  env?: EnvVariable[]
}
```

Returns a `TerminalHandle` — see [TerminalHandle](#terminalhandle) below.

#### `extMethod`

Call a vendor-defined extension method on the client.

```typescript
async extMethod(
  method: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>>
```

#### `extNotification`

Send a vendor-defined extension notification to the client (fire-and-forget).

```typescript
async extNotification(
  method: string,
  params: Record<string, unknown>
): Promise<void>
```

---

## ClientSideConnection

The client's view of an ACP connection. Implements the `Agent` interface — clients call these methods to send prompts and manage sessions.

### Constructor

```typescript
new ClientSideConnection(
  toClient: (conn: ClientSideConnection) => Client,
  stream: Stream
)
```

Same factory pattern as `AgentSideConnection`.

```typescript
const connection = new acp.ClientSideConnection(
  (conn) => new MyClient(conn),
  stream
);
```

### Accessors

```typescript
get signal(): AbortSignal
get closed(): Promise<void>
```

### Methods (Client → Agent calls)

#### `initialize`

Initialize the connection. Must be called first.

```typescript
async initialize(
  params: InitializeRequest
): Promise<InitializeResponse>
```

```typescript
// Request:
{
  protocolVersion: string,  // use PROTOCOL_VERSION constant
  clientInfo: Implementation,
  clientCapabilities: ClientCapabilities
}

// Response:
{
  protocolVersion: string,
  agentInfo?: Implementation,
  agentCapabilities: AgentCapabilities
}
```

#### `newSession`

Create a new agent session.

```typescript
async newSession(
  params: NewSessionRequest
): Promise<NewSessionResponse>
```

```typescript
// Request:
{
  sessionId?: string,  // optional client-provided ID
  workspaceRoots?: string[]
}

// Response:
{
  sessionId: string
}
```

#### `loadSession`

Load an existing session (optional — agent declares support in capabilities).

```typescript
async loadSession(
  params: LoadSessionRequest
): Promise<LoadSessionResponse>
```

#### `unstable_forkSession`

Fork an existing session (unstable API).

```typescript
async unstable_forkSession(
  params: ForkSessionRequest
): Promise<ForkSessionResponse>
```

#### `unstable_listSessions`

List all sessions (unstable API).

```typescript
async unstable_listSessions(
  params: ListSessionsRequest
): Promise<ListSessionsResponse>
```

#### `unstable_resumeSession`

Resume a session (unstable API).

```typescript
async unstable_resumeSession(
  params: ResumeSessionRequest
): Promise<ResumeSessionResponse>
```

#### `prompt`

Send a prompt to the agent. The agent streams responses back via `sessionUpdate` notifications.

```typescript
async prompt(
  params: PromptRequest
): Promise<PromptResponse>
```

```typescript
// Request:
{
  sessionId: string,
  messages: PromptMessage[],
  threadId?: string
}

// Response: {} (empty — actual content comes via sessionUpdate notifications)
```

#### `cancel`

Cancel an in-progress prompt.

```typescript
async cancel(
  params: CancelNotification
): Promise<void>
```

```typescript
// Params:
{ sessionId: string }
```

#### `setSessionMode`

Change the session interaction mode.

```typescript
async setSessionMode(
  params: SetSessionModeRequest
): Promise<void | SetSessionModeResponse>
```

```typescript
// Request:
{
  sessionId: string,
  mode: string  // e.g., "auto", "manual"
}
```

#### `unstable_setSessionModel`

Set the model for a session (unstable API).

```typescript
async unstable_setSessionModel(
  params: SetSessionModelRequest
): Promise<void | SetSessionModelResponse>
```

#### `setSessionConfigOption`

Set a configuration option for a session.

```typescript
async setSessionConfigOption(
  params: SetSessionConfigOptionRequest
): Promise<SetSessionConfigOptionResponse>
```

#### `authenticate`

Authenticate with the agent.

```typescript
async authenticate(
  params: AuthenticateRequest
): Promise<void | AuthenticateResponse>
```

#### `extMethod` / `extNotification`

Same signatures as on `AgentSideConnection` — for calling extension methods on the agent.

---

## Agent Interface

Your agent implementation must implement this interface. Pass an instance via the `toAgent` factory.

```typescript
interface Agent {
  // Required
  initialize(params: InitializeRequest): Promise<InitializeResponse>;
  newSession(params: NewSessionRequest): Promise<NewSessionResponse>;
  authenticate(params: AuthenticateRequest): Promise<void | AuthenticateResponse>;
  prompt(params: PromptRequest): Promise<PromptResponse>;
  cancel(params: CancelNotification): Promise<void>;

  // Optional
  loadSession?(params: LoadSessionRequest): Promise<LoadSessionResponse>;
  unstable_forkSession?(params: ForkSessionRequest): Promise<ForkSessionResponse>;
  unstable_listSessions?(params: ListSessionsRequest): Promise<ListSessionsResponse>;
  unstable_resumeSession?(params: ResumeSessionRequest): Promise<ResumeSessionResponse>;
  setSessionMode?(params: SetSessionModeRequest): Promise<void | SetSessionModeResponse>;
  unstable_setSessionModel?(params: SetSessionModelRequest): Promise<void | SetSessionModelResponse>;
  setSessionConfigOption?(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse>;
  extMethod?(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
  extNotification?(method: string, params: Record<string, unknown>): Promise<void>;
}
```

## Client Interface

Your client implementation must implement this interface. Pass an instance via the `toClient` factory.

```typescript
interface Client {
  requestPermission(
    params: RequestPermissionRequest
  ): Promise<RequestPermissionResponse>;

  sessionUpdate(
    params: SessionNotification
  ): Promise<void>;

  // Optional extension points
  readTextFile?(params: ReadTextFileRequest): Promise<ReadTextFileResponse>;
  writeTextFile?(params: WriteTextFileRequest): Promise<WriteTextFileResponse>;
  createTerminal?(params: CreateTerminalRequest): Promise<CreateTerminalResponse>;
  terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
  terminalWaitForExit?(params: TerminalWaitForExitRequest): Promise<TerminalWaitForExitResponse>;
  terminalKill?(params: KillTerminalRequest): Promise<KillTerminalResponse>;
  extMethod?(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
  extNotification?(method: string, params: Record<string, unknown>): Promise<void>;
}
```

---

## Stream and ndJsonStream

### Stream Type

```typescript
type Stream = {
  writable: WritableStream<AnyMessage>;
  readable: ReadableStream<AnyMessage>;
};
```

A bidirectional channel of ACP JSON-RPC messages. Both sides are typed as `AnyMessage` (the discriminated union of all valid ACP messages).

### ndJsonStream

Creates a `Stream` from a pair of newline-delimited JSON byte streams. This is the standard way to wire up stdio-based agents.

```typescript
function ndJsonStream(
  output: WritableStream<Uint8Array>,  // where to send messages (stdout)
  input: ReadableStream<Uint8Array>,   // where to receive messages (stdin)
): Stream
```

Internally:
- Reads `Uint8Array` chunks from `input`, decodes as UTF-8, splits on newlines, parses each line as JSON
- Serializes outgoing `AnyMessage` objects as JSON, appends newline, encodes as UTF-8, writes to `output`

### Stdio Setup (Node.js)

```typescript
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);
```

---

## TerminalHandle

Returned by `AgentSideConnection.createTerminal()`. Provides control and monitoring of a terminal process running in the client.

```typescript
class TerminalHandle {
  readonly id: string;

  // Gets current terminal output without waiting for exit
  currentOutput(): Promise<TerminalOutputResponse>;

  // Waits for the terminal process to exit
  waitForExit(): Promise<TerminalWaitForExitResponse>;

  // Kills the terminal process
  kill(): Promise<KillTerminalResponse>;

  // Releases the terminal handle (cleanup)
  release(): Promise<void>;

  // Async disposable — use with `await using`
  [asyncDispose](): Promise<void>;
}
```

```typescript
// Usage:
const terminal = await connection.createTerminal({
  sessionId,
  command: "npm",
  args: ["test"],
  cwd: "/workspace/project",
});

const result = await terminal.waitForExit();
// or
const output = await terminal.currentOutput();
await terminal.kill();

// With async using (auto-release):
await using terminal = await connection.createTerminal({ ... });
```

---

## Key Constants

```typescript
import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
// Current value: "0.15" (matches package major.minor)
// Use in initialize() response: protocolVersion: acp.PROTOCOL_VERSION
```

---

## Schema Exports (`schema/index.ts`)

Auto-generated from the ACP OpenAPI spec via `@hey-api/openapi-ts`. These are TypeScript type exports (not runtime validators).

### Capability Types

```typescript
AgentCapabilities
ClientCapabilities
AuthCapabilities
FileSystemCapabilities
McpCapabilities
PromptCapabilities
```

### Session Update Types

```typescript
SessionNotification          // Wrapper with sessionId + update
AvailableCommandsUpdate      // Commands available in session
ConfigOptionUpdate           // Config option changed
CurrentModeUpdate            // Session mode changed
```

### Content Types

```typescript
Content                      // Base content type
ContentBlock                 // Block-level content
ContentChunk                 // Streaming chunk
TextContent                  // { type: "text", text: string }
ImageContent                 // { type: "image", ... }
AudioContent                 // { type: "audio", ... }
EmbeddedResource
EmbeddedResourceResource
BlobResourceContents
```

### Request/Response Types (Agent-handled)

```typescript
InitializeRequest / InitializeResponse
NewSessionRequest / NewSessionResponse
LoadSessionRequest / LoadSessionResponse
ForkSessionRequest / ForkSessionResponse
ListSessionsRequest / ListSessionsResponse
PromptRequest / PromptResponse
AuthenticateRequest / AuthenticateResponse
SetSessionModeRequest / SetSessionModeResponse  // (Response may be void)
SetSessionModelRequest / SetSessionModelResponse
SetSessionConfigOptionRequest / SetSessionConfigOptionResponse
CancelNotification
CancelRequestNotification
```

### Request/Response Types (Client-handled)

```typescript
RequestPermissionRequest / RequestPermissionResponse  // (via AgentSideConnection)
ReadTextFileRequest                                    // (filesystem capability)
WriteTextFileRequest
CreateTerminalRequest / CreateTerminalResponse
TerminalOutputRequest / TerminalOutputResponse
TerminalWaitForExitRequest / TerminalWaitForExitResponse
KillTerminalRequest / KillTerminalResponse
```

### Permission/Auth Types

```typescript
PermissionOption
PermissionOptionId
PermissionOptionKind
AuthMethod
AuthMethodAgent
AuthMethodEnvVar
AuthMethodTerminal
AuthEnvVar
EnvVariable
```

### MCP Types

```typescript
McpServer
McpServerHttp
McpServerSse
McpServerStdio
```

### Other Types

```typescript
Implementation             // { name: string, version: string }
ModelId
ModelInfo
ProtocolVersion
Plan
PlanEntry
PlanEntryPriority
PlanEntryStatus
Diff
Cost
Error
ErrorCode
HttpHeader
AvailableCommand
AvailableCommandInput
ExtRequest / ExtResponse / ExtNotification
AgentRequest / AgentResponse / AgentNotification
ClientRequest / ClientResponse / ClientNotification
```

---

## Complete Agent Example

Full agent implementation from the SDK examples:

```typescript
#!/usr/bin/env node
import * as acp from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";

interface AgentSession {
  pendingPrompt: AbortController | null;
}

class ExampleAgent implements acp.Agent {
  private connection: acp.AgentSideConnection;
  private sessions: Map<string, AgentSession>;

  constructor(connection: acp.AgentSideConnection) {
    this.connection = connection;
    this.sessions = new Map();
  }

  async initialize(
    _params: acp.InitializeRequest,
  ): Promise<acp.InitializeResponse> {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    };
  }

  async newSession(
    _params: acp.NewSessionRequest,
  ): Promise<acp.NewSessionResponse> {
    const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    this.sessions.set(sessionId, { pendingPrompt: null });
    return { sessionId };
  }

  async authenticate(
    _params: acp.AuthenticateRequest,
  ): Promise<acp.AuthenticateResponse | void> {
    return {}; // No auth needed
  }

  async setSessionMode(
    _params: acp.SetSessionModeRequest,
  ): Promise<acp.SetSessionModeResponse> {
    return {};
  }

  async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new Error(`Session not found: ${params.sessionId}`);

    const controller = new AbortController();
    session.pendingPrompt = controller;

    try {
      // Stream a response back
      await this.connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Hello from the agent!" },
        },
      });

      await this.connection.sessionUpdate({
        sessionId: params.sessionId,
        update: {
          sessionUpdate: "finish",
          stopReason: "end_turn",
        },
      });
    } finally {
      session.pendingPrompt = null;
    }

    return {};
  }

  async cancel(params: acp.CancelNotification): Promise<void> {
    const session = this.sessions.get(params.sessionId);
    session?.pendingPrompt?.abort();
  }
}

// Entry point
const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

const connection = new acp.AgentSideConnection(
  (conn) => new ExampleAgent(conn),
  stream,
);

await connection.closed;
```

---

## Complete Client Example

```typescript
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";

class ExampleClient implements acp.Client {
  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    // Present permission options to user and return selection
    const selectedOption = params.options[0]; // simplified: auto-select first
    return {
      outcome: {
        outcome: "selected",
        optionId: selectedOption.optionId,
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        if (update.content.type === "text") {
          process.stdout.write(update.content.text);
        }
        break;
      case "finish":
        console.log("\n[Done]");
        break;
      default:
        // Handle other update types as needed
        break;
    }
  }
}

// Spawn the agent process
const agentProcess = spawn("node", ["./agent.js"], {
  stdio: ["pipe", "pipe", "inherit"],
});

const stream = acp.ndJsonStream(
  Writable.toWeb(agentProcess.stdin) as WritableStream<Uint8Array>,
  Readable.toWeb(agentProcess.stdout) as ReadableStream<Uint8Array>,
);

const connection = new acp.ClientSideConnection(
  (_conn) => new ExampleClient(),
  stream,
);

// Protocol handshake
const initResponse = await connection.initialize({
  protocolVersion: acp.PROTOCOL_VERSION,
  clientInfo: { name: "my-client", version: "1.0.0" },
  clientCapabilities: {},
});

console.log("Agent capabilities:", initResponse.agentCapabilities);

// Create a session
const { sessionId } = await connection.newSession({});

// Send a prompt (responses arrive via sessionUpdate callbacks)
await connection.prompt({
  sessionId,
  messages: [
    { role: "user", content: [{ type: "text", text: "Hello, agent!" }] },
  ],
});
```

---

## Session Update Reference

The `sessionUpdate` field discriminates the update type:

| `sessionUpdate` value | Description |
|---|---|
| `"agent_message_chunk"` | Streaming content from agent (text, image, etc.) |
| `"finish"` | Agent done with response |
| `"available_commands"` | Agent reporting available commands/tools |
| `"current_mode"` | Session mode changed |
| `"config_option"` | Config option updated |

---

## AgentCapabilities Fields

Returned in `InitializeResponse` from the agent:

```typescript
interface AgentCapabilities {
  loadSession?: boolean;       // Agent supports restoring sessions
  filesystem?: FileSystemCapabilities;  // File read/write support
  auth?: AuthCapabilities;     // Authentication methods supported
  mcp?: McpCapabilities;       // MCP server integration
  prompt?: PromptCapabilities; // Prompt features (threading, etc.)
}
```

---

## Production Reference

For a complete production implementation, see [Gemini CLI's ACP integration](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/zed-integration/zedIntegration.ts).

- [TypeScript API Docs](https://agentclientprotocol.github.io/typescript-sdk)
- [NPM Package](https://www.npmjs.com/package/@agentclientprotocol/sdk)
- [GitHub Repository](https://github.com/agentclientprotocol/typescript-sdk)
- [Protocol Documentation](https://agentclientprotocol.com)
