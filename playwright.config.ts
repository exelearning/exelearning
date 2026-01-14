import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for eXeLearning
 * @see https://playwright.dev/docs/test-configuration
 */
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
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',

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
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                // Explicitly enable service workers for Firefox
                serviceWorkers: 'allow',
            },
        },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        // },
    ],

    /* Run local dev server before starting the tests (only if E2E_BASE_URL is not set) */
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command:
                  'DB_PATH=:memory: FILES_DIR=/tmp/exelearning-e2e/ PORT=3001 APP_PORT=3001 APP_AUTH_METHODS=password,guest bun src/index.ts',
              url: 'http://localhost:3001/login',
              reuseExistingServer: !process.env.CI,
              timeout: 120 * 1000, // 2 minutes to start
              stdout: 'pipe',
              stderr: 'pipe',
              env: {
                  ...process.env,
                  DB_PATH: ':memory:',
                  FILES_DIR: '/tmp/exelearning-e2e/',
                  PORT: '3001',
                  APP_PORT: '3001',
                  APP_AUTH_METHODS: 'password,guest',
                  ONLINE_THEMES_INSTALL: '1', // Enable theme import for E2E tests
              },
          },

    /* Global timeout for each test */
    timeout: 60000,

    /* Expect timeout */
    expect: {
        timeout: 10000,
    },
});
