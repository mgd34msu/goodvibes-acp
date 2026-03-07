# ISS-102 — No Schema Migration Logic in MemoryManager

**Severity**: Minor
**File**: src/extensions/memory/manager.ts:26
**KB Topic**: Sessions

## Original Issue
No schema migration logic. `SCHEMA_VERSION = '1.0.0'` defined but `load()` doesn't validate or migrate between versions. *(Sessions)*

## Verification

### Source Code Check
`src/extensions/memory/manager.ts:26`:
```typescript
const SCHEMA_VERSION = '1.0.0';
```

`load()` at line 120-130:
```typescript
async load(): Promise<void> {
  const filePath = join(this._basePath, MEMORY_FILE);
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as MemoryStore;
    this._store = {
      $schema: parsed.$schema ?? SCHEMA_VERSION,
      decisions: parsed.decisions ?? [],
      patterns: parsed.patterns ?? [],
      failures: parsed.failures ?? [],
      preferences: parsed.preferences ?? [],
```

The `load()` reads `parsed.$schema` and falls back to `SCHEMA_VERSION` if absent, but does not compare the loaded schema version against the current version. There is no migration path if the schema changes between versions.

### ACP Spec Check
The ACP spec (all 10 KB files) does not define or reference any schema versioning or migration requirement for agent memory/state persistence. Memory management is an implementation detail of the agent — ACP only defines the protocol wire format between client and agent.

### Verdict: NOT_ACP_ISSUE
The issue is real — the `SCHEMA_VERSION` constant is unused beyond being stored in the `$schema` field, and `load()` does not validate or migrate old schemas. However, this is a purely internal implementation quality issue. The ACP specification has no requirements about agent-internal memory persistence, schema versioning, or migration. This is a code quality/robustness concern, not an ACP compliance violation.

## Remediation
N/A for ACP compliance. For general code quality:
1. Compare `parsed.$schema` against `SCHEMA_VERSION` in `load()` and log a warning or run migrations when they differ.
2. Add a migration registry: `Map<string, (store: unknown) => MemoryStore>` keyed by old version.
