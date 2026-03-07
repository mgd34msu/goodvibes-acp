# ACP Knowledgebase: Extensibility

## Overview

ACP provides two extension mechanisms that allow adding custom data and custom methods without breaking protocol compatibility:

1. **`_meta` field** — attach custom data to any existing protocol type
2. **`_`-prefixed method names** — define entirely new methods outside the spec

Both mechanisms are forward-compatible: unknown `_meta` keys and unknown `_`-prefixed methods MUST be ignored by implementations that don't recognize them.

---

## The `_meta` Field

Every type in the ACP protocol includes an optional `_meta` field:

```typescript
type Meta = { [key: string]: unknown };
```

This field is available on:
- Request params (e.g., `session/prompt` params)
- Response results
- Notification params (e.g., `session/update` params)
- Nested types: content blocks, tool calls, plan entries, capability objects

### Basic Usage

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [
      { "type": "text", "text": "Hello, world!" }
    ],
    "_meta": {
      "traceparent": "00-80e1afed08e019fc1110464cfa66635c-7a085853722dc6d2-01",
      "zed.dev/debugMode": true
    }
  }
}
```

### Reserved Keys (W3C Trace Context)

The following root-level `_meta` keys are **reserved** for W3C trace context. Using them for other purposes breaks OpenTelemetry interop:

| Key | Spec | Purpose |
|-----|------|---------|
| `traceparent` | W3C Trace Context | Distributed trace ID + span ID |
| `tracestate` | W3C Trace Context | Vendor-specific trace state |
| `baggage` | W3C Baggage | Key-value propagation across services |

```json
// Correct: W3C trace context propagation
{
  "_meta": {
    "traceparent": "00-80e1afed08e019fc1110464cfa66635c-7a085853722dc6d2-01",
    "tracestate": "vendor1=opaqueValue1",
    "baggage": "userId=alice,serverNode=DF28"
  }
}
```

### Naming Convention for Custom Keys

Implementations **MUST NOT** add custom fields at the root of protocol-spec types (any name could be reserved by future versions). All custom data goes in `_meta`. Within `_meta`, use namespaced keys to avoid collisions:

```
"vendor.com/key"  — domain-namespaced (recommended)
"_namespace/key" — underscore-prefixed namespace
```

---

## Extension Methods

Any method name starting with `_` is reserved for custom extensions:

```
_goodvibes/agents
_goodvibes/status
_goodvibes/state
_goodvibes/events
_goodvibes/analytics
```

Extension methods follow standard JSON-RPC 2.0 semantics:

| Type | Has `id`? | Expects response? |
|------|-----------|-------------------|
| Request | yes | yes |
| Notification | no | no |

### Extension Request (expects response)

```json
// Request
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "_goodvibes/agents",
  "params": {
    "sessionId": "sess_abc123def456"
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "agents": [
      { "id": "agent_001", "type": "engineer", "status": "running", "startedAt": 1772877914 },
      { "id": "agent_002", "type": "reviewer", "status": "completed", "score": 8.5 }
    ]
  }
}
```

### Extension Notification (fire-and-forget)

```json
// Notification (no id, no response expected)
{
  "jsonrpc": "2.0",
  "method": "_goodvibes/status",
  "params": {
    "sessionId": "sess_abc123def456",
    "phase": "applying",
    "completedSteps": 3,
    "totalSteps": 7
  }
}
```

### TypeScript: Sending Extension Methods

Using `AgentSideConnection`:

```typescript
// Send extension request (awaits response)
const result = await conn.extMethod('_goodvibes/agents', {
  sessionId: session.id
});

