# ISS-022: Post-hook fires indiscriminately after permission denial

**Source**: `src/extensions/hooks/registrar.ts` (lines 184-201)
**KB Reference**: KB-05: Permissions
**Severity**: Medium

### Verdict: PARTIAL

**Finding**: The `tool:execute` post-hook always fires, including when permission was denied. KB-05 states: "If `granted: false`, the agent MUST NOT execute the action."

However, examining the actual code, the post-hook does check `meta._permissionDenied` and emits `status: 'failed'` with a reason when permission was denied. It distinguishes between "tool completed" and "tool blocked" — just not by skipping the post-hook entirely, but by varying the emitted status.

The issue overstates the problem. The post-hook is not executing the tool; it is reporting the outcome. Emitting a `tool:call:update` with `status: 'failed'` after permission denial is actually correct per KB-05 step 5b: "Denied -> Agent reports tool_call_update (status: 'failed'), reason: permission denied."

The concern about "potentially undefined result" is valid but minor — `result ?? null` handles it.

### Remediation

1. Optionally separate the post-hook into two paths for clarity: one for completed tools, one for denied tools
2. No functional change is strictly required — the current behavior matches the ACP spec's expected flow for denied permissions
