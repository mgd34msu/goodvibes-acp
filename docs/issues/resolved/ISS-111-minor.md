# ISS-111 — Mode Naming Doesn't Align With ACP Spec Examples

**Severity**: Minor
**File**: src/extensions/acp/permission-gate.ts:30-51
**KB Topic**: Permissions

## Original Issue

**[src/extensions/acp/permission-gate.ts:30-51]** Mode naming doesn't align with spec. Spec references "ask mode", "code mode", "yolo/auto mode". Implementation uses `'justvibes'`, `'vibecoding'`, `'plan'`, `'sandbox'`. Add documentation mapping each mode to its spec equivalent. *(Permissions)*

## Verification

### Source Code Check

`permission-gate.ts` lines 30-51 define `MODE_POLICIES`:

```typescript
export const MODE_POLICIES: Record<string, PermissionPolicy> = {
  justvibes: { autoApprove: ['tool_call', 'file_read', 'file_write', 'command_execute', 'network_access'], alwaysDeny: [], promptForUnknown: false },
  vibecoding: { autoApprove: ['tool_call', 'file_read', 'file_write', 'command_execute'], alwaysDeny: [], promptForUnknown: true },
  plan:       { autoApprove: ['file_read'], alwaysDeny: ['command_execute'], promptForUnknown: true },
  sandbox:    { autoApprove: ['tool_call', 'file_read'], alwaysDeny: ['network_access'], promptForUnknown: true },
};
```

The four GoodVibes mode names (`justvibes`, `vibecoding`, `plan`, `sandbox`) do not match the spec's illustrative examples (`ask`, `code`, `yolo/auto`).

### ACP Spec Check

KB `05-permissions.md` under "Mode-Based Auto-Approval":

> ACP itself has no built-in auto-approval mechanism — that's agent/client implementation. In practice:
> - **ask mode** (default): Agent calls `session/request_permission` for every gated action
> - **code mode** (trust mode): Agent may skip for safe file operations
> - **yolo/auto mode**: Agent may skip entirely
>
> The mode is exposed as a `configOption` with `category: "mode"`. The agent interprets the mode value and decides whether to call `session/request_permission`.

The spec says mode names are agent-defined — it explicitly gives `ask`, `code`, `yolo/auto` as examples from reference implementations, not as mandated values. The wire format transmits whatever string the agent defines as its mode ID.

### Verdict: PARTIAL

The issue has merit as a documentation gap but is overstated as an ACP compliance violation. ACP does not mandate specific mode name strings; mode IDs are agent-defined values transmitted via `configOptions`. The spec examples (`ask`, `code`, `yolo/auto`) are illustrative, not normative. GoodVibes mode names are perfectly valid.

However, the issue is real in a narrower sense: if clients or documentation reference ACP "standard" mode names and expect them to map to GoodVibes modes, the mismatch creates confusion. A mapping comment or documentation alias is warranted.

Additionally, ISS-12 (confirmed Critical) shows `PermissionType` values are already misaligned with spec. The mode policies in this file use the non-spec permission types (`tool_call`, `file_read`, `command_execute`, `network_access`) which are themselves wrong — but that is ISS-12's concern, not this issue.

## Remediation

1. Add a JSDoc comment above `MODE_POLICIES` mapping each GoodVibes mode to its closest ACP conceptual equivalent:
   - `justvibes` → yolo/auto mode (no permission gates)
   - `vibecoding` → code mode (auto-approve low-risk, prompt for network)
   - `plan` → ask mode (prompt for most actions)
   - `sandbox` → custom restricted mode
2. Update `config-adapter.ts` to expose mode IDs via `configOptions` so the ACP client can display them meaningfully.
3. Optionally add display names alongside the IDs (e.g., `name: 'JustVibes (Auto-approve all)'`).
4. No wire-format change required — mode IDs are agent-defined.
