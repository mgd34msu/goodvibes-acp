# ISS-137: `FileWatcher._shouldIgnore` uses substring matching, not glob patterns

**Source**: `src/extensions/external/file-watcher.ts` lines 238-240
**KB Reference**: KB-08 (Extension Quality)
**Severity**: Minor

### Verdict: CONFIRMED

The `_shouldIgnore` method implements ignore filtering as:
```typescript
return ignore.some((pattern) => fullPath.includes(pattern));
```

This is pure substring matching. A pattern like `*.log` would never match any file because no file path literally contains the asterisk character. Similarly, `node_modules` would match `/path/to/node_modules_backup/file.ts` due to substring matching.

The field is described as supporting "patterns" but provides no glob semantics.

### Remediation

1. Use a glob matching library (e.g., `minimatch` or `picomatch`) to properly evaluate glob patterns against file paths
2. Alternatively, update the JSDoc and type documentation to accurately describe the behavior as "substring matching" rather than "patterns"
3. If glob support is added, include common defaults like `node_modules`, `.git`, and `*.lock`
