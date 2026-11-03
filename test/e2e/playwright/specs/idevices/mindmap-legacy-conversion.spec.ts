import * as path from 'path';
import type { FrameLocator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    openElpFile,
    selectFirstPage,
    editIdevice,
    saveIdevice,
    saveProject,
    reloadPage,
} from '../../helpers/workarea-helpers';

/**
 * Legacy mind maps after the mindmaps editor was retired.
 *
 * test/fixtures/legacy-mindmaps.elpx was made with the mindmaps.app editor through the real
 * exemindmap plugin: a rich map (accents, emoji, CJK, `&`, quotes and `<clima>`, a folded
 * branch; 16 nodes), a simple one (3 nodes) and a large one (311 nodes), one per Text iDevice.
 * Maps stay as they are (PNG + source data) until the author converts one to Mermaid.
 */

const FIXTURE = path.resolve(__dirname, '../../../../fixtures/legacy-mindmaps.elpx');
const CONVERT = 'button:has-text("Convert to Mermaid")';

interface StoredIdevice {
    id: string;
    html: string;
}

/** The htmlView of every component of the first page, as stored in the Y.Doc. */
async function storedIdevices(page: Page): Promise<StoredIdevice[]> {
    return page.evaluate(() => {
        const doc = (window as any).eXeLearning.app.project._yjsBridge.getDocumentManager().getDoc();
        const blocks = doc.getArray('navigation').get(0).get('blocks');
        const result: { id: string; html: string }[] = [];
        for (let b = 0; b < blocks.length; b++) {
            const components = blocks.get(b).get('components');
            for (let c = 0; c < components.length; c++) {
                const comp = components.get(c);
                result.push({
                    id: comp.get('id'),
                    html: String(comp.get('htmlView') ?? comp.get('htmlContent') ?? ''),
                });
            }
        }
        return result;
    });
}

function editorFrame(page: Page): FrameLocator {
    return page.frameLocator('iframe#textTextarea_ifr');
}

async function editorContent(page: Page, id = 'textTextarea'): Promise<string> {
    await page.waitForFunction(editorId => (window as any).tinymce.get(editorId)?.initialized === true, id);
    return page.evaluate(editorId => (window as any).tinymce.get(editorId).getContent(), id);
}

async function openConversion(page: Page, mapIndex = 0) {
    await editorFrame(page).locator('.exe-mind-map img').nth(mapIndex).click();
    await page.locator(CONVERT).click();
    const dialog = page.locator('.tox-dialog');
    await expect(dialog.locator('.tox-dialog__title')).toHaveText('Convert to Mermaid');
    return dialog;
}

async function openProject(page: Page, createProject: (page: Page, title: string) => Promise<string>) {
    const uuid = await createProject(page, 'Legacy mind maps');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await openElpFile(page, FIXTURE);
    await selectFirstPage(page);
    await expect(page.locator('#node-content .exe-mind-map img')).toHaveCount(3);
}

