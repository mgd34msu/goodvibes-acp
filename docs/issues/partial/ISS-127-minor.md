# ISS-127 — Tool definitions lack `additionalProperties: false` constraint

**Severity**: Minor
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 38-203
**KB Topic**: KB-08: Protocol Types

## Original Issue
All `inputSchema` objects omit `additionalProperties: false`. Schemas silently accept arbitrary extra fields.

## Verification

### Source Code Check
Confirmed across all 12 tool definitions in TOOL_DEFINITIONS (lines 38-203). None include `additionalProperties: false` in their `inputSchema`. Example:
```typescript
inputSchema: {
  type: 'object',
  required: ['projectRoot'],
  properties: {
    projectRoot: { type: 'string', description: '...' },
  },
},
```

Without `additionalProperties: false`, schemas will validate inputs containing arbitrary extra fields.

### ACP Spec Check
KB-08 discusses protocol types and extensibility but does NOT mandate `additionalProperties: false` for tool input schemas. The ACP protocol itself uses `_meta` for extension data. Adding `additionalProperties: false` is a JSON Schema best practice for strict validation but not an ACP protocol requirement.

The MCP tool specification also does not require this constraint.

### Verdict: PARTIAL
The missing `additionalProperties: false` is confirmed in the source code. However, this is a JSON Schema best practice rather than an ACP protocol violation. It is a valid code quality concern — strict schemas prevent typos in parameter names from being silently ignored — but not an ACP compliance issue.

## Remediation
1. Add `additionalProperties: false` to each `inputSchema` definition in TOOL_DEFINITIONS.
2. This prevents clients from sending unrecognized parameters that would be silently ignored.
3. If future extensibility via extra properties is desired, this can be omitted intentionally (but should be documented as such).
