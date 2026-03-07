# 10 — GoodVibes ACP Agent: Implementation Guide

This is the implementation guide for `src/extensions/acp/` (Layer 2 in ARCHITECTURE.md). Start here. Everything else is reference material.

**SDK**: `@agentclientprotocol/sdk` v0.15.0  
**Runtime**: Bun (or Node.js 20+ ESM)  
**Layer**: L2 Extensions — imports L0 types and L1 core primitives only

---

## 1. Quick Start

Minimum working ACP agent — accepts a connection, responds to one prompt:

```typescript
#!/usr/bin/env bun
import * as acp from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';

class MinimalAgent implements acp.Agent {
  constructor(private conn: acp.AgentSideConnection) {}

  async initialize(_p: acp.InitializeRequest): Promise<acp.InitializeResponse> {
    return { protocolVersion: acp.PROTOCOL_VERSION, agentCapabilities: {} };
  }

  async newSession(_p: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
    return { sessionId: crypto.randomUUID() };
  }

  async authenticate(_p: acp.AuthenticateRequest): Promise<void> {}

  async prompt(p: acp.PromptRequest): Promise<acp.PromptResponse> {
    await this.conn.sessionUpdate({
      sessionId: p.sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello.' } },
    });
    await this.conn.sessionUpdate({
      sessionId: p.sessionId,
      update: { sessionUpdate: 'finish', stopReason: 'end_turn' },
    });
    return {};
  }

  async cancel(_p: acp.CancelNotification): Promise<void> {}
}

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

const conn = new acp.AgentSideConnection((c) => new MinimalAgent(c), stream);
await conn.closed;
```

This is the skeleton. Each section below replaces one piece with the production version.

---

## 2. Project Setup

```bash
# Using bun (recommended)
bun init -y
bun add @agentclientprotocol/sdk zod
```

**`package.json`** — must be ESM:
```json
{
  "name": "goodvibes-acp",
  "type": "module",
  "scripts": {
    "start": "bun run src/main.ts",
    "build": "tsc --project tsconfig.l2.json"
  }
}
```

**`tsconfig.json`** (base for L2):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "paths": {
      "@l0/*": ["src/types/*"],
      "@l1/*": ["src/core/*"],
      "@l2/*": ["src/extensions/*"]
    }
  }
}
```

**Entry point** `src/main.ts` starts the agent:
```typescript
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { GoodVibesAgent } from './extensions/acp/agent.js';

const stream = acp.ndJsonStream(
  Writable.toWeb(process.stdout) as WritableStream<Uint8Array>,
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

const conn = new acp.AgentSideConnection(
  (c) => new GoodVibesAgent(c),
  stream,
);

await conn.closed;
```

See `09-typescript-sdk.md` for full ndJsonStream/stream type reference.

---

## 3. Agent Factory Pattern

`AgentSideConnection` takes a factory `(conn) => Agent`. Your agent class holds a reference to the connection to make outbound calls (sessionUpdate, requestPermission, etc.).

This implements `src/extensions/acp/agent.ts` from ARCHITECTURE.md:

```typescript
// src/extensions/acp/agent.ts
import * as acp from '@agentclientprotocol/sdk';
import type { SessionManager } from '@l2/sessions/manager.js';
import type { Registry } from '@l1/registry.js';

// ClientCapabilities stored at initialize time — gates which client methods you can call
interface AgentState {
  clientCapabilities: acp.ClientCapabilities;
  sessions: Map<string, SessionContext>;
}

interface SessionContext {
  sessionId: string;
  cwd: string;
  cancelController: AbortController | null;
}

export class GoodVibesAgent implements acp.Agent {
  private state: AgentState = {
    clientCapabilities: {},
    sessions: new Map(),
  };

  constructor(
    private conn: acp.AgentSideConnection,
    private sessionManager: SessionManager,
    private registry: Registry,
  ) {}

  // All methods below — each section fills one in
}
```

**Key rule**: Store `clientCapabilities` from `initialize`. Every `conn.readTextFile()` / `conn.createTerminal()` call must be guarded by checking the stored capabilities first. See `02-initialization.md` for the capability decision matrix.

---

## 4. Session Management

Implements `session/new` and `session/load`. Maps to `src/extensions/sessions/manager.ts` from ARCHITECTURE.md.

See `03-sessions.md` for full wire format and configOptions system.

```typescript
async initialize(params: acp.InitializeRequest): Promise<acp.InitializeResponse> {
  // Store capabilities — used in every subsequent method
  this.state.clientCapabilities = params.clientCapabilities ?? {};

  return {
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: {
      loadSession: true,
      mcp: { http: true, sse: false },
    },
    agentInfo: {
      name: 'goodvibes',
      version: '1.0.0',
    },
  };
}

async authenticate(_params: acp.AuthenticateRequest): Promise<void> {
  // No auth required — authMethods: [] returned (not shown above, SDK handles it)
}

async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
  const sessionId = crypto.randomUUID();
  const cwd = params.workspaceRoots?.[0] ?? process.cwd();

  // Create L2 session
  await this.sessionManager.create({ sessionId, cwd });

  // Connect MCP servers passed by client (see section 11)
  if (params.mcpServers?.length) {
    await this.connectMcpServers(sessionId, params.mcpServers);
  }

  this.state.sessions.set(sessionId, {
    sessionId,
    cwd,
    cancelController: null,
  });

  return {
    sessionId,
    configOptions: this.buildConfigOptions(sessionId),
  };
}

