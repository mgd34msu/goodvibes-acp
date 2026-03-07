# ISS-131 — `currentOutput()` Response Field Name Unverified

**Severity**: Minor
**File**: src/extensions/acp/terminal-bridge.ts
**KB Topic**: TypeScript SDK

## Original Issue
`currentOutput()` response accessed as `result.output` — verify actual field name from SDK types.

## Verification

### Source Code Check
At line 138-139 of `src/extensions/acp/terminal-bridge.ts`:
```typescript
const result = await internal.acpHandle.currentOutput();
return result.output;
```
`currentOutput()` is called on `AcpTerminalHandle` (the SDK's `TerminalHandle` class). The result is accessed as `result.output`.

### ACP Spec Check
From KB `09-typescript-sdk.md`, the `TerminalHandle` class exposes:
```typescript
currentOutput(): Promise<TerminalOutputResponse>;
```
The KB also lists `TerminalOutputRequest / TerminalOutputResponse` as SDK types but does not explicitly state the field name within `TerminalOutputResponse`. The Client interface shows:
```typescript
terminalOutput?(params: TerminalOutputRequest): Promise<TerminalOutputResponse>;
```
The KB does not document the shape of `TerminalOutputResponse` explicitly. However, the issue itself notes this is a verification gap — the field *might* be `output`, but this needs to be confirmed against the actual SDK `.d.ts` types rather than the KB alone.

### Verdict: CONFIRMED
The issue is real: the code accesses `result.output` without documented verification against the SDK's `TerminalOutputResponse` type definition. The KB does not name the field, meaning this access could be wrong. The issue correctly identifies a field name that must be verified against the SDK types. Per the KB example showing `terminal.currentOutput()` used but the field not named, this is a genuine unverified SDK type access.

## Remediation
1. Inspect the actual SDK type definition: `node_modules/@agentclientprotocol/sdk/dist/acp.d.ts` for `TerminalOutputResponse`.
2. If the field is named `output`, add a comment citing the type definition.
3. If the field has a different name (e.g., `text` or `stdout`), update lines 139 and 165 of `terminal-bridge.ts` accordingly.
4. Add a type assertion or intermediate typed variable to make the type visible: `const result: TerminalOutputResponse = await internal.acpHandle.currentOutput();`.
