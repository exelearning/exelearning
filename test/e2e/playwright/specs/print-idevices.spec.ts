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
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Legacy activities');
                const components = [
                    {
                        type: 'adaptative-quiz',
                        properties: {
                            caseSensitive: true,
                            numRound: 3,
                            questions: [
                                { text: 'Is A<B true?', options: ['Yes', 'No'] },
                                {
                                    typeSelect: 1,
                                    question: 'Sort order',
                                    options: ['Alpha', 'Beta'],
                                },
                                {
                                    typeSelect: 2,
                                    question: 'pH',
                                    solutionWord: 'Acidity < 7 & <script>alert(1)</script>',
                                    percentageShow: 100,
                                },
                                { text: 'Extra question beyond numRound', options: ['X', 'Y'] },
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

            await openPrintPanel(page);
            const { frame } = await choosePrintOption(page, mode);
            const quiz = frame.locator('.worksheet-activity[data-idevice="adaptative-quiz"]');
            await expect(quiz.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
            await expect(quiz.locator('.worksheet-item')).toHaveCount(3);
            await expect(quiz.locator('.worksheet-prompt')).toHaveText([
                'Is A<B true?',
                'Sort order',
                'Acidity < 7 & <script>alert(1)</script>',
            ]);
            await expect(frame.locator('body')).not.toContainText('Extra question beyond numRound');
            await expect(quiz.locator('.worksheet-item').nth(0).locator('.worksheet-option-label')).toHaveText([
                'Yes',
                'No',
            ]);
            await expect(quiz.locator('.worksheet-option-box')).toHaveCount(2);
            await expect(quiz.locator('.worksheet-option-line')).toHaveCount(2);
            expect(
                (
                    await quiz.locator('.worksheet-item').nth(1).locator('.worksheet-option-label').allTextContents()
                ).sort(),
            ).toEqual(['Alpha', 'Beta']);
            await expect(quiz.locator('.worksheet-box')).toHaveText(['p', 'H']);
            await expect(quiz.locator('script')).toHaveCount(0);

            const list = frame.locator('.worksheet-activity[data-idevice="scrambled-list"]');
            await expect(list.locator('.worksheet-option-label')).toHaveCount(2);
            expect((await list.locator('.worksheet-option-label').allTextContents()).sort()).toEqual([
                'First',
                'Second',
            ]);
            await expect(list.locator('.worksheet-option-line')).toHaveCount(2);

            if (mode === 'idevices') {
                await page.emulateMedia({ media: 'print' });
                const firstActivityBreak = await quiz.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.breakBefore || style.pageBreakBefore;
                });
                expect(firstActivityBreak).toBe('auto');

                const secondActivityBreak = await list.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.breakBefore || style.pageBreakBefore;
                });
                expect(['page', 'always']).toContain(secondActivityBreak);

                await page.emulateMedia({ media: null });
            }

            if (mode === 'appendix') {
                await page.emulateMedia({ media: 'print' });
                const appendixBreak = await frame.locator('#section-worksheet-appendix').evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.breakBefore || style.pageBreakBefore;
                });
                expect(['page', 'always']).toContain(appendixBreak);

                const firstItemBreak = await frame
                    .locator('#section-worksheet-appendix .box-content > :first-child')
                    .evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.breakBefore || style.pageBreakBefore;
                    });
                expect(firstItemBreak).toBe('auto');

                const secondItemBreak = await frame
                    .locator('#section-worksheet-appendix .box-content > :not(:first-child)')
                    .first()
                    .evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.breakBefore || style.pageBreakBefore;
                    });
                expect(['page', 'always']).toContain(secondItemBreak);

                await page.emulateMedia({ media: null });
            }
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
                            { activityType: 'fill', baseText: '<p>Complete the <u>sentence</u></p>' },
                            {
                                activityType: 'dropdown',
                                baseText: '<p>Choose <u>red</u></p>',
                                wrongAnswersValue: 'blue',
                            },
                        ],
                    },
                },
                {
                    type: 'trueorfalse',
                    html: '',
                    properties: {
                        msgs: { msgTrue: 'True', msgFalse: 'False' },
                        questionsGame: [
                            { question: '<p>First statement</p>' },
                            { question: '<p>Second statement</p>' },
                        ],
                    },
                },
                {
                    type: 'select-media-files',
                    properties: {},
                    html:
                        pack('seleccionamedias', {
                            numberMaxCards: '2',
                            phrasesGame: [
                                {
                                    definition: 'Choose an animal',
                                    cards: names.map(eText => ({ eText, backcolor: '#ff0000' })),
                                },
                            ],
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
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
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
            await openPrintPanel(page);
            const { frame } = await choosePrintOption(page, mode);
            const form = frame.locator('[data-idevice="form"]');
            await expect(form.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
            await expect(form.locator('.worksheet-item')).toHaveCount(4);
            await expect(form.locator('.worksheet-gap')).toHaveCount(2);
            await expect(form.locator('.worksheet-option-label')).toHaveText([unsafe, 'False', script, 'A<B']);
            await expect(form.locator('img, script, [onerror]')).toHaveCount(0);
            expect(await page.evaluate(() => '__printRegressionExecuted' in window)).toBe(false);

            const tof = frame.locator('[data-idevice="trueorfalse"]');
            await expect(tof.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
            await expect(tof.locator('.worksheet-item')).toHaveCount(2);
            await expect(tof.locator('.worksheet-option-label')).toHaveText(['True', 'False', 'True', 'False']);

            const cards = frame.locator('[data-idevice="select-media-files"] .worksheet-media-option');
            await expect(cards).toHaveCount(2);
            await expect(
                frame.locator('[data-idevice="select-media-files"] .worksheet-media-option-marked'),
            ).toHaveCount(0);
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
                    const bridge = (window as any).eXeLearning.app.project._yjsBridge;
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
            await openPrintPanel(page);
            const { frame } = await choosePrintOption(page, mode);
            const rubric = frame.locator('.worksheet-rubric');
            await expect(rubric.locator('tbody th')).toHaveText('Content');
            await expect(rubric.locator('tbody td')).toContainText('Complete');
            const fields = rubric.locator('.worksheet-rubric-field');
            // The worksheet asks for the date in its own header, so there the rubric drops its date
            // and keeps its name, under the activity it names.
            await expect(fields).toHaveCount(mode === 'idevices' ? 3 : 4);
            await expect(fields.nth(1)).toContainText('Learner name');
            if (mode === 'idevices') {
                await expect(frame.locator('.worksheet-fields')).toBeVisible();
                await expect(fields.filter({ hasText: 'Assessment date' })).toHaveCount(0);
            } else await expect(fields.filter({ hasText: 'Assessment date' })).toBeVisible();
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
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
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

    for (const idevice of [
        'az-quiz-game',
        'guess',
        'quick-questions',
        'quick-questions-multiple-choice',
        'hidden-image',
        'word-search',
    ] as const) {
        for (const mode of ['idevices', 'in-place', 'appendix']) {
            test(`keeps ${idevice} illustrations inside two columns in ${mode} mode`, async ({
                authenticatedPage: page,
                createProject,
            }) => {
                const uuid = await createProject(page, 'Two-column illustrated questions');
                await gotoWorkarea(page, uuid);
                await waitForAppReady(page);
                const picture = await page.evaluate(() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 300;
                    const context = canvas.getContext('2d')!;
                    context.fillStyle = '#bbccee';
                    context.fillRect(0, 0, 400, 300);
                    return canvas.toDataURL('image/png');
                });
                const prefix = {
                    guess: 'adivina',
                    'az-quiz-game': 'rosco',
                    'quick-questions': 'quext',
                    'quick-questions-multiple-choice': 'selecciona',
                    'hidden-image': 'hiddenimage',
                    'word-search': 'sopa',
                }[idevice];
                const questions = [
                    { type: 1, quextion: 'First illustration', question: 'First illustration', url: picture },
                    {
                        type: 0,
                        quextion: `<p>Natural size</p><img src="${picture}">`,
                        question: `<p>Natural size</p><img src="${picture}">`,
                    },
                    {
                        type: 3,
                        quextion: 'Small illustration',
                        question: `<p>Small illustration</p><img src="${picture}" width="40" height="30">`,
                        eText: escape(`<img src="${picture}" width="40" height="30">`),
                    },
                    {
                        type: 3,
                        quextion: 'Last illustration',
                        question: `<p>Last illustration</p><img src="${picture}" width="400" height="300">`,
                        eText: escape(`<img src="${picture}" width="400" height="300">`),
                        options: [`<img src="${picture}" width="400" height="300">`, 'No'],
                    },
                ].map(question => ({
                    numberOptions: 2,
                    solution: 0,
                    options: ['Yes', 'No'],
                    ...question,
                }));
                const html = `<div class="${prefix}-DataGame">${encryptDataGame(
                    JSON.stringify({
                        letters: 'ABCD',
                        optionsRamdon: false,
                        percentajeQuestions: 100,
                        percentageShow: 0,
                        answersRamdon: false,
                        questionsGame:
                            idevice === 'quick-questions' || idevice === 'hidden-image' ? questions : undefined,
                        selectsGame: idevice === 'quick-questions-multiple-choice' ? questions : undefined,
                        wordsGame:
                            idevice === 'guess'
                                ? [
                                      {
                                          word: 'ABCDEFGHIJKLMNOPQRSTUVWX',
                                          type: 1,
                                          definition: 'First illustration',
                                          url: picture,
                                      },
                                      {
                                          word: 'BEE',
                                          type: 3,
                                          definition: 'Natural size',
                                          eText: escape(`<img src="${picture}">`),
                                      },
                                      {
                                          word: 'CAT',
                                          type: 3,
                                          definition: 'Small illustration',
                                          eText: escape(`<img src="${picture}" width="40" height="30">`),
                                      },
                                      {
                                          word: 'DOG',
                                          type: 3,
                                          definition: 'Last illustration',
                                          eText: escape(`<img src="${picture}" width="400" height="300">`),
                                      },
                                  ]
                                : [
                                      {
                                          word: 'ANT',
                                          definition: `<p>First illustration</p><img src="${picture}" width="400" height="300">`,
                                      },
                                      { word: 'BEE', definition: `<p>Natural size</p><img src="${picture}">` },
                                      {
                                          word: 'CAT',
                                          definition: `<p>Small illustration</p><img src="${picture}" width="40" height="30">`,
                                      },
                                      {
                                          word: 'DOG',
                                          definition: `<p>Last illustration</p><img src="${picture}" width="400" height="300">`,
                                      },
                                  ],
                    }),
                )}</div>`;
                await page.evaluate(
                    ({ htmlContent, idevice }) => {
                        const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                        const parent = binding.createPage('Illustrated clues');
                        binding.createComponent(parent.id, binding.createBlock(parent.id), idevice, { htmlContent });
                    },
                    { htmlContent: html, idevice },
                );
                await openPrintPanel(page);
                const { frame } = await choosePrintOption(page, mode);
                await page.emulateMedia({ media: 'print' });
                await page.locator('.print-preview-iframe').evaluate((iframe: HTMLIFrameElement) => {
                    iframe.style.width = '180mm';
                });
                const activity = frame.locator(`[data-idevice="${idevice}"]`);
                const pictures = activity.locator('.worksheet-item img');
                await expect(pictures).toHaveCount(
                    idevice === 'quick-questions' ||
                        idevice === 'quick-questions-multiple-choice' ||
                        idevice === 'hidden-image'
                        ? 5
                        : 4,
                );
                for (const picture of await pictures.all()) {
                    await expect
                        .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
                        .toBe(true);
                }
                const geometry = await pictures.evaluateAll(images =>
                    images.map(image => {
                        const bounds = image.getBoundingClientRect();
                        const prompt = image.parentElement!.getBoundingClientRect();
                        return {
                            width: bounds.width,
                            height: bounds.height,
                            left: bounds.left - prompt.left,
                            right: prompt.right - bounds.right,
                        };
                    }),
                );
                for (const bounds of geometry) {
                    expect(bounds.width).toBeGreaterThan(0);
                    expect(bounds.left).toBeGreaterThanOrEqual(-1);
                    expect(bounds.right).toBeGreaterThanOrEqual(-1);
                    expect(Math.abs(bounds.width / bounds.height - 4 / 3)).toBeLessThan(0.02);
                }
                // Small author-sized pictures should not be enlarged to fill a column.
                expect(geometry[2].width).toBeCloseTo(40, 0);
                expect(geometry[0].width).toBeLessThan(400);
                const positions = await activity.locator('.worksheet-item').evaluateAll(items =>
                    items.map(item => {
                        const bounds = item.getBoundingClientRect();
                        return { x: bounds.x, y: bounds.y, overflow: item.scrollWidth - item.clientWidth };
                    }),
                );
                expect(positions).toHaveLength(4);
                expect(positions[0].x).toBeLessThan(positions[1].x);
                expect(Math.abs(positions[0].y - positions[1].y)).toBeLessThan(1);
                expect(positions[2].y).toBeGreaterThan(positions[0].y);
                expect(Math.abs(positions[2].y - positions[3].y)).toBeLessThan(1);
                for (const position of positions) expect(position.overflow).toBeLessThanOrEqual(1);
                if (idevice === 'guess') {
                    await expect(activity.locator('.worksheet-items')).not.toHaveClass(/worksheet-items-plain/);
                    await expect(activity.locator('.worksheet-item').first().locator('.worksheet-box')).toHaveCount(24);
                }
                if (
                    idevice === 'quick-questions' ||
                    idevice === 'quick-questions-multiple-choice' ||
                    idevice === 'hidden-image'
                ) {
                    await expect(activity.locator('.worksheet-items')).not.toHaveClass(/worksheet-items-plain/);
                    await expect(activity.locator('.worksheet-option-box')).toHaveCount(8);
                    await expect(activity.locator('.worksheet-option').first()).toHaveText('Yes');
                    await expect(activity.locator('.worksheet-option').last()).toHaveText('No');
                }
            });
        }
    }

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
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Printable regressions');
                for (const component of components) {
                    const block = binding.createBlock(parent.id);
                    binding.createComponent(parent.id, block, component.type, { htmlContent: component.html });
                }
            }, components);
            await openPrintPanel(page);
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

        // The plain print preview shares this overlay, so its heading must come back.
        await page.locator('#dropdownFile').click();
        await page.locator('#navbar-button-export-print').click();

        await expect(overlay).toHaveAttribute('data-visible', 'true', { timeout: 15000 });
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
        const numbers = (await clues.evaluateAll(items => items.map(item => item.getAttribute('value')))).map(Number);
        expect(Math.min(...numbers)).toBe(1);
        await expect(activity.locator('.worksheet-answer')).toHaveCount(0);

        // Across on the left and down on the right, each column in number order, split by a rule.
        const columns = activity.locator('.worksheet-clue-column');
        await expect(columns).toHaveCount(2);
        for (const column of await columns.all()) {
            const inColumn = (
                await column
                    .locator('.worksheet-item')
                    .evaluateAll(items => items.map(item => item.getAttribute('value')))
            ).map(Number);
            expect(inColumn).toEqual([...inColumn].sort((a, b) => a - b));
        }
        const [left, right] = await Promise.all([columns.nth(0).boundingBox(), columns.nth(1).boundingBox()]);
        expect(left?.x ?? 0).toBeLessThan(right?.x ?? 0);
        expect(Math.abs((left?.y ?? 0) - (right?.y ?? 0))).toBeLessThan(1);

        // The grid comes before the clue list.
        const gridBox = await activity.locator('.worksheet-grid').boundingBox();
        const cluesBox = await activity.locator('.worksheet-clue-columns').boundingBox();
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

        // It asks 100% of its four questions in stored order, so all four print in two columns.
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(4);

        // Its questions offer options to tick.
        expect(await activity.locator('.worksheet-option-box').count()).toBeGreaterThan(0);
    });

    test('prints a word search activity with its grid and clues in two columns', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print iDevices Word Search');

        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, CROSSWORD_FIXTURE);

        const { frame } = await openWorksheet(page);

        const activity = frame.locator('.worksheet-activity[data-idevice="word-search"]');
        await expect(activity).toHaveCount(1);

        // Grid on top
        await expect(activity.locator('.worksheet-word-grid')).toBeVisible();

        // Clues below in two columns with their illustrations
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(5);
        await expect(activity.locator('.worksheet-item .worksheet-media img')).toHaveCount(5);
    });

    test('prints an electrical circuits activity with questions and diagrams in two columns', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Electrical Circuits');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const circuitSvg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80"><rect width="100" height="80" fill="#bbccee"/></svg>';
        const payload = JSON.stringify({
            typeGame: 'ElectricalCircuits',
            version: 3.1,
            selectsGame: [
                {
                    quextion: '¿Cómo están conectadas las bombillas?',
                    description: 'Circuito 1',
                    tikzSvg: circuitSvg,
                    typeSelect: 0,
                    options: ['En serie', 'En paralelo'],
                    numberOptions: 2,
                    solution: 0,
                },
                {
                    quextion: '¿Qué componente es?',
                    description: 'Circuito 2',
                    tikzSvg: circuitSvg,
                    typeSelect: 0,
                    options: ['Resistencia', 'Condensador'],
                    numberOptions: 2,
                    solution: 0,
                },
            ],
        });
        const html = `<div class="electrical-circuits-IDevice"><div class="electrical-circuits-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Circuits Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'electrical-circuits', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="electrical-circuits"]');
        await expect(activity).toHaveCount(1);

        // Rendered in two columns
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(2);

        // Diagrams and options are rendered
        await expect(activity.locator('.worksheet-item .worksheet-media img')).toHaveCount(2);
        await expect(activity.locator('.worksheet-option-box')).toHaveCount(4);
    });

    test('prints electrical circuits in presentation mode in two columns', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Electrical Circuits Show');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const circuitSvg =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" width="100" height="80"><rect width="100" height="80" fill="#bbccee"/></svg>';
        const payload = JSON.stringify({
            typeGame: 'ElectricalCircuits',
            version: 3.1,
            activityMode: 'show',
            selectsGame: [
                {
                    description: 'Circuito en serie',
                    tikzSvg: circuitSvg,
                },
                {
                    description: 'Circuito en paralelo',
                    tikzSvg: circuitSvg,
                },
            ],
        });
        const html = `<div class="electrical-circuits-IDevice"><div class="electrical-circuits-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Circuits Show Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'electrical-circuits', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="electrical-circuits"]');
        await expect(activity).toHaveCount(1);

        // Rendered in two columns, plain (unnumbered)
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-plain/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(2);

        // Diagrams and descriptions
        await expect(activity.locator('.worksheet-item .worksheet-media img')).toHaveCount(2);
        await expect(activity.locator('.worksheet-extra')).toHaveCount(2);
    });

    test('prints a 3D molecules activity with questions and captures in two columns', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices 3D Molecules');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const picture =
            'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2080%22%20width%3D%22100%22%20height%3D%2280%22%3E%3Crect%20width%3D%22100%22%20height%3D%2280%22%20fill%3D%22%23bbccee%22%2F%3E%3C%2Fsvg%3E';
        const payload = JSON.stringify({
            typeGame: '3DMol',
            version: 1.0,
            selectsGame: [
                {
                    quextion: '¿Cuántos átomos de carbono tiene?',
                    description: 'Glucosa',
                    alt: 'Glucosa',
                    modelImage: picture,
                    typeSelect: 0,
                    options: ['Seis', 'Doce'],
                    numberOptions: 2,
                    solution: 0,
                },
                {
                    quextion: '¿Qué molécula representa?',
                    description: 'Agua',
                    alt: 'Agua',
                    modelImage: picture,
                    typeSelect: 0,
                    options: ['Agua', 'Metano'],
                    numberOptions: 2,
                    solution: 0,
                },
            ],
        });
        const html = `<div class="dmole-IDevice"><div class="dmole-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Molecules Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), '3dmol', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="3dmol"]');
        await expect(activity).toHaveCount(1);

        // Rendered in two columns
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(2);

        // Captures and options are rendered
        await expect(activity.locator('.worksheet-item .worksheet-media img')).toHaveCount(2);
        await expect(activity.locator('.worksheet-option-box')).toHaveCount(4);
    });

    test('prints 3D molecules in presentation mode in two columns', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices 3D Molecules Show');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const picture =
            'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%2080%22%20width%3D%22100%22%20height%3D%2280%22%3E%3Crect%20width%3D%22100%22%20height%3D%2280%22%20fill%3D%22%23bbccee%22%2F%3E%3C%2Fsvg%3E';
        const payload = JSON.stringify({
            typeGame: '3DMol',
            version: 1.0,
            activityMode: 'show',
            selectsGame: [
                {
                    description: 'Glucosa en varillas',
                    alt: 'Glucosa',
                    modelImage: picture,
                },
                {
                    description: 'Agua en esferas',
                    alt: 'Agua',
                    modelImage: picture,
                },
            ],
        });
        const html = `<div class="dmole-IDevice"><div class="dmole-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Molecules Show Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), '3dmol', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="3dmol"]');
        await expect(activity).toHaveCount(1);

        // Rendered in two columns, plain (unnumbered)
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-columns/);
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-plain/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(2);

        // Captures and descriptions
        await expect(activity.locator('.worksheet-item .worksheet-media img')).toHaveCount(2);
        await expect(activity.locator('.worksheet-extra')).toHaveCount(2);
    });

    test('prints a padlock activity showing only feedback and no instructions', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Padlock');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const payload = JSON.stringify({
            candadoSolution: '1234',
            candadoInstructions: '',
            candadoRetro: '',
            candadoAttemps: 3,
        });
        const html = [
            '<div class="candado-IDevice">',
            '<div class="candado-version js-hidden">1</div>',
            '<div class="candado-instructions js-hidden"><p>Pista secreta para resolver el candado</p></div>',
            '<div class="candado-retro js-hidden"><p>¡Enhorabuena! Has desbloqueado el contenido secreto.</p></div>',
            `<div class="candado-DataGame js-hidden">${encryptDataGame(payload)}</div>`,
            '</div>',
        ].join('');

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Padlock Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'padlock', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="padlock"]');
        await expect(activity).toHaveCount(1);

        // Instructions must NOT be printed
        await expect(activity.locator('.worksheet-instructions')).toHaveCount(0);
        await expect(activity).not.toContainText('Pista secreta para resolver el candado');

        // Only feedback is rendered (unnumbered)
        await expect(activity.locator('.worksheet-items')).toHaveClass(/worksheet-items-plain/);
        await expect(activity.locator('.worksheet-item')).toHaveCount(1);
        await expect(activity.locator('.worksheet-item')).toContainText(
            '¡Enhorabuena! Has desbloqueado el contenido secreto.',
        );
    });

    for (const mode of ['idevices', 'in-place', 'appendix']) {
        test(`says a padlock guarding no writing is not available in print, in ${mode} mode`, async ({
            authenticatedPage: page,
            createProject,
        }) => {
            const uuid = await createProject(page, 'Print iDevices empty padlock');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);

            const padlock = (feedback: string) =>
                '<div class="candado-IDevice">' +
                '<div class="candado-instructions js-hidden"><p>Busca el código en la unidad</p></div>' +
                `<div class="candado-retro js-hidden">${feedback}</div>` +
                '</div>';
            await page.evaluate(
                ({ contents }) => {
                    const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                    const parent = binding.createPage('Padlock Page');
                    for (const htmlContent of contents)
                        binding.createComponent(parent.id, binding.createBlock(parent.id), 'padlock', { htmlContent });
                },
                { contents: [padlock('<p>Texto desbloqueado</p>'), padlock('')] },
            );

            await openPrintPanel(page);
            const { frame } = await choosePrintOption(page, mode);
            const labels = await page.evaluate(() => ({
                listed: (window as any)._('Not available in print'),
                note: (window as any)._('Not available in print.'),
            }));

            // The lock that guards writing prints it; the empty one has nothing of its own to print.
            await expect(frame.locator('.worksheet-activity[data-idevice="padlock"] .worksheet-item')).toHaveText([
                'Texto desbloqueado',
            ]);
            await expect(frame.locator('body')).not.toContainText('Busca el código en la unidad');

            if (mode === 'idevices') {
                // Listed for the teacher as settled, not as data that could not be read.
                await expect(frame.locator('.worksheet-unsupported')).toContainText(labels.listed);
                return;
            }

            const note = frame.locator(
                '.worksheet-activity-unprintable[data-idevice="padlock"] .worksheet-not-printable',
            );
            await expect(note).toHaveText(labels.note);

            if (mode === 'appendix') {
                // A line-long note follows the exercise before it rather than taking a sheet of its own.
                await page.emulateMedia({ media: 'print' });
                const breaks = await frame.locator('#section-worksheet-appendix .box-content > *').evaluateAll(nodes =>
                    nodes.map(node => {
                        const style = window.getComputedStyle(node);
                        return style.breakBefore || style.pageBreakBefore;
                    }),
                );
                expect(breaks).toEqual(['auto', 'auto']);
                await page.emulateMedia({ media: null });
            }
        });
    }

    test('prints a sort activity in sentence mode with compact writing spaces', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Sort Sentences');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const payload = JSON.stringify({
            type: 0,
            instructions: 'Arrastra cada carta hasta su posición correcta',
            phrasesGame: [{ phrase: 'Hagas lo que hagas, hazlo bien.' }, { phrase: 'Sólo sé que no sé nada' }],
        });
        const html = `<div class="ordena-IDevice"><div class="ordena-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Sort Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'sort', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="sort"]');
        await expect(activity).toHaveCount(1);

        await expect(activity.locator('.worksheet-item')).toHaveCount(2);
        await expect(activity.locator('.worksheet-writing-space')).toHaveCount(2);

        // Verify the compact writing space has 5mm computed height (~18.9px at 96 DPI)
        const spaceHeight = await activity
            .locator('.worksheet-writing-space')
            .first()
            .evaluate(el => window.getComputedStyle(el).height);
        const heightPx = Number.parseFloat(spaceHeight);
        expect(heightPx).toBeGreaterThan(15);
        expect(heightPx).toBeLessThan(22);
    });

    test('prints a math problems activity with compact writing spaces', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Math Problems');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const payload = JSON.stringify({
            typeGame: 'MathProblems',
            instructions: 'Resuelve los siguientes problemas',
            questions: [
                { wordingseg: 'Compra {a} manzanas a 2 euros. ¿Cuánto paga?', min: 3, max: 3, decimals: 0 },
                { wordingseg: 'Tiene {a} lápices y regala 1. ¿Cuántos le quedan?', min: 5, max: 5, decimals: 0 },
            ],
        });
        const html = `<div class="mathproblems-IDevice"><div class="mathproblems-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Math Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'mathproblems', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="mathproblems"]');
        await expect(activity).toHaveCount(1);

        await expect(activity.locator('.worksheet-item')).toHaveCount(2);
        await expect(activity.locator('.worksheet-writing-space')).toHaveCount(2);

        // Verify the compact writing space has 5mm computed height (~18.9px at 96 DPI)
        const spaceHeight = await activity
            .locator('.worksheet-writing-space')
            .first()
            .evaluate(el => window.getComputedStyle(el).height);
        const heightPx = Number.parseFloat(spaceHeight);
        expect(heightPx).toBeGreaterThan(15);
        expect(heightPx).toBeLessThan(22);
    });

    test('prints a challenge activity with compact writing spaces for challenge and trials', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Challenge');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const payload = JSON.stringify({
            typeGame: 'desafio',
            desafioTitle: 'Pandemia reto mundial',
            desafioDescription: '<p>Averigua qué pandemia fue</p>',
            desafioSolution: 'Gripe española',
            desafioType: 0,
            desafioTime: 60,
            instructions: 'Resuelve el desafío y los retos',
            challengesGame: [
                {
                    title: 'Los primeros síntomas',
                    description: '<p>Busca la fecha del primer caso</p>',
                    solution: 'G P Ñ',
                },
                {
                    title: 'Propagación rápida',
                    description: '<p>Encuentra el foco de infección</p>',
                    solution: 'Camp Funston',
                },
            ],
            msgs: { msgChallenge: 'Reto' },
        });
        const html = `<div class="desafio-IDevice"><div class="desafio-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Challenge Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'challenge', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="challenge"]');
        await expect(activity).toHaveCount(1);

        await expect(activity.locator('.worksheet-item')).toHaveCount(3);
        await expect(activity.locator('.worksheet-writing-space')).toHaveCount(3);

        // Verify the compact writing space has 5mm computed height (~18.9px at 96 DPI)
        const spaceHeight = await activity
            .locator('.worksheet-writing-space')
            .first()
            .evaluate(el => window.getComputedStyle(el).height);
        const heightPx = Number.parseFloat(spaceHeight);
        expect(heightPx).toBeGreaterThan(15);
        expect(heightPx).toBeLessThan(22);
    });

    test('prints an identify activity with compact writing spaces', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print iDevices Identify');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const payload = JSON.stringify({
            typeGame: 'identifica',
            instructions: 'Adivina el personaje',
            questionsGame: [
                {
                    question: 'Filósofo griego',
                    numberClues: 2,
                    clues: ['Discípulo de Sócrates', 'Fundó la Academia'],
                    solution: 'Platón',
                },
                {
                    question: 'Científico',
                    numberClues: 1,
                    clues: ['Teoría de la relatividad'],
                    solution: 'Einstein',
                },
            ],
            msgs: { msgClue: 'Pista' },
        });
        const html = `<div class="identifica-IDevice"><div class="identifica-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;

        await page.evaluate(
            ({ htmlContent }) => {
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                const parent = binding.createPage('Identify Page');
                binding.createComponent(parent.id, binding.createBlock(parent.id), 'identify', {
                    htmlContent,
                });
            },
            { htmlContent: html },
        );

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'idevices');

        const activity = frame.locator('.worksheet-activity[data-idevice="identify"]');
        await expect(activity).toHaveCount(1);

        await expect(activity.locator('.worksheet-item')).toHaveCount(2);
        await expect(activity.locator('.worksheet-writing-space')).toHaveCount(2);

        // Verify the compact writing space has 5mm computed height (~18.9px at 96 DPI)
        const spaceHeight = await activity
            .locator('.worksheet-writing-space')
            .first()
            .evaluate(el => window.getComputedStyle(el).height);
        const heightPx = Number.parseFloat(spaceHeight);
        expect(heightPx).toBeGreaterThan(15);
        expect(heightPx).toBeLessThan(22);
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
                const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
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
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
            const parent = binding.createPage('JSON exercises');
            const block = binding.createBlock(parent.id);
            for (const type of types) binding.createComponent(parent.id, block, type, { htmlContent: '' });
        }, types);

        await openPrintPanel(page);
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
                const bridge = (window as any).eXeLearning.app.project._yjsBridge;
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
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 1;
                const blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob(
                        value => (value ? resolve(value) : reject(new Error('Could not encode test PNG'))),
                        'image/png',
                    );
                });
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
        // Every clue sits in a column headed by its direction, with the number the grid shows.
        const allClues = crossword.locator('.worksheet-item');
        await expect(crossword.locator('.worksheet-clue-column .worksheet-item')).toHaveCount(await allClues.count());
        for (const clue of await allClues.all()) expect(gridNumbers).toContain(await clue.getAttribute('value'));
        for (const heading of await crossword.locator('.worksheet-clue-heading').all())
            await expect(heading).not.toBeEmpty();
        await page.emulateMedia({ media: 'print' });
        await expect(choices).toBeVisible();
        await expect(testActivity.locator('svg')).toBeVisible();
    });
});

