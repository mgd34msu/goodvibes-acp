# Subagent Spawning Design Document

**Status**: Proposed  
**Date**: 2026-03-07  
**Resolves**: ARCHITECTURE.md Open Question 1 — "Subagent spawning"  
**Companion**: `docs/ARCHITECTURE.md`

---

## 1. Problem Statement

### The Gap

ACP (Agent Client Protocol) has no native concept of "spawn a subagent." The protocol defines a single agent process that communicates with a single client over a JSON-RPC connection. There is no `session/spawn_agent` method, no agent-to-agent communication primitive, and no multi-agent orchestration mechanism.

### What GoodVibes Needs

The GoodVibes runtime orchestrates multiple parallel agent chains, each running an autonomous WRFC (Work → Review → Fix → Check) loop:

```
Orchestrator receives task
├── Decomposes into subtasks
├── Spawns Agent Chain 1 (engineer → reviewer → fixer → ...)
├── Spawns Agent Chain 2 (engineer → reviewer → fixer → ...)
├── Spawns Agent Chain N...
├── Waits for all chains to complete or escalate
└── Aggregates results, reports to client
```

Each agent chain requires:
- **LLM inference** — sending prompts with system instructions, tools, and context to a language model
- **Tool execution** — calling precision engine tools, MCP tools, and other IToolProvider implementations
- **State tracking** — managing WRFC state machine transitions, attempt counts, review scores
- **Quality gates** — enforcing minimum review scores and maximum attempt limits
- **Progress reporting** — emitting events for client visibility via ACP `session/update` notifications

### Current State

Today, Claude Code (the ACP client) acts as the orchestrator. It spawns subagent sessions directly via the Claude Agent SDK. The GoodVibes runtime (as an MCP plugin) can only observe agent lifecycle through Claude Code hooks (`SubagentStart`, `SubagentStop`) — it cannot initiate spawning.

The standalone ACP runtime must own this capability. The current codebase has:

| Component | File | Status |
|-----------|------|--------|
| Agent types (L0) | `src/types/agent.ts` | Complete — `AgentConfig`, `AgentHandle`, `AgentResult`, `AgentMetadata` |
| Agent spawner interface (L0) | `src/types/registry.ts` | Complete — `IAgentSpawner` with `spawn()`, `result()`, `cancel()`, `status()` |
| Agent spawner plugin (L3) | `src/plugins/agents/spawner.ts` | **Stub** — in-memory simulation with timers, no real LLM calls |
| Agent type configs (L3) | `src/plugins/agents/types.ts` | Complete — per-type system prompts, models, timeouts |
| Agent tracker (L2) | `src/extensions/agents/tracker.ts` | Complete — StateStore persistence, EventBus lifecycle events |
| Agent coordinator (L2) | `src/extensions/agents/coordinator.ts` | Complete — max parallel slots (default 6), queue overflow |
| WRFC orchestrator (L2) | `src/extensions/wrfc/orchestrator.ts` | Complete — drives WRFC loop using `IAgentSpawner`, `IReviewer`, `IFixer` |
| WRFC types (L0) | `src/types/wrfc.ts` | Complete — `WRFCState`, `WRFCContext`, `WRFCConfig` |

The only missing piece is the **real implementation** inside `AgentSpawnerPlugin` — replacing the timer-based stub with actual LLM inference and tool execution.

---

## 2. Options Analysis

### Option A: Direct Claude API Calls

The runtime calls the Anthropic Messages API directly to power each "agent." Each agent chain is an async function that maintains a conversation history and loops: send messages → receive response → parse tool_use blocks → execute tools → append results → repeat.

**Architecture**:
```
AgentSpawnerPlugin.spawn(config)
└── Creates async task:
    ├── Build system prompt from AgentTypeConfig
    ├── Loop:
    │   ├── Call Anthropic messages.create() with tools + history
    │   ├── Parse response for tool_use blocks
    │   ├── Execute tools via IToolProvider registry
    │   ├── Append tool results to history
    │   └── Check for end_turn / stop conditions
    └── Return AgentResult
```

**Pros**:
- Full control over model selection, parameters, token budgets per agent
- No external process overhead — everything runs in the same event loop
- Can customize system prompts, temperature, tool schemas per agent type
- Direct access to streaming for real-time progress updates
- Simple dependency: just the `@anthropic-ai/sdk` package

