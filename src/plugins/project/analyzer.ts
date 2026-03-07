/**
 * @module plugins/project/analyzer
 * @layer L3 — plugin
 *
 * ProjectAnalyzer — facade that composes DependencyAnalyzer, SecurityScanner,
 * TestAnalyzer, and DatabaseTools into a single interface.
 *
 * Implements IToolProvider to integrate with the L1 Registry.
 */

import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import type { IToolProvider, ToolDefinition, ToolResult } from '../../types/registry.js';
import { DependencyAnalyzer } from './deps.js';
import { SecurityScanner } from './security.js';
import { TestAnalyzer } from './test.js';
import { DatabaseTools } from './db.js';
import type {
  AnalyzeProjectParams,
  ProjectAnalysis,
  AnalyzeDepsParams,
  DepsAnalysis,
  SecurityScanParams,
  SecurityReport,
  FindTestsParams,
  TestFile,
  TestCoverage,
  ParsePrismaParams,
  DbSchema,
  GenerateQueryParams,
  SchemaAnalysis,
} from './types.js';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'project_deps_analyze',
    description:
      'Analyze project dependencies from package.json. Detects circular imports, unused packages, and version information.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
        checkOutdated: { type: 'boolean', description: 'Check for outdated packages (default: false)' },
        detectCircular: { type: 'boolean', description: 'Detect circular imports (default: true)' },
        findUnused: { type: 'boolean', description: 'Find unused dependencies (default: true)' },
      },
    },
  },
  {
    name: 'project_deps_circular',
    description: 'Detect circular import cycles in the project source files.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'project_deps_upgrade',
    description: 'Check which dependencies have newer versions available (compares declared vs installed).',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'project_security_env',
    description: 'Check for .env file exposure — files that exist without being in .gitignore.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'project_security_permissions',
    description: 'Check file permissions for sensitive files (e.g. world-readable .env files).',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'project_security_secrets',
    description:
      'Scan source files for hardcoded secrets — API keys, tokens, passwords, private keys.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'project_test_find',
    description: 'Discover all test files in the project and detect their frameworks.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
        estimateCoverage: {
          type: 'boolean',
          description: 'Also estimate test coverage (default: false)',
        },
      },
    },
  },
  {
    name: 'project_test_coverage',
    description:
      'Estimate test coverage by comparing source files to test files using name-based heuristics.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'project_db_prisma',
    description: 'Parse a Prisma schema file and return table and relation information.',
    inputSchema: {
      type: 'object',
      required: ['schemaPath'],
      properties: {
        schemaPath: {
          type: 'string',
          description: 'Absolute path to the Prisma schema file (usually prisma/schema.prisma)',
        },
      },
    },
  },
  {
    name: 'project_db_query',
    description: 'Generate a basic SQL template for a table operation.',
    inputSchema: {
      type: 'object',
      required: ['table', 'operation'],
      properties: {
        table: { type: 'string', description: 'Table name' },
        operation: {
          type: 'string',
          enum: ['select', 'insert', 'update', 'delete'],
          description: 'SQL operation type',
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Column list (default: ["*"])',
        },
        where: { type: 'string', description: 'Optional WHERE clause' },
      },
    },
  },
  {
    name: 'project_db_schema',
    description: 'Analyze a parsed database schema for issues and improvement suggestions.',
    inputSchema: {
      type: 'object',
      required: ['schemaPath'],
      properties: {
        schemaPath: {
          type: 'string',
          description: 'Absolute path to the Prisma schema file to parse and analyze',
        },
      },
    },
  },
  {
    name: 'project_code_surface',
    description: 'Run a full project analysis: deps, security, tests, and database schema.',
    inputSchema: {
      type: 'object',
      required: ['projectRoot'],
      properties: {
        projectRoot: { type: 'string', description: 'Absolute path to the project root' },
        include: {
          type: 'array',
          items: { type: 'string', enum: ['deps', 'security', 'tests', 'database'] },
          description: 'Which analyses to run (default: all)',
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// ProjectAnalyzer (IToolProvider)
// ---------------------------------------------------------------------------

export class ProjectAnalyzer implements IToolProvider {
  readonly name = 'project-analyzer';
  readonly tools: ToolDefinition[] = TOOL_DEFINITIONS;

  private readonly _deps = new DependencyAnalyzer();
  private readonly _security = new SecurityScanner();
  private readonly _test = new TestAnalyzer();
  private readonly _db = new DatabaseTools();

  async execute<T = unknown>(toolName: string, params: unknown): Promise<ToolResult<T>> {
    const startMs = Date.now();
    try {
      const result = await this._dispatch(toolName, params);
      return {
        success: true,
        data: result as T,
        durationMs: Date.now() - startMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `project-analyzer: unhandled error in '${toolName}': ${message}`,
        durationMs: Date.now() - startMs,
      };
    }
  }

  private async _dispatch(toolName: string, params: unknown): Promise<unknown> {
    const p = params as Record<string, unknown>;

    switch (toolName) {
      case 'project_deps_analyze': {
        const args = p as AnalyzeDepsParams;
        return this._deps.analyze(args.projectRoot);
      }

      case 'project_deps_circular': {
        return this._deps.findCircular(String(p['projectRoot'] ?? ''));
      }

      case 'project_deps_upgrade': {
        return this._deps.checkOutdated(String(p['projectRoot'] ?? ''));
      }

      case 'project_security_env': {
        return this._security.checkEnvExposure(String(p['projectRoot'] ?? ''));
      }

      case 'project_security_permissions': {
        return this._security.checkPermissions(String(p['projectRoot'] ?? ''));
      }

      case 'project_security_secrets': {
        const projectRoot = String(p['projectRoot'] ?? '');
        const report = await this._security.scan(projectRoot);
        // Return only secret-related issues (filter out env/permission issues)
        return report.issues.filter((i) => i.filePath && !i.description.startsWith('Environment file'));
      }

      case 'project_test_find': {
        const args = p as FindTestsParams;
        const tests = await this._test.findTests(args.projectRoot);
        if (args.estimateCoverage) {
          const coverage = await this._test.estimateCoverage(args.projectRoot);
          return { tests, coverage };
        }
        return tests;
      }

      case 'project_test_coverage': {
        return this._test.estimateCoverage(String(p['projectRoot'] ?? ''));
      }

      case 'project_db_prisma': {
        const args = p as ParsePrismaParams;
        return this._db.parsePrismaSchema(args.schemaPath);
      }

      case 'project_db_query': {
        const args = p as GenerateQueryParams;
        return this._db.generateQuery(
          args.table,
          args.operation,
          args.columns,
          args.where,
        );
      }

      case 'project_db_schema': {
        const schemaPath = String(p['schemaPath'] ?? '');
        const schema = await this._db.parsePrismaSchema(schemaPath);
        return this._db.analyzeSchema(schema);
      }

      case 'project_code_surface': {
        return this.analyze(p as AnalyzeProjectParams);
      }

      default:
        throw new Error(
          `unknown tool '${toolName}'. Available: ${TOOL_DEFINITIONS.map((t) => t.name).join(', ')}`,
        );
    }
  }

  // ---------------------------------------------------------------------------
  // High-level unified analysis
  // ---------------------------------------------------------------------------

  /**
   * Run a full project analysis — deps, security, tests, and database schema.
   * The `include` param selects which analyses to run (default: all).
   */
  async analyze(params: AnalyzeProjectParams): Promise<ProjectAnalysis> {
    const { projectRoot, include } = params;
    const runAll = !include || include.length === 0;
    const shouldRun = (key: string) => runAll || include!.includes(key as 'deps' | 'security' | 'tests' | 'database');

    const result: ProjectAnalysis = {
      analyzedAt: new Date().toISOString(),
    };

    await Promise.all([
      shouldRun('deps')
        ? this._deps.analyze(projectRoot).then((d) => { result.deps = d; })
        : Promise.resolve(),

      shouldRun('security')
        ? this._security.scan(projectRoot).then((s) => { result.security = s; })
        : Promise.resolve(),

      shouldRun('tests')
        ? Promise.all([
            this._test.findTests(projectRoot),
            this._test.estimateCoverage(projectRoot),
          ]).then(([tests, coverage]) => {
            result.tests = tests;
            result.coverage = coverage;
          })
        : Promise.resolve(),

      shouldRun('database')
        ? this._findAndParseSchema(projectRoot).then((schema) => {
            if (schema) result.schema = schema;
          })
        : Promise.resolve(),
    ]);

    return result;
  }

  /** Find and parse Prisma schema if present */
  private async _findAndParseSchema(projectRoot: string): Promise<DbSchema | null> {
    const candidates = [
      join(projectRoot, 'prisma', 'schema.prisma'),
      join(projectRoot, 'schema.prisma'),
      join(projectRoot, 'db', 'schema.prisma'),
    ];

    for (const candidate of candidates) {
      try {
        await stat(candidate);
        return this._db.parsePrismaSchema(candidate);
      } catch {
        // Not found — try next
      }
    }

    return null;
  }
}
