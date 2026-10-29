import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

const doubles = vi.hoisted(() => ({
    document: vi.fn(async () => ({ success: true, html: '<html><body>Course</body></html>' })),
    worksheet: vi.fn(async () => ({ success: true, html: '<html><body>Exercises</body></html>', model: { pages: [], unsupported: [] } })),
    load: vi.fn(async () => {}), print: vi.fn(async () => {}), clear: vi.fn(), destroy: vi.fn(), setOptions: vi.fn(),
}));
vi.mock('../../../src/shared/export/exporters/PrintPreviewExporter', () => ({ PrintPreviewExporter: class {
    constructor(_document, resources) { doubles.resources = resources; }
    generatePreview = doubles.document;
} }));
vi.mock('../../../src/shared/export/exporters/WorksheetExporter', () => ({ WorksheetExporter: class { generate = doubles.worksheet; } }));
vi.mock('./PrintFrameTransport.js', () => ({ default: class {
    load = doubles.load; print = doubles.print; clear = doubles.clear; destroy = doubles.destroy; setOptions = doubles.setOptions;
} }));
vi.mock('../../../src/shared/export/exporters/printActivityModes', () => ({
    listInteractiveActivities: () => [{ id: 'activity', type: 'guess', pageTitle: 'Home', blockTitle: 'Riddle', supported: true }],
    hasTeacherOnlyContent: () => true,
}));
vi.mock('../common/LatexPreRenderer.js', () => ({ default: {
    hasLatex: html => html.includes('formula'), preRender: vi.fn(async html => ({ html, success: true })),
    preRenderDataGameLatex: vi.fn(async html => ({ html, success: true })),
} }));
vi.mock('../common/MermaidPreRenderer.js', () => ({ default: { preRender: vi.fn(async html => ({ html, success: true })) } }));
vi.mock('../common/MoleculeCapture.js', () => ({ default: { capture: vi.fn(async () => 'data:image/png;base64,capture') } }));
import { createExportedPrintPreview, PREPARATION_TIMEOUT_MS } from './exportedPrintPreview.js';