**Cons**:
- Requires Anthropic API key management and billing infrastructure
- Tightly coupled to Anthropic — switching to another LLM provider requires rewriting the spawner
- No MCP tool access unless manually wired (must build tool schema translation)
- Must implement conversation loop, tool parsing, and error handling from scratch
- No built-in sandboxing or resource limits for tool execution

---

### Option B: MCP Server Subprocess

Each subagent runs as a separate MCP server subprocess. The runtime spawns the process, connects via stdio, and communicates using MCP protocol. The subprocess runs its own LLM inference loop and exposes results as MCP resources.

**Architecture**:
```
AgentSpawnerPlugin.spawn(config)
└── spawn child process (e.g., `bun run agent-worker.ts`)
    ├── Child connects via MCP stdio transport
    ├── Child runs LLM inference loop internally
    ├── Parent monitors via MCP resources/notifications
    └── Parent reads result via MCP tool call
```

**Pros**:
- Process isolation — a crashing agent doesn't crash the runtime
- Standard MCP protocol for communication
- Each agent can have its own MCP server connections (tool sharing)
- Aligns with ACP's MCP integration model (`docs/acp-knowledgebase/06-tools-mcp.md`)

**Cons**:
- Heavy process overhead — spawning a Bun/Node process per agent is expensive
- Complex lifecycle management — process spawning, health monitoring, cleanup, zombie detection
- MCP was not designed for agent-to-agent communication — no native "run a task and return" semantic
- Must serialize all context (files, history, tools) across process boundaries
- Debugging is significantly harder with multiple processes
- Startup latency per agent (process init + MCP handshake)

---

### Option C: ACP Extension Method (`_goodvibes/spawn_agent`)

The runtime asks the ACP client to spawn subagents on its behalf. The client (Zed, VS Code) handles the actual agent process creation and reports results back through extension notifications.

**Architecture**:
```
Runtime → Client: _goodvibes/spawn_agent { type: "engineer", task: "..." }
Client: creates agent session (implementation-specific)
Client → Runtime: _goodvibes/agent_update { status: "running" }
Client → Runtime: _goodvibes/agent_update { status: "completed", result: {...} }
```

See `docs/acp-knowledgebase/08-extensibility.md` for extension method patterns.

**Pros**:
- Leverages client infrastructure — client already knows how to run AI agents
- Natural ACP fit — extension methods are the intended extensibility mechanism
- Client can provide UI for agent progress (tabs, panels, status indicators)
- No API key management in the runtime — client handles it

**Cons**:
- Client must implement the `_goodvibes/spawn_agent` extension — not all clients will
- Runtime loses control over agent behavior (model choice, system prompt, tool access)
- Tight coupling to client capabilities — degrades when client doesn't support spawning
- Latency: round-trip through ACP wire protocol for every agent interaction
- Cannot work in daemon mode without a connected client
- No path to headless operation (CI/CD, background processing)

---

### Option D: Internal Agent Loop (Recommended)

The runtime manages agent chains as internal async tasks within the same process. Each "agent" is an async function that runs a tool-use loop with an LLM provider. The existing `AgentCoordinator` manages parallel slot limits and queuing. The existing `AgentTracker` tracks lifecycle state. The existing `WRFCOrchestrator` drives the quality gate loop.

**Architecture**:
```
AgentSpawnerPlugin.spawn(config)
└── Creates async task (Promise):
    ├── Resolve ILLMProvider from registry
    ├── Build system prompt from AGENT_TYPE_CONFIGS[config.type]
    ├── Build tool definitions from IToolProvider registry
    ├── Agentic loop:
    │   ├── llmProvider.chat({ systemPrompt, messages, tools })
    │   ├── For each tool_use in response:
    │   │   ├── toolProvider.execute(toolName, params)
    │   │   └── Append tool_result to messages
    │   ├── Emit progress events via EventBus
    │   └── Check for end_turn / max_turns / abort signal
    └── Return AgentResult { output, filesModified, errors, durationMs }
```

**Pros**:
- Simple — no subprocess overhead, no IPC, no process management
- Fast — function calls within the same event loop, zero serialization
- Full control — model selection, system prompts, tool access, token budgets per agent
- Uses existing infrastructure — `AgentCoordinator` (parallel limits), `AgentTracker` (state), `EventBus` (events)
- LLM provider is pluggable — swap Anthropic for OpenAI, local models, or mock providers without touching agent logic
- Testable — mock the LLM provider, assert tool calls and state transitions
- Works headless — no client dependency, suitable for daemon mode and CI/CD

