# ISS-135 — `rename` Event Always Mapped to `created`, Never `deleted`

**Severity**: Minor
**File**: src/extensions/external/file-watcher.ts
**KB Topic**: TypeScript SDK

## Original Issue
`rename` event always mapped to `created`, never `deleted`. Needs `stat` check to distinguish.

## Verification

### Source Code Check
At lines 198-199 of `src/extensions/external/file-watcher.ts`:
```typescript
const changeType: FileChangeType =
  event === 'rename' ? 'created' : 'modified';
```
Node.js's `fs.watch` emits `'rename'` for both file creation AND file deletion (it fires whenever the directory entry changes). The code unconditionally maps `'rename'` to `'created'`, meaning file deletions are misreported as creations. The comment above the code even acknowledges this: "node:fs watch only emits 'rename' (create/delete) and 'change' (modify)" — but the fix is not applied.

This causes consumers of the `external:file-changed` event to receive `changeType: 'created'` for deleted files, which could lead to attempts to read or process files that no longer exist.

### ACP Spec Check
The ACP spec (KB `07-filesystem-terminal.md`) defines file system access patterns but the `FileWatcher` is an internal mechanism not directly mandated by ACP wire format. This issue relates to correct behavior of the file change notification system, not ACP protocol compliance per se.

### Verdict: NOT_ACP_ISSUE
The issue is real and correctly described — `rename` events are always mapped to `created` despite representing both creation and deletion. However, this is not an ACP compliance issue; it is a correctness bug in the internal file watching subsystem.

## Remediation
Add an `fs.stat` check after the debounce fires to distinguish creation from deletion:
```typescript
const timer = setTimeout(async () => {
  this._timers.delete(fullPath);
  let changeType: FileChangeType;
  if (event === 'rename') {
    try {
      await stat(fullPath); // throws if file doesn't exist
      changeType = 'created';
    } catch {
      changeType = 'deleted';
    }
  } else {
    changeType = 'modified';
  }
  const payload: FileChangedPayload = {
    path: fullPath,
    changeType,
    timestamp: Date.now(),
  };
  this._bus.emit('external:file-changed', payload);
}, debounceMs);
```
Import `stat` from `node:fs/promises` at the top of the file.
