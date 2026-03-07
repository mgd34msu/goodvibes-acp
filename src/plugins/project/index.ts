/**
 * @module plugins/project
 * @layer L3 — plugin
 *
 * Project analysis plugin registration.
 *
 * Registers a ProjectAnalyzer (IToolProvider) under the 'project-analyzer'
 * registry key. Exposes tools for:
 *   - project_deps_analyze     — dependency analysis
 *   - project_deps_circular    — circular import detection
 *   - project_deps_upgrade     — outdated package detection
 *   - project_security_env     — .env file exposure check
 *   - project_security_permissions — file permission check
 *   - project_security_secrets — hardcoded secret scanning
 *   - project_test_find        — test file discovery
 *   - project_test_coverage    — coverage estimation
 *   - project_db_prisma        — Prisma schema parsing
 *   - project_db_query         — SQL query generation
 *   - project_db_schema        — schema quality analysis
 *   - project_code_surface     — full project analysis
 *
 * Usage from L2/L1:
 *   const analyzer = registry.get<IToolProvider>('project-analyzer');
 *   const result = await analyzer.execute('project_deps_analyze', { projectRoot: '/path' });
 */

import type { PluginRegistration } from '../../types/plugin.js';
import type { Registry } from '../../core/registry.js';
import { ProjectAnalyzer } from './analyzer.js';

export { ProjectAnalyzer } from './analyzer.js';
export { DependencyAnalyzer } from './deps.js';
export { SecurityScanner } from './security.js';
export { TestAnalyzer } from './test.js';
export { DatabaseTools } from './db.js';

export type {
  // Dependency types
  Dependency,
  DepsAnalysis,
  AnalyzeDepsParams,
  // Security types
  SecuritySeverity,
  SecurityIssue,
  SecuritySummary,
  SecurityReport,
  SecurityScanParams,
  // Test types
  TestFramework,
  TestFile,
  TestCoverage,
  FindTestsParams,
  // Database types
  ColumnInfo,
  IndexInfo,
  TableInfo,
  Relation,
  DbSchema,
  SchemaAnalysis,
  ParsePrismaParams,
  GenerateQueryParams,
  // Project analysis
  ProjectAnalysis,
  AnalyzeProjectParams,
} from './types.js';

/** Project analysis plugin registration object */
export const ProjectPlugin: PluginRegistration = {
  manifest: {
    name: 'project',
    version: '0.1.0',
    description: 'Project analysis — dependency analysis, security scanning, test discovery, and database tools',
    layer: 'L3',
    dependencies: [],
    capabilities: ['project-analysis'],
  },
  register: (registry: unknown) => {
    (registry as Registry).register('project-analyzer', new ProjectAnalyzer());
  },
  shutdown: async () => {},
};
