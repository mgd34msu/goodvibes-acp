/**
 * @module plugins/skills/registry
 * @layer L3 — plugin
 *
 * In-memory skill registry. Stores skill definitions and provides
 * search, retrieval, and recommendation capabilities.
 */

import type {
  SkillDefinition,
  SkillTier,
  SkillSearchParams,
  SkillSearchResult,
  SkillSummary,
  RecommendationContext,
  SkillRecommendation,
} from './types.js';

// ---------------------------------------------------------------------------
// Built-in protocol skills
// ---------------------------------------------------------------------------

const PROTOCOL_SKILLS: SkillDefinition[] = [
  {
    name: 'precision-mastery',
    displayName: 'Precision Mastery',
    description: 'Token-efficient file operations, extract modes, verbosity, batching',
    tier: 'protocol',
    keywords: ['precision', 'tools', 'read', 'write', 'edit', 'grep', 'glob', 'verbosity'],
    alwaysActive: true,
    content: `Use precision_engine tools with appropriate verbosity and extract modes to minimize token consumption.

Extract modes (cheapest to most expensive): lines (80-95% savings) → symbols (70-90%) → outline (60-80%) → ast (50-70%) → content (0%). Always choose the cheapest mode that satisfies the task. Use 'outline' to understand structure before deciding if 'content' is needed.

Verbosity rules: precision_write → count_only (you wrote it, don't read it back). precision_edit → minimal. precision_read → standard. precision_exec → minimal unless debugging.

Batching: use the built-in arrays — precision_read files[], precision_write files[], precision_edit edits[], precision_exec commands[]. Three sequential single-item calls should always be collapsed into one batched call.

NEVER use precision_exec to search files — use precision_grep, precision_glob, precision_read, or discover instead.`,
  },
  {
    name: 'gather-plan-apply',
    displayName: 'Gather-Plan-Apply',
    description: 'GPA execution loop — GATHER, PLAN, APPLY',
    tier: 'protocol',
    keywords: ['gpa', 'gather', 'plan', 'apply', 'workflow', 'loop'],
    alwaysActive: true,
    content: `Follow the GPA loop for every task: GATHER context, PLAN changes (zero tool calls), APPLY edits.

GATHER: Check .goodvibes/memory/ for prior decisions and failures. Run a single 'discover' call with all queries batched (glob, grep, symbols). Then batch-read the discovered files using precision_read with the cheapest extract mode that provides sufficient context.

PLAN: No tool calls in this phase. Identify exact file paths to create, modify, or delete. List the precise find/replace pairs. Classify operations as independent (batchable) or dependent (sequential). One sentence is enough for simple tasks; structured notes for complex ones.

APPLY: Execute the plan. Batch independent writes into one precision_write call. Batch independent edits into one precision_edit call. Verify with precision_exec (typecheck, lint, build). On failure, fix only the failed operations — never re-run successful ones.`,
  },
  {
    name: 'review-scoring',
    displayName: 'Review Scoring',
    description: '10-dimension scoring rubric for WRFC review loops',
    tier: 'protocol',
    keywords: ['review', 'scoring', 'wrfc', 'quality', 'dimensions'],
    alwaysActive: true,
    content: `Score implementations across 10 dimensions, each weighted 0–1. The overall score is the weighted average (0–10 scale).

Dimensions: (1) Correctness — does it do what was asked? (2) Type safety — no 'any', proper generics, exhaustive checks. (3) Error handling — all failure modes covered, errors propagated correctly. (4) Security — no injection, proper validation, no leaked secrets. (5) Performance — no N+1 queries, appropriate caching, efficient algorithms. (6) Maintainability — follows existing patterns, clear naming, single responsibility. (7) Completeness — no TODOs, no placeholder logic, no stubs. (8) Documentation — JSDoc for public APIs, inline comments for complex logic. (9) Test coverage — critical paths exercised. (10) Accessibility — UI components meet WCAG 2.1 AA.

A score below the configured minReviewScore triggers a fix cycle. Always report scores per dimension and the final weighted average.`,
  },
  {
    name: 'goodvibes-memory',
    displayName: 'GoodVibes Memory',
    description: 'Cross-session memory (decisions, patterns, failures, preferences)',
    tier: 'protocol',
    keywords: ['memory', 'decisions', 'patterns', 'failures', 'preferences'],
    alwaysActive: true,
    content: `Read from .goodvibes/memory/ at the start of every session to avoid repeating past mistakes.

Key files: decisions.json (architectural choices — respect these), patterns.json (proven approaches — reuse these), failures.json (past tool failures and wrong assumptions — avoid these).

Write to memory when: making an architectural decision that affects future sessions, discovering a non-obvious pattern in the codebase, encountering a genuine tool failure (not user error), or when the user expresses a preference.

Format for decisions.json: { what, why, category, confidence }. Format for failures.json: { tool, error, context, workaround }. Format for patterns.json: { pattern, files, notes }.`,
  },
  {
    name: 'error-recovery',
    displayName: 'Error Recovery',
    description: 'Tiered error recovery and escalation procedures',
    tier: 'protocol',
    keywords: ['error', 'recovery', 'escalation', 'fix', 'retry'],
    alwaysActive: true,
    content: `Follow tiered recovery when a tool or build step fails.

Tier 1 — Self-fix: check if the error is a user error (wrong path, bad syntax, missing arg). Correct and retry. Check .goodvibes/memory/failures.json to see if this has happened before.

Tier 2 — Workaround: if the precision tool genuinely fails (not user error), use the equivalent native tool for that specific operation only. Log the failure to memory/failures.json with context. Return to precision tools immediately after.

Tier 3 — Escalate: if the workaround also fails, or if the root cause requires a decision beyond your scope (schema change, auth provider swap, breaking API change), stop and ask the user. Do not guess at irreversible operations.

Never retry a successful operation. Never re-run a full batch if only one item failed — fix and re-run the one.`,
  },
];

