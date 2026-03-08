# ISS-033 — Daemon mode CLI argument parsing does not validate port values

**Severity**: Minor
**File**: `src/main.ts`
**KB Topic**: KB-10: Entry Point

## Original Issue
`getArgValue` uses `indexOf` and does not validate that the next element is not another flag. `--port --host 127.0.0.1` would set `port` to `--host`, which `parseInt` turns into `NaN`.

## Verification

### Source Code Check
Lines 465-467 of `main.ts`:
```typescript
function getArgValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}
```
And lines 470-472:
```typescript
const daemonPort = parseInt(
  process.env.GOODVIBES_DAEMON_PORT ?? getArgValue('--port') ?? '9000',
  10,
);
```
There is no validation that `process.argv[idx + 1]` is not another flag (e.g., `--host`). `parseInt("--host", 10)` returns `NaN`. The parsed port value is never checked with `Number.isNaN()` or range-validated (1-65535).

### ACP Spec Check
KB-10 (Implementation Guide) documents the entry point bootstrap (line 170) but does not prescribe CLI argument parsing. This is an implementation robustness issue rather than a strict ACP compliance issue. However, an invalid port would prevent the ACP daemon from binding.

### Verdict: CONFIRMED
The argument parser does not validate that the value following a flag is not itself a flag, and does not validate the resulting port number. This can lead to `NaN` ports or out-of-range values.

## Remediation
1. After parsing, validate with `Number.isNaN(daemonPort)` and throw a descriptive error.
2. Add range validation: `if (daemonPort < 1 || daemonPort > 65535) throw new Error(...)`.
3. Optionally check that the value doesn't start with `--` to catch flag-as-value errors early.
4. Apply the same validation to `daemonHealthPort`.
