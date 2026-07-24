import { test, expect } from '../fixtures/auth.fixture';
import { skipInStaticMode } from '../fixtures/auth.fixture';
import {
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    selectFirstPage,
    waitForAppReady,
} from '../helpers/workarea-helpers';

const componentHtml = `
<div id="custom-content">
    <script>window.__customScriptExecuted = true; document.body.setAttribute('data-marker', 'ran');</script>
    <img id="custom-error-image" src="missing-preview-image" onerror="window.__handlerExecuted = true">
    <a id="custom-javascript-link" href="javascript:window.__javascriptUrlExecuted=true">Run</a>
    <svg id="custom-svg" onload="window.__svgHandlerExecuted=true"><script>window.__svgScriptExecuted=true</script></svg>
    <iframe id="custom-srcdoc" srcdoc="<script>parent.__srcdocExecuted=true</script>"></iframe>
    <object id="custom-object" data="data:text/html,<script>parent.__objectExecuted=true</script>"></object>
    <embed id="custom-embed" src="data:image/svg+xml,<svg onload='parent.__embedExecuted=true'/>">
    <form id="custom-form" action="/api/admin"><button type="submit">Submit</button></form>
    <iframe id="custom-youtube" src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>
</div>`;

async function seedActiveContent(page: import('@playwright/test').Page): Promise<void> {
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
}

test.describe('Preview trust boundary — default filtered state', () => {
    test('blocks author active content by default and never mutates project/export data', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview active content policy');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await seedActiveContent(page);

        await page.locator('#head-bottom-preview').click();
        await expect(page.locator('#previewsidenav')).toHaveClass(/active/);
        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);
        await frame.locator('#custom-content').waitFor({ state: 'attached' });

        // Nothing author-supplied executes; MathJax/theme/iDevice runtime still work.
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
        // Official runtime scripts still load.
        expect(await frame.locator('script[src]').count()).toBeGreaterThan(0);

        const warning = page.locator('#preview-active-content-button');
        await expect(warning).toBeVisible();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');
        await expect(warning).toHaveAccessibleName(/disabled in the editor preview/i);

        // Neither the stored Yjs doc nor a real export is touched by preview filtering.
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

    test('the enable dialog defaults to the safe action (social-engineering resistance)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview enable dialog default');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        // Content shaped like a social-engineering lure: instructions to click enable.
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            const navigation = bridge.documentManager.getNavigation();
            const pageId = navigation.get(0).get('id');
            const blockId = bridge.structureBinding.createBlock(pageId, 'Lure');
            bridge.structureBinding.createComponent(pageId, blockId, 'text', {
                htmlContent:
                    '<p>To view this content, click the shield icon and enable custom JavaScript.</p>' +
                    '<script>window.__lure=true</script>',
            });
        });

        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        const frame = getPreviewFrame(page);
        await frame.locator('article, body').first().waitFor({ state: 'attached' });

        // Nothing auto-enables just because the content asked.
        await expect(page.locator('#preview-active-content-button')).toHaveAttribute('aria-pressed', 'false');

        await page.locator('#preview-active-content-button').click();
        const modal = page.locator('#modalConfirm');
        await expect(modal).toBeVisible();
        // The safe action must be the default: the enable button is not the
        // focused element, and dismissing the dialog leaves content disabled.
        const enableIsFocused = await page.evaluate(() => {
            const active = document.activeElement as HTMLElement | null;
            return active?.tagName === 'BUTTON' && /enable/i.test(active.textContent || '');
        });
        expect(enableIsFocused).toBe(false);
        await modal.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.locator('#preview-active-content-button')).toHaveAttribute('aria-pressed', 'false');
    });
});

