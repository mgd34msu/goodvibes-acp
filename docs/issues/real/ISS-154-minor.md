# ISS-154: `getAnalyticsResponse` hard-codes `agentCount: 1`

**Source**: `src/plugins/analytics/engine.ts` line 289
**KB Reference**: KB-08 (Analytics Wire Format)
**Severity**: Minor

## Issue Description
`agentCount: 1` is a hard-coded literal, not derived from actual agent tracking data. Multi-sub-agent sessions will report incorrect agent counts.

### Verdict: CONFIRMED

Line 289 shows `agentCount: 1` as a literal value in the analytics response. The analytics engine tracks sessions and token usage but does not track agent counts. In multi-agent orchestration scenarios (sub-agents, parallel agent spawns), this value will be misleading.

## Remediation
1. Track actual agent count in the analytics store (increment on agent spawn events, e.g., `agent:spawned`)
2. Replace the hard-coded value: `agentCount: this._store.agentCount ?? 1`
3. If tracking is deferred, add a code comment documenting this as a known simplification: `// TODO: Track actual agent count; currently hard-coded`
