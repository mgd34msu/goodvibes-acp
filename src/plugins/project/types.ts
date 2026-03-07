/**
 * @module plugins/project/types
 * @layer L3 — plugin
 *
 * Type definitions for the project analysis plugin.
 * Covers dependency analysis, security scanning, test discovery, and database tools.
 */

// ---------------------------------------------------------------------------
// Dependency analysis
// ---------------------------------------------------------------------------

/** A single project dependency */
export type Dependency = {
  /** Package name */
  name: string;
  /** Version string as declared in package.json */
  version: string;
  /** Dependency type */
  type: 'prod' | 'dev' | 'peer';
  /** Resolved version (from lock file or node_modules) */
  resolved?: string;
  /** Whether a newer version is available */
  outdated?: boolean;
  /** Latest available version */
  latestVersion?: string;
};

/** Result of a full dependency analysis */
export type DepsAnalysis = {
  /** Production dependencies */
  dependencies: Dependency[];
  /** Development dependencies */
  devDependencies: Dependency[];
  /** Detected circular import chains (each inner array is a cycle path) */
  circular: string[][];
  /** Packages declared but not imported in source code */
  unused: string[];
  /** Packages that have newer versions available */
  outdated: Dependency[];
};

/** Params for dependency analysis */
export type AnalyzeDepsParams = {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Whether to check for outdated packages (slower) */
  checkOutdated?: boolean;
  /** Whether to detect circular imports */
  detectCircular?: boolean;
  /** Whether to find unused dependencies */
  findUnused?: boolean;
};

// ---------------------------------------------------------------------------
// Security scanning
// ---------------------------------------------------------------------------

/** Severity level of a security issue */
export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low';

/** A single security issue found in the project */
export type SecurityIssue = {
  /** Severity level */
  severity: SecuritySeverity;
  /** Affected package or file */
  package: string;
  /** Human-readable description */
  description: string;
  /** Suggested fix or remediation */
  fix?: string;
  /** File path where the issue was found */
  filePath?: string;
  /** Line number where the issue was found */
  line?: number;
};

/** Summary of security issues by severity */
export type SecuritySummary = Record<SecuritySeverity, number>;

/** Full security scan report */
export type SecurityReport = {
  /** All issues found */
  issues: SecurityIssue[];
  /** Issue counts by severity */
  summary: SecuritySummary;
  /** ISO timestamp of when the scan was run */
  lastChecked: string;
};

/** Params for security scanning */
export type SecurityScanParams = {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Whether to check for .env exposure */
  checkEnvExposure?: boolean;
  /** Whether to check file permissions */
  checkPermissions?: boolean;
  /** Whether to scan for hardcoded secrets */
  checkSecrets?: boolean;
};

// ---------------------------------------------------------------------------
// Test discovery
// ---------------------------------------------------------------------------

/** Supported test frameworks */
export type TestFramework = 'vitest' | 'jest' | 'bun' | 'playwright';

/** A discovered test file */
export type TestFile = {
  /** Absolute or relative path to the test file */
  path: string;
  /** Detected test framework */
  framework: TestFramework;
  /** Estimated number of test cases */
  testCount?: number;
  /** Test suite names found in the file */
  suites?: string[];
};

/** Rough test coverage estimate */
export type TestCoverage = {
  /** Total number of source files */
  total: number;
  /** Number of source files with corresponding test files */
  covered: number;
  /** Coverage percentage (0–100) */
  percentage: number;
  /** Source files without test coverage */
  uncoveredFiles: string[];
};

/** Params for test discovery */
export type FindTestsParams = {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Whether to estimate coverage */
  estimateCoverage?: boolean;
};

// ---------------------------------------------------------------------------
// Database tools
// ---------------------------------------------------------------------------

/** Column definition in a database table */
export type ColumnInfo = {
  /** Column name */
  name: string;
  /** Column type (e.g. String, Int, Boolean, DateTime) */
  type: string;
  /** Whether the column allows null values */
  nullable: boolean;
  /** Whether this column is a primary key */
  primary?: boolean;
  /** Foreign key reference (table.column) */
  references?: string;
};

/** Index definition on a table */
export type IndexInfo = {
  /** Columns included in the index */
  columns: string[];
  /** Whether this is a unique index */
  unique?: boolean;
};

/** Table definition in the database schema */
export type TableInfo = {
  /** Table name */
  name: string;
  /** Column definitions */
  columns: ColumnInfo[];
  /** Index definitions */
  indexes?: IndexInfo[];
};

/** A relation between two tables */
export type Relation = {
  /** Source table */
  from: string;
  /** Target table */
  to: string;
  /** Relation type */
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  /** Foreign key field */
  field?: string;
};

/** Parsed database schema */
export type DbSchema = {
  /** Table definitions */
  tables: TableInfo[];
  /** Relations between tables */
  relations: Relation[];
};

/** Schema analysis result */
export type SchemaAnalysis = {
  /** Issues found in the schema */
  issues: string[];
  /** Improvement suggestions */
  suggestions: string[];
};

/** Params for Prisma schema parsing */
export type ParsePrismaParams = {
  /** Absolute path to the Prisma schema file */
  schemaPath: string;
};

/** Params for SQL query generation */
export type GenerateQueryParams = {
  /** Table name */
  table: string;
  /** SQL operation type */
  operation: 'select' | 'insert' | 'update' | 'delete';
  /** Optional column list for select/insert */
  columns?: string[];
  /** Optional WHERE condition string */
  where?: string;
};

// ---------------------------------------------------------------------------
// Unified project analysis
// ---------------------------------------------------------------------------

/** Full project analysis result */
export type ProjectAnalysis = {
  /** Dependency analysis */
  deps?: DepsAnalysis;
  /** Security scan report */
  security?: SecurityReport;
  /** Discovered test files */
  tests?: TestFile[];
  /** Test coverage estimate */
  coverage?: TestCoverage;
  /** Database schema (if found) */
  schema?: DbSchema;
  /** ISO timestamp of analysis */
  analyzedAt: string;
};

/** Params for full project analysis */
export type AnalyzeProjectParams = {
  /** Absolute path to the project root */
  projectRoot: string;
  /** Which analyses to run (default: all) */
  include?: Array<'deps' | 'security' | 'tests' | 'database'>;
};
