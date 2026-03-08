# Wave 2 Review: Core EventBus & Registry

**Reviewer**: goodvibes:reviewer (Iteration 3)  
**Date**: 2026-03-07  
**Scope**: `src/core/event-bus.ts`, `src/core/registry.ts`, `src/core/queue.ts`, `src/core/index.ts`  
**KB References**: `docs/acp-knowledgebase/01-overview.md`, `docs/acp-knowledgebase/08-extensibility.md`  
**ACP Spec**: Fetched from `https://agentclientprotocol.com/llms-full.txt`

---

## Score: 8.2 / 10

## Issues Found: 8

---

### Issue 1

**Severity**: Major  
**File**: `src/core/event-bus.ts`  
**Line**: 167  
**KB Topic**: Extensibility (`_meta` propagation)  

**Description**: The `emit()` method signature accepts `type`, `payload`, and `sessionId` but provides no way for callers to pass `_meta` data through to the `EventRecord`. The `_meta` field exists on `EventRecord` (line 27) but is never populated during emission. Per KB-08, `_meta` is the canonical mechanism for W3C trace context propagation (`traceparent`, `tracestate`, `baggage`) and vendor-specific metadata. Without an emit-time path for `_meta`, distributed tracing across the ACP boundary is impossible through the event system.

**ACP Requirement**: KB-08 Section "The `_meta` Field" - every protocol type includes optional `_meta`; KB-08 Section "W3C Trace Context Integration" - trace context must be injectable into event carriers.

**Suggested Fix**: Add an optional `options` parameter to `emit()` that includes `_meta`:
```typescript
emit<TPayload = unknown>(
  type: string,
  payload: TPayload,
  options?: { sessionId?: string; _meta?: Record<string, unknown> }
): void {
  const record: EventRecord<TPayload> = {
    id: this._nextId(),
    type,
    payload,
    timestamp: Date.now(),
    sessionId: options?.sessionId ?? (payload as any)?.sessionId,
    _meta: options?._meta,
  };
  // ...
}
```

---

### Issue 2

**Severity**: Minor  
**File**: `src/core/event-bus.ts`  
**Line**: 320-325  
**KB Topic**: Extensibility (`_meta` on error events)  

**Description**: The `_emitError()` private method constructs error `EventRecord` objects without propagating the `_meta` from the source event that caused the error. When a handler fails during processing of a traced event, the error record loses the trace context, breaking the distributed tracing chain. The error record should carry forward the originating event's `_meta` so observability tools can correlate errors with their causal requests.

**ACP Requirement**: KB-08 - `_meta` available on all protocol types; W3C trace context should propagate through error paths.

**Suggested Fix**: Accept the source event's `_meta` in `_emitError` and forward it:
```typescript
private _emitError(sourceType: string, err: unknown, sourceMeta?: Record<string, unknown>): void {
  // ...
  const record: EventRecord = {
    id: this._nextId(),
    type: 'error',
    payload: errorPayload,
    timestamp: Date.now(),
    _meta: sourceMeta,
  };
}
```

---

### Issue 3

**Severity**: Major  
**File**: `src/core/event-bus.ts`  
**Line**: 198-205  
**KB Topic**: Performance (prefix wildcard matching)  

**Description**: Every call to `emit()` iterates over ALL registered handler keys to check for prefix wildcard matches (e.g., `session:*`). This is O(k) where k is the total number of distinct event type subscriptions. In a production ACP agent with many event types (session events, agent events, tool events, directive events, lifecycle events), this linear scan on every emit becomes a performance bottleneck. The ACP spec's `session/update` notification fires at high frequency during prompt turns with streaming.

**ACP Requirement**: KB-01 Section "Notifications the Agent Sends" - `session/update` is the streaming notification with 9+ update types, all firing through the event bus during active prompt processing.

