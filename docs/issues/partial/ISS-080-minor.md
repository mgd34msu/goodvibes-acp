# ISS-080: Tool calls executed sequentially despite "parallel order" comment

**Severity**: Minor
**File**: src/plugins/agents/loop.ts
**Line(s)**: 175-237
**Topic**: Implementation Guide

## Issue Description
Tool calls executed sequentially despite comment saying "parallel order". Use `Promise.all` for independent calls.

## Verification

### ACP Spec Check
- **Spec Reference**: docs/acp-knowledgebase/10-implementation-guide.md, docs/acp-knowledgebase/01-overview.md (Tool Call Updates)
- **Spec Says**: The ACP spec does not mandate parallel vs sequential tool execution. Tool calls are announced individually via `tool_call` updates and completed individually via `tool_call_update`. The execution order is an implementation choice.
- **Confirmed**: Partial (not an ACP conformance issue, but a code quality/performance issue)
- **Notes**: The misleading comment is the primary problem. Sequential execution is actually safer (avoids race conditions on shared state like file writes). The comment creates false expectations.

### Source Code Check
- **Code Exists**: Yes
- **Code Shows**: Line 173: Comment reads `/** Execute all tool_use blocks in parallel order, return tool_result blocks */`. Lines 183-230: Uses `for (const block of toolUseBlocks)` with `await provider.execute(toolName, block.input)` inside the loop — this is strictly sequential execution, not parallel. Each tool call completes before the next begins.
- **Issue Confirmed**: Yes

## Verdict
PARTIAL

## Remediation Steps
1. **Option A (fix comment)**: Change the JSDoc to `/** Execute all tool_use blocks sequentially, return tool_result blocks */` — sequential is actually safer for file-modifying tools
2. **Option B (make parallel)**: Use `Promise.all(toolUseBlocks.map(async (block) => { ... }))` for truly parallel execution, but only for read-only tools
3. **Option C (selective parallelism)**: Classify tools by `kind` ('read' vs 'write') and parallelize read-only tools while serializing write tools
4. At minimum, fix the misleading comment regardless of execution strategy chosen
