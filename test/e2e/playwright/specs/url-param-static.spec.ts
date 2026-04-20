import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Static mode ?url= auto-import
 *
 * Covers the relaxed filename detection in scripts/static-bundle/static-index.html
 * `fetchUrlParam()`. URLs whose pathname does NOT end in .elpx/.elp/.zip must still
 * be accepted when either:
 *   - the Content-Disposition header declares a supported filename, or
 *   - the payload starts with a ZIP magic number.
 *
 * Non-archive payloads must still be rejected with a clear error.
 */

const FIXTURE_PATH = path.resolve(__dirname, '../../../fixtures/really-simple-test-project.elpx');

test.describe('Static ?url= import', () => {
    // Only the `static` project (playwright.config.ts) uses the dist/static server.
    // Dynamic projects skip files matching /-static\.spec\.ts/ via testIgnore.

    test('accepts codeload-style URL (no extension in path, Content-Disposition provides name)', async ({ page }) => {
        const zipBody = fs.readFileSync(FIXTURE_PATH);
        const remoteUrl = 'https://codeload.test.invalid/owner/repo/zip/refs/heads/main';

        await page.route(remoteUrl, async route => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': 'attachment; filename=repo-main.zip',
                    'Access-Control-Allow-Origin': '*',
                },
                body: zipBody,
            });
        });

        await page.goto(`/?url=${encodeURIComponent(remoteUrl)}`);

        await page.waitForFunction(() => (window as any).eXeLearning?.app !== undefined, undefined, { timeout: 30000 });

        // No error message on the load screen or stored for deferred alert.
        const deferredError = await page.evaluate(() => (window as any).__exeStaticUrlError ?? null);
        expect(deferredError).toBeNull();
    });

    test('accepts URL without extension and no Content-Disposition when payload is a ZIP (magic-byte fallback)', async ({
        page,
    }) => {
        const zipBody = fs.readFileSync(FIXTURE_PATH);
        const remoteUrl = 'https://example.test.invalid/download/archive';

        await page.route(remoteUrl, async route => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Access-Control-Allow-Origin': '*',
                },
                body: zipBody,
            });
        });

        await page.goto(`/?url=${encodeURIComponent(remoteUrl)}`);

        await page.waitForFunction(() => (window as any).eXeLearning?.app !== undefined, undefined, { timeout: 30000 });

        const deferredError = await page.evaluate(() => (window as any).__exeStaticUrlError ?? null);
        expect(deferredError).toBeNull();
    });

    test('rejects URL whose payload is not a ZIP archive', async ({ page }) => {
        const remoteUrl = 'https://example.test.invalid/not-a-zip';

        await page.route(remoteUrl, async route => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*',
                },
                body: 'not a zip file',
            });
        });

        await page.goto(`/?url=${encodeURIComponent(remoteUrl)}`);

        await page.waitForFunction(() => typeof (window as any).__exeStaticUrlError === 'string', undefined, {
            timeout: 30000,
        });

        const deferredError = await page.evaluate(() => (window as any).__exeStaticUrlError);
        expect(deferredError).toMatch(/\.elpx, \.elp, or \.zip/);
    });
});
