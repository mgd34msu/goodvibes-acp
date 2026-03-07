# ISS-101 — SessionConfigOptionValue Allows boolean/number, ACP Only Supports string

**Severity**: Minor
**File**: src/types/session.ts:60
**KB Topic**: Sessions

## Original Issue
`SessionConfigOptionValue` allows `boolean | number` but ACP `ConfigOption` only defines `type: "select"` with string values. Creates type mismatch on serialization. Restrict to string, or add serialization layer. *(Sessions)*

## Verification

### Source Code Check
`src/types/session.ts:60`:
```typescript
export type SessionConfigOptionValue = string | boolean | number;
```

This type is used at `src/types/session.ts:56`:
```typescript
configOptions?: Record<string, SessionConfigOptionValue>;
```

Meanwhile, `src/types/config.ts:86` defines:
```typescript
export type SessionConfigOptionType = 'select' | 'boolean' | 'text';
```
And `src/types/config.ts:102`:
```typescript
currentValue: string | boolean;
```

So the local `SessionConfigOption` type does allow `boolean` for `currentValue`, but the separate `SessionConfigOptionValue` (used in session config overrides) additionally allows `number`.

### ACP Spec Check
From `docs/acp-knowledgebase/03-sessions.md`, the ACP `ConfigOption` interface is:
```typescript
type ConfigOptionType = "select"; // only type currently defined

interface ConfigOption {
  id: string;
  name: string;
  description?: string;
  category?: ConfigOptionCategory;
  type: ConfigOptionType;            // currently only "select"
  currentValue: string;              // currently selected value — string only
  options: ConfigOptionValue[];
}

interface ConfigOptionValue {
  value: string;    // identifier used when setting — string only
  name: string;
}
```

The spec explicitly types `currentValue` as `string` (not `string | boolean | number`). The `type` field currently only supports `"select"`, not `"boolean"` or `"text"`. All config option values on the wire are strings.

### Verdict: CONFIRMED
The ACP spec defines `ConfigOption.currentValue` as `string` only. The internal `SessionConfigOptionValue = string | boolean | number` type is broader than what ACP can represent on the wire. If boolean or number values are stored and then serialized into ACP `session/update` config notifications or `session/set_config_option` responses, they will produce type mismatches. The `src/types/config.ts:SessionConfigOption.currentValue: string | boolean` is also wider than the spec's `string`.

Note: the local code's `SessionConfigOptionType` adds `'boolean'` and `'text'` on top of the spec's `"select"` only type — those extensions are not on the ACP wire.

## Remediation
1. Restrict `SessionConfigOptionValue` to `string` to match ACP wire format:
   ```typescript
   export type SessionConfigOptionValue = string;
   ```
2. If boolean/number config values are needed internally, add an explicit serialization layer that converts to string before emitting ACP `config_options_update` notifications.
3. In `src/types/config.ts`, restrict `SessionConfigOption.currentValue` to `string` (not `string | boolean`) to align with the spec.
4. Remove `'boolean'` and `'text'` from `SessionConfigOptionType` or document them as non-ACP extensions with a note that they must be serialized as `"select"` on the wire.
