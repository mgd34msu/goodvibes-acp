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
    content: 'Use precision_engine tools with appropriate verbosity and extract modes.',
  },
  {
    name: 'gather-plan-apply',
    displayName: 'Gather-Plan-Apply',
    description: 'GPA execution loop — GATHER, PLAN, APPLY',
    tier: 'protocol',
    keywords: ['gpa', 'gather', 'plan', 'apply', 'workflow', 'loop'],
    alwaysActive: true,
    content: 'Follow the GPA loop: GATHER context, PLAN changes, APPLY edits.',
  },
  {
    name: 'review-scoring',
    displayName: 'Review Scoring',
    description: '10-dimension scoring rubric for WRFC review loops',
    tier: 'protocol',
    keywords: ['review', 'scoring', 'wrfc', 'quality', 'dimensions'],
    alwaysActive: true,
    content: 'Score reviews across 10 dimensions with weighted scoring.',
  },
  {
    name: 'goodvibes-memory',
    displayName: 'GoodVibes Memory',
    description: 'Cross-session memory (decisions, patterns, failures, preferences)',
    tier: 'protocol',
    keywords: ['memory', 'decisions', 'patterns', 'failures', 'preferences'],
    alwaysActive: true,
    content: 'Use .goodvibes/memory/ for cross-session knowledge persistence.',
  },
  {
    name: 'error-recovery',
    displayName: 'Error Recovery',
    description: 'Tiered error recovery and escalation procedures',
    tier: 'protocol',
    keywords: ['error', 'recovery', 'escalation', 'fix', 'retry'],
    alwaysActive: true,
    content: 'Follow tiered recovery: retry, escalate, ask user.',
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
