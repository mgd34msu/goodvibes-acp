# ACP Initialization — Detailed Reference

The initialization phase is mandatory before any session can be created. It establishes protocol version compatibility and capability negotiation between Client and Agent.

---

## Sequence

```
Client                                    Agent
  |                                         |
  |  (connection established: stdin/stdout) |
  |                                         |
  |--- initialize (request, id=0) -------->|
  |                                         |  Validate protocolVersion
  |                                         |  Choose capabilities
  |                                         |  Determine auth requirements
  |<-- initialize (response, id=0) --------|  
  |                                         |
  |  [if authMethods is non-empty]          |
  |--- authenticate (request) ------------>|
  |<-- authenticate (response) ------------|  
  |                                         |
  |  [Ready for session/new or session/load]|
```

---

## Initialize Request

Client sends first. **MUST** be the first message on the connection.

### Wire Format

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true
    },
    "clientInfo": {
      "name": "my-client",
      "title": "My Client",
      "version": "1.0.0"
    }
  }
}
```

### TypeScript Type

```typescript
interface InitializeParams {
  /** Latest protocol MAJOR version the client supports */
  protocolVersion: number;

  /** What the client can provide to the agent */
  clientCapabilities: ClientCapabilities;

  /** Optional: identifies the client software */
  clientInfo?: {
    name: string;     // machine-readable identifier, e.g. "zed"
    title: string;    // human-readable display name, e.g. "Zed Editor"
    version: string;  // semver string
  };
}

interface ClientCapabilities {
  /** Client implements fs/read_text_file and/or fs/write_text_file */
  fs?: {
    readTextFile?: boolean;
    writeTextFile?: boolean;
  };
  /** Client implements terminal/* methods */
  terminal?: boolean;
}
```

### Field Notes

- `id: 0` — convention is to use 0 for initialize; must be unique per connection
- `protocolVersion` — send the HIGHEST version you support; agent will negotiate down
- `clientInfo` — SHOULD be provided; helps agents log/debug which client is connected
- `clientCapabilities.fs` — omit entirely if client doesn't implement file methods
- `clientCapabilities.terminal` — omit or set false if client has no terminal support

---

## Initialize Response

Agent replies synchronously. **MUST** respond before any other messages.

### Wire Format (full, all fields)

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": {
        "image": true,
        "audio": false,
        "embeddedContext": true
      },
      "mcp": {
        "http": true,
        "sse": true
      },
      "sessionCapabilities": {
        "fork": false,
        "list": false,
        "resume": false
      }
    },
    "agentInfo": {
      "name": "my-agent",
      "title": "My Agent",
      "version": "1.0.0"
    },
    "authMethods": []
  }
}
```

### Minimal Response (only required fields)

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {},
    "authMethods": []
  }
}
```

### TypeScript Type

```typescript
interface InitializeResult {
  /** Chosen protocol version — MUST be <= client's requested version */
  protocolVersion: number;

  /** What the agent supports */
  agentCapabilities: AgentCapabilities;

  /** Optional: identifies the agent software */
  agentInfo?: {
    name: string;     // machine-readable, e.g. "goodvibes"
    title: string;    // display name, e.g. "GoodVibes Runtime"
    version: string;  // semver string
  };

  /**
   * Auth methods this agent accepts.
   * Empty array = no auth required.
   * Required for ACP registry listing.
   */
  authMethods: AuthMethod[];
}

interface AgentCapabilities {
  /** Agent can resume sessions via session/load */
  loadSession?: boolean;

  /** What content types the agent accepts in session/prompt */
  promptCapabilities?: {
    image?: boolean;           // accepts image/* content parts
    audio?: boolean;           // accepts audio/* content parts
    embeddedContext?: boolean; // accepts embeddedContext items in prompt
  };

  /** MCP transport protocols the agent supports */
  mcp?: {
    http?: boolean;            // can connect to HTTP MCP servers
    sse?: boolean;             // can connect to SSE MCP servers
  };

