# ISS-189 — `ExtractMode` Missing `'ast'` Value

**Severity**: Nitpick
**File**: `src/plugins/precision/types.ts:22`
**KB Topic**: Implementation Guide

## Original Issue
`[src/plugins/precision/types.ts:22]` `ExtractMode` missing `'ast'` (also noted as minor #152 — this is the nitpick-category occurrence). *(Implementation Guide)*

## Verification

### Source Code Check
Line 22 of `src/plugins/precision/types.ts`:
```typescript
export type ExtractMode = 'content' | 'outline' | 'symbols' | 'lines';
```
The type has four variants. The JSDoc above it (lines 14–21) documents:
- `content`: full raw file content
- `outline`: structural overview
- `symbols`: exported declarations only
- `lines`: specific line range only

The value `'ast'` is absent from both the type union and the JSDoc.

### ACP Spec Check
The ACP Implementation Guide (KB 10) and GOODVIBES.md describe the precision engine's `extract` parameter. In the GPA loop documentation, `ast` is listed as an extract mode:
> Extract modes: `lines` (80-95% savings) → `symbols` (70-90%) → `outline` (60-80%) → `ast` (50-70%) → `content` (0%)

The PRECISION-MASTERY skill documentation also lists `ast` as a valid extract mode:
| Mode | When to Use | Savings |
|------|------------|-------|
| `ast` | Need structural patterns | 50-70% |

The `precision_read` tool (referenced throughout the KB) advertises `'ast'` as a supported extract mode. The TypeScript type is out of sync with the actual tool capability.

### Verdict: CONFIRMED
The `ExtractMode` type in `src/plugins/precision/types.ts` is missing the `'ast'` variant. The precision_read tool accepts `'ast'` as a valid extract mode (per KB documentation and the `precision_read` tool schema), but the TypeScript type does not reflect this. This creates a type gap where callers cannot pass `'ast'` without a type assertion.

This is a duplicate of minor #152 at nitpick severity — the same root defect caught in two review passes.

## Remediation
Update the `ExtractMode` type and its JSDoc in `src/plugins/precision/types.ts`:
```typescript
/**
 * How to extract content from a file during a read operation.
 *
 * - content: full raw file content
 * - outline: structural overview (signatures, no bodies)
 * - symbols: exported declarations only
 * - ast: structural AST patterns for refactoring/detection (50-70% savings)
 * - lines: specific line range only
 */
export type ExtractMode = 'content' | 'outline' | 'symbols' | 'ast' | 'lines';
```
