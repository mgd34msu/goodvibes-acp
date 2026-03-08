# ISS-134: `AgentTracker` status transitions allow invalid state machine paths

**Source**: `src/extensions/agents/tracker.ts` lines 82-121
**KB Reference**: KB-10 (Phase Transitions)
**Severity**: Major

### Verdict: CONFIRMED

The `updateStatus()` method accepts any `AgentStatus` value without validating whether the transition from the current status is valid. The code directly assigns `status` to the agent metadata without checking the `from` state.

This allows invalid transitions such as:
- `completed` -> `running` (restarting a finished agent)
- `spawned` -> `completed` (skipping `running` entirely)
- `failed` -> `spawned` (resurrecting a failed agent)

While `finishedAt` has a guard (`=== undefined`) preventing re-stamping, the status field itself has no transition validation. KB-10 specifies that phase transitions should be validated.

### Remediation

1. Define a valid transition map, e.g.:
   - `spawned` -> `running`, `cancelled`
   - `running` -> `completed`, `failed`, `cancelled`
   - `completed`, `failed`, `cancelled` -> (terminal, no transitions)
2. Add a guard at the top of `updateStatus()` that checks `VALID_TRANSITIONS[from].includes(status)` and throws or returns early on invalid transitions
3. Emit a warning event for attempted invalid transitions to aid debugging
