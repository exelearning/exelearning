import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

/**
 * Playwright E2E Test Configuration for eXeLearning
 * @see https://playwright.dev/docs/test-configuration
 */

/**
 * Detect which projects are being run from command line
 * This allows smart server selection:
 * - --project=static → only static server (port 3002)
 * - --project=chromium/firefox → only dynamic server (port 3001)
 * - No --project (run all) → both servers start
 */
const projectArgs = process.argv.filter((arg) => arg.startsWith('--project='));
const requestedProjects = projectArgs.map((arg) => arg.replace('--project=', ''));

const isRunningOnlyStatic = requestedProjects.length > 0 && requestedProjects.every((p) => p === 'static');
const isRunningOnlyDynamic =
    requestedProjects.length > 0 && requestedProjects.every((p) => p === 'chromium' || p === 'firefox');
const isRunningMixed = !isRunningOnlyStatic && !isRunningOnlyDynamic;

// Set STATIC_MODE env var for test helpers when running static-only tests
// This allows helpers like gotoWorkarea() to detect static mode and navigate correctly
if (isRunningOnlyStatic) {
    process.env.STATIC_MODE = 'true';
}

// Shared environment for dynamic server (chromium/firefox)
const dynamicServerEnv = {
    DB_PATH: ':memory:',
    // FIX: '/tmp/' usually does not exist on Windows.
    // We use the OS temporary folder dynamically.
    FILES_DIR: path.join(os.tmpdir(), 'exelearning-e2e'),
    PORT: '3001',
    APP_PORT: '3001',
    APP_AUTH_METHODS: 'password,guest',
    ONLINE_THEMES_INSTALL: '1', // Enable theme import for E2E tests
};

// Dynamic server config (used by chromium/firefox projects)
const dynamicWebServer = process.env.E2E_BASE_URL
    ? undefined
    : {
          command: 'bun src/index.ts',
          url: 'http://localhost:3001/login',
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000, // 2 minutes to start
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
          env: { ...process.env, ...dynamicServerEnv },
      };

// Static server config (port 3002)
const staticWebServer = {
    command: 'bunx serve dist/static -p 3002 --no-request-logging',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'pipe' as const,
    stderr: 'pipe' as const,
};

/**
 * Determine which server(s) to start based on requested projects:
 * - Only static → static server only
 * - Only chromium/firefox → dynamic server only
 * - Mixed or no project specified → both servers (array)
 */
function getWebServerConfig() {
    if (process.env.E2E_BASE_URL) {
        return undefined; // External server, don't start any
    }
    if (isRunningOnlyStatic) {
        return staticWebServer;
    }
    if (isRunningOnlyDynamic) {
        return dynamicWebServer;
    }
    // Mixed or all projects - start both servers
    return [dynamicWebServer, staticWebServer].filter(Boolean);
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
    workers: process.env.CI ? '100%' : '80%',

    /* Reporter to use */
    reporter: [['html', { outputFolder: 'playwright-report' }], ['github'], ['list']],

    /* Shared settings for all the projects below */
    use: {
        /* Base URL - each project overrides this with its specific URL */
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
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:3001',
            },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                baseURL: 'http://localhost:3001',
                serviceWorkers: 'allow',
            },
        },
        // {
        //     name: 'webkit',
        //     use: { ...devices['Desktop Safari'] },
        // },
        {
            name: 'static',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: 'http://localhost:3002',
            },
        },
    ],

    /* Global webServer - smart selection based on requested projects */
    webServer: getWebServerConfig(),

    /* Global timeout for each test */
    timeout: 60000,

    /* Expect timeout */
    expect: {
        timeout: 10000,
    },
});
