# ACP Compliance Review Process

Repeatable process for reviewing the GoodVibes ACP codebase against the Agent Client Protocol specification. This document assumes the ACP knowledgebase files already exist at `docs/acp-knowledgebase/` (01-overview through 10-implementation-guide).

## Prerequisites

- ACP knowledgebase files at `docs/acp-knowledgebase/*.md`
- `agents.max_concurrent` set to 10 via runtime config
- ACP spec website (agentclientprotocol.com) uses client-side rendering — sub-pages return 404. Agents must use `https://agentclientprotocol.com/llms-full.txt` or local KB files as authoritative references.

---

## Phase 1: Review Wave 1 — Infrastructure & Transport (10 agents)

Launch 10 parallel review agents. Each agent is assigned one KB topic and the corresponding source files. Agents cross-reference source code against their KB topic and report issues.

**Agent assignments should cover:**
- Types & transport layer
- ACP agent & bridge
- Sessions
- Permissions
- Hooks
- MCP bridge
- Filesystem & terminal bridge
- IPC
- Lifecycle & daemon
- Config & initialization

**Agent instructions:**
- Max 10 issues per agent
- Each issue must reference a specific file and line number
- Each issue must cite the KB topic it violates
- Rate severity: Critical, Major, Minor, Nitpick

**Output:** Write all issues to `docs/issues-wave1.md`

---

## Phase 2: Review Wave 2 — Domain Logic (10 agents)

Launch 10 more parallel review agents covering core modules, extensions, and plugins.

**Agent assignments should cover:**
- Event bus & registry
- Config & state machine
- Trigger engine
- Agent coordination & spawning
- Services & health
- Analytics & budget tracking
- WRFC orchestration
- Project plugins (deps, security, test, coverage)
- Session management internals
- Shutdown & lifecycle hooks

**Same instructions as Phase 1.**

**Output:** Write all issues to `docs/issues-wave2.md`

---

## Phase 3: Consolidation & Deduplication

Combine both wave files into a single `docs/issues-phase1.md`.

**Requirements:**
- Deduplicate overlapping findings across waves
- Sort by severity: Critical → Major → Minor → Nitpick
- Group by affected file/area within each severity level
- Include KB topic in parentheses after each issue
- Number issues sequentially (1, 2, 3...)
- Do NOT include wave labels (W1/W2) — origin wave is irrelevant
- Add a cross-reference appendix grouping recurring patterns (e.g., issues that appear across multiple files like "Direct FS Instead of ITextFileAccess")

**Lesson learned:** Users care about severity and affected file, not which wave found the issue. The KB topic is useful context but should not drive the sort order.

---

## Phase 4: Verification (multiple waves of 10 agents)

Verify every issue against the actual ACP spec and source code. This step catches hallucinations and misattributions.

**Structure:**
- 10 issues per agent maximum
- As many waves as needed to cover all issues
- Prioritize Critical + Major issues in earlier waves

**Each agent must:**
1. Read the issue from `docs/issues-phase1.md`
2. Read the referenced source file to verify the code actually has the described problem
3. Fetch ACP spec from `https://agentclientprotocol.com/llms-full.txt` (fetch ONCE per agent, reuse for all issues). Also reference local KB files at `docs/acp-knowledgebase/`
4. Assign a verdict:
   - **CONFIRMED** — Issue is real, code has the problem, and it's a genuine ACP compliance issue
   - **PARTIAL** — Issue has some merit but is overstated, imprecise, or loosely connected to ACP
   - **HALLUCINATION** — Issue is fabricated, the code is actually correct, or the spec doesn't say what was claimed
   - **NOT_ACP_ISSUE** — The issue is a real code quality problem but has nothing to do with ACP protocol compliance
5. Write remediation steps for CONFIRMED and PARTIAL issues
6. Write results to individual files: `docs/issues/ISS-{NNN}-{severity}.md`

