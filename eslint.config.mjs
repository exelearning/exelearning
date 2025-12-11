// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
    // ===========================================
    // Global ignores
    // ===========================================
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'release/**',
            'symfony_legacy/**',
            'nestjs_legacy/**',
            'public/libs/**',
            'public/app/common/**',
            'public/files/**',
            '**/*.d.ts',
            '**/*.bundle.js',
        ],
    },

    // ===========================================
    // TypeScript source files (src/)
    // ===========================================
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        ignores: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
            globals: {
                ...globals.node,
                Bun: 'readonly',
            },
        },
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            // Prettier integration
            'prettier/prettier': 'error',

            // TypeScript rules (Bun-style: pragmatic, not overly strict)
            '@typescript-eslint/interface-name-prefix': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-require-imports': 'off',

            // General rules
            'no-console': 'off',
            'no-debugger': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },

    // ===========================================
    // Test files (Bun test runner)
    // ===========================================
    {
        files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                ...globals.node,
                Bun: 'readonly',
                // Bun test globals
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                mock: 'readonly',
                spyOn: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            prettier: prettierPlugin,
        },
        rules: {
            // Prettier integration
            'prettier/prettier': 'error',

            // Relaxed rules for tests
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            'no-console': 'off',
        },
    },

    // ===========================================
    // Public app JavaScript (basic error detection)
    // ===========================================
    {
        files: ['public/app/**/*.js'],
        ignores: ['public/app/common/**', 'public/libs/**', '**/*.bundle.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.jquery,
                $: 'readonly',
                jQuery: 'readonly',
                eXe: 'readonly',
                tinymce: 'readonly',
                Nunjucks: 'readonly',
            },
        },
        rules: {
            // Disable TypeScript rules for JS files
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',

            // Basic error detection only
            'no-undef': 'off',
            'no-unused-vars': 'off',
            'no-case-declarations': 'off',
            'no-prototype-builtins': 'off',
            'no-empty': 'warn',
            'no-unreachable': 'error',
            'no-constant-condition': 'warn',
            'no-dupe-keys': 'error',
            'no-duplicate-case': 'error',
            'no-func-assign': 'error',
            'no-invalid-regexp': 'error',
            'no-irregular-whitespace': 'off',
            'no-sparse-arrays': 'warn',
            'use-isnan': 'error',
            'valid-typeof': 'error',
            'no-redeclare': 'warn',
        },
    },

    // ===========================================
    // Config files (JS/MJS)
    // ===========================================
    {
        files: ['*.js', '*.mjs', 'scripts/**/*.js', 'scripts/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                ...globals.node,
                Bun: 'readonly',
            },
        },
        rules: {
            'no-console': 'off',
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // Prettier must be last to override conflicting rules
    eslintConfigPrettier,
);
