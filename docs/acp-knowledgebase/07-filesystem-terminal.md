# ACP Knowledgebase: File System & Terminal

## Overview

ACP provides two optional capability groups that let agents interact with the client's editor environment: **filesystem** (`fs/*`) and **terminal** (`terminal/*`). Both require capability negotiation at initialization and MUST NOT be called if the client hasn't declared support.

---

## Capability Negotiation

Agents MUST check `clientCapabilities` from the `initialize` response before calling any fs or terminal method.

```json
// initialize response (from client)
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": 1,
    "clientCapabilities": {
      "fs": {
        "readTextFile": true,
        "writeTextFile": true
      },
      "terminal": true
    }
  }
}
```

```typescript
// Guard before calling fs methods
if (!clientCapabilities.fs?.readTextFile) {
  throw new Error('Client does not support fs/read_text_file');
}

// Guard before calling terminal methods
if (!clientCapabilities.terminal) {
  throw new Error('Client does not support terminal methods');
}
```

---

## File System Methods

### Why ACP fs methods instead of direct disk access

ACP `fs/*` methods route through the **editor**, not the OS filesystem. This means:
- Read returns **unsaved buffer state** (what's in the editor, not what's on disk)
- Write notifies the editor so it can track dirty state, trigger LSP reanalysis, etc.
- The client can intercept, log, or audit all file operations during agent execution

For a standalone runtime that also needs direct disk access, both patterns apply: use ACP fs for editor-aware reads/writes, use direct fs for everything else.

---

### `fs/read_text_file`

