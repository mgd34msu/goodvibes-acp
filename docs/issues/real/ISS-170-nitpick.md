# ISS-170 — Commands Use name with / Prefix Instead of id as Primary Identifier

**Severity**: Nitpick
**File**: src/extensions/acp/commands-emitter.ts:19-50
**KB Topic**: Prompt Turn

## Original Issue
**[src/extensions/acp/commands-emitter.ts:19-50]** Commands use `'name'` with `'/'` prefix (e.g., `'/status'`) but spec uses `'id'` as primary identifier and `'name'` as human-readable. Use `{ id: 'status', name: 'Show status', description: '...' }` pattern. *(Prompt Turn)*

## Verification

### Source Code Check
```typescript
const GOODVIBES_COMMANDS: acp.AvailableCommand[] = [
  {
    name: '/status',
    description: 'Show runtime status and health',
    _meta: { category: 'info' },
  },
  {
    name: '/agents',
    description: 'List active agent chains',
    _meta: { category: 'info' },
  },
  // ... etc.
];
```
Commands have only `name` (with `/` prefix) and `description`. No `id` field is present.

The `CommandsEmitter.emitCommands()` emits:
```typescript
const update: acp.AvailableCommandsUpdate = {
  availableCommands: GOODVIBES_COMMANDS,
};
await this.conn.sessionUpdate({
  sessionId,
  update: {
    sessionUpdate: 'available_commands_update',  // also wrong — see issue #7
    ...update,
  } as acp.SessionUpdate,
});
```

### ACP Spec Check
From KB (04-prompt-turn.md), the `available_commands` update defines:
```typescript
interface AvailableCommandsUpdate {
  sessionUpdate: "available_commands";
  commands: AgentCommand[];
}

interface AgentCommand {
  id: string;       // primary identifier
  name: string;     // human-readable label
  description?: string;
}
```
The spec example:
```json
{
  "id": "compact",
  "name": "Compact conversation",
  "description": "Summarize and compress conversation history"
}
```
`id` is the machine-readable identifier (no slash prefix), `name` is the human-readable label. The implementation conflates these by using the command token (`'/status'`) as the `name` instead of using `id`.

**Note:** This issue also relates to the confirmed Critical issue #7 — the discriminator `available_commands_update` should be `available_commands` and the field `availableCommands` should be `commands`. Issue 170 specifically flags the command object structure.

### Verdict: CONFIRMED
The command objects are missing the required `id` field. The `name` field is used as a slash-command token (`'/status'`) rather than a human-readable label. The ACP spec clearly defines `AgentCommand` with a separate `id` (machine identifier) and `name` (human label). ACP-compliant clients will expect `id` for command invocation and `name` for display — using only `name` with a slash prefix breaks both semantics.

## Remediation
1. Add `id` to each command (without slash prefix — the slash is a display convention, not the identifier):
   ```typescript
   const GOODVIBES_COMMANDS: acp.AvailableCommand[] = [
     {
       id: 'status',
       name: 'Show runtime status',
       description: 'Show runtime status and health',
     },
     {
       id: 'agents',
       name: 'List active agents',
       description: 'List active agent chains',
     },
     {
       id: 'analytics',
       name: 'Show analytics',
       description: 'Show token usage and budget',
     },
     {
       id: 'mode',
       name: 'Switch mode',
       description: 'Switch runtime mode (justvibes/vibecoding/plan/sandbox)',
     },
     {
       id: 'review',
       name: 'Manual review',
       description: 'Trigger manual code review',
     },
     {
       id: 'cancel',
       name: 'Cancel operation',
       description: 'Cancel current operation',
     },
   ];
   ```
2. This fix should be applied alongside issue #7 (wrong discriminator `available_commands_update` → `available_commands` and wrong field `availableCommands` → `commands`).
