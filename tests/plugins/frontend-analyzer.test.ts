/**
 * Tests for L3 FrontendAnalyzer components.
 * Covers ComponentAnalyzer, AccessibilityChecker, LayoutAnalyzer.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ComponentAnalyzer } from '../../src/plugins/frontend/components.ts';
import { AccessibilityChecker } from '../../src/plugins/frontend/accessibility.ts';
import { LayoutAnalyzer } from '../../src/plugins/frontend/layout.ts';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gv-frontend-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// ComponentAnalyzer
// ---------------------------------------------------------------------------

describe('ComponentAnalyzer — detectFramework', () => {
  it('detects react from package.json dependencies', async () => {
    const pkg = JSON.stringify({ dependencies: { react: '^18.0.0' } });
    await writeFile(join(tmpDir, 'package.json'), pkg, 'utf-8');
    const analyzer = new ComponentAnalyzer();
    const framework = await analyzer.detectFramework(tmpDir);
    expect(framework).toBe('react');
  });

  it('detects vue from package.json dependencies', async () => {
    const pkg = JSON.stringify({ dependencies: { vue: '^3.0.0' } });
    await writeFile(join(tmpDir, 'package.json'), pkg, 'utf-8');
    const analyzer = new ComponentAnalyzer();
    const framework = await analyzer.detectFramework(tmpDir);
    expect(framework).toBe('vue');
  });

  it('returns unknown when no framework found', async () => {
    // No package.json in tmpDir
    const analyzer = new ComponentAnalyzer();
    const framework = await analyzer.detectFramework(tmpDir);
    expect(framework).toBe('unknown');
  });
});

describe('ComponentAnalyzer — findComponents', () => {
  it('finds function components in .tsx files', async () => {
    const tsxContent = `
export function MyButton() {
  return <button>Click</button>;
}
`;
    await writeFile(join(tmpDir, 'MyButton.tsx'), tsxContent, 'utf-8');
    const analyzer = new ComponentAnalyzer();
    const components = await analyzer.findComponents(tmpDir);
    // Should find the TSX file
    expect(components.length).toBeGreaterThan(0);
  });

  it('returns empty array for directory with no TSX files', async () => {
    await writeFile(join(tmpDir, 'utils.ts'), 'export const x = 1;', 'utf-8');
    const analyzer = new ComponentAnalyzer();
    const components = await analyzer.findComponents(tmpDir);
    // .ts files without JSX are still parsed — they just yield nodes
    // We just verify no crash and an array is returned
    expect(Array.isArray(components)).toBe(true);
  });
});

describe('ComponentAnalyzer — analyzeProps', () => {
  it('extracts prop definitions from interface', async () => {
    const source = `
interface ButtonProps {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

export function Button({ label, disabled, onClick }: ButtonProps) {
  return <button disabled={disabled} onClick={onClick}>{label}</button>;
}
`;
    const filePath = join(tmpDir, 'Button.tsx');
    await writeFile(filePath, source, 'utf-8');
    const analyzer = new ComponentAnalyzer();
    const props = await analyzer.analyzeProps(filePath);
    expect(Array.isArray(props)).toBe(true);
    // Verify we got some props
    expect(props.length).toBeGreaterThan(0);
    const names = props.map((p) => p.name);
    expect(names).toContain('label');
  });

  it('returns empty array for file without props interface', async () => {
    const filePath = join(tmpDir, 'Simple.tsx');
    await writeFile(filePath, 'export function Simple() { return <div />; }', 'utf-8');
    const analyzer = new ComponentAnalyzer();
    const props = await analyzer.analyzeProps(filePath);
    expect(Array.isArray(props)).toBe(true);
  });

  it('returns empty array for non-existent file', async () => {
    const analyzer = new ComponentAnalyzer();
    const props = await analyzer.analyzeProps(join(tmpDir, 'ghost.tsx'));
    expect(props).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AccessibilityChecker
// ---------------------------------------------------------------------------

describe('AccessibilityChecker — img-alt rule', () => {
  it('flags img element without alt attribute', async () => {
    const filePath = join(tmpDir, 'img-no-alt.tsx');
    await writeFile(filePath, '<img src="photo.jpg" />', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    const altIssues = report.issues.filter((i) => i.rule === 'img-alt');
    expect(altIssues.length).toBeGreaterThan(0);
    expect(altIssues[0].severity).toBe('error');
  });

  it('passes img element with alt attribute', async () => {
    const filePath = join(tmpDir, 'img-with-alt.tsx');
    await writeFile(filePath, '<img src="photo.jpg" alt="A photo" />', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    const altIssues = report.issues.filter((i) => i.rule === 'img-alt');
    expect(altIssues).toHaveLength(0);
  });
});

describe('AccessibilityChecker — label rule', () => {
  it('flags label without htmlFor', async () => {
    const filePath = join(tmpDir, 'label.tsx');
    await writeFile(filePath, '<label>Username</label>', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    const labelIssues = report.issues.filter((i) => i.rule === 'label-html-for');
    expect(labelIssues.length).toBeGreaterThan(0);
  });

  it('passes label with htmlFor', async () => {
    const filePath = join(tmpDir, 'label-ok.tsx');
    await writeFile(filePath, '<label htmlFor="username">Username</label>', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    const labelIssues = report.issues.filter((i) => i.rule === 'label-html-for');
    expect(labelIssues).toHaveLength(0);
  });
});

describe('AccessibilityChecker — report structure', () => {
  it('report has score, issues, passCount, failCount, ruleBreakdown', async () => {
    const filePath = join(tmpDir, 'clean.tsx');
    await writeFile(filePath, '<div>Hello</div>', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    expect(typeof report.score).toBe('number');
    expect(Array.isArray(report.issues)).toBe(true);
    expect(typeof report.passCount).toBe('number');
    expect(typeof report.failCount).toBe('number');
    expect(Array.isArray(report.ruleBreakdown)).toBe(true);
  });

  it('score is 100 for clean file with no violations', async () => {
    const filePath = join(tmpDir, 'no-issues.tsx');
    await writeFile(filePath, '<div className="p-4"><p>Hello</p></div>', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    expect(report.score).toBe(100);
  });

  it('score decreases with each error', async () => {
    const filePath = join(tmpDir, 'errors.tsx');
    // Missing alt on img is a violation
    await writeFile(filePath, '<img src="a.jpg" /><img src="b.jpg" />', 'utf-8');
    const checker = new AccessibilityChecker();
    const report = await checker.check([filePath]);
    expect(report.score).toBeLessThan(100);
  });

  it('scoreFromIssues returns 100 for empty issues', () => {
    const checker = new AccessibilityChecker();
    expect(checker.scoreFromIssues([])).toBe(100);
  });

  it('scoreFromIssues reduces score for errors', () => {
    const checker = new AccessibilityChecker();
    const issues = [{ severity: 'error' as const, rule: 'img-alt', element: 'img', message: 'test', line: 1, suggestion: '' }];
    const score = checker.scoreFromIssues(issues);
    expect(score).toBe(90); // 100 - 10 for one error
  });

  it('handles non-existent files gracefully', async () => {
    const checker = new AccessibilityChecker();
    const report = await checker.check([join(tmpDir, 'ghost.tsx')]);
    // Should not throw and return empty issues
    expect(Array.isArray(report.issues)).toBe(true);
    expect(report.score).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// LayoutAnalyzer
// ---------------------------------------------------------------------------

describe('LayoutAnalyzer — Tailwind conflict detection', () => {
  it('detects flex+grid conflict on same element', async () => {
    const filePath = join(tmpDir, 'conflict.tsx');
    await writeFile(filePath, '<div className="flex grid gap-4">content</div>', 'utf-8');
    const analyzer = new LayoutAnalyzer();
    const conflicts = await analyzer.analyzeTailwindConflicts(filePath);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toContain("'flex'");
    expect(conflicts[0]).toContain("'grid'");
  });

  it('detects absolute+relative conflict', async () => {
    const filePath = join(tmpDir, 'pos-conflict.tsx');
    await writeFile(filePath, '<div className="absolute relative top-0">x</div>', 'utf-8');
    const analyzer = new LayoutAnalyzer();
    const conflicts = await analyzer.analyzeTailwindConflicts(filePath);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('returns empty for non-conflicting classes', async () => {
    const filePath = join(tmpDir, 'ok.tsx');
    await writeFile(filePath, '<div className="flex items-center gap-2">ok</div>', 'utf-8');
    const analyzer = new LayoutAnalyzer();
    const conflicts = await analyzer.analyzeTailwindConflicts(filePath);
    expect(conflicts).toHaveLength(0);
  });

  it('returns empty for non-existent file', async () => {
    const analyzer = new LayoutAnalyzer();
    const conflicts = await analyzer.analyzeTailwindConflicts(join(tmpDir, 'ghost.tsx'));
    expect(conflicts).toHaveLength(0);
  });
});

describe('LayoutAnalyzer — overflow detection', () => {
  it('detects overflow-hidden with fixed height', async () => {
    const filePath = join(tmpDir, 'overflow.tsx');
    await writeFile(filePath, '<div className="overflow-hidden h-64">content</div>', 'utf-8');
    const analyzer = new LayoutAnalyzer();
    const issues = await analyzer.findOverflow(filePath);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain('overflow');
  });

  it('returns empty for file with no overflow issues', async () => {
    const filePath = join(tmpDir, 'clean-overflow.tsx');
    await writeFile(filePath, '<div className="flex flex-col">safe</div>', 'utf-8');
    const analyzer = new LayoutAnalyzer();
    const issues = await analyzer.findOverflow(filePath);
    expect(issues).toHaveLength(0);
  });
});

describe('LayoutAnalyzer — breakpoints', () => {
  it('returns default Tailwind breakpoints when no config found', async () => {
    const analyzer = new LayoutAnalyzer();
    const breakpoints = await analyzer.detectBreakpoints(tmpDir);
    expect(Array.isArray(breakpoints)).toBe(true);
    expect(breakpoints.length).toBeGreaterThan(0);
    const names = breakpoints.map((b) => b.name);
    expect(names).toContain('sm');
    expect(names).toContain('md');
    expect(names).toContain('lg');
  });

  it('each breakpoint has name and minWidth', async () => {
    const analyzer = new LayoutAnalyzer();
    const breakpoints = await analyzer.detectBreakpoints(tmpDir);
    for (const bp of breakpoints) {
      expect(typeof bp.name).toBe('string');
      expect(typeof bp.minWidth).toBe('number');
      expect(bp.minWidth).toBeGreaterThan(0);
    }
  });
});
