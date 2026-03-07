# ISS-140 — No System Prompt Enrichment with Task Context

**Severity**: Minor
**File**: src/plugins/agents/loop.ts
**KB Topic**: Implementation Guide

## Original Issue
No system prompt enrichment with task context (cwd, workspace roots, available tools).

## Verification

### Source Code Check
In `src/plugins/agents/loop.ts`, the `AgentLoopConfig` interface (lines 31-46) includes a `systemPrompt: string` field that is passed directly to the LLM. Looking at `run()` starting at line 80, the system prompt is used as-is:
```typescript
const params: ChatParams = {
  model: this.config.model,
  systemPrompt: this.config.systemPrompt,
  messages,
  tools: toolDefs.length > 0 ? toolDefs : undefined,
  signal: this.config.signal,
};
```
There is no enrichment step that injects dynamic context (current working directory, workspace roots, list of available tool names) into the system prompt at runtime. The `AgentLoopConfig` has no `cwd` or `workspaceRoots` fields. The system prompt is entirely static — set once at config construction time.

### ACP Spec Check
The ACP implementation guide (KB `10-implementation-guide.md`) recommends that agents be initialized with workspace context. `NewSessionRequest` carries optional `workspaceRoots?: string[]`. Agents should use this to inform the LLM of the working directory and available workspace. The absence of this context injection means the LLM operates without knowing where files are, what tools are available, or what the workspace structure is — reducing agent effectiveness.

This is a best-practice recommendation from the implementation guide, not a strict wire-format compliance requirement.

### Verdict: PARTIAL
The issue is real — `AgentLoop.run()` uses a static `systemPrompt` with no dynamic injection of `cwd`, workspace roots, or tool names. This is a meaningful gap relative to the implementation guide's recommendations. However, the system prompt *could* be pre-enriched by the caller (e.g., `AgentSpawnerPlugin`) before constructing `AgentLoopConfig`. The issue is PARTIAL because the gap may exist at the spawner level rather than the loop level, but neither layer currently performs this enrichment based on the visible code.

## Remediation
1. Add optional context fields to `AgentLoopConfig`:
```typescript
export interface AgentLoopConfig {
  // ... existing fields ...
  cwd?: string;
  workspaceRoots?: string[];
}
```
2. In `run()`, build a context preamble and prepend it to the system prompt:
```typescript
const contextLines: string[] = [];
if (this.config.cwd) contextLines.push(`Working directory: ${this.config.cwd}`);
if (this.config.workspaceRoots?.length) {
  contextLines.push(`Workspace roots: ${this.config.workspaceRoots.join(', ')}`);
}
if (toolDefs.length > 0) {
  contextLines.push(`Available tools: ${toolDefs.map(t => t.name).join(', ')}`);
}
const enrichedSystemPrompt = contextLines.length > 0
  ? `${contextLines.join('\n')}\n\n${this.config.systemPrompt}`
  : this.config.systemPrompt;
```
3. Pass `enrichedSystemPrompt` instead of `this.config.systemPrompt` to `ChatParams`.
4. Propagate `workspaceRoots` from `NewSessionRequest` through `AgentSpawnerPlugin` into `AgentLoopConfig`.