test.describe('Legacy mind maps', () => {
    test('stay as images and convert to Mermaid only when the author asks', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        test.setTimeout(180000);
        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        const editorRequests: string[] = [];
        const externalRequests: string[] = [];
        let trackExternal = false;
        page.on('request', request => {
            const url = request.url();
            if (/mindmaps|exemindmap\/editor|exemindmap-editor/.test(url)) editorRequests.push(url);
            if (trackExternal && /^https?:/.test(url) && new URL(url).origin !== new URL(page.url()).origin) {
                externalRequests.push(url);
            }
        });

        await openProject(page, createProject);
        const original = await storedIdevices(page);
        expect(original).toHaveLength(3);

        // The PNGs are displayed (loaded, not placeholders) in the workarea
        for (const img of await page.locator('#node-content .exe-mind-map img').all()) {
            await expect(img).toBeVisible();
            expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
        }

        // No mind map button in the editor toolbar, and the map shows its image there too
        const [rich, simple, large] = original;
        await editIdevice(page, rich.id);
        await expect(editorFrame(page).locator('.exe-mind-map img')).toBeVisible();
        await expect(page.locator('.tox-tbtn[aria-label="Mind map"]')).toHaveCount(0);
        const before = await editorContent(page);

        // Converting needs nothing from the network: Pele is served by eXeLearning
        trackExternal = true;

        // Cancel leaves the content as it was
        let dialog = await openConversion(page);
        await expect(dialog).toContainText('not the colours, fonts, styles');
        await expect(dialog).toContainText('(16)');
        await expect(dialog.locator('svg.pele-mindmap .pele-node')).toHaveCount(16);
        // Recovered from the damaged legacy JSON (Pele wraps it on two lines)
        await expect(dialog.locator('svg.pele-mindmap')).toContainText('Hidrología & <clima>"comillas" \'simples\'');
        await dialog.locator('button:has-text("Cancel")').click();
        await expect(dialog).toBeHidden();
        expect(await editorContent(page)).toBe(before);

        // Keyboard: the contextual toolbar is reachable with Ctrl+F9 and the dialog closes with Escape
        await editorFrame(page).locator('.exe-mind-map img').click();
        await page.keyboard.press('Control+F9');
        await expect(page.locator(CONVERT)).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('.tox-dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.tox-dialog')).toBeHidden();
        expect(await editorContent(page)).toBe(before);

        // Confirm: one Mermaid diagram replaces the image; caption and source data are kept
        dialog = await openConversion(page);
        await dialog.locator('.tox-dialog__footer button:has-text("Convert to Mermaid")').click();
        await expect(dialog).toBeHidden();
        const frame = editorFrame(page);
        await expect(frame.locator('.exe-mind-map')).toHaveCount(0);
        await expect(frame.locator('.exe-mindmap-converted pre.mermaid')).toContainText('mindmap');
        await expect(frame.locator('.exe-mindmap-converted figcaption')).toHaveText('Mapa rico heredado');
        const converted = await editorContent(page);
        const codeOf = (html: string) => /<p class="exe-mindmap-code">([\s\S]*?)<\/p>/.exec(html)?.[1];
        expect(codeOf(converted)).toBe(codeOf(before));

        trackExternal = false;
        expect(externalRequests).toEqual([]);

        // It is one undo step
        await page.evaluate(() => (window as any).tinymce.get('textTextarea').undoManager.undo());
        expect(await editorContent(page)).toBe(before);
        await page.evaluate(() => (window as any).tinymce.get('textTextarea').undoManager.redo());
        expect(await editorContent(page)).toBe(converted);

        // Saved, it is drawn by Pele in the workarea; the other maps are untouched
        await saveIdevice(page, rich.id);
        const richNode = page.locator(`.idevice_node[id="${rich.id}"]`);
        await expect(richNode.locator('.exe-mindmap-converted pre.mermaid svg .pele-node')).toHaveCount(16);
        const afterConversion = await storedIdevices(page);
        expect(afterConversion.find(i => i.id === simple.id)?.html).toBe(simple.html);
        expect(afterConversion.find(i => i.id === large.id)?.html).toBe(large.html);

        // The converted diagram is now ordinary Mermaid, edited with the Mermaid dialog
        await editIdevice(page, rich.id);
        await editorFrame(page).locator('pre.mermaid').click();
        await page.evaluate(() => {
            const ed = (window as any).tinymce.get('textTextarea');
            ed.selection.select(ed.getBody().querySelector('pre.mermaid'));
        });
        // The main editor's menu bar (the feedback editor has its own)
        await page.locator('.tox-mbtn:has-text("Insert")').first().click();
        await page.locator('.tox-collection__item:has-text("Mermaid diagram")').click();
        const source = page.locator('.tox-dialog textarea').first();
        await expect(source).toHaveValue(/^mindmap\n/);
        await source.fill((await source.inputValue()).replace('Geología', 'Geología y minerales'));
        await page.locator('.tox-dialog .tox-button:has-text("Save")').click();
        await saveIdevice(page, rich.id);
        await expect(richNode.locator('pre.mermaid svg')).toContainText('Geología y minerales');

        // Saved and reopened, both kinds of map are still there
        await saveProject(page);
        await reloadPage(page);
        await selectFirstPage(page);
        await expect(page.locator('#node-content .exe-mind-map img')).toHaveCount(2);
        await expect(page.locator('#node-content .exe-mindmap-converted pre.mermaid svg')).toContainText(
            'Geología y minerales',
        );
        const reloaded = await storedIdevices(page);
        expect(reloaded.find(i => i.id === simple.id)?.html).toBe(simple.html);
        expect(reloaded.find(i => i.id === large.id)?.html).toBe(large.html);
        expect(codeOf(reloaded.find(i => i.id === rich.id)?.html ?? '')).toBe(codeOf(rich.html));

        // The preview (browser export) shows the PNG maps and the converted diagram
        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
        const preview = page.frameLocator('#preview-iframe');
        await preview.locator('article').first().waitFor({ state: 'attached', timeout: 40000 });
        await expect(preview.locator('.exe-mind-map img')).toHaveCount(2);
        await expect(preview.locator('.exe-mindmap-converted .exe-mermaid-rendered svg .pele-node')).toHaveCount(16);
        await expect(preview.locator('.exe-mindmap-code').first()).toBeHidden();

        expect(editorRequests).toEqual([]);
        expect(pageErrors).toEqual([]);
    });

    test('converts in the editor it was selected in and refuses damaged data', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        test.setTimeout(120000);
        await openProject(page, createProject);
        const [rich, simple] = await storedIdevices(page);

        // A Text iDevice has two editors: convert a map placed in the feedback one
        await editIdevice(page, simple.id);
        const mainBefore = await editorContent(page);
        const map = /<div class="exe-mind-map">[\s\S]*?<\/p>\s*<\/div>/.exec(rich.html)?.[0];
        expect(map).toBeTruthy();
        await page.evaluate(html => {
            const feedback = (window as any).tinymce.get('textFeedbackTextarea');
            feedback.setContent(html);
            feedback.focus();
            feedback.selection.select(feedback.getBody().querySelector('img'));
            feedback.nodeChanged();
            feedback.ui.registry.getAll().buttons.exemindmapconvert.onAction();
        }, map);
        const dialog = page.locator('.tox-dialog');
        await expect(dialog.locator('svg.pele-mindmap .pele-node')).toHaveCount(16);
        await dialog.locator('.tox-dialog__footer button:has-text("Convert to Mermaid")').click();
        await expect(dialog).toBeHidden();
        expect(await editorContent(page, 'textFeedbackTextarea')).toContain('<pre class="mermaid">mindmap');
        expect(await editorContent(page)).toBe(mainBefore);

        // A map whose source data cannot be read is explained and left alone
        await page.evaluate(() => {
            (window as any).tinymce
                .get('textTextarea')
                .setContent(
                    '<div class="exe-mind-map"><figure class="exe-figure exe-image position-center"><img src="x.png" alt="Damaged" /></figure><p class="exe-mindmap-code">{"mindmap":{"root":{"text":</p></div>',
                );
        });
        const damaged = await editorContent(page);
        await editorFrame(page).locator('.exe-mind-map img').click();
        await page.locator(CONVERT).click();
        await expect(page.locator('.tox-dialog')).toContainText('cannot be converted to Mermaid');
        await page.locator('.tox-dialog button:has-text("OK")').click();
        expect(await editorContent(page)).toBe(damaged);
    });
});
