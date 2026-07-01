import { test, expect } from '../fixtures/auth.fixture';
import type { FrameLocator, Page } from '@playwright/test';
import {
    waitForAppReady,
    gotoWorkarea,
    selectPageByIndex,
    addTextIdeviceWithContent,
    editTextIdevice,
    cloneCurrentPage,
    enableSearchOption,
    openPreviewAndWaitForContent,
    getPreviewFrame,
} from '../helpers/workarea-helpers';

/**
 * E2E tests for the shared keyboard-navigation module (exe_export.js
 * `keyboardNav`). The preview iframe renders the exact same HTML/JS as a real
 * exported package, so exercising the shortcuts here also covers exports.
 */

async function getIframeUrl(page: Page): Promise<string> {
    return page.evaluate(() => {
        const iframe = document.querySelector('#preview-iframe') as HTMLIFrameElement;
        try {
            return iframe?.contentWindow?.location?.href ?? '';
        } catch {
            return '';
        }
    });
}

/**
 * <body> isn't naturally focusable, so `locator('body').press()` can silently
 * fail to deliver key events to the frame's document. Click a safe,
 * non-interactive element first (the page heading) to establish real focus
 * inside the iframe, matching how a real user would interact with the page
 * before using a keyboard shortcut.
 */
async function focusPreviewContent(iframe: FrameLocator): Promise<void> {
    await iframe.locator('main h1').first().click();
}

/**
 * Press a key inside the preview iframe and wait for the resulting full-page
 * navigation (arrow-key shortcuts click a real <a>, so the iframe reloads).
 */
async function pressAndWaitForNav(page: Page, iframe: FrameLocator, key: string): Promise<void> {
    const prevUrl = await getIframeUrl(page);
    await focusPreviewContent(iframe);
    await page.keyboard.press(key);
    await page.waitForFunction(
        (prev: string) => {
            const el = document.querySelector('#preview-iframe') as HTMLIFrameElement;
            try {
                const doc = el?.contentDocument ?? el?.contentWindow?.document;
                const curr = el?.contentWindow?.location?.href ?? '';
                return curr !== prev && curr.length > 0 && doc?.readyState === 'complete';
            } catch {
                return false;
            }
        },
        prevUrl,
        { timeout: 15000 },
    );
}

