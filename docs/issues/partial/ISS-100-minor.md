# ISS-100: Config option IDs use dotted namespace instead of simple IDs

**Severity**: Minor
**File**: src/extensions/acp/config-adapter.ts
**Line(s)**: 22-23
**Topic**: Sessions

## Issue Description
Config option IDs use dotted namespace (`'goodvibes.mode'`, `'goodvibes.model'`) while spec examples use simple IDs (`'mode'`, `'model'`). Clients matching on `'mode'` won't find `'goodvibes.mode'`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 03-sessions.md, lines 286-338; KB 01-overview.md, lines 292-334
- **Spec Says**: Config option `id` is a free-form string, but all spec examples use simple IDs: `"id": "mode"`, `"id": "model"`. The `session/set_config_option` request uses `"configId": "mode"`. No namespacing convention is defined in the spec.
- **Confirmed**: Partial
- **Notes**: The spec does not explicitly prohibit namespaced IDs, but clients (like Zed) that match on well-known IDs (`mode`, `model`) for special UI treatment will fail to match `goodvibes.mode`. The `category` field already provides semantic grouping, making the namespace prefix in the ID redundant.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 22: `const CONFIG_ID_MODE = 'goodvibes.mode' as const;`, Line 23: `const CONFIG_ID_MODEL = 'goodvibes.model' as const;`. These are used when building config options for ACP responses.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL

## Remediation Steps
1. Change to simple IDs matching spec examples:
   ```typescript
   const CONFIG_ID_MODE = 'mode' as const;
   const CONFIG_ID_MODEL = 'model' as const;
   ```
2. Keep the `category` field for semantic grouping (already present).
3. If agent-specific namespacing is desired, use the `_` prefix convention for custom categories instead of ID namespacing.