test.describe('Preview trust boundary — opaque-on-enable (web/server)', () => {
    test.beforeEach(async ({}, testInfo) => {
        skipInStaticMode(test, testInfo, 'Opaque snapshot needs the server capability routes');
    });

    test('enabling switches to an opaque capability-URL iframe the parent cannot reach', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview opaque enable');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await seedActiveContent(page);

        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);

        // Capture capability-URL responses. Whether the browser *attaches* a
        // cookie to a same-site request from an opaque frame is browser-specific
        // (Firefox does, Chromium does not), but the server ignores it and never
        // sets one — that authless/cookieless serving is what the code
        // guarantees and is asserted here (and in depth by the integration suite).
        const snapshotResponses: Array<{ status: number; setCookie: string | undefined }> = [];
        page.on('response', response => {
            if (response.url().includes('/preview-snapshot/')) {
                snapshotResponses.push({ status: response.status(), setCookie: response.headers()['set-cookie'] });
            }
        });

        const warning = page.locator('#preview-active-content-button');
        await expect(warning).toBeVisible();
        await warning.click();
        const modal = page.locator('#modalConfirm');
        await expect(modal).toContainText('isolated context');
        await modal.getByRole('button', { name: 'Allow external scripts' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'true');

        // The active preview iframe is now opaque: sandbox without allow-same-origin, capability URL src.
        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/preview-snapshot/');
        const sandbox = await iframe.getAttribute('sandbox');
        expect(sandbox).toBeTruthy();
        expect(sandbox).not.toContain('allow-same-origin');

        const frame = getPreviewFrame(page);
        // The author marker DOES run inside the isolated frame.
        await expect.poll(() => frame.locator('body').getAttribute('data-marker')).toBe('ran');

        // A probe cannot reach the editor: parent access throws in the opaque origin.
        const parentReachable = await frame.locator('body').evaluate(() => {
            try {
                // Accessing the parent's document from an opaque origin throws.
                void (window.parent as any).document.cookie;
                return true;
            } catch {
                return false;
            }
        });
        expect(parentReachable).toBe(false);

        // The capability route served successfully and never issued a cookie.
        expect(snapshotResponses.length).toBeGreaterThan(0);
        expect(snapshotResponses.some(r => r.status === 200)).toBe(true);
        expect(snapshotResponses.every(r => !r.setCookie)).toBe(true);

        // The YouTube embed became an accessible "open in a new tab" placeholder.
        await expect(frame.locator('.exe-external-media-fallback')).toHaveCount(1);
        await expect(frame.locator('.exe-external-media-fallback a[target="_blank"]')).toHaveAttribute(
            'href',
            /youtube\.com\/embed\/dQw4w9WgXcQ/,
        );
        await expect(frame.locator('#custom-youtube')).toHaveCount(0);
    });

    test('disabling returns to the filtered SW preview and revokes the capability URL', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview opaque disable');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await seedActiveContent(page);

        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        const warning = page.locator('#preview-active-content-button');
        await warning.click();
        await page.locator('#modalConfirm').getByRole('button', { name: 'Allow external scripts' }).click();
        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/preview-snapshot/');
        const capabilityUrl = await iframe.getAttribute('src');

        await warning.click();
        await page.locator('#modalConfirm').getByRole('button', { name: 'Block external scripts' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'false');

        // Back to the same-origin SW preview — the iframe no longer carries the opaque sandbox.
        await expect.poll(async () => (await iframe.getAttribute('sandbox')) ?? '').not.toContain('allow-scripts');
        // The filtered SW preview reloads asynchronously; wait for it to replace
        // the opaque doc, then the author marker must be absent (script stripped).
        const frame = getPreviewFrame(page);
        await expect.poll(() => frame.locator('body').getAttribute('data-marker')).toBeNull();

        // The disposed capability URL now 404s.
        const status = await page.evaluate(async url => {
            const response = await fetch(url as string, { credentials: 'same-origin' });
            return response.status;
        }, capabilityUrl);
        expect(status).toBe(404);
    });

    test('a remote-origin update revokes the grant mid-session (D1)', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview D1 revocation');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await seedActiveContent(page);

        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        const warning = page.locator('#preview-active-content-button');
        await warning.click();
        await page.locator('#modalConfirm').getByRole('button', { name: 'Allow external scripts' }).click();
        await expect(warning).toHaveAttribute('aria-pressed', 'true');

        // A local (untagged) edit KEEPS the grant.
        await page.evaluate(() => {
            const bridge = (window as any).eXeLearning.app.project._yjsBridge;
            bridge.documentManager.getMetadata().set('subtitle', 'local edit');
        });
        await expect(warning).toHaveAttribute('aria-pressed', 'true');

        // A simulated REMOTE-origin update (a collaborator's applyUpdate) revokes it.
        await page.evaluate(() => {
            const Y = (window as any).Y;
            const ydoc = (window as any).eXeLearning.app.project._yjsBridge.documentManager.ydoc;
            const scratch = new Y.Doc();
            scratch.getMap('metadata').set('injected', 'remote');
            const update = Y.encodeStateAsUpdate(scratch);
            // A non-local, non-system origin object stands in for the ws provider.
            Y.applyUpdate(ydoc, update, { remoteProviderStub: true });
        });
        await expect(warning).toHaveAttribute('aria-pressed', 'false');
    });

    test('extractToNewTab opens the capability URL while enabled', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Preview extract opaque');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await seedActiveContent(page);

        await page.locator('#head-bottom-preview').click();
        await openPreviewPanel(page);
        await page.locator('#preview-active-content-button').click();
        await page.locator('#modalConfirm').getByRole('button', { name: 'Allow external scripts' }).click();
        const iframe = page.locator('#preview-iframe');
        await expect.poll(async () => (await iframe.getAttribute('src')) ?? '').toContain('/preview-snapshot/');

        const popupPromise = page.waitForEvent('popup');
        await page.locator('#preview-extract-button').click();
        const popup = await popupPromise;
        expect(popup.url()).toContain('/preview-snapshot/');
    });
});
