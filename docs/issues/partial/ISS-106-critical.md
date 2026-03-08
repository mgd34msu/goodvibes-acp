# ISS-106 — MCP tool-call-bridge uses `'in_progress'` status instead of ACP spec `'running'`

**Severity**: Critical  
**File**: `src/extensions/mcp/tool-call-bridge.ts`  
**Line**: 109  
**KB Reference**: KB-06 (ToolCallStatus)  
**Iteration**: 3

## Description

The code uses `'in_progress'` as the active execution status. KB-06 defines `'running'` as the active execution status. However, the code contains extensive documentation (lines 44-51) noting that the SDK (v0.15.0) uses `'in_progress'` and that SDK types are authoritative.

## Source Evidence

```typescript
// src/extensions/mcp/tool-call-bridge.ts:109
return emitter.emitToolCallUpdate(sessionId, toolCallId, 'in_progress');

// src/extensions/mcp/tool-call-bridge.ts:44-49 (documentation)
// Status terminology note (ISS-055 verified):
// - ACP SDK (v0.15.0) ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
// - KB 06-tools-mcp.md uses 'running' instead of 'in_progress'
// - SDK types confirmed as authoritative: ToolCallStatus does NOT include 'running'.
//   This implementation uses 'in_progress' as defined by the SDK.
```

## Spec Evidence

KB-06 status values:
```
| `running` | Tool is actively executing |
```

KB-04 TypeScript interface:
```typescript
type ToolCallStatus = "pending" | "in_progress" | "completed" | "cancelled" | "error";
```

### Verdict: PARTIAL

KB-06 uses `'running'` but KB-04 uses `'in_progress'`. The code follows KB-04 and the SDK TypeScript types, which use `'in_progress'`. Per the known context note, KB-04 and KB-06 define `ToolCallStatus` differently and the SDK should be checked. The SDK documentation (KB-09 and code comments) confirms `'in_progress'` is the SDK value. The code is correct per the SDK; the issue is a spec inconsistency, not a code bug.

## Remediation

1. No code change required — the implementation correctly follows the SDK types
2. The KB-06 documentation should be updated to align with the SDK/KB-04 definition
3. If a non-SDK ACP client is a concern, add a comment or configuration option for wire-format translation
