/** Portable data for the shared print preview. No Yjs state or editable source is published. */
import type { ExportMetadata, ExportPage, PageRenderOptions } from './interfaces';
import { isBlockVisible, isComponentVisible, visibleWorksheetPages } from './utils/visibility';

export const PRINT_RUNTIME_FILES = [
    'exe_print/runtime.js',
    'exe_print/frame.js',
    'exe_print/frame.html',
    'exe_print/preview.css',
    'exe_print/button.css',
    ...['Regular', 'SemiBold', 'Bold'].map(weight => `exe_print/fonts/Catamaran-${weight}.woff2`),
];

export interface PrintPackage {
    metadata: ExportMetadata;
    pages: ExportPage[];
    assetPaths: [string, string][];
    themeFiles: string[];
    materialIcons: [string, string][];
    translations: Record<string, string>;
    i18n: string;
    navLabels?: PageRenderOptions['navLabels'];
    /** Whether the package carries MathJax: the preview never loads it otherwise. */
    mathJax?: boolean;
}

/** A separate, read-only snapshot; hidden ancestors, blocks and components never reach it. */
export function printPackagePages(pages: ExportPage[]): ExportPage[] {
    return visibleWorksheetPages(pages).map(page => ({
        ...page,
        children: undefined,
        blocks: (page.blocks || []).filter(isBlockVisible).map(block => ({
            ...block,
            components: (block.components || []).filter(isComponentVisible),
        })),
    }));
}

/** Safe both as an external classic script (file://) and in an HTML script element. */
export function serializePrintPackage(data: PrintPackage): string {
    return `window.__exePrintPackage=${JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')};`;
}

/** Resolve package URLs before placing HTML in an opaque iframe; CSP forbids relying on <base>. */
export function resolvePrintResourceUrls(
    html: string,
    root: string,
    assets: Map<string, string>,
    resourceUrls: Record<string, string> = {},
): string {
    const resource = (reference: string) => {
        const id = reference.split('/')[0].replace(/\.[a-z0-9]+$/i, '');
        return assets.get(reference) || assets.get(id) || reference;
    };
    const resolve = (reference: string) => {
        const hash = reference.indexOf('#');
        const path = hash < 0 ? reference : reference.slice(0, hash);
        const key = path.split('?')[0];
        let decoded = key;
        try {
            decoded = decodeURIComponent(key);
        } catch {
            // A literal percent sign is a valid archive filename.
        }
        const url = resourceUrls[key] || resourceUrls[decoded] || new URL(path, root).href;
        return url + (hash < 0 ? '' : reference.slice(hash));
    };
    return (
        html
            // Export preprocessing leaves this marker in activity sidecars and rich text.
            // A standalone worksheet has no page renderer to substitute it afterwards.
            .replace(/(?:\{\{context_path\}\}|%7B%7Bcontext_path%7D%7D)\//gi, '')
            .replace(/asset:\/\/([^"'\s<>\\)]+)/g, (_match, ref: string) => `content/resources/${resource(ref)}`)
            // Quoted HTML/CSS URLs and HTML-encoded activity data can contain spaces.
            // Resolve the whole value before handling unquoted URLs below.
            .replace(
                /(["']|&quot;)((?:content\/|libs\/|theme\/|idevices\/|fonts\/)(?:(?!\1)[^<>\\])*)\1/g,
                (_match, quote: string, reference: string) => `${quote}${resolve(reference)}${quote}`,
            )
            .replace(
                /(["'(=]|&quot;)((?:content\/|libs\/|theme\/|idevices\/|fonts\/)(?:(?!&quot;)[^"'\s<>\\)])+)/g,
                (_match, prefix: string, reference: string) => {
                    return `${prefix}${resolve(reference)}`;
                },
            )
    );
}

export function printPackageEntry(language: string): string {
    const lang = language.replace(/[^a-zA-Z0-9-]/g, '') || 'en';
    return `<!DOCTYPE html><html lang="${lang}" id="exe-index"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>eXeLearning</title><link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css"><link rel="stylesheet" href="libs/exe_print/preview.css"><script src="libs/jquery/jquery.min.js"></script><script src="libs/common_i18n.js"></script><script src="libs/common.js"></script></head><body><button type="button" id="printPreviewLaunch" class="btn btn-secondary m-3" hidden></button><div id="printPreviewMount"></div><script src="libs/exe_print/data.js"></script><script src="libs/exe_print/runtime.js" data-print-root="../../" data-print-open="true"></script></body></html>`;
}
