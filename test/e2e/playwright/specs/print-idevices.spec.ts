/**
 * E2E Tests for Print iDevices
 *
 * File → Print iDevices walks the open project, reads each supported activity's stored data and
 * rebuilds it as a paper exercise. These tests cover the flow end to end against a real project:
 * the menu entry, the overlay, and the worksheet itself.
 *
 * The fixture (old_el_cid.elp) carries one Guess activity configured to ask 100% of its eight
 * questions in stored order, giving away 35% of each solution's letters. Those solutions add up
 * to 130 characters across 26 words — so the box counts below are the real numbers for that
 * project, not arbitrary expectations.
 *
 * Which letters are given away is drawn at random on each run, exactly as the activity does on
 * screen, so the hint assertions below bound the count rather than pinning it.
 */

import { chromium, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, openElpFile } from '../helpers/workarea-helpers';
import { encryptDataGame } from '../../../../src/shared/export/utils/dataGameCipher';

const FIXTURE = 'test/fixtures/old_el_cid.elp';

/**
 * Carries one activity of each kind the worksheet supports: a crossword with illustrated
 * clues, a test and a select. Counted by component, not by DataGame div: several of the divs in
 * this package sit nested inside other content and are not activities of their own.
 */
const CROSSWORD_FIXTURE = 'test/fixtures/todos-los-idevices_dos_informes.elpx';

/** Questions in the fixture's Guess activity. */
const EXPECTED_QUESTIONS = 8;
/** One box per character of each solution. */
const EXPECTED_BOXES = 130;
/** One group per word of each solution. */
const EXPECTED_GROUPS = 26;

/**
 * Open the fixture project in a fresh workarea, so each test stays isolated.
 */
async function openFixtureProject(page: Page, createProject: (page: Page, title?: string) => Promise<string>) {
    const uuid = await createProject(page, 'Print iDevices Test');

    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await openElpFile(page, FIXTURE);
}

/**
 * Dismiss the alert the importer raises for packages with unresolved references.
 *
 * Some fixtures ship with assets stripped out, and the resulting "Missing files" alert sits over
 * the menu bar. It says nothing about printing, so the tests clear it and move on.
 */
async function dismissImportAlert(page: Page) {
    const alert = page.locator('#modalAlert');

    if (await alert.isVisible().catch(() => false)) {
        await alert.getByRole('button', { name: /accept|aceptar/i }).click();
        await expect(alert).toBeHidden();
    }
}

/**
 * Open File → Print iDevices and wait for the worksheet to load.
 */
async function openWorksheet(page: Page) {
    await dismissImportAlert(page);
    await page.locator('#dropdownFile').click();

    const entry = page.locator('#navbar-button-print-idevices');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();

    const overlay = page.locator('#printPreviewOverlay');
    await expect(overlay).toHaveAttribute('data-visible', 'true', { timeout: 15000 });

    // The worksheet is generated in memory and handed to the iframe as a blob. Waiting for it to
    // be visible rather than merely attached matters: the overlay keeps the iframe hidden until it
    // loads, and everything inside a hidden frame measures zero.
    const frame = page.frameLocator('.print-preview-iframe');
    await frame.locator('.worksheet').waitFor({ state: 'visible', timeout: 30000 });

    return { overlay, frame };
}

