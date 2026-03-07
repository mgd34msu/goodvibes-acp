/**
 * Tests for L3 ProjectAnalyzer components.
 * Covers DependencyAnalyzer, SecurityScanner, TestAnalyzer, DatabaseTools.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DependencyAnalyzer } from '../../src/plugins/project/deps.ts';
import { SecurityScanner } from '../../src/plugins/project/security.ts';
import { TestAnalyzer } from '../../src/plugins/project/test.ts';
import { DatabaseTools } from '../../src/plugins/project/db.ts';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gv-project-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// DependencyAnalyzer
// ---------------------------------------------------------------------------

describe('DependencyAnalyzer', () => {
  it('parses package.json dependencies', async () => {
    const pkg = JSON.stringify({
      name: 'my-app',
      dependencies: { react: '^18.0.0', 'next': '^14.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });
    await writeFile(join(tmpDir, 'package.json'), pkg, 'utf-8');

    const analyzer = new DependencyAnalyzer();
    const result = await analyzer.analyze(tmpDir);

    expect(Array.isArray(result.dependencies)).toBe(true);
    expect(Array.isArray(result.devDependencies)).toBe(true);
    const depNames = result.dependencies.map((d) => d.name);
    expect(depNames).toContain('react');
    expect(depNames).toContain('next');
    const devNames = result.devDependencies.map((d) => d.name);
    expect(devNames).toContain('typescript');
  });

  it('returns empty arrays for missing package.json', async () => {
    const analyzer = new DependencyAnalyzer();
    const result = await analyzer.analyze(tmpDir);
    expect(result.dependencies).toHaveLength(0);
    expect(result.devDependencies).toHaveLength(0);
  });

  it('returns empty arrays for malformed package.json', async () => {
    await writeFile(join(tmpDir, 'package.json'), 'not valid json', 'utf-8');
    const analyzer = new DependencyAnalyzer();
    const result = await analyzer.analyze(tmpDir);
    expect(result.dependencies).toHaveLength(0);
  });

  it('result includes circular and unused arrays', async () => {
    await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ dependencies: {} }), 'utf-8');
    const analyzer = new DependencyAnalyzer();
    const result = await analyzer.analyze(tmpDir);
    expect(Array.isArray(result.circular)).toBe(true);
    expect(Array.isArray(result.unused)).toBe(true);
    expect(Array.isArray(result.outdated)).toBe(true);
  });

  it('each dependency has name and type fields', async () => {
    const pkg = JSON.stringify({
      dependencies: { lodash: '^4.0.0' },
      devDependencies: { jest: '^29.0.0' },
    });
    await writeFile(join(tmpDir, 'package.json'), pkg, 'utf-8');
    const analyzer = new DependencyAnalyzer();
    const result = await analyzer.analyze(tmpDir);
    for (const dep of [...result.dependencies, ...result.devDependencies]) {
      expect(typeof dep.name).toBe('string');
      expect(dep.name.length).toBeGreaterThan(0);
      expect(['dependency', 'devDependency']).toContain(dep.type);
    }
  });
});

// ---------------------------------------------------------------------------
// SecurityScanner
// ---------------------------------------------------------------------------

describe('SecurityScanner', () => {
  it('detects AWS access key pattern in source file', async () => {
    const src = join(tmpDir, 'config.ts');
    await writeFile(src, 'const key = "AKIAIOSFODNN7EXAMPLE";', 'utf-8');

    const scanner = new SecurityScanner();
    const report = await scanner.scanSecrets(tmpDir);

    const awsIssues = report.issues.filter((i) => i.description.toLowerCase().includes('aws'));
    expect(awsIssues.length).toBeGreaterThan(0);
  });

  it('detects Stripe secret key pattern', async () => {
    const src = join(tmpDir, 'stripe.ts');
    await writeFile(src, 'const sk = "sk_live_FAKE_TEST_KEY_00000000";', 'utf-8');

    const scanner = new SecurityScanner();
    const report = await scanner.scanSecrets(tmpDir);

    const stripeIssues = report.issues.filter((i) =>
      i.description.toLowerCase().includes('stripe')
    );
    expect(stripeIssues.length).toBeGreaterThan(0);
  });

  it('returns empty issues for clean source', async () => {
    const src = join(tmpDir, 'clean.ts');
    await writeFile(src, 'export const safeValue = process.env.API_KEY;', 'utf-8');

    const scanner = new SecurityScanner();
    const report = await scanner.scanSecrets(tmpDir);

    expect(report.issues).toHaveLength(0);
  });

  it('report has issues array and lastChecked timestamp', async () => {
    const scanner = new SecurityScanner();
    const report = await scanner.scanSecrets(tmpDir);
    expect(Array.isArray(report.issues)).toBe(true);
    expect(typeof report.lastChecked).toBe('number');
  });

  it('each security issue has required fields', async () => {
    const src = join(tmpDir, 'secret.ts');
    await writeFile(src, 'const k = "AKIAIOSFODNN7EXAMPLE";', 'utf-8');

    const scanner = new SecurityScanner();
    const report = await scanner.scanSecrets(tmpDir);

    for (const issue of report.issues) {
      expect(typeof issue.severity).toBe('string');
      expect(typeof issue.description).toBe('string');
      expect(typeof issue.fix).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// TestAnalyzer
// ---------------------------------------------------------------------------

describe('TestAnalyzer', () => {
  it('finds .test.ts files', async () => {
    await mkdir(join(tmpDir, 'tests'), { recursive: true });
    await writeFile(join(tmpDir, 'tests', 'foo.test.ts'), 'describe("x", () => { it("y", () => {}) })', 'utf-8');

    const analyzer = new TestAnalyzer();
    const files = await analyzer.findTests(tmpDir);

    expect(files.length).toBeGreaterThan(0);
    const names = files.map((f) => f.path);
    expect(names.some((p) => p.includes('foo.test.ts'))).toBe(true);
  });

  it('finds .spec.ts files', async () => {
    await writeFile(join(tmpDir, 'bar.spec.ts'), 'test("z", () => {})', 'utf-8');

    const analyzer = new TestAnalyzer();
    const files = await analyzer.findTests(tmpDir);

    expect(files.some((f) => f.path.includes('bar.spec.ts'))).toBe(true);
  });

  it('does not include non-test ts files', async () => {
    await writeFile(join(tmpDir, 'utils.ts'), 'export function add(a: number, b: number) { return a + b; }', 'utf-8');

    const analyzer = new TestAnalyzer();
    const files = await analyzer.findTests(tmpDir);

    expect(files.every((f) => !f.path.includes('utils.ts'))).toBe(true);
  });

  it('each TestFile has path and framework fields', async () => {
    await writeFile(join(tmpDir, 'x.test.ts'), 'it("a", () => {})', 'utf-8');

    const analyzer = new TestAnalyzer();
    const files = await analyzer.findTests(tmpDir);

    for (const file of files) {
      expect(typeof file.path).toBe('string');
    }
  });

  it('returns empty array when no test files exist', async () => {
    const analyzer = new TestAnalyzer();
    const files = await analyzer.findTests(tmpDir);
    expect(files).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// DatabaseTools (Prisma schema parser)
// ---------------------------------------------------------------------------

describe('DatabaseTools — Prisma schema parser', () => {
  const SIMPLE_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    String @id @default(cuid())
  email String @unique
  name  String?
  posts Post[]
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])

  @@index([authorId])
}
`;

  it('parses models from Prisma schema', async () => {
    const schemaPath = join(tmpDir, 'schema.prisma');
    await writeFile(schemaPath, SIMPLE_SCHEMA, 'utf-8');

    const tools = new DatabaseTools();
    const schema = await tools.parsePrismaSchema(schemaPath);

    expect(schema.tables.length).toBeGreaterThanOrEqual(2);
    const tableNames = schema.tables.map((t) => t.name);
    expect(tableNames).toContain('User');
    expect(tableNames).toContain('Post');
  });

  it('parses columns from each model', async () => {
    const schemaPath = join(tmpDir, 'schema.prisma');
    await writeFile(schemaPath, SIMPLE_SCHEMA, 'utf-8');

    const tools = new DatabaseTools();
    const schema = await tools.parsePrismaSchema(schemaPath);

    const userTable = schema.tables.find((t) => t.name === 'User');
    expect(userTable).toBeDefined();
    const colNames = userTable!.columns.map((c) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('email');
  });

  it('parses @@index directives', async () => {
    const schemaPath = join(tmpDir, 'schema.prisma');
    await writeFile(schemaPath, SIMPLE_SCHEMA, 'utf-8');

    const tools = new DatabaseTools();
    const schema = await tools.parsePrismaSchema(schemaPath);

    const postTable = schema.tables.find((t) => t.name === 'Post');
    expect(postTable).toBeDefined();
    expect(postTable!.indexes!.length).toBeGreaterThan(0);
    expect(postTable!.indexes![0].columns).toContain('authorId');
  });

  it('returns empty schema for non-existent file (never throws)', async () => {
    const tools = new DatabaseTools();
    const schema = await tools.parsePrismaSchema(join(tmpDir, 'ghost.prisma'));
    expect(schema.tables).toHaveLength(0);
    expect(schema.relations).toHaveLength(0);
  });

  it('parses schema with @@unique directives', async () => {
    const schemaWithUnique = `
model Category {
  id   String @id
  slug String
  name String

  @@unique([slug, name])
}
`;
    const schemaPath = join(tmpDir, 'unique.prisma');
    await writeFile(schemaPath, schemaWithUnique, 'utf-8');

    const tools = new DatabaseTools();
    const schema = await tools.parsePrismaSchema(schemaPath);
    const cat = schema.tables.find((t) => t.name === 'Category');
    expect(cat).toBeDefined();
    const uniqueIndex = cat!.indexes!.find((i) => i.unique === true);
    expect(uniqueIndex).toBeDefined();
    expect(uniqueIndex!.columns).toContain('slug');
  });
});
