import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '../../src/core/event-bus.js';
import { DirectiveQueue } from '../../src/extensions/directives/queue.js';
import { WRFCHandlers } from '../../src/extensions/wrfc/handlers.js';

function makeStack() {
  const bus = new EventBus();
  const queue = new DirectiveQueue(bus);
  const handlers = new WRFCHandlers(bus, queue);
  return { bus, queue, handlers };
}

describe('WRFCHandlers', () => {
  let bus: EventBus;
  let queue: DirectiveQueue;
  let handlers: WRFCHandlers;

  beforeEach(() => {
    ({ bus, queue, handlers } = makeStack());
  });

  // ---------------------------------------------------------------------------
  // register / unregister
  // ---------------------------------------------------------------------------

  describe('register / unregister', () => {
    it('register() is idempotent — calling twice does not double-subscribe', () => {
      handlers.register();
      handlers.register(); // second call should be a no-op

      const notifications: unknown[] = [];
      bus.on('wrfc:phase-changed', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:state-changed', { workId: 'w1', sessionId: 's1', from: 'idle', to: 'working', attempt: 1 });

      expect(notifications).toHaveLength(1);
    });

    it('unregister() stops handler from responding to events', () => {
      handlers.register();
      handlers.unregister();

      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:work-complete', { workId: 'w2', sessionId: 's2', filesModified: [] });

      expect(notifications).toHaveLength(0);
    });

    it('unregister() is a no-op when not registered', () => {
      expect(() => handlers.unregister()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // wrfc:state-changed → wrfc:phase-changed
  // ---------------------------------------------------------------------------

  describe('wrfc:state-changed', () => {
    it('emits wrfc:phase-changed with matching fields', () => {
      handlers.register();

      const phaseChanges: unknown[] = [];
      bus.on('wrfc:phase-changed', (ev) => phaseChanges.push(ev.payload));

      bus.emit('wrfc:state-changed', {
        workId: 'w3',
        sessionId: 's3',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });

      expect(phaseChanges).toHaveLength(1);
      expect(phaseChanges[0]).toMatchObject({
        workId: 'w3',
        sessionId: 's3',
        from: 'idle',
        to: 'working',
        attempt: 1,
      });
    });

    it('emitted phase-changed payload includes a timestamp', () => {
      handlers.register();
      const events: unknown[] = [];
      bus.on('wrfc:phase-changed', (ev) => events.push(ev.payload));
      bus.emit('wrfc:state-changed', { workId: 'w', sessionId: 's', from: 'idle', to: 'working', attempt: 0 });
      expect((events[0] as { timestamp: unknown }).timestamp).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // wrfc:work-complete
  // ---------------------------------------------------------------------------

  describe('wrfc:work-complete', () => {
    it('emits wrfc:notification with phase=work', () => {
      handlers.register();

      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:work-complete', {
        workId: 'w4',
        sessionId: 's4',
        filesModified: ['a.ts', 'b.ts'],
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({ phase: 'work', workId: 'w4' });
      const msg = (notifications[0] as { message: string }).message;
      expect(msg).toContain('2 file(s) modified');
    });

    it('enqueues a review directive by default (autoEnqueueReview=true)', () => {
      handlers.register();

      bus.emit('wrfc:work-complete', {
        workId: 'w5',
        sessionId: 's5',
        filesModified: ['x.ts'],
      });

      const directives = queue.drain();
      expect(directives).toHaveLength(1);
      expect(directives[0].action).toBe('review');
      expect(directives[0].workId).toBe('w5');
      expect(directives[0].priority).toBe('high');
    });

    it('does NOT enqueue review directive when autoEnqueueReview=false', () => {
      const { bus: b, queue: q } = makeStack();
      const h = new WRFCHandlers(b, q, { autoEnqueueReview: false });
      h.register();

      b.emit('wrfc:work-complete', { workId: 'w6', sessionId: 's6', filesModified: [] });

      expect(q.size()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // wrfc:review-complete
  // ---------------------------------------------------------------------------

  describe('wrfc:review-complete', () => {
    it('emits wrfc:notification with phase=review and score in message', () => {
      handlers.register();

      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:review-complete', { workId: 'rw1', sessionId: 'rs1', score: 8.7, passed: true });

      expect(notifications).toHaveLength(1);
      const n = notifications[0] as { phase: string; message: string };
      expect(n.phase).toBe('review');
      expect(n.message).toContain('8.7');
      expect(n.message).toContain('PASSED');
    });

    it('enqueues a fix directive when review fails (passed=false)', () => {
      handlers.register();

      bus.emit('wrfc:review-complete', { workId: 'rw2', sessionId: 'rs2', score: 4.0, passed: false });

      const directives = queue.drain();
      expect(directives).toHaveLength(1);
      expect(directives[0].action).toBe('fix');
      expect(directives[0].workId).toBe('rw2');
      expect(directives[0].priority).toBe('high');
    });

    it('does NOT enqueue fix directive when review passes', () => {
      handlers.register();

      bus.emit('wrfc:review-complete', { workId: 'rw3', sessionId: 'rs3', score: 9.5, passed: true });

      expect(queue.size()).toBe(0);
    });

    it('does NOT enqueue fix directive when autoEnqueueFix=false even on failure', () => {
      const { bus: b, queue: q } = makeStack();
      const h = new WRFCHandlers(b, q, { autoEnqueueFix: false });
      h.register();

      b.emit('wrfc:review-complete', { workId: 'rw4', sessionId: 'rs4', score: 1.0, passed: false });

      expect(q.size()).toBe(0);
    });

    it('shows FAILED in notification message when review fails', () => {
      handlers.register();
      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:review-complete', { workId: 'rw5', sessionId: 'rs5', score: 3.0, passed: false });

      const msg = (notifications[0] as { message: string }).message;
      expect(msg).toContain('FAILED');
    });
  });

  // ---------------------------------------------------------------------------
  // wrfc:fix-complete
  // ---------------------------------------------------------------------------

  describe('wrfc:fix-complete', () => {
    it('emits wrfc:notification with phase=fix', () => {
      handlers.register();

      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:fix-complete', { workId: 'fw1', sessionId: 'fs1', resolvedIssues: ['iss-1', 'iss-2'] });

      expect(notifications).toHaveLength(1);
      const n = notifications[0] as { phase: string; message: string };
      expect(n.phase).toBe('fix');
      expect(n.message).toContain('2 issue(s) resolved');
    });

    it('does not enqueue any directive for fix-complete', () => {
      handlers.register();
      bus.emit('wrfc:fix-complete', { workId: 'fw2', sessionId: 'fs2', resolvedIssues: [] });
      expect(queue.size()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // wrfc:chain-complete
  // ---------------------------------------------------------------------------

  describe('wrfc:chain-complete', () => {
    it('emits wrfc:notification with phase=chain', () => {
      handlers.register();

      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:chain-complete', { workId: 'cc1', sessionId: 'cs1', finalState: 'done', score: 9.2 });

      expect(notifications).toHaveLength(1);
      const n = notifications[0] as { phase: string; message: string };
      expect(n.phase).toBe('chain');
      expect(n.message).toContain('done');
      expect(n.message).toContain('9.2');
    });

    it('enqueues a complete directive', () => {
      handlers.register();

      bus.emit('wrfc:chain-complete', { workId: 'cc2', sessionId: 'cs2', finalState: 'done' });

      const directives = queue.drain();
      expect(directives).toHaveLength(1);
      expect(directives[0].action).toBe('complete');
      expect(directives[0].workId).toBe('cc2');
    });

    it('omits score from message when score is undefined', () => {
      handlers.register();
      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:chain-complete', { workId: 'cc3', sessionId: 'cs3', finalState: 'done' });

      const msg = (notifications[0] as { message: string }).message;
      expect(msg).not.toContain('Score:');
    });
  });

  // ---------------------------------------------------------------------------
  // wrfc:cancelled
  // ---------------------------------------------------------------------------

  describe('wrfc:cancelled', () => {
    it('emits wrfc:notification with phase=cancelled', () => {
      handlers.register();

      const notifications: unknown[] = [];
      bus.on('wrfc:notification', (ev) => notifications.push(ev.payload));

      bus.emit('wrfc:cancelled', { workId: 'can1', sessionId: 'cans1' });

      expect(notifications).toHaveLength(1);
      const n = notifications[0] as { phase: string; message: string };
      expect(n.phase).toBe('cancelled');
      expect(n.message).toContain('cancelled');
    });

    it('enqueues an escalate directive', () => {
      handlers.register();

      bus.emit('wrfc:cancelled', { workId: 'can2', sessionId: 'cans2' });

      const directives = queue.drain();
      expect(directives).toHaveLength(1);
      expect(directives[0].action).toBe('escalate');
      expect(directives[0].workId).toBe('can2');
      expect(directives[0].priority).toBe('high');
    });
  });
});