async loadSession(params: acp.LoadSessionRequest): Promise<acp.LoadSessionResponse> {
  const { sessionId } = params;
  const cwd = params.workspaceRoots?.[0] ?? process.cwd();

  const history = await this.sessionManager.load(sessionId);

  // Replay full history as session/update notifications BEFORE responding
  // This is required by the protocol — see 03-sessions.md
  for (const entry of history) {
    await this.conn.sessionUpdate({
      sessionId,
      update: entry.role === 'user'
        ? { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: entry.content } }
        : { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: entry.content } },
    });
  }

  // Reconnect MCP servers
  if (params.mcpServers?.length) {
    await this.connectMcpServers(sessionId, params.mcpServers);
  }

  this.state.sessions.set(sessionId, { sessionId, cwd, cancelController: null });
  return {};
}
```

**Protocol note**: `session/load` must replay all history via `session/update` notifications before the response. The client rebuilds its UI from this stream. See `03-sessions.md` → Session Persistence and Resumption.

---

## 5. Prompt Handling

Implements `session/prompt`. This is the heart of the agent — receives user input, runs the WRFC chain, streams updates, returns stopReason.

See `04-prompt-turn.md` for the full update type reference and stop reasons.

```typescript
async prompt(params: acp.PromptRequest): Promise<acp.PromptResponse> {
  const { sessionId, messages } = params;
  const ctx = this.state.sessions.get(sessionId);
  if (!ctx) throw new Error(`Unknown session: ${sessionId}`);

  const controller = new AbortController();
  ctx.cancelController = controller;

  try {
    // Extract text from the prompt message
    const userText = messages
      .flatMap(m => m.content)
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join(' ');

    // Emit informational update (optional)
    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'session_info', content: { type: 'text', text: 'Starting task...' } },
    });

    // Run the WRFC chain — see section 6
    await this.runWRFC(sessionId, userText, controller.signal);

    // Signal completion
    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'finish', stopReason: 'end_turn' },
    });

    return {};

  } catch (err) {
    if (controller.signal.aborted) {
      await this.conn.sessionUpdate({
        sessionId,
        update: { sessionUpdate: 'finish', stopReason: 'cancelled' },
      });
      return {};
    }
    // Surface unexpected errors as agent message + finish
    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `Error: ${(err as Error).message}` } },
    });
    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'finish', stopReason: 'end_turn' },
    });
    return {};
  } finally {
    ctx.cancelController = null;
  }
}

async cancel(params: acp.CancelNotification): Promise<void> {
  const ctx = this.state.sessions.get(params.sessionId);
  ctx?.cancelController?.abort();
}

async setSessionMode(params: acp.SetSessionModeRequest): Promise<void> {
  // Delegate to config adapter — see section 9
  await this.sessionManager.setMode(params.sessionId, params.mode);
}

