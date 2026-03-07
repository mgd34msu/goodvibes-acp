# ISS-007: `available_commands` update uses wrong discriminator, field name, and missing `id`

**Severity**: Critical
**File**: src/extensions/acp/commands-emitter.ts
**Line(s)**: 19-50, 72-82
**Topic**: Prompt Turn

## Issue Description
`available_commands` update uses wrong discriminator (`available_commands_update`) and wrong field name (`availableCommands` instead of `commands`). Command objects also missing `id` field -- spec requires `{ id, name, description }`. Fix all three.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/04-prompt-turn.md lines 319-354
- **Spec Says**: The update uses discriminator `sessionUpdate: "available_commands"` with field `commands: AgentCommand[]`. `AgentCommand` has `{ id: string; name: string; description?: string; }`.
- **Confirmed**: Yes
- **Notes**: Three distinct issues confirmed: (1) discriminator is `available_commands` not `available_commands_update`, (2) field is `commands` not `availableCommands`, (3) each command must have an `id` field.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**:
  - Line 80: `sessionUpdate: 'available_commands_update'` (wrong -- should be `'available_commands'`)
  - Line 73: `availableCommands: GOODVIBES_COMMANDS` (wrong field name -- should be `commands`)
  - Lines 19-50: Command objects have `{ name, description, _meta }` but no `id` field (spec requires `id`)
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
All three problems are verified against the ACP spec:
1. Wrong discriminator: `available_commands_update` should be `available_commands`
2. Wrong field name: `availableCommands` should be `commands`
3. Missing `id` field on command objects

Clients will not recognize this update and will never display the commands.

## Remediation Steps
1. Change discriminator from `'available_commands_update'` to `'available_commands'` at line 80
2. Change field from `availableCommands` to `commands` at line 73
3. Add `id` field to each command in `GOODVIBES_COMMANDS` (e.g., `id: 'status'` for `/status`)
4. Remove the `as acp.SessionUpdate` cast at line 82 -- the correct shape should type-check without it
