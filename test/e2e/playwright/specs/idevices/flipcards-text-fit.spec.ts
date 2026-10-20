import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import {
    addIdevice,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';

/**
 * E2E coverage for how Memory cards size the text of a card.
 *
 * The size is measured, and only a real browser lays anything out, so this is
 * the only place the fit can be checked end to end. Two ways it used to get the
 * answer wrong, both ending with text clipped by the `overflow: hidden` on the
 * card:
 *
 * - a word too long to break ran past the edge without the block it sits in
 *   ever reporting more than the card's own width;
 * - a card the mode had hidden measured zero, so it kept the maximum size the
 *   fit had just stamped on it and was never measured again.
 */

const IDEVICE_TYPE = 'flipcards';
const IDEVICE_ARTICLE = `#node-content article .idevice_node.${IDEVICE_TYPE}`;
const MAX_FONT_SIZE = 26;

// No break opportunity anywhere in it, and wider than a card at 26px.
const UNBREAKABLE_WORD = 'electroencefalografista';
// Long enough that even the 400px card of the navigation mode has to shrink it,
// so a card that was never measured stands out against one that was.
const LONG_TEXT = [
    'La electroencefalografía registra la actividad eléctrica del encéfalo mediante',
    'electrodos colocados sobre el cuero cabelludo, y el especialista que interpreta',
    'esos registros necesita distinguir con precisión los ritmos alfa, beta, theta y',
    'delta, así como los grafoelementos epileptiformes que aparecen durante el sueño',
    'o la hiperventilación provocada en la consulta.',
].join(' ');

/**
 * @param page - The workarea.
 * @returns The id of the article the iDevice rendered into.
 */
async function addFlipcardsIdevice(page: Page): Promise<string> {
    await selectFirstPage(page);
    await expandIdeviceCategory(page, /Interactive activities|Actividades interactivas/i);
    await addIdevice(page, IDEVICE_TYPE);

    const article = page.locator(IDEVICE_ARTICLE).first();
    await article.waitFor({ state: 'visible', timeout: 10000 });
    const id = await article.getAttribute('id');
    if (!id) throw new Error('Flipcards iDevice rendered without id');
    return id;
}

/**
 * Fill both faces of the card on screen. The editor refuses a card with an
 * empty face, so both are always written.
 *
 * @param page - The workarea.
 * @param ideviceId - Article holding the editor.
 * @param text - Content for both faces.
 */
async function fillCard(page: Page, ideviceId: string, text: string): Promise<void> {
    await page.locator(`#${ideviceId} #flipcardsEText`).fill(text);
    await page.locator(`#${ideviceId} #flipcardsETextBack`).fill(text);
}

/**
 * Switch the activity to the mode that shows one card at a time.
 *
 * The mode lives in the Options fieldset, which the editor renders closed, and
 * a closed fieldset hides its contents.
 *
 * @param page - The workarea.
 * @param ideviceId - Article holding the editor.
 */
async function selectNavigationMode(page: Page, ideviceId: string): Promise<void> {
    const fieldset = page
        .locator(`#${ideviceId} fieldset.exe-fieldset`)
        .filter({ has: page.locator('#flipcardsETypeNavigation') })
        .first();
    await fieldset.locator('legend a').click();
    await page.waitForFunction(
        id => {
            const radio = document.querySelector(`#${id} #flipcardsETypeNavigation`) as HTMLElement | null;
            return !!radio?.offsetParent;
        },
        ideviceId,
        { timeout: 5000 },
    );
    await page.locator(`#${ideviceId} label[for="flipcardsETypeNavigation"]`).click();
}

/**
 * The size the fit settled on for every card face that carries text.
 *
 * @param page - The workarea, with the preview open.
 * @returns One entry per text block, in document order.
 */
async function fittedFontSizes(page: Page): Promise<number[]> {
    return getPreviewFrame(page)
        .locator('.FLCDSP-ETextDinamyc')
        .evaluateAll(blocks => blocks.map(block => parseFloat(window.getComputedStyle(block).fontSize)));
}

test.describe('Memory cards text fit', () => {
    test('shrinks a word too long to break so it stays inside the card', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Flipcards long word');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // The default mode shows every card at once, at 200px: the size the
        // report came in against.
        const ideviceId = await addFlipcardsIdevice(page);
        await fillCard(page, ideviceId, UNBREAKABLE_WORD);
        await saveIdevice(page, ideviceId);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const front = getPreviewFrame(page).locator('.FLCDSP-FlipCardFront .FLCDSP-ETextDinamyc').first();
        await front.waitFor({ state: 'attached', timeout: 15000 });

        // The word used to run ~262px across a ~184px card and lose its tail to
        // the overflow: hidden on the box. It now wraps instead, so it fits at
        // the size it was given without the fit having to shrink anything.
        await expect
            .poll(async () => front.evaluate(el => el.scrollWidth - el.clientWidth), { timeout: 15000 })
            .toBeLessThanOrEqual(1);

        const fits = await front.evaluate(el => {
            const box = el.parentElement as HTMLElement;
            return el.scrollHeight <= box.clientHeight && el.scrollWidth <= el.clientWidth;
        });
        expect(fits).toBe(true);

        const sizes = await fittedFontSizes(page);
        expect(sizes.length).toBeGreaterThan(0);
        for (const size of sizes) {
            expect(size).toBeLessThanOrEqual(MAX_FONT_SIZE);
        }
    });

    test('sizes a card the mode is holding back the same as the one on screen', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Flipcards hidden card');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const ideviceId = await addFlipcardsIdevice(page);
        // Navigation shows one card at a time, so everything after the first is
        // hidden when the fit runs.
        await selectNavigationMode(page, ideviceId);
        await fillCard(page, ideviceId, LONG_TEXT);
        await page.locator(`#${ideviceId} #flipcardsEAddC`).click();
        await fillCard(page, ideviceId, LONG_TEXT);
        await saveIdevice(page, ideviceId);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const fronts = getPreviewFrame(page).locator('.FLCDSP-FlipCardFront .FLCDSP-ETextDinamyc');
        await expect.poll(async () => fronts.count(), { timeout: 15000 }).toBe(2);

        // Same text, same box: the card waiting its turn has to come out at the
        // size the visible one did. It used to keep the 26px maximum, because a
        // hidden card measures zero and nothing measured it again on the way in.
        await expect
            .poll(async () => Math.max(...(await fittedFontSizes(page))), { timeout: 15000 })
            .toBeLessThan(MAX_FONT_SIZE);

        const sizes = await fittedFontSizes(page);
        expect(new Set(sizes).size).toBe(1);
    });
});
