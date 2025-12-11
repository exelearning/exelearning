// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';

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
            'public/libs/**',
            'public/app/common/**',
            'public/files/**',
            '**/*.d.ts',
        ],
    },

    // ===========================================
    // NestJS TypeScript source files
    // ===========================================
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        ignores: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            // Prettier integration
            'prettier/prettier': 'error',

            // TypeScript specific rules (NestJS recommendations)
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
            '@typescript-eslint/no-empty-function': 'warn',
            '@typescript-eslint/no-require-imports': 'off',

            // General ESLint rules
            'no-console': 'warn',
            'no-debugger': 'error',
            eqeqeq: ['error', 'always'],
            curly: ['error', 'all'],
            'no-var': 'error',
            'prefer-const': 'error',
        },
    },

    // ===========================================
    // Jest test files
    // No type-aware rules (parserOptions.project removed)
    // since tsconfig.json excludes test files
    // ===========================================
    {
        files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            parser: tseslint.parser,
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            prettier: prettierPlugin,
            jest: jestPlugin,
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
            'no-console': 'off',

            // Jest specific rules
            'jest/no-disabled-tests': 'warn',
            'jest/no-focused-tests': 'error',
            'jest/no-identical-title': 'error',
            'jest/valid-expect': 'error',
        },
    },

    // ===========================================
    // Public app JavaScript (basic linting only)
    // No code style enforcement, just error detection
    // ===========================================
    {
        files: ['public/app/**/*.js'],
        ignores: ['public/app/common/**', 'public/libs/**'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.jquery,
                // Common globals used in the app
                $: 'readonly',
                jQuery: 'readonly',
                eXe: 'readonly',
                tinymce: 'readonly',
                Nunjucks: 'readonly',
            },
        },
        rules: {
            // Disable all TypeScript rules for JS files
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-require-imports': 'off',

            // Only basic error detection, no style enforcement
            'no-undef': 'off', // Too many globals in legacy code
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
            'no-redeclare': 'warn', // Common in legacy code
        },
    },

    // ===========================================
    // Config files (JS/MJS)
    // ===========================================
    {
        files: ['*.js', '*.mjs', 'scripts/**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': 'off',
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    // Prettier config must be last to override conflicting rules
    eslintConfigPrettier
);
