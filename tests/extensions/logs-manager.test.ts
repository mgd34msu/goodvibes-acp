import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus } from '../../src/core/event-bus.js';
import { LogsManager } from '../../src/extensions/logs/manager.js';
import type { ActivityEntry, DecisionEntry, ErrorEntry } from '../../src/extensions/logs/manager.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeActivity(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    title: 'Implement feature X',
    task: 'Build and test the authentication flow',
    plan: 'Create handlers, write tests, update types',
    status: 'COMPLETE',
    completedItems: ['Created handler', 'Wrote tests'],
    filesModified: ['src/auth.ts', 'tests/auth.test.ts'],
    ...overrides,
  };
}

function makeDecision(overrides: Partial<DecisionEntry> = {}): DecisionEntry {
  return {
    title: 'Choose state management approach',
    context: 'Need to manage session state across multiple agents',
    options: [
      { name: 'StateStore', pros: 'Simple, namespaced', cons: 'In-memory only' },
      { name: 'Redis', pros: 'Persistent, scalable', cons: 'External dependency' },
    ],
    decision: 'Use StateStore',
    rationale: 'Avoids external deps, sufficient for current scope',
    implications: 'No persistence across restarts',
    ...overrides,
  };
}

function makeError(overrides: Partial<ErrorEntry> = {}): ErrorEntry {
  return {
    category: 'BUILD_ERROR',
    error: 'TypeScript compilation failed',
    taskContext: 'Running tsc --noEmit',
    rootCause: 'Missing type annotation',
    resolution: 'Added explicit return type',
    status: 'RESOLVED',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LogsManager', () => {
  let tmpDir: string;
  let bus: EventBus;
  let manager: LogsManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gv-logs-test-'));
    bus = new EventBus();
    manager = new LogsManager(tmpDir, bus);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // ensureFiles
  // -------------------------------------------------------------------------

  describe('ensureFiles', () => {
    it('creates activity.md, decisions.md, and errors.md', async () => {
      await manager.ensureFiles();

      const activity = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      const decisions = await readFile(join(tmpDir, 'decisions.md'), 'utf-8');
      const errors = await readFile(join(tmpDir, 'errors.md'), 'utf-8');

      expect(activity).toContain('Activity Log');
      expect(decisions).toContain('Decision Log');
      expect(errors).toContain('Error Log');
    });

    it('is idempotent — calling twice does not corrupt existing files', async () => {
      await manager.ensureFiles();
      // Write some content first
      await manager.logActivity(makeActivity({ title: 'First entry' }));

      const beforeContent = await readFile(join(tmpDir, 'activity.md'), 'utf-8');

      // Call ensureFiles again — should not overwrite existing file
      await manager.ensureFiles();

      const afterContent = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(afterContent).toBe(beforeContent);
    });

    it('creates the directory if it does not exist', async () => {
      const nestedDir = join(tmpDir, 'nested', 'logs');
      const nestedManager = new LogsManager(nestedDir, new EventBus());

      await expect(nestedManager.ensureFiles()).resolves.toBeUndefined();

      const activity = await readFile(join(nestedDir, 'activity.md'), 'utf-8');
      expect(activity).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // logActivity
  // -------------------------------------------------------------------------

  describe('logActivity', () => {
    it('writes to activity.md', async () => {
      await manager.logActivity(makeActivity({ title: 'My Task' }));

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(content).toContain('My Task');
    });

    it('includes task, plan, and status in the output', async () => {
      await manager.logActivity(
        makeActivity({ task: 'Build X', plan: 'Design first', status: 'PARTIAL' })
      );

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(content).toContain('Build X');
      expect(content).toContain('Design first');
      expect(content).toContain('PARTIAL');
    });

    it('includes completed items and files modified', async () => {
      await manager.logActivity(
        makeActivity({
          completedItems: ['Step A', 'Step B'],
          filesModified: ['src/foo.ts'],
        })
      );

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(content).toContain('Step A');
      expect(content).toContain('Step B');
      expect(content).toContain('src/foo.ts');
    });

    it('includes reviewScore when provided', async () => {
      await manager.logActivity(makeActivity({ reviewScore: 9.5 }));

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(content).toContain('9.5');
    });

    it('includes commit hash when provided', async () => {
      await manager.logActivity(makeActivity({ commit: 'abc1234' }));

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(content).toContain('abc1234');
    });

    it('shows (none) for empty completedItems', async () => {
      await manager.logActivity(makeActivity({ completedItems: [], filesModified: [] }));

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      expect(content).toContain('(none)');
    });

    it('emits log:activity event', async () => {
      const events: unknown[] = [];
      bus.on('log:activity', (ev) => events.push(ev.payload));

      await manager.logActivity(makeActivity());

      expect(events).toHaveLength(1);
    });

    it('prepends entries so the most recent appears first', async () => {
      await manager.logActivity(makeActivity({ title: 'First entry' }));
      await manager.logActivity(makeActivity({ title: 'Second entry' }));

      const content = await readFile(join(tmpDir, 'activity.md'), 'utf-8');
      const firstIdx = content.indexOf('First entry');
      const secondIdx = content.indexOf('Second entry');

      // Second entry (newer) should appear before the first
      expect(secondIdx).toBeLessThan(firstIdx);
    });
  });

  // -------------------------------------------------------------------------
  // logDecision
  // -------------------------------------------------------------------------

  describe('logDecision', () => {
    it('writes to decisions.md', async () => {
      await manager.logDecision(makeDecision({ title: 'Auth strategy' }));

      const content = await readFile(join(tmpDir, 'decisions.md'), 'utf-8');
      expect(content).toContain('Auth strategy');
    });

    it('includes context and decision fields', async () => {
      await manager.logDecision(
        makeDecision({
          context: 'Need auth approach',
          decision: 'JWT tokens',
        })
      );

      const content = await readFile(join(tmpDir, 'decisions.md'), 'utf-8');
      expect(content).toContain('Need auth approach');
      expect(content).toContain('JWT tokens');
    });

    it('includes options with pros and cons', async () => {
      await manager.logDecision(
        makeDecision({
          options: [{ name: 'Option A', pros: 'Fast', cons: 'Complex' }],
        })
      );

      const content = await readFile(join(tmpDir, 'decisions.md'), 'utf-8');
      expect(content).toContain('Option A');
      expect(content).toContain('Fast');
      expect(content).toContain('Complex');
    });

    it('emits log:decision event', async () => {
      const events: unknown[] = [];
      bus.on('log:decision', (ev) => events.push(ev.payload));

      await manager.logDecision(makeDecision());

      expect(events).toHaveLength(1);
    });

    it('prepends — most recent decision appears first', async () => {
      await manager.logDecision(makeDecision({ title: 'Decision One' }));
      await manager.logDecision(makeDecision({ title: 'Decision Two' }));

      const content = await readFile(join(tmpDir, 'decisions.md'), 'utf-8');
      const oneIdx = content.indexOf('Decision One');
      const twoIdx = content.indexOf('Decision Two');

      expect(twoIdx).toBeLessThan(oneIdx);
    });
  });

  // -------------------------------------------------------------------------
  // logError
  // -------------------------------------------------------------------------

  describe('logError', () => {
    it('writes to errors.md', async () => {
      await manager.logError(makeError({ error: 'ENOENT: file not found' }));

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('ENOENT: file not found');
    });

    it('includes category, root cause, and resolution', async () => {
      await manager.logError(
        makeError({
          category: 'TEST_FAILURE',
          rootCause: 'Missing mock',
          resolution: 'Added vi.mock',
        })
      );

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('TEST_FAILURE');
      expect(content).toContain('Missing mock');
      expect(content).toContain('Added vi.mock');
    });

    it('includes agent when provided', async () => {
      await manager.logError(makeError({ agent: 'tester-agent' }));

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('tester-agent');
    });

    it('includes files when provided', async () => {
      await manager.logError(makeError({ files: ['src/broken.ts', 'tests/broken.test.ts'] }));

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('src/broken.ts');
    });

    it('includes prevention when provided', async () => {
      await manager.logError(makeError({ prevention: 'Always validate input first' }));

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('Always validate input first');
    });

    it('shows N/A for agent when not provided', async () => {
      await manager.logError(makeError());

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('Agent: N/A');
    });

    it('shows N/A for prevention when not provided', async () => {
      const entry = makeError();
      delete entry.prevention;
      await manager.logError(entry);

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('**Prevention**: N/A');
    });

    it('emits log:error event', async () => {
      const events: unknown[] = [];
      bus.on('log:error', (ev) => events.push(ev.payload));

      await manager.logError(makeError());

      expect(events).toHaveLength(1);
    });

    it('prepends — most recent error appears first', async () => {
      await manager.logError(makeError({ error: 'Error One' }));
      await manager.logError(makeError({ error: 'Error Two' }));

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      const oneIdx = content.indexOf('Error One');
      const twoIdx = content.indexOf('Error Two');

      expect(twoIdx).toBeLessThan(oneIdx);
    });

    it('includes status in the output', async () => {
      await manager.logError(makeError({ status: 'UNRESOLVED' }));

      const content = await readFile(join(tmpDir, 'errors.md'), 'utf-8');
      expect(content).toContain('UNRESOLVED');
    });
  });
});
