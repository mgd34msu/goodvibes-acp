# ACP Compliance Audit — Action Items

**Source**: `docs/acp-compliance-audit.md` (2026-03-10)
**Overall**: 117/121 requirements (96.7%)

Every non-compliant, partial, and gap item extracted below, grouped by severity.

---

## MAJOR (1)

### AI-1: Embedded resource content not processed in prompts

| Field | Value |
|-------|-------|
| Spec Section | Content (`content.mdx`) |
| Status | COMPLIANT with critical gap |
| Location | `src/extensions/acp/agent.ts:382-387` |
| Capability | `embeddedContext: true` advertised in initialize response (`agent.ts:221`) |

**Problem**: The prompt handler filters for `type: 'text'` blocks only. Embedded resource blocks (which contain file content inline) are silently ignored. The agent advertises `embeddedContext: true` but never processes the content.

**Fix Options**:
1. **Implement**: Parse embedded resource blocks in the prompt handler, extract their text content, and include it in the LLM context alongside text blocks.
2. **Honest capability**: Change `embeddedContext: true` → `embeddedContext: false` until processing is implemented.

**Recommendation**: Option 1 — implement the processing. The content is already delivered by the client; it just needs to be extracted and forwarded.

---

## MINOR (4)

### AI-2: `outputByteLimit` not forwarded to terminal/create

| Field | Value |
|-------|-------|
| Spec Section | Terminals (`terminals.mdx`) |
| Status | COMPLIANT with gap |
| Location | `src/extensions/acp/terminal-bridge.ts:86-92` |

**Problem**: The `terminal/create` spec accepts an `outputByteLimit` parameter. The implementation does not forward this optional parameter to the ACP client's `createTerminal()` call. Omission means the client uses its own default.

**Fix**: Add `outputByteLimit` to the `createTerminal()` call parameters. May also need to add it to the L0 `TerminalCreateOptions` type if not already present.

---

### AI-3: session/list not handled (even as error) if called despite null capability

| Field | Value |
|-------|-------|
| Spec Section | Session List (`session-list.mdx`) |
| Status | NON-COMPLIANT |
| Location | `src/extensions/acp/agent.ts` |

**Problem**: Capability is correctly declared `list: null`, so clients should not call `session/list`. However, no handler exists to return a proper JSON-RPC error if a client calls it anyway. The SDK may handle this implicitly, but explicit error handling is more robust.

**Fix**: Register a `listSessions()` handler that returns a `METHOD_NOT_FOUND` (-32601) or `INVALID_REQUEST` error explaining the capability is not supported.

---

### AI-4: Legacy `modes` field not populated in session/new response

| Field | Value |
|-------|-------|
| Spec Section | Session Modes (`session-modes.mdx`) |
| Status | COMPLIANT with gap |
| Location | `src/extensions/acp/agent.ts:266-270` |

**Problem**: The spec's transition guidance says agents SHOULD send both `configOptions` and the legacy `modes` field during the transition period. Only `configOptions` (with `category: 'mode'`) is sent. The spec explicitly states config options supersede modes and modes will be removed, so this is forward-compatible but not backwards-compatible.

**Fix**: Add a `modes` field to the `newSession()` and `loadSession()` response objects containing the legacy `SessionModeState` shape: `{ currentModeId, availableModes: [...] }`.

---

### AI-5: `SessionModeState` legacy shape not emitted

| Field | Value |
|-------|-------|
| Spec Section | Session Modes (`session-modes.mdx`) |
| Status | PARTIAL |
| Location | Config options used instead of legacy `modes` field |

**Problem**: Legacy clients expecting `modes.currentModeId` and `modes.availableModes` in the `session/new` response will not find them. Modes are surfaced exclusively through `configOptions` with `category: 'mode'`.

**Fix**: Same as AI-4 — populate the legacy `modes` field alongside `configOptions`. This is a single change that resolves both AI-4 and AI-5.

---

## INFORMATIONAL (2)

### AI-6: Cursor-based pagination not implemented for session/list

| Field | Value |
|-------|-------|
| Spec Section | Session List (`session-list.mdx`) |
| Status | NON-COMPLIANT (N/A — feature unsupported) |
| Location | N/A |

**Context**: The spec defines cursor-based pagination tokens for `session/list`. Since the capability is declared `null`, this is not applicable. If `session/list` is ever implemented, pagination must be included.

**Action**: No action needed unless session list capability is added in the future.

---

### AI-7: SessionInfo fields partially implemented

| Field | Value |
|-------|-------|
| Spec Section | Session List (`session-list.mdx`) |
| Status | PARTIAL |
| Location | `session_info_update` notifications |

**Context**: `session_info_update` notifications include `title` and `updatedAt`, but the full `SessionInfo` structure (which includes `sessionId`, `cwd` as required fields) is not fully implemented since list is unsupported. The notifications sent during session lifecycle do work correctly.

**Action**: No action needed unless session list capability is added. If implemented, ensure `SessionInfo` includes all required fields (`sessionId`, `cwd`) plus optional fields (`title`, `updatedAt`).

---

## Summary Table

| ID | Severity | Finding | Actionable? | Effort |
|----|----------|---------|-------------|--------|
| AI-1 | **MAJOR** | Embedded resource content ignored in prompts | Yes | Medium — parse + forward content blocks |
| AI-2 | minor | `outputByteLimit` not forwarded | Yes | Small — add parameter passthrough |
| AI-3 | minor | No error handler for unsupported `session/list` | Yes | Small — add rejection handler |
| AI-4 | minor | Legacy `modes` not in session response | Yes | Small — add field to response |
| AI-5 | minor | `SessionModeState` not in legacy format | Yes | Small — same fix as AI-4 |
| AI-6 | info | Pagination not implemented | No | N/A until list is supported |
| AI-7 | info | SessionInfo fields incomplete | No | N/A until list is supported |

**Actionable items**: 5 (AI-1 through AI-5)
**Deferred items**: 2 (AI-6, AI-7 — contingent on future session list support)
**Combined fixes**: AI-4 and AI-5 are the same change, so **4 distinct fixes** needed.
