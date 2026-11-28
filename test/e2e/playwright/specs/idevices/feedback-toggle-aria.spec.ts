import type { FrameLocator, Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    addTextIdevice,
    editIdevice,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    openPreviewAndWaitForContent,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

/**
 * E2E Tests for the state of the feedback toggle button ("Show feedback")
 * in the Text and Markdown Text iDevices. The button must point to the
 * feedback it shows (aria-controls) and say whether it is shown
 * (aria-expanded), so screen reader users know what happened after a click.
 */

/** Wait until the iDevice script is idle again (fadeIn/fadeOut finished). */
async function waitIdle(page: Page, objectName: '$text' | '$markdowntext') {
    await page.waitForFunction(
        name => {
            const frame = document.querySelector('iframe#preview-iframe') as HTMLIFrameElement | null;
            const win = frame?.contentWindow as (Window & Record<string, { working?: boolean }>) | null;
            return win?.[name]?.working === false;
        },
        objectName,
        { timeout: 10000 },
    );
}

/** Wait until the Case Study feedback animations in the preview have settled. */
async function waitCaseStudyIdle(page: Page) {
    await page.waitForFunction(
        () => {
            const frame = document.querySelector('iframe#preview-iframe') as HTMLIFrameElement | null;
            const win = frame?.contentWindow as (Window & { jQuery?: (sel: string) => { length: number } }) | null;
            const jq = win?.jQuery;
            return !jq || jq(':animated').length === 0;
        },
        undefined,
        { timeout: 10000 },
    );
}

/** Check aria-controls / aria-expanded through a show / hide cycle. */
async function expectAccessibleToggle(
    page: Page,
    frame: FrameLocator,
    idevice: Locator,
    objectName: '$text' | '$markdowntext',
    feedbackText: string,
) {
    const button = idevice.locator('input.feedbacktooglebutton').first();
    const feedback = idevice.locator('.feedback.js-feedback').first();
    await expect(button).toBeVisible();
    await expect(idevice).toHaveClass(/loaded/, { timeout: 10000 });

    // The button points to the feedback it controls, and it starts collapsed.
    const feedbackId = await feedback.getAttribute('id');
    expect(feedbackId).toBeTruthy();
    await expect(button).toHaveAttribute('aria-controls', feedbackId as string);
    await expect(frame.locator(`[id="${feedbackId}"]`)).toHaveCount(1);
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(feedback).toBeHidden();

    await button.click();
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText(feedbackText);
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    await waitIdle(page, objectName);
    await button.click();
    await expect(feedback).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
}

test.describe('Feedback toggle button state', () => {
    test('Text iDevice: aria-controls and aria-expanded follow the feedback', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Text feedback aria');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextIdevice(page);
        await page.waitForFunction(
            () => {
                const t = (window as any).tinymce;
                return ['textTextarea', 'textFeedbackTextarea'].every(id => {
                    const editor = t?.get(id);
                    return !!editor && editor.initialized && !editor.removed;
                });
            },
            undefined,
            { timeout: 20000 },
        );
        await page.evaluate(() => {
            const t = (window as any).tinymce;
            t.get('textTextarea').setContent('<p>Text feedback main content</p>');
            t.get('textFeedbackTextarea').setContent('<p>Text feedback answer</p>');
        });
        const block = page.locator('#node-content article .idevice_node.text').last();
        await block.locator('.btn-save-idevice').click();
        await expect(block).not.toHaveAttribute('mode', 'edition', { timeout: 20000 });

        await openPreviewAndWaitForContent(page);
        const frame = getPreviewFrame(page);
        const idevice = frame.locator('.idevice_node.text').filter({ hasText: 'Text feedback main content' }).first();
        await expect(idevice).toBeVisible({ timeout: 15000 });
        await expectAccessibleToggle(page, frame, idevice, '$text', 'Text feedback answer');
    });

    test('Markdown Text iDevice: aria-controls and aria-expanded follow the feedback', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Markdown feedback aria');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await expandIdeviceCategory(page, /Information|Información/i);
        await addIdevice(page, 'markdown-text');
        const article = page.locator('#node-content article .idevice_node.markdown-text').first();
        const ideviceId = (await article.getAttribute('id')) as string;
        await editIdevice(page, ideviceId).catch(() => {});

        const body = page.locator(`#${ideviceId} #markdownTextarea`).first();
        await body.waitFor({ state: 'visible', timeout: 5000 });
        await body.fill('Markdown feedback main content');
        const fieldset = page.locator(`#${ideviceId} #markdownFeedback`).first();
        await fieldset.locator('legend a').click();
        const feedbackInput = page.locator(`#${ideviceId} #markdownFeedbackTextarea`).first();
        await feedbackInput.waitFor({ state: 'visible', timeout: 5000 });
        await feedbackInput.fill('Markdown feedback answer');
        await saveIdevice(page, ideviceId);

        await openPreviewAndWaitForContent(page);
        const frame = getPreviewFrame(page);
        const idevice = frame
            .locator('.idevice_node.markdown-text')
            .filter({ hasText: 'Markdown feedback main content' })
            .first();
        await expect(idevice).toBeVisible({ timeout: 15000 });
        await expectAccessibleToggle(page, frame, idevice, '$markdowntext', 'Markdown feedback answer');
    });

    test('Case Study iDevice: aria-expanded stays in sync under rapid clicks', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Case study feedback aria');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await expandIdeviceCategory(page, /Information|Información/i);
        await addIdevice(page, 'casestudy');

        const article = page.locator('#node-content article .idevice_node.casestudy').first();
        const ideviceId = (await article.getAttribute('id')) as string;
        await editIdevice(page, ideviceId).catch(() => {});

        // The editor has the story plus one default activity, each a TinyMCE editor.
        await page.waitForFunction(
            () => {
                const t = (window as any).tinymce;
                if (!t) return false;
                const story = t.get('textStoryTextarea');
                const activity = t.editors.find((e: any) => e.id.startsWith('activityTextarea-'));
                const feedback = t.editors.find((e: any) => e.id.startsWith('activityFeedbackTextarea-'));
                return [story, activity, feedback].every(e => e?.initialized && !e.removed);
            },
            undefined,
            { timeout: 20000 },
        );
        await page.evaluate(() => {
            const t = (window as any).tinymce;
            t.get('textStoryTextarea').setContent('<p>Case study main story</p>');
            t.editors
                .find((e: any) => e.id.startsWith('activityTextarea-'))
                .setContent('<p>Case study activity question</p>');
            t.editors
                .find((e: any) => e.id.startsWith('activityFeedbackTextarea-'))
                .setContent('<p>Case study feedback answer</p>');
        });
        await saveIdevice(page, ideviceId);

        await openPreviewAndWaitForContent(page);
        const frame = getPreviewFrame(page);
        const idevice = frame.locator('.idevice_node.casestudy').filter({ hasText: 'Case study main story' }).first();
        await expect(idevice).toBeVisible({ timeout: 15000 });

        const button = idevice.locator('.CSP-FeedbackBtn').first();
        const feedback = idevice.locator('.CSP-FeedbackText').first();
        await expect(button).toBeVisible();

        // Wait until addEvents has linked the button to its feedback (it runs
        // after the template is already on screen), then read the generated id
        // from the button. The button points to its feedback and starts collapsed.
        await expect(button).toHaveAttribute('aria-controls', /^exe-feedback-/);
        const feedbackId = (await button.getAttribute('aria-controls')) as string;
        await expect(feedback).toHaveAttribute('id', feedbackId);
        await expect(frame.locator(`[id="${feedbackId}"]`)).toHaveCount(1);
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(feedback).toBeHidden();

        // Two clicks in the same tick: the second lands while the feedback is
        // still animating. The animation guard must ignore it, so the feedback
        // ends shown and aria-expanded stays true. Without the guard the second
        // click toggles it back and the final state desyncs (hidden / "false").
        await button.evaluate((el: HTMLInputElement) => {
            el.click();
            el.click();
        });
        await waitCaseStudyIdle(page);
        await expect(feedback).toBeVisible();
        await expect(feedback).toContainText('Case study feedback answer');
        await expect(button).toHaveAttribute('aria-expanded', 'true');
    });
});
