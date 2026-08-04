/**
 * Regression coverage for the trueorfalse editor on a questionless activity.
 *
 * A stored activity can carry valid JSON properties that hold no usable
 * question list — the key absent, or holding an object instead of an array.
 * Rendering survives that (#2192), but the editor did not: `transformObject`
 * returns an already-migrated payload untouched, so `$exeDevice.questionsGame`
 * became `undefined` and opening the activity threw
 * "can't access property length, $exeDevice.questionsGame is undefined",
 * after which the iDevice could no longer be saved.
 *
 * Both damaged shapes below are the ones shipped in
 * `pr2192-actividades-sin-preguntas.elpx`.
 */
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

const MISSING_ID = 'idevice-tof-missing-questions';
const NONARRAY_ID = 'idevice-tof-nonarray-questions';

/** Valid JSON for an already-migrated activity, minus a usable question list. */
const savedGame = (id: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
        id,
        ideviceId: id,
        typeGame: 'TrueOrFalse',
        eXeGameInstructions: '<p>Revision final</p>',
        eXeIdeviceTextAfter: '',
        msgs: {},
        questionsRandom: false,
        percentageQuestions: 100,
        time: 0,
        isTest: false,
        isScorm: 0,
        weighted: 100,
        evaluation: false,
        evaluationID: '',
        repeatActivity: true,
        textButtonScorm: 'Guardar puntuacion',
        ...extra,
    });

const renderedHtml = (id: string) => `<div class="exe-trueorfalse-container">
    <div class="TOFP-instructions"><p>Activity without questions</p></div>
    <div class="TOFP-MainContainer" id="tofPMainContainer-${id}"></div>
</div>`;

test.describe('Editing a game iDevice saved without questions', () => {
    test('the editor opens and the activity can be saved again', async ({ authenticatedPage, createProject }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Game without questions');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        const pageId = await page.evaluate(
            ({ missing, nonArray }) => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const firstPageId = bridge?.documentManager?.getNavigation()?.get(0)?.get('id');
                if (!firstPageId || !bridge?.structureBinding) {
                    throw new Error('Yjs project structure is not available');
                }

                const binding = bridge.structureBinding;
                for (const seed of [missing, nonArray]) {
                    const blockId = binding.createBlock(firstPageId, seed.id);
                    binding.createComponent(firstPageId, blockId, 'trueorfalse', {
                        id: seed.id,
                        htmlContent: seed.html,
                        jsonProperties: seed.jsonProperties,
                    });
                }

                return firstPageId;
            },
            {
                missing: {
                    id: MISSING_ID,
                    html: renderedHtml(MISSING_ID),
                    jsonProperties: savedGame(MISSING_ID),
                },
                nonArray: {
                    id: NONARRAY_ID,
                    html: renderedHtml(NONARRAY_ID),
                    jsonProperties: savedGame(NONARRAY_ID, { questionsGame: { 0: 'not an array' } }),
                },
            },
        );

        await page.locator(`#menu_nav_content .nav-element[nav-id="${pageId}"]`).click();
        await expect(page.locator(`.idevice_node#${MISSING_ID}`)).toBeVisible();

        // Opening the editor is what used to throw and leave the form dead.
        await page.locator(`#editIdevice${MISSING_ID}`).click();
        const questionEditor = page.locator('#tofEQuestionEditor');
        await questionEditor.waitFor({ state: 'attached', timeout: 20000 });
        expect(pageErrors, `page errors after opening the editor: ${pageErrors.join(' | ')}`).toEqual([]);

        // The empty list is seeded with one editable question, as for a new activity.
        await expect(page.locator('#tofENumQuestions')).toHaveText('1');

        // Write a question through the real editor and save the iDevice.
        await page.waitForFunction(
            () => {
                const editor = (window as any).tinymce?.get('tofEQuestionEditor');
                return Boolean(editor?.initialized && !editor.destroyed);
            },
            undefined,
            { timeout: 20000, polling: 200 },
        );
        await page.evaluate(() => {
            const editor = (window as any).tinymce.get('tofEQuestionEditor');
            editor.setContent('<p>Madrid is the capital of Spain</p>');
            editor.save();
        });
        await page.locator('#tofAnswerTrue').check();
        await page.locator(`.idevice_node[id="${MISSING_ID}"] .btn-save-idevice`).click();

        // The save must land a real question list on the component.
        await page.waitForFunction(
            id => {
                const binding = (window as any).eXeLearning?.app?.project?._yjsBridge?.structureBinding;
                const raw = binding?.getComponent(id)?.jsonProperties;
                if (!raw) return false;
                try {
                    return Array.isArray(JSON.parse(raw).questionsGame);
                } catch {
                    return false;
                }
            },
            MISSING_ID,
            { timeout: 20000, polling: 300 },
        );

        const stored = await page.evaluate(id => {
            const binding = (window as any).eXeLearning?.app?.project?._yjsBridge?.structureBinding;
            return JSON.parse(binding.getComponent(id).jsonProperties);
        }, MISSING_ID);

        expect(stored.questionsGame).toHaveLength(1);
        expect(stored.questionsGame[0].question).toContain('Madrid is the capital of Spain');
        expect(stored.questionsGame[0].solution).toBe(1);

        // The non-array shape must open just as cleanly.
        pageErrors.length = 0;
        await page.locator(`#editIdevice${NONARRAY_ID}`).click();
        await page.locator('#tofEQuestionEditor').waitFor({ state: 'attached', timeout: 20000 });
        await expect(page.locator('#tofENumQuestions')).toHaveText('1');
        expect(pageErrors, `page errors on the non-array activity: ${pageErrors.join(' | ')}`).toEqual([]);
    });
});
