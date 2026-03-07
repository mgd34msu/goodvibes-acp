# ISS-110 — PermissionResult Uses status:'granted'|'denied' Instead of ACP { granted: boolean }

**Severity**: Major
**File**: src/types/permissions.ts:60-64
**KB Topic**: Permissions

## Original Issue
`PermissionResult` uses `status: 'granted' | 'denied'` instead of spec `{ granted: boolean }`. *(Permissions)*

## Verification

### Source Code Check
`src/types/permissions.ts:29-63`:
```typescript
/** Result of a permission check — granted or denied. */
export type PermissionStatus = 'granted' | 'denied';

/** The outcome of a permission check. */
export type PermissionResult = {
  status: PermissionStatus;
  /** Optional explanation, present when denied */
  reason?: string;
};
```

The internal model uses `status: 'granted' | 'denied'` as a string discriminant. The ACP wire format uses `{ granted: boolean }`.

`src/extensions/acp/permission-gate.ts:116` — the `check()` method returns `Promise<PermissionResult>`, which uses the internal model. When the permission gate interacts with the ACP wire (receiving `{ granted: true|false }` from the client), it must translate between these models.

### ACP Spec Check
From `docs/acp-knowledgebase/05-permissions.md`, the wire format is unambiguous:

**Granted:**
```json
{ "jsonrpc": "2.0", "id": 42, "result": { "granted": true } }
```

**Denied:**
```json
{ "jsonrpc": "2.0", "id": 42, "result": { "granted": false } }
```

The TypeScript SDK method signature:
```typescript
AgentSideConnection.requestPermission() // returns Promise<{ granted: boolean }>
```

And the client implementation:
```typescript
async requestPermission(params: { sessionId: string; permission: Permission; }): Promise<{ granted: boolean }>
```

The spec consistently uses `{ granted: boolean }` — not a string status field.

### Verdict: CONFIRMED
The internal `PermissionResult` type uses `status: 'granted' | 'denied'` (a string union) instead of the ACP wire format `{ granted: boolean }`. This creates a mandatory translation layer that must be verified to be correct in `permission-gate.ts`. Any code that consumes `PermissionResult` and passes it to ACP must convert `status === 'granted'` → `granted: true`. If this translation is missing or incorrect anywhere, permission results will be serialized incorrectly on the ACP wire.

Additionally, using a non-isomorphic internal model adds unnecessary complexity and creates a divergence point that could introduce bugs as the code evolves.

## Remediation
1. Align `PermissionResult` with the ACP wire format:
   ```typescript
   export type PermissionResult = {
     granted: boolean;
     /** Optional explanation, present when denied */
     reason?: string;
   };
   ```
2. Update all call sites that check `result.status === 'granted'` to use `result.granted === true`.
3. Remove `PermissionStatus` type if no longer needed.
4. Verify `permission-gate.ts` correctly maps the ACP SDK's `{ granted: boolean }` response to the updated `PermissionResult` type.
