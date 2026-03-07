/**
 * @module plugins/skills/types
 * @layer L3 — plugin
 *
 * Skill definition types for the GoodVibes ACP runtime.
 * Skills are reusable prompt templates and workflows that agents can invoke.
 */

// ---------------------------------------------------------------------------
// Skill tiers
// ---------------------------------------------------------------------------

/** The tier/category of a skill */
export type SkillTier = 'protocol' | 'orchestration' | 'outcome' | 'quality';

// ---------------------------------------------------------------------------
// Skill definition
// ---------------------------------------------------------------------------

/** Full definition of a skill */
export type SkillDefinition = {
  /** Unique skill identifier (kebab-case) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Brief description of what this skill does */
  description: string;
  /** Tier this skill belongs to */
  tier: SkillTier;
  /** Keywords for search/matching */
  keywords: string[];
  /** Other skill names this skill depends on */
  dependencies?: string[];
  /** Whether this skill is always active (protocol skills) */
  alwaysActive?: boolean;
  /** Content template (the actual skill prompt/instructions) */
  content: string;
  /** Optional validation script path */
  validationScript?: string;
};

// ---------------------------------------------------------------------------
// Skill search
// ---------------------------------------------------------------------------

/** Parameters for searching skills */
export type SkillSearchParams = {
  /** Text query to match against name, description, keywords */
  query?: string;
  /** Filter by tier */
  tier?: SkillTier;
  /** Filter by keyword */
  keyword?: string;
  /** Maximum results to return */
  limit?: number;
};

/** Result of a skill search */
export type SkillSearchResult = {
  /** Matching skills */
  skills: SkillSummary[];
  /** Total matches (before limit) */
  totalMatches: number;
};

/** Summary of a skill (without full content) */
export type SkillSummary = {
  name: string;
  displayName: string;
  description: string;
  tier: SkillTier;
  keywords: string[];
  alwaysActive: boolean;
};

// ---------------------------------------------------------------------------
// Skill recommendation
// ---------------------------------------------------------------------------

/** Context for skill recommendations */
export type RecommendationContext = {
  /** The task being worked on */
  task: string;
  /** Files involved */
  files?: string[];
  /** Agent type requesting recommendation */
  agentType?: string;
};

/** A skill recommendation */
export type SkillRecommendation = {
  /** The recommended skill */
  skill: SkillSummary;
  /** Relevance score (0-1) */
  relevance: number;
  /** Why this skill was recommended */
  reason: string;
};