test.describe('Print iDevices', () => {
    // Serial: several of these import multi-megabyte fixtures, and running them against one
    // another starves the dev server enough to time out the workarea handshake.
    test.describe.configure({ mode: 'serial' });

    for (const mode of ['idevices', 'in-place', 'appendix']) {
        test(`prints literal legacy quiz prompts, case-sensitive hints and wrapped lists in ${mode} mode`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            const uuid = await createProject(page, 'Legacy worksheet text');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            await page.evaluate(() => {
                const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Legacy activities');
                const components = [
                    {
                        type: 'adaptative-quiz',
                        properties: {
                            caseSensitive: true,
                            questions: [
                                { text: 'Is A<B true?', options: ['Yes', 'No'] },
                                {
                                    typeSelect: 2,
                                    question: 'pH',
                                    solutionWord: 'Acidity < 7 & <script>alert(1)</script>',
                                    percentageShow: 100,
                                },
                            ],
                        },
                    },
                    {
                        type: 'scrambled-list',
                        properties: { options: [{ other: 'First' }, { other: ['Second'] }] },
                    },
                ];
                for (const component of components) {
                    const block = binding.createBlock(parent.id);
                    binding.createComponent(parent.id, block, component.type, {
                        htmlContent: '',
                        jsonProperties: JSON.stringify(component.properties),
                    });
                }
            });

            await openPrintDialog(page);
            const { frame } = await choosePrintOption(page, mode);
            const quiz = frame.locator('.worksheet-activity[data-idevice="adaptative-quiz"]');
            await expect(quiz.locator('.worksheet-prompt')).toHaveText([
                'Is A<B true?',
                'Acidity < 7 & <script>alert(1)</script>',
            ]);
            await expect(quiz.locator('.worksheet-option-label')).toHaveText(['Yes', 'No']);
            await expect(quiz.locator('.worksheet-box')).toHaveText(['p', 'H']);
            await expect(quiz.locator('script')).toHaveCount(0);

            const list = frame.locator('.worksheet-activity[data-idevice="scrambled-list"]');
            await expect(list.locator('.worksheet-option-label')).toHaveCount(2);
            expect((await list.locator('.worksheet-option-label').allTextContents()).sort()).toEqual([
                'First',
                'Second',
            ]);
            await expect(list.locator('.worksheet-option-line')).toHaveCount(2);
        });
    }

    for (const mode of ['idevices', 'in-place', 'appendix']) {
        test(`prints safe form labels, selected card images and stored element groups in ${mode} mode`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            const uuid = await createProject(page, 'Printed adapter regressions');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            const pack = (prefix: string, data: unknown) =>
                `<div class="${prefix}-DataGame">${encryptDataGame(JSON.stringify(data))}</div>`;
            const names = ['Cat', 'Dog', 'Bird'];
            const pictures = names.map(
                name =>
                    'data:image/svg+xml;base64,' +
                    Buffer.from(
                        `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="30"><text x="5" y="20">${name}</text></svg>`,
                    ).toString('base64'),
            );
            const unsafe = '<img src=x onerror="parent.__printRegressionExecuted=true">';
            const script = '<script>parent.__printRegressionExecuted=true</script>';
            const components = [
                {
                    type: 'form',
                    html: '',
                    properties: {
                        msgs: { msgTrue: unsafe, msgFalse: 'False' },
                        questionsData: [
                            { activityType: 'true-false', baseText: '<p>Statement</p>', answer: '1' },
                            {
                                activityType: 'selection',
                                baseText: '<p>Choose</p>',
                                answers: [
                                    [true, 'A<B'],
                                    [false, script],
                                ],
                            },
                        ],
                    },
                },
                {
                    type: 'select-media-files',
                    properties: {},
                    html:
                        pack('seleccionamedias', {
                            numberMaxCards: '2',
                            phrasesGame: [{ definition: 'Choose an animal', cards: names.map(eText => ({ eText })) }],
                        }) +
                        pictures
                            .map((src, index) => `<a class="seleccionamedias-LinkImages-0" href="${src}">${index}</a>`)
                            .join(''),
                },
                ...[
                    { groups: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], number: 10 },
                    { groups: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], number: 6 },
                    { groups: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], number: 3 },
                ].map(data => ({
                    type: 'periodic-table',
                    properties: {},
                    html: pack('periodic-table', { ...data, gameType: 2 }),
                })),
                // A type no iDevice answers to: every one that exists now has a paper form, and the
                // note that stands in for a missing one still needs covering in the browser.
                { type: 'an-activity-with-no-adapter', properties: {}, html: '<div class="no-adapter-IDevice"></div>' },
            ];
            await page.evaluate(components => {
                const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Adapter regressions');
                for (const component of components) {
                    const block = binding.createBlock(parent.id);
                    binding.createComponent(parent.id, block, component.type, {
                        htmlContent: component.html,
                        jsonProperties: JSON.stringify(component.properties),
                    });
                }
                // Keep the draw deterministic in this test's isolated page: Dog and Bird survive the cap.
                Math.random = () => 0;
            }, components);
            await openPrintDialog(page);
            const { frame } = await choosePrintOption(page, mode);
            const form = frame.locator('[data-idevice="form"]');
            await expect(form.locator('.worksheet-option-label')).toHaveText([unsafe, 'False', script, 'A<B']);
            await expect(form.locator('img, script, [onerror]')).toHaveCount(0);
            expect(await page.evaluate(() => '__printRegressionExecuted' in window)).toBe(false);

            const cards = frame.locator('[data-idevice="select-media-files"] .worksheet-media-option');
            await expect(cards).toHaveCount(2);
            for (const [index, name] of ['Dog', 'Bird'].entries()) {
                await expect(cards.nth(index).locator('.worksheet-media-option-text')).toHaveText(name);
                const picture = cards.nth(index).locator('img');
                await expect(picture).toHaveAttribute('src', pictures[index + 1]);
                await expect
                    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
                    .toBe(true);
            }

            // In the appendix the body keeps a pointer to each exercise, and it carries the same
            // iDevice type as the exercise it points at. The cards are on the exercise.
            const tables = frame.locator(
                '.worksheet-activity[data-idevice="periodic-table"]:not(.worksheet-activity-reference)',
            );
            await expect(tables).toHaveCount(3);
            await expect(tables.nth(0).locator('.worksheet-element-card')).toHaveCount(10);
            const alkali = await tables.nth(1).locator('.worksheet-element-number').allTextContents();
            expect(alkali.map(Number).sort((a, b) => a - b)).toEqual([3, 11, 19, 37, 55, 87]);
            const actinides = await tables.nth(2).locator('.worksheet-element-number').allTextContents();
            expect(actinides).toHaveLength(3);
            expect(actinides.every(number => Number(number) >= 89 && Number(number) <= 103)).toBe(true);

            // The one activity here with no paper form is still accounted for, each path saying so
            // in its own way: the worksheet lists it at the end, the document stands a note where
            // the activity was.
            if (mode === 'idevices')
                await expect(frame.locator('.worksheet-unsupported')).toContainText('an-activity-with-no-adapter');
            else
                await expect(
                    frame.locator('.worksheet-activity-unprintable[data-idevice="an-activity-with-no-adapter"]'),
                ).toHaveCount(1);
        });
    }

    for (const mode of ['idevices', 'in-place', 'appendix']) {
        test(`prints rubric identity fields and current instruction images in ${mode} mode`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            const uuid = await createProject(page, 'Rubric and instruction regressions');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            const pictureId = 'd60f409d-a1cc-4a34-a56c-d9e8c042afab';
            const components = [
                {
                    type: 'rubric',
                    html:
                        '<div class="exe-rubrics-instructions"><table class="exe-table"><tr><td>Read each criterion</td></tr></table></div>' +
                        '<div class="rubric"><table class="exe-table"><thead><tr><th></th><th>Good</th></tr></thead>' +
                        '<tbody><tr><th>Content</th><td>Complete <span>(4)</span></td></tr></tbody></table>' +
                        '<ul class="exe-rubrics-strings"><li class="activity">Activity</li><li class="name">Learner name</li>' +
                        '<li class="date">Assessment date</li><li class="score">Score</li></ul></div>',
                },
                ...[
                    ['electrical-circuits', 'electrical-circuits'],
                    ['3dmol', 'dmole'],
                ].map(([type, prefix]) => ({
                    type,
                    html:
                        `<div class="${prefix}-instructions"><p>Current diagram <img src="asset://${pictureId}"></p></div>` +
                        `<div class="${prefix}-DataGame">${encryptDataGame(
                            JSON.stringify({
                                instructionsExe: escape('<img src="blob:https://old.example/expired">'),
                                selectsGame: [{ quextion: 'Question', options: ['A', 'B'], numberOptions: 2 }],
                            }),
                        )}</div>`,
                })),
            ];
            await page.evaluate(
                async ({ components, pictureId }) => {
                    const bridge = window.eXeLearning.app.project._yjsBridge;
                    const binding = bridge.structureBinding;
                    const parent = binding.createPage('Printable rubric and diagrams');
                    for (const component of components) {
                        const block = binding.createBlock(parent.id);
                        binding.createComponent(parent.id, block, component.type, { htmlContent: component.html });
                    }
                    const blob = new Blob(
                        [
                            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',
                        ],
                        { type: 'image/svg+xml' },
                    );
                    await bridge.assetManager.putAsset({
                        id: pictureId,
                        filename: 'diagram.svg',
                        mime: blob.type,
                        size: blob.size,
                        blob,
                    });
                },
                { components, pictureId },
            );
            await openPrintDialog(page);
            const { frame } = await choosePrintOption(page, mode);
            const rubric = frame.locator('.worksheet-rubric');
            await expect(rubric.locator('tbody th')).toHaveText('Content');
            await expect(rubric.locator('tbody td')).toContainText('Complete');
            const fields = rubric.locator('.worksheet-rubric-field');
            await expect(fields).toHaveCount(mode === 'idevices' ? 2 : 4);
            if (mode === 'idevices') await expect(frame.locator('.worksheet-fields')).toBeVisible();
            else {
                await expect(fields.filter({ hasText: 'Learner name' })).toBeVisible();
                await expect(fields.filter({ hasText: 'Assessment date' })).toBeVisible();
            }
            for (const type of ['electrical-circuits', '3dmol']) {
                const picture = frame.locator(`[data-idevice="${type}"] .worksheet-instructions img`);
                await expect(picture).toHaveAttribute('src', /^blob:/);
                await expect
                    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
                    .toBe(true);
            }
        });
    }

    test('waits for real molecule surfaces and reuses the viewer across print previews', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Molecule capture regressions');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        // Observe the bundled viewer while leaving its WebGL and surface workers intact.
        await page.route('**/3dmol/export/3Dmol-min.js', async route => {
            const response = await route.fetch();
            expect(response.ok()).toBe(true);
            const probe = `;(() => {
                const state = window.__moleculeCaptureProbe = { viewers: new Set(), surfaces: [], captures: 0 };
                const prototype = window.$3Dmol.GLViewer.prototype;
                const pngURI = prototype.pngURI;
                prototype.pngURI = function() {
                    state.viewers.add(this);
                    state.captures++;
                    const surfaces = Object.values(this.surfaces).flat();
                    if (surfaces.length) state.surfaces.push(surfaces.every(surface => surface.done));
                    return pngURI.call(this);
                };
            })();`;
            await route.fulfill({ response, body: `${await response.text()}\n${probe}` });
        });
        const modelData = readFileSync(
            path.join('public', 'files', 'perm', 'idevices', 'base', '3dmol', 'export', 'GLC_ideal.sdf'),
            'utf8',
        );
        const html = `<div class="dmole-DataGame">${encryptDataGame(
            JSON.stringify({
                selectsGame: ['stick', 'surface'].map(modelStyle => ({
                    modelData,
                    modelFormat: 'sdf',
                    modelStyle,
                    quextion: 'Count the atoms',
                    options: ['Six', 'Twelve'],
                    numberOptions: 2,
                })),
            }),
        )}</div>`;
        await page.evaluate(html => {
            const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
            const parent = binding.createPage('Molecules');
            const block = binding.createBlock(parent.id);
            binding.createComponent(parent.id, block, '3dmol', { htmlContent: html });
        }, html);
        for (let preview = 0; preview < 2; preview++) {
            const { overlay, frame } = await openWorksheet(page);
            const images = frame.locator('[data-idevice="3dmol"] .worksheet-media img');
            await expect(images).toHaveCount(2);
            for (const image of await images.all()) {
                await expect(image).toHaveAttribute('src', /^data:image\/png/);
                await expect
                    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
                    .toBe(true);
            }
            await overlay.locator('.print-preview-close-btn').click();
            await expect(overlay).toHaveAttribute('data-visible', 'false');
            // Let the real ResizeObserver see the detached stage before reopening the preview.
            // The next first question uses sticks, so no asynchronous surface can mask a zero-size canvas.
            await page.waitForFunction(() => {
                const state = (
                    window as unknown as {
                        __moleculeCaptureProbe: { viewers: Set<{ getCanvas(): HTMLCanvasElement }> };
                    }
                ).__moleculeCaptureProbe;
                return [...state.viewers].every(viewer => viewer.getCanvas().width === 0);
            });
        }
        const state = await page.evaluate(() => {
            const state = (
                window as unknown as {
                    __moleculeCaptureProbe: { viewers: Set<unknown>; surfaces: boolean[]; captures: number };
                }
            ).__moleculeCaptureProbe;
            return { viewers: state.viewers.size, surfaces: state.surfaces, captures: state.captures };
        });
        expect(state).toEqual({ viewers: 1, surfaces: [true, true], captures: 4 });
    });

    for (const mode of ['idevices', 'in-place']) {
        test(`preserves sorting statements and printable clues in ${mode} mode`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            const uuid = await createProject(page, 'Sorting and ring print regressions');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            const pack = (prefix: string, data: unknown) =>
                `<div class="${prefix}-DataGame">${encryptDataGame(JSON.stringify(data))}</div>`;
            const cards = Array.from({ length: 10 }, (_, index) => ({
                type: 2,
                eText: index < 5 ? `Heading ${index + 1}` : `Answer ${index - 4}`,
                url: '',
            }));
            const components = [
                {
                    type: 'sort',
                    html: pack('ordena', {
                        type: 1,
                        gameColumns: 5,
                        orderedColumns: true,
                        phrasesGame: [
                            { definition: 'Arrange by increasing age', cards },
                            {
                                definition: 'Unprintable round',
                                cards: [{ type: 0, eText: '', url: '', audio: 'sound.mp3' }, ...cards.slice(1)],
                            },
                        ],
                    }),
                },
                {
                    type: 'az-quiz-game',
                    html: pack('rosco', {
                        letters: 'DC',
                        wordsGame: [
                            { word: 'DOG', type: 0, definition: '<audio controls></audio>', url: '' },
                            { word: 'CAT', type: 0, definition: 'A small feline', url: '' },
                        ],
                    }),
                },
            ];
            await page.evaluate(components => {
                const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Printable regressions');
                for (const component of components) {
                    const block = binding.createBlock(parent.id);
                    binding.createComponent(parent.id, block, component.type, { htmlContent: component.html });
                }
            }, components);
            await openPrintDialog(page);
            const { frame } = await choosePrintOption(page, mode);
            const sort = frame.locator('[data-idevice="sort"]');
            await expect(sort.locator('.worksheet-prompt')).toHaveText('Arrange by increasing age');
            await expect(sort.locator('.worksheet-order-heading')).toHaveText(
                Array.from({ length: 5 }, (_, index) => `Heading ${index + 1}`),
            );
            await expect(sort.locator('.worksheet-line')).toHaveCount(5);
            const warnings = frame.locator('.worksheet-unsupported');
            await expect(warnings).toHaveCount(mode === 'idevices' ? 1 : 2);
            for (const warning of await warnings.all()) await expect(warning).toBeVisible();
            const ring = frame.locator('[data-idevice="az-quiz-game"]');
            await expect(ring.locator('.worksheet-item')).toHaveCount(1);
            await expect(ring.locator('.worksheet-prompt')).toContainText('A small feline');
            await expect(ring.locator('.worksheet-ring-active')).toHaveText('C');

            await page.emulateMedia({ media: 'print' });
            await page.locator('.print-preview-iframe').evaluate((iframe: HTMLIFrameElement) => {
                // A4's content width with the worksheet's 15 mm margins.
                iframe.style.width = '180mm';
            });
            const geometry = await sort.locator('.worksheet-order').evaluate(list => {
                const bounds = list.getBoundingClientRect();
                return [...list.querySelectorAll('.worksheet-order-card')].map(card => {
                    const box = card.getBoundingClientRect();
                    const line = card.querySelector('.worksheet-line')?.getBoundingClientRect();
                    return {
                        left: box.left - bounds.left,
                        right: bounds.right - box.right,
                        top: box.top,
                        width: box.width,
                        lineWidth: line?.width,
                    };
                });
            });
            expect(geometry).toHaveLength(10);
            for (const box of geometry) {
                expect(box.left).toBeGreaterThanOrEqual(-1);
                expect(box.right).toBeGreaterThanOrEqual(-1);
                if (box.lineWidth !== undefined) expect(Math.abs(box.lineWidth - box.width)).toBeLessThan(1);
            }
            expect(new Set(geometry.slice(0, 5).map(box => Math.round(box.top))).size).toBe(1);
        });
    }

    test('builds a worksheet from the activities in the project', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { frame } = await openWorksheet(page);

        // One printable item per question, each with its own answer space. Counted inside the
        // Guess activity the numbers describe: the fixture holds other activities too, and every
        // adapter that lands adds its own items to the sheet.
        const guess = frame.locator('.worksheet-activity[data-idevice="guess"]');
        await expect(guess.locator('.worksheet-item')).toHaveCount(EXPECTED_QUESTIONS);
        await expect(guess.locator('.worksheet-answer')).toHaveCount(EXPECTED_QUESTIONS);

        // One box per character of the solution, grouped by word.
        await expect(guess.locator('.worksheet-box')).toHaveCount(EXPECTED_BOXES);
        await expect(guess.locator('.worksheet-box-group')).toHaveCount(EXPECTED_GROUPS);
    });

    test('gives away some letters as hints but not the whole solution', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { frame } = await openWorksheet(page);

        // The activity gives away 35% of each solution, so both kinds of box must be present:
        // all-empty would mean the setting is ignored, all-filled would print the answers.
        const filled = await frame.locator('.worksheet-box-filled').count();
        expect(filled).toBeGreaterThan(0);
        expect(filled).toBeLessThan(EXPECTED_BOXES);

        // A hint box carries exactly one character; an empty one carries none.
        await expect(frame.locator('.worksheet-box-filled').first()).not.toBeEmpty();

        // Case follows the activity, which is not case sensitive here.
        const firstHint = await frame.locator('.worksheet-box-filled').first().textContent();
        expect(firstHint?.trim()).toBe(firstHint?.trim().toUpperCase());
    });

    test('prints the questions, not the game board', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { frame } = await openWorksheet(page);

        // The clue is what the student reads; the solution is never spelled out, in either case.
        // Scoped to the Guess activity: other activities on this sheet have prompts of their own.
        const guess = frame.locator('.worksheet-activity[data-idevice="guess"]');
        await expect(guess.locator('.worksheet-prompt').first()).toContainText(
            'Frase fija para nombrar a los personajes',
        );
        await expect(frame.locator('.worksheet')).not.toContainText('Epíteto épico');
        await expect(frame.locator('.worksheet')).not.toContainText('EPÍTETO ÉPICO');

        // None of the interactive chrome should survive into the worksheet.
        await expect(frame.locator('.adivina-IDevice')).toHaveCount(0);
        await expect(frame.locator('.adivina-DataGame')).toHaveCount(0);
    });

    test('groups the activities under their page title', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { frame } = await openWorksheet(page);

        // The fixture's four activities — a rubric, two forms and the Guess — sit on four pages,
        // and each page prints its own heading.
        const pageTitles = frame.locator('.worksheet-page-title');
        await expect(pageTitles).toHaveCount(4);
        for (const title of await pageTitles.all()) await expect(title).not.toBeEmpty();

        // What this is really here for: no activity floats outside a page section. Counting both
        // ways keeps that true however many activities a new adapter adds to the sheet.
        const activities = await frame.locator('.worksheet-activity').count();
        expect(activities).toBe(4);
        await expect(frame.locator('.worksheet-page .worksheet-activity')).toHaveCount(activities);
    });

    test('keeps accented characters intact', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { frame } = await openWorksheet(page);

        // Mojibake here means the payload was decoded with the wrong unescaping.
        const worksheet = frame.locator('.worksheet');
        await expect(worksheet).toContainText('é');
        await expect(worksheet).not.toContainText('Ã©');
    });

    test('titles the overlay for the worksheet and restores it afterwards', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { overlay } = await openWorksheet(page);

        await expect(overlay.locator('.print-preview-title-text')).toHaveText('Print iDevices');

        await overlay.locator('.print-preview-close-btn').click();
        await expect(overlay).toHaveAttribute('data-visible', 'false');

        // The plain print preview shares this overlay, so its heading must come back. This
        // project has interactive activities, so printing asks what to do with them first.
        await page.locator('#dropdownFile').click();
        await page.locator('#navbar-button-export-print').click();

        const dialog = page.locator('#modalConfirm');
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        await dialog.locator('button.btn.button-primary').click();

        await expect(overlay.locator('.print-preview-title-text')).toHaveText('Print preview');
    });

    /**
     * One test rather than several: the crossword fixture is 22 MB, and importing it from more
     * than one worker at a time starves the server enough to time out the workarea handshake.
     * Every crossword assertion is about the same rendered worksheet anyway.
     */
    test('prints a crossword as a grid above its illustrated, numbered clues', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print iDevices Crossword');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        // Its crossword asks 100% of its questions at difficulty 100, which gives no letters
        // away, and its clues are illustrated.
        await openElpFile(page, CROSSWORD_FIXTURE);

        const { frame } = await openWorksheet(page);

        const activity = frame
            .locator('.worksheet-activity')
            .filter({ has: frame.locator('.worksheet-grid') })
            .first();

        // A grid of cells, with gaps where the puzzle is blocked.
        await expect(activity.locator('.worksheet-grid')).toBeVisible();
        expect(await activity.locator('.worksheet-grid-cell').count()).toBeGreaterThan(0);
        expect(await activity.locator('.worksheet-grid-gap').count()).toBeGreaterThan(0);

        // Difficulty 100 gives nothing away, so a cell holds at most its clue number.
        await expect(activity.locator('.worksheet-grid-cell').first()).toHaveText(/^\d*$/);

        // Clues are numbered from one and answer into the grid, not into boxes of their own.
        const clues = activity.locator('.worksheet-item');
        expect(await clues.count()).toBeGreaterThan(1);
        await expect(clues.first()).toHaveAttribute('value', '1');
        await expect(activity.locator('.worksheet-answer')).toHaveCount(0);

        // The grid comes before the clue list.
        const gridBox = await activity.locator('.worksheet-grid').boundingBox();
        const cluesBox = await activity.locator('.worksheet-items').boundingBox();
        expect(gridBox?.y ?? 0).toBeLessThan(cluesBox?.y ?? 0);

        // The activity draws a picture behind its board, so the worksheet does too.
        const backdrop = activity.locator('.worksheet-grid-background');
        await expect(backdrop).toBeVisible();
        // An <img>, not a CSS background: browsers leave background graphics out of printouts.
        expect(await backdrop.evaluate(node => node.tagName)).toBe('IMG');

        // An illustration sits below its definition, at a small size.
        const illustrated = frame
            .locator('.worksheet-item')
            .filter({ has: frame.locator('.worksheet-media-small') })
            .first();
        const promptBox = await illustrated.locator('.worksheet-prompt').boundingBox();
        // Measured on the img: the figure around it is a block, so it spans the whole column.
        const mediaBox = await illustrated.locator('.worksheet-media-small img').boundingBox();

        expect(mediaBox?.y ?? 0).toBeGreaterThan(promptBox?.y ?? 0);
        // Capped at 30mm, which is about 113px, against the 80mm a full question picture gets.
        expect(mediaBox?.width ?? 0).toBeGreaterThan(0);
        expect(mediaBox?.width ?? 0).toBeLessThanOrEqual(120);
    });

    test('prints a test as questions with a box to tick per option', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print iDevices Test activity');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        // Its test asks 100% of its questions in stored order.
        await openElpFile(page, CROSSWORD_FIXTURE);

        const { frame } = await openWorksheet(page);

        const testActivity = frame.locator('.worksheet-activity[data-idevice="quick-questions"]');
        await expect(testActivity).toHaveCount(1);
        const options = testActivity.locator('.worksheet-option');
        expect(await options.count()).toBeGreaterThan(0);

        // Every option carries its own box and its label.
        const first = options.first();
        await expect(first.locator('.worksheet-option-box')).toBeVisible();
        await expect(first.locator('.worksheet-option-label')).not.toBeEmpty();

        // The boxes sit inside a question, under its text.
        const question = testActivity
            .locator('.worksheet-item')
            .filter({ has: frame.locator('.worksheet-options') })
            .first();
        const promptBox = await question.locator('.worksheet-prompt').boundingBox();
        const optionsBox = await question.locator('.worksheet-options').boundingBox();

        expect(optionsBox?.y ?? 0).toBeGreaterThan(promptBox?.y ?? 0);
    });

    // No fixture in the repository has a video question in a Select activity, so leaving those
    // out is covered by the adapter's unit tests rather than here.
    test('prints a select activity with its options', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print iDevices Select');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, CROSSWORD_FIXTURE);

        const { frame } = await openWorksheet(page);

        const activity = frame.locator('.worksheet-activity[data-idevice="quick-questions-multiple-choice"]');
        await expect(activity).toHaveCount(1);

        // It asks 100% of its four questions in stored order, so all four print.
        await expect(activity.locator('.worksheet-item')).toHaveCount(4);

        // Its questions offer options to tick.
        expect(await activity.locator('.worksheet-option-box').count()).toBeGreaterThan(0);
    });

    test('prints a complete activity as gapped text, with its words when they are offered', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print iDevices Complete');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, CROSSWORD_FIXTURE);

        const { frame } = await openWorksheet(page);

        const activities = frame.locator('.worksheet-activity[data-idevice="complete"]');
        await expect(activities).toHaveCount(3);

        // Every one of them prints its text with gaps to fill in.
        for (let index = 0; index < 3; index++) {
            expect(await activities.nth(index).locator('.worksheet-gap').count()).toBeGreaterThan(0);
        }

        // The gaps are sized to the word they hide, so they are not all the same width.
        const widths = await activities
            .first()
            .locator('.worksheet-gap')
            .evaluateAll(nodes => nodes.map(node => (node as HTMLElement).style.width));
        expect(widths.every(width => width.endsWith('mm'))).toBe(true);

        // The drag and select modes list the words above the text; writing them from memory does
        // not, so this project shows both cases.
        const banks = frame.locator('.worksheet-activity[data-idevice="complete"] .worksheet-word-bank');
        expect(await banks.count()).toBeGreaterThan(0);
        expect(await banks.count()).toBeLessThan(3);
        await expect(banks.first().locator('.worksheet-word').first()).not.toBeEmpty();
    });

    test('prints a classify activity as cards facing their containers', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print iDevices Classify');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, CROSSWORD_FIXTURE);

        const { frame } = await openWorksheet(page);

        const activity = frame.locator('.worksheet-activity[data-idevice="classify"]');
        await expect(activity).toHaveCount(1);

        const cards = activity.locator('.worksheet-card');
        const containers = activity.locator('.worksheet-container');
        expect(await cards.count()).toBeGreaterThan(0);
        expect(await containers.count()).toBeGreaterThan(0);

        // Cards on the left, containers on the right.
        const cardBox = await cards.first().boundingBox();
        const containerBox = await containers.first().boundingBox();
        expect(cardBox?.x ?? 0).toBeLessThan(containerBox?.x ?? 0);

        // Each container is outlined in its own colour rather than filled.
        const outline = await containers.first().evaluate(node => {
            const style = getComputedStyle(node as HTMLElement);
            return { width: style.borderTopWidth, color: style.borderTopColor, fill: style.backgroundColor };
        });
        expect(outline.width).toBe('2px');
        expect(outline.color).not.toBe('rgb(26, 26, 26)');
        expect(outline.fill).toBe('rgba(0, 0, 0, 0)');

        // The exercise is the two columns, so it prints no numbered questions.
        await expect(activity.locator('.worksheet-item')).toHaveCount(0);
    });

    test('closes on Escape', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { overlay } = await openWorksheet(page);

        await page.keyboard.press('Escape');

        await expect(overlay).toHaveAttribute('data-visible', 'false');
    });

    for (const cardCount of [1, 6]) {
        test(`keeps all nine categories with their ${cardCount} cards on printed sheets`, async ({
            authenticatedPage: page,
            createProject,
        }, testInfo) => {
            const uuid = await createProject(page, 'Nine printable categories');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            const html = `<div class="clasifica-DataGame">${encryptDataGame(
                JSON.stringify({
                    numberGroups: 9,
                    groups: Array.from({ length: 9 }, (_, index) => `Category ${index + 1}`),
                    wordsGame: Array.from({ length: cardCount }, (_, index) => ({
                        type: 1,
                        eText: `Printed card ${index + 1}`,
                        group: 8,
                    })),
                }),
            )}</div>`;
            await page.evaluate(html => {
                const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Matching exercise');
                const block = binding.createBlock(parent.id);
                binding.createComponent(parent.id, block, 'classify', { htmlContent: html });
            }, html);

            const { frame } = await openWorksheet(page);
            await page.emulateMedia({ media: 'print' });
            const boards = frame.locator('.worksheet-match');
            const expectedSheets = cardCount === 1 ? 1 : 2;
            await expect(boards).toHaveCount(expectedSheets);
            await expect(frame.locator('.worksheet-card')).toHaveCount(cardCount);
            for (const board of await boards.all()) {
                await expect(board.locator('.worksheet-container')).toHaveCount(9);
                const heightMm = await board.evaluate(node => (node.getBoundingClientRect().height * 25.4) / 96);
                expect(heightMm).toBeLessThan(267);
            }

            // Inspect real page breaks as well as the unpaginated DOM. Chromium provides PDF
            // output even when the editor flow above is exercised by the Firefox project.
            const pdfBrowser = await chromium.launch();
            try {
                const pdfPage = await pdfBrowser.newPage();
                await pdfPage.setContent(
                    `<!DOCTYPE html>${await frame.locator('html').evaluate(node => node.outerHTML)}`,
                );
                const bytes = await pdfPage.pdf({
                    path: testInfo.outputPath('nine-categories.pdf'),
                    format: 'A4',
                    preferCSSPageSize: true,
                });
                await testInfo.attach('nine-categories.pdf', { body: bytes, contentType: 'application/pdf' });
                const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
                const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
                try {
                    const pdf = await task.promise;
                    expect(pdf.numPages).toBe(expectedSheets);
                    const printedCards: string[] = [];
                    for (let index = 1; index <= pdf.numPages; index++) {
                        const content = await (await pdf.getPage(index)).getTextContent();
                        const text = content.items.map(item => ('str' in item ? item.str : '')).join(' ');
                        expect(text).toContain('Printed card');
                        for (let category = 1; category <= 9; category++)
                            expect(text).toContain(`Category ${category}`);
                        printedCards.push(...(text.match(/Printed card \d+/g) || []));
                    }
                    expect(printedCards.sort()).toEqual(
                        Array.from({ length: cardCount }, (_, index) => `Printed card ${index + 1}`),
                    );
                } finally {
                    await task.destroy();
                }
            } finally {
                await pdfBrowser.close();
            }
        });
    }

    test('warns about unsupported JSON exercises when printing only activities', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'JSON worksheet omissions');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        // The json activities that still have no paper form. `form` is no longer one of them.
        const types = ['an-activity-with-no-adapter'];
        await page.evaluate(types => {
            const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
            const parent = binding.createPage('JSON exercises');
            const block = binding.createBlock(parent.id);
            for (const type of types) binding.createComponent(parent.id, block, type, { htmlContent: '' });
        }, types);

        await openPrintDialog(page);
        const { frame } = await choosePrintOption(page, 'idevices');
        const warning = frame.locator('.worksheet-unsupported');
        await expect(warning).toBeVisible();
        await expect(warning.locator('li')).toHaveCount(types.length);
        for (const type of types) await expect(warning).toContainText(`${type} — JSON exercises`);
        await expect(frame.locator('.worksheet-activity')).toHaveCount(0);
        await page.emulateMedia({ media: 'print' });
        await expect(warning).toBeHidden();
    });

    test('preserves worksheet formulas, encrypted images, distractors and hidden-block visibility', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Worksheet regression cases');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        const pictureId = 'd60f409d-a1cc-4a34-a56c-d9e8c042afab';
        const pack = (prefix: string, data: Record<string, unknown>) =>
            `<div class="${prefix}-DataGame">${encryptDataGame(JSON.stringify(data))}</div>`;
        const components = [
            {
                type: 'quick-questions',
                html: pack('quext', {
                    questionsGame: [
                        {
                            type: 0,
                            quextion: 'Solve \\(x^2 = 4\\)',
                            numberOptions: 2,
                            options: [`<img src="asset://${pictureId}">`, 'Text'],
                        },
                    ],
                }),
            },
            {
                type: 'complete',
                html: pack('completa', {
                    type: 2,
                    wordsLimit: true,
                    textText: escape('Capital: @@Madrid|Barcelona|Sevilla@@.'),
                }),
            },
            {
                type: 'crossword',
                html: pack('crucigrama', {
                    wordsGame: [
                        { word: 'CASA', definition: 'Home' },
                        { word: 'CAMA', definition: 'Bed' },
                    ],
                }),
            },
        ];
        await page.evaluate(
            async ({ components, pictureId }) => {
                const bridge = window.eXeLearning.app.project._yjsBridge;
                const binding = bridge.structureBinding;
                const parent = binding.createPage('Printable cases');
                const blockId = binding.createBlock(parent.id);
                for (const component of components)
                    binding.createComponent(parent.id, blockId, component.type, {
                        htmlContent: component.html,
                    });
                const hiddenId = binding.createBlock(parent.id, 'Teacher content');
                binding.getBlockMap(parent.id, hiddenId).get('properties').set('teacherOnly', 'true');
                binding.createComponent(parent.id, hiddenId, 'complete', { htmlContent: components[1].html });
                const png = Uint8Array.from(
                    atob(
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/n9sAAAAASUVORK5CYII=',
                    ),
                    c => c.charCodeAt(0),
                );
                const blob = new Blob([png], { type: 'image/png' });
                await bridge.assetManager.putAsset({
                    id: pictureId,
                    filename: 'pixel.png',
                    mime: 'image/png',
                    size: blob.size,
                    blob,
                });
            },
            { components, pictureId },
        );
        const { frame } = await openWorksheet(page);
        await expect(frame.locator('.worksheet-activity')).toHaveCount(3);
        const testActivity = frame.locator('[data-idevice="quick-questions"]');
        await expect(testActivity.locator('.worksheet-prompt svg')).toBeVisible();
        await expect(testActivity.locator('.worksheet-prompt')).not.toContainText('\\(');
        await expect(testActivity.locator('.worksheet-option')).toHaveCount(2);
        const picture = testActivity.locator('.worksheet-option img');
        await expect
            .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
            .toBe(true);
        await expect(picture).toHaveAttribute('src', /^blob:/);
        const choices = frame.locator('[data-idevice="complete"] .worksheet-gap-options');
        for (const word of ['Madrid', 'Barcelona', 'Sevilla']) await expect(choices).toContainText(word);
        const crossword = frame.locator('[data-idevice="crossword"]');
        const gridNumbers = await crossword.locator('.worksheet-grid-number').allTextContents();
        for (const clue of await crossword.locator('.worksheet-item').all()) {
            expect(gridNumbers).toContain(await clue.getAttribute('value'));
            await expect(clue.locator('.worksheet-direction')).not.toBeEmpty();
        }
        await page.emulateMedia({ media: 'print' });
        await expect(choices).toBeVisible();
        await expect(testActivity.locator('svg')).toBeVisible();
    });
});