/**
 * Open File → Print and return the panel that offers the print options.
 *
 * Printing opens the preview at once, with the panel beside it. When the project has no
 * interactive activity the panel offers only the document options.
 */
async function openPrintPanel(page: Page) {
    await dismissImportAlert(page);
    await page.locator('#dropdownFile').click();

    const entry = page.locator('#navbar-button-export-print');
    await entry.waitFor({ state: 'visible', timeout: 5000 });
    await entry.click();

    return page.locator('#printOptionsPanel');
}

/**
 * Wait for the preview to be drawn: the overlay has stopped being busy and its document is shown.
 *
 * Changing an option draws the preview again, and until the new document has loaded the frame
 * still holds the old one, so a test that read it sooner would be reading the wrong document.
 */
async function waitForPreview(page: Page) {
    const overlay = page.locator('#printPreviewOverlay');
    await expect(overlay).toHaveAttribute('data-visible', 'true', { timeout: 15000 });
    await expect(overlay).toHaveAttribute('data-busy', 'false', { timeout: 60000 });

    const frame = page.frameLocator('.print-preview-iframe');
    // Hidden frames measure zero, so wait for the document to actually be shown.
    await frame.locator('body').waitFor({ state: 'visible', timeout: 30000 });

    return { overlay, frame };
}

