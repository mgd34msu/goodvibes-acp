/**
 * @module plugins/project/db
 * @layer L3 — plugin
 *
 * Database tools — Prisma schema parsing, SQL query generation,
 * and schema quality analysis.
 */

import { readFile } from 'node:fs/promises';
import type { DbSchema, TableInfo, ColumnInfo, IndexInfo, Relation, SchemaAnalysis } from './types.js';

// ---------------------------------------------------------------------------
// Prisma schema parser
// ---------------------------------------------------------------------------

/**
 * Line-by-line Prisma schema parser.
 * Handles model blocks, fields, relations, and @@index directives.
 * Returns an empty schema on parse errors.
 *
 * @note Uses direct `node:fs/promises` calls rather than the ITextFileAccess
 * abstraction used by DependencyAnalyzer, SecurityScanner, and TestAnalyzer.
 * This means DatabaseTools reads stale disk state instead of unsaved editor
 * buffers (ISS-051). To fix: add ITextFileAccess as a constructor parameter,
 * replace readFile() with this._fileAccess.readFile(), remove the fs/promises
 * import, and update the instantiation site in ProjectAnalyzer to inject the
 * shared ITextFileAccess instance.
 */
export class DatabaseTools {
  /**
   * Parse a Prisma schema file into a DbSchema.
   * Never throws — returns empty schema on error.
   */
  async parsePrismaSchema(schemaPath: string): Promise<DbSchema> {
    let content: string;
    try {
      content = await readFile(schemaPath, 'utf-8');
    } catch {
      return { tables: [], relations: [] };
    }

    const tables: TableInfo[] = [];
    const relations: Relation[] = [];
    const lines = content.split('\n');

    let inModel = false;
    let currentTable: TableInfo | null = null;
    const relFields = new Map<string, Array<{ field: string; to: string }>>(); // tableName -> relations

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Model start
      const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
      if (modelMatch) {
        inModel = true;
        currentTable = {
          name: modelMatch[1],
          columns: [],
          indexes: [],
        };
        continue;
      }

      // Model end
      if (inModel && line === '}') {
        if (currentTable) {
          tables.push(currentTable);
        }
        inModel = false;
        currentTable = null;
        continue;
      }

      if (!inModel || !currentTable) continue;

      // Skip comments and blank lines
      if (line.startsWith('//') || line === '') continue;

      // @@index directive
      const indexMatch = line.match(/^@@index\(\[([^\]]+)\]/);
      if (indexMatch) {
        const cols = indexMatch[1].split(',').map((c) => c.trim());
        currentTable.indexes = currentTable.indexes ?? [];
        currentTable.indexes.push({ columns: cols });
        continue;
      }

      // @@unique directive
      const uniqueMatch = line.match(/^@@unique\(\[([^\]]+)\]/);
      if (uniqueMatch) {
        const cols = uniqueMatch[1].split(',').map((c) => c.trim());
        currentTable.indexes = currentTable.indexes ?? [];
        currentTable.indexes.push({ columns: cols, unique: true });
        continue;
      }

      // Skip other block-level directives (@@map, @@id, etc.)
      if (line.startsWith('@@')) continue;

      // Field line: name  Type  modifiers/attributes
      // e.g.: id   String  @id @default(cuid())
      // e.g.: posts Post[]  — relation field (skip as column)
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?\??/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const isArray = Boolean(fieldMatch[3]);
      const isOptional = line.includes('?') && !isArray;

      // Detect if this is a relation field (references another model)
      // Prisma relation fields have @relation or a type that starts with uppercase
      const hasRelation = line.includes('@relation');
      const isModelRef = /^[A-Z]/.test(fieldType);

      if (hasRelation || (isModelRef && !isPrismaScalar(fieldType))) {
        // This is a relation field
        const relTableName = currentTable.name;
        if (!relFields.has(relTableName)) {
          relFields.set(relTableName, []);
        }
        const existing = relFields.get(relTableName)!;
        existing.push({ field: fieldName, to: fieldType });
        // Don't add as a column
        continue;
      }

      // Map Prisma types to simpler SQL-like type
      const isPrimary = line.includes('@id');
      const nullable = isOptional && !isPrimary;

      // Extract @relation references for foreign keys
      const referencesMatch = line.match(/@relation\(fields:\s*\[([^\]]+)\].*references:\s*\[([^\]]+)\]/);
      let references: string | undefined;
      if (referencesMatch) {
        references = referencesMatch[2].trim();
      }

      const column: ColumnInfo = {
        name: fieldName,
        type: fieldType,
        nullable,
        primary: isPrimary || undefined,
        references,
      };