Agent requests a file from the client. Client responds with file contents including any unsaved editor changes.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "fs/read_text_file",
  "params": {
    "sessionId": "sess_abc123def456",
    "path": "/home/user/project/src/main.py",
    "line": 10,
    "limit": 50
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Active session ID |
| `path` | string | yes | Absolute path to the file |
| `line` | number | no | 1-based line number to start reading from |
| `limit` | number | no | Maximum number of lines to return |

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": "def hello_world():\n    print('Hello, world!')\n"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | File contents (or partial contents if `line`/`limit` specified) |

**TypeScript (AgentSideConnection):**

```typescript
// Using AgentSideConnection helper
const result = await conn.readTextFile({
  sessionId: session.id,
  path: '/home/user/project/src/main.py',
  line: 10,
  limit: 50
});
console.log(result.content);
```

---

### `fs/write_text_file`

Agent writes or updates a file. Client writes the content to disk and can notify the editor.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "fs/write_text_file",
  "params": {
    "sessionId": "sess_abc123def456",
    "path": "/home/user/project/config.json",
    "content": "{\n  \"debug\": true,\n  \"version\": \"1.0.0\"\n}"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Active session ID |
| `path` | string | yes | Absolute path to write |
| `content` | string | yes | Full file content to write |

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {}
}
```

Empty result — success is indicated by absence of error.

**TypeScript (AgentSideConnection):**

```typescript
await conn.writeTextFile({
  sessionId: session.id,
  path: '/home/user/project/config.json',
  content: JSON.stringify({ debug: true, version: '1.0.0' }, null, 2)
});
```

---

### Mapping to `ITextFileAccess`

When implementing the GoodVibes ACP agent, `ITextFileAccess` maps directly to these two methods:

```typescript
interface ITextFileAccess {
  readTextFile(path: string, opts?: { line?: number; limit?: number }): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
}

class ACPTextFileAccess implements ITextFileAccess {
  constructor(private conn: AgentSideConnection, private sessionId: string) {}

  async readTextFile(path: string, opts?: { line?: number; limit?: number }): Promise<string> {
    const result = await this.conn.readTextFile({
      sessionId: this.sessionId,
      path,
      ...opts
    });
    return result.content;
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await this.conn.writeTextFile({
      sessionId: this.sessionId,
      path,
      content
    });
  }
}
```

**Key difference from precision_engine**: `precision_read`/`precision_write` access disk directly with caching, batching, and extract modes. ACP `fs/*` routes through the editor for buffer-aware access. They serve different purposes and should coexist.

---

## Terminal Methods

Terminal methods let agents create and control shell sessions in the client's terminal. This maps to what `precision_exec` does today, but routed through the editor's terminal instead of spawning processes directly.

Capability is a single boolean: `terminal: true` in `clientCapabilities`.

---

### `terminal/create`

Create a new terminal session in the client. Returns a `terminalId` for subsequent operations.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "terminal/create",
  "params": {
    "sessionId": "sess_abc123def456",
    "command": "npm run build",
    "env": {
      "NODE_ENV": "production"
    },
    "cwd": "/home/user/project"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Active session ID |
| `command` | string | no | Command to run (if omitted, opens interactive shell) |
| `env` | object | no | Environment variable overrides |
| `cwd` | string | no | Working directory (defaults to session cwd) |

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "terminalId": "term_xyz789"
  }
}
```

**TypeScript:**

```typescript
const { terminalId } = await conn.createTerminal({
  sessionId: session.id,
  command: 'npm run build',
  cwd: session.cwd
});
```

---

### `terminal/output`

Read buffered output from a terminal session.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "terminal/output",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789",
    "timeout": 5000
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | yes | Active session ID |
| `terminalId` | string | yes | Terminal ID from `terminal/create` |
| `timeout` | number | no | Max ms to wait for output |

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "output": "\u001b[32m✓\u001b[0m Build complete\n",
    "exitCode": null
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `output` | string | Terminal output (may include ANSI escape codes) |
| `exitCode` | number \| null | Process exit code, or null if still running |

---

### `terminal/wait_for_exit`

Block until the terminal process exits. Returns exit code.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "terminal/wait_for_exit",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789",
    "timeout": 60000
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "exitCode": 0
  }
}
```

---

### `terminal/kill`

Send a kill signal to a running terminal process.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "terminal/kill",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "result": {}
}
```

---

### `terminal/release`

Release a terminal session. Frees client-side resources. Call this when done with a terminal.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "terminal/release",
  "params": {
    "sessionId": "sess_abc123def456",
    "terminalId": "term_xyz789"
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "result": {}
}
```

---

### Mapping to `ITerminal`

```typescript
interface ITerminalSession {
  readonly terminalId: string;
  getOutput(timeout?: number): Promise<{ output: string; exitCode: number | null }>;
  waitForExit(timeout?: number): Promise<number>;
  kill(): Promise<void>;
  release(): Promise<void>;
}

interface ITerminal {
  create(opts: { command?: string; env?: Record<string, string>; cwd?: string }): Promise<ITerminalSession>;
}

class ACPTerminal implements ITerminal {
  constructor(private conn: AgentSideConnection, private sessionId: string) {}

  async create(opts: { command?: string; env?: Record<string, string>; cwd?: string }): Promise<ITerminalSession> {
    const { terminalId } = await this.conn.createTerminal({
      sessionId: this.sessionId,
      ...opts
    });
    return new ACPTerminalSession(this.conn, this.sessionId, terminalId);
  }
}

class ACPTerminalSession implements ITerminalSession {
  constructor(
    private conn: AgentSideConnection,
    private sessionId: string,
    readonly terminalId: string
  ) {}

  async getOutput(timeout?: number) {
    return this.conn.terminalOutput({ sessionId: this.sessionId, terminalId: this.terminalId, timeout });
  }

  async waitForExit(timeout?: number): Promise<number> {
    const result = await this.conn.terminalWaitForExit({ sessionId: this.sessionId, terminalId: this.terminalId, timeout });
    return result.exitCode;
  }

  async kill() {
    await this.conn.terminalKill({ sessionId: this.sessionId, terminalId: this.terminalId });
  }

  async release() {
    await this.conn.terminalRelease({ sessionId: this.sessionId, terminalId: this.terminalId });
  }
}
```

**Pattern: run a command and collect output**

```typescript
async function runCommand(terminal: ITerminal, command: string, cwd: string): Promise<{ output: string; exitCode: number }> {
  const session = await terminal.create({ command, cwd });
  try {
    const exitCode = await session.waitForExit(60_000);
    const { output } = await session.getOutput();
    return { output, exitCode };
  } finally {
    await session.release();
  }
}
```

**Key difference from precision_exec**: `precision_exec` spawns child processes directly inside the runtime. ACP `terminal/*` routes execution through the editor's terminal — visible to the user in the editor UI, subject to editor sandbox restrictions, and part of the client's session lifecycle.

---

## Error Handling

All methods return standard JSON-RPC 2.0 errors on failure:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32001,
    "message": "File not found",
    "data": { "path": "/home/user/project/missing.py" }
  }
}
```

Always guard with capability checks first — calling an unsupported method may result in either an error response or connection failure depending on client implementation.
