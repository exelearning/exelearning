import { unzipSync } from 'fflate';
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * End-to-end verification of configurable print button in exported resources.
 *
 * Checks that:
 * 1. By default (addPrintButton = false), exports do NOT include print.html or the #exe-print-btn button.
 * 2. When addPrintButton = true, website exports bundle print.html at root and render #exe-print-btn in HTML.
 * 3. Single page exports render #exe-print-btn when addPrintButton = true.
 */

async function exportPackage(page: Page, format: string, addPrintButton: boolean): Promise<Record<string, Uint8Array>> {
    const zipBase64 = await page.evaluate(
        async ({ format, addPrintButton }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const exporters = (window as any).SharedExporters;
            if (!bridge?.documentManager || !exporters?.quickExport) {
                throw new Error('Browser export dependencies are not available');
            }
            bridge.documentManager.getMetadata().set('addPrintButton', addPrintButton);

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
        { format, addPrintButton },
    );
    return unzipSync(new Uint8Array(Buffer.from(zipBase64, 'base64')));
}

test.describe('Export print button project property (addPrintButton)', () => {
    test('controls print button and print.html generation in exported website and single page', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(180_000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Print button test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // 1. Default: addPrintButton = false
        const defaultWebsite = await exportPackage(page, 'html5', false);
        expect(
            Object.keys(defaultWebsite),
            'website with addPrintButton=false should not have print.html',
        ).not.toContain('print.html');
        const defaultIndexHtml = new TextDecoder().decode(defaultWebsite['index.html']);
        expect(defaultIndexHtml).not.toContain('id="exe-print-btn"');

        // 2. Enabled: addPrintButton = true on website
        const printWebsite = await exportPackage(page, 'html5', true);
        expect(Object.keys(printWebsite), 'website with addPrintButton=true should have print.html').toContain(
            'print.html',
        );
        const printIndexHtml = new TextDecoder().decode(printWebsite['index.html']);
        expect(printIndexHtml).toContain('id="exe-print-btn"');

        const printHtmlContent = new TextDecoder().decode(printWebsite['print.html']);
        expect(printHtmlContent).toContain('id="exe-print-btn"');
        expect(printHtmlContent).toContain('exe-single-page');

        // 3. Enabled: addPrintButton = true on single-page export
        const singlePageZip = await exportPackage(page, 'page', true);
        const singlePageIndexHtml = new TextDecoder().decode(singlePageZip['index.html']);
        expect(singlePageIndexHtml).toContain('id="exe-print-btn"');
        expect(singlePageIndexHtml).toContain('exe-single-page');
    });
});