**Cons**:
- Requires an LLM provider abstraction (new interface in L0, implementation in L3)
- No process isolation — a pathological agent can starve the event loop (mitigated by AbortSignal timeouts)
- All agents share the same process memory (acceptable for single-user runtime)

---

### Decision Matrix

| Criterion | A: Direct API | B: MCP Subprocess | C: ACP Extension | D: Internal Loop |
|-----------|:---:|:---:|:---:|:---:|
| Implementation complexity | Medium | High | Low (runtime) / High (client) | **Low** |
| Process overhead | None | High | Depends on client | **None** |
| LLM provider flexibility | Low (Anthropic only) | Low | None (client decides) | **High** |
| Tool access | Manual wiring | MCP native | Client-dependent | **Registry native** |
| Testability | Medium | Low | Low | **High** |
| Headless operation | Yes | Yes | No | **Yes** |
| Uses existing infrastructure | Partially | No | No | **Fully** |
| Client visibility | Manual | Manual | Native | **Via EventBus → ACP** |

**Recommendation**: Option D (Internal Agent Loop). It is the simplest approach that fully leverages existing infrastructure (`AgentCoordinator`, `AgentTracker`, `WRFCOrchestrator`, `EventBus`, `Registry`) and adds only one new abstraction: `ILLMProvider`.

---

## 3. Recommended Architecture

```
Orchestrator (prompt handler in src/extensions/acp/agent.ts)
│
├── WRFCOrchestrator (src/extensions/wrfc/orchestrator.ts)
│   │   Drives Work → Review → Fix → Check loop
│   │   Uses IAgentSpawner for work/fix, IReviewer for review
│   │
│   └── AgentCoordinator (src/extensions/agents/coordinator.ts)
│       │   Enforces max parallel agents (default: 6)
│       │   Queues overflow via L1 Queue
│       │
│       └── AgentSpawnerPlugin (src/plugins/agents/spawner.ts)
│           │   Implements IAgentSpawner
│           │   Each spawn() creates an async AgentLoop
│           │
│           └── AgentLoop (new: src/plugins/agents/loop.ts)
│               ├── ILLMProvider → LLM inference (chat/stream)
│               ├── IToolProvider[] → tool execution (from registry)
│               ├── AgentTypeConfig → system prompt, model, timeout
│               └── AbortSignal → cancellation support
│
├── AgentTracker (src/extensions/agents/tracker.ts)
│   │   Persists agent metadata to L1 StateStore
│   │   Emits agent:registered, agent:status-changed,
│   │   agent:completed, agent:failed via L1 EventBus
│   │
├── EventBus (src/core/event-bus.ts)
│   │   Routes lifecycle events to:
│   │   - ACP session/update notifications (tool_call lifecycle)
│   │   - _goodvibes/status extension notifications
│   │   - AgentCoordinator queue drain triggers
│   │
└── ACP Connection (src/extensions/acp/agent.ts)
        Maps internal events → ACP tool_call updates
        Maps internal events → _goodvibes/* extension notifications
```

### Layer Placement

| Component | Layer | Rationale |
|-----------|-------|----------|
| `ILLMProvider` interface | L0 (`src/types/registry.ts`) | Pure interface, no runtime code |
| `ChatParams`, `ChatResponse`, `ChatChunk` types | L0 (`src/types/llm.ts`) | New type file for LLM-related types |
| `AgentLoop` class | L3 (`src/plugins/agents/loop.ts`) | Concrete implementation with LLM dependency |
| `AnthropicProvider` | L3 (`src/plugins/agents/providers/anthropic.ts`) | Anthropic SDK integration |
| `MockProvider` | L3 (`src/plugins/agents/providers/mock.ts`) | Testing provider |
| Updated `AgentSpawnerPlugin` | L3 (`src/plugins/agents/spawner.ts`) | Replaces timer stub with `AgentLoop` |

This follows the architecture's dependency rule: L3 depends on L0 interfaces, L2 calls through L0 interfaces via L1 registry, L0 has zero runtime code.

---

## 4. LLM Provider Interface

New file: `src/types/llm.ts` (L0 — pure types)

