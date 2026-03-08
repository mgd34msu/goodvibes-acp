# ISS-031 — Entry Point index.ts Is a Placeholder — No ACP Connection

**Severity**: Major
**File**: index.ts:1
**KB Topic**: Initialization — Entry Point (10-implementation-guide.md sections 1-2)

## Original Issue
`index.ts` is a placeholder that does not implement the ACP agent startup sequence. No stdin/stdout ndJsonStream connection, no `AgentSideConnection` instantiation, no agent factory wiring.

## Verification

### Source Code Check
The entire contents of `index.ts` is:
```typescript
console.log("Hello via Bun!");
```
This is a 1-line placeholder with no ACP-related code whatsoever.

### ACP Spec Check
KB-10 (Implementation Guide, sections 1-2) specifies the entry point must:
1. Create an `ndJsonStream` from `stdin`/`stdout`
2. Instantiate `AgentSideConnection` with the agent factory
3. Handle the `initialize` handshake

The ACP spec (`llms-full.txt`) confirms agents communicate over newline-delimited JSON-RPC 2.0 streams and must respond to `initialize` before any other messages.

### Verdict: CONFIRMED
The entry point is literally `console.log("Hello via Bun!")`. No ACP connection, no JSON-RPC transport, no agent factory. The agent cannot accept any ACP connections through this entry point.

## Remediation
1. Replace `index.ts` with proper ACP agent startup:
   ```typescript
   import { createNdJsonStream } from './transport.js';
   import { AgentSideConnection } from '@anthropic/acp-sdk';
   import { createAgentFactory } from './agent-factory.js';

   const stream = createNdJsonStream(process.stdin, process.stdout);
   const connection = new AgentSideConnection(stream, createAgentFactory());
   ```
2. Wire the agent factory to produce agent instances that handle `initialize`, `session/new`, `session/prompt`, etc.
3. Ensure the connection is properly torn down on SIGINT/SIGTERM.
