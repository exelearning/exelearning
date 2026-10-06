import { unzipSync } from 'fflate';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * #2415: the "Editable export" project property (`exportSource`) must be
 * honoured by every publication format, not just the website and ePub ones.
 *
 * The chain under test is the production browser-side path
 * (`SharedExporters.quickExport` in the workarea), so the assertions run
 * against the built bundles rather than the TypeScript sources: an exporter
 * that writes `content.xml` unconditionally fails here even if the unit specs
 * are patched.
 *
 * Both halves matter. The file itself must be absent, and the package
 * manifest must not reference it — a manifest pointing at a file that is not
 * in the ZIP is an invalid SCORM/IMS package, which is worse than shipping
 * the source.
 *
 * `.elpx` is deliberately not covered: `content.xml` is mandatory in that
 * format, so it stays in the package regardless of `exportSource`.
 */

const PUBLICATION_FORMATS = ['scorm12', 'scorm2004', 'ims'] as const;

/**
 * Export the open project through the browser pipeline.
 *
 * @param page - Workarea page with the project open.
 * @param format - Export type passed to `SharedExporters.quickExport`.
 * @param exportSource - Value written to the `exportSource` metadata key.
 * @returns The unzipped package files.
 */
async function exportPackage(page: Page, format: string, exportSource: boolean): Promise<Record<string, Uint8Array>> {
    const zipBase64 = await page.evaluate(
        async ({ format, exportSource }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const exporters = (window as any).SharedExporters;
            if (!bridge?.documentManager || !exporters?.quickExport) {
                throw new Error('Browser export dependencies are not available');
            }
            bridge.documentManager.getMetadata().set('exportSource', exportSource);

            const exported = await exporters.quickExport(
                format,
                bridge.documentManager,
                bridge.assetCache || null,
                bridge.resourceFetcher || null,
                {},
                bridge.assetManager || null,
            );
            if (!exported.success || !exported.data) {
                throw new Error(exported.error || `${format} export failed`);
            }
            const bytes = new Uint8Array(exported.data);
            let binary = '';
            const CHUNK = 0x8000;
            for (let i = 0; i < bytes.length; i += CHUNK) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
            }
            return btoa(binary);
        },
        { format, exportSource },
    );
    return unzipSync(new Uint8Array(Buffer.from(zipBase64, 'base64')));
}

test.describe('Editable export project property (exportSource, #2415)', () => {
    test('publication formats ship the editable source only when it is enabled', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180_000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'exportSource property');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        for (const format of PUBLICATION_FORMATS) {
            const editable = await exportPackage(page, format, true);
            expect(Object.keys(editable), `${format} with exportSource=true`).toContain('content.xml');

            const published = await exportPackage(page, format, false);
            const fileNames = Object.keys(published);
            expect(fileNames, `${format} with exportSource=false`).not.toContain('content.xml');
            expect(fileNames, `${format} with exportSource=false`).not.toContain('content.dtd');

            const manifest = new TextDecoder().decode(published['imsmanifest.xml']);
            expect(manifest, `${format} manifest with exportSource=false`).not.toContain('content.xml');
            expect(manifest, `${format} manifest with exportSource=false`).not.toContain('content.dtd');
        }
    });
});
