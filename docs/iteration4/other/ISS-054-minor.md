# ISS-054: Config adapter mode names diverge from ACP convention

**Severity**: Minor
**Category**: KB-03 Sessions
**File**: `src/extensions/acp/config-adapter.ts`
**Lines**: 60-81

## Description

The issue claims ACP uses `ask`/`code` mode values and the implementation diverges by using `justvibes`/`vibecoding`/`sandbox`/`plan`.

### Verdict: NOT_ACP_ISSUE

The ACP SDK defines `SessionModeId = string` (types.gen.d.ts line 2379) — mode IDs are arbitrary strings with no mandated values. The SDK `SessionMode` type (lines 2361-2375) defines mode structure (id, name, description) but does not prescribe specific mode values like `ask` or `code`. Those are Claude Code-specific mode names, not ACP-mandated. GoodVibes is free to define its own mode vocabulary (`justvibes`, `vibecoding`, `sandbox`, `plan`) as product-specific values.

The config adapter correctly uses `SessionConfigOption` with `type: 'select'` and proper option metadata, which is ACP-compliant.

## ACP Reference

KB-03: Session modes use `SessionModeId = string`. No specific mode values are mandated by the protocol.
