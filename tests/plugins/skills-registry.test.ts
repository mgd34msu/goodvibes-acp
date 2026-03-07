/**
 * Tests for L3 SkillRegistry.
 * Covers built-in skills, search, get, register, recommendations, dependencies, always-active.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { SkillRegistry } from '../../src/plugins/skills/registry.ts';
import type { SkillDefinition } from '../../src/plugins/skills/types.ts';

// ---------------------------------------------------------------------------
// Built-in skills
// ---------------------------------------------------------------------------

describe('SkillRegistry — built-in skills', () => {
  it('loads 25 built-in skills on construction', () => {
    const registry = new SkillRegistry();
    const all = registry.list();
    expect(all.length).toBe(25);
  });

  it('all built-in skills have required fields', () => {
    const registry = new SkillRegistry();
    for (const skill of registry.list()) {
      expect(typeof skill.name).toBe('string');
      expect(skill.name.length).toBeGreaterThan(0);
      expect(typeof skill.displayName).toBe('string');
      expect(typeof skill.description).toBe('string');
      expect(typeof skill.tier).toBe('string');
      expect(Array.isArray(skill.keywords)).toBe(true);
      expect(typeof skill.content).toBe('string');
    }
  });

  it('skill names are unique', () => {
    const registry = new SkillRegistry();
    const names = registry.list().map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('contains skills from all 4 tiers', () => {
    const registry = new SkillRegistry();
    const tiers = new Set(registry.list().map((s) => s.tier));
    expect(tiers.has('protocol')).toBe(true);
    expect(tiers.has('orchestration')).toBe(true);
    expect(tiers.has('outcome')).toBe(true);
    expect(tiers.has('quality')).toBe(true);
  });

  it('includes core named skills', () => {
    const registry = new SkillRegistry();
    const names = registry.list().map((s) => s.name);
    expect(names).toContain('precision-mastery');
    expect(names).toContain('gather-plan-apply');
    expect(names).toContain('testing-strategy');
    expect(names).toContain('security-audit');
    expect(names).toContain('refactoring');
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

describe('SkillRegistry — search', () => {
  it('search by query matches name', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ query: 'testing' });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.skills.some((s) => s.name.includes('testing'))).toBe(true);
  });

  it('search by query matches description', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ query: 'playwright' });
    expect(result.totalMatches).toBeGreaterThan(0);
  });

  it('search by query matches keywords', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ query: 'prisma' });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.skills[0].name).toContain('database');
  });

  it('search by tier filters correctly', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ tier: 'protocol' });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.skills.every((s) => s.tier === 'protocol')).toBe(true);
  });

  it('search by keyword filter', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ keyword: 'auth' });
    expect(result.totalMatches).toBeGreaterThan(0);
    expect(result.skills.some((s) => s.name.includes('auth'))).toBe(true);
  });

  it('search with limit returns correct count', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ limit: 3 });
    expect(result.skills.length).toBeLessThanOrEqual(3);
    expect(result.totalMatches).toBeGreaterThan(3); // total is more
  });

  it('search returns empty when no matches', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ query: 'zzznomatchzzz' });
    expect(result.totalMatches).toBe(0);
    expect(result.skills).toHaveLength(0);
  });

  it('search result skills are summaries (no content field)', () => {
    const registry = new SkillRegistry();
    const result = registry.search({ query: 'testing' });
    for (const skill of result.skills) {
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.description).toBe('string');
      // SkillSummary does not include 'content'
      expect((skill as any).content).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Get by name
// ---------------------------------------------------------------------------

describe('SkillRegistry — get', () => {
  it('get() returns full skill definition', () => {
    const registry = new SkillRegistry();
    const skill = registry.get('testing-strategy');
    expect(skill).toBeDefined();
    expect(skill!.name).toBe('testing-strategy');
    expect(typeof skill!.content).toBe('string');
  });

  it('get() returns undefined for unknown skill', () => {
    const registry = new SkillRegistry();
    expect(registry.get('nonexistent-skill')).toBeUndefined();
  });

  it('getContent() returns skill content', () => {
    const registry = new SkillRegistry();
    const content = registry.getContent('gather-plan-apply');
    expect(typeof content).toBe('string');
    expect(content!.length).toBeGreaterThan(0);
  });

  it('getContent() returns undefined for unknown skill', () => {
    const registry = new SkillRegistry();
    expect(registry.getContent('ghost-skill')).toBeUndefined();
  });

  it('listByTier() returns only skills of that tier', () => {
    const registry = new SkillRegistry();
    const qualitySkills = registry.listByTier('quality');
    expect(qualitySkills.length).toBeGreaterThan(0);
    expect(qualitySkills.every((s) => s.tier === 'quality')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Register custom skill
// ---------------------------------------------------------------------------

describe('SkillRegistry — register custom skill', () => {
  it('register() adds a new skill to the registry', () => {
    const registry = new SkillRegistry();
    const customSkill: SkillDefinition = {
      name: 'my-custom-skill',
      displayName: 'My Custom Skill',
      description: 'A test custom skill',
      tier: 'quality',
      keywords: ['custom', 'test'],
      content: 'Do the custom thing.',
    };
    registry.register(customSkill);
    expect(registry.list().length).toBe(26); // 25 + 1
    expect(registry.get('my-custom-skill')).toBeDefined();
  });

  it('register() overwrites an existing skill with the same name', () => {
    const registry = new SkillRegistry();
    const updated: SkillDefinition = {
      name: 'testing-strategy',
      displayName: 'Updated Testing',
      description: 'Updated description',
      tier: 'outcome',
      keywords: ['test'],
      content: 'New content.',
    };
    registry.register(updated);
    const skill = registry.get('testing-strategy');
    expect(skill!.displayName).toBe('Updated Testing');
    expect(skill!.content).toBe('New content.');
  });

  it('unregister() removes a skill by name', () => {
    const registry = new SkillRegistry();
    const removed = registry.unregister('testing-strategy');
    expect(removed).toBe(true);
    expect(registry.get('testing-strategy')).toBeUndefined();
  });

  it('unregister() returns false for non-existent skill', () => {
    const registry = new SkillRegistry();
    expect(registry.unregister('ghost-skill')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Always-active skills
// ---------------------------------------------------------------------------

describe('SkillRegistry — always-active skills', () => {
  it('getAlwaysActive() returns only protocol skills', () => {
    const registry = new SkillRegistry();
    const active = registry.getAlwaysActive();
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((s) => s.alwaysActive === true)).toBe(true);
  });

  it('all 5 protocol skills are always active', () => {
    const registry = new SkillRegistry();
    const active = registry.getAlwaysActive();
    expect(active.length).toBe(5);
    const names = active.map((s) => s.name);
    expect(names).toContain('precision-mastery');
    expect(names).toContain('gather-plan-apply');
    expect(names).toContain('review-scoring');
    expect(names).toContain('goodvibes-memory');
    expect(names).toContain('error-recovery');
  });

  it('non-protocol skills are not always active', () => {
    const registry = new SkillRegistry();
    const nonProtocol = registry.list().filter((s) => s.tier !== 'protocol');
    const anyAlwaysActive = nonProtocol.some((s) => s.alwaysActive === true);
    expect(anyAlwaysActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

describe('SkillRegistry — recommendations', () => {
  it('recommend() returns skills relevant to the task', () => {
    const registry = new SkillRegistry();
    const recs = registry.recommend({ task: 'write tests and improve coverage' });
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThan(0);
    // testing-strategy should be recommended for this task
    expect(recs.some((r) => r.skill.name === 'testing-strategy')).toBe(true);
  });

  it('recommend() does not include always-active protocol skills', () => {
    const registry = new SkillRegistry();
    const recs = registry.recommend({ task: 'build a feature' });
    const alwaysActiveNames = registry.getAlwaysActive().map((s) => s.name);
    for (const rec of recs) {
      expect(alwaysActiveNames).not.toContain(rec.skill.name);
    }
  });

  it('recommend() returns at most 5 results', () => {
    const registry = new SkillRegistry();
    const recs = registry.recommend({ task: 'build full application with auth, api, database, tests, deploy' });
    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it('recommendations are sorted by relevance descending', () => {
    const registry = new SkillRegistry();
    const recs = registry.recommend({ task: 'deploy the application to production' });
    if (recs.length >= 2) {
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1]!.relevance).toBeGreaterThanOrEqual(recs[i]!.relevance);
      }
    }
  });

  it('recommend() considers file context', () => {
    const registry = new SkillRegistry();
    const recs = registry.recommend({
      task: 'improve the code',
      files: ['src/auth/login.ts', 'src/auth/session.ts'],
    });
    // With auth files in context, authentication skill should score higher
    expect(recs.some((r) => r.skill.name === 'authentication')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

describe('SkillRegistry — dependency resolution', () => {
  it('getDependencies returns empty array for skill with no deps', () => {
    const registry = new SkillRegistry();
    const deps = registry.getDependencies('testing-strategy');
    expect(deps).toHaveLength(0);
  });

  it('getDependencies returns empty for unknown skill', () => {
    const registry = new SkillRegistry();
    const deps = registry.getDependencies('nonexistent-skill');
    expect(deps).toHaveLength(0);
  });

  it('getDependencies resolves transitive deps for skill with dependencies', () => {
    const registry = new SkillRegistry();
    // Register a skill with a dependency
    registry.register({
      name: 'dep-skill',
      displayName: 'Dep Skill',
      description: 'A skill that depends on another',
      tier: 'quality',
      keywords: ['dep'],
      dependencies: ['testing-strategy'],
      content: 'Uses testing.',
    });
    const deps = registry.getDependencies('dep-skill');
    expect(deps.some((d) => d.name === 'testing-strategy')).toBe(true);
  });
});
