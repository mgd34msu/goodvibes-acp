# ISS-055: _goodvibes/status implemented as request handler instead of notification

**Severity**: Major
**File**: src/extensions/acp/extensions.ts
**Line(s)**: 54-56
**Topic**: Extensibility

## Issue Description
`_goodvibes/status` is implemented as a request handler (in the `handle()` switch statement) but the spec defines it as a notification (agent -> client, fire-and-forget). It should be refactored to proactive push via `conn.extNotification()`.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/08-extensibility.md (line 193)
- **Spec Says**: `_goodvibes/status` is type `notification`, direction `agent -> client`, purpose: "WRFC phase progress, step counts". Notifications have no `id` field and expect no response.
- **Confirmed**: Yes
- **Notes**: The KB wire format example at lines 127-138 shows `_goodvibes/status` as a notification (no `id` field). The TypeScript interface at lines 247-258 defines `GoodVibesStatusNotification` with session/phase/step fields.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `extensions.ts:55` handles `_goodvibes/status` in the `handle()` method's switch statement, which is called by `extMethod()` (request handler, expects a response). The `_status()` method at line 75 returns a response object. This is backwards — status should be pushed by the agent, not pulled by the client.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Remove `_goodvibes/status` from the `handle()` switch statement (it's not a request)
2. Create a `pushStatus()` method that formats the `GoodVibesStatusNotification` payload
3. Wire `pushStatus()` to EventBus WRFC phase-change events
4. Call `conn.extNotification('_goodvibes/status', payload)` to push to client
5. Keep `_status()` private method for internal use if needed, but don't expose via extMethod
