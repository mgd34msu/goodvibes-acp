# ISS-090: buildConfigOptions default mode contradicts KB-10

**Source**: `src/extensions/acp/config-adapter.ts` line 39  
**KB Reference**: KB-10 (Config Defaults)  
**Severity**: Major

## Description

KB-10 specifies the default mode as `'vibecoding'` but the implementation defaults to `'justvibes'`. This changes the default user experience from auto-approving safe actions to requiring permission for every action.

## Evidence

Implementation (`config-adapter.ts:39`):
```typescript
export function buildConfigOptions(
  currentMode: GoodVibesMode = 'justvibes',
  currentModel: string = 'claude-sonnet-4-6',
): schema.SessionConfigOption[] {
```

KB-10 specifies:
```typescript
export function buildConfigOptions(
  currentMode: GoodVibesMode = 'vibecoding',
  currentModel = 'claude-sonnet-4-5',
): acp.ConfigOption[] {
```

KB-10 further confirms in the `newSession` example:
```typescript
configOptions: buildConfigOptions(),  // starts in vibecoding by default
```

### Verdict: CONFIRMED

The default mode `'justvibes'` directly contradicts KB-10's specification of `'vibecoding'` as the default. This is a behavioral deviation that affects the default user experience -- users get permission prompts for actions that should auto-approve in vibecoding mode.

## Remediation

1. Change the default value of `currentMode` from `'justvibes'` to `'vibecoding'` in `buildConfigOptions()`.
2. If there was a deliberate reason to default to `'justvibes'` (e.g., safety), document the rationale in a code comment and update KB-10 to match.
3. Also note the model default differs (`claude-sonnet-4-6` vs KB-10's `claude-sonnet-4-5`) -- verify which is correct and align.