      currentTable.columns.push(column);
    }

    // Build relations from collected relation fields
    for (const [fromTable, rels] of relFields.entries()) {
      for (const rel of rels) {
        // Determine relation type based on field array notation
        const toTable = rel.to;
        const contentForLine = content;
        // Check if the to-table has a corresponding array field back to fromTable
        const isOneToMany =
          new RegExp(`${fromTable}\\[\\]`).test(contentForLine) &&
          !new RegExp(`${toTable}\\[\\]`).test(contentForLine);

        relations.push({
          from: fromTable,
          to: toTable,
          type: isOneToMany ? 'one-to-many' : 'one-to-one',
          field: rel.field,
        });
      }
    }

    return { tables, relations };
  }

  /**
   * Generate a basic SQL template for a table operation.
   */
  generateQuery(
    table: string,
    operation: 'select' | 'insert' | 'update' | 'delete',
    columns: string[] = ['*'],
    where?: string,
  ): string {
    const quotedTable = `"${table}"`;
    const whereClause = where ? `\nWHERE ${where}` : '';

    switch (operation) {
      case 'select': {
        const cols = columns.includes('*') ? '*' : columns.map((c) => `"${c}"`).join(', ');
        return `SELECT ${cols}\nFROM ${quotedTable}${whereClause};`;
      }

      case 'insert': {
        const cols = columns.filter((c) => c !== '*');
        if (cols.length === 0) {
          return `INSERT INTO ${quotedTable} DEFAULT VALUES;`;
        }
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const valList = cols.map((c) => `:${c}`).join(', ');
        return `INSERT INTO ${quotedTable} (${colList})\nVALUES (${valList});`;
      }

      case 'update': {
        const cols = columns.filter((c) => c !== '*');
        if (cols.length === 0) {
          return `UPDATE ${quotedTable}\nSET <column> = <value>${whereClause};`;
        }
        const setList = cols.map((c) => `"${c}" = :${c}`).join(',\n  ');
        return `UPDATE ${quotedTable}\nSET ${setList}${whereClause};`;
      }

      case 'delete': {
        return `DELETE FROM ${quotedTable}${whereClause};`;
      }
    }
  }

  /**
   * Analyze a parsed schema for common issues and suggestions.
   */
  analyzeSchema(schema: DbSchema): SchemaAnalysis {
    const issues: string[] = [];
    const suggestions: string[] = [];

    for (const table of schema.tables) {
      // Check for missing primary key
      const hasPrimary = table.columns.some((c) => c.primary);
      if (!hasPrimary) {
        issues.push(`Table '${table.name}' has no primary key column.`);
      }

      // Check for tables without any indexes
      const hasIndexes = (table.indexes?.length ?? 0) > 0 || hasPrimary;
      if (!hasIndexes && table.columns.length > 3) {
        suggestions.push(
          `Table '${table.name}' has no indexes beyond primary key. Consider adding indexes for frequently queried columns.`,
        );
      }

      // Check for columns that look like foreign keys but lack references
      for (const col of table.columns) {
        if (
          (col.name.endsWith('Id') || col.name.endsWith('_id')) &&
          !col.primary &&
          !col.references
        ) {
          suggestions.push(
            `Column '${table.name}.${col.name}' looks like a foreign key but has no relation defined.`,
          );
        }
      }

      // Check for nullable primary keys
      for (const col of table.columns) {
        if (col.primary && col.nullable) {
          issues.push(`Primary key '${table.name}.${col.name}' must not be nullable.`);
        }
      }

      // Suggest audit fields for large tables
      const colNames = new Set(table.columns.map((c) => c.name));
      if (
        table.columns.length > 2 &&
        !colNames.has('createdAt') &&
        !colNames.has('created_at')
      ) {
        suggestions.push(
          `Table '${table.name}' lacks a 'createdAt' timestamp. Consider adding audit timestamps.`,
        );
      }
    }

    // Check for orphaned relations
    const tableNames = new Set(schema.tables.map((t) => t.name));
    for (const rel of schema.relations) {
      if (!tableNames.has(rel.to)) {
        issues.push(
          `Relation from '${rel.from}' references unknown table '${rel.to}'.`,
        );
      }
    }

    return { issues, suggestions };
  }
}

// ---------------------------------------------------------------------------
// Prisma scalar types
// ---------------------------------------------------------------------------

const PRISMA_SCALARS = new Set([
  'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
  'DateTime', 'Json', 'Bytes', 'Unsupported',
]);

function isPrismaScalar(typeName: string): boolean {
  return PRISMA_SCALARS.has(typeName);
}
