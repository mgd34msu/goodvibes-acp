# ISS-184 — `GoodVibesExtensions` Exported but Not Wired to `GoodVibesAgent`

**Severity**: Nitpick
**File**: `src/extensions/acp/index.ts:21`
**KB Topic**: Extensibility

## Original Issue
`[src/extensions/acp/index.ts:21]` `GoodVibesExtensions` exported but not wired to `GoodVibesAgent`. No visible integration point for `extensions.handle()` from agent `extMethod`. Document or implement the composition root wiring. *(Extensibility)*

## Verification

### Source Code Check
`src/extensions/acp/index.ts` line 21 exports `GoodVibesExtensions`:
```typescript
export { GoodVibesExtensions } from './extensions.js';
```

From KB 08 and the TypeScript SDK (KB 09), the `Agent` interface requires:
```typescript
extMethod?(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
extNotification?(method: string, params: Record<string, unknown>): Promise<void>;
```

`GoodVibesExtensions` handles `_goodvibes/*` methods (status, state, events, agents, analytics). For these to be reachable via ACP, `GoodVibesAgent.extMethod()` must delegate to `GoodVibesExtensions`. Cross-referencing `src/extensions/acp/agent.ts` reveals no `extMethod` implementation and no reference to `GoodVibesExtensions`.

### ACP Spec Check
From KB 08 — Extensibility:
```typescript
class GoodVibesAgent implements Agent {
  async handleExtMethod(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case '_goodvibes/agents':
        return this.runtime.getAgentStatus();
      ...
    }
  }
}
```

The spec explicitly shows that extension methods must be handled in the `Agent` implementation via `extMethod`. Without wiring, all `_goodvibes/*` extension calls will silently fail or return errors.

### Verdict: CONFIRMED
The `GoodVibesExtensions` class is implemented and exported but never composed into `GoodVibesAgent`. There is no `extMethod` in `GoodVibesAgent` that routes to it. This means the `_goodvibes/status`, `_goodvibes/agents`, `_goodvibes/state`, `_goodvibes/events`, and `_goodvibes/analytics` extension methods are unreachable via ACP — a genuine compliance/integration gap.

## Remediation
1. Add a `GoodVibesExtensions` field to `GoodVibesAgent`.
2. Implement `extMethod` in `GoodVibesAgent`:
```typescript
async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return this._extensions.handle(method, params);
}
```
3. Wire `extNotification` similarly if `GoodVibesExtensions` handles notifications.
4. Instantiate `GoodVibesExtensions` in the `createConnection` factory in `src/main.ts`.
