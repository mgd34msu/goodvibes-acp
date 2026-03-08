# ISS-020 — Hook Engine Silently Swallows All Errors

**Severity**: Major
**File**: src/core/hook-engine.ts:179,202
**KB Topic**: Extensibility — Forward Compatibility / Error Handling (08-extensibility.md lines 340-341)

## Original Issue
Both `execute()` and `executePost()` have empty `catch {}` blocks that silently swallow all errors. Hook failures produce no observable signal. KB-08: "Log for debugging, but don't crash." Silent error swallowing makes hook failures completely invisible.

## Verification

### Source Code Check
At `hook-engine.ts:179` (in `execute()`):
```typescript
} catch {
  // Error isolation: continue with unchanged context
}
```

At `hook-engine.ts:202` (in `executePost()`):
```typescript
} catch {
  // Error isolation: continue to next hook
}
```

Both catch blocks discard the error entirely. No logging, no event emission, no metrics. The comment says "error isolation" but the implementation is "error destruction."

### ACP Spec Check
KB-08 (extensibility.md line 340-341) provides the pattern:
```typescript
async function handleUnknownExtMethod(method: string, params: unknown): Promise<unknown> {
  // Log for debugging, but don't crash
  console.warn(`Unknown extension method: ${method}`);
  return null;
}
```

The spec guidance is "log for debugging, but don't crash." The code follows the "don't crash" part but ignores the "log for debugging" part entirely.

### Verdict: CONFIRMED
The empty catch blocks violate the ACP guidance of logging errors for debugging. While the spec correctly advises not crashing on extension errors, it explicitly calls for logging. Silent error swallowing makes it impossible to diagnose hook failures, which could mask critical issues like permission gate failures, validation errors, or broken integrations. This is especially dangerous because the permission system (ISS-018) relies on hooks.

## Remediation
1. Add error logging to both catch blocks. At minimum:
```typescript
} catch (err) {
  // Error isolation: log but don't crash
  console.warn(`Hook ${hookPoint} pre-handler failed:`, err);
}
```
2. Optionally emit an event via EventBus for observability:
```typescript
this._bus?.emit('hook:error', { hookPoint, phase: 'pre', error: err });
```
3. Consider adding a configurable error handler or debug mode that can surface these errors more prominently during development
4. Ensure the error parameter is captured in the catch clause (`catch (err)` not `catch`)
