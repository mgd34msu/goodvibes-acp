# ISS-059 — HTTP MCPServerConfig Missing type Discriminator and Uses Wrong headers Type

**Severity**: Major
**File**: src/types/session.ts:47-54
**KB Topic**: MCP Server Transports — HTTP (03-sessions.md lines 196-207)

## Original Issue
The HTTP/SSE MCPServerConfig variant is missing the `type` discriminator field and uses `Record<string, string>` for `headers` instead of `HttpHeader[]`.

## Verification

### Source Code Check
Lines 47-54 of `src/types/session.ts`:
```typescript
| {
    /** Server name / identifier */
    name: string;
    /** HTTP or SSE endpoint URL */
    url: string;
    /** Optional HTTP headers (e.g. Authorization) */
    headers?: Record<string, string>;
  };
```
No `type` discriminator field is present. Headers are typed as `Record<string, string>`.

### ACP Spec Check
KB-03 (lines 196-207) defines the HTTP MCP server transport:
```typescript
interface HttpMcpServer {
  type: "http";
  name: string;
  url: string;
  headers: HttpHeader[];
}

interface HttpHeader {
  name: string;
  value: string;
}
```
The spec requires:
1. A `type: "http"` (or `"sse"`) discriminator field
2. `headers` as `HttpHeader[]` — an array of `{ name: string; value: string }` objects

### Verdict: CONFIRMED
Both issues are present: (1) the `type` discriminator is missing, breaking client-side type narrowing between stdio and HTTP variants, and (2) `headers` uses the wrong type (`Record<string, string>` instead of `HttpHeader[]`), causing a wire format mismatch.

## Remediation
1. Define the `HttpHeader` type:
   ```typescript
   export type HttpHeader = { name: string; value: string };
   ```
2. Add the `type` discriminator to both variants of `MCPServerConfig`:
   ```typescript
   export type MCPServerConfig =
     | {
         type: 'stdio';
         name: string;
         command: string;
         args?: string[];
         env?: EnvVariable[];
       }
     | {
         type: 'http' | 'sse';
         name: string;
         url: string;
         headers?: HttpHeader[];
       };
   ```
3. Update all construction/consumption sites to include the `type` field
4. Update the `headers` usage from key-value pairs to `HttpHeader[]` format
