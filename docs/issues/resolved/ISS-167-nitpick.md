# ISS-167 — setConfigOption Accepts string but SessionConfigOptionValue Is string | boolean | number

**Severity**: Nitpick
**File**: src/extensions/sessions/manager.ts:235
**KB Topic**: Sessions

## Original Issue
**[src/extensions/sessions/manager.ts:235]** `setConfigOption` accepts `value: string` but `SessionConfigOptionValue` is `string | boolean | number`. Type inconsistency. Align parameter type or narrow the union. *(Sessions)*

## Verification

### Source Code Check
```typescript
async setConfigOption(sessionId: string, key: string, value: string): Promise<void> {
  const stored = this._requireStored(sessionId);
  const updated: StoredContext = {
    ...stored,
    config: {
      ...stored.config,
      configOptions: {
        ...stored.config.configOptions,
        [key]: value,
      },
    },
    updatedAt: Date.now(),
  };
  this._store.set(NS, sessionId, updated);
}
```
The method signature uses `value: string`, limiting the parameter to strings only.

### ACP Spec Check
The ACP `session/set_config_option` protocol defines:
```json
{
  "method": "session/set_config_option",
  "params": {
    "sessionId": "...",
    "configId": "mode",
    "value": "code"
  }
}
```
In the current ACP spec, `ConfigOption.type` is only `"select"` and all select option values (`ConfigOptionValue.value`) are typed as `string`. The spec examples exclusively use string values. While the ACP SDK may define `SessionConfigOptionValue` as `string | boolean | number`, the current protocol only uses strings for config option values. The broader union type is forward-looking.

### Verdict: NOT_ACP_ISSUE
The type inconsistency is real and a TypeScript code quality concern — if the GoodVibes codebase internally defines `SessionConfigOptionValue` as `string | boolean | number`, `setConfigOption` should accept the full union. However, the ACP protocol wire format for `set_config_option` currently only sends string values (select options). The narrower `string` type is actually correct for current ACP compliance. The inconsistency is an internal TypeScript type alignment issue, not an ACP protocol violation.

## Remediation
N/A — Not an ACP compliance issue.

For code quality improvement (optional):
- If GoodVibes plans to use boolean/number config values internally, align the type:
  ```typescript
  async setConfigOption(sessionId: string, key: string, value: string | boolean | number): Promise<void>
  ```
- Or define and use `SessionConfigOptionValue` type explicitly in the method signature
