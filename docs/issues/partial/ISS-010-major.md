# ISS-010 — current_mode Discriminator Wrong — Should Be current_mode_update with modeId

**Severity**: Major
**File**: src/extensions/acp/agent.ts:465
**KB Topic**: current_mode session update (04-prompt-turn.md lines 358-381)

## Original Issue
`setSessionMode` emits `{ sessionUpdate: 'current_mode', modeId: params.modeId }` but the spec requires `{ sessionUpdate: 'current_mode_update', modeId: ... }`.

## Verification

### Source Code Check
```typescript
// src/extensions/acp/agent.ts:462-466
await this.conn.sessionUpdate({
  sessionId: params.sessionId,
  update: { sessionUpdate: 'current_mode' as any, currentModeId: params.modeId } as schema.SessionUpdate,
}).catch(() => {});
```
The code uses discriminator `current_mode` and field `currentModeId`. Note: the `as any` cast indicates the developer knew this didn't match the SDK types.

### ACP Spec Check
KB-04 (04-prompt-turn.md) lines 358-381:
- Header: "current_mode (legacy)" — marked as legacy
- Wire format (line 369): `"sessionUpdate": "current_mode_update"`
- TypeScript (line 377-380): `sessionUpdate: "current_mode_update"; modeId: string;`
- Update type reference (line 557): `current_mode_update`

However, KB-01 (01-overview.md) line 213 says `current_mode` and KB-09 line 922 says `"current_mode"`. This represents a spec inconsistency: the overview/SDK reference uses `current_mode` while the wire format/prompt-turn reference uses `current_mode_update`.

The code has two additional problems regardless of which discriminator is correct:
1. Uses `currentModeId` instead of `modeId` (the spec field is `modeId`)
2. Uses `as any` cast, bypassing SDK type checking

### Verdict: PARTIAL
The discriminator issue is complicated by spec inconsistency between KB sections (`current_mode` vs `current_mode_update`). However, the code has a definite field name error: `currentModeId` should be `modeId`. The `as any` cast masks type errors. The wire format examples in KB-04 (the authoritative session update reference) use `current_mode_update` with `modeId`, making the code wrong on both counts per the detailed spec.

## Remediation
1. Change discriminator from `'current_mode'` to `'current_mode_update'` (per KB-04 wire format)
2. Change field from `currentModeId` to `modeId`
3. Remove the `as any` cast — the update should match `schema.SessionUpdate` without casting
4. Final form: `{ sessionUpdate: 'current_mode_update', modeId: params.modeId }`
