# ISS-057 — setConfigOption Return Type Is Flat Key-Value Map — Spec Requires ConfigOption[]

**Severity**: Major
**File**: src/extensions/sessions/manager.ts:268-292
**KB Topic**: Config Options System — Setting a Config Option response (03-sessions.md lines 342-367)

## Original Issue
`setConfigOption` returns `Record<string, string>` instead of the full `ConfigOption[]` array required by the spec response shape.

## Verification

### Source Code Check
The method signature at line 272:
```typescript
async setConfigOption(
  sessionId: string,
  key: string,
  value: string,
): Promise<Record<string, string>> {
```
The implementation at lines 276-292 maintains config as a flat `Record<string, string>` map and returns it directly:
```typescript
const updatedOptions: Record<string, string> = {
  ...stored.config.configOptions,
  [key]: value,
};
// ...
return updatedOptions;
```

### ACP Spec Check
KB-03 (lines 342-367) specifies the `session/set_config_option` response must be:
```json
{
  "result": {
    "configOptions": [
      { "id": "mode", "name": "Session Mode", "type": "select", "currentValue": "code", "options": [] },
      { "id": "model", "name": "Model", "type": "select", "currentValue": "model-1", "options": [] }
    ]
  }
}
```
The spec states: "always the complete config state (all options, not just the changed one)" — as a `ConfigOption[]` array with full metadata per option.

### Verdict: CONFIRMED
The return type is `Record<string, string>` (a flat key-value map) instead of `ConfigOption[]` (an array of typed config option objects with `id`, `name`, `type`, `currentValue`, `options`, etc.). This does not match the ACP wire format.

## Remediation
1. Define or import the `ConfigOption` type matching the ACP spec
2. Store config options internally as `ConfigOption[]` instead of `Record<string, string>`
3. Update `setConfigOption` to return `Promise<ConfigOption[]>`
4. The return value should be the complete list of all config options with updated `currentValue` for the changed option
5. Update the ACP handler that calls this method to wrap the result as `{ configOptions: result }`