**Suggested Fix**: Pre-index prefix wildcards at subscription time into a separate `Map<string, Set<EventHandler>>` keyed by the prefix (e.g., `"session:"` for `"session:*"`). On emit, check the event type's prefix segments against this map instead of scanning all keys:
```typescript
private readonly _prefixHandlers = new Map<string, Set<EventHandler>>();

// In on(), when event ends with ':*':
if (event.endsWith(':*')) {
  const prefix = event.slice(0, -1);
  if (!this._prefixHandlers.has(prefix)) {
    this._prefixHandlers.set(prefix, new Set());
  }
  this._prefixHandlers.get(prefix)!.add(handler);
}

// In emit(), replace the loop with prefix lookup:
const colonIdx = type.indexOf(':');
if (colonIdx !== -1) {
  const prefix = type.slice(0, colonIdx + 1);
  const prefixSet = this._prefixHandlers.get(prefix);
  if (prefixSet) sets.push(prefixSet);
}
```

---

### Issue 4

**Severity**: Minor  
**File**: `src/core/event-bus.ts`  
**Line**: 147-154  
**KB Topic**: Correctness (once() race condition)  

**Description**: The `once()` method uses a `disposed` boolean flag to ensure the handler fires only once. However, if the event bus is used in an environment with concurrent async handlers (which it explicitly supports per line 57-58), two near-simultaneous emissions of the same event type could both pass the `if (!disposed)` check before either sets `disposed = true`. This is a theoretical race in single-threaded JS only if the handler itself is async and yields, but the pattern is fragile.

**ACP Requirement**: KB-01 - event system must handle streaming updates reliably during prompt turns.

**Suggested Fix**: Set `disposed = true` and call `this.off()` before invoking the handler, ensuring the unsubscribe is immediate regardless of handler execution:
```typescript
const wrapped: EventHandler<TPayload> = (ev) => {
  if (!disposed) {
    disposed = true;
    this.off(event, wrapped as EventHandler);
    return handler(ev);
  }
};
```
Note: This is already the current implementation pattern (line 149-151 does set disposed before calling handler). Confirmed as non-issue on re-inspection. **Downgraded to Nitpick** - the code is correct but could benefit from an inline comment explaining the ordering is intentional for race safety.

---

### Issue 5

**Severity**: Minor  
**File**: `src/core/queue.ts`  
**Line**: 188-193  
**KB Topic**: Robustness (schema version validation)  

**Description**: `Queue.restore()` accepts any `SerializedQueue<T>` without validating the `$schema` field against `QUEUE_SCHEMA_VERSION`. If the serialization format changes in a future version, restoring data from an incompatible schema silently produces corrupted state. The `$schema` field exists (line 21) and the version constant is defined (line 28), but they are never compared during deserialization.

**ACP Requirement**: KB-01 Section "Key Implementation Notes" point 4 - protocol version management is critical; same principle applies to internal serialization formats.

**Suggested Fix**: Validate schema version in `restore()`:
```typescript
static restore<T>(data: SerializedQueue<T>): Queue<T> {
  if (data.$schema !== QUEUE_SCHEMA_VERSION) {
    throw new Error(
      `Queue schema mismatch: expected ${QUEUE_SCHEMA_VERSION}, got ${data.$schema}`
    );
  }
  const queue = new Queue<T>();
  for (const { item, priority } of data.entries) {
    queue.enqueue(item, priority);
  }
  return queue;
}
```

---

### Issue 6

**Severity**: Minor  
**File**: `src/core/queue.ts`  
**Line**: 82  
**KB Topic**: Performance (sorted insertion via splice)  

**Description**: `enqueue()` uses binary search (O(log n)) to find the insertion point but then calls `Array.splice()` to insert, which is O(n) due to element shifting. For a directive queue or event queue under heavy load, this becomes the dominant cost. The binary search is well-implemented but the benefit is negated by the splice.

**ACP Requirement**: Implicit - ACP agents process streaming updates at high frequency; internal queues must not become bottlenecks.

**Suggested Fix**: For the current use case this is acceptable (directive queues are typically small). If queue sizes grow beyond ~1000 items, consider switching to a heap-based priority queue. Document the performance characteristic:
```typescript
// Note: O(n) insertion due to splice. Acceptable for queues < 1000 items.
// For larger queues, consider a binary heap implementation.
this._entries.splice(low, 0, entry);
```

---

### Issue 7

