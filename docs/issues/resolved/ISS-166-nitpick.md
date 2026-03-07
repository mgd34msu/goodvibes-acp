# ISS-166 — Default Model Not Present in Options List

**Severity**: Nitpick
**File**: src/extensions/acp/config-adapter.ts:38-41
**KB Topic**: Sessions

## Original Issue
**[src/extensions/acp/config-adapter.ts:38-41]** Default model `'claude-sonnet-4-6'` does not appear in the options list. `currentValue` won't match any option, confusing client select dropdowns. Add to options or change the default. *(Sessions)*

## Verification

### Source Code Check
The `buildConfigOptions()` function (line 38-99) sets:
- Default `currentModel` parameter: `'claude-sonnet-4-6'` (line 40)
- `currentValue: currentModel` (line 79) in the model `SessionConfigOption`
- Options list contains:
  - `'claude-opus-4-6'`
  - `'claude-sonnet-4-5-20250514'`
  - `'claude-haiku-4-5-20251001'`

The default value `'claude-sonnet-4-6'` does not match any entry in the options array. A client rendering this as a select dropdown would show a currentValue that doesn't correspond to any available option.

### ACP Spec Check
The ACP `ConfigOption` spec defines:
```typescript
interface ConfigOption {
  currentValue: string;  // currently selected value
  options: ConfigOptionValue[];  // available values
}
```
The spec examples consistently show `currentValue` matching one of the `options[].value` entries. While the spec does not explicitly state this as a hard requirement, the semantic intent is clear: `currentValue` represents the active selection from the options list. A mismatch causes undefined behavior in ACP-compliant clients.

From the sessions KB: "ConfigOptions is the preferred (modern) way to expose session-level configuration." A broken model selector undermines this mechanism.

### Verdict: CONFIRMED
The issue is confirmed. `currentValue: 'claude-sonnet-4-6'` is not present in the options array `['claude-opus-4-6', 'claude-sonnet-4-5-20250514', 'claude-haiku-4-5-20251001']`. Any ACP-compliant client rendering this config option as a select dropdown will display an unknown/unmatched current value. This breaks the config options display for all sessions using the default model.

## Remediation
Choose one of:

**Option A — Add the default model to the options list:**
```typescript
options: [
  {
    value: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: 'Latest Sonnet model with balanced performance.',
  },
  {
    value: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    description: 'Most capable model for complex tasks.',
  },
  {
    value: 'claude-sonnet-4-5-20250514',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced performance and speed.',
  },
  {
    value: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fastest model for simple tasks.',
  },
]
```

**Option B — Change the default to match an existing option:**
```typescript
export function buildConfigOptions(
  currentMode: GoodVibesMode = 'justvibes',
  currentModel: string = 'claude-opus-4-6',  // matches first option
): schema.SessionConfigOption[] {
```
