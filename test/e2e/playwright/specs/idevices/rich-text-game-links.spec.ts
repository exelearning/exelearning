import { test, expect } from '../../fixtures/auth.fixture';
import { storedIdevice } from '../../helpers/idevice-clock-helpers';
import {
    editIdevice,
    getPreviewFrame,
    gotoWorkarea,
    navigateToPageByTitle,
    openPreviewPanel,
    saveIdevice,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import { extractDataGame } from '../../../../../src/shared/export/worksheet/dataGameReader';

const LINK = 'https://es.wikipedia.org/wiki/An%C3%A9lido?literal=%2541';
const TEXT = `<p>Read about the <a href="${LINK}">anélido</a>.</p>`;
const COMPONENT_ID = 'idevice-rich-text-links';
const games = [
    { type: 'guess', prefix: 'adivina', questions: 'wordsGame' },
    { type: 'quick-questions', prefix: 'quext', questions: 'questionsGame' },
    { type: 'quick-questions-multiple-choice', prefix: 'selecciona', questions: 'selectsGame' },
];

for (const game of games) {
    for (const escaped of [false, true]) {
        test(`${game.type} preserves ${escaped ? 'legacy escaped' : 'raw'} rich-text links through editing and preview`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            // Two complete edition cycles and two independent previews exercise all readers of eText.
            test.setTimeout(90000);
            const uuid = await createProject(page, 'Rich-text links');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);

            await page.evaluate(
                ({ game, html, text, escaped, id }) => {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = html;
                    const carrier = wrapper.querySelector(`.${game.prefix}-DataGame`)!;
                    const helpers = (window as any).$exeDevices.iDevice.gamification.helpers;
                    const raw = carrier.textContent!.trim();
                    const data = JSON.parse(raw.startsWith('{') ? raw : helpers.decrypt(raw));
                    data[game.questions] = [
                        {
                            ...data[game.questions][0],
                            type: 3,
                            eText: escaped ? escape(text) : text,
                            audio: '',
                            time: 5,
                        },
                    ];
                    data.showMinimize = false;
                    data.itinerary.showCodeAccess = false;
                    data.percentajeQuestions = 100;
                    carrier.textContent = helpers.encrypt(JSON.stringify(data));
                    const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                    const parent = binding.createPage('Question links');
                    binding.createComponent(parent.id, binding.createBlock(parent.id), game.type, {
                        id,
                        htmlContent: wrapper.innerHTML,
                    });
                },
                { game, html: storedIdevice(game.type).html, text: TEXT, escaped, id: COMPONENT_ID },
            );
            await navigateToPageByTitle(page, 'Question links');

            const panel = page.locator('#previewsidenav');
            const checkRuntime = async () => {
                // The closed panel only slides off screen, so the helper may take it for open and
                // leave it closed; it is opened here unless the helper already did, and told apart
                // by its class.
                await openPreviewPanel(page);
                if (!/\bactive\b/.test((await panel.getAttribute('class')) ?? '')) {
                    await page.locator('#head-bottom-preview').click();
                }
                await expect(panel).toHaveClass(/\bactive\b/);
                const frame = getPreviewFrame(page);
                // The preview starts on the first page, and the game is on the second. Reopened, it
                // still holds the last document until the new one is drawn, which puts it back on
                // the first page: the whole check is repeated until it holds on the fresh one.
                await expect(async () => {
                    await frame.locator('nav a', { hasText: 'Question links' }).first().click({ timeout: 10000 });
                    await frame.locator(`#${game.prefix}StartGame-0`).click({ timeout: 10000 });
                    const link = frame.locator(`#${game.prefix}EText-0 a`);
                    await expect(link).toBeVisible({ timeout: 5000 });
                    await expect(link).toHaveAttribute('href', LINK, { timeout: 5000 });
                    await expect(link).toHaveText('anélido', { timeout: 5000 });
                }).toPass({ timeout: 60000 });
                await page.locator('#previewsidenavclose').click();
                await expect(panel).not.toHaveClass(/\bactive\b/);
            };
            // Check the original storage format in the export runtime before the editor normalizes it.
            await checkRuntime();

            for (let cycle = 0; cycle < 2; cycle++) {
                await editIdevice(page, COMPONENT_ID);
                const editorId = `${game.prefix}EText`;
                await expect
                    .poll(() =>
                        page.evaluate(id => {
                            const editor = (window as any).tinyMCE?.get(id);
                            return editor?.getBody()?.querySelector('a')?.getAttribute('href');
                        }, editorId),
                    )
                    .toBe(LINK);
                await page.evaluate(
                    ({ id, cycle }) => {
                        const editor = (window as any).tinyMCE.get(id);
                        editor.setContent(`${editor.getContent()}<p>Edit ${cycle + 1}</p>`);
                    },
                    { id: editorId, cycle },
                );
                await saveIdevice(page, COMPONENT_ID);

                // Inspect the saved Yjs content as well as the editor: a correct DOM could hide a bad save.
                const saved = await page.evaluate(id => {
                    const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                    return binding.getComponent(id).htmlContent as string;
                }, COMPONENT_ID);
                const data = extractDataGame<Record<string, { eText: string }[]>>(saved, game.prefix)!;
                expect(data[game.questions][0].eText).toContain(LINK);
                expect(data[game.questions][0].eText).toContain('anélido');
                expect(data[game.questions][0].eText).toContain(`Edit ${cycle + 1}`);
            }
            await checkRuntime();
        });
    }
}
