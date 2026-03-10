/**
 * Tests for L3 review/exclusions module.
 * Covers shouldExcludeFromReview and filterReviewableFiles for all
 * excluded prefix, extension, filename, and normalization cases.
 */
import { describe, it, expect } from 'bun:test';
import {
  shouldExcludeFromReview,
  filterReviewableFiles,
  EXCLUDED_PREFIXES,
  EXCLUDED_EXTENSIONS,
  EXCLUDED_FILES,
} from '../../src/plugins/review/exclusions.ts';

// ---------------------------------------------------------------------------
// shouldExcludeFromReview — prefix matching
// ---------------------------------------------------------------------------

describe('shouldExcludeFromReview — excluded prefixes', () => {
  it('excludes node_modules/ prefix', () => {
    expect(shouldExcludeFromReview('node_modules/lodash/index.js')).toBe(true);
  });

  it('excludes dist/ prefix', () => {
    expect(shouldExcludeFromReview('dist/bundle.js')).toBe(true);
  });

  it('excludes build/ prefix', () => {
    expect(shouldExcludeFromReview('build/output.js')).toBe(true);
  });

  it('excludes out/ prefix', () => {
    expect(shouldExcludeFromReview('out/main.js')).toBe(true);
  });

  it('excludes .next/ prefix', () => {
    expect(shouldExcludeFromReview('.next/server/pages/index.js')).toBe(true);
  });

  it('excludes .nuxt/ prefix', () => {
    expect(shouldExcludeFromReview('.nuxt/dist/client.js')).toBe(true);
  });

  it('excludes .output/ prefix', () => {
    expect(shouldExcludeFromReview('.output/server/index.mjs')).toBe(true);
  });

  it('excludes .cache/ prefix', () => {
    expect(shouldExcludeFromReview('.cache/webpack/main.js')).toBe(true);
  });

  it('excludes .git/ prefix', () => {
    expect(shouldExcludeFromReview('.git/hooks/pre-commit')).toBe(true);
  });

  it('excludes .goodvibes/ prefix', () => {
    expect(shouldExcludeFromReview('.goodvibes/memory/patterns.json')).toBe(true);
  });

  it('excludes coverage/ prefix', () => {
    expect(shouldExcludeFromReview('coverage/lcov.info')).toBe(true);
  });

  it('excludes .turbo/ prefix', () => {
    expect(shouldExcludeFromReview('.turbo/cache/hash.json')).toBe(true);
  });

  it('excludes .vercel/ prefix', () => {
    expect(shouldExcludeFromReview('.vercel/output/config.json')).toBe(true);
  });

  it('excludes .svelte-kit/ prefix', () => {
    expect(shouldExcludeFromReview('.svelte-kit/generated/root.svelte')).toBe(true);
  });

  it('excludes vendor/ prefix', () => {
    expect(shouldExcludeFromReview('vendor/lib/helper.php')).toBe(true);
  });

  it('excludes __pycache__/ prefix', () => {
    expect(shouldExcludeFromReview('__pycache__/module.cpython-311.pyc')).toBe(true);
  });

  it('excludes .tox/ prefix', () => {
    expect(shouldExcludeFromReview('.tox/py311/lib/site-packages/foo.py')).toBe(true);
  });

  it('excludes .venv/ prefix', () => {
    expect(shouldExcludeFromReview('.venv/lib/python3.11/foo.py')).toBe(true);
  });

  it('excludes venv/ prefix', () => {
    expect(shouldExcludeFromReview('venv/lib/python3.11/foo.py')).toBe(true);
  });

  it('excludes .mypy_cache/ prefix', () => {
    expect(shouldExcludeFromReview('.mypy_cache/3.11/types.json')).toBe(true);
  });

  it('EXCLUDED_PREFIXES covers all expected dirs', () => {
    expect(EXCLUDED_PREFIXES).toContain('node_modules/');
    expect(EXCLUDED_PREFIXES).toContain('dist/');
    expect(EXCLUDED_PREFIXES).toContain('.git/');
    expect(EXCLUDED_PREFIXES).toContain('coverage/');
  });
});

// ---------------------------------------------------------------------------
// shouldExcludeFromReview — path normalization
// ---------------------------------------------------------------------------

