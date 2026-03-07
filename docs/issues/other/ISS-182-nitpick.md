# ISS-182 — `prependEntry` Has Fragile Insertion Strategy

**Severity**: Nitpick
**File**: `src/extensions/logs/manager.ts:76-102`
**KB Topic**: Filesystem & Terminal

## Original Issue
`[src/extensions/logs/manager.ts:76-102]` `prependEntry` has fragile insertion strategy (splitting on first `\n\n`). *(Filesystem & Terminal)*

## Verification

### Source Code Check
Lines 76–102 of `src/extensions/logs/manager.ts`:
```typescript
async function prependEntry(filePath: string, header: string, entry: string): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  const newBlock = `${entry}\n\n---\n`;

  if (existing.includes('\n\n')) {
    const firstBreak = existing.indexOf('\n\n');
    const before = existing.slice(0, firstBreak + 2);
    const after = existing.slice(firstBreak + 2);
    await writeFile(filePath, `${before}${newBlock}${after}`, 'utf-8');
  } else {
    await appendFile(filePath, `\n${newBlock}`);
  }
}
```
The code is exactly as described — it finds the first `\n\n` occurrence to determine insertion point. This is fragile: a log file with a blank line in its header would cause mis-insertion.

### ACP Spec Check
The ACP specification and all 10 KB files contain no requirements for log file management, log entry ordering, or internal log storage strategies. The ACP protocol is agnostic to how an agent stores its own internal logs.

### Verdict: NOT_ACP_ISSUE
The issue is real — the insertion strategy is fragile. However, this is an internal implementation detail of log management with no ACP protocol compliance dimension. The KB topic annotation of "Filesystem & Terminal" refers to the ACP `filesystem/read` and `filesystem/write` capabilities, which this code does not interact with (it uses Node.js `fs` directly, which is a separate concern tracked in issues #120-122).

## Remediation
N/A — not an ACP compliance issue.

For code quality: use a structured delimiter (e.g., a sentinel comment like `<!-- entries -->`) or a line-count-based approach rather than scanning for `\n\n`.