// Send extension notification (no response)
await conn.extNotification('_goodvibes/status', {
  sessionId: session.id,
  phase: 'applying'
});
```

### TypeScript: Receiving Extension Methods

On the agent side, handle extension methods in your `Agent` implementation:

```typescript
class GoodVibesAgent implements Agent {
  async handleExtMethod(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case '_goodvibes/agents':
        return this.runtime.getAgentStatus();
      case '_goodvibes/state':
        return this.runtime.getState();
      default:
        throw new Error(`Unknown extension method: ${method}`);
    }
  }

  onExtNotification(method: string, params: unknown): void {
    if (method === '_goodvibes/directive') {
      this.runtime.handleDirective(params);
    }
  }
}
```

---

## GoodVibes `_goodvibes/*` Namespace

All GoodVibes-specific extensions use the `_goodvibes/` prefix for methods and `"_goodvibes/"` namespace prefix for `_meta` keys.

### Planned Extension Methods

| Method | Type | Direction | Purpose |
|--------|------|-----------|--------|
| `_goodvibes/status` | notification | agent → client | WRFC phase progress, step counts |
| `_goodvibes/state` | request | client → agent | Query runtime state snapshot |
| `_goodvibes/events` | notification | agent → client | Event bus notifications (triggers fired, hooks) |
| `_goodvibes/agents` | request | client → agent | List active subagents with status/scores |
| `_goodvibes/analytics` | request | client → agent | Query budget/token usage analytics |
| `_goodvibes/directive` | notification | client → agent | Inject runtime directives into agent |

### `_meta` Usage for GoodVibes Data

```json
// session/update with WRFC metadata on tool_call
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "sess_abc123def456",
    "update": {
      "type": "tool_call",
      "toolCallId": "tc_abc",
      "name": "engineer",
      "status": "completed",
      "_meta": {
        "_goodvibes/score": 8.5,
        "_goodvibes/minimumScore": 7.0,
        "_goodvibes/phase": "apply",
        "_goodvibes/files": ["src/api/routes.ts", "src/types.ts"],
        "_goodvibes/tokenCount": 12400
      }
    }
  }
}
```

```json
// session/prompt params with GoodVibes tracing
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "session/prompt",
  "params": {
    "sessionId": "sess_abc123def456",
    "prompt": [{ "type": "text", "text": "Add authentication" }],
    "_meta": {
      "traceparent": "00-80e1afed08e019fc1110464cfa66635c-7a085853722dc6d2-01",
      "_goodvibes/workflowId": "wf_build_auth_001",
      "_goodvibes/budget": { "maxTokens": 100000, "maxTurns": 20 }
    }
  }
}
```

### `_goodvibes/status` Notification Wire Format

```typescript
interface GoodVibesStatusNotification {
  sessionId: string;
  workflowId?: string;
  phase: 'gather' | 'plan' | 'apply' | 'review' | 'complete' | 'failed';
  completedSteps: number;
  totalSteps: number;
  currentAgent?: {
    id: string;
    type: string;  // 'engineer' | 'reviewer' | 'orchestrator'
    status: 'running' | 'waiting';
  };
}
```

```json
{
  "jsonrpc": "2.0",
  "method": "_goodvibes/status",
  "params": {
    "sessionId": "sess_abc123def456",
    "workflowId": "wf_build_auth_001",
    "phase": "apply",
    "completedSteps": 3,
    "totalSteps": 7,
    "currentAgent": {
      "id": "agent_003",
      "type": "engineer",
      "status": "running"
    }
  }
}
```

### `_goodvibes/agents` Request/Response Wire Format

```typescript
interface GoodVibesAgentsRequest {
  sessionId: string;
  workflowId?: string;  // filter by workflow
}

interface GoodVibesAgentsResponse {
  agents: Array<{
    id: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: number;    // unix ms
    completedAt?: number;  // unix ms
    score?: number;        // reviewer score 0-10
    minimumScore?: number;
    files?: string[];      // files modified
    error?: string;
  }>;
}
```

### `_goodvibes/analytics` Request/Response Wire Format

```typescript
interface GoodVibesAnalyticsRequest {
  sessionId: string;
  scope: 'session' | 'workflow' | 'agent';
  id?: string;  // workflowId or agentId when scope != 'session'
}

interface GoodVibesAnalyticsResponse {
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    budget?: number;  // configured max
    remaining?: number;
  };
  turnCount: number;
  agentCount: number;
  duration_ms: number;
}
```

---

## Implementation Notes

### Forward Compatibility

When implementing an ACP client or agent:
- Unknown `_meta` keys MUST be ignored (not rejected)
- Unknown `_`-prefixed methods MUST be handled gracefully (return error or ignore notification)
- Do not error on unrecognized extension traffic from other implementations

```typescript
// Safe unknown extension method handler
async function handleUnknownExtMethod(method: string, params: unknown): Promise<unknown> {
  // Log for debugging, but don't crash
  console.warn(`Unknown extension method: ${method}`);
  return null;  // or throw a specific JSON-RPC error code
}
```

### Protocol Constraint

Impementations MUST NOT add custom fields at the root of protocol-defined types. Only add data inside `_meta`:

```json
// WRONG — custom field at root of params
{
  "method": "session/prompt",
  "params": {
    "sessionId": "...",
    "prompt": [...],
    "goodvibesWorkflowId": "wf_001"  // FORBIDDEN
  }
}

// CORRECT — custom data inside _meta
{
  "method": "session/prompt",
  "params": {
    "sessionId": "...",
    "prompt": [...],
    "_meta": {
      "_goodvibes/workflowId": "wf_001"  // allowed
    }
  }
}
```

### W3C Trace Context Integration

For distributed tracing across the ACP boundary:

```typescript
import { context, trace, propagation } from '@opentelemetry/api';

function injectTraceContext(meta: Record<string, unknown>): Record<string, unknown> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  // carrier now has traceparent, tracestate, baggage
  return { ...meta, ...carrier };
}

function extractTraceContext(meta: Record<string, unknown>): void {
  const carrier = {
    traceparent: meta.traceparent as string,
    tracestate: meta.tracestate as string,
    baggage: meta.baggage as string,
  };
  const ctx = propagation.extract(context.active(), carrier);
  // Use ctx to set the active context for this request
}
```
