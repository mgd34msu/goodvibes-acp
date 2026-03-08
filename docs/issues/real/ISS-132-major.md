# ISS-132: `MemoryManager.load()` throws opaque error on malformed JSON

**Source**: `src/extensions/memory/manager.ts` lines 150-154
**KB Reference**: KB-03 (Session Persistence)
**Severity**: Major

### Verdict: CONFIRMED

The `load()` method calls `JSON.parse(raw)` inside a try block. The catch block only handles `ENOENT` (file not found). If the JSON file exists but contains malformed content, `JSON.parse` throws a `SyntaxError` that propagates uncaught with no indication of which file failed or what the content looked like.

This makes debugging corrupted memory files difficult in production, especially when multiple memory files may exist across sessions.

### Remediation

1. Add a separate catch clause for `SyntaxError` that wraps the error with the file path and a descriptive message (e.g., "Failed to parse memory file at {filePath}: {originalMessage}")
2. Consider logging the first N characters of the malformed content to aid debugging
3. Optionally fall back to an empty store with a warning rather than crashing, to improve resilience
