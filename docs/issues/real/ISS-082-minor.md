# ISS-082: TerminalHandle does not include ACP terminalId for debugging

**Source**: `src/extensions/acp/terminal-bridge.ts` lines 71-77, `src/types/registry.ts` line 135  
**KB Reference**: KB-07 (Terminal Create)  
**Severity**: Minor

## Description

The `TerminalHandle` type only exposes `{ id, command, createdAt }`. When the ACP client returns a `terminalId` from `terminal/create`, it is stored internally in the `InternalHandle` but not exposed on the returned `TerminalHandle`. This makes debugging ACP terminal issues harder since there is no way to correlate the internal handle ID with the ACP-assigned terminal ID.

## Evidence

`TerminalHandle` type (`src/types/registry.ts:135`):
```typescript
export type TerminalHandle = {
  id: string;
  command: string;
  createdAt: number;
};
```

No `acpTerminalId` field exists. KB-07 shows `terminal/create` returns `{ terminalId: "term_xyz789" }` which should be accessible for debugging.

### Verdict: CONFIRMED

The ACP terminal ID is stored internally but not surfaced on the public handle type, making cross-system debugging unnecessarily difficult.

## Remediation

1. Add an optional `acpTerminalId?: string` field to the `TerminalHandle` type in `src/types/registry.ts`.
2. In `terminal-bridge.ts`, populate `handle.acpTerminalId` with the value from the ACP `terminal/create` response when using ACP-backed terminals.
3. Leave it undefined for spawn-backed fallback terminals.
