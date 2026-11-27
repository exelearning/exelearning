import type { Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { unzipSync, zipSync } from '../../../../../src/shared/export';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    editIdevice,
    exportProjectAs,
    openPreviewAndWaitForContent,
    getPreviewFrame,
    openElpFile,
    navigateToPageByTitle,
} from '../../helpers/workarea-helpers';

const LEGACY_ELP = path.resolve(__dirname, '../../../../fixtures/basic-example.elp');

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

async function previewIdeviceWithText(page: Page, text: string): Promise<Locator> {
    await openPreviewAndWaitForContent(page);
    const idevice = getPreviewFrame(page).locator('.idevice_node.text').filter({ hasText: text }).first();
    await expect(idevice).toBeVisible({ timeout: 15000 });
    return idevice;
}

async function previewIdevice(page: Page): Promise<Locator> {
    return previewIdeviceWithText(page, 'Task information text');
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

    test('does not touch definition lists written by the author, including rows with images', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Text task info author lists');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextIdevice(page);
        await waitForTextEditor(page);
        await page.evaluate(() => {
            (window as any).tinymce
                .get('textTextarea')
                .setContent(
                    '<p>Task information text</p>' +
                        '<dl class="exe-dl">' +
                        '<dt>Empty term</dt><dd></dd>' +
                        '<dt>Picture</dt><dd><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC" width="20" height="20" alt="Dot"></dd>' +
                        '</dl>',
                );
        });
        await setTaskInfo(page, { duration: '45 min', grouping: '' });
        const block = page.locator('#node-content article .idevice_node.text').last();
        await saveBlock(block);

        const idevice = await previewIdevice(page);
        expect(await visibleRows(idevice)).toEqual(['Duration 45 min']);
        // The author's definition list keeps all its terms and values.
        const authorList = idevice.locator('dl.exe-dl');
        await expect(authorList).toBeVisible();
        await expect(authorList.locator('dt')).toHaveCount(2);
        await expect(authorList.locator('.exe-text-info-empty')).toHaveCount(0);
        // The definition list shows a value when its term is clicked.
        await authorList.locator('dt', { hasText: 'Picture' }).click();
        await expect(authorList.locator('dd img')).toBeVisible();
    });

    test('fixes an existing project opened from an .elp file, without saving it again', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        // Make a copy of basic-example.elp where the first Text iDevice was
        // saved, before this fix, with only Duration filled: its text holds the
        // task information list with an empty Grouping row, as the editor
        // writes it. The other Text iDevices keep both fields empty.
        const entries = unzipSync(fs.readFileSync(LEGACY_ELP));
        const content = new TextDecoder().decode(entries['content.xml']);
        const savedHtml =
            '<div class="exe-text-activity"><dl>' +
            '<div class="inline"><dt><span title="Duración:">Duración:</span></dt><dd>45 min</dd></div>' +
            '<div class="inline"><dt><span title="Agrupar:">Agrupar:</span></dt><dd></dd></div>' +
            '</dl><p>Description 1</p></div>';
        const xmlJsonString = JSON.stringify(savedHtml).slice(1, -1).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const original =
            '"textInfoDurationInput":"","textInfoDurationTextInput":"Duración:","textInfoParticipantsInput":"","textInfoParticipantsTextInput":"Agrupar:","textTextarea":"&lt;p&gt;Description 1&lt;/p&gt;"';
        expect(content).toContain(original);
        entries['content.xml'] = new TextEncoder().encode(
            content.replace(
                original,
                `"textInfoDurationInput":"45 min","textInfoDurationTextInput":"Duración:","textInfoParticipantsInput":"","textInfoParticipantsTextInput":"Agrupar:","textTextarea":"${xmlJsonString}"`,
            ),
        );
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-task-info-elp-'));
        const elpPath = path.join(dir, 'task-info-duration-only.elp');
        fs.writeFileSync(elpPath, zipSync(entries));
        try {
            const projectUuid = await createProject(page, 'Text task info existing project');
            await gotoWorkarea(page, projectUuid);
            await waitForAppReady(page);
            await openElpFile(page, elpPath, 2);
            await navigateToPageByTitle(page, 'Node 1');

            const onlyDuration = page
                .locator('#node-content .idevice_node.text')
                .filter({ hasText: 'Description 1' })
                .first();
            await expect(onlyDuration).toBeVisible({ timeout: 15000 });
            // The iDevice is rendered again once the project is loaded: wait for it.
            await expect.poll(() => visibleRows(onlyDuration), { timeout: 15000 }).toEqual(['Duración: 45 min']);

            // Both fields empty: no task information is shown at all.
            const bothEmpty = page
                .locator('#node-content .idevice_node.text')
                .filter({ hasText: 'Description 2' })
                .first();
            await expect(bothEmpty).toBeVisible();
            const emptyRows = bothEmpty.locator('.exe-text-activity dl > div.inline');
            expect(
                await emptyRows.evaluateAll(els => els.filter(el => getComputedStyle(el).display !== 'none').length),
            ).toBe(0);

            // The preview of a project that was not saved again uses the HTML
            // stored in the file, in the older format (inner wrapper, both rows
            // empty): its empty rows are hidden too.
            await openPreviewAndWaitForContent(page);
            const frame = getPreviewFrame(page);
            for (const text of ['Description 1', 'Description 2']) {
                const preview = frame.locator('.idevice_node.text').filter({ hasText: text }).first();
                await expect(preview).toBeVisible({ timeout: 15000 });
                const rows = preview.locator('.exe-text-activity dl > div.inline');
                await expect(rows.first()).toBeAttached();
                expect(
                    await rows.evaluateAll(
                        els =>
                            els.filter(
                                el =>
                                    getComputedStyle(el).display !== 'none' &&
                                    (el.querySelector('dd')?.textContent || '').trim() === '',
                            ).length,
                    ),
                ).toBe(0);
            }
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