  /** Unstable session management features */
  sessionCapabilities?: {
    fork?: boolean;            // supports session/fork
    list?: boolean;            // supports session/list  
    resume?: boolean;          // supports session/resume
  };
}
```

---

## Protocol Version Negotiation

```typescript
// Protocol version rules:
// - Client sends HIGHEST version it supports
// - Agent MUST respond with version <= client's version
// - If agent can't support any client version → error
// - Version is a single integer (MAJOR only)
// - Only incremented on breaking changes

// Current version: 1
// Version 1 is the only stable version as of SDK v0.15.0

// Version mismatch handling:
if (response.protocolVersion > request.params.protocolVersion) {
  // Agent sent higher version than client supports — fatal error
  throw new Error('Agent sent unsupported protocol version');
}

if (response.protocolVersion < MINIMUM_SUPPORTED_VERSION) {
  // Agent version too old — fatal error
  throw new Error('Agent protocol version too old');
}
```

---

## Authentication Flow

### When Authentication is Required

If `authMethods` in the initialize response is non-empty, the Client **MUST** authenticate before creating sessions.

```json
// initialize response with auth requirement:
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {},
    "authMethods": [
      { "type": "token", "description": "API key authentication" }
    ]
  }
}
```

### Authenticate Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "authenticate",
  "params": {
    "method": "token",
    "credentials": {
      "token": "sk-..."
    }
  }
}
```

### Authenticate Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "success": true
  }
}
```

### No Auth Required

When `authMethods: []`, skip directly to `session/new` after `initialize`.

---

## Capability Gating: What Each Capability Unlocks

### Agent declares `loadSession: true`

Client may call `session/load` to resume existing sessions:
```json
{"jsonrpc":"2.0","id":2,"method":"session/load","params":{"sessionId":"sess_abc"}}
```

If agent does NOT declare this, client must always call `session/new`.

### Agent declares `promptCapabilities.image: true`

Client may include image parts in prompts:
```json
{
  "content": [
    {"type": "text", "text": "What's in this image?"},
    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "..."}}
  ]
}
```

### Agent declares `promptCapabilities.embeddedContext: true`

Client may attach editor context items (e.g. currently open files, selected text):
```json
{
  "content": [...],
  "embeddedContext": [
    {"type": "file", "path": "src/auth.ts", "content": "export class Auth { ... }"},
    {"type": "selection", "path": "src/main.ts", "startLine": 10, "endLine": 20, "content": "..."}
  ]
}
```

### Agent declares `mcp.http: true` or `mcp.sse: true`

Client may include HTTP or SSE MCP servers in `session/new`:
```json
{
  "mcpServers": [
    {"name": "remote-server", "url": "https://mcp.example.com", "type": "http"}
  ]
}
```

Without this capability, client should only provide stdio MCP servers.

### Client declares `fs.readTextFile: true`

Agent may call `fs/read_text_file` during prompt processing:
```json
{"jsonrpc":"2.0","id":99,"method":"fs/read_text_file","params":{"path":"src/auth.ts"}}
```

This goes through the editor, meaning it picks up unsaved changes.

### Client declares `fs.writeTextFile: true`

Agent may call `fs/write_text_file` to write files through the editor.

### Client declares `terminal: true`

Agent may create and control terminal sessions:
```json
{"jsonrpc":"2.0","id":100,"method":"terminal/create","params":{"cwd":"/project","cmd":"npm test","args":[]}}
```

---

## TypeScript SDK: Implementing Initialize

### Agent Side

```typescript
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import type { InitializeParams, InitializeResult } from '@agentclientprotocol/sdk';

class MyAgent {
  constructor(private conn: AgentSideConnection) {}

  // SDK calls this when Client sends initialize
  async onInitialize(params: InitializeParams): Promise<InitializeResult> {
    // Log what client supports — determines which client methods you can call
    const clientHasFs = params.clientCapabilities.fs?.readTextFile;
    const clientHasTerminal = params.clientCapabilities.terminal;
    
    console.error(`Client: ${params.clientInfo?.name} v${params.clientInfo?.version}`);
    console.error(`Client fs: ${clientHasFs}, terminal: ${clientHasTerminal}`);

    return {
      protocolVersion: params.protocolVersion, // echo back (or negotiate down)
      agentCapabilities: {
        loadSession: true,
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: true,
        },
        mcp: {
          http: true,
          sse: true,
        },
      },
      agentInfo: {
        name: 'goodvibes',
        title: 'GoodVibes Runtime',
        version: '1.0.0',
      },
      authMethods: [], // [] = no auth required
    };
  }
}

