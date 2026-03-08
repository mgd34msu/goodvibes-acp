# ACP Compliance Review: Project Plugins (Wave 2, Agent 8)

**Scope**: `src/plugins/project/` — analyzer.ts, db.ts, deps.ts, index.ts, security.ts, test.ts, types.ts
**KB References**: `docs/acp-knowledgebase/08-extensibility.md`, `docs/acp-knowledgebase/06-tools-mcp.md`
**ACP Spec Source**: `https://agentclientprotocol.com/llms-full.txt` (fetched)
**Iteration**: 3

---

## Summary

The project plugin suite provides dependency analysis, security scanning, test discovery, and database tools via a unified `ProjectAnalyzer` facade implementing `IToolProvider`. The code is well-structured with clear separation of concerns and consistent error handling. ACP compliance is strong for tool call lifecycle patterns. Remaining issues are concentrated around incomplete `ITextFileAccess` integration, input validation gaps, and minor performance concerns.

**Score: 8.1/10** | **Issues: 0 critical, 3 major, 4 minor, 3 nitpick**

---

## Issues

### 1. DatabaseTools lacks ITextFileAccess injection (ACP file access inconsistency)

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/db.ts` |
| **Lines** | 9, 29, 37 |
| **KB Topic** | KB-06: ACP client file system (lines 589-616) — ACP `fs/read_text_file` returns unsaved editor buffer, not just disk state |
| **Severity** | Major |

`DatabaseTools` uses raw `readFile` from `node:fs/promises` (line 37) while `DependencyAnalyzer`, `SecurityScanner`, and `TestAnalyzer` all accept an optional `ITextFileAccess` constructor parameter for ACP-compliant reads. The code documents this gap (lines 21-27) as ISS-051 but does not resolve it. In `analyzer.ts` line 216, `DatabaseTools` is instantiated without any `ITextFileAccess`, meaning Prisma schema parsing always reads stale disk state rather than editor buffers.

**Fix**: Add `ITextFileAccess` constructor parameter to `DatabaseTools`, consistent with the other three analyzers. Update `ProjectAnalyzer` constructor (analyzer.ts:216) to pass the `fs` parameter.

---

### 2. No input validation in _dispatch before type casting

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/analyzer.ts` |
| **Lines** | 245-246, 250, 259, 263 |
| **KB Topic** | KB-06: Tool call object shape (lines 86-115) — `inputSchema` defines required fields; runtime must enforce them |
| **Severity** | Major |

The `_dispatch` method (line 246) casts `params` to `Record<string, unknown>` then immediately casts again to typed params (e.g., `p as AnalyzeDepsParams` at line 250) without validating that required fields exist. If `projectRoot` is missing, the code passes `undefined` to `join()` producing a malformed path rather than returning a clear error. The tool definitions declare `projectRoot` as required in `inputSchema` but the runtime never enforces this.

**Fix**: Add a validation guard at the top of `_dispatch` that checks required fields before dispatching. At minimum, validate `projectRoot` is a non-empty string for all tools that require it.

---

### 3. SQL injection risk in generateQuery

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/db.ts` |
| **Lines** | 177-215 |
| **KB Topic** | KB-06: Tool call lifecycle (lines 8-11) — agent executes tools; security of tool execution is agent's responsibility |
| **Severity** | Major |

`generateQuery` interpolates `table`, `columns`, and `where` directly into SQL strings with only basic double-quote wrapping (line 183). The `where` parameter is inserted raw (line 184). While this generates templates rather than executing queries, the output is labeled as SQL and could be copy-pasted or piped into a query runner. Column names with special characters (quotes, semicolons) would break or corrupt the output.

**Fix**: Sanitize identifiers by rejecting or escaping characters outside `[a-zA-Z0-9_]`. Add a doc comment warning that the output is a template, not safe for direct execution with untrusted inputs.

---

### 4. Circular import detection uses O(n) array lookup

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/deps.ts` |
| **Lines** | 190-195 |
| **KB Topic** | KB-06: Tool call lifecycle — tool execution performance affects agent responsiveness |
| **Severity** | Minor |

Inside `findCircular`, the inner loop at line 192 calls `files.includes(candidate)` which is O(n) per candidate, inside a loop over all imports of all files. For a project with 1000 files and 10 candidate extensions per import, this becomes O(n * m * k) where k is the file count. Converting `files` to a `Set<string>` before the loop would reduce each lookup to O(1).

**Fix**: Add `const fileSet = new Set(files);` before the `Promise.all` block and replace `files.includes(candidate)` with `fileSet.has(candidate)`.

---

### 5. Gitignore pattern matching is overly simplistic

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/security.ts` |
| **Lines** | 197-199 |
| **KB Topic** | KB-08: Forward compatibility (lines 329-335) — implementations must handle real-world configurations correctly |
| **Severity** | Minor |

The `.gitignore` check at line 197-199 only matches exact line equality (`line.trim() === envFile` or `line.trim() === '/' + envFile`). Real `.gitignore` files commonly use glob patterns like `*.env`, `.env*`, or directory-scoped patterns like `**/.env`. A `.gitignore` containing `.env*` (common pattern) would not match `.env.local`, causing a false-positive security warning.

**Fix**: Use a gitignore-compatible matching library (e.g., `ignore` npm package) or at minimum handle `*` wildcard patterns in the gitignore content.

---

### 6. Shared mutable regex state in concurrent Promise.all

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/security.ts` |
| **Lines** | 287-316 |
| **KB Topic** | KB-06: Multiple tool calls in parallel (lines 570-585) — concurrent execution must be safe |
| **Severity** | Minor |

