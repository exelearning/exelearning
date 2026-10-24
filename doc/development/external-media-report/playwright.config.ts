import { defineConfig } from '@playwright/test';

/**
 * Standalone: this drives already-running plugin environments, so it must NOT inherit
 * eXeLearning's own webServer or projects.
 */
export default defineConfig({
    testDir: '.',
    testMatch: /(shots|pages|surfaces)\.spec\.ts/,
    workers: 1,
    reporter: [['list']],
    /**
     * Twice the previous 1280x900. At the old size the fold cut through the content frame:
     * a page whose video sat below it was captured as a header and a scrollbar, which is
     * evidence of nothing. The taller window fits the host chrome AND the whole content
     * page, so what the figure shows is what the learner sees.
     */
    use: { viewport: { width: 2560, height: 1800 }, ignoreHTTPSErrors: true },
});
