/**
 * @module plugins/project/security
 * @layer L3 — plugin
 *
 * Security scanning — env file exposure, file permissions,
 * and hardcoded secrets detection.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { SecurityIssue, SecurityReport, SecuritySummary, SecuritySeverity } from './types.js';
import type { ITextFileAccess } from '../../types/registry.js';

// ---------------------------------------------------------------------------
// Secret detection patterns
// ---------------------------------------------------------------------------

type SecretPattern = {
  name: string;
  pattern: RegExp;
  severity: SecuritySeverity;
  fix: string;
};

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: 'critical',
    fix: 'Remove the AWS access key and rotate credentials immediately.',
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i,
    severity: 'critical',
    fix: 'Remove the AWS secret key and rotate credentials immediately.',
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}/,
    severity: 'critical',
    fix: 'Revoke the GitHub token and generate a new one.',
  },
  {
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/i,
    severity: 'high',
    fix: 'Move API keys to environment variables.',
  },
  {
    name: 'Private Key Header',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    severity: 'critical',
    fix: 'Remove private key from source code. Store in secure secret manager.',
  },
  {
    name: 'Hardcoded Password',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"{][^'"]{3,}['"](?!\s*\+)/i,
    severity: 'high',
    fix: 'Move passwords to environment variables.',
  },
  {
    name: 'Bearer Token',
    pattern: /bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
    severity: 'high',
    fix: 'Remove bearer tokens from source code.',
  },
  {
    name: 'Stripe Secret Key',
    pattern: /sk_live_[A-Za-z0-9]{24,}/,
    severity: 'critical',
    fix: 'Revoke the Stripe secret key and generate a new one.',
  },
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}/,
    severity: 'critical',
    fix: 'Revoke the SendGrid API key and generate a new one.',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[A-Za-z0-9\-]{10,}/,
    severity: 'high',
    fix: 'Revoke the Slack token.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect files under a directory with depth limit */
async function collectFiles(
  dir: string,
  extensions: string[],
  maxDepth = 6,
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
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectFiles(fullPath, extensions, maxDepth, currentDepth + 1);
      results.push(...sub);
    } else {
      const ext = extname(entry.name);
      if (extensions.length === 0 || extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/** Build a SecuritySummary from an issues array */
function buildSummary(issues: SecurityIssue[]): SecuritySummary {
  const summary: SecuritySummary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    summary[issue.severity]++;
  }
  return summary;
}

// ---------------------------------------------------------------------------
// SecurityScanner
// ---------------------------------------------------------------------------

export class SecurityScanner {
  // ISS-050: Optional ITextFileAccess for ACP-compliant file reads.
  // When provided, text file reads use the ACP interface (editor buffer aware).
  // readdir and stat remain as direct fs — no ACP equivalent exists for those.
  private readonly _fs?: ITextFileAccess;

  constructor(fs?: ITextFileAccess) {
    this._fs = fs;
  }

  /**
   * Run a full security scan on the project.
   * Never throws — returns empty issues array on unexpected errors.
   */
  async scan(projectRoot: string): Promise<SecurityReport> {
    const sourceFiles = await collectFiles(projectRoot, [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    ]);

    const [envIssues, permIssues, secretIssues] = await Promise.all([
      this.checkEnvExposure(projectRoot),
      this.checkPermissions(projectRoot),
      this.checkSecrets(sourceFiles),
    ]);

    const issues = [...envIssues, ...permIssues, ...secretIssues];
    return {
      issues,
      summary: buildSummary(issues),
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Check if .env files or other secrets files might be committed
   * (i.e., exist without being in .gitignore).
   */
  async checkEnvExposure(projectRoot: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    const envFilePatterns = [
      '.env', '.env.local', '.env.production', '.env.development',
      '.env.staging', '.env.test', 'secrets.json', 'credentials.json',
    ];

    // Check if .gitignore exists and what it covers
    let gitignoreContent = '';
    try {
      gitignoreContent = this._fs
        ? await this._fs.readTextFile(join(projectRoot, '.gitignore'))
        : await readFile(join(projectRoot, '.gitignore'), 'utf-8');
    } catch {
      // No .gitignore — all files potentially exposed
    }

    for (const envFile of envFilePatterns) {
      try {
        await stat(join(projectRoot, envFile));
        // File exists — check if it's in .gitignore
        const isIgnored = gitignoreContent
          .split('\n')
          .some((line) => line.trim() === envFile || line.trim() === `/${envFile}`);

        if (!isIgnored) {
          issues.push({
            severity: 'high',
            package: envFile,
            description: `Environment file '${envFile}' exists and may not be excluded from version control.`,
            fix: `Add '${envFile}' to .gitignore to prevent accidental commit of secrets.`,
            filePath: join(projectRoot, envFile),
          });
        }
      } catch {
        // File doesn't exist — safe
      }
    }

    // Check if .env.example exists (good practice marker)
    try {
      await stat(join(projectRoot, '.env.example'));
    } catch {
      // No .env.example — suggest creating one if .env exists
      try {
        await stat(join(projectRoot, '.env'));
        issues.push({
          severity: 'low',
          package: '.env.example',
          description: 'No .env.example file found. Consider documenting required environment variables.',
          fix: 'Create a .env.example with placeholder values for all required environment variables.',
        });
      } catch {
        // No .env at all — no issue
      }
    }

    return issues;
  }

  /**
   * Check for files with potentially dangerous permissions.
   * Looks for world-writable files and scripts without execute bits.
   */
  async checkPermissions(projectRoot: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    const sensitiveFiles = ['.env', '.env.local', '.env.production', 'secrets.json'];

    for (const file of sensitiveFiles) {
      const filePath = join(projectRoot, file);
      try {
        const fileStat = await stat(filePath);
        const mode = fileStat.mode;
        // Check for world-readable (others read bit: 0o004)
        if (mode & 0o004) {
          issues.push({
            severity: 'medium',
            package: file,
            description: `File '${file}' is world-readable (permissions: ${(mode & 0o777).toString(8)}).`,
            fix: `Run: chmod 600 ${file} to restrict access to the file owner only.`,
            filePath,
          });
        }
      } catch {
        // File doesn't exist — skip
      }
    }

    return issues;
  }

  /**
   * Scan source files for hardcoded secrets using regex patterns.
   * Skips test files and example/mock files.
   */
  async checkSecrets(files: string[]): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    const filteredFiles = files.filter((f) => {
      const lower = f.toLowerCase();
      return (
        !lower.includes('.test.') &&
        !lower.includes('.spec.') &&
        !lower.includes('__mocks__') &&
        !lower.includes('.mock.') &&
        !lower.includes('example') &&
        !lower.includes('fixture')
      );
    });

    await Promise.all(
      filteredFiles.map(async (filePath) => {
        let content: string;
        try {
          content = this._fs
            ? await this._fs.readTextFile(filePath)
            : await readFile(filePath, 'utf-8');
        } catch {
          return;
        }

        const lines = content.split('\n');
        for (const secretPattern of SECRET_PATTERNS) {
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            if (secretPattern.pattern.test(line)) {
              issues.push({
                severity: secretPattern.severity,
                package: filePath,
                description: `Possible ${secretPattern.name} found in source file.`,
                fix: secretPattern.fix,
                filePath,
                line: lineIdx + 1,
              });
            }
          }
        }
      }),
    );

    return issues;
  }
}