**Severity**: Nitpick  
**File**: `src/core/index.ts`  
**Line**: 58-59  
**KB Topic**: Organization (cross-layer re-exports)  

**Description**: The L1 Core barrel file re-exports types from `../types/trigger.js` and `../types/registry.js` (L0 types layer). While L1 importing from L0 is architecturally correct (downward dependency), re-exporting L0 types through the L1 barrel means consumers importing from `@l1/index` get a mix of L0 and L1 types. This blurs the layer boundary and could cause confusion about where types originate.

**ACP Requirement**: Source file headers (lines 1-5 of each file) explicitly declare L1 layer discipline.

**Suggested Fix**: Either document the re-exports with comments explaining why L0 types are surfaced through L1, or create a separate `@l0/index` barrel for pure types and have consumers import from the appropriate layer.

---

### Issue 8

**Severity**: Major  
**File**: `src/core/registry.ts`  
**Line**: 97-103  
**KB Topic**: Type Safety (unsafe cast without validation)  

**Description**: `get<T>()` casts `unknown` to `T` with `as T` (line 103) without any runtime type validation. The WARNING comments (lines 38-39, 44-45) acknowledge this but the risk remains: if a consumer calls `registry.get<IToolProvider>('precision')` but a different type was registered under that key, there is no error at registration or retrieval time -- the bug manifests as a runtime type error far from the source. This is especially dangerous in an ACP agent where plugins from different layers register implementations at startup.

**ACP Requirement**: KB-01 Section "Capabilities System" - capabilities gate method availability; the registry serves an analogous role internally, and type mismatches could cause silent failures in capability resolution.

**Suggested Fix**: Consider adding an optional type-tag validation mechanism:
```typescript
register<T>(key: string, impl: T, typeTag?: string): void {
  if (this._single.has(key)) {
    throw new Error(`Registry: key '${key}' is already registered.`);
  }
  this._single.set(key, { impl, typeTag });
}

get<T>(key: string, expectedTag?: string): T {
  const entry = this._single.get(key) as { impl: unknown; typeTag?: string } | undefined;
  if (!entry) throw new Error(`Registry: key '${key}' is not registered.`);
  if (expectedTag && entry.typeTag && entry.typeTag !== expectedTag) {
    throw new Error(`Registry: type mismatch for '${key}': expected '${expectedTag}', got '${entry.typeTag}'`);
  }
  return entry.impl as T;
}
```
Alternatively, accept this as a known trade-off for simplicity and add a `validateAll()` method for startup-time verification.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 9/10 | No injection risks, no secrets exposure |
| Error Handling | 8/10 | Error isolation good; `_meta` lost on error path |
| Testing | N/A | Tests not in review scope |
| Organization | 8/10 | Clean layer discipline; minor cross-layer re-export |
| Performance | 7/10 | O(k) wildcard scan per emit; O(n) queue splice |
| SOLID/DRY | 9/10 | Single responsibility well-maintained |
| Naming | 9/10 | Clear, consistent naming throughout |
| Maintainability | 8/10 | Good documentation; schema validation gap |
| Documentation | 9/10 | Excellent JSDoc, examples, layer annotations |
| Dependencies | 10/10 | Zero external deps, clean import graph |

## Reality Check Results

| Check | Status | Notes |
|-------|--------|-------|
| Files exist | PASS | All 4 files verified on disk |
| Exports used | PASS | EventBus (20+ importers), Registry (20+ importers), Queue (8 importers) |
| Import chain valid | PASS | All modules connected via barrel to entry points |
| No placeholders | PASS | No TODO/FIXME/stub implementations found |
| Integration verified | PASS | All exports actively imported and used across layers |

## Recommendations

1. **Immediate**: Add `_meta` parameter to `emit()` (Issue 1) -- this blocks W3C trace context propagation
2. **This iteration**: Validate `$schema` in `Queue.restore()` (Issue 5) -- one-line fix, prevents future data corruption
3. **Follow-up**: Pre-index prefix wildcards (Issue 3) -- performance improvement for high-frequency event paths
4. **Consider**: Type-tag validation for Registry (Issue 8) -- trade-off between simplicity and safety
