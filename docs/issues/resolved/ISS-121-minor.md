# ISS-121 — All WRFC phases use `kind: 'other'` instead of semantically appropriate kinds

**Severity**: Minor
**File**: `src/extensions/wrfc/wrfc-event-bridge.ts`
**Lines**: 114, 137, 159
**KB Topic**: KB-06/KB-10: ToolCallKind

## Original Issue
All three WRFC phases (work, review, fix) use `kind: 'other'` when emitting tool calls. The ACP SDK `ToolKind` type provides semantically richer values: `'execute'`, `'think'`, `'edit'`, etc.

## Verification

### Source Code Check
The wrfc-event-bridge.ts state-changed handler emits tool calls for three states:
- `working` (line 114): `'other'`
- `reviewing` (line 137): `'other'`
- `fixing` (line 159): `'other'`

The `emitToolCall` method signature (tool-call-emitter.ts) accepts `kind: acp.ToolKind = 'other'`, confirming the SDK type is `ToolKind` (not `ToolCallKind` as KB-06 names it).

The SDK `ToolKind` (types.gen.d.ts line 3024) defines:
```typescript
type ToolKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "switch_mode" | "other";
```

### ACP Spec Check
KB-06 and KB-04 define different `ToolCallKind` enumerations, but the SDK is authoritative. The SDK's `ToolKind` includes `execute`, `think`, and `edit` which map naturally to WRFC phases:
- work -> `'execute'` (running commands/code)
- review -> `'think'` (internal reasoning)
- fix -> `'edit'` (modifying files/content)

Using `'other'` for all three loses semantic information that clients could use for icon/display selection.

### Verdict: CONFIRMED
All WRFC phase tool calls use `'other'` despite the SDK providing semantically appropriate `ToolKind` values. The mapping is straightforward and would improve client UI presentation.

## Remediation
1. Change line 114 from `'other'` to `'execute'` for the work phase.
2. Change line 137 from `'other'` to `'think'` for the review phase.
3. Change line 159 from `'other'` to `'edit'` for the fix phase.
4. If issue #123 is also addressed (adding `checking`), use `'think'` for the checking phase as well.
