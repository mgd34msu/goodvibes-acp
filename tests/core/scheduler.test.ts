import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Scheduler } from '../../src/core/scheduler.ts';

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    // Always destroy to clean up timers, even if a test already did
    try { scheduler.destroy(); } catch { /* already destroyed */ }
  });

  // --- schedule ---

  describe('schedule', () => {
    it('schedules a task with scheduled status', () => {
      scheduler.schedule('task1', {
        handler: () => {},
        intervalMs: 60000,
      });
      const task = scheduler.getTask('task1');
      expect(task).toBeDefined();
      expect(task?.id).toBe('task1');
      expect(task?.status).toBe('scheduled');
      expect(task?.runCount).toBe(0);
      expect(task?.lastRun).toBeNull();
    });

    it('throws when scheduling duplicate task id', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      expect(() =>
        scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 })
      ).toThrow("Scheduler: task 'task1' is already scheduled");
    });

    it('throws after destroy', () => {
      scheduler.destroy();
      expect(() =>
        scheduler.schedule('task1', { handler: () => {}, intervalMs: 1000 })
      ).toThrow('Scheduler has been destroyed');
    });

    it('sets nextRun to approximately now + intervalMs', () => {
      const before = Date.now();
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 5000 });
      const task = scheduler.getTask('task1')!;
      expect(task.nextRun).toBeGreaterThanOrEqual(before + 5000 - 50);
      expect(task.nextRun).toBeLessThanOrEqual(before + 5000 + 50);
    });

    it('uses 60000ms as default intervalMs', () => {
      const before = Date.now();
      scheduler.schedule('task1', { handler: () => {} });
      const task = scheduler.getTask('task1')!;
      expect(task.nextRun).toBeGreaterThanOrEqual(before + 60000 - 50);
    });

    it('runImmediately executes handler once before first interval', async () => {
      const calls: number[] = [];
      scheduler.schedule('task1', {
        handler: () => { calls.push(1); },
        intervalMs: 60000,
        runImmediately: true,
      });
      // Allow sync execution to complete
      await new Promise((r) => setTimeout(r, 10));
      expect(calls).toHaveLength(1);
    });

    it('runImmediately increments runCount', async () => {
      scheduler.schedule('task1', {
        handler: () => {},
        intervalMs: 60000,
        runImmediately: true,
      });
      await new Promise((r) => setTimeout(r, 10));
      const task = scheduler.getTask('task1')!;
      expect(task.runCount).toBe(1);
    });
  });

  // --- cancel ---

  describe('cancel', () => {
    it('cancels a scheduled task', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      scheduler.cancel('task1');
      // Task is removed from getTask after cancel
      expect(scheduler.getTask('task1')).toBeUndefined();
    });

    it('does not throw when cancelling nonexistent task', () => {
      expect(() => scheduler.cancel('nonexistent')).not.toThrow();
    });

    it('cancelled task is removed from list()', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      scheduler.cancel('task1');
      expect(scheduler.list()).toHaveLength(0);
    });
  });

  // --- pause / resume ---

  describe('pause / resume', () => {
    it('pause changes status to paused', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      scheduler.pause('task1');
      expect(scheduler.getTask('task1')?.status).toBe('paused');
    });

    it('pause clears nextRun', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      scheduler.pause('task1');
      expect(scheduler.getTask('task1')?.nextRun).toBeNull();
    });

    it('resume changes status back to scheduled', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      scheduler.pause('task1');
      scheduler.resume('task1');
      expect(scheduler.getTask('task1')?.status).toBe('scheduled');
    });

    it('resume restores nextRun', () => {
      const before = Date.now();
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 5000 });
      scheduler.pause('task1');
      scheduler.resume('task1');
      const task = scheduler.getTask('task1')!;
      expect(task.nextRun).toBeGreaterThanOrEqual(before + 5000 - 50);
    });

    it('pause does not throw for nonexistent task', () => {
      expect(() => scheduler.pause('nonexistent')).not.toThrow();
    });

    it('resume does not change status when task is not paused', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      // task1 is 'scheduled', not paused — resume is a no-op
      scheduler.resume('task1');
      expect(scheduler.getTask('task1')?.status).toBe('scheduled');
    });

    it('pause on cancelled task is a no-op', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      scheduler.cancel('task1');
      // Cancellation removes task; re-cancelling is fine
      expect(() => scheduler.pause('task1')).not.toThrow();
    });

    it('pause throws after destroy', () => {
      scheduler.destroy();
      expect(() => scheduler.pause('task1')).toThrow('Scheduler has been destroyed');
    });

    it('resume throws after destroy', () => {
      scheduler.destroy();
      expect(() => scheduler.resume('task1')).toThrow('Scheduler has been destroyed');
    });
  });

  // --- list / getTask ---

  describe('list / getTask', () => {
    it('list returns empty array on fresh scheduler', () => {
      expect(scheduler.list()).toHaveLength(0);
    });

    it('list returns all scheduled tasks', () => {
      scheduler.schedule('a', { handler: () => {}, intervalMs: 60000 });
      scheduler.schedule('b', { handler: () => {}, intervalMs: 60000 });
      expect(scheduler.list()).toHaveLength(2);
    });

    it('getTask returns undefined for unknown id', () => {
      expect(scheduler.getTask('unknown')).toBeUndefined();
    });

    it('getTask returns task with correct config', () => {
      const handler = () => {};
      scheduler.schedule('task1', { handler, intervalMs: 1234 });
      const task = scheduler.getTask('task1')!;
      expect(task.config.intervalMs).toBe(1234);
      expect(task.config.handler).toBe(handler);
    });
  });

  // --- task execution ---

  describe('task execution (via interval)', () => {
    it('handler is called on interval tick', async () => {
      const calls: number[] = [];
      scheduler.schedule('task1', {
        handler: () => { calls.push(1); },
        intervalMs: 20,
      });
      await new Promise((r) => setTimeout(r, 60));
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });

    it('runCount increments on each execution', async () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 20 });
      await new Promise((r) => setTimeout(r, 60));
      expect(scheduler.getTask('task1')?.runCount).toBeGreaterThanOrEqual(1);
    });

    it('lastRun is updated after execution', async () => {
      const before = Date.now();
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 20 });
      await new Promise((r) => setTimeout(r, 60));
      expect(scheduler.getTask('task1')?.lastRun).toBeGreaterThanOrEqual(before);
    });

    it('status returns to scheduled after handler completes', async () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 20 });
      await new Promise((r) => setTimeout(r, 60));
      const task = scheduler.getTask('task1');
      // After sync handler completes, status should be 'scheduled' again
      expect(task?.status).toBe('scheduled');
    });

    it('async handler: status returns to scheduled after async completion', async () => {
      scheduler.schedule('task1', {
        handler: async () => { await new Promise((r) => setTimeout(r, 5)); },
        intervalMs: 30,
      });
      await new Promise((r) => setTimeout(r, 80));
      const task = scheduler.getTask('task1');
      expect(task?.status).toBe('scheduled');
    });

    it('respects maxConcurrent=1 — does not run handler while active', async () => {
      const active: number[] = [];
      let maxActive = 0;
      scheduler.schedule('task1', {
        handler: async () => {
          active.push(1);
          maxActive = Math.max(maxActive, active.length);
          await new Promise((r) => setTimeout(r, 30));
          active.pop();
        },
        intervalMs: 10,
        maxConcurrent: 1,
      });
      await new Promise((r) => setTimeout(r, 80));
      expect(maxActive).toBe(1);
    });

    it('handler error is caught and does not crash the scheduler', async () => {
      const calls: number[] = [];
      scheduler.schedule('task1', {
        handler: () => { calls.push(1); throw new Error('handler error'); },
        intervalMs: 20,
      });
      await new Promise((r) => setTimeout(r, 60));
      expect(calls.length).toBeGreaterThanOrEqual(1);
      // Status recovers — task is still alive
      expect(scheduler.getTask('task1')).toBeDefined();
    });

    it('cancelled task does not execute even if interval fires', async () => {
      const calls: number[] = [];
      scheduler.schedule('task1', {
        handler: () => { calls.push(1); },
        intervalMs: 20,
      });
      scheduler.cancel('task1');
      await new Promise((r) => setTimeout(r, 60));
      expect(calls).toHaveLength(0);
    });

    it('paused task does not execute while paused', async () => {
      const calls: number[] = [];
      scheduler.schedule('task1', {
        handler: () => { calls.push(1); },
        intervalMs: 20,
      });
      scheduler.pause('task1');
      await new Promise((r) => setTimeout(r, 60));
      expect(calls).toHaveLength(0);
    });
  });

  // --- getDisposable ---

  describe('getDisposable', () => {
    it('dispose() on returned disposable cancels the task', () => {
      scheduler.schedule('task1', { handler: () => {}, intervalMs: 60000 });
      const disposable = scheduler.getDisposable('task1');
      disposable.dispose();
      expect(scheduler.getTask('task1')).toBeUndefined();
    });
  });

  // --- destroy ---

  describe('destroy', () => {
    it('cancels all tasks on destroy', () => {
      scheduler.schedule('a', { handler: () => {}, intervalMs: 60000 });
      scheduler.schedule('b', { handler: () => {}, intervalMs: 60000 });
      scheduler.destroy();
      expect(scheduler.list()).toHaveLength(0);
    });

    it('no handlers execute after destroy', async () => {
      const calls: number[] = [];
      scheduler.schedule('task1', { handler: () => { calls.push(1); }, intervalMs: 20 });
      scheduler.destroy();
      await new Promise((r) => setTimeout(r, 60));
      expect(calls).toHaveLength(0);
    });

    it('schedule throws after destroy', () => {
      scheduler.destroy();
      expect(() =>
        scheduler.schedule('new-task', { handler: () => {}, intervalMs: 1000 })
      ).toThrow('Scheduler has been destroyed');
    });
  });
});
