/**
 * @module plugins/frontend/components
 * @layer L3 — plugin
 *
 * ComponentAnalyzer: static analysis of JSX/TSX component files.
 * Uses regex-based parsing — no AST dependency required.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import type { ComponentNode, ComponentTree, PropInfo } from './types.js';

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/** Matches: function ComponentName( or function ComponentName<T>( */
const FUNCTION_COMPONENT_RE = /^\s*(?:export\s+)?(?:default\s+)?function\s+([A-Z][\w]*)\s*[<(]/gm;

/** Matches: const ComponentName = ( or const ComponentName: React.FC = ( */
const ARROW_COMPONENT_RE = /^\s*(?:export\s+)?(?:const|let)\s+([A-Z][\w]*)\s*(?::[^=]+)?=\s*(?:React\.memo\()?\s*(?:<[^>]*>\s*)?\(/gm;

/** Matches: export default function( or export default ( */
const DEFAULT_EXPORT_RE = /^\s*export\s+default\s+function\s+([A-Z][\w]*)?\s*[<(]/gm;

/** Matches JSX elements: <ComponentName or <componentName */
const JSX_ELEMENT_RE = /<([A-Z][\w.]*)/g;

/** Matches 'use client' directive */
const USE_CLIENT_RE = /^['"]use client['"]/m;

/** Matches interface/type Props definitions */
const PROPS_TYPE_RE = /(?:interface|type)\s+(?:[A-Z]\w*)?Props(?:<[^>]*>)?\s*(?:extends[^{]*)?\{([^}]+)\}/gs;

/** Matches a prop line: propName?: type or propName: type */
const PROP_LINE_RE = /^\s*(?:\/\/[^\n]*\n)?\s*(?:readonly\s+)?(\w+)(\??):\s*([^;\n,}]+)/;

// ---------------------------------------------------------------------------
// ComponentAnalyzer
// ---------------------------------------------------------------------------

/** Static component analysis via regex parsing of JSX/TSX source */
export class ComponentAnalyzer {
  /**
   * Build a component tree starting from an entry file.
   * Parses JSX references recursively (single-level — children are by name only).
   */
  async buildTree(entryPath: string): Promise<ComponentTree> {
    const abs = resolve(entryPath);
    const root = await this._parseComponent(abs);
    const total = this._countNodes(root);
    const depth = this._maxDepth(root);
    return { root, totalComponents: total, maxDepth: depth };
  }

  /**
   * Find all component definitions across a project directory.
   */
  async findComponents(projectRoot: string): Promise<ComponentNode[]> {
    const files = await this._findJsxFiles(resolve(projectRoot));
    const results: ComponentNode[] = [];
    for (const file of files) {
      try {
        const node = await this._parseComponent(file);
        results.push(node);
      } catch {
        // skip unreadable files
      }
    }
    return results;
  }

  /**
   * Extract prop types from a component file.
   */
  async analyzeProps(componentPath: string): Promise<PropInfo[]> {
    const abs = resolve(componentPath);
    try {
      const source = await readFile(abs, 'utf-8');
      return this._parseProps(source);
    } catch {
      return [];
    }
  }

  /**
   * Detect the frontend framework from package.json dependencies.
   */
  async detectFramework(
    projectRoot: string
  ): Promise<'react' | 'vue' | 'svelte' | 'astro' | 'unknown'> {
    try {
      const pkgPath = join(resolve(projectRoot), 'package.json');
      const raw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if ('astro' in deps) return 'astro';
      if ('svelte' in deps) return 'svelte';
      if ('vue' in deps) return 'vue';
      if ('react' in deps || 'react-dom' in deps) return 'react';
      if ('next' in deps || 'remix' in deps || '@remix-run/react' in deps) return 'react';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Find all files that contain a 'use client' directive.
   */
  async findClientBoundaries(projectRoot: string): Promise<string[]> {
    const files = await this._findJsxFiles(resolve(projectRoot));
    const boundaries: string[] = [];
    for (const file of files) {
      try {
        const source = await readFile(file, 'utf-8');
        if (USE_CLIENT_RE.test(source)) {
          boundaries.push(file);
        }
      } catch {
        // skip
      }
    }
    return boundaries;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Parse a single component file into a ComponentNode */
  private async _parseComponent(filePath: string): Promise<ComponentNode> {
    let source = '';
    try {
      source = await readFile(filePath, 'utf-8');
    } catch {
      return this._emptyNode(filePath);
    }

    const name = this._extractComponentName(source, filePath);
    const props = this._parseProps(source);
    const isClientComponent = USE_CLIENT_RE.test(source);
    const childNames = this._extractJsxChildren(source);

    // Build shallow children (name + path only, no recursion to avoid cycles)
    const children: ComponentNode[] = childNames.map((childName) => ({
      name: childName,
      path: filePath,
      line: 0,
      props: [],
      children: [],
    }));

    const line = this._findComponentLine(source, name);

    return {
      name,
      path: filePath,
      line,
      props,
      children,
      isClientComponent,
    };
  }

  /** Extract the primary component name from source */
  private _extractComponentName(source: string, filePath: string): string {
    // Try function declaration first
    FUNCTION_COMPONENT_RE.lastIndex = 0;
    const fnMatch = FUNCTION_COMPONENT_RE.exec(source);
    if (fnMatch?.[1]) return fnMatch[1];

    // Try arrow function
    ARROW_COMPONENT_RE.lastIndex = 0;
    const arrowMatch = ARROW_COMPONENT_RE.exec(source);
    if (arrowMatch?.[1]) return arrowMatch[1];

    // Try default export
    DEFAULT_EXPORT_RE.lastIndex = 0;
    const defaultMatch = DEFAULT_EXPORT_RE.exec(source);
    if (defaultMatch?.[1]) return defaultMatch[1];

    // Fallback: use filename without extension
    const base = filePath.split('/').pop() ?? 'Unknown';
    return base.replace(/\.(tsx?|jsx?)$/, '');
  }

  /** Find the line number where the component is defined */
  private _findComponentLine(source: string, name: string): number {
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line !== undefined && (line.includes(`function ${name}`) || line.includes(`const ${name}`))) {
        return i + 1;
      }
    }
    return 1;
  }

  /** Extract names of child components referenced in JSX */
  private _extractJsxChildren(source: string): string[] {
    const names = new Set<string>();
    JSX_ELEMENT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = JSX_ELEMENT_RE.exec(source)) !== null) {
      const name = match[1];
      if (name) names.add(name);
    }
    return Array.from(names);
  }

  /** Parse prop types from interface/type Props definitions */
  private _parseProps(source: string): PropInfo[] {
    const props: PropInfo[] = [];
    PROPS_TYPE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PROPS_TYPE_RE.exec(source)) !== null) {
      const body = match[1];
      if (!body) continue;
      const lines = body.split('\n');
      for (const line of lines) {
        const propMatch = PROP_LINE_RE.exec(line);
        if (!propMatch) continue;
        const [, name, optional, type] = propMatch;
        if (!name || !type) continue;
        // Skip index signatures
        if (name === 'readonly' || name.startsWith('[')) continue;
        props.push({
          name,
          type: type.trim(),
          required: optional !== '?',
        });
      }
    }
    return props;
  }

  /** Recursively find all JSX/TSX files under a directory */
  private async _findJsxFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const tasks: Promise<string[]>[] = [];
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip common non-source dirs
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === '.git' ||
            entry.name === '.next' ||
            entry.name === 'build'
          ) {
            continue;
          }
          tasks.push(this._findJsxFiles(full));
        } else if (
          entry.isFile() &&
          ['.tsx', '.jsx', '.ts', '.js'].includes(extname(entry.name))
        ) {
          results.push(full);
        }
      }
      const nested = await Promise.all(tasks);
      for (const batch of nested) results.push(...batch);
    } catch {
      // skip unreadable dirs
    }
    return results;
  }

  /** Count total nodes in a component tree */
  private _countNodes(node: ComponentNode): number {
    return 1 + node.children.reduce((sum, child) => sum + this._countNodes(child), 0);
  }

  /** Compute max depth of a component tree */
  private _maxDepth(node: ComponentNode, depth = 0): number {
    if (node.children.length === 0) return depth;
    return Math.max(...node.children.map((child) => this._maxDepth(child, depth + 1)));
  }

  /** Create an empty fallback node */
  private _emptyNode(filePath: string): ComponentNode {
    const name = filePath.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '') ?? 'Unknown';
    return { name, path: filePath, line: 0, props: [], children: [] };
  }
}
