# ISS-165 — Hardcoded Version String Will Drift from package.json

**Severity**: Nitpick
**File**: src/extensions/acp/agent.ts:115
**KB Topic**: Initialization

## Original Issue
**[src/extensions/acp/agent.ts:115]** Hardcoded version string `'0.1.0'` will drift from `package.json`. Import version from `package.json` or a shared constants module. *(Initialization)*

## Verification

### Source Code Check
```typescript
agentInfo: {
  name: 'goodvibes',
  version: '0.1.0',
},
```
The version `'0.1.0'` is hardcoded at line 116. The `package.json` file exists at the project root. There is no import of version from package.json or a shared constants file.

### ACP Spec Check
The ACP initialization response requires `agentInfo.version` — a version string identifying the agent software. The spec does not mandate that this string match `package.json`. However, having the version drift from the actual package version would result in clients receiving an incorrect version identifier, which could affect compatibility decisions. The spec's intent is that `version` accurately represents the running agent version.

### Verdict: PARTIAL
The issue is real — the hardcoded version string will inevitably drift from `package.json` as the project evolves. This is a maintenance burden that indirectly affects ACP compliance: if a client uses the version for compatibility decisions or logging, an incorrect version is misleading. The issue is described accurately. However, it is nitpick-severity — the current value is not wrong per se, just fragile.

## Remediation
1. Import the version from `package.json`:
   ```typescript
   import { createRequire } from 'node:module';
   const require = createRequire(import.meta.url);
   const { version } = require('../../package.json') as { version: string };
   ```
   Or with TypeScript's `resolveJsonModule` option enabled:
   ```typescript
   import pkg from '../../package.json' with { type: 'json' };
   const { version } = pkg;
   ```
2. Use the imported `version` in the `agentInfo` object:
   ```typescript
   agentInfo: {
     name: 'goodvibes',
     version,
   },
   ```
