# ISS-083 — Hardcoded protocolVersion in health endpoint

**Severity**: Minor
**File**: `src/extensions/lifecycle/daemon.ts`
**Lines**: 71
**KB Reference**: KB-02 (Initialization)

## Issue

The daemon health endpoint hardcodes `protocolVersion: 1`:

```typescript
agent: { name: 'goodvibes', version: RUNTIME_VERSION, protocolVersion: 1 },
```

The codebase already defines `ACP_PROTOCOL_VERSION` as a constant in `src/types/constants.ts` (line 39), and the ACP agent module imports `PROTOCOL_VERSION` from the SDK. The health endpoint should use the constant rather than a magic number.

### Verdict: CONFIRMED

The hardcoded value `1` is correct today (KB-02 confirms protocol version is integer 1), but using the constant ensures the health endpoint stays in sync if the protocol version changes. The constant exists and is not used here.

## Remediation

1. Import `ACP_PROTOCOL_VERSION` from `src/types/constants.ts` in `daemon.ts`.
2. Replace the hardcoded `1` with the constant:
   ```typescript
   agent: { name: 'goodvibes', version: RUNTIME_VERSION, protocolVersion: ACP_PROTOCOL_VERSION },
   ```
