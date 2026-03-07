# ISS-002: Message type is a flat union instead of discriminated types

**Severity**: Critical
**File**: src/types/transport.ts
**Line(s)**: 73-90
**Topic**: Overview

## Issue Description
Message type is a flat union bag instead of discriminated types. Define three separate types (`JsonRpcRequest`, `JsonRpcResponse`, `JsonRpcNotification`) with proper required/optional fields, then create `AnyMessage` union.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/01-overview.md lines 67-117
- **Spec Says**: JSON-RPC 2.0 defines three distinct message types: (1) Request with `id` + `method` + `params`, (2) Response with `id` + (`result` | `error`), (3) Notification with `method` + `params` but no `id`. These are structurally distinct and should be modeled as discriminated types.
- **Confirmed**: Yes
- **Notes**: The KB shows clear separation between requests (have `id` and `method`), responses (have `id`, `result`/`error`, no `method`), and notifications (have `method`, no `id`). A single flat type with all fields optional prevents compile-time discrimination.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Single `Message` type at lines 73-90 with all fields (`id?`, `method?`, `params?`, `result?`, `error?`) optional. No way to distinguish request from response from notification at the type level.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The flat `Message` type conflates three structurally distinct JSON-RPC 2.0 message types, defeating TypeScript's discriminated union pattern and allowing invalid combinations (e.g., a message with both `method` and `result`).

## Remediation Steps
1. Define `JsonRpcRequest = { jsonrpc: '2.0'; id: string | number; method: string; params?: unknown; }`
2. Define `JsonRpcResponse = { jsonrpc: '2.0'; id: string | number; result?: unknown; error?: { code: number; message: string; data?: unknown; }; }`
3. Define `JsonRpcNotification = { jsonrpc: '2.0'; method: string; params?: unknown; }` (no `id`)
4. Define `AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification`
5. Remove the old `Message` type and update all references
