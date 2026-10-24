import { defineConfig } from '@playwright/test';

/**
 * Electron end-to-end tests: launch the desktop app from `./app` against the built static
 * distribution (`make build-static`) and drive its windows with Playwright's `_electron`.
 *
 *   make test-e2e-electron
 *
 * One worker: the specs launch their own Electron instance each.
 */
export default defineConfig({
    testDir: './test/e2e/electron',
    timeout: 120_000,
    workers: 1,
    retries: 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        trace: 'retain-on-failure',
    },
});
