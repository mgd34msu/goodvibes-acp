# ISS-141 — Redundant `Message` type alias identical to `AnyMessage`

**Severity**: nitpick
**File**: `src/types/transport.ts`
**Line**: 137
**KB Reference**: KB-01 (Transport Types)

## Issue Description

The `Message` type alias on line 137 is defined as `RequestMessage | ResponseMessage | NotificationMessage`, which is identical to the `AnyMessage` type alias on line 18. Both coexist in the same file.

## Source Evidence

- Line 18: `export type AnyMessage = RequestMessage | ResponseMessage | NotificationMessage;`
- Line 137: `export type Message = RequestMessage | ResponseMessage | NotificationMessage;`

Both are exact duplicates. The ACP SDK favors `AnyMessage` as the canonical name.

### Verdict: CONFIRMED

The code contains two identical type aliases in the same file. `AnyMessage` is used by the `Stream` type (lines 29-30), while `Message` exists as a redundant duplicate.

## Remediation

1. Deprecate `Message` with a JSDoc `@deprecated` tag pointing to `AnyMessage`
2. Migrate all consumers from `Message` to `AnyMessage`
3. Remove `Message` in the next major version
