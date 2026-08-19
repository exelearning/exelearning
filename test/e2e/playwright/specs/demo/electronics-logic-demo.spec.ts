import type { Download, Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { unzipSync } from '../../../../../src/shared/export';
import { expect, test } from '../../fixtures/auth.fixture';
import { insertFileIntoEditor, uploadFixtureFile } from '../../helpers/file-manager-helpers';
import {
    addIdevice,
    addTextIdevice,
    downloadProject,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    openElpFile,
    openPreviewPanel,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    setTinyMCEContent,
    waitForAppReady,
    waitForPreviewContent,
    waitForTinyMCEReady,
} from '../../helpers/workarea-helpers';

const IDEVICE_TYPE = 'electronics-logic';
const IDEVICE_ARTICLE = `#node-content article .idevice_node.${IDEVICE_TYPE}`;
const COURSE_TEXT = 'Electronics Logic: bảng chân trị, Karnaugh và mạch bán tổng.';
const TRUTH_TABLE_PROMPT = 'Hoàn thành bảng chân trị ba biến.';
const KMAP_PROMPT = "Nhóm bản đồ Karnaugh bốn biến có wrap, overlap và don't-care.";
const CIRCUIT_PROMPT = 'Dựng mạch bán tổng (half-adder) cho A, B.';
const IMAGE_FIXTURE = path.resolve(__dirname, '../../../../fixtures/sample-2.jpg');
const VIDEO_FIXTURE = path.resolve(__dirname, '../../../../fixtures/sample-video-480-900kb.webm');
const DEMO_FIXTURE = path.resolve(__dirname, '../../../../fixtures/electronics-logic-demo.elpx');

type SavedActivity = {
    id: string;
    jsonProperties: {
        mode: string;
        prompt: string;
        [key: string]: unknown;
    };
};

async function exportHtml5Website(page: Page): Promise<Download> {
    await page.locator('#dropdownFile').click();
    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    if ((await exportSubmenuToggle.count()) > 0) {
        await exportSubmenuToggle.click();
    }
    const exportOption = page
        .locator('#navbar-button-export-html5:visible, #navbar-button-exportas-html5:visible')
        .first();
    await exportOption.waitFor({ state: 'visible', timeout: 10000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportOption.click();
    return downloadPromise;
}

function exportContentType(entryPath: string): string {
    if (entryPath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (entryPath.endsWith('.js') || entryPath.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (entryPath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (entryPath.endsWith('.json')) return 'application/json; charset=utf-8';
    if (entryPath.endsWith('.svg')) return 'image/svg+xml';
    if (entryPath.endsWith('.png')) return 'image/png';
    if (entryPath.endsWith('.jpg') || entryPath.endsWith('.jpeg')) return 'image/jpeg';
    if (entryPath.endsWith('.webm')) return 'video/webm';
    if (entryPath.endsWith('.woff2')) return 'font/woff2';
    if (entryPath.endsWith('.woff')) return 'font/woff';
    return 'application/octet-stream';
}

async function addElectronicsLogicIdeviceAt(
    page: Page,
    index: number,
): Promise<{ editor: Locator; ideviceId: string }> {
    await expandIdeviceCategory(page, /Science|Ciencia/i);
    const paletteItem = page.locator(`[data-testid="idevice-${IDEVICE_TYPE}"], .idevice_item[id="${IDEVICE_TYPE}"]`);
    await expect(paletteItem.first()).toBeVisible();
    await addIdevice(page, IDEVICE_TYPE);

    const articles = page.locator(IDEVICE_ARTICLE);
    await expect(articles).toHaveCount(index + 1);
    const article = articles.nth(index);
    const ideviceId = await article.getAttribute('id');
    if (!ideviceId) throw new Error(`Electronics Logic iDevice #${index} rendered without an id`);
    const editor = article.locator('[data-testid="electronics-logic-editor"]');
    await expect(editor).toBeVisible();
    return { editor, ideviceId };
}

async function openFileManagerViaImageButton(page: Page): Promise<void> {
    const imageButton = page.locator('.tox-tbtn[aria-label*="image" i], .tox-tbtn[aria-label*="imagen" i]').first();
    await expect(imageButton).toBeVisible({ timeout: 10000 });
    await imageButton.click();
    await page.locator('.tox-dialog').waitFor({ state: 'visible', timeout: 10000 });
    const browseButton = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseButton).toBeVisible({ timeout: 5000 });
    await browseButton.click();
    await page.locator('#modalFileManager[data-open="true"], #modalFileManager.show').waitFor({
        state: 'visible',
        timeout: 10000,
    });
}

async function collapseTinyMceSelectionToEnd(page: Page): Promise<void> {
    await page.evaluate(() => {
        const editor = (window as any).tinymce?.activeEditor;
        if (!editor) throw new Error('TinyMCE active editor is unavailable');
        editor.focus();
        const body = editor.getBody();
        const trailer = body.ownerDocument.createElement('p');
        trailer.innerHTML = '<br data-mce-bogus="1">';
        body.appendChild(trailer);
        editor.selection.select(trailer, true);
        editor.selection.collapse(false);
        editor.nodeChanged();
    });
}

async function insertVideoThroughTinyMce(page: Page): Promise<void> {
    const mediaButton = page
        .locator('.tox-tbtn[aria-label*="media" i], .tox-tbtn[aria-label*="multimedia" i], .tox-tbtn[title*="media" i]')
        .first();
    await expect(mediaButton).toBeVisible({ timeout: 10000 });
    await mediaButton.click();
    await page.locator('.tox-dialog').waitFor({ state: 'visible', timeout: 10000 });

    const browseButton = page.locator('.tox-dialog .tox-browse-url').first();
    await expect(browseButton).toBeVisible({ timeout: 5000 });
    await browseButton.click();
    const fileManager = page.locator('#modalFileManager[data-open="true"], #modalFileManager.show');
    await fileManager.waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('#modalFileManager .media-library-upload-input').setInputFiles(VIDEO_FIXTURE);

    const videoItem = page.locator(
        '#modalFileManager .media-library-item[data-filename="sample-video-480-900kb.webm"]',
    );
    await expect(videoItem).toBeVisible({ timeout: 15000 });
    await videoItem.click();
    const insertButton = page.locator('#modalFileManager .media-library-insert-btn');
    await expect(insertButton).toBeEnabled({ timeout: 5000 });
    await insertButton.click();
    await fileManager.waitFor({ state: 'hidden', timeout: 10000 });

    const saveMediaButton = page.locator('.tox-dialog .tox-button:has-text("Save")').first();
    await expect(saveMediaButton).toBeVisible({ timeout: 10000 });
    await saveMediaButton.click();
    await page.locator('.tox-dialog').waitFor({ state: 'hidden', timeout: 10000 });
}

async function addCourseMediaIdevice(page: Page): Promise<void> {
    await addTextIdevice(page);
    await waitForTinyMCEReady(page);
    await setTinyMCEContent(page, `<p>${COURSE_TEXT}</p>`);

    await openFileManagerViaImageButton(page);
    await uploadFixtureFile(page, IMAGE_FIXTURE);
    await insertFileIntoEditor(page, 'sample-2.jpg');
    await collapseTinyMceSelectionToEnd(page);
    await insertVideoThroughTinyMce(page);

    const block = page.locator('#node-content article .idevice_node.text').last();
    const saveButton = block.locator('.btn-save-idevice');
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    await saveButton.click();
    await page.waitForFunction(
        () => {
            const textIdevice = document.querySelector('#node-content article .idevice_node.text');
            return textIdevice?.getAttribute('mode') !== 'edition' && !textIdevice?.querySelector('.tox-tinymce');
        },
        undefined,
        { timeout: 20000 },
    );
}

async function authorTruthTable(page: Page, index: number): Promise<void> {
    const { editor, ideviceId } = await addElectronicsLogicIdeviceAt(page, index);
    await editor.locator('[data-field="mode"]').selectOption('truthTable');
    await editor.locator('[data-field="variable-count"]').selectOption('3');
    await editor.locator('[data-field="prompt"]').fill(TRUTH_TABLE_PROMPT);
    await editor.locator('[data-field="answer-source"]').selectOption('minterms');
    await editor.locator('[data-field="minterms"]').fill('7, 1, 3');
    await editor.locator('[data-field="dont-cares"]').fill('5');
    await editor.locator('[data-field="max-score"]').fill('8');
    await saveIdevice(page, ideviceId);
}

async function authorKmap(page: Page, index: number): Promise<void> {
    const { editor, ideviceId } = await addElectronicsLogicIdeviceAt(page, index);
    await editor.locator('[data-field="mode"]').selectOption('kmap');
    await editor.locator('[data-field="variable-count"]').selectOption('4');
    await editor.locator('[data-field="prompt"]').fill(KMAP_PROMPT);
    await editor.locator('[data-field="answer-source"]').selectOption('minterms');
    await editor.locator('[data-field="minterms"]').fill('0, 2, 8, 10, 12, 14');
    await editor.locator('[data-field="dont-cares"]').fill('4');
    await editor.locator('[data-field="max-score"]').fill('10');
    await saveIdevice(page, ideviceId);
}

async function authorCircuit(page: Page, index: number): Promise<void> {
    const { editor, ideviceId } = await addElectronicsLogicIdeviceAt(page, index);
    await editor.locator('[data-field="mode"]').selectOption('circuit');
    await editor.locator('[data-field="variable-count"]').selectOption('2');
    await editor.locator('[data-field="prompt"]').fill(CIRCUIT_PROMPT);
    await editor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
    await editor.locator('[data-field="max-score"]').fill('8');
    await saveIdevice(page, ideviceId);
}

async function authorDemoCourse(page: Page, projectUuid: string): Promise<void> {
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addCourseMediaIdevice(page);
    await authorTruthTable(page, 0);
    await authorKmap(page, 1);
    await authorCircuit(page, 2);
    await saveProject(page);
}

async function readSavedActivities(page: Page): Promise<SavedActivity[]> {
    return page.evaluate(targetType => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const yDoc = bridge?.getDocumentManager()?.getDoc();
        if (!yDoc) throw new Error('No Yjs document');
        const activities: SavedActivity[] = [];

        const visitPages = (pages: any): void => {
            for (let pageIndex = 0; pageIndex < (pages?.length ?? 0); pageIndex += 1) {
                const pageMap = pages.get(pageIndex);
                const blocks = pageMap?.get('blocks');
                for (let blockIndex = 0; blockIndex < (blocks?.length ?? 0); blockIndex += 1) {
                    const components = blocks.get(blockIndex)?.get('components');
                    for (let componentIndex = 0; componentIndex < (components?.length ?? 0); componentIndex += 1) {
                        const component = components.get(componentIndex);
                        const componentType = component?.get('ideviceType') ?? component?.get('type');
                        if (componentType !== targetType) continue;
                        const value = component.get('jsonProperties');
                        const jsonProperties =
                            typeof value === 'string' ? JSON.parse(value) : (value?.toJSON?.() ?? value);
                        activities.push({ id: component.get('id'), jsonProperties });
                    }
                }
                visitPages(pageMap?.get('pages') ?? pageMap?.get('children'));
            }
        };

        visitPages(yDoc.getArray('navigation'));
        return activities;
    }, IDEVICE_TYPE);
}

async function verifyCourseState(page: Page): Promise<void> {
    const textIdevice = page
        .locator('#node-content article .idevice_node.text')
        .filter({ hasText: COURSE_TEXT })
        .first();
    await expect(textIdevice).toBeVisible();
    await expect(textIdevice.locator('img')).toHaveCount(1);
    await expect(textIdevice.locator('video')).toHaveCount(1);

    const activities = await readSavedActivities(page);
    expect(activities).toHaveLength(3);
    const byMode = new Map(activities.map(activity => [activity.jsonProperties.mode, activity.jsonProperties]));
    expect(byMode.get('truthTable')).toMatchObject({ prompt: TRUTH_TABLE_PROMPT, variables: ['A', 'B', 'C'] });
    expect(byMode.get('kmap')).toMatchObject({
        prompt: KMAP_PROMPT,
        variables: ['A', 'B', 'C', 'D'],
        answer: { minterms: [0, 2, 8, 10, 12, 14], dontCares: [4] },
    });
    expect(byMode.get('circuit')).toMatchObject({
        prompt: CIRCUIT_PROMPT,
        variables: ['A', 'B'],
        answer: { testbench: { expected: { Sum: 'A XOR B', Carry: 'A AND B' } } },
    });
}

async function verifyRenderedMedia(root: Locator): Promise<void> {
    const textIdevice = root.locator('.idevice_node.text').filter({ hasText: COURSE_TEXT }).first();
    await expect(textIdevice).toBeVisible();
    const image = textIdevice.locator('img').first();
    const video = textIdevice.locator('video').first();
    await expect(image).toBeVisible();
    await expect(video).toBeVisible();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(0);
}

async function fillTruthTable(runtime: Locator, wrongRow: number | null = null): Promise<void> {
    const correctValues = ['0', '1', '0', '1', '0', 'X', '0', '1'];
    const outputs = runtime.locator('[data-role="truth-value"]');
    await expect(outputs).toHaveCount(correctValues.length);
    for (let rowIndex = 0; rowIndex < correctValues.length; rowIndex += 1) {
        const value = rowIndex === wrongRow ? (correctValues[rowIndex] === '0' ? '1' : '0') : correctValues[rowIndex];
        await outputs.nth(rowIndex).selectOption(value);
    }
}

async function completeKmap(runtime: Locator): Promise<void> {
    const minterms = new Set([0, 2, 8, 10, 12, 14]);

    // Wait for the K-map runtime to be fully bound and stable before filling cells
    // This prevents race conditions where Yjs sync/iframe re-render clears our selections
    await expect(runtime).toHaveAttribute('data-behaviour-bound', 'true', { timeout: 15000 });

    // Wait for all 16 dropdowns to be attached (iframe fully rendered)
    await expect(runtime.locator('[data-role="kmap-value"]')).toHaveCount(16, { timeout: 15000 });

    // Fill all 16 cells in a single pass, then verify all are set
    const expectedValues = new Map<number, string>();
    for (let minterm = 0; minterm < 16; minterm += 1) {
        const value = minterm === 4 ? 'X' : minterms.has(minterm) ? '1' : '0';
        expectedValues.set(minterm, value);
        const dropdown = runtime.locator(
            `[data-role="kmap-cell"][data-minterm-index="${minterm}"] [data-role="kmap-value"]`,
        );
        await dropdown.selectOption(value);
    }

    // Verify all 16 values are set (with retries if re-render clears them)
    await expect
        .poll(
            async () => {
                for (const [minterm, expected] of expectedValues) {
                    const dropdown = runtime.locator(
                        `[data-role="kmap-cell"][data-minterm-index="${minterm}"] [data-role="kmap-value"]`,
                    );
                    const actual = await dropdown.inputValue();
                    if (actual !== expected) return false;
                }
                return true;
            },
            { timeout: 20000, intervals: [500, 1000, 2000] },
        )
        .toBe(true);

    const groups = [
        [0, 2, 8, 10],
        [8, 10, 12, 14],
    ];
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const group = groups[groupIndex];
        for (const minterm of group) {
            await runtime.locator(`[data-action="toggle-kmap-cell"][data-minterm-index="${minterm}"]`).click();
        }
        await runtime.locator('[data-action="create-kmap-group"]').click();
        await expect(runtime.locator('[data-role="kmap-group"]')).toHaveCount(groupIndex + 1);
    }
}

async function buildHalfAdder(runtime: Locator): Promise<void> {
    const placeNode = async (kind: string, x: number, y: number): Promise<void> => {
        await runtime.locator(`[data-role="circuit-palette-item"][data-node-kind="${kind}"]`).click();
        await runtime.locator(`[data-role="circuit-cell"][data-x="${x}"][data-y="${y}"]`).click();
    };
    const connect = async (fromId: string, fromPin: string, toId: string, toPin: string): Promise<void> => {
        await runtime
            .locator(`[data-role="circuit-pin"][data-node-id="${fromId}"][data-pin-name="${fromPin}"]`)
            .click();
        await runtime.locator(`[data-role="circuit-pin"][data-node-id="${toId}"][data-pin-name="${toPin}"]`).click();
    };

    await placeNode('INPUT', 0, 0);
    await placeNode('INPUT', 0, 80);
    await placeNode('XOR', 160, 0);
    await placeNode('AND', 160, 80);
    await placeNode('OUTPUT', 320, 0);
    await placeNode('OUTPUT', 320, 80);
    await connect('input-1', 'out', 'xor-1', 'a');
    await connect('input-2', 'out', 'xor-1', 'b');
    await connect('input-1', 'out', 'and-1', 'a');
    await connect('input-2', 'out', 'and-1', 'b');
    await connect('xor-1', 'out', 'output-1', 'a');
    await connect('and-1', 'out', 'output-2', 'a');
    await expect(runtime.locator('[data-role="circuit-node"]')).toHaveCount(6);
    await expect(runtime.locator('[data-role="circuit-wire"]')).toHaveCount(6);
}

function auditWholeExport(zip: Record<string, Uint8Array>): void {
    const binaryEntry = /\.(png|jpe?g|gif|webp|ico|bmp|mp3|wav|ogg|mp4|webm|mov|avi|pdf|zip|woff2?|ttf|eot)$/i;
    const thirdPartyEntry = /^(libs|theme)\//;
    const svgIconEntry = /\.svg$/i;
    const dotSegment = /(^|\/)\.[^/]+/;
    const tokenShapes = [
        { re: /sk-proj-/, label: 'sk-proj-' },
        { re: /sk-ant-/, label: 'sk-ant-' },
        { re: /sk-[A-Za-z0-9_-]{20,}/, label: 'sk- secret-shaped' },
        { re: /ghp_[A-Za-z0-9]{20,}/, label: 'ghp_ GitHub token' },
        { re: /AIza[0-9A-Za-z_-]{20,}/, label: 'AIza Google API key' },
        { re: /Bearer [A-Za-z0-9._~+/=-]{20,}/, label: 'Bearer token' },
    ];
    const forbiddenText = ['.agents/', '.claude/', '.ai/', 'file://', 'stack trace', 'at Object.', 'at <anonymous>'];
    const violations: string[] = [];
    let scannedTextEntries = 0;

    for (const [entryPath, bytes] of Object.entries(zip)) {
        if (dotSegment.test(entryPath)) violations.push(`${entryPath}: dot-prefixed path segment`);
        if (binaryEntry.test(entryPath) || thirdPartyEntry.test(entryPath) || svgIconEntry.test(entryPath)) continue;
        scannedTextEntries += 1;
        const content = new TextDecoder().decode(bytes);
        for (const pattern of forbiddenText) {
            if (content.includes(pattern)) violations.push(`${entryPath}: "${pattern}"`);
        }
        if (/[A-Za-z]:\\/.test(content) || /\/(Users|home)\//.test(content)) {
            violations.push(`${entryPath}: absolute local path`);
        }
        for (const { re, label } of tokenShapes) {
            if (re.test(content)) violations.push(`${entryPath}: ${label}`);
        }
    }

    console.log(`[Q01 EXP-03 audit] scanned ${Object.keys(zip).length} paths and ${scannedTextEntries} text entries`);
    expect(violations).toEqual([]);
}

test.describe('Q01 Electronics Logic course demo', () => {
    test('round-trips text, image, video, truth table, Karnaugh, and half-adder through ten reloads', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Q01 Course Round Trip');
        await authorDemoCourse(page, projectUuid);
        const baseline = await readSavedActivities(page);
        await verifyCourseState(page);

        for (let round = 1; round <= 10; round += 1) {
            await saveProject(page);
            await reloadPage(page);
            await selectFirstPage(page);
            expect(await readSavedActivities(page), `round ${round} must preserve all Electronics Logic data`).toEqual(
                baseline,
            );
            await verifyCourseState(page);
        }

        await openPreviewPanel(page);
        await waitForPreviewContent(page);
        const previewBody = getPreviewFrame(page).locator('body');
        await verifyRenderedMedia(previewBody);
        await expect(previewBody.locator('.electronics-logic-runtime[data-mode="truthTable"]')).toBeVisible();
        await expect(previewBody.locator('.electronics-logic-runtime[data-mode="kmap"]')).toBeVisible();
        await expect(previewBody.locator('.electronics-logic-runtime[data-mode="circuit"]')).toBeVisible();
    });

    test('AT-05 marks only one wrong truth-table cell, then passes after correction', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Q01 Truth Table');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await authorTruthTable(page, 0);
        await saveProject(page);
        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const runtime = getPreviewFrame(page).locator('.electronics-logic-runtime[data-mode="truthTable"]');
        await expect(runtime).toHaveAttribute('data-behaviour-bound', 'true');
        await fillTruthTable(runtime, 6);
        await runtime.locator('[data-action="check"]').click();
        await expect(runtime.locator('[data-role="grading-feedback"]')).toContainText('7 / 8');
        await expect(runtime.locator('[data-role="truth-value"][data-grade="failed"]')).toHaveCount(1);
        await expect(runtime.locator('[data-role="truth-value"][data-grade="passed"]')).toHaveCount(7);

        await runtime.locator('[data-role="truth-value"]').nth(6).selectOption('0');
        await runtime.locator('[data-action="check"]').click();
        await expect(runtime.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');
        await expect(runtime.locator('[data-role="truth-value"][data-grade="failed"]')).toHaveCount(0);
        await expect(runtime.locator('[data-role="truth-value"][data-grade="passed"]')).toHaveCount(8);
    });

    test("AT-06 grades a four-variable Karnaugh map with don't-care, overlap, and wrap", async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Q01 Karnaugh');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await authorKmap(page, 0);
        await saveProject(page);
        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const runtime = getPreviewFrame(page).locator('.electronics-logic-runtime[data-mode="kmap"]');
        await completeKmap(runtime);
        const groups = runtime.locator('[data-role="kmap-group"]');
        await expect(groups).toHaveCount(2);
        const groupCells = await groups.evaluateAll(elements =>
            elements.map(element =>
                JSON.parse(element.getAttribute('data-cells') || '[]').sort((a: number, b: number) => a - b),
            ),
        );
        expect(groupCells).toEqual([
            [0, 2, 8, 10],
            [8, 10, 12, 14],
        ]);
        await runtime.locator('[data-action="check"]').click();
        await expect(runtime.locator('[data-role="grading-feedback"]')).toContainText('10 / 10');
        await expect(runtime.locator('[data-role="grading-feedback"]')).toContainText('!B*!D+A*!D');
    });

    test('AT-07 passes a half-adder, then reports a structural failure after one wire is removed', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Q01 Half Adder');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        await authorCircuit(page, 0);
        await saveProject(page);
        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const runtime = getPreviewFrame(page).locator('.electronics-logic-runtime[data-mode="circuit"]');
        await buildHalfAdder(runtime);
        await runtime.locator('[data-action="check"]').click();
        await expect(runtime.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');
        await expect(runtime.locator('[data-role="grading-feedback"]')).toContainText('Đúng 8/8 tổ hợp kiểm tra.');

        await runtime.locator('[data-role="circuit-wire"][data-to-node="output-2"]').click({ force: true });
        await expect(runtime.locator('[data-role="circuit-wire"]')).toHaveCount(5);
        await runtime.locator('[data-action="check"]').click();
        await expect(runtime.locator('[data-role="grading-feedback"]')).toHaveText(
            'Mạch chưa đúng cấu trúc, chưa thể chấm điểm.',
        );
        await expect(runtime.locator('[data-role="grading-feedback"]')).not.toContainText('Điểm');
    });

    test('AT-09 completes the course offline and audits every exported entry path', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Q01 Offline Course');
        await authorDemoCourse(page, projectUuid);

        const download = await exportHtml5Website(page);
        const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'q01-html-export-'));
        try {
            const zipPath = path.join(temporaryDirectory, download.suggestedFilename());
            await download.saveAs(zipPath);
            const zip = unzipSync(fs.readFileSync(zipPath));
            expect(zip['index.html']).toBeTruthy();
            auditWholeExport(zip);

            const origin = 'http://q01-offline.local';
            await page.route(`${origin}/**`, async route => {
                const url = new URL(route.request().url());
                let key = decodeURIComponent(url.pathname.replace(/^\//, ''));
                if (key === '') key = 'index.html';
                const bytes = zip[key];
                if (bytes) {
                    await route.fulfill({ status: 200, contentType: exportContentType(key), body: Buffer.from(bytes) });
                } else {
                    await route.fulfill({ status: 404, contentType: 'text/plain', body: `not in export: ${key}` });
                }
            });
            await page.goto(`${origin}/index.html`);

            await verifyRenderedMedia(page.locator('body'));
            const truthTable = page.locator('.electronics-logic-runtime[data-mode="truthTable"]');
            await fillTruthTable(truthTable);
            await truthTable.locator('[data-action="check"]').click();
            await expect(truthTable.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');

            const kmap = page.locator('.electronics-logic-runtime[data-mode="kmap"]');
            await completeKmap(kmap);
            await kmap.locator('[data-action="check"]').click();
            await expect(kmap.locator('[data-role="grading-feedback"]')).toContainText('10 / 10');

            const circuit = page.locator('.electronics-logic-runtime[data-mode="circuit"]');
            await buildHalfAdder(circuit);
            await circuit.locator('[data-action="check"]').click();
            await expect(circuit.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');
            await page.unroute(`${origin}/**`);
        } finally {
            fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        }
    });

    test('PLAT-07 downloads the UI-authored course as ELPX and reopens the complete fixture', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Q01 Downloadable Course');
        await authorDemoCourse(page, projectUuid);
        const download = await downloadProject(page);
        const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'q01-elpx-'));
        try {
            const temporaryElpx = path.join(temporaryDirectory, 'electronics-logic-demo.elpx');
            await download.saveAs(temporaryElpx);
            const packageEntries = unzipSync(fs.readFileSync(temporaryElpx));
            const entryNames = Object.keys(packageEntries);
            expect(packageEntries['content.xml']).toBeTruthy();
            expect(entryNames.some(entry => entry.endsWith('.jpg'))).toBe(true);
            expect(entryNames.some(entry => entry.endsWith('.webm'))).toBe(true);
            const contentXml = new TextDecoder().decode(packageEntries['content.xml']);
            expect(contentXml).toContain(COURSE_TEXT);
            expect(contentXml).toContain(TRUTH_TABLE_PROMPT);
            expect(contentXml).toContain(KMAP_PROMPT);
            expect(contentXml).toContain(CIRCUIT_PROMPT);

            fs.copyFileSync(temporaryElpx, DEMO_FIXTURE);
            await openElpFile(page, DEMO_FIXTURE);
            await selectFirstPage(page);
            await verifyCourseState(page);
            await openPreviewPanel(page);
            await waitForPreviewContent(page);
            await verifyRenderedMedia(getPreviewFrame(page).locator('body'));
        } finally {
            fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        }
    });
});
