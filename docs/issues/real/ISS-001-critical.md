# ISS-001 — `setConfigOption` returns wrong `type` value for `SessionConfigOption`

**Severity**: Critical
**File**: `src/extensions/sessions/manager.ts`
**KB Topic**: KB-03: Config Options System

## Original Issue
The `setConfigOption` method builds its return value with `type: 'text' as const`, but the ACP SDK type `SessionConfigOption` is an intersection that hardcodes `type: "select"`. The only valid value for `type` in the current ACP spec is `"select"`. Using `"text"` produces a response that does not match the wire format.

## Verification

### Source Code Check
Line 302 of `src/extensions/sessions/manager.ts` returns:
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

The code does use `type: 'text' as const`.

### ACP Spec Check
KB-03 line 258 defines `type ConfigOptionType = "select";` — only `"select"` is valid.

However, KB-01 line 301 defines `type: 'select' | 'text' | 'boolean'` in a higher-level overview. These two KB sources contradict each other.

The internal type at `src/types/config.ts` line 89 defines `SessionConfigOptionType = 'select' | 'boolean' | 'text'` with a comment citing KB-01 line 301.

KB-03 is the more authoritative, detailed specification for ConfigOptions. It restricts the type to `"select"` only.

### Verdict: CONFIRMED
The code uses `'text'` which contradicts KB-03's strict definition of `ConfigOptionType = "select"`. While KB-01 suggests a broader union, KB-03 (the authoritative config options section) restricts to `"select"` only. Since `session/set_config_option` responses go over the wire, using a value outside the spec risks interoperability failures.

## Remediation
1. Change `type: 'text' as const` to `type: 'select' as const` on line 302 of `src/extensions/sessions/manager.ts`.
2. Consider whether the broader `SessionConfigOptionType` in `src/types/config.ts` should also be narrowed to just `'select'` to match KB-03, or kept broad if the implementation intends to support future spec additions.
