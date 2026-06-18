import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

type ExportCheck = { hasLibrary: boolean; referencesLibrary: boolean; hasRenderedMath: boolean };

/**
 * Add a JSON iDevice with LaTeX in its properties, disable MathJax bundling,
 * then run the preview and every browser export, reporting for each whether the
 * MathJax engine is bundled/referenced and whether pre-rendered math is present.
 */
async function exportWithJsonLatex(
    page: import('@playwright/test').Page,
    ideviceType: string,
    jsonProperties: Record<string, unknown>,
): Promise<Record<string, ExportCheck>> {
    return page.evaluate(
        async ({ ideviceType, jsonProperties }) => {
            const bridge = (window as any).eXeLearning?.app?.project?._yjsBridge;
            const exporters = (window as any).SharedExporters;
            const fflate = (window as any).fflate;
            if (
                !bridge?.documentManager ||
                !bridge?.structureBinding ||
                !exporters?.quickExport ||
                !fflate?.unzipSync
            ) {
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

            bridge.structureBinding.createComponent(pageId, blockId, ideviceType, {
                htmlContent: '',
                jsonProperties,
            });
            bridge.documentManager.getMetadata().set('addMathJax', false);

            const decoder = new TextDecoder();
            const inspectFiles = (files: Record<string, Uint8Array | ArrayBuffer>) => {
                const indexHtml = decoder.decode(files['index.html']);
                return {
                    hasLibrary: Boolean(files['libs/exe_math/tex-mml-svg.js']),
                    referencesLibrary: indexHtml.includes('libs/exe_math/tex-mml-svg.js'),
                    hasRenderedMath: indexHtml.includes('exe-math-rendered'),
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

            const result: Record<string, ExportCheck> = {
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
        },
        { ideviceType, jsonProperties },
    );
}

const ALL_TARGETS = ['preview', 'html5', 'page', 'scorm12', 'scorm2004', 'ims', 'elpx'];

test.describe('Runtime JSON iDevice LaTeX exports', () => {
    test('pre-renders LaTeX (no MathJax) for form', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Runtime JSON LaTeX (form)');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const checks = await exportWithJsonLatex(page, 'form', {
            eXeFormInstructions: '<p>Solve \\(x^2 = 1\\)</p>',
            questionsData: [
                {
                    baseText: '<p>Which equals \\(1\\)?</p>',
                    answers: [
                        [true, '\\(x^2\\)'],
                        [false, 'plain'],
                    ],
                    feedbackRight: '<p>Right: \\(y^2\\)</p>',
                    feedbackWrong: '',
                    selectionType: 'single',
                },
            ],
        });

        expect(Object.keys(checks)).toEqual(ALL_TARGETS);
        for (const check of Object.values(checks)) {
            // The form inserts question/feedback HTML directly and grades by index
            // (or by the plain text in <u> blanks), so the baked SVG survives and
            // MathJax is never bundled.
            expect(check.hasLibrary).toBe(false);
            expect(check.referencesLibrary).toBe(false);
            expect(check.hasRenderedMath).toBe(true);
        }
    });

    test('pre-renders LaTeX (no MathJax) for adaptative-quiz', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Runtime JSON LaTeX (pre-render)');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const checks = await exportWithJsonLatex(page, 'adaptative-quiz', {
            questionsGame: [{ question: 'Solve \\(x^2 = 1\\)', options: [{ text: '\\(i\\)' }, { text: '1' }] }],
        });

        expect(Object.keys(checks)).toEqual(ALL_TARGETS);
        for (const check of Object.values(checks)) {
            // adaptative-quiz keeps pre-rendered math through runtime escaping,
            // so MathJax is never bundled and the SVG is baked into the export.
            expect(check.hasLibrary).toBe(false);
            expect(check.referencesLibrary).toBe(false);
            expect(check.hasRenderedMath).toBe(true);
        }
    });

    test('pre-renders LaTeX (no MathJax) for scrambled-list', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'Runtime JSON LaTeX (scrambled-list)');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const checks = await exportWithJsonLatex(page, 'scrambled-list', {
            options: ['Solve \\(x^2 = 1\\)', 'Then \\(x = \\pm 1\\)', 'Done'],
        });

        expect(Object.keys(checks)).toEqual(ALL_TARGETS);
        for (const check of Object.values(checks)) {
            // scrambled-list now scores answers by a stable index, so the baked SVG
            // survives sorting/checking and MathJax is never bundled.
            expect(check.hasLibrary).toBe(false);
            expect(check.referencesLibrary).toBe(false);
            expect(check.hasRenderedMath).toBe(true);
        }
    });
});
