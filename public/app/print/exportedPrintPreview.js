import ModalPrintPreview, { DEFAULT_ACTIVITY_MODE, PREVIEW_MODE_DOCUMENT } from '../workarea/modals/modals/pages/modalPrintPreview.js';
import PrintFrameTransport from './PrintFrameTransport.js';
import { PrintPreviewExporter } from '../../../src/shared/export/exporters/PrintPreviewExporter';
import { WorksheetExporter } from '../../../src/shared/export/exporters/WorksheetExporter';
import { listInteractiveActivities, hasTeacherOnlyContent } from '../../../src/shared/export/exporters/printActivityModes';
import { resolvePrintResourceUrls } from '../../../src/shared/export/printPackage';
import LatexPreRenderer from '../common/LatexPreRenderer.js';
import MermaidPreRenderer from '../common/MermaidPreRenderer.js';
import MoleculeCapture from '../common/MoleculeCapture.js';

const scripts = new Map();
function loadScript(url) {
    if (!scripts.has(url)) scripts.set(url, new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => { scripts.delete(url); script.remove(); reject(new Error(`Could not load ${url}`)); };
        document.head.append(script);
    }));
    return scripts.get(url);
}

/** Adapt the exported snapshot to the same controller and exporters used by the workarea. */
export function createExportedPrintPreview(data, root, resourceUrls = {}) {
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
    const math = async () => {
        if (!window.MathJax?.tex2svgPromise) {
            const config = window.MathJax || {};
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
            await loadScript(resourceUrl('libs/exe_math/tex-mml-svg.js'));
        }
        await window.MathJax?.startup?.promise;
    };
    const hooks = {
        resolveResourceUrls,
        preRenderLatex: async html => {
            if (LatexPreRenderer.hasLatex(html)) await math();
            return LatexPreRenderer.preRender(html);
        },
        preRenderDataGameLatex: async html => {
            if (/DataGame/i.test(html)) await math();
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
        generateDocument: options => new PrintPreviewExporter(documentModel, resources).generatePreview({
            ...options, ...hooks, assetExportPathMap: assetPaths, materialIconDataUris: new Map(data.materialIcons), navLabels: data.navLabels,
        }),
        generateWorksheet: options => new WorksheetExporter(documentModel).generate({ ...options, ...hooks }),
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
