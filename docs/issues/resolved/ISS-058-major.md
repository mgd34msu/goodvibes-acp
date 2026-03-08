# ISS-058 — MCP env Field Typed as Record<string, string> — Spec Requires EnvVariable[]

**Severity**: Major
**File**: src/types/session.ts:44-45
**KB Topic**: MCP Server Transports — Stdio (03-sessions.md lines 186-190)

## Original Issue
The `env` field in the stdio MCPServerConfig variant is `Record<string, string>`, but the ACP spec defines it as `EnvVariable[]`.

## Verification

### Source Code Check
Lines 44-45 of `src/types/session.ts`:
```typescript
/** Additional environment variables for the subprocess */
env?: Record<string, string>;
```

### ACP Spec Check
KB-03 (lines 182-190) defines the stdio MCP server transport:
```typescript
interface StdioMcpServer {
  name: string;
  command: string;
  args: string[];
  env?: EnvVariable[];
}

interface EnvVariable {
  name: string;
  value: string;
}
```
The `env` field is `EnvVariable[]` — an array of `{ name: string; value: string }` objects — not a flat `Record<string, string>`.

### Verdict: CONFIRMED
The code uses `Record<string, string>` for `env` while the ACP spec requires `EnvVariable[]`. This is a wire format mismatch that will cause serialization/deserialization failures when exchanging MCP server configurations with ACP clients.

## Remediation
1. Define the `EnvVariable` type:
   ```typescript
   export type EnvVariable = { name: string; value: string };
   ```
2. Update the stdio `MCPServerConfig` variant:
   ```typescript
   env?: EnvVariable[];
   ```
3. Update all code that constructs or reads `env` to use the array-of-objects format
4. Add a conversion utility if needed for compatibility with Node.js `child_process` (which expects `Record<string, string>`)
