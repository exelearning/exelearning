import ModalPrintPreview, { DEFAULT_ACTIVITY_MODE, PREVIEW_MODE_DOCUMENT } from '../workarea/modals/modals/pages/modalPrintPreview.js';
import PrintFrameTransport from './PrintFrameTransport.js';
import { PrintPreviewExporter } from '../../../src/shared/export/exporters/PrintPreviewExporter';
import { WorksheetExporter } from '../../../src/shared/export/exporters/WorksheetExporter';
import { listInteractiveActivities, hasTeacherOnlyContent } from '../../../src/shared/export/exporters/printActivityModes';
import { resolvePrintResourceUrls } from '../../../src/shared/export/printPackage';
import LatexPreRenderer from '../common/LatexPreRenderer.js';
import MermaidPreRenderer from '../common/MermaidPreRenderer.js';
import MoleculeCapture from '../common/MoleculeCapture.js';

export const PREPARATION_TIMEOUT_MS = 25000;

/** Stop waiting without letting a late result change the current generation. */
function duringPreparation(work, signal) {
    return new Promise((resolve, reject) => {
        const finish = (error, value) => {
            signal.removeEventListener('abort', abort);
            if (error) reject(error);
            else resolve(value);
        };
        const abort = () => finish(signal.reason);
        if (signal.aborted) return abort();
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve().then(() => {
            signal.throwIfAborted();
            return work();
        }).then(value => finish(null, value), error => finish(error));
    });
}