`checkSecrets` runs `Promise.all` over files (line 287), and each iteration accesses shared `SECRET_PATTERNS` array entries with `/g` regex flags. While `lastIndex` is manually reset at line 302, the `Promise.all` callbacks execute concurrently in the same microtask queue. If the JS engine interleaves promise continuations (e.g., after each `await readFile`), two callbacks could race on the same regex's `lastIndex`. In practice, Node.js single-threaded execution makes this unlikely but the pattern is fragile.

**Fix**: Create fresh `RegExp` instances per file iteration rather than reusing the shared `SECRET_PATTERNS` regexes. Alternatively, use `String.prototype.match()` instead of `RegExp.prototype.test()` to avoid stateful regex.

---

### 7. Tool definitions lack additionalProperties constraint

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/analyzer.ts` |
| **Lines** | 38-203 |
| **KB Topic** | KB-08: Protocol constraint (lines 346-372) — implementations must not add custom fields at root of protocol-defined types |
| **Severity** | Minor |

All `inputSchema` objects in `TOOL_DEFINITIONS` omit `additionalProperties: false`. Per ACP extensibility rules (KB-08 line 71), custom data belongs in `_meta`, not at the root. Without `additionalProperties: false`, the schemas silently accept arbitrary extra fields that could be mistaken for supported parameters. This is inconsistent with the ACP principle that unknown fields at the root of protocol types are forbidden.

**Fix**: Add `additionalProperties: false` to each `inputSchema` object, or add a `_meta` property to explicitly allow extension data per KB-08.

---

### 8. Plugin register function uses unsafe cast

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/index.ts` |
| **Lines** | 77-81 |
| **KB Topic** | KB-08: Extension methods (lines 80-98) — extension points should use typed interfaces |
| **Severity** | Nitpick |

The `register` callback types its parameter as `unknown` (line 77) then casts to `Registry` at line 81. The `PluginRegistration` type (from `plugin.ts`) defines `register` as `(registry: unknown) => void`. While the null check at line 78 is good, the double-cast pattern (`unknown` -> `Registry`) bypasses type safety. If the `PluginRegistration` type were updated to accept `Registry`, the cast would be unnecessary.

**Fix**: This is a design constraint from the `PluginRegistration` type. Consider updating `PluginRegistration.register` to accept a typed registry interface, or add a runtime `instanceof` / duck-type check before casting.

---

### 9. Double file read in test framework detection

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/test.ts` |
| **Lines** | 103-127, 137-166 |
| **KB Topic** | KB-06: Tool call lifecycle — unnecessary I/O increases tool execution time |
| **Severity** | Nitpick |

`findTests` calls `detectFramework(filePath)` at line 104 which reads the file content (line 139-141), then immediately reads the same file again at lines 109-111 to count tests and extract suites. This doubles file I/O for every test file discovered.

**Fix**: Read the file once in `findTests`, then pass the content to both `detectFramework` and the test counting logic. Add an overload or internal method that accepts content string instead of file path.

---

### 10. No _meta support on ToolResult responses

| Field | Value |
|-------|-------|
| **File** | `src/plugins/project/analyzer.ts` |
| **Lines** | 226-243 |
| **KB Topic** | KB-08: The `_meta` field (lines 14-27) — every type in ACP includes an optional `_meta` field on response results |
| **Severity** | Nitpick |

The `execute` method returns `ToolResult<T>` which has `success`, `data`, `error`, and `durationMs` fields but no `_meta` field. Per KB-08, every ACP protocol type should support `_meta` for extensibility. The `ToolResult` type in `registry.ts` lacks this field entirely. While tool results are internal (not directly on the ACP wire), the `_meta` pattern should be consistent across all typed results to enable tracing propagation (e.g., `traceparent` from KB-08 lines 50-56).

**Fix**: Add `_meta?: Record<string, unknown>` to the `ToolResult` type in `src/types/registry.ts`. Optionally populate it in `execute` with timing or trace metadata.

---

## Category Breakdown

| Category | Score | Key Issues |
|----------|-------|------------|
| Security | 7/10 | SQL template injection risk (#3), regex race condition (#6) |
| Error Handling | 8/10 | Missing input validation (#2); otherwise consistent never-throw pattern |
| Testing | N/A | No test files in scope |
| Organization | 9/10 | Clean facade pattern, good separation of concerns |
| Performance | 8/10 | O(n) array lookup (#4), double file read (#9) |
| SOLID/DRY | 8/10 | Duplicate `collectFiles` helpers across deps.ts/security.ts/test.ts |
| Naming | 9/10 | Clear, consistent naming throughout |
| Maintainability | 8/10 | Well-documented ISS comments, clear module boundaries |
| Documentation | 9/10 | Good JSDoc, clear module headers |
| Dependencies | 9/10 | Minimal deps (only node:fs, node:path); clean imports |

## Positive Observations

- Consistent never-throw error handling pattern across all analyzers
- Well-documented ISS tracking comments for known gaps
- Clean `ITextFileAccess` abstraction for ACP-compliant file reads (3 of 4 analyzers)
- Parallel execution via `Promise.all` in all analyzers
- Comprehensive secret detection patterns with severity levels and fix guidance
- Tool definitions follow ACP `inputSchema` conventions from KB-06
