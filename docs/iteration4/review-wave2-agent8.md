# ACP Compliance Review — Wave 2, Agent 8: Project Plugins

**Reviewer**: ACP Review Agent  
**Scope**: `src/plugins/project/` — analyzer, db, test, deps, security, coverage (N/A — no file), index  
**KB Topics**: 05-permissions, 06-tools-mcp, 08-extensions  
**Date**: 2026-03-08

---

## Issues (10)

### ISS-080 | SQL injection in `generateQuery` WHERE clause
**File**: `src/plugins/project/db.ts`, line 187  
**KB Topic**: 05-permissions (safe tool execution)  
**Severity**: CRITICAL  

The `where` parameter is interpolated directly into the SQL string template:
```ts
const whereClause = where ? `\nWHERE ${where}` : '';
```
The `table` and `columns` parameters are likewise embedded without sanitization (lines 186, 191, 200, 210). An attacker-controlled `where` value like `1=1; DROP TABLE users --` flows straight through. Even though this generates "template" SQL, the tool is exposed via ACP tool calls where untrusted agent/LLM input arrives.

**Fix**: Validate `table`/`columns` against an allowlist (parsed schema tables) or restrict to identifier characters (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`). For `where`, either disallow freeform SQL or clearly document it as a template-only output with a warning comment.

---

### ISS-081 | `_dispatch` casts params without runtime validation
**File**: `src/plugins/project/analyzer.ts`, lines 259, 282–349  
**KB Topic**: 06-tools-mcp (tool input validation)  
**Severity**: HIGH  

`params` is cast to typed interfaces (`p as AnalyzeDepsParams`, `p as FindTestsParams`, etc.) without any runtime schema validation. The tool definitions declare JSON Schema with `required` fields and `additionalProperties: false`, but the `execute` method never validates incoming params against these schemas. The validation at lines 262–278 only checks for presence of `projectRoot`/`schemaPath` — it does not validate types, ranges, or unexpected properties.

**Fix**: Use a lightweight schema validator (e.g., `ajv` or manual type checks) to validate `params` against the declared `inputSchema` before dispatching.

---

### ISS-082 | Double file read in `findTests`
**File**: `src/plugins/project/test.ts`, lines 104 and 137  
**KB Topic**: 06-tools-mcp (efficient tool execution)  
**Severity**: MEDIUM  

`findTests` calls `detectFramework(filePath)` which reads the file content (line 139–141), then immediately reads the same file again at lines 109–111 to extract test counts and suites. This doubles I/O for every test file.

**Fix**: Read the file once and pass the content to both `detectFramework` and the count/suite extraction logic.

---

### ISS-083 | Race condition in `checkSecrets` shared array
**File**: `src/plugins/project/security.ts`, lines 287–315  
**KB Topic**: 06-tools-mcp (tool correctness)  
**Severity**: MEDIUM  

`Promise.all` runs multiple async callbacks that `push` to the shared `issues` array concurrently. While V8's single-threaded execution model makes `Array.push` safe in practice for Node/Bun, this pattern is fragile and would break if any `await` were added between the push and the loop boundary, or if the runtime changed concurrency semantics.

**Fix**: Return issues per-file from each `map` callback and flatten the results after `Promise.all`.

---

### ISS-084 | Directory traversal uses raw `readdir`/`stat` bypassing ACP
**File**: `src/plugins/project/security.ts` lines 93–123, `test.ts` lines 32–61, `deps.ts` lines 32–61  
**KB Topic**: 08-extensions (ACP-compliant file access)  
**Severity**: LOW  

The `collectFiles`, `collectAllFiles`, and `collectSourceFiles` helper functions use raw `node:fs/promises` `readdir` and `stat` directly. The classes themselves accept `ITextFileAccess` for text reads (good), but the directory traversal is not mediated by any ACP abstraction. The code comments acknowledge this ("no ACP equivalent exists for directory listing") which is accurate for the current SDK, but it means these operations are invisible to the ACP permission system.

**Fix**: Acknowledged as a known limitation. When/if ACP adds directory listing capabilities, these helpers should be updated. For now, document the limitation in the plugin manifest or a README.

---

### ISS-085 | `register()` casts `unknown` to `Registry` without type guard
**File**: `src/plugins/project/index.ts`, lines 77–81  
**KB Topic**: 08-extensions (plugin registration pattern)  
**Severity**: MEDIUM  

The `register` callback receives `registry: unknown` and casts it to `Registry` with `(registry as Registry).register(...)`. The null check at line 78 is good, but there is no validation that the object actually implements the `Registry` interface (e.g., has a `register` method).

**Fix**: Add a method-existence check: `if (typeof (registry as any).register !== 'function') throw ...` or use a type guard.

---

### ISS-086 | No permission gating for security-sensitive tools
**File**: `src/plugins/project/analyzer.ts`, lines 239–256  
**KB Topic**: 05-permissions (session/request_permission)  
**Severity**: HIGH  

The `execute` method runs all tools unconditionally without any `session/request_permission` gate. Tools like `project_security_secrets` (scans all source files), `project_security_permissions` (checks file permissions), and `project_code_surface` (full project analysis) perform filesystem-wide reads. Per ACP KB 05-permissions, sensitive file operations should be gated by a permission request so the client/user can approve or deny.

**Fix**: Accept a permission callback or ACP connection reference in the constructor. Before executing filesystem-scanning tools, call `session/request_permission` with type `read` and a description of the scope.

---

### ISS-087 | No tool call lifecycle updates emitted
**File**: `src/plugins/project/analyzer.ts`, lines 239–256  
**KB Topic**: 06-tools-mcp (tool call lifecycle)  
**Severity**: HIGH  

The `execute` method does not emit any `tool_call` / `tool_call_update` session updates. Per ACP KB 06-tools-mcp, tool execution should follow the lifecycle: `pending -> running -> completed|failed`. The caller receives a `ToolResult` object, but the ACP client never sees status transitions. This means the client UI cannot show progress or tool status for project analysis operations.

**Fix**: Accept an ACP session context and emit `tool_call` (pending), `tool_call_update` (running), and `tool_call_update` (completed/failed) notifications during execution. Alternatively, document that lifecycle management is the caller's responsibility and the `IToolProvider` is a low-level interface.

---

### ISS-088 | `ProjectAnalyzer` constructor does not pass `ITextFileAccess` from plugin registration
**File**: `src/plugins/project/index.ts`, line 81  
**KB Topic**: 08-extensions (ACP-compliant file access)  
**Severity**: MEDIUM  

`new ProjectAnalyzer()` is constructed without an `ITextFileAccess` argument during plugin registration. This means all sub-analyzers fall back to raw `node:fs/promises` reads, completely bypassing the ACP file access layer that the classes were designed to support.

**Fix**: Resolve `ITextFileAccess` from the registry (or pass it into the plugin registration context) and inject it: `new ProjectAnalyzer(registry.get<ITextFileAccess>('text-file-access'))`.

---

### ISS-089 | `findCircular` uses `Array.includes` for file lookup — O(n^2)
**File**: `src/plugins/project/deps.ts`, line 192  
**KB Topic**: 06-tools-mcp (efficient tool execution)  
**Severity**: LOW  

Inside the inner loop of `findCircular`, `files.includes(candidate)` performs a linear scan of the files array for each import of each file. For a project with N files and M imports, this is O(N * M * N) in the worst case.

**Fix**: Convert `files` to a `Set<string>` before the graph-building loop and use `Set.has()` for O(1) lookups.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 4 |
| LOW | 2 |

**Overall Score: 5/10**

The project plugin demonstrates solid structural patterns — proper `IToolProvider` implementation, well-defined tool schemas with `additionalProperties: false`, graceful error handling (never-throw semantics), and optional `ITextFileAccess` injection. However, critical ACP compliance gaps remain:

1. **SQL injection** in `generateQuery` is the most severe functional issue.
2. **No permission gating** means security-scanning tools run without user consent.
3. **No tool call lifecycle** means the ACP client has no visibility into tool execution.
4. **`ITextFileAccess` never injected** during registration renders the ACP file access layer dead code.
5. **No runtime param validation** despite declaring JSON Schemas.

The plugin needs permission integration, lifecycle emission, and input sanitization before it can be considered ACP-compliant.
