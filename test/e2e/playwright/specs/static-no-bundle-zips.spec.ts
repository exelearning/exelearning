import { test, expect } from '../fixtures/static.fixture';
import { waitForAppReady, openElpFile, openPreviewPanel, getPreviewFrame } from '../helpers/workarea-helpers';
import * as path from 'path';

/**
 * Static build: assemble resource bundles from loose files (PR #1910)
 *
 * The static distribution ships only `bundles/manifest.json`, never the
 * pre-built `bundles/*.zip` archives. The client assembles each bundle on
 * demand from the loose files listed in the manifest. This spec guards two
 * invariants of that change:
 *
 *   1. Static mode NEVER requests `/bundles/*.zip` (those files do not exist
 *      in the static build and a request for one would 404).
 *   2. Loading a project with content images and opening the preview still
 *      renders a real image (naturalWidth > 0), proving the loose-file
 *      assembly path produces a working theme + working assets.
 */
test.describe('Static - assemble bundles from loose files', () => {
    // Fixture with real content images under content/resources/*.jpg.
    const FIXTURE_PATH = path.resolve(
        __dirname,
        '../../../fixtures/un-contenido-de-ejemplo-para-probar-estilos-y-catalogacion.elpx',
    );

    test('never requests /bundles/*.zip and renders an image in preview', async ({ staticPage }) => {
        test.skip(test.info().project.name !== 'static', 'Static-only test');
        const page = staticPage;

        // Record every URL that hits the network so we can assert no zip bundle
        // was ever requested across app boot, import, and preview generation.
        const requestedUrls: string[] = [];
        page.on('request', request => {
            requestedUrls.push(request.url());
        });

        await waitForAppReady(page);

        // Confirm we really are in static mode (no remote storage capability).
        const isStaticMode = await page.evaluate(() => {
            const capabilities = (window as any).eXeLearning?.app?.capabilities;
            return capabilities ? capabilities.storage?.remote === false : false;
        });
        expect(isStaticMode).toBe(true);

        // Import a project that contains content images.
        await openElpFile(page, FIXTURE_PATH, 1);

        // Open the preview and wait for an image inside the rendered article to
        // load. naturalWidth > 0 proves the asset (and the theme assembled from
        // loose files) actually rendered rather than 404-ing.
        await openPreviewPanel(page);
        const iframe = getPreviewFrame(page);
        const image = iframe.locator('article img').first();
        await image.waitFor({ state: 'attached', timeout: 20000 });

        await expect
            .poll(
                async () => {
                    try {
                        return await image.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : 0));
                    } catch {
                        return 0;
                    }
                },
                { timeout: 20000 },
            )
            .toBeGreaterThan(0);

        // The core invariant: no pre-built zip bundle was ever fetched. In the
        // static build the bundles dir holds only manifest.json.
        const zipBundleRequests = requestedUrls.filter(url => /\/bundles\/[^?]*\.zip(\?|$)/.test(url));
        expect(zipBundleRequests).toEqual([]);
    });
});
