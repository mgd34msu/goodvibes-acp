# ISS-040: No permission gating for security-sensitive project tools

**Severity**: Major
**Category**: KB-05 Permissions
**File**: `src/plugins/project/analyzer.ts`
**Lines**: 239-256

## Description

Tools like `project_security_secrets`, `project_security_env`, `project_security_permissions`, and `project_code_surface` perform filesystem-wide reads and security scanning without requesting user permission via `session/request_permission`. These tools can scan entire project trees and reveal sensitive information.

### Verdict: CONFIRMED

Grep for `permission` and `request_permission` in `analyzer.ts` shows only the tool name `project_security_permissions` — no actual permission gating logic. The `execute()` method directly dispatches to analyzer methods without any permission check. Per KB-05, tools with side effects or security implications must gate on `session/request_permission`.

## Remediation

1. Inject a permission callback (e.g., `requestPermission: (toolName: string, params: unknown) => Promise<boolean>`) into `ProjectAnalyzer`.
2. Before executing security-sensitive tools, call the permission gate:
   ```typescript
   const securityTools = ['project_security_secrets', 'project_security_env', 'project_security_permissions', 'project_code_surface'];
   if (securityTools.includes(toolName)) {
     const granted = await this._requestPermission(toolName, params);
     if (!granted) return { success: false, error: 'Permission denied' };
   }
   ```
3. Wire the permission callback through the plugin registration to use the ACP `session/request_permission` flow.

## ACP Reference

KB-05: Tools with security implications must gate execution on user permission via `session/request_permission`.