const ORCHESTRATION_SKILLS: SkillDefinition[] = [
  {
    name: 'task-orchestration',
    displayName: 'Task Orchestration',
    description: 'Parallel agent decomposition and WRFC coordination',
    tier: 'orchestration',
    keywords: ['orchestration', 'parallel', 'agents', 'wrfc', 'coordination'],
    content: 'Decompose tasks into parallel agent chains with WRFC quality gates.',
  },
  {
    name: 'fullstack-feature',
    displayName: 'Fullstack Feature',
    description: 'End-to-end multi-layer feature development',
    tier: 'orchestration',
    keywords: ['fullstack', 'feature', 'end-to-end', 'multi-layer'],
    content: 'Coordinate frontend, backend, database, and test layers for feature development.',
  },
];

const OUTCOME_SKILLS: SkillDefinition[] = [
  { name: 'ai-integration', displayName: 'AI Integration', description: 'AI/LLM chat, streaming, RAG, embeddings', tier: 'outcome', keywords: ['ai', 'llm', 'chat', 'streaming', 'rag', 'embeddings'], content: 'Integrate AI capabilities with proper streaming and error handling.' },
  { name: 'api-design', displayName: 'API Design', description: 'REST/GraphQL/tRPC endpoint design and validation', tier: 'outcome', keywords: ['api', 'rest', 'graphql', 'trpc', 'endpoint'], content: 'Design type-safe API endpoints with validation and error handling.' },
  { name: 'authentication', displayName: 'Authentication', description: 'Login, OAuth, JWT, sessions, RBAC', tier: 'outcome', keywords: ['auth', 'login', 'oauth', 'jwt', 'session', 'rbac'], content: 'Implement secure authentication with proper session management.' },
  { name: 'component-architecture', displayName: 'Component Architecture', description: 'UI component composition, rendering, accessibility', tier: 'outcome', keywords: ['component', 'ui', 'rendering', 'accessibility'], content: 'Build composable, accessible UI components.' },
  { name: 'database-layer', displayName: 'Database Layer', description: 'Schema design, ORM setup, migrations, query optimization', tier: 'outcome', keywords: ['database', 'schema', 'orm', 'prisma', 'migration', 'sql'], content: 'Design normalized schemas with proper indexing and migration strategy.' },
  { name: 'deployment', displayName: 'Deployment', description: 'CI/CD, Docker, Vercel/Railway/Fly.io/AWS', tier: 'outcome', keywords: ['deploy', 'ci', 'cd', 'docker', 'vercel', 'aws'], content: 'Configure deployment pipelines with health checks and rollback.' },
  { name: 'payment-integration', displayName: 'Payment Integration', description: 'Stripe/LemonSqueezy/Paddle checkout and subscriptions', tier: 'outcome', keywords: ['payment', 'stripe', 'checkout', 'subscription', 'billing'], content: 'Integrate payment processing with webhook handling.' },
  { name: 'service-integration', displayName: 'Service Integration', description: 'Email, CMS, file uploads, analytics', tier: 'outcome', keywords: ['email', 'cms', 'upload', 'analytics', 'service'], content: 'Connect external services with proper auth and error handling.' },
  { name: 'state-management', displayName: 'State Management', description: 'Server/client/form/URL state patterns', tier: 'outcome', keywords: ['state', 'zustand', 'redux', 'form', 'url', 'cache'], content: 'Implement state management with proper cache invalidation.' },
  { name: 'styling-system', displayName: 'Styling System', description: 'Tailwind, design tokens, dark mode, responsive', tier: 'outcome', keywords: ['tailwind', 'css', 'styling', 'dark-mode', 'responsive', 'theme'], content: 'Build consistent styling with design tokens and responsive breakpoints.' },
  { name: 'testing-strategy', displayName: 'Testing Strategy', description: 'Vitest/Jest, Testing Library, Playwright, MSW', tier: 'outcome', keywords: ['test', 'vitest', 'jest', 'playwright', 'coverage', 'tdd'], content: 'Implement comprehensive testing with 100% coverage target.' },
];

