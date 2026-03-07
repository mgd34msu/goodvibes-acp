# ISS-028: agentInfo missing title field in initialize response

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 114-116
**Topic**: Initialization

## Issue Description
`agentInfo` missing `title` field. Spec type specifies `name`, `title`, `version`. Add `title: 'GoodVibes Runtime'`.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 02-initialization.md lines 126-130, 160-165
- **Spec Says**: The `agentInfo` object has three fields: `name` (machine-readable identifier), `title` (human-readable display name), and `version` (semver string). The KB example shows `"agentInfo": { "name": "my-agent", "title": "My Agent", "version": "1.0.0" }`. The TypeScript type definition also includes all three fields.
- **Confirmed**: Yes
- **Notes**: While `agentInfo` itself is optional in the SDK type (`agentInfo?: Implementation`), when provided it should include all fields. The `title` field is how clients display the agent name to users.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 114-116 define `agentInfo: { name: 'goodvibes', version: '0.1.0' }`. The `title` field is missing entirely. The SDK `Implementation` type (KB 09, line 703) defines `{ name: string, version: string }` -- however the KB 02 initialization reference shows `title` as a field in practice.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `title` field to the agentInfo object:
```typescript
agentInfo: {
  name: 'goodvibes',
  title: 'GoodVibes Runtime',
  version: '0.1.0',
},
```
