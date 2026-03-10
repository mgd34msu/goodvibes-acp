/**
 * Tests for L3 review/review-tool-provider module.
 * Covers ReviewToolProvider: tool definition, execute dispatch,
 * reference validation (hallucination stripping), consumeReview, and reset.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { ReviewToolProvider } from '../../src/plugins/review/review-tool-provider.ts';
import type { ReviewIssue, SubmitReviewInput } from '../../src/plugins/review/types.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(severity: ReviewIssue['severity'], file = 'src/foo.ts'): ReviewIssue {
  return { severity, file, title: 'Test issue', description: 'Test description' };
}

function makeSubmitInput(overrides: Partial<SubmitReviewInput> = {}): SubmitReviewInput {
  return {
    summary: 'Review complete.',
    issues: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let provider: ReviewToolProvider;

beforeEach(() => {
  provider = new ReviewToolProvider();
});

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — identity', () => {
  it('has name "review"', () => {
    expect(provider.name).toBe('review');
  });
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — tools getter', () => {
  it('exposes exactly one tool', () => {
    expect(provider.tools).toHaveLength(1);
  });

  it('tool name is submit_review', () => {
    expect(provider.tools[0].name).toBe('submit_review');
  });

  it('tool has a non-empty description', () => {
    expect(typeof provider.tools[0].description).toBe('string');
    expect(provider.tools[0].description.length).toBeGreaterThan(0);
  });

  it('tool inputSchema requires issues and summary', () => {
    const schema = provider.tools[0].inputSchema as { required: string[] };
    expect(schema.required).toContain('issues');
    expect(schema.required).toContain('summary');
  });

  it('tool inputSchema is type object', () => {
    const schema = provider.tools[0].inputSchema as { type: string };
    expect(schema.type).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// execute — unknown tool
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — execute unknown tool', () => {
  it('returns success=false for an unknown tool name', async () => {
    const result = await provider.execute('nonexistent_tool', {});
    expect(result.success).toBe(false);
  });

  it('error message mentions the unknown tool name', async () => {
    const result = await provider.execute('some_other_tool', {});
    expect(result.error).toContain('some_other_tool');
  });

  it('does not store review state when unknown tool called', async () => {
    await provider.execute('nonexistent_tool', makeSubmitInput());
    expect(provider.consumeReview()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// execute — submit_review basic
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — submit_review basic', () => {
  it('returns success=true with no issues', async () => {
    const result = await provider.execute('submit_review', makeSubmitInput());
    expect(result.success).toBe(true);
  });

  it('result data contains issue count', async () => {
    const input = makeSubmitInput({ issues: [makeIssue('critical'), makeIssue('major')] });
    const result = await provider.execute<string>('submit_review', input);
    expect(result.data).toContain('2 issues');
  });

  it('result data contains severity counts in C/M/m/n format', async () => {
    const input = makeSubmitInput({
      issues: [
        makeIssue('critical'),
        makeIssue('critical'),
        makeIssue('major'),
        makeIssue('minor'),
        makeIssue('minor'),
        makeIssue('minor'),
        makeIssue('nitpick'),
      ],
    });
    const result = await provider.execute<string>('submit_review', input);
    expect(result.data).toContain('2C/1M/3m/1n');
  });

  it('result data for zero issues shows correct format', async () => {
    const result = await provider.execute<string>('submit_review', makeSubmitInput());
    expect(result.data).toContain('0 issues');
    expect(result.data).toContain('0C/0M/0m/0n');
  });

  it('stores the submitted review for consumeReview', async () => {
    const input = makeSubmitInput({ summary: 'All clear.', issues: [] });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed).not.toBeNull();
    expect(consumed!.summary).toBe('All clear.');
  });
});

// ---------------------------------------------------------------------------
// execute — reference validation
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — reference validation', () => {
  it('keeps references to files that were tracked as read', async () => {
    provider.trackFileRead('src/utils.ts');
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('major'),
        references: [{ file: 'src/utils.ts', note: 'See pattern here' }],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toHaveLength(1);
    expect(consumed!.issues[0].references![0].file).toBe('src/utils.ts');
  });

  it('strips references to files not tracked as read', async () => {
    // Do NOT track 'src/hallucinated.ts'
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('major'),
        references: [{ file: 'src/hallucinated.ts', note: 'Made up reference' }],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toBeUndefined();
  });

  it('keeps valid refs and strips hallucinated refs in the same issue', async () => {
    provider.trackFileRead('src/real.ts');
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('critical'),
        references: [
          { file: 'src/real.ts', note: 'Valid reference' },
          { file: 'src/fake.ts', note: 'Hallucinated reference' },
        ],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toHaveLength(1);
    expect(consumed!.issues[0].references![0].file).toBe('src/real.ts');
  });

  it('result data mentions stripped reference count when references stripped', async () => {
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('minor'),
        references: [{ file: 'src/fake.ts', note: 'Hallucinated' }],
      }],
    });
    const result = await provider.execute<string>('submit_review', input);
    expect(result.data).toContain('1 hallucinated reference(s) stripped');
  });

  it('does not mention stripped references when none are stripped', async () => {
    provider.trackFileRead('src/real.ts');
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('minor'),
        references: [{ file: 'src/real.ts', note: 'Valid' }],
      }],
    });
    const result = await provider.execute<string>('submit_review', input);
    expect(result.data).not.toContain('stripped');
  });

  it('issue with no references is unaffected', async () => {
    const input = makeSubmitInput({ issues: [makeIssue('minor')] });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toBeUndefined();
  });

  it('issue with empty references array is unaffected', async () => {
    const input = makeSubmitInput({
      issues: [{ ...makeIssue('minor'), references: [] }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    // Empty array treated as no references — not stripped (loop skipped)
    expect(consumed!.issues[0].references).toEqual([]);
  });

  it('strips refs count accumulates across multiple issues', async () => {
    provider.trackFileRead('src/real.ts');
    const input = makeSubmitInput({
      issues: [
        {
          ...makeIssue('major'),
          references: [{ file: 'src/fake1.ts', note: 'Hallucinated' }],
        },
        {
          ...makeIssue('minor'),
          references: [{ file: 'src/fake2.ts', note: 'Also hallucinated' }],
        },
      ],
    });
    const result = await provider.execute<string>('submit_review', input);
    expect(result.data).toContain('2 hallucinated reference(s) stripped');
  });
});

// ---------------------------------------------------------------------------
// consumeReview
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — consumeReview', () => {
  it('returns null before any review is submitted', () => {
    expect(provider.consumeReview()).toBeNull();
  });

  it('returns the submitted review after submit_review call', async () => {
    const input = makeSubmitInput({ summary: 'Done.' });
    await provider.execute('submit_review', input);
    const result = provider.consumeReview();
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Done.');
  });

  it('clears internal review after consume (returns null on second call)', async () => {
    await provider.execute('submit_review', makeSubmitInput());
    provider.consumeReview(); // first call consumes it
    expect(provider.consumeReview()).toBeNull(); // second call returns null
  });

  it('multiple submits: last one wins', async () => {
    await provider.execute('submit_review', makeSubmitInput({ summary: 'First.' }));
    await provider.execute('submit_review', makeSubmitInput({ summary: 'Second.' }));
    const result = provider.consumeReview();
    expect(result!.summary).toBe('Second.');
  });
});

// ---------------------------------------------------------------------------
// trackFileRead and reset
// ---------------------------------------------------------------------------

describe('ReviewToolProvider — trackFileRead', () => {
  it('tracking a file makes it valid for references', async () => {
    provider.trackFileRead('src/service.ts');
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('major'),
        references: [{ file: 'src/service.ts', note: 'Example' }],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toHaveLength(1);
  });

  it('tracking same file multiple times is idempotent', async () => {
    provider.trackFileRead('src/service.ts');
    provider.trackFileRead('src/service.ts');
    provider.trackFileRead('src/service.ts');
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('minor'),
        references: [{ file: 'src/service.ts', note: 'Example' }],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toHaveLength(1);
  });
});

describe('ReviewToolProvider — reset', () => {
  it('reset clears stored review (consumeReview returns null)', async () => {
    await provider.execute('submit_review', makeSubmitInput());
    provider.reset();
    expect(provider.consumeReview()).toBeNull();
  });

  it('reset clears tracked files (previously tracked file no longer valid for references)', async () => {
    provider.trackFileRead('src/service.ts');
    provider.reset();
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('major'),
        references: [{ file: 'src/service.ts', note: 'Should be stripped now' }],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toBeUndefined();
  });

  it('reset is safe to call on fresh provider', () => {
    expect(() => provider.reset()).not.toThrow();
    expect(provider.consumeReview()).toBeNull();
  });

  it('reset is idempotent (multiple resets do not throw)', () => {
    provider.reset();
    provider.reset();
    provider.reset();
    expect(provider.consumeReview()).toBeNull();
  });

  it('after reset, new session tracking works correctly', async () => {
    provider.trackFileRead('src/old.ts');
    provider.reset();
    provider.trackFileRead('src/new.ts');
    const input = makeSubmitInput({
      issues: [{
        ...makeIssue('minor'),
        references: [
          { file: 'src/old.ts', note: 'Old ref should be stripped' },
          { file: 'src/new.ts', note: 'New ref should be kept' },
        ],
      }],
    });
    await provider.execute('submit_review', input);
    const consumed = provider.consumeReview();
    expect(consumed!.issues[0].references).toHaveLength(1);
    expect(consumed!.issues[0].references![0].file).toBe('src/new.ts');
  });
});
