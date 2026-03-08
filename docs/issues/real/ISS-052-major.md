# ISS-052 — project_deps_analyze Tool Ignores Declared Input Parameters

**Severity**: Major
**File**: src/plugins/project/analyzer.ts:249-251
**KB Topic**: ACP Tools and MCP Integration — Tool Call Object Shape (06-tools-mcp.md lines 86-115)

## Original Issue
The `project_deps_analyze` tool declares three optional parameters in its schema but the dispatch handler only passes `args.projectRoot` to `analyze()`. All three parameters are silently ignored.

## Verification

### Source Code Check
The tool schema at lines 46-50 declares:
```typescript
properties: {
  projectRoot: { type: 'string', description: 'Absolute path to the project root' },
  checkOutdated: { type: 'boolean', description: 'Check for outdated packages (default: false)' },
  detectCircular: { type: 'boolean', description: 'Detect circular imports (default: true)' },
  findUnused: { type: 'boolean', description: 'Find unused dependencies (default: true)' },
},
```
But the dispatch handler at lines 249-251 only uses `projectRoot`:
```typescript
case 'project_deps_analyze': {
  const args = p as AnalyzeDepsParams;
  return this._deps.analyze(args.projectRoot);
}
```

### ACP Spec Check
KB-06 (lines 86-115) defines the Tool Call Object Shape and emphasizes that tool input schemas must accurately represent what the tool processes. Declaring parameters that are silently ignored makes the tool's interface misleading.

### Verdict: CONFIRMED
Three declared schema parameters (`checkOutdated`, `detectCircular`, `findUnused`) are completely ignored in the dispatch handler. The tool advertises capabilities it does not implement.

## Remediation
1. Pass all three parameters to `this._deps.analyze()`:
   ```typescript
   return this._deps.analyze(args.projectRoot, {
     checkOutdated: args.checkOutdated,
     detectCircular: args.detectCircular,
     findUnused: args.findUnused,
   });
   ```
2. Update the `analyze()` method signature in `DependencyAnalyzer` to accept these options
3. Implement the conditional logic within `analyze()` to honor these flags
