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
    ADMIN_EMAIL: 'admin@exelearning.test',
    ADMIN_PASSWORD: 'AdminPass123!',
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
    command: 'bun x serve dist/static -p 3002 --no-request-logging',
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

    // Number of workers.
    //
    // Each worker drives a full editor: Chromium (several processes), the Yjs document, a
    // Service Worker and the preview iframe. Past roughly four of those in parallel the
    // machine stops keeping up and pages start dying mid-test — the symptom is
    // `page.reload: Target page, context or browser has been closed`, or a downstream
    // `locator.click: Timeout` against a page that is already gone. It reads as flaky
    // tests and is really oversubscription.
    //
    // Measured on a 10-core / 24 GB machine.
    //
    //   `specs/idevices/` (189 tests) — the heaviest cluster:
    //     8 workers (the old 80% of cores) → 6 failed, 10.1 min
    //     4 workers                        → 0 failed, 6.3 / 6.6 min on two runs
    //
    //   full suite (492 tests):
    //     8 workers → 1, 3 and 4 failed across three runs, 10.0–13.1 min
    //     4 workers → 0 failed, 17.5 min
    //
    // On the heavy cluster fewer workers were faster as well as greener — the machine was
    // thrashing. Across the whole suite the trade is real: about six minutes slower, and
    // reliable. Six minutes is worth paying for a suite whose failures currently cannot be
    // told apart from real regressions.
    //
    // Hence a hard ceiling of 4 on top of the previous 80% rule: machines with four cores
    // or fewer behave exactly as before, larger ones simply stop over-committing.
    //
    // Deliberately NOT a timeout increase: the pages were dead, so no amount of waiting
    // would have helped — it would only have hidden the failure for longer.
    //
    // CI is untouched. `ubuntu-latest` has 4 cores, so '100%' there already resolves to 4,
    // which is why this never reproduced in CI and only bit developer machines.
    workers: process.env.CI ? '100%' : Math.min(4, Math.max(1, Math.floor(os.cpus().length * 0.8))),

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
        actionTimeout: 20000,

        /* Navigation timeout */
        navigationTimeout: 15000,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
            },
            testIgnore: /.*-static\.spec\.ts/,
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
                serviceWorkers: 'allow',
            },
            testIgnore: /.*-static\.spec\.ts/,
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
    timeout: 45000,

    /* Expect timeout */
    expect: {
        timeout: 7000,
    },
});
