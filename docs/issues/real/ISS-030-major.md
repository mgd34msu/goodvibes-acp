# ISS-030: Missing sessionCapabilities in initialize response

**Severity**: Major
**File**: src/extensions/acp/agent.ts
**Line(s)**: 118-127
**Topic**: Initialization

## Issue Description
Missing `sessionCapabilities` in initialize response. Add `sessionCapabilities: { fork: false, list: false, resume: false }` to inform clients about unsupported features.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 02-initialization.md lines 120-124, 192-198; KB 01-overview.md lines 270-274
- **Spec Says**: The full initialize response includes `sessionCapabilities` within `agentCapabilities`. The type definition shows: `sessionCapabilities?: { fork?: boolean; list?: boolean; resume?: boolean; }`. These gate whether the client can call `session/fork`, `session/list`, and `session/resume` (all unstable APIs). The full wire format example includes them explicitly set to `false`.
- **Confirmed**: Yes
- **Notes**: While `sessionCapabilities` is optional in the TypeScript type (uses `?`), the full wire format example in KB 02 includes it. Omitting it means clients must assume all session management features are unavailable, which is the correct default behavior. However, explicitly declaring them is best practice for clarity.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Lines 118-127 define `agentCapabilities` with `loadSession: true`, `mcpCapabilities` (wrong key -- see issue 4), and `promptCapabilities` (wrong key -- see issue 4). No `sessionCapabilities` field is present. Clients have no way to know whether fork/list/resume are supported.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Add `sessionCapabilities` to the `agentCapabilities` object in the initialize response:
```typescript
agentCapabilities: {
  loadSession: true,
  mcp: { http: false, sse: false },  // also fix key name per issue 4
  prompt: {                           // also fix key name per issue 4
    embeddedContext: true,
    image: false,
    audio: false,
  },
  sessionCapabilities: {
    fork: false,
    list: false,
    resume: false,
  },
},
```
