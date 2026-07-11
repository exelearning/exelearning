import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

/**
 * Standalone Playwright config for the preview-refresh benchmark.
 *
 * Kept OUT of test/e2e/playwright/specs so the CI E2E suite never picks it up.
 * Boots its own backend on a dedicated port with a throwaway in-memory DB and a
 * scratchpad FILES_DIR, so a developer's `.env` (which may point DB_PATH at
 * /mnt/data) can't break the run. Chromium only, one worker, no retries — the
 * benchmark must be deterministic and free of cross-test contention.
 *
 * Run:
 *   make bundle   # once, so the preview serves the fresh runtime
 *   bun x playwright test -c test/benchmarks/preview/playwright.bench.config.ts
 *
 * Output filename is controlled by BENCH_OUT (default "baseline") →
 *   test/benchmarks/preview/results/<BENCH_OUT>.json and .md
 */

const PORT = process.env.BENCH_PORT || '3011';
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

const serverEnv = {
    DB_PATH: ':memory:',
    FILES_DIR: path.join(os.tmpdir(), 'exelearning-preview-bench'),
    PORT,
    APP_PORT: PORT,
    APP_AUTH_METHODS: 'password,guest',
    ADMIN_EMAIL: 'admin@exelearning.test',
    ADMIN_PASSWORD: 'AdminPass123!',
    ONLINE_THEMES_INSTALL: '1',
};

const webServer = process.env.E2E_BASE_URL
    ? undefined
    : {
          command: 'bun src/index.ts',
          cwd: path.resolve(__dirname, '../../..'),
          url: `${BASE_URL}/login`,
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          stdout: 'pipe' as const,
          stderr: 'pipe' as const,
          env: { ...process.env, ...serverEnv },
      };

export default defineConfig({
    testDir: __dirname,
    testMatch: /.*\.bench\.spec\.ts/,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    // Each fixture size runs many serial scenarios incl. a 50 MiB upload; give
    // the whole per-fixture test room without leaning on arbitrary sleeps.
    timeout: 15 * 60 * 1000,
    expect: { timeout: 30_000 },
    use: {
        baseURL: BASE_URL,
        trace: 'off',
        screenshot: 'off',
        video: 'off',
        actionTimeout: 60_000,
        navigationTimeout: 30_000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: BASE_URL,
            },
        },
    ],
    webServer,
});
