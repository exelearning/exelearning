import { test, expect } from '../../fixtures/auth.fixture';
import { waitForEditor } from '../../helpers/editor-helpers';
import {
    addIdevice,
    editIdevice,
    gotoWorkarea,
    openLeftPanels,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

test('Multiple Choice plays its intro video in the form, and keeps it', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    const uuid = await createProject(page, 'Multiple Choice intro video');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions-multiple-choice');
    // The form is built when its question editor starts: wait, or what is
    // typed first is lost.
    await waitForEditor(page, 'seleccionaEText');
    const id = await page.locator('.idevice_node.quick-questions-multiple-choice').first().getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#seleccionaEQuestion').fill('What is the capital of France?');
    await page.locator('#seleccionaEOption0').fill('Paris');
    await page.locator('#seleccionaEOption1').fill('London');
    await page.locator('#seleccionaEOption2').fill('Rome');
    await page.locator('#seleccionaEOption3').fill('Berlin');
    await page.locator('#seleccionaESolution0').check();
    await page.locator('#quickMultipleQEIdeviceForm-tab-options').click();
    // With the side panels open, as an author on a small screen has them.
    await page.setViewportSize({ width: 1024, height: 900 });
    await openLeftPanels(page);
    // Replace only the external player; the actual play/close handlers and timer still run.
    await page.evaluate(() => {
        const win = window as any;
        win.YT = {};
        win.__introPlayback = null;
        win.__introPaused = false;
        win.$exeDevice.playerIntro = {
            loadVideoById: (request: unknown) => {
                win.__introPlayback = request;
            },
            getCurrentTime: () => 0,
            pauseVideo: () => {
                win.__introPaused = true;
            },
        };
    });
    const introVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    await page.locator('#seleccionaEVideoIntro').fill(introVideoUrl);
    await page.locator('#seleccionaEVideoIntroPlay').click();
    const intro = page.locator('#seleccionaEVIDiv');
    await expect(intro).toBeVisible();
    await expect(page.locator('#quickMultipleQEIdeviceForm-panel-contents')).toBeHidden();
    await expect(intro.locator('#seleccionaEVI')).toBeVisible();
    await expect(intro.locator('#seleccionaEVI')).toBeInViewport();
    await expect(intro.locator('#seleccionaEVIClose')).toBeFocused();
    await expect(intro.locator('#seleccionaEVIStart')).toBeVisible();
    await expect(intro.locator('#seleccionaEVIEnd')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__introPlayback.videoId)).toBe('dQw4w9WgXcQ');
    expect(
        await intro.evaluate(element => {
            const panel = element.closest('.tab-pane')!.getBoundingClientRect();
            return [element, ...element.querySelectorAll('input, button, video, a')].every(control => {
                const rect = control.getBoundingClientRect();
                return !rect.width || (rect.left >= panel.left && rect.right <= panel.right);
            });
        }),
    ).toBe(true);
    await page.locator('#seleccionaEVIClose').click();
    await expect(intro).toBeHidden();
    await expect(page.locator('#seleccionaEVideoIntroPlay')).toBeFocused();
    expect(await page.evaluate(() => (window as any).__introPaused)).toBe(true);
    await expect(page.locator('#seleccionaEVideoIntro')).toHaveValue(introVideoUrl);

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    // Reloaded below 1200px, the left panels come back folded.
    await openLeftPanels(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#quickMultipleQEIdeviceForm-tab-options').click();
    await expect(page.locator('#seleccionaEVideoIntro')).toHaveValue(introVideoUrl);
});
