# ISS-060: AuthOrchestrator is dead code with no ACP authenticate handler

**Severity**: Major
**File**: src/extensions/services/auth.ts
**Line(s)**: 1-187 (whole file)
**Topic**: Initialization

## Issue Description
`AuthOrchestrator` is exported but never imported outside its module. It handles outbound service auth (authenticating to external services), but no ACP inbound `authenticate` method handler exists for client-to-agent authentication.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/02-initialization.md (lines 230-282)
- **Spec Says**: If `authMethods` in the initialize response is non-empty, the Client MUST authenticate before creating sessions. The `authenticate` request has method `"authenticate"` with params `{ method, credentials }`. The agent must handle this request.
- **Confirmed**: Yes
- **Notes**: The ACP spec defines an `authenticate` request/response flow (lines 251-277). The implementation has `authMethods: []` in the initialize response (meaning no auth required), but the `AuthOrchestrator` class handles outbound auth to external services (e.g., API keys for third-party services) — not inbound ACP client authentication. These are two completely different concerns.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Grep for `AuthOrchestrator` and `services/auth` across all source files returns matches ONLY in `src/extensions/services/auth.ts` itself. Zero imports from any other file. The class is exported but never instantiated or used. Additionally, the class handles outbound service authentication (getting API keys/tokens for external services via `ServiceRegistry`), which is unrelated to ACP's inbound `authenticate` method.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. **Dead code**: Either integrate `AuthOrchestrator` into the runtime (register in service index, import from main.ts) or delete it
2. **Missing ACP auth handler**: If the agent ever needs to require client authentication, implement an `authenticate` method handler in the agent that validates credentials per the ACP spec
3. **Separate concerns**: Rename `AuthOrchestrator` to `ServiceAuthOrchestrator` to clarify it handles outbound service auth, not inbound ACP auth
4. If auth is truly not needed (standalone runtime), keep `authMethods: []` and document the decision
