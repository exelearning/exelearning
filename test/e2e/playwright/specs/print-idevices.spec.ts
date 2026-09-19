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

const FIXTURE = 'test/fixtures/old_el_cid.elp';

/** Carries two crossword activities, both with illustrated clues. */
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

    // The worksheet is generated in memory and handed to the iframe as a blob.
    const frame = page.frameLocator('.print-preview-iframe');
    await frame.locator('.worksheet').waitFor({ state: 'attached', timeout: 30000 });

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
        // Two crosswords, both asking 100% of their questions at difficulty 100, which gives no
        // letters away, and both with illustrated clues.
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

    test('closes on Escape', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await openFixtureProject(page, createProject);

        const { overlay } = await openWorksheet(page);

        await page.keyboard.press('Escape');

        await expect(overlay).toHaveAttribute('data-visible', 'false');
    });
});
