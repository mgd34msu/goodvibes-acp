# ISS-008 — sessionCapabilities Uses null Instead of false

**Severity**: Major
**File**: src/extensions/acp/agent.ts:215-218
**KB Topic**: Session Capabilities (01-overview.md lines 270-274; 02-initialization.md lines 192-198)

## Original Issue
`fork`, `list`, and `resume` are set to `null` instead of `false`. These fields are `boolean` optionals in the spec type.

## Verification

### Source Code Check
```typescript
// src/extensions/acp/agent.ts:214-218
sessionCapabilities: {
  fork: null,
  list: null,
  resume: null,
},
```
All three session capability fields are set to `null`.

### ACP Spec Check
KB-02 (02-initialization.md) lines 192-198:
```typescript
sessionCapabilities?: {
  fork?: boolean;
  list?: boolean;
  resume?: boolean;
};
```

KB-02 wire format example (lines 120-124):
```json
"sessionCapabilities": {
  "fork": false,
  "list": false,
  "resume": false
}
```

The fields are typed as `boolean | undefined`, not nullable. JSON `null` is not a valid boolean value. Typed clients performing strict validation will reject `null` where `boolean` is expected.

### Verdict: CONFIRMED
The spec types these fields as `boolean` (optional). Using `null` is a type violation that may cause runtime errors in typed clients. The wire format example explicitly uses `false`.

## Remediation
1. Change all three values from `null` to `false`:
   ```typescript
   sessionCapabilities: {
     fork: false,
     list: false,
     resume: false,
   },
   ```
2. Alternatively, omit the fields entirely (they are optional) — but `false` is more explicit.
