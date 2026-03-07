# ISS-117 — terminal/create ACP Call Passes Non-Spec `args` Field and Omits `env`

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts:70-86
**KB Topic**: Filesystem & Terminal

## Original Issue

**[src/extensions/acp/terminal-bridge.ts:70-86]** `terminal/create` ACP call passes `args` field not in spec wire format. Spec params: `sessionId`, `command`, `env`, `cwd`. Also `env` is never forwarded despite spec support. Remove `args` (concatenate into command), add `env`. *(Filesystem & Terminal)*

## Verification

### Source Code Check

`terminal-bridge.ts` lines 70-86:

```typescript
async create(command: string, args?: string[]): Promise<TerminalHandle> {
  const id = `term-${this._nextId++}`;
  const fullCommand = args && args.length > 0 ? `${command} ${args.join(' ')}` : command;
  const handle: TerminalHandle = { id, command: fullCommand, createdAt: Date.now() };

  if (this.clientCapabilities.terminal) {
    // ACP-backed terminal
    const acpHandle = await this.conn.createTerminal({
      command,
      args: args ?? [],
      sessionId: this.sessionId,
      cwd: this.cwd,
    });
    // ...
  }
}
```

The `conn.createTerminal()` call passes:
- `command` ✓ (in spec)
- `args: args ?? []` ✗ (NOT in spec wire format)
- `sessionId` ✓ (in spec)
- `cwd` ✓ (in spec)
- `env` ✗ (MISSING — spec supports it, method signature takes `command: string, args?: string[]` so env can't be forwarded)

### ACP Spec Check

KB `07-filesystem-terminal.md` defines `terminal/create` params:

| Field | Type | Required | Description |
|-------|------|----------|--------------|
| `sessionId` | string | yes | Active session ID |
| `command` | string | no | Command to run (if omitted, opens interactive shell) |
| `env` | object | no | Environment variable overrides |
| `cwd` | string | no | Working directory (defaults to session cwd) |

No `args` field exists in the spec. The spec treats the command as a full string (shell-parsed), not as separate argv components. The spec's TypeScript example:
```typescript
const { terminalId } = await conn.createTerminal({
  sessionId: session.id,
  command: 'npm run build',
  cwd: session.cwd
});
```

Two problems confirmed:
1. `args` is passed but not in spec — compliant clients will ignore it (silently dropped) but it pollutes the wire message.
2. `env` is never forwarded even though the spec supports it and it may be critical for correct process behavior.

### Verdict: CONFIRMED

Both parts of the issue are confirmed:
1. The `args` field is passed in the ACP call but is not part of the `terminal/create` spec wire format. The code already computes `fullCommand` (line 72) combining command + args — that value should be what's passed to the ACP call.
2. The `create()` method signature `(command: string, args?: string[])` makes it impossible to forward `env`. The method should be refactored to accept an options object per the ACP-aligned `ITerminal` spec interface.

## Remediation

1. Change the `AcpTerminal.create()` method signature to accept an options object:
   ```typescript
   async create(opts: { command?: string; args?: string[]; env?: Record<string, string>; cwd?: string }): Promise<TerminalHandle>
   ```
2. Concatenate command + args into a single command string before calling ACP:
   ```typescript
   const command = opts.args?.length
     ? `${opts.command} ${opts.args.join(' ')}`
     : opts.command;
   ```
3. Pass `env` to `conn.createTerminal()`:
   ```typescript
   await this.conn.createTerminal({
     sessionId: this.sessionId,
     command,
     env: opts.env,
     cwd: opts.cwd ?? this.cwd,
   });
   ```
4. Update `ITerminal` interface in `src/types/registry.ts` to match (see also ISS-48).
5. Update all callers of `AcpTerminal.create()` to use the new signature.