/**
 * Open File → Print and return the dialog that asks about the interactive activities.
 */
async function openPrintDialog(page: Page) {
    await dismissImportAlert(page);
    await page.locator('#dropdownFile').click();

    const entry = page.locator('#navbar-button-export-print');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();

    return page.locator('#modalConfirm');
}

/**
 * Answer the print dialog and wait for the preview it produces.
 */
async function choosePrintOption(page: Page, value: string) {
    const dialog = page.locator('#modalConfirm');
    await dialog.waitFor({ state: 'visible', timeout: 15000 });
    await dialog.locator(`input[name="print-activity-mode"][value="${value}"]`).check();
    await dialog.locator('button.btn.button-primary').click();

    const overlay = page.locator('#printPreviewOverlay');
    await expect(overlay).toHaveAttribute('data-visible', 'true', { timeout: 15000 });

    const frame = page.frameLocator('.print-preview-iframe');
    // Hidden frames measure zero, so wait for the document to actually be shown.
    await frame.locator('body').waitFor({ state: 'visible', timeout: 30000 });

    return { overlay, frame };
}

test.describe('Print: choosing what happens to the interactive activities', () => {
    // Serial for the same reason as above: these import multi-megabyte fixtures.
    test.describe.configure({ mode: 'serial' });

    test('prints without asking when the project has no interactive activity', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        // A project straight off the template has prose and no games in it.
        const uuid = await createProject(page, 'Print Without Activities');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        await openPrintDialog(page);

        await expect(page.locator('#modalConfirm')).toBeHidden();
        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'true', {
            timeout: 15000,
        });
    });

    test('asks when the project has them, with printing them in place preselected', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });

        await expect(dialog.locator('input[name="print-activity-mode"]')).toHaveCount(4);
        await expect(dialog.locator('input[name="print-activity-mode"][value="in-place"]')).toBeChecked();
        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'false');
    });

    test('prints nothing when the dialog is cancelled', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        await dialog.locator('button.cancel.btn.button-tertiary').click();

        await expect(dialog).toBeHidden();
        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'false');
    });

    test('leaves the activity out of the document when asked to', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintDialog(page);
        const { frame } = await choosePrintOption(page, 'omit');

        // Neither the game nor an exercise in its place; the project's prose stays.
        await expect(frame.locator('.adivina-DataGame')).toHaveCount(0);
        await expect(frame.locator('.worksheet-activity')).toHaveCount(0);
        await expect(frame.locator('.exe-single-page')).toBeVisible();
    });

    test('prints the exercise where the author put it', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintDialog(page);
        const { frame } = await choosePrintOption(page, 'in-place');

        // The exercise replaces the game board, inside the document rather than on a sheet of
        // its own.
        const exercise = '.worksheet-activity[data-idevice="guess"]';
        await expect(frame.locator(exercise)).toHaveCount(1);
        // The fixture holds four activities in all — a rubric, two forms and the Guess — and every
        // one of them now has a paper form. Its download button has none and never will, so it is
        // the one note left standing.
        const converted = '.worksheet-activity:not(.worksheet-activity-reference):not(.worksheet-activity-unprintable)';
        await expect(frame.locator(converted)).toHaveCount(4);
        const note = frame.locator('.worksheet-activity-unprintable');
        await expect(note).toHaveCount(1);
        await expect(note).toHaveAttribute('data-idevice', 'download-source-file');
        await expect(frame.locator('.exe-download-package-link')).toHaveCount(0);
        await expect(frame.locator('.worksheet-box')).toHaveCount(EXPECTED_BOXES);
        await expect(frame.locator('.adivina-DataGame')).toHaveCount(0);
        await expect(frame.locator(`.exe-single-page ${exercise}`)).toHaveCount(1);
        await expect(frame.locator(`.exe-single-page ${converted}`)).toHaveCount(4);

        // The exercise sits inside the component the activity occupied, and the wrapper does not
        // answer to the same class the exercise does.
        await expect(frame.locator(`.idevice_node.printable-activity ${exercise}`)).toHaveCount(1);
        await expect(frame.locator(`.idevice_node.printable-activity ${converted}`)).toHaveCount(4);
    });

    test('points into an appendix and prints the exercise there', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintDialog(page);
        const { frame } = await choosePrintOption(page, 'appendix');

        // One pointer per interactive activity, numbered from one without gaps.
        const references = frame.locator('.worksheet-reference');
        const count = await references.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index++) {
            await expect(references.nth(index)).toContainText(String(index + 1));
        }

        // The appendix holds one entry per pointer, under the matching number. This is the
        // correspondence the mode lives or dies by: a pointer to the wrong exercise is worse
        // than no appendix at all.
        const appendixTitles = frame.locator('.worksheet-activity-title').last();
        await expect(appendixTitles).toContainText(`${count}.`);
        await expect(frame.locator('.worksheet-box')).toHaveCount(EXPECTED_BOXES);
    });

    test('prints the worksheet alone when only the activities were asked for', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintDialog(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        // The same worksheet File → Print iDevices produces: the sheet, not the document.
        await expect(frame.locator('.worksheet')).toBeVisible();
        await expect(frame.locator('.worksheet-box')).toHaveCount(EXPECTED_BOXES);
        await expect(frame.locator('.exe-single-page')).toHaveCount(0);
    });
});