const QUALITY_SKILLS: SkillDefinition[] = [
  { name: 'accessibility-audit', displayName: 'Accessibility Audit', description: 'WCAG 2.1 AA compliance audit', tier: 'quality', keywords: ['accessibility', 'wcag', 'a11y', 'aria'], content: 'Audit for WCAG 2.1 AA compliance.' },
  { name: 'code-review', displayName: 'Code Review', description: '10-dimension weighted code review', tier: 'quality', keywords: ['review', 'quality', 'code-review'], content: 'Review code across 10 quality dimensions.' },
  { name: 'debugging', displayName: 'Debugging', description: 'Error analysis, runtime debugging, root cause analysis', tier: 'quality', keywords: ['debug', 'error', 'runtime', 'root-cause'], content: 'Systematic debugging with root cause analysis.' },
  { name: 'performance-audit', displayName: 'Performance Audit', description: 'Bundle, database, rendering, Core Web Vitals', tier: 'quality', keywords: ['performance', 'bundle', 'vitals', 'optimization'], content: 'Audit performance across bundle, DB, rendering, and CWV.' },
  { name: 'project-onboarding', displayName: 'Project Onboarding', description: 'Codebase analysis and architecture mapping', tier: 'quality', keywords: ['onboarding', 'codebase', 'architecture', 'mapping'], content: 'Analyze and map codebase architecture for onboarding.' },
  { name: 'refactoring', displayName: 'Refactoring', description: 'Safe structural improvements with validation', tier: 'quality', keywords: ['refactor', 'restructure', 'improve', 'cleanup'], content: 'Safely refactor with validation at each step.' },
  { name: 'security-audit', displayName: 'Security Audit', description: 'Auth, input validation, dependencies, infrastructure', tier: 'quality', keywords: ['security', 'audit', 'vulnerability', 'auth', 'validation'], content: 'Comprehensive security audit across all layers.' },
];

// ---------------------------------------------------------------------------
// SkillRegistry
// ---------------------------------------------------------------------------