```typescript
/**
 * @module llm
 * @layer L0 — pure types, no runtime code, no imports
 *
 * Types for the LLM provider abstraction.
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/** Role in a conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A content block within a message */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/** A single message in a conversation */
export type Message = {
  role: MessageRole;
  content: ContentBlock[] | string;
};

// ---------------------------------------------------------------------------
// Tool definitions (for LLM context)
// ---------------------------------------------------------------------------

/** Tool definition passed to the LLM */
export type LLMToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Chat parameters and response
// ---------------------------------------------------------------------------

/** Parameters for a chat completion request */
export type ChatParams = {
  /** Model identifier (e.g., 'claude-sonnet-4-6') */
  model: string;
  /** System prompt */
  systemPrompt: string;
  /** Conversation history */
  messages: Message[];
  /** Available tools */
  tools?: LLMToolDefinition[];
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
};

/** Stop reason from the LLM */
export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';

/** Response from a chat completion request */
export type ChatResponse = {
  /** Response content blocks */
  content: ContentBlock[];
  /** Why the model stopped generating */
  stopReason: StopReason;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

/** A chunk from a streaming chat response */
export type ChatChunk =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; input_json: string }
  | { type: 'stop'; stopReason: StopReason; usage: { inputTokens: number; outputTokens: number } };
```

New interface added to `src/types/registry.ts` (L0):

```typescript
/**
 * LLM inference provider.
 * Implementations live in L3 (e.g., AnthropicProvider, MockProvider).
 * The agent loop calls through this interface without knowing the backend.
 */
export interface ILLMProvider {
  /** Provider name (e.g., 'anthropic', 'openai', 'mock') */
  readonly name: string;

  /** Send a chat completion request and await the full response */
  chat(params: ChatParams): Promise<ChatResponse>;

  /** Stream a chat completion response */
  stream(params: ChatParams): AsyncIterable<ChatChunk>;
}
```

Registry key: `'llm-provider'`

---

## 5. Agent Chain Lifecycle

### State Diagram

```
                    ┌──────────┐
    spawn()  ───►   │ spawned  │
                    └────┬─────┘
                         │ (immediate)
                    ┌────▼─────┐
                    │ running  │ ◄─── AgentLoop starts
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼────┐ ┌───▼───┐ ┌───▼────┐
         │completed│ │failed │ │cancelled│
         └─────────┘ └───────┘ └────────┘
```

These states match `AgentStatus` from `src/types/agent.ts`.

### Detailed Lifecycle

#### 1. Spawn

```typescript
// Caller (WRFCOrchestrator or direct)
const handle = await coordinator.spawn({
  type: 'engineer',
  task: 'Implement user authentication',
  sessionId: 'sess_abc123',
  contextFiles: ['src/auth/index.ts', 'src/types/user.ts'],
  model: 'claude-sonnet-4-6',       // optional override
  timeoutMs: 300_000,                // optional override (default from AgentTypeConfig)
});
```

The `AgentCoordinator` (`src/extensions/agents/coordinator.ts`) checks if `activeCount < maxParallel`:
- **Under limit**: spawns immediately via `IAgentSpawner.spawn()`
- **Over limit**: enqueues the config, returns a Promise that resolves when a slot opens

#### 2. Initialize

Inside `AgentSpawnerPlugin.spawn()` (the real implementation replacing the stub):

```typescript
async spawn(config: AgentConfig): Promise<AgentHandle> {
  const handle = createHandle(config);
  const typeConfig = AGENT_TYPE_CONFIGS[config.type];
  const llmProvider = this._registry.get<ILLMProvider>('llm-provider');
  const toolProviders = this._registry.getAll<IToolProvider>('tool-provider');

  // Create the agent loop
  const loop = new AgentLoop({
    handle,
    config,
    typeConfig,
    llmProvider,
    toolProviders,
    signal: AbortSignal.timeout(config.timeoutMs ?? typeConfig.defaultTimeoutMs),
  });

  // Start the loop (non-blocking)
  this._running.set(handle.id, loop);
  loop.run().then(
    (result) => this._complete(handle.id, result),
    (error) => this._fail(handle.id, error),
  );

  return handle;
}
```

#### 3. WRFC Loop (Agent Execution)

The `AgentLoop` runs the core agentic loop:

