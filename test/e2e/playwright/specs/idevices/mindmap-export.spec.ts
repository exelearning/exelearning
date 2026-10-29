import { test, expect } from '../../fixtures/auth.fixture';
import { SAVE_MENU_ITEM, openMindmapEditor } from '../../helpers/mindmap-helpers';

/**
 * Exporting a mind map writes a file through FileSaver.
 *
 * The mindmaps editor's Export command opens its save dialog, and #button-save-hdd
 * serialises the map and hands it to `window.saveAs(blob, filename)` — the one consumer
 * of FileSaver in this repository. FileSaver is vendored under the exemindmap editor but
 * called from mindmaps' own SaveDocument.js, so nothing in eXeLearning's own sources
 * mentions it and a version bump could break the export with no test noticing.
 *
 * Deliberately not mocked: the point is to exercise the vendored FileSaver artifact
 * itself, in a browser, and see a real download arrive.
 */
test.describe('Mind map export', () => {
    test('exports a mind map as a JSON download through FileSaver', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        const { frame, frame2 } = await openMindmapEditor(page, createProject, 'MindMap Export Test');

        // FileSaver has to be the real thing, loaded in the editor iframe.
        const saveAsType = await frame2.evaluate(() => typeof (window as unknown as { saveAs?: unknown }).saveAs);
        expect(saveAsType, 'window.saveAs must be provided by the vendored FileSaver').toBe('function');

        // Tools menu -> Export, which opens the mindmaps save dialog.
        await frame.locator('#toolbar .menu-button, #toolbar .button-menu, #toolbar button').first().waitFor();
        const toolsMenu = frame
            .locator('#toolbar')
            .getByText(/Tools|Herramientas/i)
            .first();
        await toolsMenu.click();

        const exportItem = frame.getByText(SAVE_MENU_ITEM).first();
        await exportItem.click();

        const saveButton = frame.locator('#button-save-hdd');
        await expect(saveButton).toBeVisible({ timeout: 10000 });

        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
        await saveButton.click();
        const download = await downloadPromise;

        // A sensible filename: the root node's caption plus .json.
        expect(download.suggestedFilename()).toMatch(/\.json$/);

        const stream = await download.createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk as Buffer);
        const content = Buffer.concat(chunks).toString('utf8');

        expect(content.length).toBeGreaterThan(0);

        // FileSaver 1.x prepends a UTF-8 BOM to text blobs and 2.x does not, so the
        // leading BOM is optional here rather than asserted either way. mindmaps reads
        // imports with FileReader.readAsText, which strips a BOM, so a file exported by
        // either version opens again -- that is what makes the difference safe.
        const body = content.replace(/^\uFEFF/, '');
        const parsed = JSON.parse(body);
        expect(parsed).toBeTruthy();
        expect(JSON.stringify(parsed)).toMatch(/root/i);

        // The vendored FileSaver is 2.0.5, which writes the blob as given. 1.3.3 prepended
        // a BOM here, so this is the one user-visible difference the upgrade made: an
        // exported map is now plain JSON that any parser reads without special handling.
        expect(content.startsWith('\uFEFF'), 'FileSaver 2.x should not prepend a BOM').toBe(false);

        expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
    });
});
