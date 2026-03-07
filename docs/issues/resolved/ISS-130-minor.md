# ISS-130 — TerminalHandle Imported as Value but Only Used as Type Annotation

**Severity**: Minor
**File**: `src/extensions/acp/terminal-bridge.ts:10`
**KB Topic**: TypeScript SDK

## Original Issue
`TerminalHandle` imported as value but only used as type annotation. Use `import type { TerminalHandle }`. *(TypeScript SDK)*

## Verification

### Source Code Check
Line 10:
```typescript
import { TerminalHandle as AcpTerminalHandle } from '@agentclientprotocol/sdk';
```

Line 23 (only usage):
```typescript
type AcpBackedHandle = {
  kind: 'acp';
  handle: TerminalHandle;
  acpHandle: AcpTerminalHandle;  // <-- type position only
};
```

`AcpTerminalHandle` appears only in the type annotation `acpHandle: AcpTerminalHandle` within the `AcpBackedHandle` type definition. It is never instantiated, called, or used as a value anywhere in the file. The SDK's `TerminalHandle` is a class (per KB-09 lines 560-577), so importing it as a value includes the class constructor in the bundle.

### ACP Spec Check
This issue is about TypeScript module semantics and bundle hygiene, not ACP protocol compliance. KB-09 confirms `TerminalHandle` is a class:
```typescript
class TerminalHandle {
  readonly id: string;
  currentOutput(): Promise<TerminalOutputResponse>;
  waitForExit(): Promise<TerminalWaitForExitResponse>;
  kill(): Promise<KillTerminalResponse>;
  release(): Promise<void>;
  [asyncDispose](): Promise<void>;
}
```

Using `import type` instead of `import` is a TypeScript best practice that:
1. Prevents the class from being included in runtime bundle output
2. Makes intent explicit — signals the symbol is type-only
3. Required by TypeScript's `verbatimModuleSyntax` or `isolatedModules` flags when only using a symbol as a type

This is not an ACP protocol compliance issue — it does not affect wire format, session behavior, or spec conformance.

### Verdict: NOT_ACP_ISSUE
The issue is real and the code confirms it — `AcpTerminalHandle` is only used as a type annotation but imported as a value. However, this is a TypeScript module hygiene issue, not an ACP compliance issue. It has no effect on ACP protocol behavior.

## Remediation
Change line 10 from:
```typescript
import { TerminalHandle as AcpTerminalHandle } from '@agentclientprotocol/sdk';
```
To:
```typescript
import type { TerminalHandle as AcpTerminalHandle } from '@agentclientprotocol/sdk';
```
This eliminates the value import and makes the type-only usage explicit.
