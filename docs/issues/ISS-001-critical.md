# ISS-001: Stream type parameter is `unknown` instead of `AnyMessage`

**Severity**: Critical
**File**: src/types/transport.ts
**Line(s)**: 21-24
**Topic**: Overview

## Issue Description
Stream type parameter is `unknown` instead of `AnyMessage`. Define `AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification` and parameterize as `WritableStream<AnyMessage>` / `ReadableStream<AnyMessage>`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/01-overview.md lines 47-52; agentclientprotocol.com/llms-full.txt (404 on sub-pages, verified via KB)
- **Spec Says**: The SDK defines `type AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification` and `type Stream = { writable: WritableStream<AnyMessage>; readable: ReadableStream<AnyMessage>; }`
- **Confirmed**: Yes
- **Notes**: The KB clearly documents the typed stream signature. Using `unknown` loses type safety and allows non-JSON-RPC messages to be written to the transport.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `export type Stream = { writable: WritableStream<unknown>; readable: ReadableStream<unknown>; };` at lines 21-24
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED
The Stream type uses `unknown` where the ACP SDK specifies `AnyMessage`. This prevents compile-time detection of malformed messages on the transport.

## Remediation Steps
1. Define `JsonRpcRequest`, `JsonRpcResponse`, and `JsonRpcNotification` as separate types (see also ISS-002)
2. Define `type AnyMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification`
3. Change `Stream` to `{ writable: WritableStream<AnyMessage>; readable: ReadableStream<AnyMessage>; }`
