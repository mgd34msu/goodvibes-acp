# ISS-086 — Skill registry content is placeholder-quality for non-protocol skills

**Severity**: Minor
**File**: `src/plugins/skills/registry.ts`
**Lines**: 122–144
**KB Reference**: N/A (Completeness)

## Issue

The outcome and quality skill definitions in the skill registry use single-sentence placeholder `content` fields:

```typescript
{ name: 'ai-integration', ..., content: 'Integrate AI capabilities with proper streaming and error handling.' },
{ name: 'api-design', ..., content: 'Design type-safe API endpoints with validation and error handling.' },
// ... all outcome/quality skills follow this pattern
```

These are not actionable guidance — they merely restate the `description` field in slightly different words. Protocol skills (e.g., `task-orchestration`, `fullstack-feature`) have substantive multi-sentence content.

### Verdict: NOT_ACP_ISSUE

This is a content completeness concern, not an ACP protocol compliance issue. The ACP specification does not define skill registries, skill content format, or skill quality requirements. The skill system is a GoodVibes-specific extension.

While improving these placeholders would enhance the runtime's usefulness, it has no bearing on ACP compliance.