/**
 * Choose what to do with the interactive activities and wait for the preview that follows.
 */
async function choosePrintOption(page: Page, value: string) {
    const panel = page.locator('#printOptionsPanel');
    await panel.waitFor({ state: 'visible', timeout: 15000 });
    await panel.locator(`input[name="print-activity-mode"][value="${value}"]`).check();

    return waitForPreview(page);
}

test.describe('Print: choosing what happens to the interactive activities', () => {
    // Serial for the same reason as above: these import multi-megabyte fixtures.
    test.describe.configure({ mode: 'serial' });

    test('offers only the document options when the project has no interactive activity', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        // A project straight off the template has prose and no games in it.
        const uuid = await createProject(page, 'Print Without Activities');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const panel = await openPrintPanel(page);

        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'true', {
            timeout: 15000,
        });
        await expect(panel).toBeVisible();
        await expect(page.locator('.print-preview-options-btn')).toBeVisible();
        await expect(panel.locator('input[name="print-activity-mode"]')).toHaveCount(0);
        await expect(panel.locator('#printOptLinkUrls')).toBeChecked();
        // With no activity at all, there is none that cannot be printed to ask about.
        await expect(panel.locator('#printOptUnprintableTitles')).toBeHidden();
    });

    test('offers the options beside the preview when the project has them, with printing them in an appendix preselected', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'true');
        await expect(panel.locator('input[name="print-activity-mode"]')).toHaveCount(4);
        await expect(panel.locator('input[name="print-activity-mode"][value="appendix"]')).toBeChecked();

        // The preview is drawn at once, for the choice that is preselected: a pointer where each
        // activity was, and the exercise itself in the appendix.
        const { frame } = await waitForPreview(page);
        await expect(frame.locator('.worksheet-reference').first()).toBeVisible();
        await expect(
            frame.locator('.worksheet-activity[data-idevice="guess"]:not(.worksheet-activity-reference)'),
        ).toHaveCount(1);
    });

    test('docks the panel beside the preview, as wide as the Styles panel', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });

        const panelBox = await panel.boundingBox();
        const previewBox = await page.locator('.print-preview-content').boundingBox();
        expect(Math.round(panelBox!.width)).toBe(320);
        // Beside the preview, never over it.
        expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(panelBox!.x + 1);
    });

    test('closes the options with the preview', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('.print-preview-close-btn').click();

        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-visible', 'false');
        await expect(panel).toBeHidden();
    });

    test('hides the options from their own button and shows them again from the header', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        const toggle = page.locator('.print-preview-options-btn');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');

        await panel.locator('.print-options-close').click();
        await expect(panel).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');

        await toggle.click();
        await expect(panel).toBeVisible();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    test('draws the preview again when the choice changes, without closing it', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintPanel(page);
        const { frame } = await waitForPreview(page);
        await expect(frame.locator('.worksheet-reference').first()).toBeVisible();

        await choosePrintOption(page, 'omit');
        await expect(frame.locator('.worksheet-activity')).toHaveCount(0);
        await expect(frame.locator('.exe-single-page')).toBeVisible();

        await choosePrintOption(page, 'idevices');
        await expect(frame.locator('.worksheet')).toBeVisible();
        await expect(frame.locator('.exe-single-page')).toHaveCount(0);

        await choosePrintOption(page, 'in-place');
        await expect(frame.locator('.exe-single-page')).toBeVisible();
        await expect(frame.locator('.worksheet-activity[data-idevice="guess"]')).toHaveCount(1);
        await expect(frame.locator('.worksheet-reference')).toHaveCount(0);
    });

    test('titles the overlay for the worksheet while only the activities are chosen', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintPanel(page);
        const { overlay } = await waitForPreview(page);
        const title = overlay.locator('.print-preview-title-text');
        await expect(title).toHaveText('Print preview');

        await choosePrintOption(page, 'idevices');
        await expect(title).toHaveText('Print iDevices');

        await choosePrintOption(page, 'appendix');
        await expect(title).toHaveText('Print preview');
    });

    test('does not allow printing while the preview is being drawn again', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await waitForPreview(page);
        const print = page.locator('.print-preview-print-btn');
        await expect(print).toBeEnabled();

        await panel.locator('input[name="print-activity-mode"][value="in-place"]').check();
        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-busy', 'true');
        await expect(print).toBeDisabled();

        await waitForPreview(page);
        await expect(print).toBeEnabled();
    });

    test('keeps printing disabled after a failed regeneration and recovers with new options', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);
        const panel = await openPrintPanel(page);
        await waitForPreview(page);
        await page.evaluate(() => {
            const app = window as any;
            const original = app.generatePrintPreview;
            app.generatePrintPreview = () => {
                app.generatePrintPreview = original;
                throw new Error('Print regeneration test failure');
            };
        });

        await panel.locator('input[value="in-place"]').check();
        await expect(page.locator('.print-preview-error')).toContainText('Print regeneration test failure');
        await expect(page.locator('#printPreviewOverlay')).toHaveAttribute('data-busy', 'false');
        await expect(page.locator('.print-preview-print-btn')).toBeDisabled();
        await expect(page.locator('.print-preview-iframe')).toHaveAttribute('src', 'about:blank');

        const { frame } = await choosePrintOption(page, 'omit');
        await expect(page.locator('.print-preview-print-btn')).toBeEnabled();
        await expect(page.locator('.print-preview-error')).toHaveCount(0);
        await expect(frame.locator('.worksheet-activity')).toHaveCount(0);
        await expect(frame.locator('.exe-single-page')).toBeVisible();
    });

    test('runs only the latest pending options after a slow generation finishes', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);
        const panel = await openPrintPanel(page);
        await waitForPreview(page);
        await page.evaluate(() => {
            const app = window as any;
            const state = { calls: [] as string[], release: () => {}, restore: () => {} };
            const gate = new Promise<void>(resolve => {
                state.release = resolve;
            });
            const originalDocument = app.generatePrintPreview;
            const originalWorksheet = app.generateWorksheet;
            const generateDocument = originalDocument || app.SharedExporters.generatePrintPreview;
            const generateWorksheet = originalWorksheet || app.SharedExporters.generateWorksheet;
            app.generatePrintPreview = async (...args: any[]) => {
                state.calls.push(args[2].activities.mode);
                if (state.calls.length === 1) await gate;
                return generateDocument(...args);
            };
            app.generateWorksheet = async (...args: any[]) => {
                state.calls.push('idevices');
                return generateWorksheet(...args);
            };
            state.restore = () => {
                app.generatePrintPreview = originalDocument;
                app.generateWorksheet = originalWorksheet;
            };
            app.__printGenerationTest = state;
        });
        try {
            await panel.locator('input[value="in-place"]').check();
            await expect
                .poll(() => page.evaluate(() => (window as any).__printGenerationTest.calls))
                .toEqual(['in-place']);
            for (const choice of ['omit', 'idevices', 'appendix']) {
                await panel.locator(`input[value="${choice}"]`).check();
                await expect
                    .poll(() =>
                        page.evaluate(
                            () => (window as any).eXeLearning.app.modals.printpreview.regenerateTimer === null,
                        ),
                    )
                    .toBe(true);
            }
            expect(await page.evaluate(() => (window as any).__printGenerationTest.calls)).toEqual(['in-place']);
            await expect(page.locator('.print-preview-print-btn')).toBeDisabled();
            await page.evaluate(() => (window as any).__printGenerationTest.release());
            const { frame } = await waitForPreview(page);
            expect(await page.evaluate(() => (window as any).__printGenerationTest.calls)).toEqual([
                'in-place',
                'appendix',
            ]);
            await expect(frame.locator('.worksheet-reference').first()).toBeVisible();
            await expect(page.locator('.print-preview-print-btn')).toBeEnabled();
        } finally {
            await page.evaluate(() => {
                const state = (window as any).__printGenerationTest;
                state.release();
                state.restore();
                delete (window as any).__printGenerationTest;
            });
        }
    });

    test('leaves the activity out of the document when asked to', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'omit');

        // Neither the game nor an exercise in its place; the project's prose stays.
        await expect(frame.locator('.adivina-DataGame')).toHaveCount(0);
        await expect(frame.locator('.worksheet-activity')).toHaveCount(0);
        await expect(frame.locator('.exe-single-page')).toBeVisible();
    });

    test('prints the exercise where the author put it', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        await openPrintPanel(page);
        const { frame } = await choosePrintOption(page, 'in-place');

        // The exercise replaces the game board, inside the document rather than on a sheet of
        // its own.
        const exercise = '.worksheet-activity[data-idevice="guess"]';
        await expect(frame.locator(exercise)).toHaveCount(1);
        // The fixture holds four activities with a paper form — a rubric, two forms and the Guess —
        // and a download button, which has none and never will. Unless its title is asked for, it
        // is left out without even a note.
        const converted = '.worksheet-activity:not(.worksheet-activity-reference):not(.worksheet-activity-unprintable)';
        await expect(frame.locator(converted)).toHaveCount(4);
        await expect(frame.locator('.worksheet-activity-unprintable')).toHaveCount(0);
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

        await openPrintPanel(page);
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

        await openPrintPanel(page);
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

    for (const mode of ['idevices', 'in-place', 'appendix']) {
        for (const selection of ['all', 'second']) {
            test(`prints ${selection} listed activities with shared legacy ids in ${mode} mode`, async ({
                authenticatedPage: page,
                createProject,
            }) => {
                const uuid = await createProject(page, 'Print selection regression');
                await gotoWorkarea(page, uuid);
                await waitForAppReady(page);
                await page.evaluate(() => {
                    const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
                    const visible = binding.createPage('Visible activities');
                    const block = binding.createBlock(visible.id);
                    const addQuestion = (pageId: string, blockId: string, id: string, question: string) =>
                        binding.createComponent(pageId, blockId, 'adaptative-quiz', {
                            id,
                            htmlContent: '',
                            jsonProperties: JSON.stringify({
                                questionsGame: [{ question, typeSelect: 0, options: ['Yes', 'No'] }],
                            }),
                        });
                    addQuestion(visible.id, block, '20251021091936FIRST', 'First visible question');
                    addQuestion(visible.id, block, '20251021091936SECOND', 'Second visible question');

                    const hidden = binding.createPage('Hidden parent');
                    binding.updatePage(hidden.id, { properties: { visibility: 'false' } });
                    const child = binding.createPage('Hidden descendant', hidden.id);
                    addQuestion(child.id, binding.createBlock(child.id), 'hidden-question', 'Hidden question');
                });

                const panel = await openPrintPanel(page);
                await expect(panel.locator(SELECTED)).toHaveCount(2);
                await expect(panel.locator(`${SELECTED}[value="hidden-question"]`)).toHaveCount(0);
                if (selection === 'second') await panel.locator(`${SELECTED}[value="20251021091936FIRST"]`).uncheck();
                const { frame } = await choosePrintOption(page, mode);

                await expect(frame.locator('.worksheet-prompt')).toHaveText(
                    selection === 'all'
                        ? ['First visible question', 'Second visible question']
                        : ['Second visible question'],
                );
                await expect(frame.locator('body')).not.toContainText('Hidden question');
                await expect(frame.locator('body')).not.toContainText('Hidden descendant');
            });
        }
    }

    /** The component id of the fixture's Guess activity, as the options panel lists it. */
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

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        const selection = panel.locator('.print-activities-selection');

        // A rubric, two forms and the Guess: four, each ticked. The download button, which can never
        // be printed, is not listed until its title is asked for.
        await expect(selection).toBeVisible();
        await expect(selection.locator(SELECTED)).toHaveCount(4);
        for (const box of await selection.locator(SELECTED).all()) await expect(box).toBeChecked();
        await expect(selection.locator('#print-activity-select-all')).toBeChecked();
        // Named by page, then by block or iDevice.
        await expect(selection.locator('.print-activities-list label').first()).toContainText(' — ');

        await panel.locator('input[name="print-activity-mode"][value="omit"]').check();
        await expect(selection).toBeHidden();
        await panel.locator('input[name="print-activity-mode"][value="appendix"]').check();
        await expect(selection).toBeVisible();
    });

    test('cannot be printed with none ticked, unless none is to be printed', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        await waitForPreview(page);
        const print = page.locator('.print-preview-print-btn');
        const status = panel.locator('.print-options-status');
        const selectAll = panel.locator('#print-activity-select-all');
        await expect(print).toBeEnabled();
        await expect(status).toBeEmpty();

        await selectAll.uncheck();
        for (const box of await panel.locator(SELECTED).all()) await expect(box).not.toBeChecked();
        await waitForPreview(page);
        await expect(print).toBeDisabled();
        await expect(status).toContainText('Select at least one activity');

        await panel.locator('input[name="print-activity-mode"][value="omit"]').check();
        await waitForPreview(page);
        await expect(print).toBeEnabled();
        await expect(status).toBeEmpty();

        await panel.locator('input[name="print-activity-mode"][value="in-place"]').check();
        await waitForPreview(page);
        await expect(print).toBeDisabled();

        // One is enough, and "all" shows that only some are ticked.
        await panel.locator(SELECTED).first().check();
        await waitForPreview(page);
        await expect(print).toBeEnabled();
        await expect(status).toBeEmpty();
        expect(await selectAll.evaluate(node => (node as HTMLInputElement).indeterminate)).toBe(true);
    });

    test('leaves out of the document an activity left unticked', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        await panel.locator(`${SELECTED}[value="${await guessId(page)}"]`).uncheck();
        const { frame } = await choosePrintOption(page, 'appendix');

        // Neither the game, nor its exercise, nor a pointer to one.
        await expect(frame.locator('.worksheet-activity[data-idevice="guess"]')).toHaveCount(0);
        await expect(frame.locator('.adivina-DataGame')).toHaveCount(0);
        // The other three that can be printed are numbered from one without a gap.
        const references = frame.locator('.worksheet-reference');
        await expect(references).toHaveCount(3);
        for (let index = 0; index < 3; index++) await expect(references.nth(index)).toContainText(String(index + 1));
    });

    test('leaves off the worksheet an activity left unticked', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        await panel.locator(`${SELECTED}[value="${await guessId(page)}"]`).uncheck();
        const { frame } = await choosePrintOption(page, 'idevices');

        await expect(frame.locator('.worksheet')).toBeVisible();
        await expect(frame.locator('.worksheet-activity[data-idevice="guess"]')).toHaveCount(0);
        await expect(frame.locator('.worksheet-activity').first()).toBeVisible();
    });

    test('keeps every activity of a large project within reach by scrolling the panel', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const uuid = await createProject(page, 'Print many activities');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, CROSSWORD_FIXTURE);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        expect(await panel.locator(SELECTED).count()).toBeGreaterThan(5);

        // The panel scrolls as a whole: the last activity is reached by scrolling it into view,
        // and it stays inside the panel instead of spilling out below it.
        const last = panel.locator(SELECTED).last();
        await last.scrollIntoViewIfNeeded();
        await expect(last).toBeVisible();
        await expect(last).toBeChecked();
        const lastBox = await last.boundingBox();
        const panelBox = await panel.boundingBox();
        expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height + 1);
    });
});

