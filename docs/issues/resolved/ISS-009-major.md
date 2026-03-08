# ISS-009 — config_option_update Discriminator Wrong — Should Be config_options_update

**Severity**: Major
**File**: src/extensions/acp/agent.ts:311
**KB Topic**: config_options_update session update (04-prompt-turn.md lines 385-418)

## Original Issue
The `loadSession` method emits `config_option_update` (singular) instead of `config_options_update` (plural). Clients will not recognize the update.

## Verification

### Source Code Check
```typescript
// src/extensions/acp/agent.ts:311
sessionUpdate: 'config_option_update',
configOptions: buildConfigOptions(
  modeFromConfigValue(context.config.mode),
  context.config.model,
),
```
The code uses `config_option_update` (singular, with `_update` suffix).

### ACP Spec Check
KB-04 (04-prompt-turn.md) lines 396-418:
```json
"sessionUpdate": "config_options_update"
```
```typescript
interface ConfigOptionsUpdateUpdate {
  sessionUpdate: "config_options_update";
  configOptions: ConfigOption[];
}
```

KB-04 Update Type Reference (line 556): `config_options_update` — "Agent-initiated config change (complete state)"

KB-01 (01-overview.md) line 214 uses `config_option` (without `_update`), and KB-09 line 923 uses `config_option`. There is some spec inconsistency between the overview/SDK reference and the wire format, but the code's value `config_option_update` matches **neither** form.

The wire format examples and TypeScript interfaces in KB-04 consistently use `config_options_update` (plural with `_update`). The code uses `config_option_update` (singular with `_update`), which is not a valid discriminator in any spec version.

### Verdict: CONFIRMED
The code uses `config_option_update` which does not match the ACP wire format discriminator `config_options_update`. Clients matching against the spec-defined discriminator will silently discard these notifications. Note: there is minor spec inconsistency between overview (`config_option`) and wire format (`config_options_update`), but the code matches neither.

## Remediation
1. Change `'config_option_update'` to `'config_options_update'` at agent.ts:311
2. Ensure the `configOptions` array is the full state (not a delta), per spec requirement
