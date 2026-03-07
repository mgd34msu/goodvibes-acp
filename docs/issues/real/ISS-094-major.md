# ISS-094: Skill content is placeholder-level — single sentences

**Severity**: Major
**File**: src/plugins/skills/registry.ts
**Line(s)**: 23-112
**Topic**: Implementation Guide

## Issue Description
Skill content is placeholder-level — single sentences. Not actionable for agents.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 10-implementation-guide.md (general implementation quality)
- **Spec Says**: N/A — Skills are a GoodVibes-specific concept, not part of the ACP protocol specification.
- **Confirmed**: No (not an ACP spec issue)
- **Notes**: This is an implementation quality issue, not an ACP protocol compliance issue. The ACP spec does not define a skills system.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Every skill in the registry has a `content` field with a single sentence, e.g.:
  - `'Use precision_engine tools with appropriate verbosity and extract modes.'`
  - `'Follow the GPA loop: GATHER context, PLAN changes, APPLY edits.'`
  - `'Score reviews across 10 dimensions with weighted scoring.'`
  These are too terse to be actionable guidance for an agent. The real skill content exists in the `.goodvibes/` prompt files but is not loaded into the registry.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Load actual skill content from the skill definition files (e.g., from `.goodvibes/prompt/` or a skills content directory).
2. Alternatively, expand inline `content` fields with actionable multi-paragraph guidance.
3. Consider adding a `contentPath` field that points to a markdown file containing the full skill content.
