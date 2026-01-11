import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for eXeLearning
 * @see https://playwright.dev/docs/test-configuration
 *
 * Supports two modes:
 * - Server mode (default): Tests against the full Elysia server
 * - Static mode: Tests against the static bundle (no server)
 *
 * Run static mode tests with: make test-e2e-static
 */

// Detect if running static mode tests
const isStaticProject = process.env.PLAYWRIGHT_PROJECT?.includes('static');

/**
 * Get the appropriate webServer configuration based on project type
 */
function getWebServerConfig() {
    const project = process.env.PLAYWRIGHT_PROJECT || '';

    if (process.env.E2E_BASE_URL) {
        return undefined; // External server provided
    }

    if (project.includes('static')) {
        // Static mode: build and serve static bundle
        return {
            command: 'bun scripts/serve-static-for-e2e.ts',
            url: 'http://localhost:8080',
            reuseExistingServer: !process.env.CI,
            timeout: 180000, // 3 minutes (includes build time)
            stdout: 'pipe' as const,
            stderr: 'pipe' as const,
            env: {
                ...process.env,
                PORT: '8080',
            },
        };
    }

    // Server mode (default)
    return {
        command:
            'DB_PATH=:memory: FILES_DIR=/tmp/exelearning-e2e/ PORT=3001 APP_PORT=3001 APP_AUTH_METHODS=password,guest ONLINE_THEMES_INSTALL=1 APP_LOCALE=en bun src/index.ts',
        url: 'http://localhost:3001/login',
        reuseExistingServer: false, // Always start fresh to ensure correct env vars
        timeout: 120 * 1000, // 2 minutes to start
        stdout: 'pipe' as const,
        stderr: 'pipe' as const,
        env: {
            ...process.env,
            DB_PATH: ':memory:',
            FILES_DIR: '/tmp/exelearning-e2e/',
            PORT: '3001',
            APP_PORT: '3001',
            APP_AUTH_METHODS: 'password,guest',
            ONLINE_THEMES_INSTALL: '1', // Enable theme import for E2E tests
            APP_LOCALE: 'en', // Force English locale for E2E tests
        },
    };
}

export default defineConfig({
    testDir: './test/e2e/playwright/specs',

    // Run tests in files in parallel
    // Allows tests WITHIN the same file to run simultaneously.
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    // Number of workers:
    // undefined = Let Playwright decide (usually CPU cores / 2).
    // 1 = No parallelism (tests run sequentially).
    // 4 = Force 4 processes.
    // '100%' = Use all available CPU cores.
    workers: '100%',

    /* Reporter to use */
    reporter: [['html', { outputFolder: 'playwright-report' }], ['github'], ['list']],

    /* Shared settings for all the projects below */
    use: {
        /* Base URL to use in actions like `await page.goto('/')` */
        baseURL: process.env.E2E_BASE_URL || (isStaticProject ? 'http://localhost:8080' : 'http://localhost:3001'),

        /* Force English locale for consistent test behavior */
        locale: 'en-US',

        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',

        /* Capture screenshot on failure */
        screenshot: 'only-on-failure',

        /* Video recording on failure */
        video: 'on-first-retry',

        /* Maximum time each action can take */
        actionTimeout: 60000,

        /* Navigation timeout */
        navigationTimeout: 30000,
    },

    /* Configure projects for major browsers */
    projects: [
        // Server mode projects (exclude static-mode tests)
        {
            name: 'chromium',
            testIgnore: /static-mode-.*\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            testIgnore: /static-mode-.*\.spec\.ts/,
            use: { ...devices['Desktop Firefox'] },
        },
        // Static mode project (Chromium only) - runs all tests that don't skip via serverOnly()
        {
            name: 'chromium-static',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:8080',
            },
        },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        // },
    ],

    /* Run local dev server before starting the tests (conditional based on mode) */
    webServer: getWebServerConfig(),

    /* Global timeout for each test */
    timeout: 60000,

    /* Expect timeout */
    expect: {
        timeout: 10000,
    },
});
