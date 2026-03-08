# ISS-086: Health endpoint hardcodes protocolVersion: 1 instead of using SDK constant

**Source**: `src/extensions/lifecycle/daemon.ts` line 71  
**KB Reference**: KB-02 (Protocol Version)  
**Severity**: Minor

## Description

The `/health` endpoint response includes `protocolVersion: 1` as a hardcoded literal instead of using the SDK's `PROTOCOL_VERSION` constant. If the protocol version is bumped in the SDK, this endpoint would report stale information.

## Evidence

`daemon.ts:71`:
```typescript
agent: { name: 'goodvibes', version: RUNTIME_VERSION, protocolVersion: 1 },
```

KB-10 shows the correct pattern:
```typescript
return { protocolVersion: acp.PROTOCOL_VERSION, agentCapabilities: {} };
```

KB-01 confirms: "Protocol version is a single integer" and the SDK exports `PROTOCOL_VERSION` for this purpose.

### Verdict: CONFIRMED

The health endpoint hardcodes the protocol version literal instead of referencing the SDK constant, creating a maintenance risk when the protocol version is bumped.

## Remediation

1. Import `PROTOCOL_VERSION` from `@agentclientprotocol/sdk` in `daemon.ts`.
2. Replace the hardcoded `1` with `PROTOCOL_VERSION`.
3. This ensures the health endpoint always reports the correct protocol version.
