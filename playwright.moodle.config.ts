import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the LIVE-Moodle grading harness.
 *
 * Separate from `playwright.config.ts` on purpose: these specs need a running Moodle
 * with the audit course and learner accounts already provisioned, so they must never
 * be picked up by `make test-e2e`. Start the stack first, then:
 *
 *   MOODLE_BASE_URL=http://localhost:8097 bun x playwright test -c playwright.moodle.config.ts
 *
 * No `webServer` is declared: the LMS is external by definition, and starting one
 * from a test run would hide which instance the results came from.
 */
export default defineConfig({
    testDir: './test/e2e/playwright/specs-moodle',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    // Each scenario creates its own activity and drives a real learner session against
    // one Moodle. Running them in parallel would interleave gradebook writes for the
    // same course, so the harness serialises and uses one learner account per worker.
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: process.env.MOODLE_BASE_URL ?? 'http://localhost:8097',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 30000,
        navigationTimeout: 30000,
        viewport: { width: 1400, height: 1000 },
    },
    // Two engines on purpose. The runtime's end-of-session handling moved from
    // `unload` to `pagehide`/`visibilitychange`, and those fire on different
    // schedules in Gecko than in Chromium, so a grading result that only holds in
    // one engine is not a grading result. Select one with `--project=firefox`.
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    ],
    timeout: 300000,
    expect: { timeout: 15000 },
});
