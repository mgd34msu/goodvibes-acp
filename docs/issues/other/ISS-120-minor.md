# ISS-120 — DatabaseTools Uses Direct readFile Instead of ITextFileAccess

**Severity**: Minor
**File**: src/plugins/project/db.ts:9,29
**KB Topic**: Filesystem & Terminal

## Original Issue

**[src/plugins/project/db.ts:9,29]** `DatabaseTools.parsePrismaSchema` reads via direct `readFile`. Dual-path pattern should apply for consistency with `ITextFileAccess`. *(Filesystem & Terminal)*

## Verification

### Source Code Check

`db.ts` lines 9 and 26-31:

```typescript
import { readFile } from 'node:fs/promises';
// ...
export class DatabaseTools {
  async parsePrismaSchema(schemaPath: string): Promise<DbSchema> {
    let content: string;
    try {
      content = await readFile(schemaPath, 'utf-8');
    } catch {
      return { tables: [], relations: [] };
    }
```

`DatabaseTools` uses `node:fs/promises` `readFile` directly. It does not accept an `ITextFileAccess` dependency and has no constructor for injection. Direct disk access bypasses the ACP `fs/read_text_file` path that would return unsaved editor buffer state.

### ACP Spec Check

KB `07-filesystem-terminal.md` explains the rationale for `ITextFileAccess`:

> ACP `fs/*` methods route through the **editor**, not the OS filesystem. This means:
> - Read returns **unsaved buffer state** (what's in the editor, not what's on disk)

This is a real concern for Prisma schema parsing: if a developer has modified `schema.prisma` in their editor without saving, `parsePrismaSchema` will analyze the stale on-disk version. However, the ACP spec itself does not mandate that all file reads go through `ITextFileAccess` — it provides the capability for editors to route file access, but agents may read from disk directly for many use cases.

For a schema parser, the practical impact depends on workflow — most Prisma schema changes are saved before analysis is triggered. The spec does not prohibit direct disk access; it provides an alternative channel.

### Verdict: NOT_ACP_ISSUE

This is a code consistency issue, not an ACP compliance issue. The ACP spec provides `fs/*` methods as an optional capability for editor-integrated reads — it does not require all file reads to use them. Direct disk access is explicitly acknowledged as valid by the KB:

> For a standalone runtime that also needs direct disk access, both patterns apply: use ACP fs for editor-aware reads/writes, use direct fs for everything else.

Prisma schema parsing falls into "everything else" — it operates on project configuration files that are typically read from disk. The issue has merit for consistency with other project plugins (ISS-49, ISS-50, ISS-51), but it is a GoodVibes code quality concern, not an ACP protocol violation.

## Remediation

N/A — not an ACP compliance issue.

For code consistency with other project plugins: refactor `DatabaseTools` to accept optional `ITextFileAccess` and prefer it when available:
```typescript
export class DatabaseTools {
  constructor(private readonly _fs?: ITextFileAccess) {}

  async parsePrismaSchema(schemaPath: string): Promise<DbSchema> {
    let content: string;
    try {
      content = this._fs
        ? await this._fs.readTextFile(schemaPath)
        : await readFile(schemaPath, 'utf-8');
    } catch {
      return { tables: [], relations: [] };
    }
    // ...
  }
}
```
