# ISS-070: Tool call emissions missing _meta with GoodVibes fields

**Severity**: Major
**File**: src/main.ts
**Line(s)**: 276-304
**Topic**: Implementation Guide

## Issue Description
Tool call emissions do not include `_meta` with `_goodvibes/attempt` and `_goodvibes/phase`. The implementation guide explicitly requires these on every tool_call update.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, lines 364-374
- **Spec Says**: WRFC tool_call updates MUST include `_meta: { '_goodvibes/attempt': attempt, '_goodvibes/phase': 'work'|'review'|'fix' }` on every tool_call update. This is the GoodVibes-specific extension metadata that allows ACP clients to understand WRFC phase context.
- **Confirmed**: Yes
- **Notes**: The `_meta` field is part of ACP's extensibility mechanism. GoodVibes uses it to carry attempt numbers and phase identifiers.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Grep for `_meta`, `_goodvibes/attempt`, and `_goodvibes/phase` in `src/main.ts` returns zero matches. The `emitToolCall()` and `emitToolCallUpdate()` calls at lines 276-304 pass no `_meta` parameter. The emitter methods may not even accept a `_meta` parameter based on their signatures.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `_meta` parameter support to `emitToolCall()` and `emitToolCallUpdate()` in `tool-call-emitter.ts`
2. Pass `_meta: { '_goodvibes/attempt': attempt, '_goodvibes/phase': phase }` on every WRFC tool_call emission
3. Include `_meta` on both initial `tool_call` and subsequent `tool_call_update` notifications
4. For review completion updates, also include `_meta: { '_goodvibes/score': score, '_goodvibes/minimumScore': minScore }`