/** Adapt the exported snapshot to the same controller and exporters used by the workarea. */
export function createExportedPrintPreview(data, root, resourceUrls = {}) {
    // Keep pending loads owned by this preview. Successful scripts are reused;
    // failed or cancelled loads are removed so opening again can retry them.
    const scripts = new Map();
    const attempts = new Map();
    let preparation = null;
    const loadScript = url => {
        if (scripts.has(url)) return scripts.get(url).promise;
        const script = document.createElement('script');
        const attempt = (attempts.get(url) || 0) + 1;
        attempts.set(url, attempt);
        const source = new URL(url, root);
        // Removing a script does not abort its network request in every browser.
        // A retry must not be coalesced with that still-stalled HTTP request.
        if (attempt > 1 && /^https?:$/.test(source.protocol)) source.searchParams.set('exe-print-attempt', String(attempt));
        const entry = { script };
        scripts.set(url, entry);
        entry.promise = new Promise((resolve, reject) => {
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                script.onload = script.onerror = null;
                entry.cancel = null;
                if (error) {
                    scripts.delete(url);
                    script.remove();
                    reject(error);
                } else resolve();
            };
            const timer = setTimeout(() => finish(new Error('PRINT_RESOURCES_TIMEOUT')), PREPARATION_TIMEOUT_MS);
            entry.cancel = finish;
            script.src = source.href;
            script.onload = () => finish();
            script.onerror = () => finish(new Error(`Could not load ${url}`));
            document.head.append(script);
        });
        return entry.promise;
    };
    const cancelGeneration = () => preparation?.abort(new DOMException('Print preview cancelled', 'AbortError'));
    const translate = (key) => data.translations[key] || key;
    const documentModel = { getMetadata: () => data.metadata, getNavigation: () => data.pages };
    const assetPaths = new Map(data.assetPaths);
    const resourceUrl = path => resourceUrls[path] || new URL(path, root).href;
    const resolveResourceUrls = html => resolvePrintResourceUrls(html.replace(/(idevices\/[^/]+)\/export\//g, '$1/'), root, assetPaths, resourceUrls);
    const resources = {
        fetchTheme: async () => new Map(data.themeFiles.map(name => [name, new Uint8Array()])),
        fetchLibraryFiles: async () => new Map(),
        fetchI18nFile: async () => data.i18n,
    };
    const math = async signal => {
        const url = resourceUrl('libs/exe_math/tex-mml-svg.js');
        const config = window.MathJax?.config || window.MathJax || {};
        try {
            if (!window.MathJax?.tex2svgPromise) {
                config.startup = { ...config.startup, typeset: false };
                config.loader = {
                    ...config.loader,
                    paths: { ...config.loader?.paths, mathjax: new URL('libs/exe_math', root).href, fonts: '[mathjax]/fonts' },
                    // Blob previews have no directory for extensions and dynamic font ranges.
                    // MathJax's loader supports a custom require returning a Promise.
                    require: url => {
                        const absolute = new URL(url, root).href;
                        const path = absolute.startsWith(root) ? absolute.slice(root.length) : null;
                        return loadScript(resourceUrls[path] || absolute);
                    },
                };
                window.MathJax = config;
                await duringPreparation(() => loadScript(url), signal);
            }
            await duringPreparation(() => window.MathJax?.startup?.promise, signal);
        } catch (error) {
            // A failed startup promise stays rejected/pending in MathJax. Retain
            // its configuration, not that runtime, so the next attempt can start.
            scripts.get(url)?.script.remove();
            scripts.delete(url);
            window.MathJax = config;
            throw error;
        }
    };
    const hooks = signal => ({
        resolveResourceUrls,
        preRenderLatex: async html => {
            if (LatexPreRenderer.hasLatex(html)) await math(signal);
            return LatexPreRenderer.preRender(html);
        },
        preRenderDataGameLatex: async html => {
            if (/DataGame/i.test(html)) await math(signal);
            return LatexPreRenderer.preRenderDataGameLatex(html);
        },
        preRenderMermaid: async html => {
            if (/class=["'][^"']*mermaid/.test(html)) await loadScript(resourceUrl('libs/mermaid/mermaid.min.js'));
            return MermaidPreRenderer.preRender(html);
        },
        captureMolecule: async view => {
            await loadScript(resourceUrl('idevices/3dmol/3Dmol-min.js'));
            return MoleculeCapture.capture(view);
        },
    });
    const generate = async (options, render) => {
        const controller = new AbortController();
        preparation = controller;
        const { signal } = controller;
        const cancelLoads = () => {
            for (const entry of scripts.values()) entry.cancel?.(signal.reason);
        };
        signal.addEventListener('abort', cancelLoads, { once: true });
        const timer = setTimeout(() => controller.abort(new Error('PRINT_RESOURCES_TIMEOUT')), PREPARATION_TIMEOUT_MS);
        const preparationHooks = hooks(signal);
        for (const key of ['preRenderLatex', 'preRenderDataGameLatex', 'preRenderMermaid', 'captureMolecule']) {
            const hook = preparationHooks[key];
            preparationHooks[key] = async (...args) => {
                try {
                    return await duringPreparation(() => hook(...args), signal);
                } catch (error) {
                    controller.abort(error);
                    throw error;
                }
            };
        }
        let result;
        try {
            result = await render({ ...options, ...preparationHooks });
            // Exporters can recover from individual rendering errors. A cancelled
            // or incomplete resource load must still prevent publishing this result.
            signal.throwIfAborted();
            return result;
        } catch (error) {
            result?.dispose?.();
            throw error;
        } finally {
            clearTimeout(timer);
            signal.removeEventListener('abort', cancelLoads);
            if (preparation === controller) preparation = null;
        }
    };
    let mount = document.getElementById('printPreviewMount');
    if (!mount) {
        mount = document.createElement('div');
        mount.id = 'printPreviewMount';
        document.body.append(mount);
    }
    const preview = new ModalPrintPreview(null, {
        translate,
        ideviceBasePath: Object.keys(resourceUrls).length ? 'idevices/' : new URL('idevices/', root).href,
        hasTeacherOnlyContent: () => hasTeacherOnlyContent(data.pages),
        cancelGeneration,
        generateDocument: options => generate(options, prepared => new PrintPreviewExporter(documentModel, resources).generatePreview({
            ...prepared, assetExportPathMap: assetPaths, materialIconDataUris: new Map(data.materialIcons), navLabels: data.navLabels,
        })),
        generateWorksheet: options => generate(options, prepared => new WorksheetExporter(documentModel).generate(prepared)),
    });
    preview.frameTransport = new PrintFrameTransport(preview.iframe, root, window, resourceUrls);
    preview.behaviour();
    const activities = listInteractiveActivities(data.pages);
    return {
        open: (opener) => {
            const ready = preview.show(PREVIEW_MODE_DOCUMENT, activities.length ? DEFAULT_ACTIVITY_MODE : null, null, activities);
            // Disabling the launch button during lazy loading removes the browser's focus from it.
            if (opener?.focus) preview.returnFocus = opener;
            return ready;
        },
        destroy: () => preview.destroy(),
        controller: preview,
    };
}

const entry = document.currentScript;
if (entry && window.__exePrintPackage) {
    const root = new URL(entry.dataset.printRoot || '../../', entry.src || document.baseURI).href;
    window.ExePrintPreview = createExportedPrintPreview(window.__exePrintPackage, root, window.__exePrintResourceUrls);
    const launch = document.getElementById('printPreviewLaunch');
    if (launch) {
        launch.textContent = window.__exePrintPackage.translations['Print preview'] || 'Print preview';
        launch.hidden = false;
        const open = () => window.ExePrintPreview.open(launch);
        launch.addEventListener('click', open);
        window.ExePrintPreview.controller.disposers.push(() => launch.removeEventListener('click', open));
    }
    window.addEventListener('pagehide', (event) => {
        if (!event.persisted) window.ExePrintPreview.destroy();
    });
    if (entry.dataset.printOpen === 'true') window.ExePrintPreview.open(launch);
}