describe('shouldExcludeFromReview — path normalization', () => {
  it('strips leading ./ before prefix matching', () => {
    expect(shouldExcludeFromReview('./node_modules/lodash/index.js')).toBe(true);
  });

  it('strips leading ./ before extension matching', () => {
    expect(shouldExcludeFromReview('./src/bundle.min.js')).toBe(true);
  });

  it('strips leading ./ before filename matching', () => {
    expect(shouldExcludeFromReview('./package-lock.json')).toBe(true);
  });

  it('handles absolute paths that contain excluded dir segments', () => {
    expect(shouldExcludeFromReview('/home/user/project/node_modules/lib/index.js')).toBe(true);
  });

  it('handles absolute paths with .git/ segment', () => {
    expect(shouldExcludeFromReview('/repo/.git/config')).toBe(true);
  });

  it('handles absolute paths with dist/ segment', () => {
    expect(shouldExcludeFromReview('/project/dist/bundle.js')).toBe(true);
  });

  it('does not exclude absolute path that happens to contain prefix string in filename only', () => {
    // /usr/lib/distribution.ts — "dist" only appears inside a filename, not as /dist/ dir
    expect(shouldExcludeFromReview('/usr/lib/distribution.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldExcludeFromReview — extension matching
// ---------------------------------------------------------------------------

describe('shouldExcludeFromReview — excluded extensions', () => {
  it('excludes .map files', () => {
    expect(shouldExcludeFromReview('src/bundle.js.map')).toBe(true);
  });

  it('excludes .min.js files', () => {
    expect(shouldExcludeFromReview('src/vendor.min.js')).toBe(true);
  });

  it('excludes .min.css files', () => {
    expect(shouldExcludeFromReview('src/styles.min.css')).toBe(true);
  });

  it('excludes .lock files', () => {
    expect(shouldExcludeFromReview('some.lock')).toBe(true);
  });

  it('excludes .log files', () => {
    expect(shouldExcludeFromReview('logs/app.log')).toBe(true);
  });

  it('excludes .d.ts files', () => {
    expect(shouldExcludeFromReview('src/types.d.ts')).toBe(true);
  });

  it('excludes .tsbuildinfo files', () => {
    expect(shouldExcludeFromReview('tsconfig.tsbuildinfo')).toBe(true);
  });

  it('excludes .snap files', () => {
    expect(shouldExcludeFromReview('tests/__snapshots__/component.snap')).toBe(true);
  });

  it('excludes image extensions: .png', () => {
    expect(shouldExcludeFromReview('assets/logo.png')).toBe(true);
  });

  it('excludes image extensions: .jpg', () => {
    expect(shouldExcludeFromReview('assets/photo.jpg')).toBe(true);
  });

  it('excludes image extensions: .jpeg', () => {
    expect(shouldExcludeFromReview('assets/photo.jpeg')).toBe(true);
  });

  it('excludes image extensions: .gif', () => {
    expect(shouldExcludeFromReview('assets/anim.gif')).toBe(true);
  });

  it('excludes image extensions: .webp', () => {
    expect(shouldExcludeFromReview('assets/img.webp')).toBe(true);
  });

  it('excludes image extensions: .ico', () => {
    expect(shouldExcludeFromReview('public/favicon.ico')).toBe(true);
  });

  it('excludes image extensions: .svg', () => {
    expect(shouldExcludeFromReview('src/icon.svg')).toBe(true);
  });

  it('excludes font extensions: .woff', () => {
    expect(shouldExcludeFromReview('assets/font.woff')).toBe(true);
  });

  it('excludes font extensions: .woff2', () => {
    expect(shouldExcludeFromReview('assets/font.woff2')).toBe(true);
  });

  it('excludes font extensions: .ttf', () => {
    expect(shouldExcludeFromReview('assets/font.ttf')).toBe(true);
  });

  it('excludes font extensions: .eot', () => {
    expect(shouldExcludeFromReview('assets/font.eot')).toBe(true);
  });

  it('excludes media extensions: .mp3', () => {
    expect(shouldExcludeFromReview('assets/sound.mp3')).toBe(true);
  });

  it('excludes media extensions: .mp4', () => {
    expect(shouldExcludeFromReview('assets/video.mp4')).toBe(true);
  });

  it('excludes media extensions: .wav', () => {
    expect(shouldExcludeFromReview('assets/audio.wav')).toBe(true);
  });

  it('excludes media extensions: .avi', () => {
    expect(shouldExcludeFromReview('assets/video.avi')).toBe(true);
  });

  it('excludes archive extensions: .zip', () => {
    expect(shouldExcludeFromReview('releases/v1.0.zip')).toBe(true);
  });

  it('excludes archive extensions: .tar', () => {
    expect(shouldExcludeFromReview('releases/v1.0.tar')).toBe(true);
  });

  it('excludes archive extensions: .gz', () => {
    expect(shouldExcludeFromReview('releases/v1.0.tar.gz')).toBe(true);
  });

  it('excludes archive extensions: .bz2', () => {
    expect(shouldExcludeFromReview('releases/v1.0.tar.bz2')).toBe(true);
  });

  it('excludes document extensions: .pdf', () => {
    expect(shouldExcludeFromReview('docs/manual.pdf')).toBe(true);
  });

  it('excludes document extensions: .doc', () => {
    expect(shouldExcludeFromReview('docs/spec.doc')).toBe(true);
  });

  it('excludes document extensions: .docx', () => {
    expect(shouldExcludeFromReview('docs/spec.docx')).toBe(true);
  });

  it('extension matching is case-insensitive', () => {
    expect(shouldExcludeFromReview('src/IMAGE.PNG')).toBe(true);
    expect(shouldExcludeFromReview('src/Bundle.MAP')).toBe(true);
  });

  it('EXCLUDED_EXTENSIONS contains key entries', () => {
    expect(EXCLUDED_EXTENSIONS).toContain('.map');
    expect(EXCLUDED_EXTENSIONS).toContain('.d.ts');
    expect(EXCLUDED_EXTENSIONS).toContain('.min.js');
    expect(EXCLUDED_EXTENSIONS).toContain('.png');
  });
});

// ---------------------------------------------------------------------------
// shouldExcludeFromReview — exact filename matching
// ---------------------------------------------------------------------------

describe('shouldExcludeFromReview — excluded filenames', () => {
  it('excludes package-lock.json', () => {
    expect(shouldExcludeFromReview('package-lock.json')).toBe(true);
  });

  it('excludes package-lock.json in subdirectory', () => {
    expect(shouldExcludeFromReview('packages/core/package-lock.json')).toBe(true);
  });

  it('excludes yarn.lock', () => {
    expect(shouldExcludeFromReview('yarn.lock')).toBe(true);
  });

  it('excludes pnpm-lock.yaml', () => {
    expect(shouldExcludeFromReview('pnpm-lock.yaml')).toBe(true);
  });

  it('excludes bun.lockb', () => {
    expect(shouldExcludeFromReview('bun.lockb')).toBe(true);
  });

  it('excludes .DS_Store', () => {
    expect(shouldExcludeFromReview('.DS_Store')).toBe(true);
  });

  it('excludes .DS_Store in subdirectory', () => {
    expect(shouldExcludeFromReview('src/.DS_Store')).toBe(true);
  });

  it('excludes Thumbs.db', () => {
    expect(shouldExcludeFromReview('Thumbs.db')).toBe(true);
  });

  it('EXCLUDED_FILES contains expected entries', () => {
    expect(EXCLUDED_FILES).toContain('package-lock.json');
    expect(EXCLUDED_FILES).toContain('yarn.lock');
    expect(EXCLUDED_FILES).toContain('bun.lockb');
  });
});

// ---------------------------------------------------------------------------
// shouldExcludeFromReview — reviewable files pass through
// ---------------------------------------------------------------------------

describe('shouldExcludeFromReview — reviewable files', () => {
  it('does not exclude a normal TypeScript source file', () => {
    expect(shouldExcludeFromReview('src/core/event-bus.ts')).toBe(false);
  });

  it('does not exclude a JavaScript source file', () => {
    expect(shouldExcludeFromReview('src/index.js')).toBe(false);
  });

  it('does not exclude a test file', () => {
    expect(shouldExcludeFromReview('tests/unit/foo.test.ts')).toBe(false);
  });

  it('does not exclude a markdown file', () => {
    expect(shouldExcludeFromReview('README.md')).toBe(false);
  });

  it('does not exclude a JSON config file', () => {
    expect(shouldExcludeFromReview('tsconfig.json')).toBe(false);
  });

  it('does not exclude a .env file', () => {
    expect(shouldExcludeFromReview('.env')).toBe(false);
  });

  it('does not exclude a file whose parent dir name starts with an excluded keyword but is not the exact prefix', () => {
    // "distribution/" is not in EXCLUDED_PREFIXES, only "dist/" is
    expect(shouldExcludeFromReview('distribution/main.ts')).toBe(false);
  });

  it('does not exclude a deeply nested normal source file', () => {
    expect(shouldExcludeFromReview('src/plugins/review/scoring-engine.ts')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterReviewableFiles
// ---------------------------------------------------------------------------

describe('filterReviewableFiles', () => {
  it('returns empty array for empty input', () => {
    expect(filterReviewableFiles([])).toEqual([]);
  });

  it('removes excluded files and keeps reviewable ones', () => {
    const input = [
      'src/index.ts',
      'node_modules/lodash/index.js',
      'dist/bundle.js',
      'src/utils/helper.ts',
      'package-lock.json',
      'assets/logo.png',
    ];
    const result = filterReviewableFiles(input);
    expect(result).toEqual(['src/index.ts', 'src/utils/helper.ts']);
  });

  it('returns all files when none are excluded', () => {
    const input = ['src/a.ts', 'src/b.ts', 'tests/a.test.ts'];
    expect(filterReviewableFiles(input)).toEqual(input);
  });

  it('returns empty array when all files are excluded', () => {
    const input = ['node_modules/foo.js', 'dist/bundle.js', 'package-lock.json'];
    expect(filterReviewableFiles(input)).toEqual([]);
  });

  it('handles ./prefixed paths correctly', () => {
    const input = ['./src/index.ts', './node_modules/foo.js'];
    const result = filterReviewableFiles(input);
    expect(result).toEqual(['./src/index.ts']);
  });

  it('preserves original path strings (does not alter the path value)', () => {
    const input = ['./src/index.ts'];
    const result = filterReviewableFiles(input);
    expect(result[0]).toBe('./src/index.ts');
  });
});