// Entry point:
const conn = new AgentSideConnection(
  (conn) => new MyAgent(conn),
  ndJsonStream(process.stdout, process.stdin)
);

// Note: process.stdin/stdout need to be in binary mode:
// process.stdin is already a ReadableStream<Uint8Array>
// process.stdout is already a WritableStream<Uint8Array>
```

### Client Side

```typescript
import { ClientSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import { spawn } from 'node:child_process';

// Spawn agent subprocess:
const agentProcess = spawn('node', ['agent.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Create connection:
const conn = new ClientSideConnection(
  (agent) => new MyClient(agent),
  ndJsonStream(
    agentProcess.stdin,   // WritableStream to agent's stdin
    agentProcess.stdout   // ReadableStream from agent's stdout
  )
);

// Initialize:
const initResult = await conn.initialize({
  protocolVersion: 1,
  clientCapabilities: {
    fs: {
      readTextFile: true,
      writeTextFile: true,
    },
    terminal: true,
  },
  clientInfo: {
    name: 'my-editor',
    title: 'My Editor',
    version: '2.0.0',
  },
});

console.log('Agent version:', initResult.agentInfo?.version);
console.log('Agent can load sessions:', initResult.agentCapabilities.loadSession);
console.log('Auth required:', initResult.authMethods.length > 0);

// If auth required:
if (initResult.authMethods.length > 0) {
  await conn.authenticate({
    method: initResult.authMethods[0].type,
    credentials: { token: process.env.AGENT_API_KEY }
  });
}

// Ready for session/new
```

---

## Error Handling

### Protocol Version Mismatch

If Client and Agent cannot agree on a version, Agent returns a JSON-RPC error:

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "error": {
    "code": -32600,
    "message": "Unsupported protocol version",
    "data": {
      "requestedVersion": 2,
      "supportedVersions": [1]
    }
  }
}
```

### Standard JSON-RPC Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid Request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| -32000 to -32099 | Implementation-defined server errors |

---

## Implementation Checklist

For an ACP agent implementing initialize:

- [ ] Agent reads from stdin, writes to stdout (never mix up directions)
- [ ] Agent must not write anything to stdout before receiving `initialize`
- [ ] Agent responds to `initialize` before processing any other messages
- [ ] `protocolVersion` in response must be <= version in request
- [ ] `authMethods` must be `[]` if no auth required (not omitted)
- [ ] Agent logs client capabilities to stderr (not stdout) for debugging
- [ ] Store client capabilities — they gate which client methods you can call later
- [ ] Handle `clientInfo` being absent (it's optional per spec)
- [ ] If supporting registry listing, `authMethods` must be non-empty or explicitly empty

---

## Capability Decision Matrix

What to declare based on what you've implemented:

| You implement... | Declare in agentCapabilities |
|-----------------|------------------------------|
| `session/load` handler | `loadSession: true` |
| Image handling in prompts | `promptCapabilities.image: true` |
| Audio handling in prompts | `promptCapabilities.audio: true` |
| embeddedContext handling | `promptCapabilities.embeddedContext: true` |
| HTTP MCP server connection | `mcp.http: true` |
| SSE MCP server connection | `mcp.sse: true` |
| `session/fork` handler | `sessionCapabilities.fork: true` |
| `session/list` handler | `sessionCapabilities.list: true` |
| `session/resume` handler | `sessionCapabilities.resume: true` |

| Client implements... | Declare in clientCapabilities |
|--------------------|-------------------------------|
| `fs/read_text_file` | `fs.readTextFile: true` |
| `fs/write_text_file` | `fs.writeTextFile: true` |
| `terminal/*` methods | `terminal: true` |

**Rule**: Only declare what you actually implement. Declaring a capability you don't implement will cause the other side to call methods that don't exist.
