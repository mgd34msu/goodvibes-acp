# ISS-018: MCPServerConfig stdio variant requires wrong discriminator

**Severity**: Major  
**File**: `src/types/session.ts`  
**Lines**: 48-60  
**KB Reference**: KB-09 (MCP Servers)

## Description

The type uses `type: 'stdio'` discriminator for stdio servers, but the SDK's `McpServerStdio` has no `type` field in the union. Also, `args` and `env` are optional in our type but required in the SDK.

## Evidence

Our type (`src/types/session.ts` lines 48-60):
```typescript
export type MCPServerConfig =
  | { type: 'stdio'; name: string; command: string; args?: string[]; env?: EnvVariable[]; }
  | { type: 'http' | 'sse'; name: string; url: string; headers?: HttpHeader[]; }
```

The SDK `McpServer` union:
```typescript
export type McpServer = (McpServerHttp & { type: "http" }) 
  | (McpServerSse & { type: "sse" }) 
  | McpServerStdio;  // NO type discriminator
```

The SDK `McpServerStdio`:
```typescript
export type McpServerStdio = {
  _meta?: { [key: string]: unknown } | null;
  args: Array<string>;     // REQUIRED
  command: string;
  env: Array<EnvVariable>; // REQUIRED
  name: string;
};
```

Key differences:
1. SDK stdio variant has NO `type` discriminator (discriminated by absence of `type`)
2. `args` is required in SDK, optional in ours
3. `env` is required in SDK, optional in ours
4. SDK includes `_meta` field, ours does not

### Verdict: CONFIRMED

All three aspects of the issue are verified against the SDK. The stdio variant's discriminator pattern, field optionality, and missing `_meta` all diverge from the SDK.

## Remediation

1. Remove `type: 'stdio'` from the stdio variant (discriminate by absence of `type`).
2. Make `args` and `env` required fields (can default to `[]` at construction).
3. Add `_meta?: Record<string, unknown>` to both variants.
4. Ensure code that checks `config.type === 'stdio'` is updated to check for absence of `type` or presence of `command`.
