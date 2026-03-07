# ISS-005: `params.prompt` used instead of `params.messages`

**Severity**: Critical
**File**: src/extensions/acp/agent.ts
**Line(s)**: 246-255
**Topic**: Prompt Turn

## Issue Description
`params.prompt` used to extract content blocks but SDK defines `PromptRequest` with a `messages` field (array of `PromptMessage`). Change to `params.messages.flatMap(m => m.content).filter(b => b.type === 'text').map(b => b.text).join('\n')`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md lines 7-68
- **Spec Says**: `SessionPromptParams { sessionId: string; prompt: ContentBlock[]; }`. The field is named `prompt` and it is an array of `ContentBlock` objects directly -- NOT `messages` containing `PromptMessage` wrappers.
- **Confirmed**: No
- **Notes**: The ACP spec defines the prompt field as `prompt: ContentBlock[]`. The issue claims it should be `params.messages` with `PromptMessage` wrappers, but this does not match the ACP specification. The code correctly uses `params.prompt`.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 247 destructures `const { sessionId, prompt } = params;`, then line 250 filters `prompt.filter(block => block.type === 'text')`. This correctly accesses the `prompt` field as a `ContentBlock[]`.
- **Issue Confirmed**: No

## Verdict
HALLUCINATION
The ACP spec defines `SessionPromptParams.prompt` as `ContentBlock[]`. The code correctly uses `params.prompt` and iterates over content blocks. The issue's claim that the field should be `messages` with `PromptMessage` wrappers does not match the ACP specification. The code is correct.

## Remediation Steps
None required -- the code correctly uses `params.prompt` per the ACP spec.
