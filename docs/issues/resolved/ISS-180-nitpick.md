# ISS-180 — `VALID_ENCODINGS` Set Recreated on Every Call

**Severity**: Minor (nitpick-level)
**File**: src/extensions/acp/fs-bridge.ts:56, 86
**KB Topic**: Filesystem & Terminal

## Original Issue
`VALID_ENCODINGS` set recreated on every read/write call. Move to module-level constant.

## Verification

### Source Code Check
In `readTextFile()` (line 56):
```typescript
const VALID_ENCODINGS = new Set<BufferEncoding>(['utf-8', 'utf8', 'ascii', 'base64', 'hex', 'latin1', 'binary', 'ucs-2', 'ucs2', 'utf16le']);
```

In `writeTextFile()` (line 86):
```typescript
const VALID_ENCODINGS = new Set<BufferEncoding>(['utf-8', 'utf8', 'ascii', 'base64', 'hex', 'latin1', 'binary', 'ucs-2', 'ucs2', 'utf16le']);
```

The identical `Set` is constructed twice in separate method bodies, and each construction happens on every invocation of `readTextFile()` or `writeTextFile()`. This creates unnecessary garbage collection pressure and duplicates the encoding list.

### ACP Spec Check
This is a pure JavaScript/TypeScript code quality and performance concern. The ACP specification does not define how encoding validation is implemented, nor does it govern how constants are scoped. This has zero ACP protocol compliance implications.

### Verdict: NOT_ACP_ISSUE
The issue is accurate — the `Set` is wastefully recreated on every call and the encoding list is duplicated. However, it is entirely a code quality and micro-performance concern with no ACP compliance implications. It is correctly classified as a nitpick.

## Remediation
N/A for ACP compliance. For code quality:
```typescript
// At module level (outside the class):
const VALID_ENCODINGS = new Set<BufferEncoding>([
  'utf-8', 'utf8', 'ascii', 'base64', 'hex', 'latin1', 'binary', 'ucs-2', 'ucs2', 'utf16le'
]);
```
This creates the `Set` once at module load time, is shared across all `FsBridge` instances, and eliminates the duplicate definition.
