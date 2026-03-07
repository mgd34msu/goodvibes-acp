# ISS-169 — MemoryManager Is Cross-Session Only, No Session-Scoped Persistence

**Severity**: Nitpick
**File**: src/extensions/memory/manager.ts:88-97
**KB Topic**: Sessions

## Original Issue
**[src/extensions/memory/manager.ts:88-97]** `MemoryManager` is purely cross-session; no session-scoped state persistence mechanism exists. *(Sessions)*

## Verification

### Source Code Check
The `MemoryManager` class:
```typescript
export class MemoryManager {
  private readonly _basePath: string;
  private readonly _bus: EventBus;
  private _store: MemoryStore;

  constructor(basePath: string, eventBus: EventBus) {
    this._basePath = basePath;
    this._bus = eventBus;
    this._store = emptyStore();
  }
```
JSDoc comment confirms: "Cross-session memory manager. Stores records in a single `memory.json` file within `basePath`." The `MemoryManager` is indeed designed for cross-session memory (decisions, patterns, failures) — not session-specific state. The `SessionManager` in `src/extensions/sessions/manager.ts` handles per-session config and history, but no dedicated session-scoped persistence layer exists for arbitrary session state.

### ACP Spec Check
The ACP specification does not define a memory or persistence architecture for agents. The spec defines `session/load` for session resumption (requiring history replay), but does not prescribe how agents internally persist or organize their memory. This is entirely an agent implementation concern.

### Verdict: NOT_ACP_ISSUE
The absence of session-scoped state persistence is an architectural observation about the GoodVibes memory system, not an ACP protocol compliance issue. The spec does not mandate any particular memory architecture. The `SessionManager` does handle session-specific data (config, history) — the issue conflates "session-scoped" (which exists for protocol-relevant data) with general-purpose in-session state (which is implementation-specific).

## Remediation
N/A — Not an ACP compliance issue.
