# ISS-009: configOptions stored as flat `Record<string, string>` instead of `ConfigOption[]`

**Severity**: Major
**File**: src/extensions/sessions/manager.ts
**Line(s)**: 235-250
**Topic**: Sessions

## Issue Description
`setConfigOption` stores configOptions as flat `Record<string, string>` instead of ACP `ConfigOption[]` structure with `id`, `name`, `description`, `category`, `type`, `currentValue`, `options[]`. Clients cannot reconstruct full config state.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/03-sessions.md lines 252-275
- **Spec Says**: `ConfigOption` is a rich object: `{ id: string; name: string; description?: string; category?: ConfigOptionCategory; type: ConfigOptionType; currentValue: string; options: ConfigOptionValue[]; }`. The wire format includes all metadata needed for client UI rendering.
- **Confirmed**: Partial
- **Notes**: The spec defines the wire format for ConfigOption, but does not mandate internal storage format. What matters is that the wire format sent to clients is correct.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 239-248 store config as `configOptions: { ...stored.config.configOptions, [key]: value }` -- a flat `Record<string, string>`. However, the agent layer at `agent.ts` lines 394-400 calls `buildConfigOptions(currentMode, currentModel)` which reconstructs the full `ConfigOption[]` structure for the wire format. The storage is an internal implementation detail.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL
The internal storage format is flat, but the wire format is correctly reconstructed by `buildConfigOptions()` in the agent layer. The flat storage is an acceptable implementation choice as long as the agent layer can reconstruct the full `ConfigOption[]` from it. The real risk is that arbitrary config options (beyond mode/model) cannot be round-tripped because `buildConfigOptions()` only knows about predefined options. If custom config options are added, they would be lost.

## Remediation Steps
1. Consider storing the full `ConfigOption` structure if custom/dynamic config options are planned
2. Ensure `buildConfigOptions()` can reconstruct all config options, not just the predefined mode/model ones
3. If only mode/model are supported, document that limitation -- the current approach works but is fragile
