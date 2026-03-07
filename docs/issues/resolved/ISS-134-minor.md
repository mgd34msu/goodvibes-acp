# ISS-134 — `_pendingResolvers` Map Uses Object Reference Equality

**Severity**: Minor
**File**: src/extensions/agents/coordinator.ts
**KB Topic**: TypeScript SDK

## Original Issue
`_pendingResolvers` uses object reference equality for Map keys — breaks if configs are cloned.

## Verification

### Source Code Check
At lines 80-86 of `src/extensions/agents/coordinator.ts`:
```typescript
return new Promise<AgentHandle>((resolve, reject) => {
  this._pendingResolvers.set(config, { resolve, reject });
  this._queue.enqueue(config);
});
```
And at lines 173-174 in `_drainQueue()`:
```typescript
const resolvers = this._pendingResolvers.get(nextConfig);
this._pendingResolvers.delete(nextConfig);
```
The map `_pendingResolvers` is declared as `Map<AgentConfig, ...>` (lines 125-128). JavaScript `Map` uses SameValueZero for key comparison, which for objects is reference equality. This is correct as long as the same object reference is enqueued and dequeued — which is the case here since `Queue.dequeue()` returns the same object that was enqueued.

However, the comment in the code at line 82-83 acknowledges this: "Uses reference equality (Map key = object reference)." If any code path clones or spreads the `AgentConfig` before dequeuing (e.g., `{ ...config }` in a middleware or decorator), the `pendingResolvers.get(nextConfig)` call would return `undefined` and the resolver would be silently lost, causing the caller's `spawn()` promise to hang forever.

### ACP Spec Check
This is an internal coordination pattern with no ACP spec relevance.

### Verdict: NOT_ACP_ISSUE
The issue is real as a code quality concern — the implicit coupling to reference identity creates a fragile invariant. However, within the current codebase the `Queue` preserves references so it works. This is a latent bug risk, not an ACP compliance issue.

## Remediation
Replace object-reference keying with a generated correlation ID:
```typescript
// Add to AgentConfig or use a wrapper
type PendingItem = {
  id: string;
  config: AgentConfig;
  resolve: (h: AgentHandle) => void;
  reject: (err: unknown) => void;
};

private readonly _pendingResolvers = new Map<string, PendingItem>();

// In spawn():
const pendingId = crypto.randomUUID();
this._pendingResolvers.set(pendingId, { id: pendingId, config, resolve, reject });
this._queue.enqueue({ ...config, _pendingId: pendingId });

// In _drainQueue():
const pendingId = nextConfig._pendingId;
const item = this._pendingResolvers.get(pendingId);
```
Alternatively, wrap configs in a stable container object at enqueue time.
