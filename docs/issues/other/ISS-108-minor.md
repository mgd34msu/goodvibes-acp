# ISS-108 — DirectiveQueue.process() Misses Concurrently Enqueued Directives

**Severity**: Minor
**File**: src/extensions/directives/queue.ts:217
**KB Topic**: Prompt Turn

## Original Issue
`process()` drains ALL directives before processing — misses concurrently enqueued directives during drain window. *(Prompt Turn)*

## Verification

### Source Code Check
`src/extensions/directives/queue.ts:214-235`:
```typescript
async process(
  handler: (directive: Directive) => Promise<DirectiveResult>,
): Promise<DirectiveResult[]> {
  const directives = this.drain();  // snapshot at call time
  const results: DirectiveResult[] = [];

  for (const directive of directives) {
    // ... sequential await handler(directive)
  }
```

`this.drain()` is called once to take a snapshot of the queue at call time. Any directives enqueued **during** the sequential `await handler(directive)` processing loop will be missed until the next `process()` call. Since each handler is awaited sequentially, there is a non-trivial window during which new directives could arrive unprocessed.

### ACP Spec Check
The ACP specification does not define directive queue semantics, processing order guarantees, or requirements about how agents handle internally enqueued directives. Directive processing is an internal orchestration concept in this codebase, not part of the ACP wire protocol.

### Verdict: NOT_ACP_ISSUE
The issue is real from a correctness standpoint — directives enqueued while `process()` is running will wait until the next invocation. Whether this is a bug or intentional "process-per-tick" semantics depends on the caller pattern. However, this is purely an internal queue implementation concern with no bearing on ACP protocol compliance. No ACP wire messages are affected.

## Remediation
N/A for ACP compliance. For code quality:
1. If the intent is to process all directives including those enqueued during processing, implement a loop:
   ```typescript
   async process(handler: ...): Promise<DirectiveResult[]> {
     const allResults: DirectiveResult[] = [];
     let batch: Directive[];
     while ((batch = this.drain()).length > 0) {
       for (const directive of batch) {
         // ... process
       }
       allResults.push(...results);
     }
     return allResults;
   }
   ```
2. If the current snapshot behavior is intentional, document it explicitly in the JSDoc.