test.describe('Keyboard navigation in preview', () => {
    test('supports arrow-key page navigation, menu toggle, and search shortcut', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Keyboard Navigation Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // Search is optional per spec, but we enable it here to also cover the search shortcut.
        await enableSearchOption(page);

        // Build 3 pages with distinct, greppable content.
        await selectPageByIndex(page, 0);
        await addTextIdeviceWithContent(page, '<p>KEYNAV_PAGE_ONE</p>');
        await cloneCurrentPage(page);
        await cloneCurrentPage(page);

        await selectPageByIndex(page, 1);
        await editTextIdevice(page, 'KEYNAV_PAGE_TWO');

        await selectPageByIndex(page, 2);
        await editTextIdevice(page, 'KEYNAV_PAGE_THREE');

        // Start preview from the first page.
        await selectPageByIndex(page, 0);
        await openPreviewAndWaitForContent(page);
        const iframe = getPreviewFrame(page);

        await expect(iframe.locator('body')).toContainText('KEYNAV_PAGE_ONE');

        // ArrowRight -> next page
        await pressAndWaitForNav(page, iframe, 'ArrowRight');
        await expect(iframe.locator('body')).toContainText('KEYNAV_PAGE_TWO');

        // ArrowRight -> next page again
        await pressAndWaitForNav(page, iframe, 'ArrowRight');
        await expect(iframe.locator('body')).toContainText('KEYNAV_PAGE_THREE');

        // ArrowLeft -> previous page
        await pressAndWaitForNav(page, iframe, 'ArrowLeft');
        await expect(iframe.locator('body')).toContainText('KEYNAV_PAGE_TWO');

        // ArrowDown -> last page (regardless of current position)
        await pressAndWaitForNav(page, iframe, 'ArrowDown');
        await expect(iframe.locator('body')).toContainText('KEYNAV_PAGE_THREE');

        // ArrowUp -> first page (regardless of current position)
        await pressAndWaitForNav(page, iframe, 'ArrowUp');
        await expect(iframe.locator('body')).toContainText('KEYNAV_PAGE_ONE');

        // "m" toggles the nav menu (siteNav-off class on <body>).
        const navOffBefore = await iframe.locator('body').evaluate(el => el.classList.contains('siteNav-off'));
        await focusPreviewContent(iframe);
        await page.keyboard.press('m');
        await expect
            .poll(() => iframe.locator('body').evaluate(el => el.classList.contains('siteNav-off')))
            .toBe(!navOffBefore);

        // Alt+M toggles it back, proving the non-character alternative also works.
        await focusPreviewContent(iframe);
        await page.keyboard.press('Alt+m');
        await expect
            .poll(() => iframe.locator('body').evaluate(el => el.classList.contains('siteNav-off')))
            .toBe(navOffBefore);

        // Alt+/ reveals and focuses the search input (search was enabled above).
        const searchToggler = iframe.locator('#searchBarTogger');
        await searchToggler.waitFor({ state: 'visible', timeout: 10000 });
        await focusPreviewContent(iframe);
        await page.keyboard.press('Alt+/');
        await expect
            .poll(() => iframe.locator('body').evaluate(() => document.activeElement?.id ?? ''))
            .toBe('exe-client-search-text');
    });

    test('does not hijack shortcuts while typing in the search input', async ({ authenticatedPage, createProject }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Keyboard Navigation Typing Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await enableSearchOption(page);

        await selectPageByIndex(page, 0);
        await addTextIdeviceWithContent(page, '<p>KEYNAV_TYPING_PAGE_ONE</p>');
        await cloneCurrentPage(page);

        await selectPageByIndex(page, 1);
        await editTextIdevice(page, 'KEYNAV_TYPING_PAGE_TWO');

        await selectPageByIndex(page, 0);
        await openPreviewAndWaitForContent(page);
        const iframe = getPreviewFrame(page);

        const searchToggler = iframe.locator('#searchBarTogger');
        await searchToggler.waitFor({ state: 'visible', timeout: 10000 });
        await searchToggler.click();

        const searchInput = iframe.locator('#exe-client-search-text');
        await searchInput.waitFor({ state: 'visible', timeout: 5000 });

        // Typing "m" and ArrowRight while focus is in the search field must not
        // toggle the menu or navigate away from the current page.
        await searchInput.press('m');
        await searchInput.press('ArrowRight');

        await expect(iframe.locator('body')).toContainText('KEYNAV_TYPING_PAGE_ONE');
        await expect(searchInput).toBeFocused();
    });

    test('"t" toggles the Teacher Mode content layer when it is active', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Keyboard Navigation Teacher Mode Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdeviceWithContent(page, '<p>KEYNAV_TEACHER_CONTENT</p>');

        // Mark the iDevice as teacher-only via its Properties modal (see
        // teacher-only-highlight-nova.spec.ts for the same flow).
        const node = page.locator('#node-content article .idevice_node.text').first();
        await node.waitFor({ state: 'visible', timeout: 15000 });
        await node.locator('button[id^="dropdownMenuButtonIdevice"]').click();
        await node.locator('button[id^="propertiesIdevice"]').first().click();

        const modal = page.locator('#modalProperties');
        await modal.waitFor({ state: 'visible', timeout: 10000 });
        const teacherToggle = modal.locator('#teacherOnly input.toggle-input');
        await teacherToggle.waitFor({ state: 'attached', timeout: 5000 });
        await teacherToggle.check();
        await modal.locator('button.btn.btn-primary').first().click();
        await modal.waitFor({ state: 'hidden', timeout: 10000 });

        // The authoring preview always loads the viewer with ?exe-teacher=1 (see
        // teacher-mode-url-param.spec.ts), so with teacher-only content present the
        // self-serve #teacher-mode-toggler becomes available automatically.
        await openPreviewAndWaitForContent(page);
        const iframe = getPreviewFrame(page);

        const teacherToggler = iframe.locator('#teacher-mode-toggler');
        await teacherToggler.waitFor({ state: 'attached', timeout: 15000 });
        await expect(teacherToggler).not.toBeChecked();

        const isTeacherModeOn = () => iframe.locator('html').evaluate(el => el.classList.contains('mode-teacher'));
        await expect.poll(isTeacherModeOn).toBe(false);

        // "t" reveals the teacher-only content layer...
        await focusPreviewContent(iframe);
        await page.keyboard.press('t');
        await expect.poll(isTeacherModeOn).toBe(true);
        await expect(teacherToggler).toBeChecked();

        // ...and pressing it again hides it (real toggle, not one-shot).
        await focusPreviewContent(iframe);
        await page.keyboard.press('t');
        await expect.poll(isTeacherModeOn).toBe(false);
        await expect(teacherToggler).not.toBeChecked();
    });

    test('"t" does nothing when Teacher Mode is not active (no teacher-only content)', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Keyboard Navigation No Teacher Mode Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addTextIdeviceWithContent(page, '<p>KEYNAV_NO_TEACHER_CONTENT</p>');

        await openPreviewAndWaitForContent(page);
        const iframe = getPreviewFrame(page);

        // No teacher-only content on the page, so the toggler must not exist,
        // regardless of the preview's default ?exe-teacher=1 parameter.
        await expect(iframe.locator('#teacher-mode-toggler')).toHaveCount(0);

        await focusPreviewContent(iframe);
        await page.keyboard.press('t');
        await page.waitForTimeout(300);

        await expect(iframe.locator('html')).not.toHaveClass(/mode-teacher/);
        await expect(iframe.locator('body')).toContainText('KEYNAV_NO_TEACHER_CONTENT');
    });
});
