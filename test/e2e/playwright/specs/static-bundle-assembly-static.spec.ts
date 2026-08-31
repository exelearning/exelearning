import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import { waitForAppReady, openElpFile, waitForPreviewContent, getPreviewFrame } from '../helpers/workarea-helpers';

/**
 * Static build — assemble resource bundles from loose files (PR #1910)
 *
 * The static distribution ships only `bundles/manifest.json`, never the
 * pre-built `bundles/*.zip` archives; the client assembles each bundle on
 * demand from the loose files listed in the manifest. This spec guards two
 * invariants of that change:
 *
 *   1. Static mode NEVER requests `/bundles/*.zip` — those archives do not
 *      exist in the static build, so a request for one would 404.
 *   2. Loading a project with content images and opening the preview still
 *      renders a real image (naturalWidth > 0), proving the loose-file
 *      assembly produces a working theme + working assets end-to-end.
 *
 * The file name ends in `-static.spec.ts` so the chromium/firefox projects
 * ignore it (see `testIgnore` in playwright.config.ts) and it runs only in the
 * `static` project, which is served from the built `dist/static` on :3002.
 */
const FIXTURE_ELPX_WITH_IMAGES = path.join(
    process.cwd(),
    'test/fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
);

test.describe('Static build - assemble bundles from loose files (#1910)', () => {
    test('never requests /bundles/*.zip and renders an image in preview', async ({ page }) => {
        // Record every request from before app boot, so a zip-bundle fetch during
        // init, import or preview generation would be captured.
        const requestedUrls: string[] = [];
        page.on('request', request => requestedUrls.push(request.url()));

        // Static mode is served at the project baseURL (:3002) and needs no login.
        await page.goto('/');
        await waitForAppReady(page);

        // Confirm we really are in static mode (no remote storage capability).
        const isStaticMode = await page.evaluate(() => {
            const capabilities = (window as any).eXeLearning?.app?.capabilities;
            return capabilities ? capabilities.storage?.remote === false : false;
        });
        expect(isStaticMode).toBe(true);

        // Load a project that contains content images.
        await openElpFile(page, FIXTURE_ELPX_WITH_IMAGES, 2);
        await waitForAppReady(page);

        // Open the preview and confirm a real image renders (naturalWidth > 0),
        // proving the theme + assets assembled from loose files actually work
        // rather than 404-ing.
        const contentLoaded = await waitForPreviewContent(page, 30000);
        expect(contentLoaded).toBe(true);

        const iframe = getPreviewFrame(page);
        const imageRendered = await iframe.locator('body').evaluate(async body => {
            const deadline = Date.now() + 10000;
            while (Date.now() < deadline) {
                const images = Array.from(body.querySelectorAll('img')) as HTMLImageElement[];
                if (images.some(img => img.complete && img.naturalWidth > 0)) {
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            return false;
        });
        expect(imageRendered).toBe(true);

        // The core invariant of PR #1910: in the static build the bundles dir
        // holds only manifest.json, so no pre-built zip bundle is ever fetched.
        const zipBundleRequests = requestedUrls.filter(url => /\/bundles\/[^?]*\.zip(\?|$)/.test(url));
        expect(zipBundleRequests).toEqual([]);
    });
});
