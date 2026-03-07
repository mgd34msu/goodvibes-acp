# ISS-157 — Sequential File Processing Instead of Parallel

**Severity**: Minor
**File**: `src/plugins/frontend/components.ts:62-70`
**KB Topic**: Extensibility

## Original Issue
Sequential file processing — could use `Promise.all` with batching.

## Verification

### Source Code Check
Lines 62-74 of `src/plugins/frontend/components.ts`:
```typescript
async findComponents(projectRoot: string): Promise<ComponentNode[]> {
  const files = await this._findJsxFiles(resolve(projectRoot));
  const results: ComponentNode[] = [];
  for (const file of files) {
    try {
      const node = await this._parseComponent(file);
      results.push(node);
    } catch {
      // skip unreadable files
    }
  }
  return results;
}
```

Files are processed one-at-a-time via `for...of` with `await` inside the loop. Each `_parseComponent` call awaits completion before processing the next file. For projects with many JSX files, this creates an O(n) sequential I/O bottleneck. Using `Promise.all` or batched `Promise.allSettled` would process files in parallel.

### ACP Spec Check
The ACP spec has no requirements about parallelism in internal plugin file processing. Performance optimizations within plugin internals are not an ACP compliance concern.

### Verdict: NOT_ACP_ISSUE
The issue is real — sequential processing of large file sets is a performance bottleneck. However, this is an internal performance optimization concern, not an ACP protocol compliance violation.

## Remediation
N/A for ACP compliance. As a performance fix:
```typescript
async findComponents(projectRoot: string): Promise<ComponentNode[]> {
  const files = await this._findJsxFiles(resolve(projectRoot));
  const settled = await Promise.allSettled(files.map((f) => this._parseComponent(f)));
  return settled
    .filter((r): r is PromiseFulfilledResult<ComponentNode> => r.status === 'fulfilled')
    .map((r) => r.value);
}
```
