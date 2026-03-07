# ISS-048: ITerminal interface diverges from ACP spec

**Severity**: Major
**File**: src/types/registry.ts
**Line(s)**: 233-244
**Topic**: Filesystem & Terminal

## Issue Description
`ITerminal` interface diverges from spec. Spec: `create(opts: { command?, env?, cwd? }): Promise<ITerminalSession>`. Actual: `create(command, args?): Promise<TerminalHandle>`. Align with options-object + `ITerminalSession` pattern.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/07-filesystem-terminal.md, lines 400-425
- **Spec Says**: `ITerminal` should have: `create(opts: { command?: string; env?: Record<string, string>; cwd?: string }): Promise<ITerminalSession>`. The `terminal/create` wire format (lines 209-258) accepts `command`, `env`, and `cwd` as optional fields in the params object. Returns a `terminalId` wrapped in an `ITerminalSession` with methods: `getOutput()`, `waitForExit()`, `kill()`, `release()`.
- **Confirmed**: Yes
- **Notes**: The spec uses an options object pattern (command is optional — omitting it opens an interactive shell), not positional parameters.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 235 defines `create(command: string, args?: string[]): Promise<TerminalHandle>`. This differs from the spec in three ways: (1) `command` is a required positional parameter, not an optional field in an options object; (2) `args` is a separate parameter instead of being part of the command string; (3) returns `TerminalHandle` (an opaque identifier) instead of `ITerminalSession` (an object with methods). The `env` and `cwd` parameters are entirely missing.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Refactor `ITerminal.create` to accept an options object:
   ```typescript
   create(opts: { command?: string; env?: Record<string, string>; cwd?: string }): Promise<ITerminalSession>;
   ```
2. Define `ITerminalSession` interface with `getOutput()`, `waitForExit()`, `kill()`, `release()` methods.
3. Update all implementations and callers to use the new signature.
4. The existing `output()`, `waitForExit()`, `kill()`, `release()` methods on `ITerminal` should move to `ITerminalSession`.
