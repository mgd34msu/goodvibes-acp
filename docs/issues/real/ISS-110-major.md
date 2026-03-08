# ISS-110 — `AcpSessionUpdateType` uses wrong discriminator value `'config_options_update'`

**Severity**: Major  
**File**: `src/types/events.ts`  
**Line**: 272  
**KB Reference**: KB-01 (Session Update Types), KB-09 (TypeScript SDK)  
**Iteration**: 3

## Description

The `AcpSessionUpdateType` union includes `'config_options_update'` but the ACP spec and SDK both use `'config_option'` (singular, no `_update` suffix). This mismatch causes ACP clients to ignore config option session updates because they do not recognize the discriminator value.

## Source Evidence

```typescript
// src/types/events.ts:272
| 'config_options_update'
```

## Spec Evidence

KB-01 session update types table (line 214):
```
| `config_option` | Config value change |
```

KB-09 SDK session update type (line 923):
```
| "config_option" | Config option updated |
```

Both the spec and SDK use `config_option` — singular, without `_update` suffix.

### Verdict: CONFIRMED

The code uses `'config_options_update'` (plural + `_update` suffix) while both the spec (KB-01) and SDK (KB-09) use `'config_option'` (singular, no suffix). This is a clear wire format mismatch.

## Remediation

1. Change `'config_options_update'` to `'config_option'` on line 272 of `src/types/events.ts`
2. Search the codebase for any references to `'config_options_update'` and update them to `'config_option'`
3. Verify that the session update emitter code uses the corrected discriminator value
