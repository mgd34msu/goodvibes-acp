# ISS-191 — SkillDefinition.content Has No Max Length Constraint

**Severity**: Nitpick
**File**: src/plugins/skills/types.ts:21
**KB Topic**: Implementation Guide

## Original Issue

**[src/plugins/skills/types.ts:21]** `SkillDefinition.content` typed as `string` with no max length constraint. *(Implementation Guide)*

## Verification

### Source Code Check

Line 36 of `src/plugins/skills/types.ts`:
```typescript
/** Content template (the actual skill prompt/instructions) */
content: string;
```

The `SkillDefinition` type has `content: string` with no length constraint — no runtime validation, no JSDoc noting a limit, no Zod schema or similar. This is confirmed.

### ACP Spec Check

The ACP specification (Overview, Implementation Guide sections) defines the protocol wire format for `initialize`, `session/new`, `session/prompt`, `session/update`, and related methods. It does not define a concept of "skills", skill registries, or skill content length limits. Skills are a GoodVibes-internal concept layered on top of ACP, not an ACP protocol primitive.

The `Implementation Guide` KB file addresses how to implement an ACP-compliant agent but does not specify constraints on internal skill content storage or prompt template sizes.

### Verdict: NOT_ACP_ISSUE

The issue is real: `content: string` has no length constraint and very large skill content could cause performance issues at runtime (loading, matching, injecting into prompts). However, this is an internal implementation quality concern. The ACP specification has no requirements about how agents store or size their internal prompt templates. This is not an ACP compliance issue.

## Remediation

N/A (not an ACP compliance issue)

For code quality, consider adding a JSDoc comment noting recommended/maximum content sizes, or adding a Zod schema for runtime validation when skills are loaded from disk:
```typescript
/** Content template (the actual skill prompt/instructions). Recommended max: 50,000 chars. */
content: string;
```
