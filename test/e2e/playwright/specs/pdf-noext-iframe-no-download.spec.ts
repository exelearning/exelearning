import { test, expect } from '../fixtures/auth.fixture';
import * as path from 'path';
import * as fs from 'fs';
import { waitForAppReady, openElpFile } from '../helpers/workarea-helpers';

/**
 * Regression test for the bug where a PDF embedded in an <iframe> via an
 * extension-less resource (`content/resources/asset-<uuid>`) was served as
 * application/octet-stream and force-downloaded by the static editor instead of
 * rendered (reported by @greynoa).
 *
 * The fixture `pdf-noext-iframe.elpx` reproduces it: a project whose text
 * iDevice embeds an <iframe> pointing at an extension-less PDF resource. After
 * import, AssetManager must recover the real type (application/pdf) and append
 * the .pdf extension, and nothing must auto-download.
 *
 * Regenerate the fixture with: node test/fixtures/scripts/build-pdf-noext-fixture.mjs
 */
const FIXTURE = path.join(process.cwd(), 'test/fixtures/pdf-noext-iframe.elpx');

test.describe('Extension-less PDF iframe does not auto-download', () => {
    test.beforeAll(() => {
        if (!fs.existsSync(FIXTURE)) {
            throw new Error(`Fixture not found: ${FIXTURE} (run build-pdf-noext-fixture.mjs)`);
        }
    });

    test('imports the project, recovers the PDF type, and triggers no download', async ({ authenticatedPage }) => {
        const page = authenticatedPage;

        // The bug manifests as an automatic browser download.
        const downloads: string[] = [];
        page.on('download', d => downloads.push(d.suggestedFilename()));

        await openElpFile(page, FIXTURE, 1);
        await waitForAppReady(page);

        // The imported PDF asset must be normalized: real MIME + .pdf filename.
        const assetInfo = await page
            .waitForFunction(
                () => {
                    const am = (window as any).eXeLearning?.app?.project?._yjsBridge?.assetManager;
                    const all = am?.getAllAssetsMetadata?.() ?? [];
                    return all.length > 0 ? all.map((a: any) => ({ mime: a.mime, filename: a.filename })) : null;
                },
                undefined,
                { timeout: 20000 },
            )
            .then(handle => handle.jsonValue() as Promise<Array<{ mime: string; filename: string }>>);

        const pdf = assetInfo.find(a => a.mime === 'application/pdf');
        expect(pdf, `expected a recovered PDF asset, got ${JSON.stringify(assetInfo)}`).toBeTruthy();
        expect(pdf!.filename.toLowerCase().endsWith('.pdf')).toBe(true);

        // Give any (buggy) iframe download a chance to fire, then assert none did.
        await page.waitForTimeout(1500);
        expect(downloads, `unexpected downloads: ${downloads.join(', ')}`).toHaveLength(0);
    });
});
