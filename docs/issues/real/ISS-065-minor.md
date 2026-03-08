# ISS-065 — `loadSession` Returns `null as any` Instead of Proper Response

**Severity**: Minor
**File**: src/extensions/acp/agent.ts:319
**KB Topic**: session/load response (01-overview.md line 142)

## Original Issue
The `loadSession` method returns `null as any` instead of a proper `LoadSessionResponse`.

## Verification

### Source Code Check
Line 94 of `src/extensions/acp/agent.ts` (within the `loadSession` method flow ending around line 319):
```typescript
    return null as any;
```

The method sends a `session/update` with `config_option_update` and then returns `null as any` instead of a structured response object.

### ACP Spec Check
KB-01 (line 141-142) shows the protocol flow:
```
Client → Agent: session/load (sessionId)  [if supported]
Agent → Client: session/new|load response (sessionId)
```

The `session/load` response should return a structured object (similar to `session/new` response) containing at minimum the `sessionId`. Returning `null` means the client receives no confirmation data and may fail when accessing expected response fields.

### Verdict: CONFIRMED
The code returns `null as any`, which is both a type safety violation (`as any` suppresses type checking) and a potential runtime issue. ACP clients expect a structured response from `session/load`.

## Remediation
1. Return a proper `LoadSessionResponse` object, e.g.:
```typescript
return {
  sessionId: params.sessionId,
  configOptions: buildConfigOptions(mode, model),
};
```
2. Remove the `as any` cast
3. Ensure the return type matches the SDK's expected `LoadSessionResponse` schema
