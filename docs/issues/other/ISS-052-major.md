# ISS-052 — SQL injection risk in `generateQuery`

**Severity**: Major
**File**: `src/plugins/project/db.ts`
**KB Topic**: KB-06: Tool Execution Security

## Original Issue
`generateQuery` interpolates `table`, `columns`, and `where` directly into SQL strings with only basic double-quote wrapping. The `where` parameter is inserted raw. Column names with special characters would break or corrupt the output.

## Verification

### Source Code Check
At lines 177-215, `generateQuery` builds SQL templates by interpolating parameters:
- `table` is wrapped in double quotes: `const quotedTable = \`"${table}"\``
- `columns` are individually double-quoted: `columns.map((c) => \`"${c}"\`).join(', ')`
- `where` is inserted raw: `const whereClause = where ? \`\\nWHERE ${where}\` : ''`

Double-quote wrapping does not sanitize identifiers — a table name containing `"` or other special characters would break the SQL. The `where` clause has zero sanitization.

### ACP Spec Check
KB-06 covers tool execution but does not specifically address SQL injection or output sanitization for template generators. This is a general security concern rather than an ACP protocol compliance issue.

### Verdict: NOT_ACP_ISSUE
The SQL injection risk is real and the code does interpolate unsanitized inputs into SQL strings. However, this is a general security best practice issue, not an ACP protocol compliance violation. KB-06 defines tool call lifecycle and MCP integration patterns, not SQL security requirements. The function also generates *templates* (with `:param` placeholders for values), not executable queries.

## Remediation
N/A (not an ACP compliance issue, though the security concern is valid as a general code quality issue)