test.describe('Print: the activities that can never be printed', () => {
    const SELECTED = 'input[name="print-activity-selected"]';
    const OPTION = '#printOptUnprintableTitles';

    /** A padlock's markup, guarding the given writing. */
    const padlock = (feedback: string) =>
        '<div class="candado-IDevice">' +
        '<div class="candado-instructions js-hidden"><p>Busca el código en la unidad</p></div>' +
        `<div class="candado-retro js-hidden">${feedback}</div>` +
        '</div>';

    /** Open a new project holding the given activities on one page, each in a block named as given. */
    async function openProjectWith(
        page: Page,
        createProject: (page: Page, title?: string) => Promise<string>,
        activities: { type: string; html: string; block: string }[],
    ) {
        const uuid = await createProject(page, 'Print unprintable activities');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await page.evaluate(activities => {
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
            const parent = binding.createPage('Activities');
            for (const { type, html, block } of activities)
                binding.createComponent(parent.id, binding.createBlock(parent.id, block), type, { htmlContent: html });
        }, activities);
    }

    /** A padlock that prints its writing, beside a map and a website that can never be printed. */
    const MIXED = [
        { type: 'padlock', html: padlock('<p>Texto desbloqueado</p>'), block: 'Candado' },
        { type: 'map', html: '', block: 'Mapa de la península' },
        { type: 'external-website', html: '', block: 'Web del museo' },
    ];

    test('offers no option about them when the project has none, a padlock guarding nothing included', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        await openProjectWith(page, createProject, [{ type: 'padlock', html: padlock(''), block: 'Candado vacío' }]);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        await expect(panel.locator(SELECTED)).toHaveCount(1);
        await expect(panel.locator(OPTION)).toBeHidden();

        // A padlock can be printed. One that guards nothing still says so where it stood.
        const { frame } = await choosePrintOption(page, 'in-place');
        await expect(frame.locator('.worksheet-activity-unprintable[data-idevice="padlock"]')).toHaveCount(1);
    });

    test('leaves them out of the list and the document until their titles are asked for', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        await openProjectWith(page, createProject, MIXED);

        const panel = await openPrintPanel(page);
        await panel.waitFor({ state: 'visible', timeout: 15000 });
        const option = panel.locator(OPTION);
        await expect(option).toBeVisible();
        await expect(option).not.toBeChecked();
        await expect(panel.locator(SELECTED)).toHaveCount(1);

        // In the appendix, where printing starts: no pointer, no entry and no block for them.
        let { frame } = await waitForPreview(page);
        await expect(frame.locator('.worksheet-reference')).toHaveCount(1);
        await expect(frame.locator('.worksheet-activity[data-idevice="padlock"] .worksheet-item')).toHaveText(
            'Texto desbloqueado',
        );
        await expect(frame.locator('.worksheet-activity-unprintable')).toHaveCount(0);
        await expect(frame.locator('body')).not.toContainText('Mapa de la península');
        await expect(frame.locator('body')).not.toContainText('Web del museo');

        // Asked for, they are listed and ticked, and each takes a number, a pointer and its note.
        await option.check();
        await expect(panel.locator(SELECTED)).toHaveCount(3);
        for (const box of await panel.locator(SELECTED).all()) await expect(box).toBeChecked();
        ({ frame } = await waitForPreview(page));
        await expect(frame.locator('.worksheet-reference')).toHaveCount(3);
        const notes = frame.locator('#section-worksheet-appendix .worksheet-activity-unprintable');
        await expect(notes).toHaveCount(2);
        await expect(notes.nth(0)).toHaveAttribute('data-idevice', 'map');
        await expect(notes.nth(0)).toContainText('Mapa de la península');
        await expect(notes.nth(1)).toHaveAttribute('data-idevice', 'external-website');
        await expect(notes.nth(1)).toContainText('Web del museo');

        // Where the author put them, each block keeps its title above the note.
        ({ frame } = await choosePrintOption(page, 'in-place'));
        await expect(frame.locator('.worksheet-activity-unprintable')).toHaveCount(2);
        await expect(frame.locator('body')).toContainText('Mapa de la península');

        // Cleared again, they go: from the list and from the page, blocks and all.
        await option.uncheck();
        await expect(panel.locator(SELECTED)).toHaveCount(1);
        ({ frame } = await waitForPreview(page));
        await expect(frame.locator('.worksheet-activity-unprintable')).toHaveCount(0);
        await expect(frame.locator('body')).not.toContainText('Mapa de la península');

        // With no activity to print there is nothing for the option to act on.
        await panel.locator('input[name="print-activity-mode"][value="omit"]').check();
        await expect(option).toBeDisabled();
    });

    test('leaves them out of the teacher’s note on the worksheet until their titles are asked for', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        await openProjectWith(page, createProject, MIXED);

        const panel = await openPrintPanel(page);
        let { frame } = await choosePrintOption(page, 'idevices');
        await expect(frame.locator('.worksheet-activity[data-idevice="padlock"]')).toHaveCount(1);
        await expect(frame.locator('.worksheet-unsupported')).toHaveCount(0);

        const option = panel.locator(OPTION);
        await expect(option).toBeEnabled();
        await option.check();
        ({ frame } = await waitForPreview(page));
        const note = frame.locator('.worksheet-unsupported');
        await expect(note.locator('li')).toHaveCount(2);
        await expect(note).toContainText('map');
        await expect(note).toContainText('external-website');
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
            const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
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

        // Nothing here is an interactive activity, so Print opens the preview with nothing to
        // choose about activities — which is the path most projects take, and the one this rule
        // has to hold on.
        await openPrintPanel(page);
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

    test('prints the blocks as the preview shows them once "Print all visible content" is cleared', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print as shown');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        // Two blocks the author folded and one left open.
        await page.evaluate(() => {
            const binding = window.eXeLearning.app.project._yjsBridge.structureBinding;
            const parent = binding.createPage('As shown');
            const kinds: [string, boolean][] = [
                ['ep-folded', true],
                ['ep-reopened', true],
                ['ep-closed', false],
            ];
            for (const [cssClass, minimized] of kinds) {
                const block = binding.createBlock(parent.id, `Block ${cssClass}`);
                const properties = binding.getBlockMap(parent.id, block).get('properties');
                properties.set('cssClass', cssClass);
                properties.set('minimized', String(minimized));
                binding.createComponent(parent.id, block, 'text', {
                    htmlContent: `<p>Content of ${cssClass}</p>`,
                });
            }
        });

        const panel = await openPrintPanel(page);
        await waitForPreview(page);
        const frame = page.frameLocator('.print-preview-iframe');
        const content = (cssClass: string) => frame.locator(`article.${cssClass} .box-content`);
        const option = panel.locator('#printOptUnfoldBlocks');
        await expect(option).toBeChecked();

        // The reader opens one of the folded blocks and folds the open one, in the preview.
        await frame.locator('article.ep-reopened .box-toggle').click();
        await expect(content('ep-reopened')).toBeVisible();
        await frame.locator('article.ep-closed .box-toggle').click();
        await expect(content('ep-closed')).toBeHidden();

        await option.uncheck();
        await waitForPreview(page);
        // The preview is not drawn again, or what the reader did would be lost.
        await expect(frame.locator('html')).toHaveClass(/\bexe-print-as-shown\b/);
        await expect(content('ep-reopened')).toBeVisible();
        await expect(content('ep-closed')).toBeHidden();

        await page.emulateMedia({ media: 'print' });
        await expect(content('ep-folded')).toBeHidden();
        await expect(content('ep-reopened')).toBeVisible();
        await expect(content('ep-closed')).toBeHidden();

        // Ticked again, every block prints unfolded, whatever the preview shows.
        await page.emulateMedia({ media: 'screen' });
        await option.check();
        await expect(frame.locator('html')).not.toHaveClass(/\bexe-print-as-shown\b/);
        await page.emulateMedia({ media: 'print' });
        await expect(content('ep-folded')).toBeVisible();
        await expect(content('ep-reopened')).toBeVisible();
        await expect(content('ep-closed')).toBeVisible();
        await page.emulateMedia({ media: 'screen' });
    });

    test('offers no choice about folded blocks for the worksheet', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Worksheet folds');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await openElpFile(page, FIXTURE);

        const panel = await openPrintPanel(page);
        await waitForPreview(page);
        await expect(panel.locator('#printOptUnfoldBlocks')).toBeEnabled();

        await choosePrintOption(page, 'idevices');
        await expect(panel.locator('#printOptUnfoldBlocks')).toBeDisabled();
    });
});
