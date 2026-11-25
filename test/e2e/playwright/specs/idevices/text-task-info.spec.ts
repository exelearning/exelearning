import type { Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { unzipSync } from '../../../../../src/shared/export';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    editIdevice,
    exportProjectAs,
    openPreviewAndWaitForContent,
    getPreviewFrame,
} from '../../helpers/workarea-helpers';

/**
 * E2E Tests for the optional task information of the Text iDevice
 * (Duration / Grouping). When only one field is filled, the other row must
 * not be shown with an empty value. The rows stay in the saved HTML, because
 * the editor reads them by position, so editing again keeps both values.
 */

type TaskInfo = { duration: string; grouping: string };

async function waitForTextEditor(page: Page) {
    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.get('textTextarea');
            return !!editor && editor.initialized && !editor.removed;
        },
        undefined,
        { timeout: 15000 },
    );
}

/** Fill the task information fields (they are inside a collapsed section). */
async function setTaskInfo(page: Page, info: TaskInfo) {
    await page.evaluate(({ duration, grouping }) => {
        const set = (id: string, value: string) => {
            const input = document.getElementById(id) as HTMLInputElement;
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set('textInfoDurationInput', duration);
        set('textInfoParticipantsInput', grouping);
    }, info);
}

async function saveBlock(block: Locator) {
    await block.locator('.btn-save-idevice').click();
    await expect(block).not.toHaveAttribute('mode', 'edition', { timeout: 20000 });
}

/** Create a project with one Text iDevice and the given task information. */
async function createTextWithInfo(
    page: Page,
    createProject: (page: Page, title: string) => Promise<string>,
    info: TaskInfo,
): Promise<Locator> {
    const projectUuid = await createProject(page, 'Text task info');
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);
    await addTextIdevice(page);
    await waitForTextEditor(page);
    await page.evaluate(() => {
        (window as any).tinymce.get('textTextarea').setContent('<p>Task information text</p>');
    });
    await setTaskInfo(page, info);
    const block = page.locator('#node-content article .idevice_node.text').last();
    await saveBlock(block);
    return block;
}

/** Labels of the task information rows that are visible on screen. */
async function visibleRows(scope: Locator): Promise<string[]> {
    const rows = scope.locator('.exe-text-activity dl > div.inline');
    await expect(rows.first()).toBeAttached({ timeout: 15000 });
    return rows.evaluateAll(els =>
        els
            .filter(el => getComputedStyle(el).display !== 'none')
            .map(el => `${el.querySelector('dt')?.textContent?.trim()} ${el.querySelector('dd')?.textContent?.trim()}`),
    );
}

async function previewIdevice(page: Page): Promise<Locator> {
    await openPreviewAndWaitForContent(page);
    const idevice = getPreviewFrame(page)
        .locator('.idevice_node.text')
        .filter({ hasText: 'Task information text' })
        .first();
    await expect(idevice).toBeVisible({ timeout: 15000 });
    return idevice;
}

test.describe('Text iDevice task information', () => {
    test('shows only Duration when Grouping is empty', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await createTextWithInfo(page, createProject, { duration: '45 min', grouping: '' });
        const idevice = await previewIdevice(page);
        expect(await visibleRows(idevice)).toEqual(['Duration 45 min']);
        // The empty row is still in the HTML, only hidden.
        await expect(idevice.locator('.exe-text-activity dl > div.inline')).toHaveCount(2);
    });

    test('shows only Grouping when Duration is empty, and editing keeps the value', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const block = await createTextWithInfo(page, createProject, { duration: '', grouping: 'In pairs' });
        expect(await visibleRows(block)).toEqual(['Grouping In pairs']);

        // Open the editor again: Grouping keeps its value and Duration stays empty.
        const ideviceId = (await block.getAttribute('id')) as string;
        await editIdevice(page, ideviceId);
        await waitForTextEditor(page);
        await expect(page.locator('#textInfoParticipantsInput')).toHaveValue('In pairs');
        await expect(page.locator('#textInfoDurationInput')).toHaveValue('');
        await saveBlock(block);

        const idevice = await previewIdevice(page);
        expect(await visibleRows(idevice)).toEqual(['Grouping In pairs']);
    });

    test('shows both rows when both fields are filled', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await createTextWithInfo(page, createProject, { duration: '45 min', grouping: 'In pairs' });
        const idevice = await previewIdevice(page);
        expect(await visibleRows(idevice)).toEqual(['Duration 45 min', 'Grouping In pairs']);
    });

    test('hides the empty row in a Web Site export opened from file://', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await createTextWithInfo(page, createProject, { duration: '45 min', grouping: '' });

        const download = await exportProjectAs(page, 'html5');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-task-info-html5-'));
        try {
            const zipPath = path.join(dir, 'package.zip');
            await download.saveAs(zipPath);
            const entries = unzipSync(fs.readFileSync(zipPath));
            for (const [name, data] of Object.entries(entries)) {
                if (name.endsWith('/')) continue;
                const target = path.join(dir, 'out', name);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, data);
            }
            const exported = await page.context().newPage();
            await exported.goto(pathToFileURL(path.join(dir, 'out', 'index.html')).href);
            const idevice = exported.locator('.idevice_node.text').filter({ hasText: 'Task information text' }).first();
            await expect(idevice).toBeVisible({ timeout: 15000 });
            expect(await visibleRows(idevice)).toEqual(['Duration 45 min']);
            await exported.close();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
