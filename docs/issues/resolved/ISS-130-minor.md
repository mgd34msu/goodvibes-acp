# ISS-130 — `LogsManager.ensureFiles()` called on every log write — redundant I/O

**Severity**: Minor
**File**: `src/extensions/logs/manager.ts`
**Lines**: 158-180
**KB Topic**: KB-04: Performance

## Original Issue
Each log write invokes `ensureFiles()` which does 3 `readFile` checks plus potential `mkdir`. Wasteful during busy turns.

## Verification

### Source Code Check
Confirmed in manager.ts:
- `logActivity()` (line 159): `await this.ensureFiles();`
- `logDecision()` (line 167): `await this.ensureFiles();`
- `logError()` (line 175): `await this.ensureFiles();`

The `ensureFiles()` method (lines 133-156) creates the directory with `mkdir` and then checks 3 files via `readFile`, creating them with headers if they don't exist. Every single log write pays this I/O cost even after the files have already been verified to exist.

### ACP Spec Check
KB-04 discusses performance considerations for the prompt/turn lifecycle. While not a protocol violation, redundant I/O during busy turn processing (multiple tool calls generating logs) adds unnecessary latency. In a high-activity turn with 10+ tool calls, this could mean 30+ unnecessary file existence checks.

### Verdict: CONFIRMED
The `ensureFiles()` call on every log write is confirmed. After the first successful call, subsequent calls are pure overhead.

## Remediation
1. Add a private `_filesEnsured: boolean = false` flag to `LogsManager`.
2. In `ensureFiles()`, check `if (this._filesEnsured) return;` at the top.
3. Set `this._filesEnsured = true;` at the end of a successful `ensureFiles()` call.
4. Optionally, call `ensureFiles()` once during construction or initialization instead of lazily on first write.