async setSessionConfigOption(
  params: acp.SetSessionConfigOptionRequest
): Promise<acp.SetSessionConfigOptionResponse> {
  await this.sessionManager.setConfigOption(params.sessionId, params.id, params.value);
  return { configOptions: this.buildConfigOptions(params.sessionId) };
}
```

**Stop reasons**: Return `'end_turn'` on success, `'cancelled'` when aborted. Catch API aborts and return `'cancelled'` — never let them surface as JSON-RPC errors. See `04-prompt-turn.md` → Stop Reasons.

---

## 6. WRFC as Tool Calls

This is the key innovation. Each WRFC phase (Work, Review, Fix, Check) maps to an ACP `tool_call` update sequence with `_meta` payloads carrying GoodVibes-specific data.

From ARCHITECTURE.md → WRFC ↔ ACP Mapping:

```
goodvibes_work    pending → running → completed
goodvibes_review  pending → running → completed  (_meta: score, dimensions)
goodvibes_fix     pending → running → completed  (_meta: attempt, issues)
```

Each WRFC chain is a single ACP prompt turn. The ACP client sees tool invocations with meaningful names instead of abstract phase updates.

```typescript
private async runWRFC(
  sessionId: string,
  task: string,
  signal: AbortSignal,
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  const MIN_SCORE = 7.0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) return;

    // --- WORK PHASE ---
    const workId = `goodvibes_work_${attempt}_${Date.now()}`;

    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: workId,
        title: attempt === 1 ? 'Working on task' : `Fixing issues (attempt ${attempt})`,
        kind: 'other',
        status: 'pending',
        _meta: { '_goodvibes/attempt': attempt, '_goodvibes/phase': 'work' },
      },
    });

    // Request permission for file writes if in 'ask' mode
    const mode = await this.sessionManager.getMode(sessionId);
    if (mode === 'justvibes') {
      const { outcome } = await this.conn.requestPermission({
        sessionId,
        toolCall: { title: `Execute task: ${task.slice(0, 80)}` },
        options: [
          { optionId: 'allow', kind: 'always_allow', title: 'Allow' },
          { optionId: 'deny', kind: 'deny', title: 'Deny' },
        ],
      });
      if (outcome.outcome !== 'selected' || outcome.optionId === 'deny') {
        await this.updateToolCall(sessionId, workId, 'failed', 'Permission denied', { '_goodvibes/phase': 'work' });
        return;
      }
    }

    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call_update', toolCallId: workId, status: 'running' },
    });

    // Dispatch to L1 registry → L3 agents/spawner
    const spawner = this.registry.get<IAgentSpawner>('agent_spawner');
    const agentHandle = await spawner.spawn({
      type: attempt === 1 ? 'engineer' : 'fixer',
      task,
      sessionId,
      signal,
    });
    const workResult = await spawner.result(agentHandle);

    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: workId,
        status: workResult.success ? 'completed' : 'failed',
        content: [{ type: 'text', text: workResult.summary }],
        locations: workResult.filesModified.map(f => ({ path: f })),
        _meta: {
          '_goodvibes/phase': 'work',
          '_goodvibes/files': workResult.filesModified,
        },
      },
    });

    if (!workResult.success) break;

    // --- REVIEW PHASE ---
    const reviewId = `goodvibes_review_${attempt}_${Date.now()}`;

    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: reviewId,
        title: 'Reviewing implementation',
        kind: 'think',
        status: 'pending',
        _meta: { '_goodvibes/phase': 'review', '_goodvibes/attempt': attempt },
      },
    });

    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call_update', toolCallId: reviewId, status: 'running' },
    });

    const reviewer = this.registry.get<IReviewer>('reviewer');
    const reviewResult = await reviewer.review(workResult);

    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId: reviewId,
        status: 'completed',
        content: [{ type: 'text', text: `Score: ${reviewResult.score.toFixed(1)}/10` }],
        _meta: {
          '_goodvibes/phase': 'review',
          '_goodvibes/score': reviewResult.score,
          '_goodvibes/minimumScore': MIN_SCORE,
          '_goodvibes/dimensions': reviewResult.dimensions,
        },
      },
    });

    if (reviewResult.score >= MIN_SCORE) return; // Done!
    if (attempt === MAX_ATTEMPTS) break;          // Exhausted attempts

    // --- FIX PHASE ---
    const fixId = `goodvibes_fix_${attempt}_${Date.now()}`;
    task = this.buildFixTask(task, reviewResult); // enrich task with review feedback

    await this.conn.sessionUpdate({
      sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId: fixId,
        title: 'Preparing fix',
        kind: 'other',
        status: 'pending',
        _meta: { '_goodvibes/phase': 'fix', '_goodvibes/attempt': attempt, '_goodvibes/issues': reviewResult.issues },
      },
    });
    await this.conn.sessionUpdate({
      sessionId,
      update: { sessionUpdate: 'tool_call_update', toolCallId: fixId, status: 'completed' },
    });
  }
}

private async updateToolCall(
  sessionId: string,
  toolCallId: string,
  status: 'completed' | 'failed',
  text: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await this.conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status,
      content: [{ type: 'text', text }],
      _meta: meta,
    },
  });
}

