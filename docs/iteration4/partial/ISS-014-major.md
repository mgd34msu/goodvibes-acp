# ISS-014: `available_commands_update` discriminator and field name mismatch

**Severity**: Major  
**File**: `src/extensions/acp/commands-emitter.ts`  
**Lines**: 106-117  
**KB Reference**: KB-04 (Session Updates)

## Description

The issue claims the implementation uses discriminator `available_commands_update` and field `availableCommands`, with a double-cast bypassing type checking, while KB-04 uses `available_commands` and `commands`.

## Evidence

The SDK `SessionUpdate` union defines:
```typescript
(AvailableCommandsUpdate & { sessionUpdate: "available_commands_update" })
```

The SDK `AvailableCommandsUpdate` type has:
```typescript
export type AvailableCommandsUpdate = {
  _meta?: { [key: string]: unknown } | null;
  availableCommands: Array<AvailableCommand>;
};
```

The current implementation (after a prior fix) correctly uses:
- Discriminator: `'available_commands_update'` (matches SDK)
- Field: `availableCommands` (matches SDK)

However, the `as unknown as acp.SessionUpdate` double cast remains on line 116, bypassing type safety.

### Verdict: PARTIAL

The discriminator and field name have been corrected to match the SDK. However, the double cast `as unknown as acp.SessionUpdate` still exists, bypassing compile-time type verification. This is a residual type-safety concern.

## Remediation

1. Remove the `as unknown as acp.SessionUpdate` double cast.
2. Construct the update using proper SDK types so TypeScript verifies correctness at compile time.
