# ISS-006 — Module-Level toolCallEmitter Last-Writer-Wins in Daemon Mode

**Severity**: Critical
**File**: src/main.ts:196-198
**KB Topic**: Implementation Guide Section 3 — Agent Factory Pattern (10-implementation-guide.md)

## Original Issue
Each new TCP connection overwrites the shared `toolCallEmitter` reference. WRFC callbacks from earlier connections emit tool_call updates to the wrong (most recent) ACP connection. The comment on line 197 acknowledges the issue but does not fix it.

## Verification

### Source Code Check
```typescript
// src/main.ts:196-198
// Wire toolCallEmitter to this connection (last-writer-wins in daemon mode,
// but each connection can have its own — set module-level for WRFC callbacks)
toolCallEmitter = new ToolCallEmitter(conn);
```
The code assigns a new `ToolCallEmitter` to a module-level variable on each connection. The comment explicitly acknowledges the last-writer-wins problem but does not fix it.

### ACP Spec Check
KB-10 (10-implementation-guide.md) Section 3 describes the Agent Factory Pattern: each connection should have its own `AgentSideConnection`. WRFC callbacks bound to one connection's emitter must not leak updates to a different connection.

The ACP protocol requires per-session isolation. Emitting tool_call updates to the wrong connection is cross-session data leakage — the wrong client receives WRFC progress updates, while the originating client receives nothing.

### Verdict: CONFIRMED
The code has a known concurrency bug in daemon mode. When multiple connections are active simultaneously, all WRFC callbacks route to the most recent connection's emitter. This causes cross-session data leakage and protocol corruption. The comment acknowledges the issue.

## Remediation
1. Remove the module-level `toolCallEmitter` variable
2. Scope the `ToolCallEmitter` per-connection (pass it through to WRFC orchestrator per-invocation)
3. Use a map of `sessionId -> ToolCallEmitter` for WRFC callback routing, or
4. Inject the emitter directly into the WRFC orchestrator constructor so each chain has its own reference
