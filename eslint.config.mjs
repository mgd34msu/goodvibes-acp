// eslint.config.mjs — Flat config with 4-layer architecture boundary enforcement
// L0: src/types/   — no imports from L1, L2, L3
// L1: src/core/    — imports from L0 only
// L2: src/extensions/ — imports from L0, L1 only
// L3: src/plugins/ — imports from L0, L1, L2; no cross-plugin imports
// main.ts — exempt from all boundary rules

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** Plugin names for cross-plugin boundary enforcement */
const PLUGIN_NAMES = [
  'agents',
  'analytics',
  'frontend',
  'precision',
  'project',
  'review',
  'registry',
  'runtime',
];

/**
 * Build no-restricted-imports patterns blocking all other plugins.
 * Each plugin may not import from sibling plugin directories.
 */
function crossPluginPatterns(currentPlugin) {
  return PLUGIN_NAMES
    .filter((name) => name !== currentPlugin)
    .flatMap((name) => [
      {
        group: [`../${name}`, `../${name}/*`],
        message: `Cross-plugin import violation: plugins/${currentPlugin} cannot import from plugins/${name} (L3 boundary rule)`,
      },
      {
        group: [`../../plugins/${name}`, `../../plugins/${name}/*`],
        message: `Cross-plugin import violation: plugins/${currentPlugin} cannot import from plugins/${name} (L3 boundary rule)`,
      },
    ]);
}

export default [
  // Base TypeScript config for all src files
  {
    files: ['src/**/*.ts'],
    plugins: { '@typescript-eslint': tsPlugin },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },

  // L0: src/types/ — cannot import from L1 (core), L2 (extensions), or L3 (plugins)
  {
    files: ['src/types/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../core', '../core/*', '../../core', '../../core/*'],
              message: 'L0 (types) cannot import from L1 (core)',
            },
            {
              group: ['../extensions', '../extensions/*', '../../extensions', '../../extensions/*'],
              message: 'L0 (types) cannot import from L2 (extensions)',
            },
            {
              group: ['../plugins', '../plugins/*', '../../plugins', '../../plugins/*'],
              message: 'L0 (types) cannot import from L3 (plugins)',
            },
          ],
        },
      ],
    },
  },

  // L1: src/core/ — cannot import from L2 (extensions) or L3 (plugins)
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../extensions', '../extensions/*', '../../extensions', '../../extensions/*'],
              message: 'L1 (core) cannot import from L2 (extensions)',
            },
            {
              group: ['../plugins', '../plugins/*', '../../plugins', '../../plugins/*'],
              message: 'L1 (core) cannot import from L3 (plugins)',
            },
          ],
        },
      ],
    },
  },

  // L2: src/extensions/ — cannot import from L3 (plugins)
  {
    files: ['src/extensions/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../plugins', '../plugins/*', '../../plugins', '../../plugins/*'],
              message: 'L2 (extensions) cannot import from L3 (plugins)',
            },
          ],
        },
      ],
    },
  },

  // L3: src/plugins/agents/ — cross-plugin boundary
  {
    files: ['src/plugins/agents/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: crossPluginPatterns('agents') }],
    },
  },

  // L3: src/plugins/analytics/ — cross-plugin boundary
  {
    files: ['src/plugins/analytics/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: crossPluginPatterns('analytics') }],
    },
  },

  // L3: src/plugins/frontend/ — cross-plugin boundary
  {
    files: ['src/plugins/frontend/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: crossPluginPatterns('frontend') }],
    },
  },

  // L3: src/plugins/precision/ — cross-plugin boundary
  {
    files: ['src/plugins/precision/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: crossPluginPatterns('precision') }],
    },
  },

  // L3: src/plugins/project/ — cross-plugin boundary
  {
    files: ['src/plugins/project/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: crossPluginPatterns('project') }],
    },
  },

  // L3: src/plugins/review/ — cross-plugin boundary
  {
    files: ['src/plugins/review/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: crossPluginPatterns('review') }],
    },
  },

  // Exemptions: main.ts and test files are not subject to boundary rules
  {
    files: ['src/main.ts', 'tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
