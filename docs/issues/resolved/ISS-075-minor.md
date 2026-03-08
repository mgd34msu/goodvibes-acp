# ISS-075 — Silent JSON parse error swallowing in MCP transport
**Severity**: Minor
**File**: `src/extensions/mcp/transport.ts`
**KB Topic**: KB-01: Error Handling

## Original Issue
Empty `catch {}` block silently ignores all parse failures on stdout lines. Repeated parse failures could indicate a misconfigured server.

## Verification

### Source Code Check
Lines 99-101 of `transport.ts`:
```typescript
} catch {
  // Ignore non-JSON lines (server stderr noise on stdout is unusual but safe to ignore)
}
```
The catch block has a comment explaining the rationale but performs no logging. All JSON parse errors are silently swallowed.

### ACP Spec Check
While there is no specific ACP spec requirement for logging parse errors, silent error swallowing is a general anti-pattern. MCP JSON-RPC communication relies on well-formed messages. Repeated parse failures could indicate:
- A misconfigured MCP server sending non-JSON output
- Encoding issues
- Protocol version mismatches

### Verdict: CONFIRMED
The empty catch block swallows all parse errors without any logging or metrics. While occasional non-JSON lines may be expected (e.g., server startup banners), persistent failures indicate real problems that should be visible for debugging.

## Remediation
1. Add a debug-level log for parse failures: `console.debug('[McpClient] ignoring non-JSON line:', trimmed.substring(0, 100))`.
2. Consider rate-limiting the log to avoid flooding on repeated failures.
