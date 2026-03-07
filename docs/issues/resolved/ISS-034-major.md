# ISS-034: Session mode IDs don't match ACP-standard examples

**Severity**: Major
**File**: src/extensions/sessions/modes.ts
**Line(s)**: 23 (MODE_DEFINITIONS, lines 50-93)
**Topic**: Sessions

## Issue Description
Session modes don't map to ACP-standard modes. Spec examples: `'ask'`, `'architect'`, `'code'`. Implementation: `'justvibes'`, `'vibecoding'`, `'sandbox'`, `'plan'`. Map GoodVibes modes to ACP-standard IDs for wire format, or document as agent-specific.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md, lines 424-442
- **Spec Says**: The legacy modes example shows `availableModes` with IDs `'ask'`, `'architect'`, `'code'`. However, mode IDs are typed as `SessionModeId = string`, meaning they are agent-defined. The spec examples are illustrative, not normative.
- **Confirmed**: Partial
- **Notes**: Mode IDs are arbitrary strings per the spec type definition. The spec examples (`ask`, `architect`, `code`) are from a reference implementation (likely Claude Code), not mandated values. However, using non-standard IDs means clients built for common agents may not recognize GoodVibes modes.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: MODE_DEFINITIONS defines four modes: `justvibes`, `vibecoding`, `sandbox`, `plan`. These are GoodVibes-specific names that don't match common ACP examples.
- **Issue Confirmed**: Partial — modes are agent-specific by spec, but interoperability suffers.

## Verdict
PARTIAL

## Remediation Steps
1. Document that GoodVibes uses agent-specific mode IDs (this is spec-compliant)
2. Consider mapping to ACP-conventional IDs on the wire: `justvibes` -> `ask`, `vibecoding` -> `code`, `plan` -> `architect`
3. Or add a comment in `modes.ts` explaining the intentional divergence from common examples
