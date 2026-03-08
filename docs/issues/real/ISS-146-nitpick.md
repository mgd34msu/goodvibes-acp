# ISS-146 — Exit code sentinel inconsistency between spawn and ACP paths

**Severity**: nitpick
**File**: `src/extensions/acp/terminal-bridge.ts`
**Line**: 240
**KB Reference**: KB-07 (Terminal Exit)

## Issue Description

When exit code is null, the spawn path stores `-1` while the ACP path returns `0`. This means the same condition (process exit with null code) produces different values depending on the terminal backend.

## Source Evidence

- Line 134 (spawn on-exit handler): `internal.exitCode = code ?? -1;` — stores -1 for null exit code
- Line 202 (ACP waitForExit): `exitCode: exitResult.exitCode ?? 0` — returns 0 for null exit code
- Line 227 (spawn waitForExit): `exitCode: internal.exitCode ?? 0` — since exitCode is already -1 (not nullish), returns -1

Net effect: spawn-backed terminals report exit code -1 for null, ACP-backed terminals report 0.

### Verdict: CONFIRMED

The inconsistency is real. A null exit code from a spawn-backed process yields -1, while a null exit code from an ACP-backed process yields 0. Callers inspecting the exit code get different behavior depending on the backend.

## Remediation

1. Use a consistent sentinel value for null exit codes across both paths
2. Recommended: use `-1` consistently (line 202 should be `exitResult.exitCode ?? -1`)
3. Alternatively, preserve `null` and let callers decide the semantics