```
Build system prompt (from AgentTypeConfig.systemPromptPrefix + task + context)
│
└── Loop (max turns configurable, default 30):
    ├── Call llmProvider.chat({ model, systemPrompt, messages, tools })
    ├── If stopReason === 'end_turn':
    │   └── Break — agent is done
    ├── If stopReason === 'tool_use':
    │   ├── For each tool_use block:
    │   │   ├── Find matching IToolProvider
    │   │   ├── Execute tool: provider.execute(toolName, input)
    │   │   ├── Emit 'agent:tool-executed' event
    │   │   └── Append tool_result to messages
    │   └── Continue loop
    ├── If stopReason === 'max_tokens':
    │   └── Continue loop (allow agent to continue)
    └── Check AbortSignal — throw if aborted
```

The `WRFCOrchestrator` (`src/extensions/wrfc/orchestrator.ts`) wraps this in the quality gate loop:

```
WRFC Loop (max attempts from WRFCConfig.maxAttempts):
├── WORK: spawner.spawn({ type: 'engineer', task }) → await spawner.result(handle)
├── REVIEW: reviewer.review(workResult) → ReviewResult with score
├── If score >= WRFCConfig.minReviewScore: DONE
├── FIX: fixer.fix(reviewResult) → FixResult
└── Loop back to WORK with enriched task
```

#### 4. Complete / Escalate

When the agent loop finishes:

```typescript
private _complete(id: string, loopResult: AgentLoopResult): void {
  const state = this._agents.get(id);
  state.status = 'completed';
  state.output = loopResult.output;
  state.filesModified = loopResult.filesModified;
  state.finishedAt = Date.now();
  this._flushResolvers(state);  // Resolves all awaiting result() promises
}
```

