import type { Download, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    openPreviewPanel,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';
import { unzipSync } from '../../../../../src/shared/export';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const IDEVICE_TYPE = 'electronics-logic';
const IDEVICE_ARTICLE = `#node-content article .idevice_node.${IDEVICE_TYPE}`;

async function getSavedIdevice(page: Page, ideviceId: string) {
    return page.evaluate(
        ({ targetId, targetType }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const yDoc = bridge?.getDocumentManager()?.getDoc();
            if (!yDoc) return { error: 'No Yjs document' };

            const findInPage = (pageMap: any): any => {
                const blocks = pageMap?.get('blocks');
                for (let blockIndex = 0; blockIndex < (blocks?.length ?? 0); blockIndex++) {
                    const components = blocks.get(blockIndex)?.get('components');
                    for (let componentIndex = 0; componentIndex < (components?.length ?? 0); componentIndex++) {
                        const component = components.get(componentIndex);
                        const componentType = component?.get('ideviceType') ?? component?.get('type');
                        if (component?.get('id') === targetId && componentType === targetType) return component;
                    }
                }

                const subpages = pageMap?.get('pages');
                for (let pageIndex = 0; pageIndex < (subpages?.length ?? 0); pageIndex++) {
                    const component = findInPage(subpages.get(pageIndex));
                    if (component) return component;
                }

                return null;
            };

            const navigation = yDoc.getArray('navigation');
            let component = null;
            for (let pageIndex = 0; pageIndex < navigation.length && !component; pageIndex++) {
                component = findInPage(navigation.get(pageIndex));
            }
            if (!component) return { error: `Component ${targetId} (${targetType}) not found in Yjs` };

            const jsonPropertiesValue = component.get('jsonProperties');
            try {
                return {
                    jsonProperties:
                        typeof jsonPropertiesValue === 'string'
                            ? JSON.parse(jsonPropertiesValue)
                            : (jsonPropertiesValue?.toJSON?.() ?? jsonPropertiesValue),
                };
            } catch {
                return { error: 'Failed to parse jsonProperties' };
            }
        },
        { targetId: ideviceId, targetType: IDEVICE_TYPE },
    );
}

async function addElectronicsLogicIdevice(page: Page, projectUuid: string) {
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await expandIdeviceCategory(page, /Science|Ciencia/i);

    const paletteItem = page.locator(`[data-testid="idevice-${IDEVICE_TYPE}"], .idevice_item[id="${IDEVICE_TYPE}"]`);
    await expect(paletteItem.first()).toBeVisible();
    await addIdevice(page, IDEVICE_TYPE);

    const article = page.locator(IDEVICE_ARTICLE).first();
    const ideviceId = await article.getAttribute('id');
    if (!ideviceId) throw new Error('Electronics Logic iDevice rendered without an id');
    const editor = article.locator('[data-testid="electronics-logic-editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('Electronics Logic');
    return { editor, ideviceId };
}

async function addElectronicsLogicIdeviceAt(page: Page, index: number) {
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

async function exportHtml5Website(page: Page): Promise<Download> {
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);
    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    if ((await exportSubmenuToggle.count()) > 0) {
        await exportSubmenuToggle.click();
        await page.waitForTimeout(300);
    }
    const exportOption = page
        .locator('#navbar-button-export-html5:visible, #navbar-button-exportas-html5:visible')
        .first();
    await exportOption.waitFor({ state: 'visible', timeout: 10000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportOption.click();
    return downloadPromise;
}

/** Best-effort content type for serving the unzipped export over page.route(). */
function exportContentType(p: string): string {
    if (p.endsWith('.html')) return 'text/html; charset=utf-8';
    if (p.endsWith('.js') || p.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
    if (p.endsWith('.css')) return 'text/css; charset=utf-8';
    if (p.endsWith('.json')) return 'application/json; charset=utf-8';
    if (p.endsWith('.svg')) return 'image/svg+xml';
    if (p.endsWith('.png')) return 'image/png';
    if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
    if (p.endsWith('.woff2')) return 'font/woff2';
    if (p.endsWith('.woff')) return 'font/woff';
    return 'application/octet-stream';
}

test.describe('Electronics Logic authoring', () => {
    test('keeps truth-table minterm authoring through the palette, editor, reload, and preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Placeholder');
        const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

        await editor.locator('[data-field="mode"]').selectOption('truthTable');
        await editor.locator('[data-field="variable-count"]').selectOption('3');
        await editor.locator('[data-field="prompt"]').fill('Hoàn thành bảng chân trị ba biến.');
        await editor.locator('[data-field="answer-source"]').selectOption('minterms');
        await editor.locator('[data-field="minterms"]').fill('7, 1, 3');
        await editor.locator('[data-field="dont-cares"]').fill('5');
        await editor.locator('[data-field="max-score"]').fill('8');
        await editor.locator('[data-field="solution"]').fill('Đánh số các hàng từ 0 đến 7.');

        await saveIdevice(page, ideviceId);
        await saveProject(page);

        const savedBeforeReload = await getSavedIdevice(page, ideviceId);
        expect(savedBeforeReload.error).toBeUndefined();
        expect(savedBeforeReload.jsonProperties?.schemaVersion).toBe(1);
        expect(savedBeforeReload.jsonProperties?.type).toBe('electronics.logic');
        expect(savedBeforeReload.jsonProperties).toMatchObject({
            mode: 'truthTable',
            prompt: 'Hoàn thành bảng chân trị ba biến.',
            variables: ['A', 'B', 'C'],
            authoring: {
                answerSource: 'minterms',
                solution: 'Đánh số các hàng từ 0 đến 7.',
            },
            answer: { expression: '', minterms: [1, 3, 7], dontCares: [5] },
            grading: { maxScore: 8 },
        });

        await reloadPage(page);
        await waitForAppReady(page);

        const savedAfterReload = await getSavedIdevice(page, ideviceId);
        expect(savedAfterReload.error).toBeUndefined();
        expect(savedAfterReload.jsonProperties).toEqual(savedBeforeReload.jsonProperties);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute('data-schema-version', '1');
        await expect(preview).toHaveAttribute('data-mode', 'truthTable');
        await expect(preview).toContainText('Hoàn thành bảng chân trị ba biến.');
        await expect(preview).not.toContainText('Đánh số các hàng từ 0 đến 7.');

        const outputs = preview.locator('[data-role="truth-value"]');
        await expect(outputs).toHaveCount(8);
        await expect(preview.locator('[data-role="empty-state"]')).toBeVisible();
        await expect(preview.locator('[data-role="grading-feedback"]')).toBeEmpty();
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            const value = rowIndex === 5 ? 'X' : rowIndex === 6 ? '1' : String(rowIndex % 2);
            await outputs.nth(rowIndex).selectOption(value);
        }
        await expect(preview.locator('[data-role="empty-state"]')).toBeHidden();

        await preview.locator('[data-action="check"]').click();
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('7 / 8');
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            await expect(outputs.nth(rowIndex)).toHaveAttribute('data-grade', rowIndex === 6 ? 'failed' : 'passed');
        }
        await expect(preview).not.toContainText('ÄÃ¡nh sá»‘ cÃ¡c hÃ ng tá»« 0 Ä‘áº¿n 7.');

        await preview.locator('[data-action="reset"]').click();
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            await expect(outputs.nth(rowIndex)).toHaveValue('');
            await expect(outputs.nth(rowIndex)).not.toHaveAttribute('data-grade');
        }
        await expect(preview.locator('[data-role="empty-state"]')).toBeVisible();
        await expect(preview.locator('[data-role="grading-feedback"]')).toBeEmpty();
    });

    test('edits and grades Karnaugh cells and a minimal group in preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Karnaugh');
        const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

        await editor.locator('[data-field="mode"]').selectOption('kmap');
        await editor.locator('[data-field="variable-count"]').selectOption('3');
        await editor.locator('[data-field="prompt"]').fill('Hoàn thành bản đồ Karnaugh ba biến.');
        await editor.locator('[data-field="answer-source"]').selectOption('minterms');
        await editor.locator('[data-field="minterms"]').fill('7, 1, 3');
        await editor.locator('[data-field="dont-cares"]').fill('5');

        await saveIdevice(page, ideviceId);
        await saveProject(page);

        const saved = await getSavedIdevice(page, ideviceId);
        expect(saved.error).toBeUndefined();
        expect(saved.jsonProperties).toMatchObject({
            mode: 'kmap',
            prompt: 'Hoàn thành bản đồ Karnaugh ba biến.',
            variables: ['A', 'B', 'C'],
            authoring: { answerSource: 'minterms' },
            answer: { expression: '', minterms: [1, 3, 7], dontCares: [5] },
        });
        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute('data-mode', 'kmap');
        await expect(preview).toHaveAttribute('data-behaviour-bound', 'true');
        await expect(preview.locator('[data-role="kmap-row-label"]')).toHaveText(['0', '1']);
        await expect(preview.locator('[data-role="kmap-column-label"]')).toHaveText(['00', '01', '11', '10']);

        const values = preview.locator('[data-role="kmap-value"]');
        await expect(values).toHaveCount(8);
        const expectedValues = ['0', '1', '0', '1', '0', 'X', '0', '1'];
        for (let mintermIndex = 0; mintermIndex < expectedValues.length; mintermIndex += 1) {
            await preview
                .locator(`[data-role="kmap-cell"][data-minterm-index="${mintermIndex}"] [data-role="kmap-value"]`)
                .selectOption(expectedValues[mintermIndex]);
        }
        for (const mintermIndex of [1, 3, 5, 7]) {
            await preview.locator(`[data-action="toggle-kmap-cell"][data-minterm-index="${mintermIndex}"]`).click();
        }
        await preview.locator('[data-action="create-kmap-group"]').click();

        await expect(preview.locator('[data-role="kmap-group"]')).toContainText('1, 3, 5, 7');
        await expect(preview.locator('[data-kmap-grouped="true"]')).toHaveCount(4);
        await preview.locator('[data-action="check"]').click();
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('10 / 10');
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Một lời giải tối giản: C.');
        await expect(preview.locator('[data-role="kmap-value"][data-grade="passed"]')).toHaveCount(8);
        await expect(preview.locator('[data-role="kmap-group"][data-grade="passed"]')).toHaveCount(1);
    });

    test('rejects an invalid Karnaugh selection before creating a valid group', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Karnaugh Validator');
        const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

        await editor.locator('[data-field="mode"]').selectOption('kmap');
        await editor.locator('[data-field="variable-count"]').selectOption('3');
        await editor.locator('[data-field="prompt"]').fill('Tạo nhóm Karnaugh hợp lệ.');
        await editor.locator('[data-field="answer-source"]').selectOption('minterms');
        await editor.locator('[data-field="minterms"]').fill('1, 3');
        await saveIdevice(page, ideviceId);
        await saveProject(page);
        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
        await expect(preview).toHaveAttribute('data-behaviour-bound', 'true');
        for (const minterm of [0, 1, 3]) {
            await preview.locator(`[data-action="toggle-kmap-cell"][data-minterm-index="${minterm}"]`).click();
        }
        await preview.locator('[data-action="create-kmap-group"]').click();

        await expect(preview.locator('[data-role="kmap-group"]')).toHaveCount(0);
        await expect(preview.locator('[data-role="kmap-group-feedback"]')).toContainText(
            'Nhóm Karnaugh phải có 1, 2, 4, 8 hoặc 16 ô.',
        );
        await expect(preview.locator('[data-kmap-selected="true"]')).toHaveCount(3);

        await preview.locator('[data-action="toggle-kmap-cell"][data-minterm-index="3"]').click();
        await preview.locator('[data-action="create-kmap-group"]').click();

        await expect(preview.locator('[data-role="kmap-group"]')).toContainText('0, 1');
        await expect(preview.locator('[data-role="kmap-group-feedback"]')).toBeEmpty();
    });

    test('authors, saves, and grades a half-adder circuit through the palette, wiring, and preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Circuit');
        const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

        await editor.locator('[data-field="mode"]').selectOption('circuit');
        await editor.locator('[data-field="variable-count"]').selectOption('2');
        await editor.locator('[data-field="prompt"]').fill('Dựng mạch bán tổng (half-adder) cho A, B.');
        await editor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
        await editor.locator('[data-field="max-score"]').fill('8');
        await saveIdevice(page, ideviceId);
        await saveProject(page);

        const savedBeforeReload = await getSavedIdevice(page, ideviceId);
        expect(savedBeforeReload.error).toBeUndefined();
        expect(savedBeforeReload.jsonProperties).toMatchObject({
            mode: 'circuit',
            prompt: 'Dựng mạch bán tổng (half-adder) cho A, B.',
            variables: ['A', 'B'],
            answer: {
                expression: '',
                minterms: [],
                dontCares: [],
                testbench: {
                    variables: ['A', 'B'],
                    inputs: { A: 'input-1', B: 'input-2' },
                    outputs: { Sum: 'output-1', Carry: 'output-2' },
                    expected: { Sum: 'A XOR B', Carry: 'A AND B' },
                },
            },
            grading: { maxScore: 8 },
        });

        await reloadPage(page);
        await waitForAppReady(page);
        const savedAfterReload = await getSavedIdevice(page, ideviceId);
        expect(savedAfterReload.error).toBeUndefined();
        expect(savedAfterReload.jsonProperties).toEqual(savedBeforeReload.jsonProperties);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute('data-mode', 'circuit');
        await expect(preview).toHaveAttribute('data-behaviour-bound', 'true');

        const placeNode = async (kind: string, x: number, y: number) => {
            await preview.locator(`[data-role="circuit-palette-item"][data-node-kind="${kind}"]`).click();
            await preview.locator(`[data-role="circuit-cell"][data-x="${x}"][data-y="${y}"]`).click();
        };
        const connect = async (fromId: string, fromPin: string, toId: string, toPin: string) => {
            await preview
                .locator(`[data-role="circuit-pin"][data-node-id="${fromId}"][data-pin-name="${fromPin}"]`)
                .click();
            await preview
                .locator(`[data-role="circuit-pin"][data-node-id="${toId}"][data-pin-name="${toPin}"]`)
                .click();
        };

        await placeNode('INPUT', 0, 0); // input-1 = A
        await placeNode('INPUT', 0, 80); // input-2 = B
        await placeNode('XOR', 160, 0); // xor-1 = Sum
        await placeNode('AND', 160, 80); // and-1 = Carry
        await placeNode('OUTPUT', 320, 0); // output-1 = Sum
        await placeNode('OUTPUT', 320, 80); // output-2 = Carry
        await expect(preview.locator('[data-role="circuit-node"]')).toHaveCount(6);

        await connect('input-1', 'out', 'xor-1', 'a');
        await connect('input-2', 'out', 'xor-1', 'b');
        await connect('input-1', 'out', 'and-1', 'a');
        await connect('input-2', 'out', 'and-1', 'b');
        await connect('xor-1', 'out', 'output-1', 'a');
        await connect('and-1', 'out', 'output-2', 'a');
        await expect(preview.locator('[data-role="circuit-wire"]')).toHaveCount(6);

        await preview.locator('[data-action="check"]').click();
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Đúng 8/8 tổ hợp kiểm tra.');
    });

    test('shows a structural error for an unconnected circuit instead of a misleading score', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Circuit Structure Error');
        const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

        await editor.locator('[data-field="mode"]').selectOption('circuit');
        await editor.locator('[data-field="variable-count"]').selectOption('2');
        await editor.locator('[data-field="prompt"]').fill('Dựng mạch bán tổng (half-adder) cho A, B.');
        await editor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
        await saveIdevice(page, ideviceId);
        await saveProject(page);
        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
        await expect(preview).toHaveAttribute('data-behaviour-bound', 'true');

        await preview.locator('[data-role="circuit-palette-item"][data-node-kind="OUTPUT"]').click();
        await preview.locator('[data-role="circuit-cell"][data-x="0"][data-y="0"]').click();
        await expect(preview.locator('[data-role="circuit-node"]')).toHaveCount(1);

        await preview.locator('[data-action="check"]').click();
        await expect(preview.locator('[data-role="grading-feedback"]')).toHaveText(
            'Mạch chưa đúng cấu trúc, chưa thể chấm điểm.',
        );
        await expect(preview.locator('[data-role="grading-feedback"]')).not.toContainText('Điểm');
    });

    test('authors, saves, and grades a boolean expression through the palette, editor, and preview', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Boolean');
        const { editor, ideviceId } = await addElectronicsLogicIdevice(page, projectUuid);

        await editor.locator('[data-field="mode"]').selectOption('boolean');
        await editor.locator('[data-field="variable-count"]').selectOption('2');
        await editor.locator('[data-field="prompt"]').fill('Nhập biểu thức boolean tương đương A AND B.');
        await editor.locator('[data-field="answer-source"]').selectOption('expression');
        await editor.locator('[data-field="expression"]').fill('A AND B');
        await editor.locator('[data-field="max-score"]').fill('5');
        await editor.locator('[data-field="solution"]').fill('A AND B là phép nhân logic (AND).');

        await saveIdevice(page, ideviceId);
        await saveProject(page);

        const savedBeforeReload = await getSavedIdevice(page, ideviceId);
        expect(savedBeforeReload.error).toBeUndefined();
        expect(savedBeforeReload.jsonProperties?.schemaVersion).toBe(1);
        expect(savedBeforeReload.jsonProperties?.type).toBe('electronics.logic');
        expect(savedBeforeReload.jsonProperties).toMatchObject({
            mode: 'boolean',
            prompt: 'Nhập biểu thức boolean tương đương A AND B.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'expression', solution: 'A AND B là phép nhân logic (AND).' },
            answer: { expression: 'A AND B', minterms: [], dontCares: [] },
            grading: { maxScore: 5 },
        });

        await reloadPage(page);
        await waitForAppReady(page);
        const savedAfterReload = await getSavedIdevice(page, ideviceId);
        expect(savedAfterReload.error).toBeUndefined();
        expect(savedAfterReload.jsonProperties).toEqual(savedBeforeReload.jsonProperties);

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const preview = getPreviewFrame(page).locator('.electronics-logic-runtime').first();
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute('data-schema-version', '1');
        await expect(preview).toHaveAttribute('data-mode', 'boolean');
        await expect(preview).toContainText('Nhập biểu thức boolean tương đương A AND B.');
        await expect(preview).not.toContainText('A AND B là phép nhân logic (AND).');

        const learnerExpression = preview.locator('[data-role="learner-expression"]');
        await expect(learnerExpression).toBeVisible();
        await expect(preview.locator('[data-role="empty-state"]')).toBeVisible();

        await learnerExpression.fill('A OR B');
        await expect(preview.locator('[data-role="empty-state"]')).toBeHidden();
        await preview.locator('[data-action="check"]').click();
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Điểm: 0 / 5.');
        await expect(learnerExpression).toHaveAttribute('data-grade', 'failed');

        await preview.locator('[data-action="reset"]').click();
        await expect(learnerExpression).toHaveValue('');
        await expect(learnerExpression).not.toHaveAttribute('data-grade');
        await expect(preview.locator('[data-role="empty-state"]')).toBeVisible();
        await expect(preview.locator('[data-role="grading-feedback"]')).toBeEmpty();

        await learnerExpression.fill('A AND B');
        await preview.locator('[data-action="check"]').click();
        await expect(preview.locator('[data-role="grading-feedback"]')).toContainText('Điểm: 5 / 5.');
        await expect(learnerExpression).toHaveAttribute('data-grade', 'passed');
    });

    test('round-trips boolean, truth-table, Karnaugh, and circuit authoring across ten save/reload cycles', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Round Trip');

        const { editor: booleanEditor, ideviceId: booleanId } = await addElectronicsLogicIdevice(page, projectUuid);
        await booleanEditor.locator('[data-field="mode"]').selectOption('boolean');
        await booleanEditor.locator('[data-field="variable-count"]').selectOption('2');
        await booleanEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: Boolean.');
        await booleanEditor.locator('[data-field="answer-source"]').selectOption('expression');
        await booleanEditor.locator('[data-field="expression"]').fill('A AND B');
        await booleanEditor.locator('[data-field="max-score"]').fill('5');
        await saveIdevice(page, booleanId);

        const { editor: truthTableEditor, ideviceId: truthTableId } = await addElectronicsLogicIdeviceAt(page, 1);
        await truthTableEditor.locator('[data-field="mode"]').selectOption('truthTable');
        await truthTableEditor.locator('[data-field="variable-count"]').selectOption('2');
        await truthTableEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: bảng chân trị.');
        await truthTableEditor.locator('[data-field="answer-source"]').selectOption('minterms');
        await truthTableEditor.locator('[data-field="minterms"]').fill('2, 1');
        await truthTableEditor.locator('[data-field="max-score"]').fill('4');
        await saveIdevice(page, truthTableId);

        const { editor: kmapEditor, ideviceId: kmapId } = await addElectronicsLogicIdeviceAt(page, 2);
        await kmapEditor.locator('[data-field="mode"]').selectOption('kmap');
        await kmapEditor.locator('[data-field="variable-count"]').selectOption('2');
        await kmapEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: Karnaugh.');
        await kmapEditor.locator('[data-field="answer-source"]').selectOption('minterms');
        await kmapEditor.locator('[data-field="minterms"]').fill('3, 0');
        await kmapEditor.locator('[data-field="max-score"]').fill('6');
        await saveIdevice(page, kmapId);

        const { editor: circuitEditor, ideviceId: circuitId } = await addElectronicsLogicIdeviceAt(page, 3);
        await circuitEditor.locator('[data-field="mode"]').selectOption('circuit');
        await circuitEditor.locator('[data-field="variable-count"]').selectOption('2');
        await circuitEditor.locator('[data-field="prompt"]').fill('Vòng lặp lưu/mở: mạch logic.');
        await circuitEditor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
        await circuitEditor.locator('[data-field="max-score"]').fill('8');
        await saveIdevice(page, circuitId);

        await saveProject(page);

        const modes = [
            {
                key: 'boolean',
                ideviceId: booleanId,
                prompt: 'Vòng lặp lưu/mở: Boolean.',
                baseline: undefined as unknown,
            },
            {
                key: 'truthTable',
                ideviceId: truthTableId,
                prompt: 'Vòng lặp lưu/mở: bảng chân trị.',
                baseline: undefined as unknown,
            },
            { key: 'kmap', ideviceId: kmapId, prompt: 'Vòng lặp lưu/mở: Karnaugh.', baseline: undefined as unknown },
            {
                key: 'circuit',
                ideviceId: circuitId,
                prompt: 'Vòng lặp lưu/mở: mạch logic.',
                baseline: undefined as unknown,
            },
        ];

        for (const m of modes) {
            const saved = await getSavedIdevice(page, m.ideviceId);
            expect(saved.error).toBeUndefined();
            expect(saved.jsonProperties?.mode).toBe(m.key);
            m.baseline = saved.jsonProperties;
        }

        for (let round = 1; round <= 10; round += 1) {
            await reloadPage(page);
            await waitForAppReady(page);
            for (const m of modes) {
                const saved = await getSavedIdevice(page, m.ideviceId);
                expect(saved.error).toBeUndefined();
                expect(saved.jsonProperties).toEqual(m.baseline);
            }
        }

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        for (const m of modes) {
            const preview = getPreviewFrame(page).locator(`.electronics-logic-runtime[data-mode="${m.key}"]`);
            await expect(preview).toBeVisible();
            await expect(preview).toHaveAttribute('data-schema-version', '1');
            await expect(preview).toContainText(m.prompt);
        }
    });

    test('completes truth-table, Karnaugh, and half-adder grading in a real offline HTML5 export (I02, AT-09)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Offline Export');

        const { editor: truthTableEditor, ideviceId: truthTableId } = await addElectronicsLogicIdevice(
            page,
            projectUuid,
        );
        await truthTableEditor.locator('[data-field="mode"]').selectOption('truthTable');
        await truthTableEditor.locator('[data-field="variable-count"]').selectOption('3');
        await truthTableEditor.locator('[data-field="prompt"]').fill('Hoàn thành bảng chân trị ba biến.');
        await truthTableEditor.locator('[data-field="answer-source"]').selectOption('minterms');
        await truthTableEditor.locator('[data-field="minterms"]').fill('7, 1, 3');
        await truthTableEditor.locator('[data-field="dont-cares"]').fill('5');
        await truthTableEditor.locator('[data-field="max-score"]').fill('8');
        await saveIdevice(page, truthTableId);

        const { editor: kmapEditor, ideviceId: kmapId } = await addElectronicsLogicIdeviceAt(page, 1);
        await kmapEditor.locator('[data-field="mode"]').selectOption('kmap');
        await kmapEditor.locator('[data-field="variable-count"]').selectOption('3');
        await kmapEditor.locator('[data-field="prompt"]').fill('Hoàn thành bản đồ Karnaugh ba biến.');
        await kmapEditor.locator('[data-field="answer-source"]').selectOption('minterms');
        await kmapEditor.locator('[data-field="minterms"]').fill('7, 1, 3');
        await kmapEditor.locator('[data-field="dont-cares"]').fill('5');
        await saveIdevice(page, kmapId);

        const { editor: circuitEditor, ideviceId: circuitId } = await addElectronicsLogicIdeviceAt(page, 2);
        await circuitEditor.locator('[data-field="mode"]').selectOption('circuit');
        await circuitEditor.locator('[data-field="variable-count"]').selectOption('2');
        await circuitEditor.locator('[data-field="prompt"]').fill('Dựng mạch bán tổng (half-adder) cho A, B.');
        await circuitEditor.locator('[data-field="circuit-outputs"]').fill('Sum = A XOR B\nCarry = A AND B');
        await circuitEditor.locator('[data-field="max-score"]').fill('8');
        await saveIdevice(page, circuitId);

        await saveProject(page);

        // Export HTML5 THẬT qua UI, tải ZIP, giải nén Node-side.
        const download = await exportHtml5Website(page);
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'el-export-'));
        const zipPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(zipPath);
        const zip = unzipSync(fs.readFileSync(zipPath));

        // Sanity-check hình dạng ZIP trước khi phục vụ, để lỗi (nếu có) trỏ đúng nguyên nhân.
        expect(zip['index.html']).toBeTruthy();
        expect(zip['libs/exe_export.js']).toBeTruthy();
        expect(zip['idevices/electronics-logic/electronics-logic.js']).toBeTruthy();
        expect(zip['idevices/electronics-logic/electronics-logic-grader.bundle.js']).toBeTruthy();
        expect(zip['idevices/electronics-logic/electronics-logic.css']).toBeTruthy();

        // Phục vụ đúng byte đã tải từ một origin tổng hợp không có backing nào khác —
        // bất kỳ request nào không khớp key trong ZIP sẽ nhận 404, chứng minh trang
        // không cần mạng để hoàn thành (EXP-02/AT-09).
        const origin = 'http://el-offline.local';
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

        // --- truthTable: cùng giá trị/tương tác/feedback đã proven ở test preview (dòng 106-183) ---
        const truthTable = page.locator('.electronics-logic-runtime[data-mode="truthTable"]');
        await expect(truthTable).toBeVisible();
        await expect(truthTable).toHaveAttribute('data-behaviour-bound', 'true');
        const outputs = truthTable.locator('[data-role="truth-value"]');
        await expect(outputs).toHaveCount(8);
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            const value = rowIndex === 5 ? 'X' : rowIndex === 6 ? '1' : String(rowIndex % 2);
            await outputs.nth(rowIndex).selectOption(value);
        }
        await truthTable.locator('[data-action="check"]').click();
        await expect(truthTable.locator('[data-role="grading-feedback"]')).toContainText('7 / 8');
        for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
            await expect(outputs.nth(rowIndex)).toHaveAttribute('data-grade', rowIndex === 6 ? 'failed' : 'passed');
        }

        // --- kmap: cùng giá trị/tương tác/feedback đã proven ở test preview (dòng 185-242) ---
        const kmap = page.locator('.electronics-logic-runtime[data-mode="kmap"]');
        await expect(kmap).toBeVisible();
        await expect(kmap).toHaveAttribute('data-behaviour-bound', 'true');
        const kmapValues = ['0', '1', '0', '1', '0', 'X', '0', '1'];
        for (let mintermIndex = 0; mintermIndex < kmapValues.length; mintermIndex += 1) {
            await kmap
                .locator(`[data-role="kmap-cell"][data-minterm-index="${mintermIndex}"] [data-role="kmap-value"]`)
                .selectOption(kmapValues[mintermIndex]);
        }
        for (const mintermIndex of [1, 3, 5, 7]) {
            await kmap.locator(`[data-action="toggle-kmap-cell"][data-minterm-index="${mintermIndex}"]`).click();
        }
        await kmap.locator('[data-action="create-kmap-group"]').click();
        await expect(kmap.locator('[data-role="kmap-group"]')).toContainText('1, 3, 5, 7');
        await kmap.locator('[data-action="check"]').click();
        await expect(kmap.locator('[data-role="grading-feedback"]')).toContainText('10 / 10');
        await expect(kmap.locator('[data-role="grading-feedback"]')).toContainText('Một lời giải tối giản: C.');

        // --- circuit (half-adder): cùng giá trị/tương tác/feedback đã proven ở test preview (dòng 282-364) ---
        const circuit = page.locator('.electronics-logic-runtime[data-mode="circuit"]');
        await expect(circuit).toBeVisible();
        await expect(circuit).toHaveAttribute('data-behaviour-bound', 'true');

        const placeNode = async (kind: string, x: number, y: number) => {
            await circuit.locator(`[data-role="circuit-palette-item"][data-node-kind="${kind}"]`).click();
            await circuit.locator(`[data-role="circuit-cell"][data-x="${x}"][data-y="${y}"]`).click();
        };
        const connect = async (fromId: string, fromPin: string, toId: string, toPin: string) => {
            await circuit
                .locator(`[data-role="circuit-pin"][data-node-id="${fromId}"][data-pin-name="${fromPin}"]`)
                .click();
            await circuit
                .locator(`[data-role="circuit-pin"][data-node-id="${toId}"][data-pin-name="${toPin}"]`)
                .click();
        };

        await placeNode('INPUT', 0, 0); // input-1 = A
        await placeNode('INPUT', 0, 80); // input-2 = B
        await placeNode('XOR', 160, 0); // xor-1 = Sum
        await placeNode('AND', 160, 80); // and-1 = Carry
        await placeNode('OUTPUT', 320, 0); // output-1 = Sum
        await placeNode('OUTPUT', 320, 80); // output-2 = Carry
        await expect(circuit.locator('[data-role="circuit-node"]')).toHaveCount(6);

        await connect('input-1', 'out', 'xor-1', 'a');
        await connect('input-2', 'out', 'xor-1', 'b');
        await connect('input-1', 'out', 'and-1', 'a');
        await connect('input-2', 'out', 'and-1', 'b');
        await connect('xor-1', 'out', 'output-1', 'a');
        await connect('and-1', 'out', 'output-2', 'a');
        await expect(circuit.locator('[data-role="circuit-wire"]')).toHaveCount(6);

        await circuit.locator('[data-action="check"]').click();
        await expect(circuit.locator('[data-role="grading-feedback"]')).toContainText('8 / 8');
        await expect(circuit.locator('[data-role="grading-feedback"]')).toContainText('Đúng 8/8 tổ hợp kiểm tra.');

        await page.unroute(`${origin}/**`);
    });

    test('shows a Vietnamese alert instead of crashing when stored jsonProperties are malformed', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Electronics Logic Malformed JSON');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const pageErrors: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        const MALFORMED_JSON =
            '{"id":"idevice-malformed-electronics","type":"electronics-logic","schemaVersion":1,"mode":"unsupported"}';

        const pageId = await page.evaluate(
            ({ jsonProperties }) => {
                const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
                const firstPageId = bridge?.documentManager?.getNavigation()?.get(0)?.get('id');
                if (!firstPageId || !bridge?.structureBinding) {
                    throw new Error('Yjs project structure is not available');
                }
                const binding = bridge.structureBinding;
                const blockId = binding.createBlock(firstPageId, 'Malformed Electronics Logic');
                binding.createComponent(firstPageId, blockId, 'electronics-logic', {
                    id: 'idevice-malformed-electronics',
                    htmlContent: '<div class="electronics-logic-runtime"></div>',
                    jsonProperties: '{}',
                });
                const compMap = binding.getComponentMap('idevice-malformed-electronics');
                binding.manager.getDoc().transact(() => {
                    compMap.set('jsonProperties', jsonProperties);
                });
                return firstPageId;
            },
            { jsonProperties: MALFORMED_JSON },
        );

        await page.locator(`#menu_nav_content .nav-element[nav-id="${pageId}"]`).click();

        await openPreviewPanel(page);
        await waitForPreviewContent(page);

        const invalidRuntime = getPreviewFrame(page).locator('.electronics-logic-runtime--invalid');
        await expect(invalidRuntime).toBeVisible();
        await expect(invalidRuntime.locator('[role="alert"]')).toContainText(
            'Dữ liệu bài tập Electronics Logic không hợp lệ.',
        );

        expect(pageErrors).toEqual([]);
    });
});
