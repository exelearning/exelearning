import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import {
    addIdevice,
    editIdevice,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';

/**
 * E2E coverage for the Markdown Text iDevice.
 *
 * - Add → edit → save → reload preserves content.
 * - Preview tab renders the markdown.
 * - Feedback section saved values render in preview iframe and
 *   user-supplied button text is HTML-escaped in the value attribute.
 */

const IDEVICE_TYPE = 'markdown-text';
const IDEVICE_ARTICLE = `#node-content article .idevice_node.${IDEVICE_TYPE}`;

async function addMarkdownIdevice(page: Page): Promise<string> {
    await selectFirstPage(page);
    await expandIdeviceCategory(page, /Information|Información/i);
    await addIdevice(page, IDEVICE_TYPE);

    const article = page.locator(IDEVICE_ARTICLE).first();
    await article.waitFor({ state: 'visible', timeout: 10000 });
    const id = await article.getAttribute('id');
    if (!id) throw new Error('Markdown iDevice rendered without id');
    return id;
}

async function setEditorValue(page: Page, ideviceId: string, selector: string, value: string): Promise<void> {
    const textarea = page.locator(`#${ideviceId} ${selector}`).first();
    await textarea.waitFor({ state: 'visible', timeout: 5000 });
    await textarea.fill(value);
}

async function openFieldset(page: Page, ideviceId: string, fieldsetId: string): Promise<void> {
    // Closed fieldsets (`exe-fieldset-closed`) hide their content via CSS.
    // Click the legend link to toggle and wait for the class to disappear.
    const fieldset = page.locator(`#${ideviceId} #${fieldsetId}`).first();
    await fieldset.locator('legend a').click();
    await page.waitForFunction(
        ({ id, fid }) => {
            const node = document.querySelector(`.idevice_node[id="${id}"]`);
            const fs = node?.querySelector(`#${fid}`);
            return fs ? !fs.classList.contains('exe-fieldset-closed') : false;
        },
        { id: ideviceId, fid: fieldsetId },
        { timeout: 5000 },
    );
}

test.describe('Markdown Text iDevice', () => {
    test('persists main markdown content through save and reload', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Markdown Persistence');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const ideviceId = await addMarkdownIdevice(page);
        await editIdevice(page, ideviceId);

        const unique = `markdown content ${Date.now()}`;
        await setEditorValue(page, ideviceId, '#markdownTextarea', `# Heading\n\n${unique}`);

        await saveIdevice(page, ideviceId);
        await saveProject(page);

        await reloadPage(page);
        await waitForAppReady(page);

        const pageNode = page.locator('.nav-element:not([nav-id="root"]) > .nav-element-text').first();
        await pageNode.click({ force: true });

        await expect(page.locator(IDEVICE_ARTICLE)).toContainText(unique, { timeout: 15000 });
    });

    test('preview tab renders authored markdown as HTML', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Markdown Preview Tab');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const ideviceId = await addMarkdownIdevice(page);
        await editIdevice(page, ideviceId);

        await setEditorValue(page, ideviceId, '#markdownTextarea', '## subtitle');

        const editor = page.locator(`#${ideviceId} .exe-markdown-editor`).first();
        await editor.locator('[data-tab="preview"]').click();

        const previewPane = editor.locator('.exe-markdown-preview');
        await expect(previewPane.locator('h2')).toBeVisible();
        await expect(previewPane).toContainText('subtitle');
    });

    test('feedback section renders in preview and escapes attribute values', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Markdown Feedback');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const ideviceId = await addMarkdownIdevice(page);
        await editIdevice(page, ideviceId);

        await setEditorValue(page, ideviceId, '#markdownTextarea', 'Main body');

        // Feedback fieldset is collapsed by default; open it before
        // touching the inner inputs.
        await openFieldset(page, ideviceId, 'markdownFeedback');
        await setEditorValue(page, ideviceId, '#markdownFeedbackTextarea', 'Feedback body');

        const buttonInput = page.locator(`#${ideviceId} #markdownFeedbackInput`);
        await buttonInput.fill('Click "me" <x>');

        await saveIdevice(page, ideviceId);
        await saveProject(page);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const iframe = getPreviewFrame(page);
        const button = iframe.locator('input.feedbacktooglebutton').first();
        await expect(button).toBeVisible();
        // The literal characters survive intact: the attribute is escaped, not broken.
        await expect(button).toHaveAttribute('value', 'Click "me" <x>');
        await expect(iframe.locator('.feedback.js-feedback')).toContainText('Feedback body');
    });

    test('feedback toggle button shows and hides feedback panel on click', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Markdown Feedback Toggle');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const ideviceId = await addMarkdownIdevice(page);
        await editIdevice(page, ideviceId);

        await setEditorValue(page, ideviceId, '#markdownTextarea', 'Body content');

        await openFieldset(page, ideviceId, 'markdownFeedback');
        await setEditorValue(page, ideviceId, '#markdownFeedbackTextarea', 'Hidden feedback');

        await saveIdevice(page, ideviceId);
        await saveProject(page);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const iframe = getPreviewFrame(page);
        const button = iframe.locator('input.feedbacktooglebutton').first();
        const feedback = iframe.locator('.feedback.js-feedback').first();

        await expect(button).toBeVisible();
        // exe_export.js wires the click handler asynchronously after the static
        // HTML loads; wait for the "loaded" class so subsequent clicks bind.
        await expect(iframe.locator('.idevice_node.markdown-text').first()).toHaveClass(/loaded/, {
            timeout: 10000,
        });
        await expect(feedback).toBeHidden();

        await button.click();
        await expect(feedback).toBeVisible();
        await expect(feedback).toContainText('Hidden feedback');

        // The toggle uses jQuery fadeIn/fadeOut; the second click is ignored
        // while $markdowntext.working is true. Wait for the animation to settle.
        await page.waitForFunction(
            () => {
                const node = document.querySelector('iframe#preview-iframe') as HTMLIFrameElement | null;
                const win = node?.contentWindow as (Window & { $markdowntext?: { working?: boolean } }) | null;
                return win?.$markdowntext?.working === false;
            },
            null,
            { timeout: 10000 },
        );

        await button.click();
        await expect(feedback).toBeHidden();
    });
});
