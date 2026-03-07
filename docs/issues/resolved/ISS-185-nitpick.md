# ISS-185 — `session_info_update` Discriminant Uncertainty Unresolved

**Severity**: Nitpick
**File**: `src/extensions/acp/agent.ts:63-64`
**KB Topic**: TypeScript SDK

## Original Issue
`[src/extensions/acp/agent.ts:63-64]` `session_info_update` discriminant uncertainty documented in comment but unresolved. Check SDK types. (Duplicates minor #129 at nitpick severity.) *(TypeScript SDK)*

## Verification

### Source Code Check
Lines 60–65 of `src/extensions/acp/agent.ts`:
```typescript
/**
 * Build a typed session_info_update SessionUpdate.
 * NOTE: The literal used here is 'session_info_update'. ACP doc-04 references 'session_info'
 * — if the SDK is updated to use that name, this cast will need updating.
 */
function sessionInfoUpdate(title: string, updatedAt: string): schema.SessionUpdate {
  return { sessionUpdate: 'session_info_update' as const, title, updatedAt };
}
```
The comment explicitly acknowledges that the discriminant value `'session_info_update'` may be wrong, with `'session_info'` potentially being the correct value per the spec. The `as const` cast is used to force TypeScript to accept the literal.

### ACP Spec Check
From KB 09 — TypeScript SDK, Session Update Reference table:
| `sessionUpdate` value | Description |
|---|---|
| `"agent_message_chunk"` | Streaming content |
| `"finish"` | Agent done |
| `"available_commands"` | Commands |
| `"current_mode"` | Mode changed |
| `"config_option"` | Config option updated |

The `session_info` variant is not listed in the SDK reference table at all. However, KB 04 — Prompt Turn references a `session_info` update type. The correct discriminant value is `'session_info'` per ACP issue #6 (Critical), which is the definitive fix for this problem. This nitpick-severity instance is a duplicate of that critical issue, acknowledged as such in the original issue text.

### Verdict: CONFIRMED
The code uses `'session_info_update'` with an `as const` cast and an acknowledging comment, when the correct discriminant per the ACP spec is `'session_info'`. The issue is real. This is a duplicate of critical issue #6 which addresses the same root problem at higher severity.

## Remediation
Same fix as critical issue #6:
```typescript
function sessionInfoUpdate(title: string, updatedAt: string): schema.SessionUpdate {
  return { sessionUpdate: 'session_info' as const, content: { type: 'text', text: title } };
}
```
Note: the payload shape also changes (`title`/`updatedAt` → `content: { type, text }`).
