/**
 * @module review/exclusions
 * @layer L3 — plugin
 *
 * Paths and patterns that should be excluded from code review.
 */

/** Directory prefixes that should never be reviewed */
export const EXCLUDED_PREFIXES = [
  'node_modules/',
  'dist/',
  'build/',
  'out/',
  '.next/',
  '.nuxt/',
  '.output/',
  '.cache/',
  '.git/',
  '.goodvibes/',
  'coverage/',
  '.turbo/',
  '.vercel/',
  '.svelte-kit/',
  'vendor/',
  '__pycache__/',
  '.tox/',
  '.venv/',
  'venv/',
  '.mypy_cache/',
];

/** File extensions that should never be reviewed */
export const EXCLUDED_EXTENSIONS = [
  '.map',
  '.min.js',
  '.min.css',
  '.lock',
  '.log',
  '.d.ts',
  '.tsbuildinfo',
  '.snap',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.avi',
  '.zip', '.tar', '.gz', '.bz2',
  '.pdf', '.doc', '.docx',
];

/** Exact filenames that should never be reviewed */
export const EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.DS_Store',
  'Thumbs.db',
];

/**
 * Check if a file path should be excluded from review.
 * Normalizes paths by stripping leading ./ and leading /
 */
export function shouldExcludeFromReview(filePath: string): boolean {
  // Normalize: strip leading ./ or /
  let normalized = filePath;
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) {
    // For absolute paths, we can't prefix-match, so check if any excluded dir appears as a segment
    for (const prefix of EXCLUDED_PREFIXES) {
      const dir = '/' + prefix;
      if (normalized.includes(dir)) return true;
    }
  } else {
    for (const prefix of EXCLUDED_PREFIXES) {
      if (normalized.startsWith(prefix)) return true;
    }
  }

  // Check extensions
  const lower = normalized.toLowerCase();
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }

  // Check exact filenames
  const basename = normalized.split('/').pop() ?? '';
  for (const name of EXCLUDED_FILES) {
    if (basename === name) return true;
  }

  return false;
}

/**
 * Filter a list of file paths, removing those that should be excluded from review.
 */
export function filterReviewableFiles(files: string[]): string[] {
  return files.filter(f => !shouldExcludeFromReview(f));
}