export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  constructor() {
    this.loadBuiltins();
  }

  /** Load all built-in skills */
  private loadBuiltins(): void {
    const allSkills = [
      ...PROTOCOL_SKILLS,
      ...ORCHESTRATION_SKILLS,
      ...OUTCOME_SKILLS,
      ...QUALITY_SKILLS,
    ];
    for (const skill of allSkills) {
      this.skills.set(skill.name, skill);
    }
  }

  /** Register a custom skill */
  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
  }

  /** Unregister a skill by name */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /** Get a skill by name */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /** Get skill content by name */
  getContent(name: string): string | undefined {
    return this.skills.get(name)?.content;
  }

  /** List all skills */
  list(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  /** List skills by tier */
  listByTier(tier: SkillTier): SkillDefinition[] {
    return this.list().filter((s) => s.tier === tier);
  }

  /** Get all always-active skills */
  getAlwaysActive(): SkillDefinition[] {
    return this.list().filter((s) => s.alwaysActive === true);
  }

  /** Search skills by query */
  search(params: SkillSearchParams): SkillSearchResult {
    let results = this.list();

    // Filter by tier
    if (params.tier) {
      results = results.filter((s) => s.tier === params.tier);
    }

    // Filter by keyword
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      results = results.filter((s) =>
        s.keywords.some((k) => k.toLowerCase().includes(kw)),
      );
    }

    // Filter by query (match name, description, keywords)
    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.displayName.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.keywords.some((k) => k.toLowerCase().includes(q)),
      );
    }

    const totalMatches = results.length;
    if (params.limit && params.limit > 0) {
      results = results.slice(0, params.limit);
    }

    return {
      skills: results.map((s) => this.toSummary(s)),
      totalMatches,
    };
  }

  /** Get skill recommendations based on context */
  recommend(context: RecommendationContext): SkillRecommendation[] {
    const taskLower = context.task.toLowerCase();
    const recommendations: SkillRecommendation[] = [];

    for (const skill of this.skills.values()) {
      if (skill.alwaysActive) continue; // Protocol skills always apply, no need to recommend

      let relevance = 0;
      const reasons: string[] = [];

      // Check keyword matches against task
      for (const keyword of skill.keywords) {
        if (taskLower.includes(keyword.toLowerCase())) {
          relevance += 0.2;
          reasons.push(`Task mentions "${keyword}"`);
        }
      }

      // Check file patterns
      if (context.files) {
        const fileStr = context.files.join(' ').toLowerCase();
        for (const keyword of skill.keywords) {
          if (fileStr.includes(keyword.toLowerCase())) {
            relevance += 0.1;
            reasons.push(`Files relate to "${keyword}"`);
          }
        }
      }

      // Cap relevance at 1.0
      relevance = Math.min(relevance, 1.0);

      if (relevance > 0) {
        recommendations.push({
          skill: this.toSummary(skill),
          relevance,
          reason: reasons.join('; '),
        });
      }
    }

    // Sort by relevance descending
    recommendations.sort((a, b) => b.relevance - a.relevance);
    return recommendations.slice(0, 5);
  }

  /** Get dependency tree for a skill */
  getDependencies(name: string): SkillDefinition[] {
    const skill = this.skills.get(name);
    if (!skill?.dependencies?.length) return [];

    const deps: SkillDefinition[] = [];
    const visited = new Set<string>();

    const resolve = (depName: string): void => {
      if (visited.has(depName)) return;
      visited.add(depName);
      const dep = this.skills.get(depName);
      if (dep) {
        // Resolve transitive deps first
        if (dep.dependencies) {
          for (const transitive of dep.dependencies) {
            resolve(transitive);
          }
        }
        deps.push(dep);
      }
    };

    for (const depName of skill.dependencies) {
      resolve(depName);
    }
    return deps;
  }

  /** Convert a full definition to a summary */
  private toSummary(skill: SkillDefinition): SkillSummary {
    return {
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      tier: skill.tier,
      keywords: skill.keywords,
      alwaysActive: skill.alwaysActive ?? false,
    };
  }
}
