# ISS-075 — `fs/write_text_file` Silently Ignores `encoding` on ACP Path

**Severity**: Minor
**File**: src/extensions/acp/fs-bridge.ts:93-97
**KB Topic**: File System Methods — `fs/write_text_file` (07-filesystem-terminal.md lines 135-139)

## Original Issue
`options?.encoding` is silently ignored on the ACP path. The same call with `encoding: 'latin1'` works on disk fallback but is silently ignored for ACP fs operations.

## Verification

### Source Code Check
Lines 91-107 of `src/extensions/acp/fs-bridge.ts` confirm the issue:

```typescript
async writeTextFile(path: string, content: string, options?: WriteOptions): Promise<void> {
    if (this.clientCapabilities.fs?.writeTextFile) {
      await this.conn.writeTextFile({
        path,
        content,
        sessionId: this.sessionId,
      });
      return;
    }

    // Direct disk fallback — ensure parent directory exists
    await mkdir(dirname(path), { recursive: true });
    const encoding = (options?.encoding ?? 'utf-8') as string;
    if (!VALID_ENCODINGS.has(encoding as BufferEncoding)) {
      throw new Error(`Unsupported encoding: ${encoding}`);
    }
    await writeFile(path, content, { encoding: encoding as BufferEncoding });
  }
```

The ACP path (lines 93-97) sends only `path`, `content`, and `sessionId` — `options.encoding` is not checked or forwarded. The disk fallback path (lines 102-107) does honor encoding.

### ACP Spec Check
KB-07 (07-filesystem-terminal.md lines 135-139) defines `fs/write_text_file` with only three fields: `sessionId`, `path`, and `content`. There is no `encoding` field in the ACP spec.

The spec does not support encoding because the ACP protocol assumes UTF-8 text content. This is a legitimate protocol limitation.

### Verdict: PARTIAL
The code does silently ignore encoding on the ACP path, and this creates a behavioral inconsistency between ACP and disk fallback paths. However, the ACP spec genuinely does not have an encoding field — so this is not an ACP violation per se. The real issue is that the bridge should warn or throw when the caller passes an encoding option that cannot be honored on the ACP path, rather than silently producing different behavior.

## Remediation
1. Add a warning or throw an error when `options?.encoding` is set to something other than `'utf-8'` on the ACP path, since the ACP protocol only supports UTF-8
2. Example guard:
   ```typescript
   if (options?.encoding && options.encoding !== 'utf-8') {
     throw new Error(`ACP fs/write_text_file does not support encoding '${options.encoding}' — only UTF-8 is supported`);
   }
   ```
3. This ensures callers are aware of the limitation rather than getting silently different behavior
