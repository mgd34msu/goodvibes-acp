import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '../../src/core/event-bus.js';
import { MemoryManager } from '../../src/extensions/memory/manager.js';
import type {
  DecisionRecord,
  PatternRecord,
  FailureRecord,
} from '../../src/types/memory.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDecision(overrides: Partial<Omit<DecisionRecord, 'id'>> = {}): Omit<DecisionRecord, 'id'> {
  return {
    date: '2026-03-07',
    category: 'architecture',
    what: 'Use StateStore for sessions',
    why: 'Provides namespace isolation',
    scope: 'project',
    confidence: 'high',
    status: 'active',
    ...overrides,
  };
}

function makePattern(overrides: Partial<Omit<PatternRecord, 'id'>> = {}): Omit<PatternRecord, 'id'> {
  return {
    name: 'GPA Loop',
    description: 'Gather-Plan-Apply execution pattern',
    when_to_use: 'When making code changes',
    keywords: ['gather', 'plan', 'apply', 'gpa'],
    ...overrides,
  };
}

function makeFailure(overrides: Partial<Omit<FailureRecord, 'id'>> = {}): Omit<FailureRecord, 'id'> {
  return {
    date: '2026-03-07',
    error: 'ENOENT',
    context: 'Reading config file',
    root_cause: 'File not found',
    resolution: 'Create the file on first run',
    prevention: 'Always check existence before reading',
    keywords: ['enoent', 'file', 'config'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryManager', () => {
  let tmpDir: string;
  let bus: EventBus;
  let manager: MemoryManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gv-memory-test-'));
    bus = new EventBus();
    manager = new MemoryManager(tmpDir, bus);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Decisions
  // -------------------------------------------------------------------------

  describe('decisions', () => {
    it('adds a decision and returns it with an ID', () => {
      const added = manager.addDecision(makeDecision());

      expect(added.id).toBeDefined();
      expect(added.id).toMatch(/^dec_\d{8}_\d{6}_[a-z0-9]{4}$/);
      expect(added.category).toBe('architecture');
    });

    it('retrieves a decision by ID', () => {
      const added = manager.addDecision(makeDecision());
      const found = manager.getDecision(added.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(added.id);
    });

    it('returns undefined for unknown decision ID', () => {
      expect(manager.getDecision('dec_unknown')).toBeUndefined();
    });

    it('emits memory:decision-added event', () => {
      const events: unknown[] = [];
      bus.on('memory:decision-added', (ev) => events.push(ev.payload));

      manager.addDecision(makeDecision());

      expect(events).toHaveLength(1);
    });

    it('queries decisions by category', () => {
      manager.addDecision(makeDecision({ category: 'library' }));
      manager.addDecision(makeDecision({ category: 'architecture' }));
      manager.addDecision(makeDecision({ category: 'library' }));

      const results = manager.queryDecisions({ category: 'library' });
      expect(results).toHaveLength(2);
    });

    it('queries decisions by status', () => {
      manager.addDecision(makeDecision({ status: 'active' }));
      manager.addDecision(makeDecision({ status: 'superseded' }));

      const active = manager.queryDecisions({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('active');
    });

    it('queries decisions by keyword in what field', () => {
      manager.addDecision(makeDecision({ what: 'Use Vitest for testing' }));
      manager.addDecision(makeDecision({ what: 'Use Bun for runtime' }));

      const results = manager.queryDecisions({ keyword: 'vitest' });
      expect(results).toHaveLength(1);
      expect(results[0].what).toContain('Vitest');
    });

    it('queries decisions by keyword in why field', () => {
      manager.addDecision(makeDecision({ why: 'Because it is fast' }));
      manager.addDecision(makeDecision({ why: 'Provides type safety' }));

      const results = manager.queryDecisions({ keyword: 'fast' });
      expect(results).toHaveLength(1);
    });

    it('returns all decisions when no filter fields match (empty filter)', () => {
      manager.addDecision(makeDecision());
      manager.addDecision(makeDecision());

      const results = manager.queryDecisions({});
      expect(results).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Patterns
  // -------------------------------------------------------------------------

  describe('patterns', () => {
    it('adds a pattern and returns it with an ID', () => {
      const added = manager.addPattern(makePattern());

      expect(added.id).toBeDefined();
      expect(added.id).toMatch(/^pat_\d{8}_\d{6}_[a-z0-9]{4}$/);
      expect(added.name).toBe('GPA Loop');
    });

    it('retrieves a pattern by ID', () => {
      const added = manager.addPattern(makePattern());
      const found = manager.getPattern(added.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(added.id);
    });

    it('returns undefined for unknown pattern ID', () => {
      expect(manager.getPattern('pat_unknown')).toBeUndefined();
    });

    it('emits memory:pattern-added event', () => {
      const events: unknown[] = [];
      bus.on('memory:pattern-added', (ev) => events.push(ev.payload));

      manager.addPattern(makePattern());

      expect(events).toHaveLength(1);
    });

    it('queries patterns by keyword in name', () => {
      manager.addPattern(makePattern({ name: 'XGzFooBarName', keywords: [] }));
      manager.addPattern(makePattern({ name: 'Token Efficiency', keywords: [] }));

      const results = manager.queryPatterns({ keyword: 'xgzfoobar' });
      expect(results).toHaveLength(1);
    });

    it('queries patterns by keyword in description', () => {
      manager.addPattern(makePattern({ description: 'Batch reads for efficiency' }));
      manager.addPattern(makePattern({ description: 'Write files atomically' }));

      const results = manager.queryPatterns({ keyword: 'batch' });
      expect(results).toHaveLength(1);
    });

    it('queries patterns by keyword in when_to_use', () => {
      manager.addPattern(makePattern({ when_to_use: 'When making code changes' }));
      manager.addPattern(makePattern({ when_to_use: 'For data validation' }));

      const results = manager.queryPatterns({ keyword: 'validation' });
      expect(results).toHaveLength(1);
    });

    it('queries patterns by keyword in keywords array', () => {
      manager.addPattern(makePattern({ keywords: ['alpha', 'beta'] }));
      manager.addPattern(makePattern({ keywords: ['gamma', 'delta'] }));

      const results = manager.queryPatterns({ keyword: 'alpha' });
      expect(results).toHaveLength(1);
    });

    it('returns all patterns when no keyword filter', () => {
      manager.addPattern(makePattern());
      manager.addPattern(makePattern());

      const results = manager.queryPatterns({});
      expect(results).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Failures
  // -------------------------------------------------------------------------

  describe('failures', () => {
    it('adds a failure and returns it with an ID', () => {
      const added = manager.addFailure(makeFailure());

      expect(added.id).toBeDefined();
      expect(added.id).toMatch(/^fail_\d{8}_\d{6}_[a-z0-9]{4}$/);
      expect(added.error).toBe('ENOENT');
    });

    it('retrieves a failure by ID', () => {
      const added = manager.addFailure(makeFailure());
      const found = manager.getFailure(added.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(added.id);
    });

    it('returns undefined for unknown failure ID', () => {
      expect(manager.getFailure('fail_unknown')).toBeUndefined();
    });

    it('emits memory:failure-added event', () => {
      const events: unknown[] = [];
      bus.on('memory:failure-added', (ev) => events.push(ev.payload));

      manager.addFailure(makeFailure());

      expect(events).toHaveLength(1);
    });

    it('queries failures by keyword in error field', () => {
      manager.addFailure(makeFailure({ error: 'ZQXENOENT: file not found', keywords: [] }));
      manager.addFailure(makeFailure({ error: 'TypeError: cannot read', keywords: [] }));

      const results = manager.queryFailures({ keyword: 'zqxenoent' });
      expect(results).toHaveLength(1);
    });

    it('queries failures by keyword in context field', () => {
      manager.addFailure(makeFailure({ context: 'Loading zqxconfig file', keywords: [] }));
      manager.addFailure(makeFailure({ context: 'Connecting to database', keywords: [] }));

      const results = manager.queryFailures({ keyword: 'zqxconfig' });
      expect(results).toHaveLength(1);
    });

    it('queries failures by keyword in keywords array', () => {
      manager.addFailure(makeFailure({ keywords: ['node', 'fs'] }));
      manager.addFailure(makeFailure({ keywords: ['network', 'timeout'] }));

      const results = manager.queryFailures({ keyword: 'fs' });
      expect(results).toHaveLength(1);
    });

    it('returns all failures when no keyword filter', () => {
      manager.addFailure(makeFailure());
      manager.addFailure(makeFailure());

      const results = manager.queryFailures({});
      expect(results).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  describe('preferences', () => {
    it('sets and gets a preference', () => {
      manager.setPreference('code-style.semicolons', 'always', 'Consistency');
      const pref = manager.getPreference('code-style.semicolons');

      expect(pref).toBeDefined();
      expect(pref!.key).toBe('code-style.semicolons');
      expect(pref!.value).toBe('always');
      expect(pref!.reason).toBe('Consistency');
    });

    it('updates an existing preference', () => {
      manager.setPreference('theme', 'light', 'Default');
      manager.setPreference('theme', 'dark', 'Easier on eyes');

      const pref = manager.getPreference('theme');
      expect(pref!.value).toBe('dark');
      expect(pref!.reason).toBe('Easier on eyes');
    });

    it('returns undefined for unknown preference key', () => {
      expect(manager.getPreference('no-such-key')).toBeUndefined();
    });

    it('emits memory:preference-set event', () => {
      const events: unknown[] = [];
      bus.on('memory:preference-set', (ev) => events.push(ev.payload));

      manager.setPreference('lang', 'ts', 'TypeScript');

      expect(events).toHaveLength(1);
    });

    it('allPreferences() returns all stored preferences', () => {
      manager.setPreference('a', '1', 'r1');
      manager.setPreference('b', '2', 'r2');

      const all = manager.allPreferences();
      expect(all).toHaveLength(2);
      expect(all.map((p) => p.key).sort()).toEqual(['a', 'b']);
    });

    it('setAt field is an ISO string', () => {
      manager.setPreference('ts-pref', 'value', 'reason');
      const pref = manager.getPreference('ts-pref');

      expect(pref!.setAt).toBeDefined();
      // Should parse as a valid date
      const d = new Date(pref!.setAt as string);
      expect(isNaN(d.getTime())).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // generateId
  // -------------------------------------------------------------------------

  describe('generateId', () => {
    it('generates an ID with the given prefix and date format', () => {
      const id = manager.generateId('dec');
      expect(id).toMatch(/^dec_\d{8}_\d{6}_[a-z0-9]{4}$/);
    });

    it('generates unique IDs for different prefixes', () => {
      const id1 = manager.generateId('dec');
      const id2 = manager.generateId('pat');

      expect(id1).toMatch(/^dec_/);
      expect(id2).toMatch(/^pat_/);
    });
  });

  // -------------------------------------------------------------------------
  // load / save (disk persistence)
  // -------------------------------------------------------------------------

  describe('load / save', () => {
    it('load() starts fresh when no file exists', async () => {
      const events: unknown[] = [];
      bus.on('memory:loaded', (ev) => events.push(ev.payload));

      await manager.load();

      // Should have emitted memory:loaded
      expect(events).toHaveLength(1);
      // No decisions, patterns, etc.
      expect(manager.queryDecisions({})).toHaveLength(0);
    });

    it('save() writes memory.json to disk', async () => {
      const events: unknown[] = [];
      bus.on('memory:saved', (ev) => events.push(ev.payload));

      manager.addDecision(makeDecision());
      await manager.save();

      expect(events).toHaveLength(1);

      // Read the written file to verify it's valid JSON
      const raw = await Bun.file(join(tmpDir, 'memory.json')).text();
      const parsed = JSON.parse(raw);
      expect(parsed.decisions).toHaveLength(1);
    });

    it('load() restores data saved by save()', async () => {
      manager.addDecision(makeDecision({ what: 'Persisted decision' }));
      manager.addPattern(makePattern({ name: 'Persisted pattern' }));
      manager.addFailure(makeFailure({ error: 'Persisted error' }));
      manager.setPreference('pref-key', 'pref-value', 'reason');
      await manager.save();

      // Create a new manager pointing at the same directory
      const manager2 = new MemoryManager(tmpDir, new EventBus());
      await manager2.load();

      expect(manager2.queryDecisions({})).toHaveLength(1);
      expect(manager2.queryPatterns({})).toHaveLength(1);
      expect(manager2.queryFailures({})).toHaveLength(1);
      expect(manager2.allPreferences()).toHaveLength(1);
      expect(manager2.getPreference('pref-key')!.value).toBe('pref-value');
    });

    it('save() creates the directory if it does not exist', async () => {
      const nestedDir = join(tmpDir, 'a', 'b', 'c');
      const nestedManager = new MemoryManager(nestedDir, new EventBus());
      nestedManager.addDecision(makeDecision());

      await expect(nestedManager.save()).resolves.toBeUndefined();
    });

    it('load() re-reads data from disk, not from in-memory state', async () => {
      // Write via manager1
      manager.addDecision(makeDecision({ what: 'From disk' }));
      await manager.save();

      // manager2 starts clean, then loads from disk
      const manager2 = new MemoryManager(tmpDir, new EventBus());
      await manager2.load();

      const decisions = manager2.queryDecisions({});
      expect(decisions).toHaveLength(1);
      expect(decisions[0].what).toBe('From disk');
    });
  });
});
