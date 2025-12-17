import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Allow tests to import from 'bun:test' - redirect to vitest
      'bun:test': 'vitest',
    },
  },
  test: {
    // Enable globals (describe, it, expect) without imports
    globals: true,

    // Use happy-dom for all frontend tests (provides window, document, etc.)
    environment: 'happy-dom',

    // Setup file for mocks
    setupFiles: ['./public/vitest.setup.js'],

    // Only include frontend tests
    include: [
      'public/app/**/*.test.js',
      'public/files/perm/idevices/base/**/*.test.js',
      'public/libs/**/*.test.js',
    ],

    // Exclude legacy code
    exclude: ['**/node_modules/**', '**/symfony_legacy/**', '**/nestjs_legacy/**'],

    // Worker isolation - critical for memory management
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },

    // Limit concurrent tests to prevent memory explosion
    maxConcurrency: 4,

    // Timeout for slow tests
    testTimeout: 30000,

    // Silence console.log in tests
    silent: false,

    // Coverage configuration for CI (activated with --coverage flag)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage/vitest',
      include: [
        'public/app/**/*.js',
        'public/files/perm/idevices/base/**/*.js',
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.test.js',
        '**/vitest.setup.js',
        '**/libs/**',
        '**/*.min.js',
        '**/*.bundle.js',
      ],
    },
  },
});
