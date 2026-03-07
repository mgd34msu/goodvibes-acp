# ISS-073: Config instance created but voided/unused — no event bus wiring

**Severity**: Major
**File**: src/main.ts
**Line(s)**: 72, 446
**Topic**: Implementation Guide

## Issue Description
Config instance created but voided/unused. No `config.onChange -> eventBus.emit` wiring exists. Config is inert. Wire it or remove.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, Section 4 (Session Management)
- **Spec Says**: Config changes should emit `config_options_update` session notifications. The implementation guide shows `setSessionConfigOption` delegating to session manager which should emit updates. The L1 Config object should feed into this pipeline.
- **Confirmed**: Yes
- **Notes**: The spec expects config changes to propagate to ACP clients via session notifications. An inert Config breaks this chain.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 72: `const config = new Config();` creates the instance. Line 446: `void config;` suppresses the unused variable warning. Between these two lines, `config` is never referenced — no `config.onChange`, no `config.get()`, no integration with eventBus or sessionManager.
- **Issue Confirmed**: Yes

## Verdict
CONFIRMED

## Remediation Steps
1. Wire `config.onChange` (or equivalent) to `eventBus.emit('config:changed', ...)` so config mutations propagate
2. Use `config` values to initialize `wrfcConfig` instead of hardcoding `minReviewScore: 9.5, maxAttempts: 3`
3. Remove `void config;` once the instance is actually used
4. Consider whether Config should also emit `config_options_update` ACP notifications when values change
