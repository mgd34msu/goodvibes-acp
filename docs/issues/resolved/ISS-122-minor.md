# ISS-122 — LogsManager Uses Direct fs/promises Instead of ITextFileAccess

**Severity**: Minor
**File**: `src/extensions/logs/manager.ts:9,84,97,100`
**KB Topic**: Filesystem & Terminal

## Original Issue
`LogsManager` uses direct `readFile`/`writeFile`/`appendFile`. Routing through `ITextFileAccess.writeTextFile` would notify editor of changes. *(Filesystem & Terminal)*

## Verification

### Source Code Check
Line 9:
```typescript
import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises';
```

Line 84 (inside `prependEntry`):
```typescript
existing = await readFile(filePath, 'utf-8');
```

Line 97:
```typescript
await writeFile(filePath, `${before}${newBlock}${after}`, 'utf-8');
```

Line 100:
```typescript
await appendFile(filePath, `\n${newBlock}`);
```

No `ITextFileAccess` is used. The `LogsManager` writes to `.goodvibes/` log files (activity, decision, error logs).

### ACP Spec Check
KB-07 states that using ACP `fs/write_text_file` "notifies the editor so it can track dirty state, trigger LSP reanalysis, etc." and that using `ITextFileAccess` means the editor can "intercept, log, or audit all file operations during agent execution."

However, the KB also clarifies:
> "For a standalone runtime that also needs direct disk access, both patterns apply: use ACP fs for editor-aware reads/writes, use direct fs for everything else."

Log files written to `.goodvibes/` are runtime-internal files — not source code files the user is editing. Editor buffer awareness is not meaningful here (log files are runtime-generated, never in unsaved editor buffers). The `writeTextFile` notification value for internal runtime logs is negligible.

### Verdict: PARTIAL
The issue is real in that the code uses direct fs (confirmed at all cited lines), and the ACP dual-path pattern recommendation applies. However, the issue overstates the importance — log files are runtime-generated artifacts, not editor-managed source files. The `ITextFileAccess` pattern is most valuable for source code. For runtime log files written to `.goodvibes/`, direct fs is acceptable per the KB's own guidance ("use direct fs for everything else"). The issue has merit as a consistency concern but "routing through `ITextFileAccess.writeTextFile` would notify editor of changes" is only marginally useful for log files.

## Remediation
1. Accept the current direct-fs approach for `.goodvibes/` log files as intentional — document in a comment explaining the dual-path decision.
2. Optionally: If `LogsManager` is ever expected to write to user-facing source paths (e.g., writing analysis reports into the project), add `ITextFileAccess` injection for those paths only.
3. Add a comment at the top of `manager.ts` noting: "Writes to runtime-internal `.goodvibes/` paths — direct fs is intentional; editor buffer awareness not applicable here."
