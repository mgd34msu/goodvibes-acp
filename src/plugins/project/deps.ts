/**
 * @module plugins/project/deps
 * @layer L3 — plugin
 *
 * Dependency analysis — reads package.json, detects circular imports,
 * finds unused dependencies, and checks for outdated packages.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve, extname, dirname } from 'node:path';
import type { Dependency, DepsAnalysis } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read and parse a JSON file, returning null on any error */
async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const text = await readFile(filePath, 'utf-8');
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Recursively collect TS/JS files under a directory, up to a depth limit */
async function collectSourceFiles(
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
      const sub = await collectSourceFiles(fullPath, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else {
      const ext = extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/** Extract static import specifiers from a source file */
async function extractImports(filePath: string): Promise<string[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const imports: string[] = [];
    // Match: import ... from 'specifier' / import('specifier') / require('specifier')
    const patterns = [
      /(?:import|export)\s+(?:[^'"]*\s+from\s+)?['"]([@\w][^'"]*)['"]\s*;?/g,
      /(?:import|require)\s*\(\s*['"]([@\w][^'"]*)['"]\s*\)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }
    return imports;
  } catch {
    return [];
  }
}

/** Extract the package name from an import specifier (handles scoped packages) */
function extractPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

// ---------------------------------------------------------------------------
// DependencyAnalyzer
// ---------------------------------------------------------------------------

export class DependencyAnalyzer {
  /**
   * Reads package.json, detects circular imports, unused deps, and outdated packages.
   * Never throws — returns partial results with empty arrays on errors.
   */
  async analyze(projectRoot: string): Promise<DepsAnalysis> {
    const pkgPath = join(projectRoot, 'package.json');
    const pkg = await readJson(pkgPath);

    const dependencies: Dependency[] = [];
    const devDependencies: Dependency[] = [];

    if (pkg) {
      const rawDeps = (pkg['dependencies'] ?? {}) as Record<string, string>;
      const rawDev = (pkg['devDependencies'] ?? {}) as Record<string, string>;
      const rawPeer = (pkg['peerDependencies'] ?? {}) as Record<string, string>;

      for (const [name, version] of Object.entries(rawDeps)) {
        dependencies.push({ name, version, type: 'prod' });
      }
      for (const [name, version] of Object.entries(rawDev)) {
        devDependencies.push({ name, version, type: 'dev' });
      }
      for (const [name, version] of Object.entries(rawPeer)) {
        dependencies.push({ name, version, type: 'peer' });
      }
    }

    const [circular, unused] = await Promise.all([
      this.findCircular(projectRoot),
      this.findUnused(projectRoot),
    ]);

    return {
      dependencies,
      devDependencies,
      circular,
      unused,
      outdated: [],
    };
  }

  /**
   * Detect circular import cycles by building an import graph from TS/JS files
   * and running DFS cycle detection.
   * Returns arrays of file paths forming cycles.
   */
  async findCircular(projectRoot: string): Promise<string[][]> {
    const sourceRoot = join(projectRoot, 'src');
    let files: string[];
    try {
      await stat(sourceRoot);
      files = await collectSourceFiles(sourceRoot);
    } catch {
      files = await collectSourceFiles(projectRoot);
    }

    // Build adjacency map: file -> set of imported files (resolved to absolute)
    const graph = new Map<string, Set<string>>();

    await Promise.all(
      files.map(async (file) => {
        const imports = await extractImports(file);
        const neighbors = new Set<string>();
        for (const imp of imports) {
          // Only track relative imports (package imports can't be circular within project)
          if (!imp.startsWith('.')) continue;
          const fileDir = dirname(file);
          const resolved = resolve(fileDir, imp);
          // Try with and without extensions
          for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
            const candidate = resolved + ext;
            if (files.includes(candidate)) {
              neighbors.add(candidate);
              break;
            }
          }
        }
        graph.set(file, neighbors);
      }),
    );

    // DFS cycle detection
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      inStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (inStack.has(neighbor)) {
          // Found cycle — extract the cycle path
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), neighbor]);
          }
        }
      }

      path.pop();
      inStack.delete(node);
    };

    for (const file of files) {
      if (!visited.has(file)) {
        dfs(file);
      }
    }

    return cycles;
  }

  /**
   * Find packages declared in package.json but never imported in source files.
   */
  async findUnused(projectRoot: string): Promise<string[]> {
    const pkgPath = join(projectRoot, 'package.json');
    const pkg = await readJson(pkgPath);
    if (!pkg) return [];

    const rawDeps = (pkg['dependencies'] ?? {}) as Record<string, string>;
    const declared = new Set(Object.keys(rawDeps));
    if (declared.size === 0) return [];

    const sourceRoot = join(projectRoot, 'src');
    let files: string[];
    try {
      await stat(sourceRoot);
      files = await collectSourceFiles(sourceRoot);
    } catch {
      files = await collectSourceFiles(projectRoot);
    }

    const usedPackages = new Set<string>();
    await Promise.all(
      files.map(async (file) => {
        const imports = await extractImports(file);
        for (const imp of imports) {
          if (imp.startsWith('.')) continue;
          usedPackages.add(extractPackageName(imp));
        }
      }),
    );

    const unused: string[] = [];
    for (const name of declared) {
      if (!usedPackages.has(name)) {
        unused.push(name);
      }
    }

    return unused.sort();
  }

  /**
   * Compare declared versions against installed versions in node_modules.
   * Returns dependencies where a newer version appears to be installed.
   */
  async checkOutdated(projectRoot: string): Promise<Dependency[]> {
    const pkgPath = join(projectRoot, 'package.json');
    const pkg = await readJson(pkgPath);
    if (!pkg) return [];

    const rawDeps = (pkg['dependencies'] ?? {}) as Record<string, string>;
    const rawDev = (pkg['devDependencies'] ?? {}) as Record<string, string>;
    const allDeps: Array<{ name: string; version: string; type: 'prod' | 'dev' }> = [];

    for (const [name, version] of Object.entries(rawDeps)) {
      allDeps.push({ name, version, type: 'prod' });
    }
    for (const [name, version] of Object.entries(rawDev)) {
      allDeps.push({ name, version, type: 'dev' });
    }

    const outdated: Dependency[] = [];

    await Promise.all(
      allDeps.map(async ({ name, version, type }) => {
        try {
          const installedPkgPath = join(projectRoot, 'node_modules', name, 'package.json');
          const installed = await readJson(installedPkgPath);
          if (!installed) return;

          const installedVersion = String(installed['version'] ?? '');
          const declaredClean = version.replace(/^[^\d]*/, '');

          if (installedVersion !== declaredClean && installedVersion) {
            outdated.push({
              name,
              version,
              type,
              resolved: installedVersion,
              outdated: true,
              latestVersion: installedVersion,
            });
          }
        } catch {
          // Package not installed — skip
        }
      }),
    );

    return outdated;
  }
}