private buildFixTask(originalTask: string, reviewResult: ReviewResult): string {
  const issues = reviewResult.issues.map(i => `- ${i}`).join('\n');
  return `${originalTask}\n\nFix these review issues:\n${issues}`;
}
```

See `04-prompt-turn.md` → tool_call and tool_call_update for full update shape reference.  
See `05-permissions.md` for the `requestPermission` call pattern.  
The `_meta` keys must use the `_goodvibes/` namespace prefix per `08-extensibility.md`.

---

## 7. File System Bridge

Implements `ITextFileAccess` using ACP client fs methods, with fallback to direct disk access.

This implements `src/extensions/acp/session-adapter.ts` from ARCHITECTURE.md — specifically the dual-path file system pattern.

See `07-filesystem-terminal.md` for full method reference.

```typescript
// src/extensions/acp/fs-bridge.ts
import * as acp from '@agentclientprotocol/sdk';
import { readFile, writeFile } from 'node:fs/promises';
import type { ITextFileAccess } from '@l0/registry.js';

export class AcpFileSystem implements ITextFileAccess {
  constructor(
    private conn: acp.AgentSideConnection,
    private sessionId: string,
    private clientCapabilities: acp.ClientCapabilities,
  ) {}

  async readTextFile(
    path: string,
    options?: { line?: number; limit?: number },
  ): Promise<string> {
    if (this.clientCapabilities.filesystem?.readTextFile) {
      // ACP path: routes through editor, sees unsaved buffer state
      const result = await this.conn.readTextFile({
        sessionId: this.sessionId,
        path,
        // Note: SDK v0.15 readTextFile params may vary — check types
      });
      return result.text;
    }
    // Fallback: direct disk read
    return readFile(path, 'utf-8');
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    if (this.clientCapabilities.filesystem?.writeTextFile) {
      // ACP path: notifies editor, triggers LSP reanalysis
      await this.conn.writeTextFile({
        sessionId: this.sessionId,
        path,
        text: content,
      });
      return;
    }
    // Fallback: direct disk write
    await writeFile(path, content, 'utf-8');
  }
}
```

Register into L1 registry at session creation:

```typescript
// In newSession:
const fs = new AcpFileSystem(this.conn, sessionId, this.state.clientCapabilities);
this.registry.registerScoped<ITextFileAccess>('fs', sessionId, fs);
```

**When to use ACP fs vs. precision tools**: ACP `fs/*` is for editor-aware reads/writes (sees unsaved buffers, notifies editor). The precision engine (`precision_read`/`precision_write`) accesses disk directly with extract modes, caching, and batching. They coexist — use ACP fs for user-facing file operations, precision tools for internal processing. See ARCHITECTURE.md → Dual-Path File System.

---

## 8. Terminal Bridge

Implements `ITerminal` using ACP client terminal methods, with fallback to direct process spawning.

See `07-filesystem-terminal.md` → Mapping to ITerminal for the full interface pattern.

```typescript
// src/extensions/acp/terminal-bridge.ts
import * as acp from '@agentclientprotocol/sdk';
import { spawn } from 'node:child_process';
import type { ITerminal, TerminalHandle, ExitResult } from '@l0/registry.js';

export class AcpTerminal implements ITerminal {
  constructor(
    private conn: acp.AgentSideConnection,
    private sessionId: string,
    private clientCapabilities: acp.ClientCapabilities,
    private cwd: string,
  ) {}

  async create(command: string, args: string[] = []): Promise<TerminalHandle> {
    if (this.clientCapabilities.terminal) {
      // ACP path: terminal visible in editor UI
      const terminal = await this.conn.createTerminal({
        sessionId: this.sessionId,
        command,
        args,
        cwd: this.cwd,
      });
      return new AcpTerminalHandle(terminal);
    }
    // Fallback: headless process spawning
    return new DirectTerminalHandle(command, args, this.cwd);
  }

  async output(handle: TerminalHandle): Promise<string> {
    const result = await handle.currentOutput();
    return result.output ?? '';
  }

  async waitForExit(handle: TerminalHandle): Promise<ExitResult> {
    const result = await handle.waitForExit();
    return { exitCode: result.exitCode ?? 0 };
  }

  async kill(handle: TerminalHandle): Promise<void> {
    await handle.kill();
  }
}

class AcpTerminalHandle implements TerminalHandle {
  constructor(private terminal: acp.TerminalHandle) {}

  async currentOutput() { return this.terminal.currentOutput(); }
  async waitForExit() { return this.terminal.waitForExit(); }
  async kill() { return this.terminal.kill(); }
  async release() { return this.terminal.release(); }
}

// Direct fallback — spawns a headless process
class DirectTerminalHandle implements TerminalHandle {
  private child: ReturnType<typeof spawn>;
  private outputBuffer = '';
  private exitCode: number | null = null;
  private exitPromise: Promise<number>;

  constructor(command: string, args: string[], cwd: string) {
    this.child = spawn(command, args, { cwd, shell: true });
    this.child.stdout?.on('data', (d: Buffer) => { this.outputBuffer += d.toString(); });
    this.child.stderr?.on('data', (d: Buffer) => { this.outputBuffer += d.toString(); });
    this.exitPromise = new Promise(resolve => {
      this.child.on('exit', (code) => {
        this.exitCode = code ?? 0;
        resolve(this.exitCode);
      });
    });
  }

  async currentOutput() { return { output: this.outputBuffer, exitCode: this.exitCode }; }
  async waitForExit() { const code = await this.exitPromise; return { exitCode: code }; }
  async kill() { this.child.kill(); }
  async release() { /* nothing to release */ }
}
```

**When to use ACP terminal vs. precision_exec**: ACP terminal is for user-visible operations (build, test, deploy) that appear in the editor's terminal panel. `precision_exec` spawns processes directly with retry, background, and parallel support — use it for internal verification steps. See ARCHITECTURE.md → Dual-Path File System.

---

## 9. Config Options

Exposes GoodVibes operating modes as ACP `configOptions` in the `session/new` response. Implements `src/extensions/sessions/modes.ts` from ARCHITECTURE.md.

See `03-sessions.md` → Config Options System for the full interface and update semantics.

```typescript
// src/extensions/acp/config-adapter.ts
import type * as acp from '@agentclientprotocol/sdk';

