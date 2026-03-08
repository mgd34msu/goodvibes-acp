# ISS-162 — `StateMachine.restore()` does not validate `data.current` against config states

**Severity**: Nitpick  
**File**: `src/core/state-machine.ts`  
**Lines**: 370-378  
**KB Reference**: KB-02 (State Validation) — no corresponding KB file exists

## Description

The `StateMachine.restore()` static method accepts serialized state data and directly assigns `machine._current = data.current` without verifying that `data.current` is a valid key in `config.states`. If serialized data contains a state name that was removed from the config (e.g., after a code update), the machine enters an invalid state with no defined transitions.

### Verdict: PARTIAL

The code defect is confirmed. The `restore()` method at lines 370-378 performs no validation:

```typescript
static restore<TState extends string, TContext>(
  config: StateMachineConfig<TState, TContext>,
  data: SerializedStateMachine<TState, TContext>
): StateMachine<TState, TContext> {
  const machine = new StateMachine(config);
  machine._current = data.current;      // No validation
  machine._context = data.context;
  machine._history.push(...data.history);
  return machine;
}
```

The `config.states` field (`Partial<Record<TState, StateConfig<TContext>>>`) provides the valid state set, but it is never checked. This is a real defensive programming bug — restoring stale serialized data after a config change silently produces an invalid machine.

However, the verdict is PARTIAL rather than CONFIRMED because: (1) the referenced "KB-02: State Validation" has no corresponding ACP knowledgebase document, and (2) while the ACP spec's cross-reference pattern (Appendix) identifies this as part of a "Schema Version Validation Missing on `restore()`" pattern, the spec does not explicitly mandate state validation on restore for internal state machines. The issue is real but only tangentially ACP-related.

## Remediation

1. Validate `data.current` against `Object.keys(config.states)` before assignment:
   ```typescript
   const validStates = Object.keys(config.states) as TState[];
   if (!validStates.includes(data.current)) {
     throw new Error(
       `Cannot restore: state "${data.current}" not found in config. Valid states: ${validStates.join(', ')}`
     );
   }
   ```
2. Optionally validate that `data.history` entries reference valid states as well.
3. Consider adding a `$schema` or version field to `SerializedStateMachine` to detect stale data before attempting restore.
