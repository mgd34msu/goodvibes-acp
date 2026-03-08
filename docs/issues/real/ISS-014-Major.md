# ISS-014 — setConfigOption returns incomplete config state

**Severity**: Major
**File**: src/extensions/sessions/manager.ts
**KB Topic**: KB-03: Config Options System

## Original Issue
The ACP spec requires that the `set_config_option` response returns the complete set of config options with full metadata. The current implementation builds a minimal representation with just `id`, `name: id`, `category: 'session'`, and empty `options: []`. The `buildConfigOptions()` function already produces the correct response.

## Verification

### Source Code Check
At lines ~298-305 of `src/extensions/sessions/manager.ts`:
```typescript
return Object.entries(updatedOptions).map(([id, currentValue]) => ({
  id,
  name: id,
  category: 'session',
  type: 'text' as const,
  currentValue,
  options: [],
}));
```
This returns only the options from the flat key-value store with minimal metadata. It uses `name: id` (machine ID as human name), hardcodes `category: 'session'` and `type: 'text'`, and provides empty `options: []`.

### ACP Spec Check
KB-03 states the response is "always the complete config state (all options, not just the changed one)."

The SDK type `SetSessionConfigOptionResponse` confirms: `configOptions: Array<SessionConfigOption>` with JSDoc "The full set of configuration options and their current values."

The current implementation violates both: it returns only the changed session's flat options (not the full config including mode/model), and the metadata is minimal/incorrect.

### Verdict: CONFIRMED
The code returns an incomplete, minimally-structured config state instead of the full `SessionConfigOption[]` with proper metadata. Both the spec prose and SDK type require the complete set of configuration options.

## Remediation
1. Replace the manual construction with a call to `buildConfigOptions(currentMode, currentModel)` from `config-adapter.ts`, which already produces the correct full response.
2. Pass the current mode and model values from the session context to `buildConfigOptions()`.
3. Ensure the response includes all config options (mode, model, etc.), not just the flat key-value entries.
