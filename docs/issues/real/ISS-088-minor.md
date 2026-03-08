# ISS-088: markReady() silently ignored in non-starting states

**Source**: `src/extensions/lifecycle/health.ts` line 62  
**KB Reference**: KB-10 (Health Check Lifecycle)  
**Severity**: Minor

## Description

`markReady()` only transitions from `starting` to `ready`. If called in any other state (e.g., `ready`, `shutting_down`, `degraded`), the call is silently ignored with no logging, making debugging lifecycle issues difficult.

## Evidence

`health.ts:62`:
```typescript
markReady(): void {
  if (this._status === 'starting') {
    this._status = 'ready';
    this._eventBus.emit('lifecycle:health-ready', { uptime: Date.now() - this._startedAt });
  }
}
```

No `else` branch or logging when the condition is false. Compare with `markShuttingDown()` which unconditionally sets state -- a different approach but equally undocumented.

### Verdict: CONFIRMED

The silent no-op makes it hard to diagnose cases where `markReady()` is called at the wrong time in the lifecycle. A debug log would aid troubleshooting without changing behavior.

## Remediation

1. Add a debug-level log in the else branch:
```typescript
markReady(): void {
  if (this._status === 'starting') {
    this._status = 'ready';
    this._eventBus.emit('lifecycle:health-ready', { uptime: Date.now() - this._startedAt });
  } else {
    console.error(`[HealthCheck] markReady() ignored: current status is '${this._status}'`);
  }
}
```
2. This preserves existing behavior while providing observability.