test.describe('Print: choosing which interactive activities to print', () => {
    // Serial for the same reason as above: these import multi-megabyte fixtures.
    test.describe.configure({ mode: 'serial' });

    const SELECTED = 'input[name="print-activity-selected"]';

    /** The component id of the fixture's Guess activity, as the dialog lists it. */
    async function guessId(page: Page): Promise<string> {
        return page.evaluate(() => {
            const app = window as any;
            const list: { id: string; type: string }[] = app.SharedExporters.listProjectInteractiveActivities(
                app.eXeLearning.app.project._yjsBridge.documentManager,
            );
            return list.find(activity => activity.type === 'guess')?.id ?? '';
        });
    }

    test('lists every activity, all ticked, only while activities are to be printed', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        const selection = dialog.locator('.print-activities-selection');

        // A rubric, two forms, the Guess and a download button: five, each ticked.
        await expect(selection).toBeVisible();
        await expect(selection.locator(SELECTED)).toHaveCount(5);
        for (const box of await selection.locator(SELECTED).all()) await expect(box).toBeChecked();
        await expect(selection.locator('#print-activity-select-all')).toBeChecked();
        // Named by page, then by block or iDevice.
        await expect(selection.locator('.print-activities-list label').first()).toContainText(' — ');

        await dialog.locator('input[name="print-activity-mode"][value="omit"]').check();
        await expect(selection).toBeHidden();
        await dialog.locator('input[name="print-activity-mode"][value="appendix"]').check();
        await expect(selection).toBeVisible();

        // Five fit without scrolling.
        const list = selection.locator('.print-activities-list');
        expect(await list.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(false);

        // Wider than the other confirm dialogs, which are 400px.
        const width = await dialog.locator('.modal-content').evaluate(node => node.getBoundingClientRect().width);
        expect(width).toBeGreaterThan(500);
    });

    test('cannot be accepted with none ticked, unless none is to be printed', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        const accept = dialog.locator('button.btn.button-primary');
        const selectAll = dialog.locator('#print-activity-select-all');

        await selectAll.uncheck();
        for (const box of await dialog.locator(SELECTED).all()) await expect(box).not.toBeChecked();
        await expect(accept).toBeDisabled();

        await dialog.locator('input[name="print-activity-mode"][value="omit"]').check();
        await expect(accept).toBeEnabled();
        await dialog.locator('input[name="print-activity-mode"][value="in-place"]').check();
        await expect(accept).toBeDisabled();

        // One is enough, and "all" shows that only some are ticked.
        await dialog.locator(SELECTED).first().check();
        await expect(accept).toBeEnabled();
        expect(await selectAll.evaluate(node => (node as HTMLInputElement).indeterminate)).toBe(true);

        // Cancelling leaves no disabled button behind for the next confirm dialog.
        await selectAll.uncheck();
        await dialog.locator('button.cancel.btn.button-tertiary').click();
        await expect(dialog).toBeHidden();
        const reopened = await openPrintDialog(page);
        await reopened.waitFor({ state: 'visible', timeout: 15000 });
        await expect(accept).toBeEnabled();
    });

    test('leaves out of the document an activity left unticked', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        await dialog.locator(`${SELECTED}[value="${await guessId(page)}"]`).uncheck();
        const { frame } = await choosePrintOption(page, 'appendix');

        // Neither the game, nor its exercise, nor a pointer to one.
        await expect(frame.locator('.worksheet-activity[data-idevice="guess"]')).toHaveCount(0);
        await expect(frame.locator('.adivina-DataGame')).toHaveCount(0);
        // The other four are numbered from one without a gap.
        const references = frame.locator('.worksheet-reference');
        await expect(references).toHaveCount(4);
        for (let index = 0; index < 4; index++) await expect(references.nth(index)).toContainText(String(index + 1));
    });

    test('leaves off the worksheet an activity left unticked', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        await dialog.locator(`${SELECTED}[value="${await guessId(page)}"]`).uncheck();
        const { frame } = await choosePrintOption(page, 'idevices');

        await expect(frame.locator('.worksheet')).toBeVisible();
        await expect(frame.locator('.worksheet-activity[data-idevice="guess"]')).toHaveCount(0);
        await expect(frame.locator('.worksheet-activity').first()).toBeVisible();
    });

    test('scrolls the list rather than growing the dialog beyond five activities', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print many activities');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, CROSSWORD_FIXTURE);

        const dialog = await openPrintDialog(page);
        await dialog.waitFor({ state: 'visible', timeout: 15000 });
        const list = dialog.locator('.print-activities-list');
        expect(await list.locator(SELECTED).count()).toBeGreaterThan(5);

        const { scrolls, rows } = await list.evaluate(node => {
            const row = (node.querySelector('.form-check') as HTMLElement).getBoundingClientRect().height;
            return { scrolls: node.scrollHeight > node.clientHeight, rows: node.clientHeight / row };
        });
        expect(scrolls).toBe(true);
        expect(Math.round(rows)).toBe(5);
    });
});

