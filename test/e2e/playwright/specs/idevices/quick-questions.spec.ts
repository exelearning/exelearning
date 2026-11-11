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

test('Quick Questions plays its intro video in the form, and keeps it', async ({
    authenticatedPage: page,
    createProject,
}) => {
    // Saving and reloading the project takes most of a minute in Firefox.
    test.setTimeout(90_000);
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    const uuid = await createProject(page, 'Quick Questions intro video');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions');
    // The form is built when its question editor starts: wait, or what is
    // typed first is lost.
    await waitForEditor(page, 'quextEText');
    const id = await page.locator('.idevice_node.quick-questions').first().getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#quextEQuestion').fill('What is the capital of France?');
    await page.locator('#quextEOption0').fill('Paris');
    await page.locator('#quextEOption1').fill('London');
    await page.locator('#quextEOption2').fill('Rome');
    await page.locator('#quextEOption3').fill('Berlin');
    await page.locator('#gameQEIdeviceForm-tab-options').click();
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
    await page.locator('#quextEVideoIntro').fill(introVideoUrl);
    await page.locator('#quextEVideoIntroPlay').click();
    const intro = page.locator('#quextEVIDiv');
    await expect(intro).toBeVisible();
    await expect(page.locator('#gameQEIdeviceForm-panel-contents')).toBeHidden();
    await expect(intro.locator('#quextEVI')).toBeVisible();
    await expect(intro.locator('#quextEVI')).toBeInViewport();
    await expect(intro.locator('#quextEVIClose')).toBeFocused();
    await expect(intro.locator('#quextEVIStart')).toBeVisible();
    await expect(intro.locator('#quextEVIEnd')).toBeVisible();
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
    await page.locator('#quextEVIClose').click();
    await expect(intro).toBeHidden();
    await expect(page.locator('#quextEVideoIntroPlay')).toBeFocused();
    expect(await page.evaluate(() => (window as any).__introPaused)).toBe(true);
    await expect(page.locator('#quextEVideoIntro')).toHaveValue(introVideoUrl);

    await saveIdevice(page, id!);
    await saveProject(page);
    await reloadPage(page);
    // Reloaded below 1200px, the left panels come back folded.
    await openLeftPanels(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await expect(page.locator('#quextEVideoIntro')).toHaveValue(introVideoUrl);
});

test('Quick Questions imports the text of Moodle questions without running their HTML', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await page.route('https://www.youtube.com/iframe_api', route => route.abort());
    // Every request for the probe image fails at once.
    await page.route('**/moodle-probe.png', route => route.fulfill({ status: 404, body: '' }));
    const uuid = await createProject(page, 'Quick Questions Moodle import');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'quick-questions');
    await waitForEditor(page, 'quextEText');

    // An image whose handler would run if the question text were parsed in the page.
    const quiz = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <questiontext format="html"><text><![CDATA[<p>Capital of France?<img src="/moodle-probe.png" onerror="window.ranImportedHtml = true"></p>]]></text></questiontext>
    <answer fraction="100"><text>Paris</text></answer>
    <answer fraction="0"><text>Rome</text></answer>
  </question>
</quiz>`;
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'questions.xml',
        mimeType: 'text/xml',
        buffer: Buffer.from(quiz),
    });
    await expect(page.locator('#quextEQuestion')).toHaveValue('Capital of France?');

    // The same image, loaded now in the page: once its handler has run, the imported one's would have.
    await page.evaluate(() => {
        const image = document.createElement('img');
        image.onerror = () => ((window as any).ranControl = true);
        image.src = '/moodle-probe.png';
    });
    await page.waitForFunction(() => (window as any).ranControl === true);
    expect(await page.evaluate(() => (window as any).ranImportedHtml)).toBeUndefined();
});
