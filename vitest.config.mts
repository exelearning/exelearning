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
        include: ['public/app/**/*.test.js', 'public/libs/**/*.test.js', 'public/files/perm/idevices/**/*.test.js'],

        // Exclude legacy code
        exclude: [
            '**/node_modules/**',
            '**/symfony_legacy/**',
            '**/nestjs_legacy/**',
            'public/app/common/edicuatex/**',
            'public/app/common/mermaid/**',
            'public/app/common/mindmaps/**',
            'public/app/common/fix_webm_duration/**',
            'public/app/common/exe_tooltips/imagesloaded.pkg.min.js',
            'public/app/common/exe_tooltips/jquery.qtip.min.js',
            'public/app/common/exe_media/**',
            'public/app/common/exe_math/**',
            'public/app/common/exe_magnify/**',
            'public/app/common/exe_lightbox/**',
            'public/app/common/exe_highlighter/**',
            'public/files/perm/themes/**',
        ],

        // Worker isolation - critical for memory management
        pool: 'threads',
        singleFork: false,
        isolate: true,

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
            include: ['public/app/**/*.js'],
            exclude: [
                '**/node_modules/**',
                '**/*.test.js',
                '**/vitest.setup.js',
                '**/libs/**',
                '**/*.min.js',
                '**/*.bundle.js',
                'public/app/common/mermaid/**',
                'public/app/common/mindmaps/**',
                'public/app/common/fix_webm_duration/**',
                'public/app/common/exe_tooltips/imagesloaded.pkg.min.js',
                'public/app/common/exe_tooltips/jquery.qtip.min.js',
                'public/app/common/exe_media/**',
                'public/app/common/exe_math/**',
                'public/app/common/exe_magnify/**',
                'public/app/common/exe_lightbox/**',
                'public/app/common/exe_highlighter/**',
                'public/app/common/edicuatex/**',
                'public/files/perm/**',
            ],
        },
    },
});
