import type { Page } from '@playwright/test';
import { test, expect, isStaticProject } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    editIdevice,
    getPreviewFrame,
    gotoWorkarea,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';

async function addLomloe(page: Page) {
    await addIdevice(page, 'lomloe');
    await expect(page.locator('.lomloe-materia-item').first()).toBeVisible();
    await expect(page.locator('.lomloe-loading')).toBeHidden();
}

async function selectSubject(page: Page) {
    await page.locator('.lomloe-etapa-btn').filter({ hasText: 'Primaria' }).click();
    await page.locator('.lomloe-nivel-btn').first().click();
    await page.locator('.lomloe-materia-item').first().click();
}

async function selectCurriculumElements(page: Page) {
    await selectSubject(page);
    const criterion = await page.locator('.lomloe-criterio-code').first().innerText();
    await page.locator('input[data-type="criterio"]').first().check();
    await page.locator('.lomloe-tab-btn[data-tab="saberes"]').click();
    const knowledge = await page.locator('.lomloe-saber-code').first().innerText();
    await page.locator('input[data-type="saber"]').first().check();
    await expect(page.locator('.lomloe-selected-count')).toHaveText('2');
    return { criterion, knowledge };
}

test.describe('LOMLOE iDevice', () => {
    test.beforeEach(async ({ authenticatedPage: page, createProject }) => {
        const projectId = await createProject(page, 'LOMLOE curriculum');
        await gotoWorkarea(page, projectId);
        await selectFirstPage(page);
    });

    test('loads real curriculum datasets, including compressed data in static mode', async ({
        authenticatedPage: page,
    }, testInfo) => {
        const suffix = isStaticProject(testInfo) ? '.json.zst' : '.json';
        // Observe real responses: mocking the data would hide missing static files or a broken decoder.
        for (const dataset of ['ES-CN', 'ES']) {
            const responsePromise = page.waitForResponse(response =>
                new URL(response.url()).pathname.endsWith(`/lomloe-${dataset}${suffix}`),
            );
            if (dataset === 'ES-CN') {
                await addIdevice(page, 'lomloe');
            } else {
                await page.locator('select[id^="lomloe-ds-"]').selectOption(dataset);
            }
            const response = await responsePromise;
            expect(response.ok()).toBe(true);
            if (isStaticProject(testInfo)) {
                expect(Array.from((await response.body()).subarray(0, 4))).toEqual([0x28, 0xb5, 0x2f, 0xfd]);
            }
            await expect(page.locator('.lomloe-loading')).toBeHidden();
            await expect(page.locator('.lomloe-materia-item').first()).toBeVisible();
            await expect(page.locator('select[id^="lomloe-ds-"]')).toHaveValue(dataset);
        }
        await expect(page.locator('.lomloe-selected-count')).toHaveText('0');
        await expect(page.locator('button[id^="lomloe-preview-"]')).toBeDisabled();
    });

    test('browses stages and levels and filters subjects', async ({ authenticatedPage: page }) => {
        await addLomloe(page);
        await selectSubject(page);
        const levels = page.locator('.lomloe-nivel-btn');
        await levels.nth(1).click();
        await expect(levels.nth(1)).toHaveClass(/active/);
        const subjects = page.locator('.lomloe-materia-item');
        const count = await subjects.count();
        expect(count).toBeGreaterThan(1);
        const subject = await subjects.first().getAttribute('data-denominacion');
        const search = page.locator('.lomloe-materia-search');
        await search.fill(subject!);
        await expect(subjects).toHaveCount(1);
        await subjects.first().click();
        await expect(page.locator('.lomloe-criterio-item').first()).toBeVisible();
        await search.fill('no-matching-curriculum-subject');
        await expect(subjects).toHaveCount(0);
        await search.clear();
        await expect(subjects).toHaveCount(count);
    });

    test('selects criteria and knowledge, removes an item and resets the selection', async ({
        authenticatedPage: page,
    }) => {
        await addLomloe(page);
        const { criterion, knowledge } = await selectCurriculumElements(page);
        await expect(page.locator('.lomloe-sel-code')).toHaveText([criterion, knowledge]);
        await page.locator('.lomloe-tab-btn[data-tab="competencias"]').click();
        await expect(page.locator('input[data-type="criterio"]').first()).toBeChecked();
        await page.locator('.lomloe-sel-remove').first().click();
        await expect(page.locator('.lomloe-selected-count')).toHaveText('1');
        await expect(page.locator('input[data-type="criterio"]').first()).not.toBeChecked();
        page.once('dialog', dialog => dialog.accept());
        await page.locator('button[id^="lomloe-reset-"]').click();
        await expect(page.locator('.lomloe-selected-count')).toHaveText('0');
        await expect(page.locator('.lomloe-sel-item')).toHaveCount(0);
        await page.locator('.lomloe-tab-btn[data-tab="saberes"]').click();
        await expect(page.locator('input[data-type="saber"]').first()).not.toBeChecked();
        await expect(page.locator('button[id^="lomloe-preview-"]')).toBeDisabled();
    });

    test('shows selected curriculum elements in the summary dialog', async ({ authenticatedPage: page }) => {
        await addLomloe(page);
        const { criterion, knowledge } = await selectCurriculumElements(page);
        await page.locator('button[id^="lomloe-preview-"]').click();
        const dialog = page.locator('.lomloe-modal-overlay');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('.lomloe-export-table')).toBeVisible();
        await expect(dialog).toContainText(criterion);
        await expect(dialog).toContainText(knowledge);
        await dialog.locator('.lomloe-modal-close').click();
        await expect(dialog).toBeHidden();
    });

    test('restores dataset, selected elements and partial criteria after saving and refreshing the workarea', async ({
        authenticatedPage: page,
    }) => {
        await addLomloe(page);
        await page.locator('select[id^="lomloe-ds-"]').selectOption('ES');
        await expect(page.locator('.lomloe-loading')).toBeHidden();
        const { criterion, knowledge } = await selectCurriculumElements(page);
        await page.locator('.lomloe-partial-cb').check();
        const idevice = page.locator('.idevice_node.lomloe');
        const id = await idevice.getAttribute('id');
        await saveIdevice(page, id!);
        await saveProject(page);
        await reloadPage(page);
        await selectFirstPage(page);
        await expect(idevice.locator('.lomloeIdeviceContent')).toContainText(criterion);
        await expect(idevice.locator('.lomloeIdeviceContent')).toContainText(knowledge);
        await editIdevice(page, id!);
        await expect(page.locator('select[id^="lomloe-ds-"]')).toHaveValue('ES');
        await expect(page.locator('.lomloe-selected-count')).toHaveText('2');
        await expect(page.locator('.lomloe-sel-code')).toHaveText([criterion, knowledge]);
        await expect(page.locator('.lomloe-partial-cb')).toBeChecked();
        await expect(page.locator('input[data-type="saber"]').first()).toBeChecked();
    });

    test('renders the saved curriculum table in the preview panel', async ({ authenticatedPage: page }) => {
        await addLomloe(page);
        const { criterion, knowledge } = await selectCurriculumElements(page);
        const id = await page.locator('.idevice_node.lomloe').getAttribute('id');
        await saveIdevice(page, id!);
        await saveProject(page);
        expect(await waitForPreviewContent(page)).toBe(true);
        const content = getPreviewFrame(page).locator('.lomloeIdeviceContent');
        await expect(content).toBeVisible();
        await expect(content.locator('.lomloe-export-table')).toBeVisible();
        await expect(content).toContainText(criterion);
        await expect(content).toContainText(knowledge);
    });
});