The `AgentTracker` picks this up (via the coordinator's `spawner.result().then(...)` wiring in `src/extensions/agents/coordinator.ts:146`) and:
1. Updates metadata in StateStore
2. Emits `agent:completed` on EventBus
3. `AgentCoordinator` listens for `agent:completed` and drains the queue

#### 5. Cleanup

After result is consumed:
- `AgentTracker.remove(agentId)` clears StateStore entry
- `AgentLoop` releases references to messages/tools (GC)
- Timeout timer is cleared

Graceful shutdown (`src/extensions/lifecycle/shutdown.ts`) follows ARCHITECTURE.md order:
1. Signal running agents to stop (abort their AbortSignal)
2. Wait for grace period (default 10s)
3. Force-cancel any still running
4. Then proceed with L3 → L2 → L1 teardown

---

## 6. Integration Points

### 6.1 EventBus Integration

Agent lifecycle events flow through `src/core/event-bus.ts`:

| Event | Emitted By | Payload | Consumers |
|-------|-----------|---------|----------|
| `agent:registered` | `AgentTracker.register()` | `{ metadata: AgentMetadata }` | ACP agent (tool_call pending) |
| `agent:status-changed` | `AgentTracker.updateStatus()` | `{ agentId, from, to }` | ACP agent (tool_call_update) |
| `agent:completed` | `AgentTracker.updateStatus()` | `{ metadata: AgentMetadata }` | AgentCoordinator (drain queue), ACP agent (tool_call completed) |
| `agent:failed` | `AgentTracker.updateStatus()` | `{ metadata: AgentMetadata }` | AgentCoordinator (drain queue), ACP agent (tool_call failed) |
| `agent:tool-executed` | `AgentLoop` (new) | `{ agentId, toolName, durationMs }` | Analytics plugin (token tracking) |
| `agent:spawn-error` | `AgentCoordinator._spawnNow()` | `{ agentId, error }` | Error logging |

All events carry `sessionId` for session-scoped filtering (per ARCHITECTURE.md § Session-scoped events).

### 6.2 AgentTracker Integration

The `AgentTracker` (`src/extensions/agents/tracker.ts`) already provides everything needed:

- **Registration**: `tracker.register(handle, sessionId, task)` — called by `AgentCoordinator._spawnNow()`
- **Status transitions**: `tracker.updateStatus(id, status)` — called when spawner reports completion
- **Queries**: `tracker.active()`, `tracker.getBySession(sessionId)`, `tracker.activeCount()`
- **Cleanup**: `tracker.remove(agentId)` — called after result is consumed

No changes needed to AgentTracker.

### 6.3 ACP Session Updates

Agent lifecycle maps to ACP `tool_call` updates per ARCHITECTURE.md § WRFC ↔ ACP Mapping:

```typescript
// In src/extensions/acp/agent.ts — event handler wired at session creation

eventBus.on('agent:registered', ({ metadata }) => {
  conn.sessionUpdate({
    sessionId: metadata.sessionId,
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: `goodvibes_${metadata.type}_${metadata.id}`,
      title: `${metadata.type}: ${metadata.task.slice(0, 80)}`,
      kind: 'other',
      status: 'pending',
      _meta: {
        '_goodvibes/agentId': metadata.id,
        '_goodvibes/agentType': metadata.type,
        '_goodvibes/phase': 'work',
      },
    },
  });
});

eventBus.on('agent:status-changed', ({ agentId, from, to }) => {
  const metadata = tracker.get(agentId);
  if (!metadata) return;
  conn.sessionUpdate({
    sessionId: metadata.sessionId,
    update: {
      sessionUpdate: 'tool_call_update',
      toolCallId: `goodvibes_${metadata.type}_${agentId}`,
      status: to === 'running' ? 'running'
            : to === 'completed' ? 'completed'
            : 'failed',
    },
  });
});
```

See `docs/acp-knowledgebase/06-tools-mcp.md` for the full tool_call lifecycle wire format.

### 6.4 Extension Method Visibility

ACP clients query agent status via `_goodvibes/agents` extension method (see `docs/acp-knowledgebase/08-extensibility.md`):

```typescript
// In src/extensions/acp/agent.ts — handleExtMethod
case '_goodvibes/agents': {
  const agents = tracker.getBySession(params.sessionId);
  return {
    agents: agents.map(m => ({
      id: m.id,
      type: m.type,
      status: m.status,
      startedAt: m.startedAt,
      completedAt: m.finishedAt,
      task: m.task,
    })),
  };
}
```

### 6.5 Permission Gate Integration

Tool execution within agent loops must respect session permission mode. The `AgentLoop` receives a permission callback:

```typescript
type PermissionCheck = (toolName: string, params: unknown) => Promise<boolean>;
```

For `justvibes` mode: callback calls `conn.requestPermission()` before destructive tools.  
For `vibecoding` mode: callback returns `true` for all tools.  
For `sandbox` mode: callback restricts tools to read-only operations.

The permission callback is injected by the ACP agent layer, keeping the AgentLoop (L3) free of ACP protocol knowledge.

---

## 7. Migration Path

### Phase 1: LLM Provider Abstraction

**Goal**: Define the ILLMProvider interface and build the first implementation.

**New files**:
- `src/types/llm.ts` — L0 types (`ChatParams`, `ChatResponse`, `ChatChunk`, `Message`, etc.)
- `src/types/registry.ts` — Add `ILLMProvider` interface
- `src/plugins/agents/providers/anthropic.ts` — `AnthropicProvider` implementing `ILLMProvider`
- `src/plugins/agents/providers/mock.ts` — `MockProvider` for testing

**Modified files**:
- `src/plugins/agents/index.ts` — Register `ILLMProvider` implementation

**Dependencies**: `@anthropic-ai/sdk` package

**Validation**: Unit tests with `MockProvider`, integration test with Anthropic API.

### Phase 2: Agent Loop

**Goal**: Build the core agentic loop that replaces the timer stub.

**New files**:
- `src/plugins/agents/loop.ts` — `AgentLoop` class: system prompt construction, tool-use loop, result aggregation

**Modified files**:
- `src/plugins/agents/spawner.ts` — Replace timer stub with `AgentLoop` instantiation

**Validation**: End-to-end test: spawn agent with MockProvider, verify tool calls are executed, result is returned.

### Phase 3: WRFC Integration

**Goal**: Wire the real agent spawner into the WRFC orchestrator's quality gate loop.

**Modified files**:
- `src/extensions/wrfc/orchestrator.ts` — Already calls through `IAgentSpawner`; no code changes needed (this is the benefit of the interface abstraction)

**Validation**: Full WRFC loop test: work → review → (fix → work → review) → pass. Verify state transitions, event emissions, and final score.

### Phase 4: ACP Client Visibility

**Goal**: Surface agent lifecycle in ACP clients via tool_call updates and extension methods.

**Modified files**:
- `src/extensions/acp/agent.ts` — Wire EventBus listeners for `agent:*` events → ACP `session/update` notifications

**New behavior**:
- Each agent spawn appears as a `tool_call` (pending → running → completed/failed)
- `_goodvibes/agents` extension method returns live agent status
- `_goodvibes/status` notifications include current agent info

**Validation**: Integration test with ACP mock client, verify tool_call update sequence matches ARCHITECTURE.md § WRFC ↔ ACP Mapping.

### Phase Dependency Graph

```
Phase 1 (LLM Provider)
    │
    ▼
Phase 2 (Agent Loop)
    │
    ├──────────────┐
    ▼              ▼
Phase 3         Phase 4
(WRFC)          (ACP Visibility)
```

Phases 3 and 4 can proceed in parallel after Phase 2.

---

## 8. Testing Strategy

### MockProvider

The `MockProvider` (`src/plugins/agents/providers/mock.ts`) enables deterministic testing:

```typescript
class MockProvider implements ILLMProvider {
  readonly name = 'mock';
  private _responses: ChatResponse[] = [];

  /** Queue a response to be returned by the next chat() call */
  enqueue(response: ChatResponse): void {
    this._responses.push(response);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    const response = this._responses.shift();
    if (!response) throw new Error('MockProvider: no responses queued');
    return response;
  }

  async *stream(params: ChatParams): AsyncIterable<ChatChunk> {
    const response = await this.chat(params);
    for (const block of response.content) {
      if (block.type === 'text') {
        yield { type: 'text_delta', text: block.text };
      }
    }
    yield { type: 'stop', stopReason: response.stopReason, usage: response.usage };
  }
}
```

### Test Scenarios

| Scenario | What to Test | Layer |
|----------|-------------|-------|
| Agent loop basic | Send prompt, get text response, return result | L3 |
| Agent loop tool use | Send prompt, LLM requests tool, execute, continue | L3 |
| Agent loop max turns | Agent hits turn limit, returns partial result | L3 |
| Agent loop timeout | AbortSignal fires, agent cancels cleanly | L3 |
| Agent loop tool error | Tool execution fails, error fed back to LLM | L3 |
| Coordinator parallel limit | Spawn 8 agents with limit 6, verify 2 queued | L2 |
| Coordinator queue drain | Complete one agent, verify queued agent starts | L2 |
| WRFC quality gate | Score below minimum triggers fix cycle | L2 |
| WRFC max attempts | Exhausts attempts, escalates | L2 |
| ACP tool_call mapping | Agent events produce correct session/update sequence | L2 |

---

## 9. Open Considerations

### Token Budget Management

Each agent chain consumes tokens. The analytics plugin (`src/plugins/analytics/budget.ts`) tracks usage. The `AgentLoop` should report token usage from `ChatResponse.usage` via events so the coordinator can enforce per-session budgets.

### Context Window Management

Long-running agent chains will accumulate messages. The `AgentLoop` needs a strategy for managing context window limits:
- **Truncation**: Drop older messages when approaching the model's context limit
- **Summarization**: Summarize earlier conversation turns
- **Sliding window**: Keep only the last N turns plus the system prompt

This is an implementation detail within `AgentLoop`, not an architectural concern.

### Multi-Model Support

Different agent types may benefit from different models:
- Architect agents → larger models for complex reasoning
- Engineer agents → balanced models for code generation
- Reviewer agents → smaller, faster models for scoring

The `AgentTypeConfig.defaultModel` field (`src/plugins/agents/types.ts`) already supports this. The `ILLMProvider.chat()` accepts a `model` parameter, allowing per-call model selection.

### Streaming Progress

For long-running agent tasks, streaming provides better UX. The `ILLMProvider.stream()` method returns `AsyncIterable<ChatChunk>`. The `AgentLoop` can emit intermediate progress events that surface as ACP `agent_message_chunk` updates.

### Future: Worker Thread Isolation

Per ARCHITECTURE.md § Concurrency Model: "Worker threads can be added for CPU-intensive L3 plugins without changing the layer model." If agent loops become CPU-bound (unlikely — they're I/O-bound waiting on LLM APIs), individual loops can be moved to worker threads. The `IAgentSpawner` interface doesn't change — only the internal implementation of `AgentLoop`.

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Agent Chain** | A sequence of agent spawns driven by a WRFC loop (work → review → fix → check) |
| **Agent Loop** | The inner agentic loop: prompt LLM → parse tool_use → execute tools → repeat |
| **WRFC** | Work → Review → Fix → Check — the quality gate loop |
| **ILLMProvider** | Interface for LLM inference backends (Anthropic, OpenAI, mock) |
| **IAgentSpawner** | Interface for spawning and managing agent instances |
| **AgentCoordinator** | L2 component that enforces parallel agent limits and queues overflow |
| **AgentTracker** | L2 component that persists agent metadata and emits lifecycle events |
| **WRFCOrchestrator** | L2 component that drives the WRFC state machine |
