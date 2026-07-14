import { test, expect } from '../fixtures/auth.fixture';
import {
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    selectFirstPage,
    waitForAppReady,
} from '../helpers/workarea-helpers';

const componentHtml = `
<div id="custom-content">
    <script>window.__customScriptExecuted = true;</script>
    <img id="custom-error-image" src="missing-preview-image" onerror="window.__handlerExecuted = true">
    <a id="custom-javascript-link" href="javascript:window.__javascriptUrlExecuted=true">Run</a>
    <svg id="custom-svg" onload="window.__svgHandlerExecuted=true"><script>window.__svgScriptExecuted=true</script></svg>
    <iframe id="custom-srcdoc" srcdoc="<script>parent.__srcdocExecuted=true</script>"></iframe>
    <object id="custom-object" data="data:text/html,<script>parent.__objectExecuted=true</script>"></object>
    <embed id="custom-embed" src="data:image/svg+xml,<svg onload='parent.__embedExecuted=true'/>">
    <form id="custom-form" action="/api/admin"><button type="submit">Submit</button></form>
</div>`;

test.describe('Normal preview custom active content policy', () => {
    test('blocks by default, requires explicit trust, and leaves project/export data unchanged', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview active content policy');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);

        await page.evaluate(
            ({ html }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const navigation = bridge.documentManager.getNavigation();
                const pageMap = navigation.get(0);
                const pageId = pageMap.get('id');
                const blockId = bridge.structureBinding.createBlock(pageId, 'Policy test');
                bridge.structureBinding.createComponent(pageId, blockId, 'text', {
                    htmlContent: html,
                    jsonProperties: { nestedHtml: '<img src="missing" onerror="window.__propertyHandler=true">' },
                });
                const metadata = bridge.documentManager.getMetadata();
                metadata.set('extraHeadContent', '<script>window.__customHeaderExecuted=true</script>');
                metadata.set('footer', '<script>window.__customFooterExecuted=true</script><p>Footer marker</p>');
            },
            { html: componentHtml },
        );

        await page.locator('#head-bottom-preview').click();
        await expect(page.locator('#previewsidenav')).toHaveClass(/active/);
        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);
        await frame.locator('#custom-content').waitFor({ state: 'attached' });

        const executionState = await frame.locator('body').evaluate(() => ({
            script: (window as any).__customScriptExecuted,
            handler: (window as any).__handlerExecuted,
            javascriptUrl: (window as any).__javascriptUrlExecuted,
            svgHandler: (window as any).__svgHandlerExecuted,
            svgScript: (window as any).__svgScriptExecuted,
            header: (window as any).__customHeaderExecuted,
            footer: (window as any).__customFooterExecuted,
        }));
        expect(executionState).toEqual({});
        await expect(frame.locator('#custom-javascript-link')).not.toHaveAttribute('href');
        await expect(frame.locator('#custom-srcdoc')).not.toHaveAttribute('srcdoc');
        await expect(frame.locator('#custom-srcdoc')).toHaveAttribute('sandbox', '');
        await expect(frame.locator('#custom-object')).toHaveCount(0);
        await expect(frame.locator('#custom-embed')).toHaveCount(0);
        await expect(frame.locator('#custom-form')).not.toHaveAttribute('action');

        const warning = page.locator('#preview-active-content-button');
        await expect(warning).toBeVisible();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');
        await expect(warning).toHaveAccessibleName(/disabled in the editor preview/i);

        await warning.click();
        const modal = page.locator('#modalConfirm');
        await expect(modal)
            .toContainText('This is a trust decision', { timeout: 5000 })
            .catch(async () => {
                await expect(modal).toContainText('Enable it only when you trust the project');
            });
        const stacking = await page.evaluate(() => {
            const preview = document.querySelector('#previewsidenav');
            const backdrop = document.querySelector('.modal-backdrop');
            const dialog = document.querySelector('#modalConfirm');
            const content = dialog?.querySelector('.modal-content');
            if (!preview || !backdrop || !dialog || !content) return null;

            const bounds = content.getBoundingClientRect();
            const topElement = document.elementFromPoint(
                bounds.left + bounds.width / 2,
                bounds.top + bounds.height / 2,
            );
            return {
                previewZIndex: Number.parseInt(getComputedStyle(preview).zIndex, 10),
                backdropZIndex: Number.parseInt(getComputedStyle(backdrop).zIndex, 10),
                dialogZIndex: Number.parseInt(getComputedStyle(dialog).zIndex, 10),
                dialogIsTopmost: Boolean(topElement?.closest('#modalConfirm')),
            };
        });
        expect(stacking).not.toBeNull();
        expect(stacking!.backdropZIndex).toBeGreaterThan(stacking!.previewZIndex);
        expect(stacking!.dialogZIndex).toBeGreaterThan(stacking!.backdropZIndex);
        expect(stacking!.dialogIsTopmost).toBe(true);
        await modal.getByRole('button', { name: 'Enable custom JavaScript for this preview' }).click();

        await expect(warning).toHaveAttribute('aria-pressed', 'true');
        await expect
            .poll(() =>
                frame.locator('body').evaluate(() => ({
                    script: (window as any).__customScriptExecuted,
                    handler: (window as any).__handlerExecuted,
                    header: (window as any).__customHeaderExecuted,
                    footer: (window as any).__customFooterExecuted,
                })),
            )
            .toEqual({ script: true, handler: true, header: true, footer: true });

        await warning.click();
        await modal.getByRole('button', { name: 'Disable custom JavaScript' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');

        const integrity = await page.evaluate(
            async ({ expectedHtml }) => {
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
                const navigation = bridge.documentManager.getNavigation();
                const component = navigation.get(0).get('blocks').get(0).get('components').get(0);
                const storedHtml = String(component.get('htmlContent'));
                const exported = await (window as any).SharedExporters.quickExport(
                    'html5',
                    bridge.documentManager,
                    bridge.assetCache || null,
                    bridge.resourceFetcher || null,
                    {},
                    bridge.assetManager || null,
                );
                const files = (window as any).fflate.unzipSync(new Uint8Array(exported.data));
                const indexHtml = new TextDecoder().decode(files['index.html']);
                return {
                    storedUnchanged: storedHtml === expectedHtml,
                    exportHasComponentScript: indexHtml.includes('window.__customScriptExecuted = true'),
                    exportHasHeaderScript: indexHtml.includes('window.__customHeaderExecuted=true'),
                    exportHasFooterScript: indexHtml.includes('window.__customFooterExecuted=true'),
                };
            },
            { expectedHtml: componentHtml },
        );
        expect(integrity).toEqual({
            storedUnchanged: true,
            exportHasComponentScript: true,
            exportHasHeaderScript: true,
            exportHasFooterScript: true,
        });
    });
});
