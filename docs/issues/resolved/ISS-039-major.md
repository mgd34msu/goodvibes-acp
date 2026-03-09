# ISS-039: `_dispatch` casts params without runtime validation

**Severity**: Major
**Category**: KB-06 Tool Calls
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 259, 282-349

## Description

Tool params arriving via ACP tool calls are cast directly to typed interfaces without JSON schema validation. While tool definitions declare JSON Schema for their parameters, the `execute()` method never validates incoming params against those schemas.

### Verdict: CONFIRMED

Source shows `const p = params as Record<string, unknown>` at line 259, followed by casts like `const args = p as AnalyzeDepsParams` in each switch branch. Some basic required-field checks exist (e.g., `projectRoot` presence for certain tools), but these are manual string checks, not schema validation. Missing fields, wrong types, and extra fields are not caught. An attacker or buggy client sending malformed params would pass through to the analyzer methods unchecked.

## Remediation

1. Add a schema validation step in `execute()` before calling `_dispatch()`.
2. Use a lightweight JSON schema validator (e.g., `ajv`) to validate params against the tool's declared schema.
3. Return a structured error result for validation failures rather than letting type errors propagate.

## ACP Reference

KB-06: Tool implementations should validate incoming parameters against their declared schemas.
