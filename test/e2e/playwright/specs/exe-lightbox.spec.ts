import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { unzipSync } from '../../../../src/shared/export';
import {
    addTextIdevice,
    exportProjectAs,
    getPreviewFrame,
    gotoWorkarea,
    waitForAppReady,
    waitForPreviewContent,
} from '../helpers/workarea-helpers';

/**
 * Regression coverage for prettyPhoto (public/app/common/exe_lightbox), the
 * lightbox for `rel="lightbox"` links in saved content. The image-gallery
 * iDevice moved to stock SimpleLightbox; this spec pins the markup contracts
 * prettyPhoto still serves, in the preview and in an offline Web Site export:
 * a single image link, a `modalwindow` inline dialog (`href="#id"`), a YouTube
 * popup, and Esc to close.
 */

const IMAGE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4Y2xMEmIY1TCqYfhqAABHizIQlvhFxwAAAABJRU5ErkJggg==';

const CONTENT = `
<p><a id="e2e-lb-image" rel="lightbox" href="${IMAGE}" title="Red square"><img src="${IMAGE}" alt="Red square" width="16" height="16"></a></p>
<p><a id="e2e-lb-dialog" class="exe-dialog-link" rel="lightbox" href="#e2e-dialog-body">Open dialog</a></p>
<div id="e2e-dialog-body" class="exe-dialog-text js-hidden"><p>Inline dialog body</p></div>
<p><a id="e2e-lb-video" rel="lightbox" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ">Video</a></p>
`;

type Scope = Pick<Page, 'locator' | 'keyboard'>;

/** Add a Text iDevice whose main editor (not the feedback one) holds CONTENT. */
async function addTextWithLightboxLinks(page: Page): Promise<void> {
    await addTextIdevice(page);
    await page.waitForFunction(() => (window as any).tinymce?.get('textTextarea')?.initialized === true, undefined, {
        timeout: 15000,
    });
    await page.evaluate(html => (window as any).tinymce.get('textTextarea').setContent(html), CONTENT);
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.locator('.btn-save-idevice').click();
    await page.waitForFunction(
        () => document.querySelector('#node-content article .idevice_node.text')?.getAttribute('mode') !== 'edition',
        undefined,
        { timeout: 20000 },
    );
    await expect(block.locator('#e2e-lb-dialog')).toBeAttached();
}

async function expectClosed(scope: Scope): Promise<void> {
    await expect(scope.locator('.pp_pic_holder')).toHaveCount(0, { timeout: 5000 });
}

async function checkImageAndDialog(scope: Scope): Promise<void> {
    // Single image link
    await scope.locator('#e2e-lb-image').click();
    await expect(scope.locator('.pp_pic_holder #fullResImage')).toBeVisible({ timeout: 5000 });
    await expect(scope.locator('.pp_pic_holder #fullResImage')).toHaveAttribute('src', IMAGE);
    await scope.keyboard.press('Escape');
    await expectClosed(scope);

    // modalwindow inline dialog
    await scope.locator('#e2e-lb-dialog').click();
    await expect(scope.locator('.pp_inline')).toContainText('Inline dialog body', { timeout: 5000 });
    await scope.keyboard.press('Escape');
    await expectClosed(scope);
}

test.describe('prettyPhoto (exe_lightbox) content lightbox', () => {
    test('opens images, inline dialogs and YouTube links in the preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'exe_lightbox preview');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextWithLightboxLinks(page);

        expect(await waitForPreviewContent(page)).toBe(true);
        const frame = getPreviewFrame(page);
        await frame.locator('#e2e-lb-dialog').waitFor({ state: 'attached', timeout: 15000 });
        await page.waitForFunction(
            () => {
                const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement | null;
                const w = iframe?.contentWindow as any;
                return !!w?.jQuery?.fn?.prettyPhoto;
            },
            undefined,
            { timeout: 15000 },
        );

        const scope: Scope = { locator: s => frame.locator(s), keyboard: page.keyboard } as Scope;
        await checkImageAndDialog(scope);

        // YouTube links become an embed iframe (with the eXe https rewrite).
        await frame.locator('#e2e-lb-video').click();
        await expect(frame.locator('.pp_pic_holder iframe[src*="youtube.com/embed/aqz-KE-bpKQ"]')).toBeAttached({
            timeout: 5000,
        });
        await page.keyboard.press('Escape');
        await expectClosed(scope);
    });

    test('ships prettyPhoto in the Web Site export and works offline from file://', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'exe_lightbox export');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextWithLightboxLinks(page);

        const download = await exportProjectAs(page, 'html5');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-lightbox-html5-'));
        const zipPath = path.join(dir, 'package.zip');
        await download.saveAs(zipPath);
        const entries = unzipSync(fs.readFileSync(zipPath));
        for (const [name, data] of Object.entries(entries)) {
            if (name.endsWith('/')) continue;
            const target = path.join(dir, 'out', name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data);
        }
        const files = Object.keys(entries);
        expect(files.some(f => f.endsWith('exe_lightbox/exe_lightbox.js'))).toBe(true);
        expect(files.some(f => f.endsWith('exe_lightbox/exe_lightbox.css'))).toBe(true);
        // The image-gallery iDevice's SimpleLightbox is not needed here.
        expect(files.some(f => f.includes('simple-lightbox'))).toBe(false);

        const exported = await page.context().newPage();
        const external: string[] = [];
        await exported.route(/^(?!(file|data):)/, route => {
            external.push(route.request().url());
            return route.abort();
        });
        await exported.goto(pathToFileURL(path.join(dir, 'out', 'index.html')).href);
        await exported.waitForFunction(() => !!(window as any).jQuery?.fn?.prettyPhoto, undefined, {
            timeout: 15000,
        });
        await checkImageAndDialog(exported);
        expect(external).toEqual([]);
        await exported.close();
    });
});
