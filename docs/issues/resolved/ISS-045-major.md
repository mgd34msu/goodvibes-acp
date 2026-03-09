# ISS-045: Terminal bridge missing `args` array support

**Severity**: Major  
**File**: `src/extensions/acp/terminal-bridge.ts`  
**Lines**: 72, 110  
**KB Reference**: KB-09 (Terminal)

## Description

The ACP SDK's `CreateTerminalRequest` supports `args?: string[]` but the L0 `TerminalCreateOptions` type lacks this field. This forces all arguments into the command string and requires `shell: true` for the spawn fallback, increasing shell injection risk.

## Source Evidence

`src/types/registry.ts` lines 238-245:
```typescript
export type TerminalCreateOptions = {
  command?: string;
  env?: Record<string, string>;
  cwd?: string;
};
```

No `args` field. The spawn fallback (terminal-bridge.ts line ~109) uses:
```typescript
const proc = spawn(command, [], { shell: true, ... });
```

SDK `CreateTerminalRequest` (from types.gen.d.ts) includes:
```typescript
{ sessionId: string, command: string, args?: string[], cwd?: string, env?: EnvVariable[] }
```

### Verdict: CONFIRMED

The `TerminalCreateOptions` type is missing the `args` field that the ACP SDK supports. This forces shell interpretation and prevents safe argument passing.

## Remediation

1. Add `args?: string[]` to `TerminalCreateOptions` in `src/types/registry.ts`
2. Pass `args` through to `conn.createTerminal()` in the ACP path
3. In the spawn fallback, use `spawn(command, args ?? [], { shell: !args?.length, ... })` to avoid shell interpretation when args are provided
