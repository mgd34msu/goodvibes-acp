# ISS-024: FrontendAnalyzer does not implement IToolProvider

**Severity**: Critical
**File**: src/plugins/frontend/analyzer.ts
**Line(s)**: 23-149 (entire class)
**Topic**: Extensibility

## Issue Description
`FrontendAnalyzer` does not implement `IToolProvider`. Unreachable via standard tool invocation.

## Verification

### ACP Spec Check
- **Spec Reference**: KB 08-extensibility.md
- **Spec Says**: ACP extension methods use `_`-prefixed method names. The spec does not define a specific `_goodvibes/frontend` extension method, but the extensibility mechanism exists for exactly this purpose. `IToolProvider` is an internal interface, not an ACP spec requirement.
- **Confirmed**: Partial
- **Notes**: The ACP spec does not mandate any specific tool interface. This is an internal architectural issue -- the class exists but has no path to be invoked via ACP. It's a valid code quality concern but not strictly an ACP conformance issue.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: `FrontendAnalyzer` has methods like `analyze()`, `checkAccessibility()`, `detectFramework()`, etc. No `name`, `tools`, or `execute()` properties. No extension method registration.
- **Issue Confirmed**: Yes (unreachable via ACP)

## Verdict
PARTIAL

## Remediation Steps
1. Implement `IToolProvider` interface on `FrontendAnalyzer` to expose it as tools, OR
2. Create a `_goodvibes/frontend` extension method handler, OR
3. Document that this class is intended for internal use only and not exposed via ACP
