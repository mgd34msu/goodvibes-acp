# Wave 1 Agent 1: Types & Transport Layer

## ACP Compliance Score: 8.2/10

## Issues Found: 7

---

### Issue 1

**Severity**: Major
**File**: `src/types/config.ts`
**Line**: 105
**KB Topic**: Session Config Options (KB-01 lines 297-305)
**Description**: `SessionConfigOption.currentValue` is typed as `string` but the ACP spec defines it as `string | boolean`. Boolean-type config options (e.g., `type: 'boolean'`) cannot represent their current value correctly.
**ACP Requirement**: KB-01 line 302 specifies `currentValue: string | boolean` in the `ConfigOption` interface. The `type` field supports `'boolean'` (line 301), requiring boolean values.
**Suggested Fix**: Change line 105 from `currentValue: string;` to `currentValue: string | boolean;`

---

### Issue 2

**Severity**: Major
**File**: `src/types/events.ts`
**Line**: 272
**KB Topic**: Session Update Types (KB-01 lines 202-215, KB-09 lines 915-924)
**Description**: The `AcpSessionUpdateType` union includes `'config_options_update'` but the ACP spec uses `'config_option'` (singular, no `_update` suffix). This mismatch would cause ACP clients to ignore config option updates because they do not recognize the discriminator value.
**ACP Requirement**: KB-01 line 214 defines the update type as `config_option`. KB-09 line 923 confirms `"config_option"` is the wire value.
**Suggested Fix**: Change `'config_options_update'` to `'config_option'` on line 272.

---

### Issue 3

**Severity**: Major
**File**: `src/types/index.ts`
**Line**: 30 (end of file)
**KB Topic**: Module Completeness (KB-09 Schema Exports)
**Description**: The barrel export file does not re-export `review-scoring.ts`. Any consumer importing from `@l0/index` will not have access to `REVIEW_DIMENSIONS`, `computeWeightedScore`, `ReviewDimensionConfig`, `IssueSeverity`, or `ReviewIssue`. This is the only type module in `src/types/` excluded from the barrel.
**ACP Requirement**: The barrel file's own documentation (lines 5-6) states it "Re-exports all L0 type definitions." Omitting `review-scoring` violates its own contract.
**Suggested Fix**: Add `export * from './review-scoring';` to `src/types/index.ts`.

---

### Issue 4

**Severity**: Minor
**File**: `src/types/constants.ts`
**Line**: 39
**KB Topic**: Protocol Version Format (KB-01 line 3, KB-09 lines 602-606)
**Description**: `ACP_PROTOCOL_VERSION` is defined as the integer `1`, which matches KB-01's statement that "Protocol Version: 1 (MAJOR, integer only)." However, the ACP SDK's `PROTOCOL_VERSION` constant is the string `"0.15"` (KB-09 line 605). The codebase uses `ACP_PROTOCOL_VERSION` (integer 1) in places where the SDK expects a string. This dual representation could cause wire-format mismatches if the integer constant is used directly in `initialize` responses instead of the SDK's string constant.
**ACP Requirement**: KB-09 line 605: `PROTOCOL_VERSION` current value is `"0.15"`. The SDK `InitializeResponse` expects `protocolVersion: string` (KB-09 line 300).
**Suggested Fix**: Either (a) change `ACP_PROTOCOL_VERSION` to the string `'0.15'` to match the SDK wire format, or (b) add a separate `ACP_SDK_PROTOCOL_VERSION = '0.15'` constant and document that the integer constant is the spec-level version while the string constant is the SDK wire version.

---

### Issue 5

**Severity**: Minor
**File**: `src/types/review-scoring.ts`
**Line**: 62
**KB Topic**: L0 Layer Purity (module header, line 3)
**Description**: The module header declares `@layer L0 -- pure types, no runtime code, no imports` but `computeWeightedScore` on line 62 is a runtime function, not a pure type. While the function is side-effect free, it violates the L0 contract that the module itself declares. The `REVIEW_DIMENSIONS` array constant on line 39 is borderline (it emits runtime code but has zero side effects, similar to the enum exception documented in `constants.ts`).
**ACP Requirement**: The project's own L0 contract states "pure types, no runtime code." Constants are explicitly exempted per `constants.ts` line 7-9, but executable functions are not.
**Suggested Fix**: Move `computeWeightedScore` to an L1 or L2 utility module. Keep the types and the `REVIEW_DIMENSIONS` constant in L0.

---

### Issue 6

**Severity**: Minor
**File**: `src/types/events.ts`
**Line**: 263
**KB Topic**: Session Update Discriminator (KB-01 lines 202-215, KB-09 lines 119-135)
**Description**: The `AcpSessionUpdateType` union is named to suggest it represents wire-protocol values, but the code comment on line 261 says it uses the `sessionUpdate` discriminator field. Meanwhile, the KB-01 overview (line 202) describes the updates using a `type` field (`update.type`), while KB-09 (lines 119-135) shows `sessionUpdate` as the discriminator. This naming inconsistency in the KB itself is correctly resolved in the codebase (using `sessionUpdate`), but the `AcpSessionUpdateType` union is missing `'session_info'` which is listed in KB-01 line 211.
**ACP Requirement**: KB-01 line 211 lists `session_info` as a valid session update type.
**Suggested Fix**: Add `'session_info'` to the `AcpSessionUpdateType` union if it is not already present. (Verified: it is not in the union on lines 263-273.)

---

### Issue 7

**Severity**: Nitpick
**File**: `src/types/transport.ts`
**Line**: 137
**KB Topic**: Transport Type Definitions (KB-01 lines 37-63)
**Description**: The `Message` type alias on line 137 is identical to `AnyMessage` on line 18 (`RequestMessage | ResponseMessage | NotificationMessage`). Having two names for the same type creates ambiguity about which to use. The ACP SDK uses `AnyMessage` (KB-01 line 48), making `Message` a redundant alias.
**ACP Requirement**: The ACP SDK defines `AnyMessage` as the canonical type name (KB-01 line 48, KB-09 line 524).
**Suggested Fix**: Remove the `Message` type alias on line 137 or deprecate it in favor of `AnyMessage`. Ensure all internal consumers use `AnyMessage`.

---

## Summary

The types and transport layer demonstrate solid ACP compliance overall. The `Stream`, `AnyMessage`, and JSON-RPC message types correctly model the ACP wire protocol. The transport factory correctly uses `acp.ndJsonStream` with the proper argument order (output, input). The `_meta` extensibility field is properly modeled in `Event<T>` with the correct W3C Trace Context reserved keys.

The three major issues (config option boolean support, incorrect session update discriminator value, missing barrel export) should be fixed before merge as they would cause wire-protocol incompatibilities or missing functionality. The protocol version ambiguity and L0 layer violation are lower priority but should be addressed in a follow-up.
