import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { getPreviewFrame, gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

type FxExportCheck = {
    hasScript: boolean;
    hasStylesheet: boolean;
    referencesScript: boolean;
    referencesStylesheet: boolean;
};

const FX_MARKUP = [
    '<div class="exe-fx exe-tabs">',
    '<h2>One</h2><p>This is a <u>hidden</u> word.</p>',
    '<h2>Two</h2><p>This is the <u>second</u> tab.</p>',
    '</div>',
].join('');

async function addFormWithFxAndInspectExports(page: Page): Promise<Record<string, FxExportCheck>> {
    return page.evaluate(async fxMarkup => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        const exporters = (window as any).SharedExporters;
        const fflate = (window as any).fflate;
        if (!bridge?.documentManager || !bridge?.structureBinding || !exporters?.quickExport || !fflate?.unzipSync) {
            throw new Error('Browser export dependencies are not available');
        }

        const navigation = bridge.documentManager.getNavigation();
        const pageMap = navigation.get(0);
        const pageId = pageMap?.get('id');
        if (!pageId) throw new Error('The project has no page');

        let blockId = bridge.structureBinding.getBlocks(pageId)?.[0]?.id;
        if (!blockId) {
            blockId = bridge.structureBinding.createBlock(pageId, 'Content');
        }
        if (!blockId) throw new Error('Could not create a content block');

        bridge.structureBinding.createComponent(pageId, blockId, 'form', {
            htmlContent: '',
            jsonProperties: {
                eXeFormInstructions: '<p>Complete the sentence</p>',
                questionsRandom: false,
                percentageQuestions: '100',
                time: '0',
                questionsData: [
                    {
                        id: 'form-fx-question',
                        activityType: 'fill',
                        baseText: fxMarkup,
                        feedbackRight: '',
                        feedbackWrong: '',
                        suggestion: '',
                        wrongAnswersValue: '',
                        selectionType: 'single',
                        answers: [],
                        answer: '1',
                        capitalization: true,
                        strict: true,
                        order: 0,
                        customScore: 1,
                        time: 0,
                    },
                ],
                passRate: 5,
                addBtnAnswers: true,
                eXeIdeviceTextAfter: '',
                showSlider: false,
                evaluation: false,
                evaluationID: '',
                repeatActivity: true,
                isScorm: 0,
                weighted: 100,
            },
        });

        const decoder = new TextDecoder();
        const inspectFiles = (files: Record<string, Uint8Array | ArrayBuffer>): FxExportCheck => {
            const indexHtml = decoder.decode(files['index.html']);
            return {
                hasScript: Boolean(files['libs/exe_effects/exe_effects.js']),
                hasStylesheet: Boolean(files['libs/exe_effects/exe_effects.css']),
                referencesScript: indexHtml.includes('libs/exe_effects/exe_effects.js'),
                referencesStylesheet: indexHtml.includes('libs/exe_effects/exe_effects.css'),
            };
        };

        const preview = await exporters.generatePreviewForSW(
            bridge.documentManager,
            bridge.assetCache || null,
            bridge.resourceFetcher || null,
            bridge.assetManager || null,
        );
        if (!preview.success || !preview.files) {
            throw new Error(preview.error || 'Preview generation failed');
        }

        const result: Record<string, FxExportCheck> = {
            preview: inspectFiles(preview.files),
        };

        for (const format of ['html5', 'page', 'scorm12', 'scorm2004', 'ims', 'elpx']) {
            const exported = await exporters.quickExport(
                format,
                bridge.documentManager,
                bridge.assetCache || null,
                bridge.resourceFetcher || null,
                {},
                bridge.assetManager || null,
            );
            if (!exported.success || !exported.data) {
                throw new Error(exported.error || `${format} export failed`);
            }
            result[format] = inspectFiles(fflate.unzipSync(new Uint8Array(exported.data)));
        }

        return result;
    }, FX_MARKUP);
}

async function addMagnifierWithFx(page: Page): Promise<void> {
    await page.evaluate(async fxMarkup => {
        const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
        if (!bridge?.documentManager || !bridge?.structureBinding) {
            throw new Error('Browser export dependencies are not available');
        }

        const navigation = bridge.documentManager.getNavigation();
        const pageId = navigation.get(0)?.get('id');
        if (!pageId) throw new Error('The project has no page');

        let blockId = bridge.structureBinding.getBlocks(pageId)?.[0]?.id;
        if (!blockId) {
            blockId = bridge.structureBinding.createBlock(pageId, 'Content');
        }
        if (!blockId) throw new Error('Could not create a content block');

        bridge.structureBinding.createComponent(pageId, blockId, 'magnifier', {
            htmlContent: '',
            jsonProperties: {
                textTextarea: fxMarkup,
                isDefaultImage: '1',
                imageResource: '',
                width: 600,
                height: '',
                align: 'none',
                glassSize: 1,
                initialZSize: 100,
                author: '',
                alt: '',
            },
        });
    }, FX_MARKUP);
}

test.describe('Form iDevice FX export', () => {
    test('bundles and initializes FX content stored in question properties', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Form FX export');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const checks = await addFormWithFxAndInspectExports(page);
        expect(Object.keys(checks)).toEqual(['preview', 'html5', 'page', 'scorm12', 'scorm2004', 'ims', 'elpx']);
        for (const check of Object.values(checks)) {
            expect(check.hasScript).toBe(true);
            expect(check.hasStylesheet).toBe(true);
            expect(check.referencesScript).toBe(true);
            expect(check.referencesStylesheet).toBe(true);
        }

        await page.locator('#head-bottom-preview').click();
        const preview = await getPreviewFrame(page);
        if (!preview) throw new Error('Preview frame is not available');

        const effect = preview.locator('.form-IDevice .exe-fx.exe-tabs').first();
        const tabs = effect.locator('.fx-tabs').first();
        const panels = effect.locator('.fx-tab-content');
        await expect(tabs).toBeVisible({ timeout: 15_000 });
        await expect(panels).toHaveCount(2);

        await tabs.locator('a').nth(1).click();
        await expect(panels.nth(1)).toHaveClass(/fx-current/);
    });

    test('initializes FX content stored in magnifier properties', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Magnifier FX export');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await addMagnifierWithFx(page);

        await page.locator('#head-bottom-preview').click();
        const preview = await getPreviewFrame(page);
        if (!preview) throw new Error('Preview frame is not available');

        const effect = preview.locator('.exe-magnifier-container .exe-fx.exe-tabs').first();
        const tabs = effect.locator('.fx-tabs').first();
        const panels = effect.locator('.fx-tab-content');
        await expect(tabs).toBeVisible({ timeout: 15_000 });
        await expect(panels).toHaveCount(2);

        await tabs.locator('a').nth(1).click();
        await expect(panels.nth(1)).toHaveClass(/fx-current/);
    });
});