export type GoodVibesMode = 'justvibes' | 'vibecoding' | 'sandbox';

export function buildConfigOptions(
  currentMode: GoodVibesMode = 'vibecoding',
  currentModel = 'claude-sonnet-4-5',
): acp.ConfigOption[] {
  return [
    {
      id: 'mode',
      name: 'GoodVibes Mode',
      description: 'Controls permission gates and automation level',
      category: 'mode',
      type: 'select',
      currentValue: currentMode,
      options: [
        {
          value: 'justvibes',
          name: 'Just Vibes',
          description: 'Ask before every action (safest)',
        },
        {
          value: 'vibecoding',
          name: 'Vibecoding',
          description: 'Auto-approve safe actions, ask for shell/delete/network',
        },
        {
          value: 'sandbox',
          name: 'Sandbox',
          description: 'Full automation, no permission gates (requires explicit opt-in)',
        },
      ],
    },
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: currentModel,
      options: [
        { value: 'claude-opus-4', name: 'Claude Opus 4', description: 'Most capable' },
        { value: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Balanced' },
        { value: 'claude-haiku-4', name: 'Claude Haiku 4', description: 'Fastest' },
      ],
    },
  ];
}

// Emit agent-initiated config update (e.g., mode auto-switched after planning):
export async function emitConfigUpdate(
  conn: acp.AgentSideConnection,
  sessionId: string,
  options: acp.ConfigOption[],
): Promise<void> {
  await conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'config_option',
      configOptions: options, // full state, not just the changed option
    },
  });
}
```

In `newSession`, return:
```typescript
return {
  sessionId,
  configOptions: buildConfigOptions(),  // starts in vibecoding by default
};
```

In `setSessionConfigOption`:
```typescript
async setSessionConfigOption(params) {
  const { id, value } = params;
  if (id === 'mode') {
    await this.sessionManager.setMode(params.sessionId, value as GoodVibesMode);
  }
  // Return complete config state (not just the changed option)
  const currentMode = await this.sessionManager.getMode(params.sessionId);
  return { configOptions: buildConfigOptions(currentMode) };
}
```

**Category `'mode'` is spec-reserved** — do not use custom categories without the `_` prefix. The `sandbox` mode requires explicit user opt-in; never activate it programmatically.

---

## 10. Extension Methods

Implements `_goodvibes/*` methods per `08-extensibility.md`. These let ACP clients query runtime state, events, and analytics.

From ARCHITECTURE.md → Observability:

| Method | Type | Purpose |
|--------|------|---------|
| `_goodvibes/status` | notification | WRFC phase, step counts (agent → client) |
| `_goodvibes/state` | request | Runtime state snapshot (client → agent) |
| `_goodvibes/events` | notification | Event bus stream (agent → client) |
| `_goodvibes/agents` | request | Active agent list (client → agent) |
| `_goodvibes/analytics` | request | Token budget/usage (client → agent) |
| `_goodvibes/directive` | notification | Inject directive (client → agent) |

```typescript
// Implement extMethod on your Agent class:
async extMethod(
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (method) {
    case '_goodvibes/state': {
      return {
        sessions: Array.from(this.state.sessions.keys()),
        activeSessions: this.state.sessions.size,
        version: '1.0.0',
        _meta: { version: '1.0.0' },  // always include _meta.version for forward compat
      };
    }

    case '_goodvibes/agents': {
      const sessionId = params.sessionId as string;
      const tracker = this.registry.get<IAgentTracker>('agent_tracker');
      return { agents: await tracker.list(sessionId) };
    }

    case '_goodvibes/analytics': {
      const analytics = this.registry.get<IAnalytics>('analytics');
      return analytics.query({
        sessionId: params.sessionId as string,
        scope: params.scope as 'session' | 'workflow' | 'agent',
      });
    }

    default:
      // Unknown extension methods MUST be handled gracefully — not crash
      console.warn(`Unknown extension method: ${method}`);
      return { error: 'unknown method' };
  }
}

async extNotification(
  method: string,
  params: Record<string, unknown>,
): Promise<void> {
  if (method === '_goodvibes/directive') {
    // Client is injecting a runtime directive
    const directiveQueue = this.registry.get<IDirectiveQueue>('directive_queue');
    await directiveQueue.enqueue(params);
  }
  // Ignore unknown notifications gracefully
}
```

Emit `_goodvibes/status` notifications proactively during WRFC runs:

```typescript
private async emitStatus(
  sessionId: string,
  phase: 'gather' | 'plan' | 'apply' | 'review' | 'complete' | 'failed',
  completed: number,
  total: number,
): Promise<void> {
  await this.conn.extNotification('_goodvibes/status', {
    sessionId,
    phase,
    completedSteps: completed,
    totalSteps: total,
  });
}
```

See `08-extensibility.md` for full wire formats of each method.

---

## 11. MCP Server Integration

ACP clients pass MCP server configuration in `session/new`. The agent connects to those servers and makes their tools available to the LLM.

See `06-tools-mcp.md` for the MCP tool call → ACP update mapping pattern.

```typescript
// src/extensions/acp/mcp-connector.ts
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { McpServer } from '@agentclientprotocol/sdk';

export interface ConnectedMcpServer {
  name: string;
  client: McpClient;
  tools: McpTool[];
}

export async function connectMcpServers(
  servers: McpServer[],
): Promise<ConnectedMcpServer[]> {
  return Promise.all(
    servers.map(async (server) => {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args ?? [],
        env: server.env ? Object.fromEntries(server.env.map(e => [e.name, e.value])) : undefined,
      });
      const client = new McpClient({ name: 'goodvibes', version: '1.0.0' }, {});
      await client.connect(transport);
      const { tools } = await client.listTools();
      return { name: server.name, client, tools };
    })
  );
}
```

When the LLM calls an MCP tool, bridge it through ACP tool_call updates:

```typescript
private async callMcpTool(
  sessionId: string,
  server: ConnectedMcpServer,
  toolName: string,
  toolInput: unknown,
): Promise<unknown> {
  const toolCallId = `mcp_${server.name}_${toolName}_${Date.now()}`;

  // Announce — pending
  await this.conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'tool_call',
      toolCallId,
      title: `${server.name}: ${toolName}`,
      kind: inferKind(toolName),
      status: 'pending',
    },
  });

  // Running
  await this.conn.sessionUpdate({
    sessionId,
    update: { sessionUpdate: 'tool_call_update', toolCallId, status: 'running' },
  });

  // Execute via MCP
  const result = await server.client.callTool({ name: toolName, arguments: toolInput as Record<string, unknown> });

  // Forward MCP content blocks directly to ACP (same ContentBlock schema)
  await this.conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId,
      status: result.isError ? 'failed' : 'completed',
      content: result.content,  // MCP ContentBlock[] is compatible with ACP
    },
  });

  return result;
}

function inferKind(toolName: string): acp.ToolCallKind {
  if (toolName.includes('read') || toolName.includes('get')) return 'read';
  if (toolName.includes('write') || toolName.includes('edit')) return 'edit';
  if (toolName.includes('exec') || toolName.includes('run')) return 'execute';
  if (toolName.includes('search') || toolName.includes('find')) return 'search';
  return 'other';
}
```

**MCP servers fail gracefully**: If a server fails to connect during `session/new`, log the failure but still return the session. Don't fail the whole session for one broken server.

---

## 12. Error Handling

Errors cross the ACP wire as JSON-RPC responses. Map GoodVibes errors to standard codes.

See `02-initialization.md` → Standard JSON-RPC Error Codes.

```typescript
// src/extensions/acp/errors.ts
export const ACP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Application-defined (use -32000 to -32099)
  SESSION_NOT_FOUND: -32000,
  SESSION_LOAD_FAILED: -32001,
  MCP_CONNECT_FAILED: -32002,
  PERMISSION_DENIED: -32003,
  AGENT_SPAWN_FAILED: -32004,
} as const;

export function toAcpError(err: unknown): { code: number; message: string; data?: unknown } {
  if (err instanceof SessionNotFoundError) {
    return { code: ACP_ERROR_CODES.SESSION_NOT_FOUND, message: err.message };
  }
  if (err instanceof ValidationError) {
    return { code: ACP_ERROR_CODES.INVALID_PARAMS, message: err.message, data: err.details };
  }
  // Unknown errors → internal error (never expose stack traces)
  console.error('Unhandled error:', err);
  return { code: ACP_ERROR_CODES.INTERNAL_ERROR, message: 'Internal error' };
}
```

The SDK handles the JSON-RPC envelope — you throw an error and the SDK wraps it. For known errors:

```typescript
async newSession(params: acp.NewSessionRequest): Promise<acp.NewSessionResponse> {
  try {
    // ...
  } catch (err) {
    // SDK will convert this thrown Error into a JSON-RPC error response
    throw new Error(`Session creation failed: ${(err as Error).message}`);
  }
}
```

For tool failures (not protocol errors) — use `tool_call_update` with `status: 'failed'` and put the error in `content`. This lets the client display it gracefully without showing a raw JSON-RPC error dialog.

From ARCHITECTURE.md → ACP Error Mapping:
- Plugin errors → code `-32000` (application error)
- Validation errors → code `-32602` (invalid params)
- Tool failures → `tool_call_update` status `'failed'` + error in `_meta`

---

## 13. Testing with Mock Client

Test your agent class in isolation using a mock that implements the `Client` interface and captures all output.

```typescript
// tests/extensions/acp/agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import * as acp from '@agentclientprotocol/sdk';

// Minimal mock client — captures sessionUpdates
class MockClient implements acp.Client {
  public updates: acp.SessionNotification[] = [];
  public permissionOutcome: 'allow' | 'deny' = 'allow';

  async requestPermission(
    params: acp.RequestPermissionRequest,
  ): Promise<acp.RequestPermissionResponse> {
    const option = params.options.find(o =>
      this.permissionOutcome === 'allow' ? o.kind !== 'deny' : o.kind === 'deny'
    ) ?? params.options[0];
    return { outcome: { outcome: 'selected', optionId: option.optionId } };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    this.updates.push(params);
  }

  async readTextFile(_p: acp.ReadTextFileRequest) { return { text: 'mock content' }; }
  async writeTextFile(_p: acp.WriteTextFileRequest) { return {}; }
}

describe('GoodVibesAgent', () => {
  it('completes a prompt turn with finish update', async () => {
    const client = new MockClient();
    const mockRegistry = createMockRegistry();
    const mockSessionManager = createMockSessionManager();

    const agent = new GoodVibesAgent(
      client as unknown as acp.AgentSideConnection, // cast — mock provides the same interface
      mockSessionManager,
      mockRegistry,
    );

    await agent.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: { filesystem: { readTextFile: true } },
    });

    const { sessionId } = await agent.newSession({ workspaceRoots: ['/tmp/test'] });

    await agent.prompt({
      sessionId,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Do something' }] }],
    });

    const finishUpdate = client.updates.find(
      u => u.update.sessionUpdate === 'finish'
    );
    expect(finishUpdate).toBeDefined();
    expect((finishUpdate!.update as { stopReason: string }).stopReason).toBe('end_turn');
  });

  it('returns cancelled stopReason on cancel', async () => {
    // ... test cancel flow
  });
});
```

**Integration test with real connection**: Use `ClientSideConnection` and spawn your agent as a subprocess to test the full ndjson wire protocol. See `09-typescript-sdk.md` → Complete Client Example for the subprocess spawn pattern.

---

## 14. Implementation Checklist

Build in this order — each item depends on the ones above it.

### Foundation (no ACP dependency)
- [ ] **L0**: Define `ITextFileAccess`, `ITerminal`, `IAgentSpawner`, `IReviewer` interfaces in `src/types/registry.ts`
- [ ] **L1**: Implement `Registry` — typed register/get/getAll
- [ ] **L1**: Implement `EventBus` — pub/sub with sessionId filtering
- [ ] **L1**: Implement `StateMachine` — generic FSM for WRFC states
- [ ] **L2**: Implement `SessionManager` — create/load/fork/list/destroy

### ACP Layer
- [ ] **Install SDK**: `bun add @agentclientprotocol/sdk zod`
- [ ] **agent.ts**: `GoodVibesAgent` class skeleton — implements `acp.Agent`
- [ ] **agent.ts `initialize()`**: Store client capabilities, return agent capabilities with `loadSession: true`
- [ ] **agent.ts `newSession()`**: Create L2 session, return sessionId + configOptions
- [ ] **agent.ts `loadSession()`**: Load history, replay as session/update notifications, return null
- [ ] **config-adapter.ts**: `buildConfigOptions()` returning justvibes/vibecoding/sandbox select
- [ ] **agent.ts `setSessionConfigOption()`**: Delegate to SessionManager, return full config state
- [ ] **agent.ts `prompt()`**: Receive prompt, call runWRFC, return `{}`
- [ ] **agent.ts `cancel()`**: Abort the active AbortController for the session

### WRFC Integration
- [ ] **L2/wrfc/machine.ts**: Build WRFC state machine on L1 StateMachine
- [ ] **agent.ts `runWRFC()`**: Emit `goodvibes_work/review/fix` tool_call updates through each phase
- [ ] **Permission gating**: `conn.requestPermission()` before destructive actions in justvibes mode

### Bridges
- [ ] **fs-bridge.ts**: `AcpFileSystem` implementing `ITextFileAccess`, guarded by clientCapabilities
- [ ] **terminal-bridge.ts**: `AcpTerminal`/`AcpTerminalHandle` implementing `ITerminal`
- [ ] **Register into L1 registry** at session creation: scoped per sessionId

### MCP Integration
- [ ] **mcp-connector.ts**: `connectMcpServers()` — connect each server, collect tools
- [ ] **Call in `newSession()`**: Connect before returning sessionId
- [ ] **`callMcpTool()`**: Bridge MCP tool calls to ACP tool_call update sequence
- [ ] **Graceful failure**: Single server failure must not abort the session

### Extension Methods
- [ ] **agent.ts `extMethod()`**: Handle `_goodvibes/state`, `_goodvibes/agents`, `_goodvibes/analytics`
- [ ] **agent.ts `extNotification()`**: Handle `_goodvibes/directive` — enqueue to directive queue
- [ ] **`emitStatus()`**: Call during WRFC state transitions

### Error Handling
- [ ] **errors.ts**: Define ACP_ERROR_CODES map
- [ ] **Wrap `newSession()`/`loadSession()`** in try/catch, re-throw with meaningful messages
- [ ] **Tool failures** → `tool_call_update` status `'failed'`, not thrown errors
- [ ] **Cancelled errors** → catch AbortError, return `stopReason: 'cancelled'`

### Bootstrap
- [ ] **main.ts**: `ndJsonStream` + `AgentSideConnection` entry point
- [ ] **main.ts**: Wire L1 Registry + L2 SessionManager into `GoodVibesAgent` factory
- [ ] **main.ts**: Register L3 plugins into L1 Registry before creating connection
- [ ] **Shutdown**: `conn.signal` abort triggers graceful teardown

---

## Cross-References

| Topic | File |
|-------|------|
| Protocol overview, JSON-RPC basics | `01-overview.md` |
| Initialize handshake, capability matrix | `02-initialization.md` |
| Session lifecycle, configOptions system | `03-sessions.md` |
| All session/update types, stop reasons | `04-prompt-turn.md` |
| Permission flow, mode-based gating | `05-permissions.md` |
| Tool call lifecycle, MCP integration | `06-tools-mcp.md` |
| fs/* and terminal/* method reference | `07-filesystem-terminal.md` |
| _meta, _goodvibes/* extension methods | `08-extensibility.md` |
| Full SDK API, type reference | `09-typescript-sdk.md` |
| Layer boundaries, dependency rules | `docs/ARCHITECTURE.md` |
