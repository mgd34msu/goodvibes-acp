# ISS-131: `LogsManager.prependEntry()` has TOCTOU race on concurrent writes

**Source**: `src/extensions/logs/manager.ts` lines 81-117
**KB Reference**: KB-04 (Concurrent Tool Calls)
**Severity**: Major

### Verdict: CONFIRMED

The `prependEntry()` function performs a non-atomic read-then-write sequence using `readFile` followed by `writeFile`. When multiple parallel tool calls trigger concurrent log writes, the following race exists:

1. Call A reads existing content
2. Call B reads existing content (same as A)
3. Call A writes its merged content
4. Call B writes its merged content, overwriting Call A's entry

No mutex, write queue, or atomic file operation is used. This is a textbook TOCTOU (time-of-check-to-time-of-use) vulnerability.

### Remediation

1. Introduce a per-file write mutex or serialized write queue to ensure log entries are written sequentially
2. Alternatively, switch to `appendFile` which is atomic at the OS level for appending, removing the need for read-then-write
3. If prepend ordering is required, use a write-ahead queue that batches entries before flushing to disk
