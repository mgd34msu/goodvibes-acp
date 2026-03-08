# ISS-049: Extensions `pushStatus` payload not namespaced

**Severity**: Minor  
**File**: `src/extensions/acp/extensions.ts`  
**Lines**: 333-348  
**KB Reference**: KB-01, KB-08 (Extensibility)

## Description

The `pushStatus` method sends status information via `conn.extNotification('_goodvibes/status', ...)` with top-level fields from the health check (like `health`, `uptime`, `activeAgents`, etc.) spread directly into the notification payload.

## Source Evidence

`src/extensions/acp/extensions.ts` lines 341-347:
```typescript
await conn.extNotification('_goodvibes/status', {
  ...(health as Record<string, unknown>),
  phase,
  completedSteps,
  totalSteps,
  sessionId,
});
```

The `health` object (from `_status()`) is spread directly, placing fields like `status`, `uptime`, `activeAgents`, `activeSessions`, `registeredPlugins` at the top level of the notification params alongside `phase`, `completedSteps`, etc.

## Analysis

Since this is an extension notification method (`_goodvibes/status`), it is already in the GoodVibes namespace. The ACP spec only restricts field placement on protocol-defined types, not on extension method payloads. Extension methods have their own schema, so there is no collision risk with ACP spec additions.

However, the payload shape doesn't match the `GoodVibesStatusNotification` interface defined in KB-08, which specifies a structured shape with `phase`, `completedSteps`, `totalSteps`, and `currentAgent` fields -- not a flat spread of health data.

### Verdict: PARTIAL

The namespacing concern is not a real ACP compliance issue since extension methods define their own schema. However, the payload shape diverges from the documented `GoodVibesStatusNotification` interface in KB-08, which is a design consistency issue.

## Remediation

Consider restructuring the payload to match the documented interface:
```typescript
await conn.extNotification('_goodvibes/status', {
  sessionId,
  phase,
  completedSteps,
  totalSteps,
  _meta: { '_goodvibes/health': health },
});
```

Or define a clear schema for the extension notification that includes both the status fields and health data.
