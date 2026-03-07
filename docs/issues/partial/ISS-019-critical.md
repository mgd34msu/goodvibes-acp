# ISS-019: IPC router dispatches on custom method field, not ACP method names

**Severity**: Critical
**File**: src/extensions/ipc/router.ts
**Line(s)**: 78
**Topic**: TypeScript SDK

## Issue Description
Router dispatches on custom `method` field, not ACP method names. Only handles `ping` and `status` built-ins — no ACP method routing.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/09-typescript-sdk.md (method definitions) and docs/acp-knowledgebase/03-sessions.md (session methods)
- **Spec Says**: ACP defines standard methods: `initialize`, `session/new`, `session/load`, `session/prompt`, `session/cancel`, `session/update`, `session/set_config_option`, `session/set_mode`, `session/request_permission`. These are the method names used in JSON-RPC `method` field.
- **Confirmed**: Yes
- **Notes**: The router only handles `ping` and `status` — neither of which are ACP methods. There is no routing for any ACP lifecycle method. However, ACP method routing is handled by `AgentSideConnection` from the SDK, not by this IPC router. The IPC router serves a different purpose (internal runtime IPC).

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `route()` at line 78 dispatches `request.method` against `this._handlers` map. `_registerBuiltIns()` (lines 105-121) registers only `ping` (echo payload) and `status` (runtime stats). No ACP methods are registered. The router uses `IpcRequest.method` which is part of the custom IPC protocol, not JSON-RPC.
- **Issue Confirmed**: Partial

## Verdict
PARTIAL
The router genuinely does not handle ACP methods, but this may be by design. ACP method routing is handled by the SDK's `AgentSideConnection` which delegates to the `Agent` interface implementation (`GoodVibesAgent`). The IPC router serves internal runtime communication (between daemon processes). The issue is real in that the IPC layer has no ACP integration, but claiming it should route ACP methods may be a misunderstanding of its architectural role. The severity should be Major rather than Critical.

## Remediation Steps
1. Document that the IPC router is for internal runtime communication, not ACP protocol handling
2. If IPC needs to proxy ACP requests (e.g., for a daemon architecture), add ACP method handlers that forward to the GoodVibesAgent
3. Consider registering session management methods (`session/new`, `session/prompt`, etc.) if the IPC layer is intended to be an ACP gateway
4. At minimum, register handlers for runtime-relevant ACP methods the daemon would need to serve
