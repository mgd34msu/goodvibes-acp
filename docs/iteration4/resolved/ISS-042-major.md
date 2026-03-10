# ISS-042: ProjectAnalyzer constructor does not receive ITextFileAccess from plugin registration

**Severity**: Major  
**File**: `src/plugins/project/index.ts`  
**Lines**: 81  
**KB Reference**: KB-08 (Extensibility)

## Description

The project plugin registration calls `new ProjectAnalyzer()` without passing an `ITextFileAccess` instance. The constructor accepts an optional `fs?: ITextFileAccess` parameter (added per ISS-051), but the registration site never resolves and injects it. All sub-analyzers therefore fall back to raw `node:fs/promises`, bypassing ACP file access.

## Source Evidence

`src/plugins/project/index.ts` line 81:
```typescript
(registry as Registry).register('project-analyzer', new ProjectAnalyzer());
```

`src/plugins/project/analyzer.ts` line 232:
```typescript
constructor(fs?: ITextFileAccess) {
```

The constructor accepts `fs` and passes it to sub-analyzers, but the registration never provides it.

### Verdict: CONFIRMED

The constructor was updated to accept `ITextFileAccess` but the plugin registration site was not updated to resolve and inject it from the registry.

## Remediation

Resolve `ITextFileAccess` from the registry in the `register` callback and pass it to the constructor:

```typescript
register: (registry: unknown) => {
  const reg = registry as Registry;
  const fs = reg.getOptional<ITextFileAccess>('text-file-access');
  reg.register('project-analyzer', new ProjectAnalyzer(fs));
},
```