test.describe('Print: a folded block opens on paper', () => {
    test('prints a folded block that is visible, and leaves the hidden ones folded', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Folded blocks');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // Three blocks, all folded. Only the first is the reader's to see.
        await page.evaluate(() => {
            const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
            const parent = binding.createPage('Folded');
            const kinds: [string, string, string][] = [
                ['ep-open', '', ''],
                ['ep-hidden', 'visibility', 'false'],
                ['ep-teacher', 'teacherOnly', 'true'],
            ];
            for (const [cssClass, property, value] of kinds) {
                const block = binding.createBlock(parent.id, `Block ${cssClass}`);
                const properties = binding.getBlockMap(parent.id, block).get('properties');
                properties.set('cssClass', cssClass);
                properties.set('minimized', 'true');
                if (property) properties.set(property, value);
                binding.createComponent(parent.id, block, 'text', {
                    htmlContent: `<p>Content of ${cssClass}</p>`,
                });
            }
        });

        // Nothing here is an interactive activity, so Print opens the preview without asking —
        // which is the path most projects take, and the one this rule has to hold on.
        await openPrintDialog(page);
        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'true', {
            timeout: 15000,
        });
        const frame = page.frameLocator('.print-preview-iframe');
        await frame.locator('body').waitFor({ state: 'visible', timeout: 30000 });

        const content = (cssClass: string) => frame.locator(`article.${cssClass} .box-content`);

        // On screen the fold is what the reader chose, and printing does not touch it.
        await expect(content('ep-open')).toBeHidden();

        await page.emulateMedia({ media: 'print' });
        await expect(content('ep-open')).toBeVisible();
        await expect(content('ep-open')).toContainText('Content of ep-open');
        // Folded is not the same as hidden: neither of these is the reader's to see.
        await expect(frame.locator('article.ep-hidden')).toBeHidden();
        await expect(frame.locator('article.ep-teacher')).toBeHidden();

        await page.emulateMedia({ media: 'screen' });
        await expect(content('ep-open')).toBeHidden();
    });
});
