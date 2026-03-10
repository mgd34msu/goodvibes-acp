# ISS-051: Missing sessionUpdate discriminator in hook tool_call_update

**Severity**: Minor
**Category**: KB-06 Tool Calls
**File**: `src/extensions/hooks/registrar.ts`
**Lines**: 202

## Description

The `tool:execute` post-hook emits a `tool:call:update` event on the internal EventBus without the `sessionUpdate: 'tool_call_update'` discriminator field required by the ACP `SessionUpdate` discriminated union.

### Verdict: PARTIAL

The event emitted at line 202 is an **internal EventBus event** (`tool:call:update`), not a direct ACP wire message. The ACP SDK `SessionUpdate` type (line 2521 in types.gen.d.ts) requires `sessionUpdate: "tool_call_update"` as a discriminator on `ToolCallUpdate`. However, the internal bus event is consumed by the session adapter layer which should add the discriminator when serializing to wire format. The issue is valid in that the internal event shape does not include the discriminator, meaning any consumer that forwards this to the wire must remember to add it — a fragile pattern.

## Remediation

1. Add `sessionUpdate: 'tool_call_update'` to the emitted event payload so it is wire-ready.
2. This ensures any code path that forwards bus events to ACP clients does not need to inject the discriminator.

## ACP Reference

KB-06: ToolCallUpdate must include `sessionUpdate: 'tool_call_update'` discriminator per the SessionUpdate union type in the ACP SDK.
