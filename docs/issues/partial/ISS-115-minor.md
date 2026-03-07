# ISS-115 — MCP env Array vs Record Discrepancy: KB Docs May Be Stale

**Severity**: Minor
**File**: src/extensions/mcp/bridge.ts:200-213
**KB Topic**: Tools & MCP

## Original Issue

**[src/extensions/mcp/bridge.ts:200-213]** `McpServerStdio.env` treated as array `{name, value}` vs spec `Record<string,string>`. SDK is reportedly correct; KB docs may be stale. Document the discrepancy. *(Tools & MCP)*

## Verification

### Source Code Check

`bridge.ts` lines 197-213 (`_createClient` method):

```typescript
if ('command' in server) {
  // McpServerStdio
  const stdio = server as McpServerStdio;
  const env: Record<string, string> = {};
  for (const v of stdio.env ?? []) {
    // EnvVariable has { name: string; value: string } shape
    env[v.name] = (v as { name: string; value: string }).value;
  }
  return createMcpStdioTransport({
    name: stdio.name,
    command: stdio.command,
    args: stdio.args,
    env,
  });
}
```

The code iterates `stdio.env` as `EnvVariable[]` with `{ name, value }` shape, converts it to `Record<string, string>`, and passes the record to `createMcpStdioTransport`. The comment itself acknowledges the `EnvVariable { name, value }` shape.

The ACP KB (`05-permissions.md` and `07-filesystem-terminal.md`) don't document MCP server env format. The ACP spec's `StdioMcpServer` type (per ISS-10) defines `env: EnvVariable[]`. The conversion code is defensive and correct — it handles the array shape and produces a Record for the transport layer.

### ACP Spec Check

From ACP KB for sessions (referenced in ISS-10): `StdioMcpServer { name, command, args, env: EnvVariable[] }`. The `EnvVariable` type has `{ name: string; value: string }` shape per the ACP TypeScript SDK.

The issue says "SDK is reportedly correct" — meaning the SDK's `env` is indeed `EnvVariable[]`, and the bridge's conversion is the correct approach. The discrepancy mentioned is that earlier issues (ISS-41, Critical) flagged this as wrong, but the bridge actually handles it correctly by converting.

### Verdict: PARTIAL

The issue as stated is overstated. The bridge correctly converts `EnvVariable[]` to `Record<string, string>` for the transport. However:

1. The `as { name: string; value: string }` type cast on line 207 is a code smell — it duplicates the SDK type inline rather than importing `EnvVariable` from the SDK.
2. The comment says "EnvVariable has { name: string; value: string } shape" which confirms the conversion is intentional but the approach is fragile (the cast will silently compile even if the SDK type changes).
3. ISS-41 (Major) flags the same file/lines as actually wrong — this Minor issue (ISS-115) is a de-duplication/documentation note about ISS-41.

The code functions correctly but needs the type cast replaced with a proper import, and documentation clarifying that ACP uses `EnvVariable[]` while `createMcpStdioTransport` expects `Record<string, string>`.

## Remediation

1. Import `EnvVariable` from the ACP SDK instead of using an inline cast:
   ```typescript
   import type { McpServerStdio, EnvVariable } from '@agentclientprotocol/sdk';
   // ...
   for (const v of (stdio.env ?? []) as EnvVariable[]) {
     env[v.name] = v.value;
   }
   ```
2. Add a comment explaining the conversion:
   ```typescript
   // ACP SDK defines env as EnvVariable[] ({ name, value }[])
   // createMcpStdioTransport expects Record<string, string> — convert here
   ```
3. This issue is resolved once ISS-41 (which mandates the same fix) is addressed.