describe('exported print preview adapter', () => {
    let preview;
    beforeEach(() => {
        vi.clearAllMocks();
        doubles.document.mockReset().mockResolvedValue({ success: true, html: '<html><body>Course</body></html>' });
        document.body.innerHTML = '<button id="opener">Print</button>';
        document.getElementById('opener').focus();
        preview = createExportedPrintPreview({ metadata: { title: 'Course' }, pages: [],
            translations: { 'Print preview': 'Vista previa' }, assetPaths: [['image', 'figure.png']], themeFiles: ['style.css'],
            materialIcons: [], i18n: '', navLabels: { licenseLabel: 'Licencia' } }, 'https://example.test/html/course/');
    });
    afterEach(() => { preview.destroy(); vi.restoreAllMocks(); vi.useRealTimers(); delete window.MathJax; });

    it.each([
        ['preRenderLatex', 'formula'],
        ['preRenderMermaid', '<div class="mermaid">graph</div>'],
        ['captureMolecule', {}],
    ])('bounds stalled %s loading, rejects incomplete output and permits retry', async (hook, input) => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const dispose = vi.fn();
        doubles.document.mockImplementation(async options => {
            // The document exporter deliberately tolerates individual hook errors.
            try { await options[hook](input); } catch { /* Adapter must reject incomplete output. */ }
            return { success: true, html: '<html><body>Rendered</body></html>', dispose };
        });
        const append = vi.spyOn(document.head, 'append').mockImplementation(() => {});
        const pending = preview.open();
        await vi.advanceTimersByTimeAsync(0);
        expect(append).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(PREPARATION_TIMEOUT_MS);
        await pending;
        expect(preview.controller.loadingEl.textContent).toContain('Print resources did not finish loading');
        expect(preview.controller.busy).toBe(false);
        expect(preview.controller.printBtn.disabled).toBe(true);
        expect(doubles.load).not.toHaveBeenCalled();
        expect(dispose).toHaveBeenCalledOnce();
        append.mockImplementation(script => queueMicrotask(() => script.onload()));
        await preview.open();
        expect(append).toHaveBeenCalledTimes(2);
        expect(preview.controller.ready).toBe(true);
        expect(new URL(append.mock.calls[1][0].src).searchParams.get('exe-print-attempt')).toBe('2');
    });

    it('bounds MathJax startup after script load and retries with a fresh runtime', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        window.MathJax = { config: { startup: { typeset: false } }, tex2svgPromise: vi.fn(),
            startup: { promise: new Promise(() => {}) } };
        doubles.document.mockImplementation(async options => {
            await options.preRenderLatex('formula');
            return { success: true, html: '<html><body>Formula</body></html>' };
        });
        const pending = preview.open();
        await vi.advanceTimersByTimeAsync(PREPARATION_TIMEOUT_MS);
        await pending;
        expect(preview.controller.loadingEl.textContent).toContain('Print resources did not finish loading');
        vi.spyOn(document.head, 'append').mockImplementation(script => {
            window.MathJax = { tex2svgPromise: vi.fn(), startup: { promise: Promise.resolve() } };
            queueMicrotask(() => script.onload());
        });
        await preview.open();
        expect(preview.controller.ready).toBe(true);
    });

    it.each(['close', 'options'])('cancels stalled loading on %s and ignores late completion before retry', async action => {
        vi.useFakeTimers();
        doubles.document.mockImplementation(async options => {
            await options.preRenderLatex('formula');
            return { success: true, html: '<html><body>Current</body></html>' };
        });
        const append = vi.spyOn(document.head, 'append').mockImplementation(() => {});
        const first = preview.open();
        await vi.advanceTimersByTimeAsync(0);
        const lateLoad = append.mock.calls[0][0].onload;
        if (action === 'close') preview.controller.close();
        else preview.controller.scheduleRegeneration();
        await first;
        expect(preview.controller.generationPromise).toBeNull();
        const next = action === 'close' ? preview.open() : vi.advanceTimersByTimeAsync(250);
        await vi.advanceTimersByTimeAsync(0);
        expect(append).toHaveBeenCalledTimes(2);
        lateLoad();
        expect(doubles.load).not.toHaveBeenCalled();
        append.mock.calls[1][0].onload();
        await next;
        await vi.advanceTimersByTimeAsync(0);
        expect(preview.controller.ready).toBe(true);
        expect(doubles.load).toHaveBeenCalledOnce();
    });

    it('removes a failed script and allows another load', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        doubles.document.mockImplementation(async options => {
            await options.preRenderMermaid('<div class="mermaid">graph</div>');
            return { success: true, html: '<html><body>Diagram</body></html>' };
        });
        const append = vi.spyOn(document.head, 'append').mockImplementation(script => queueMicrotask(() => script.onerror()));
        await preview.open();
        expect(preview.controller.ready).toBe(false);
        append.mockImplementation(script => queueMicrotask(() => script.onload()));
        await preview.open();
        expect(preview.controller.ready).toBe(true);
        expect(append).toHaveBeenCalledTimes(2);
    });

    it('uses the shared shell and defaults, supports mode changes and returns focus on close', async () => {
        const opener = document.getElementById('opener');
        opener.disabled = true;
        await preview.open(opener);
        opener.disabled = false;
        expect(document.querySelector('.print-preview-title-text').textContent).toBe('Vista previa');
        expect(document.getElementById('printOptLinkUrls').checked).toBe(true);
        expect(document.getElementById('printOptUnfoldBlocks').checked).toBe(false);
        expect(document.querySelector('.print-preview-print-btn').disabled).toBe(false);
        expect(doubles.document).toHaveBeenCalledWith(expect.objectContaining({ activities: expect.objectContaining({ mode: 'in-place' }), navLabels: { licenseLabel: 'Licencia' } }));
        expect(doubles.setOptions).toHaveBeenCalledWith({ unfoldBlocks: false });
        expect(doubles.setOptions).toHaveBeenCalledWith({ teacherOnly: false });
        await preview.controller.print();
        expect(doubles.print).toHaveBeenCalledTimes(1);
        await preview.controller.generateIdevicesWorksheet();
        expect(doubles.worksheet).toHaveBeenCalledWith(expect.objectContaining({ ideviceBasePath: 'https://example.test/html/course/idevices/' }));
        preview.controller.close();
        expect(document.activeElement.id).toBe('opener');
    });

    it('prints without the images the frame left out, saying so without blocking', async () => {
        doubles.load.mockResolvedValueOnce({ skippedImages: 2 });
        await preview.open();
        const notice = document.querySelector('.print-preview-notice');
        expect(notice.hidden).toBe(false);
        expect(notice.querySelector('[data-notice="images-skipped"]').hidden).toBe(false);
        expect(notice.querySelector('[data-notice="not-started"]').hidden).toBe(true);
        expect(document.querySelector('.print-preview-open-tab-btn').hidden).toBe(true);
        expect(document.querySelector('.print-preview-print-btn').disabled).toBe(false);
        expect(document.querySelector('.print-preview-error')).toBeNull();
        await preview.controller.print();
        expect(doubles.print).toHaveBeenCalledTimes(1);

        // A preview with every image in place says nothing.
        preview.controller.close();
        await preview.open();
        expect(notice.hidden).toBe(true);
    });

    it('offers a way out when the frame cannot start printing', async () => {
        await preview.open();
        doubles.print.mockRejectedValueOnce(new Error('Printing blocked'));
        await preview.controller.print();
        const notice = document.querySelector('.print-preview-notice');
        expect(notice.hidden).toBe(false);
        expect(notice.querySelector('[data-notice="not-started"]').hidden).toBe(false);
        expect(document.querySelector('.print-preview-open-tab-btn').hidden).toBe(false);
    });

    it('resolves package assets and loads render engines only when required', async () => {
        await preview.open();
        const hooks = doubles.document.mock.calls[0][0];
        expect([...await doubles.resources.fetchTheme()].map(([name]) => name)).toEqual(['style.css']);
        expect((await doubles.resources.fetchLibraryFiles()).size).toBe(0);
        expect(await doubles.resources.fetchI18nFile()).toBe('');
        expect(hooks.resolveResourceUrls('<img src="asset://image"><script src="idevices/text/export/text.js"></script>')).toContain('https://example.test/html/course/content/resources/figure.png');
        expect(hooks.resolveResourceUrls('<script src="idevices/text/export/text.js"></script>')).toContain('/idevices/text/text.js');
        const loaded = [];
        vi.spyOn(document.head, 'append').mockImplementation(script => {
            loaded.push(script.src);
            queueMicrotask(() => script.onload());
        });
        await hooks.preRenderLatex('ordinary text');
        expect(loaded).toEqual([]);
        await hooks.preRenderLatex('formula');
        await hooks.preRenderDataGameLatex('DataGame');
        await hooks.preRenderMermaid('<div class="mermaid">graph</div>');
        await hooks.captureMolecule({});
        expect(loaded).toEqual([
            'https://example.test/html/course/libs/exe_math/tex-mml-svg.js',
            'https://example.test/html/course/libs/mermaid/mermaid.min.js',
            'https://example.test/html/course/idevices/3dmol/3Dmol-min.js',
        ]);
    });

    it('loads math extensions from the blob map and keeps assets local', async () => {
        preview.destroy();
        preview = createExportedPrintPreview({ metadata: { title: 'Blob course' }, pages: [], translations: {},
            assetPaths: [], themeFiles: [], materialIcons: [], i18n: '' }, 'https://example.test/blob-course/', {
            'libs/exe_math/tex-mml-svg.js': 'blob:math-engine',
            'libs/exe_math/input/tex/extensions/color.js': 'blob:math-color',
            'content/resources/rabbit.svg': 'blob:rabbit',
        });
        await preview.open();
        const hooks = doubles.document.mock.calls.at(-1)[0];
        const loaded = [];
        vi.spyOn(document.head, 'append').mockImplementation(script => {
            loaded.push(script.src);
            queueMicrotask(() => script.onload());
        });
        await hooks.preRenderLatex('formula');
        expect(window.MathJax.startup.typeset).toBe(false);
        await window.MathJax.loader.require('https://example.test/blob-course/libs/exe_math/input/tex/extensions/color.js');
        expect(loaded).toEqual(['blob:math-engine', 'blob:math-color']);
        expect(hooks.resolveResourceUrls('<img src="{{context_path}}/content/resources/rabbit.svg">')).toBe('<img src="blob:rabbit">');
    });

    it('boots the standalone entry, supports reopening and retains the UI in the back-forward cache', async () => {
        preview.destroy();
        document.body.innerHTML = '<button id="printPreviewLaunch" hidden></button><div id="printPreviewMount"></div>';
        const script = document.createElement('script');
        script.src = 'https://example.test/course/libs/exe_print/runtime.js';
        script.dataset.printOpen = 'true';
        const currentScript = vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script);
        window.__exePrintPackage = { metadata: { title: 'Course' }, pages: [], translations: { 'Print preview': 'Preview label' },
            assetPaths: [], themeFiles: [], materialIcons: [], i18n: '' };
        const listen = vi.spyOn(window, 'addEventListener');
        vi.resetModules();
        await import('./exportedPrintPreview.js');
        preview = window.ExePrintPreview;
        const launch = document.getElementById('printPreviewLaunch');
        await vi.waitFor(() => expect(document.querySelector('.print-preview-print-btn').disabled).toBe(false));
        expect(launch.hidden).toBe(false);
        expect(launch.textContent).toBe('Preview label');
        preview.controller.close();
        expect(document.activeElement).toBe(launch);
        launch.click();
        await vi.waitFor(() => expect(document.querySelector('.print-preview-print-btn').disabled).toBe(false));
        const pagehide = listen.mock.calls.find(([event]) => event === 'pagehide')[1];
        const destroy = vi.spyOn(preview, 'destroy');
        pagehide({ persisted: true });
        expect(destroy).not.toHaveBeenCalled();
        pagehide({ persisted: false });
        expect(destroy).toHaveBeenCalledOnce();
        window.removeEventListener('pagehide', pagehide);
        currentScript.mockRestore();
        delete window.ExePrintPreview;
        delete window.__exePrintPackage;
    });
});
