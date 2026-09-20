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

import type { Page } from '@playwright/test';
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

    test('builds a worksheet from the activities in the project', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { frame } = await openWorksheet(page);

        // One printable item per question, each with its own answer space.
        await expect(frame.locator('.worksheet-item')).toHaveCount(EXPECTED_QUESTIONS);
        await expect(frame.locator('.worksheet-answer')).toHaveCount(EXPECTED_QUESTIONS);

        // One box per character of the solution, grouped by word.
        await expect(frame.locator('.worksheet-box')).toHaveCount(EXPECTED_BOXES);
        await expect(frame.locator('.worksheet-box-group')).toHaveCount(EXPECTED_GROUPS);
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
        await expect(frame.locator('.worksheet-prompt').first()).toContainText(
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

        const pageTitles = frame.locator('.worksheet-page-title');
        await expect(pageTitles).toHaveCount(1);
        await expect(pageTitles.first()).not.toBeEmpty();

        // Every activity sits inside a page section rather than floating on its own.
        await expect(frame.locator('.worksheet-page .worksheet-activity')).toHaveCount(1);
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
