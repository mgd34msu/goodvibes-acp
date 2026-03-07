/**
 * @module plugins/project/test
 * @layer L3 — plugin
 *
 * Test file discovery and coverage estimation.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, extname, relative, basename } from 'node:path';
import type { TestFile, TestCoverage, TestFramework } from './types.js';
import type { ITextFileAccess } from '../../types/registry.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Patterns that identify test files */
const TEST_FILE_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\/.*\.[jt]sx?$/,
  /\.e2e\.[jt]sx?$/,
  /\.test\.bun\.[jt]sx?$/,
];

/** Check if a file path looks like a test file */
function isTestFile(filePath: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filePath));
}

/** Recursively collect all TS/JS files */
async function collectAllFiles(
  dir: string,
  maxDepth = 8,
  currentDepth = 0,
): Promise<string[]> {
  if (currentDepth > maxDepth) return [];
  const results: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectAllFiles(fullPath, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else {
      const ext = extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/** Count test-like function calls in file content */
function estimateTestCount(content: string): number {
  const itMatches = content.match(/\b(?:it|test)\s*\(/g);
  return itMatches?.length ?? 0;
}

/** Extract describe/suite names from file content */
function extractSuites(content: string): string[] {
  const suites: string[] = [];
  const describePattern = /\bdescribe\s*\(\s*['"](.*?)['"]\s*,/g;
  let match;
  while ((match = describePattern.exec(content)) !== null) {
    suites.push(match[1]);
  }
  return suites;
}

// ---------------------------------------------------------------------------
// TestAnalyzer
// ---------------------------------------------------------------------------

export class TestAnalyzer {
  // ISS-121: Optional ITextFileAccess for ACP-compliant file reads.
  // When provided, text file reads use the ACP interface (editor buffer aware).
  // readdir remains as direct fs — no ACP equivalent exists for directory listing.
  private readonly _fs?: ITextFileAccess;

  constructor(fs?: ITextFileAccess) {
    this._fs = fs;
  }

  /**
   * Discover all test files under the project root.
   * Never throws — returns empty array on errors.
   */
  async findTests(projectRoot: string): Promise<TestFile[]> {
    const allFiles = await collectAllFiles(projectRoot);
    const testFiles = allFiles.filter(isTestFile);

    const results = await Promise.all(
      testFiles.map(async (filePath): Promise<TestFile> => {
        const framework = await this.detectFramework(filePath);
        let testCount: number | undefined;
        let suites: string[] | undefined;

        try {
          const content = this._fs
            ? await this._fs.readTextFile(filePath)
            : await readFile(filePath, 'utf-8');
          testCount = estimateTestCount(content);
          const extractedSuites = extractSuites(content);
          if (extractedSuites.length > 0) {
            suites = extractedSuites;
          }
        } catch {
          // Can't read file — leave counts undefined
        }

        return {
          path: relative(projectRoot, filePath),
          framework,
          testCount,
          suites,
        };
      }),
    );

    return results;
  }

  /**
   * Detect the test framework used in a file by inspecting its imports.
   * Defaults to 'vitest' when framework is ambiguous.
   */
  async detectFramework(filePath: string): Promise<TestFramework> {
    try {
      const content = this._fs
        ? await this._fs.readTextFile(filePath)
        : await readFile(filePath, 'utf-8');

      if (/from\s+['"]\.?\/?playwright/.test(content) || /@playwright\/test/.test(content)) {
        return 'playwright';
      }
      if (/from\s+['"]\.?\/?vitest['"]/i.test(content) || /import.*vitest/i.test(content)) {
        return 'vitest';
      }
      if (/from\s+['"]\.?\/?jest/.test(content) || /@jest\//.test(content)) {
        return 'jest';
      }
      if (
        basename(filePath).includes('.bun.') ||
        /bun:test/.test(content) ||
        /from\s+['"]bun['"]/.test(content)
      ) {
        return 'bun';
      }

      // Check package.json in same tree for framework hints
      // Default to vitest for TS-heavy projects
      return 'vitest';
    } catch {
      return 'vitest';
    }
  }

  /**
   * Estimate test coverage by comparing source files to test files.
   * Uses a name-based heuristic (e.g. foo.ts → foo.test.ts).
   */
  async estimateCoverage(projectRoot: string): Promise<TestCoverage> {
    const allFiles = await collectAllFiles(projectRoot);
    const sourceFiles = allFiles.filter((f) => !isTestFile(f));
    const testFiles = allFiles.filter(isTestFile);

    // Build a set of base names that have tests
    const testedBases = new Set<string>();
    for (const testFile of testFiles) {
      const base = basename(testFile)
        .replace(/\.test\.[jt]sx?$/, '')
        .replace(/\.spec\.[jt]sx?$/, '')
        .replace(/\.e2e\.[jt]sx?$/, '');
      testedBases.add(base);
    }

    const uncoveredFiles: string[] = [];
    let covered = 0;

    for (const src of sourceFiles) {
      const base = basename(src).replace(/\.[jt]sx?$/, '');
      if (testedBases.has(base)) {
        covered++;
      } else {
        uncoveredFiles.push(relative(projectRoot, src));
      }
    }

    const total = sourceFiles.length;
    const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;

    return {
      total,
      covered,
      percentage,
      uncoveredFiles,
    };
  }
}
