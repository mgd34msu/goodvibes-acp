# ISS-192 — Event IDs Use Date.now() + Counter, Not Globally Unique

**Severity**: Major
**File**: src/core/event-bus.ts:283-284
**KB Topic**: Overview

## Original Issue

**[src/core/event-bus.ts:283-284]** Event IDs use `Date.now() + counter` — not globally unique across instances/restarts. Use `crypto.randomUUID()`. *(Overview)*

## Verification

### Source Code Check

Lines 283-284 of `src/core/event-bus.ts`:
```typescript
private _nextId(): string {
  return `ev_${Date.now()}_${++this._idCounter}`;
}
```

The ID format is `ev_{timestamp}_{monotonic_counter}`. Within a single process instance this is effectively unique (timestamp + always-incrementing counter), but across process restarts, counter resets to 0 and if two instances start within the same millisecond they could produce identical IDs. The issue is confirmed.

### ACP Spec Check

The ACP Overview KB covers JSON-RPC message IDs (the `id` field on requests). ACP requires that request IDs be unique per connection — the spec says `id: 0` is convention for initialize, and IDs must be unique per connection. However, the `EventBus._nextId()` method generates IDs for *internal* GoodVibes events (emitted on the internal EventBus), not for outbound ACP JSON-RPC message IDs.

The ACP protocol does not specify how internal event buses should generate IDs. The ACP spec's `id` field uniqueness requirement applies to JSON-RPC request/response correlation, not to internal runtime event routing.

### Verdict: NOT_ACP_ISSUE

The issue is real: collision risk exists across process restarts or concurrent instances. Using `crypto.randomUUID()` would be strictly better. However, the ACP specification does not govern how internal event buses generate IDs. The `EventBus._nextId()` is not used for ACP wire-format message IDs — it is an internal routing identifier. This is a code quality / robustness issue, not an ACP compliance issue.

## Remediation

N/A (not an ACP compliance issue)

For robustness, replace the implementation:
```typescript
private _nextId(): string {
  return `ev_${crypto.randomUUID()}`;
}
```