**Output file format:**
```markdown
# ISS-{NNN} — {Brief Title}

**Severity**: {Critical|Major|Minor|Nitpick}
**File**: {source file path}
**KB Topic**: {topic from parentheses}

## Original Issue
{Copy the issue text}

## Verification

### Source Code Check
{What the code actually does — quote relevant lines}

### ACP Spec Check
{What the spec actually says about this}

### Verdict: {CONFIRMED|PARTIAL|HALLUCINATION|NOT_ACP_ISSUE}
{Explanation of verdict}

## Remediation
{Steps to fix, or "N/A" if HALLUCINATION/NOT_ACP_ISSUE}
```

**Important:** Use `### Verdict:` format (H3 with colon) consistently across all agents. The first iteration had inconsistent formatting between waves which complicated automated sorting.

---

## Phase 5: Sort & Organize

Sort verified issue files into directories by verdict:

```
docs/issues/
├── real/      # CONFIRMED issues — actionable ACP compliance fixes
├── partial/   # PARTIAL issues — real but loosely ACP-related
└── other/     # NOT_ACP_ISSUE — code quality, not protocol compliance
```

- Delete HALLUCINATION files — they have no value
- Use grep on each file's verdict line to automate sorting:
  ```bash
  cd docs/issues
  for f in ISS-*.md; do
    if grep -q '^CONFIRMED$' "$f" || grep -q '### Verdict: CONFIRMED' "$f"; then
      mv "$f" real/
    elif grep -q '^PARTIAL$' "$f" || grep -q '### Verdict: PARTIAL' "$f"; then
      mv "$f" partial/
    else
      mv "$f" other/
    fi
  done
  ```

---

## Phase 6: Tally & Report

Count files per directory and produce a summary. Expected distribution from first iteration:

| Verdict | Count | % | Notes |
|---------|-------|---|-------|
| CONFIRMED | 103 | 52% | Actionable ACP fixes |
| PARTIAL | 33 | 17% | May need further triage |
| NOT_ACP_ISSUE | 59 | 30% | Track separately as code quality |
| HALLUCINATION | 2 | 1% | Deleted |

---

## Notes for Future Iterations

### What worked well
- 10 parallel agents per wave is the sweet spot — fast without overwhelming context
- Local KB files are more reliable than the live spec website
- Verification step is essential — caught 2 hallucinations and reclassified 59 issues as non-ACP
- Max 10 issues per agent keeps quality high; agents with more tend to rush

### What to watch for
- **ACP spec website returns 404** on sub-pages (Next.js SPA). Always instruct agents to use `llms-full.txt` or local KB files.
- **KB files may contradict each other** — KB04 and KB06 define `ToolCallStatus` differently (`in_progress`/`error` vs `running`/`failed`). When in doubt, check the installed SDK types at `node_modules/@agentclientprotocol/sdk/`.
- **Verdict format consistency** — Enforce `### Verdict: {VERDICT}` (H3 with colon, verdict on same line) across all agents. The sorting script depends on this.
- **Duplicate issues across waves** — Phase 3 deduplication is critical. Expect ~10-15% overlap between waves.
- **NOT_ACP_ISSUE is not worthless** — These are real code quality problems. Consider a separate remediation track for them.
- **PARTIAL issues need human triage** — Some are worth fixing for robustness even if not strictly ACP compliance.

### If re-running after fixes
- Only re-review files that were modified during remediation
- Re-verify only issues in `real/` and `partial/` that correspond to modified files
- Keep the previous `other/` directory intact — those issues don't change with ACP fixes
- Update KB files if the ACP spec has changed since last iteration
- Compare issue counts between iterations to track progress

### Estimated resources
- **40 agents total** across 4 waves (10 review × 2 + 10 verify × 2)
- **~5 minutes per wave** for agent completion
- **Total wall time:** ~20-30 minutes for the full process
- **Output:** ~200 individual issue files, ~400KB total
