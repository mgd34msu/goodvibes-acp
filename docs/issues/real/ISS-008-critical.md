# ISS-008 — SQL injection in `generateQuery` WHERE clause
**Severity**: Critical
**File**: `src/plugins/project/db.ts`
**KB Topic**: KB-05: Safe Execution

## Original Issue
The `where`, `table`, and `columns` parameters are interpolated directly into SQL string templates without sanitization. Attacker-controlled input via ACP tool calls can inject arbitrary SQL.

## Verification

### Source Code Check
`src/plugins/project/db.ts` lines 180-192:
```
generateQuery(
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  columns: string[] = ['*'],
  where?: string,
): string {
  const quotedTable = `"${table}"`;
  const whereClause = where ? `\nWHERE ${where}` : '';
  ...
  const cols = columns.includes('*') ? '*' : columns.map((c) => `"${c}"`).join(', ');
  return `SELECT ${cols}\nFROM ${quotedTable}${whereClause};`;
```

All three parameters (`table`, `columns`, `where`) are interpolated directly into the SQL string. The `where` parameter is completely unvalidated freeform SQL. The `table` and `columns` values are wrapped in double quotes but not escaped for embedded quotes (a `table` value of `foo"; DROP TABLE users; --"` would break out).

### ACP Spec Check
KB-05 requires safe execution of potentially dangerous operations. Tool call parameters come from LLM output, which can be manipulated by prompt injection. Direct SQL interpolation without validation or parameterization is a security vulnerability.

### Verdict: CONFIRMED
The `generateQuery` method interpolates user-controlled strings directly into SQL templates without sanitization. The `where` parameter accepts arbitrary SQL. The `table` and `columns` quoting is insufficient (no escaping of embedded quotes).

## Remediation
1. Validate `table` and `columns` against an allowlist of known identifiers, or restrict to `[a-zA-Z0-9_]` characters.
2. Escape embedded double quotes in table/column names (replace `"` with `""` per SQL standard).
3. For `where`, either disallow freeform SQL entirely or clearly document that this method generates templates only (not for direct execution with untrusted input).
4. Consider using parameterized queries instead of string interpolation.
