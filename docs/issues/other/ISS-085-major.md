# ISS-085: registerPlugin hardcodes L3 shutdown order

**Severity**: Major
**File**: src/extensions/lifecycle/shutdown.ts
**Line(s)**: 87-96
**Topic**: Initialization

## Issue Description
`registerPlugin` hardcodes L3 (300) shutdown order. No mechanism for plugins to specify custom ordering.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/02-initialization.md
- **Spec Says**: No specific guidance found in the Initialization KB regarding plugin shutdown ordering. The ACP spec does not define a shutdown sequence or ordering requirements for plugins.
- **Confirmed**: No
- **Notes**: The ACP protocol focuses on initialization handshake (initialize/initialized) and does not prescribe internal shutdown mechanics. This is purely an internal architecture concern.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `registerPlugin()` at lines 87-96 always passes `SHUTDOWN_ORDER.L3` (value 300) to `this.register()`. The `PluginRegistration` type does not include a shutdown order field. Plugins cannot specify their preferred shutdown order -- all plugins shut down at the same priority level.
- **Issue Confirmed**: Yes -- the hardcoded order is real, but it is not an ACP compliance issue.

## Verdict
NOT_ACP_ISSUE

## Remediation Steps
1. Add an optional `shutdownOrder` field to `PluginRegistration` or `PluginManifest`
2. Use the plugin-specified order when available, falling back to `SHUTDOWN_ORDER.L3` as default
3. Document the shutdown order levels and their intended semantics
