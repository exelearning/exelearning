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

        // Prevent happy-dom from fetching external resources referenced by the
        // HTML that tests parse/inject (e.g. `<link rel="stylesheet">`). Those
        // fetches are fire-and-forget async tasks; when a worker tears down its
        // frame before they settle, the rejection escapes as an "Unhandled
        // Rejection" and fails the whole run even though every test passed.
        // Disabling file loading removes the async task entirely and resolves
        // the element as a successful (no-op) load. See HTMLLinkElement.#loadStyleSheet.
        environmentOptions: {
            happyDOM: {
                settings: {
                    disableCSSFileLoading: true,
                    disableJavaScriptFileLoading: true,
                    handleDisabledFileLoadingAsSuccess: true,
                },
            },
        },

        // Setup file for mocks
        setupFiles: ['./public/vitest.setup.js'],

        // Only include frontend tests
        include: [
            'public/app/**/*.test.js',
            'public/libs/**/*.test.js',
            'public/files/perm/idevices/**/*.test.js',
            // TypeScript iDevices (ADR-0006): any iDevice with a src/ tree
            // keeps colocated .spec.ts files — discovered by convention so a
            // new TypeScript iDevice needs no config edit.
            'public/files/perm/idevices/**/src/**/*.spec.ts',
            'public/preview-sw.test.js',
        ],

        // Exclude legacy code
        exclude: [
            '**/node_modules/**',
            '**/symfony_legacy/**',
            '**/nestjs_legacy/**',
            'public/app/common/edicuatex/**/!(*.test).js',
            'public/app/common/edicuatex/**/*.css',
            'public/app/common/edicuatex/**/*.html',
            'public/app/common/edicuatex/**/*.json',
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
            include: [
                'public/app/**/*.js',
                // The Interactive Video iDevice is maintained as TypeScript and
                // unit-tested through real imports, so v8 can instrument it. The
                // rest of public/files/perm is eval-loaded by the shared iDevice
                // harness, which v8 cannot see, so including it would only report
                // zeros for code that IS tested.
                'public/files/perm/idevices/base/interactive-video/src/**/*.ts',
            ],
            exclude: [
                '**/node_modules/**',
                '**/*.test.js',
                '**/*.test-util.js',
                '**/*.spec.ts',
                '**/*.d.ts',
                '**/vitest.setup.js',
                '**/libs/**',
                '**/*.min.js',
                '**/*.bundle.js',
                // Vendored third-party code (never edited locally, see
                // THIRD-PARTY-NOTICES.md)
                'public/app/common/scorm/scorm12/vendor/**',
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
                'public/app/common/edicuatex/**/!(*.test).js',
                'public/app/common/edicuatex/**/*.css',
                'public/app/common/edicuatex/**/*.html',
                'public/app/common/edicuatex/**/*.json',
                // Generated TypeScript-iDevice bundles (built from src/ by
                // scripts/build-idevices.ts); coverage is measured on the
                // TypeScript sources, not on their compiled output.
                'public/files/perm/idevices/base/interactive-video/edition/interactive-video.js',
                'public/files/perm/idevices/base/interactive-video/export/interactive-video.js',
            ],
        },
    },
});
