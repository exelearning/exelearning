/**
 * ThemeFileUrlResolver
 *
 * Hands a style's own files to a preview as blob URLs, for a style that is not served from
 * anywhere: one the user imported, which is kept with the project rather than on the server.
 *
 * The page refers to the style's files as `theme/<path>`, which resolves to nothing in a preview
 * shown as a blob: document. Each file the page refers to becomes a blob URL of its bytes. A
 * stylesheet is rewritten first: its relative `url()` and `@import` references point at the
 * corresponding blob URLs, including imported stylesheets. SVG fragments are preserved.
 * Original HTML paths are kept in data-exe-theme-src/href attributes. CSS attribute selectors
 * use :is() to match both these paths and ordinary src/href values, at the same specificity.
 *
 * Files are turned into URLs only when something refers to them, and every URL handed out
 * belongs to this resolver until `dispose()` releases it.
 */

import parse from 'css-tree/parser';
import { string, url as cssUrl } from 'css-tree/utils';
import walk from 'css-tree/walker';
import { getMimeFromExtension } from '../constants';

/** The page's references to the style's files, as the renderer writes them. */
const PAGE_REFERENCE_PATTERN = /\s(src|href)="theme\/([^"]+)"/g;

/** References that are not relative to the stylesheet: with a scheme, from the root, or in-document. */
const NOT_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;

/** Any absolute base will do: it only gives `../` and `./` something to be resolved against. */
const PATH_BASE = 'https://style.invalid/';

export class ThemeFileUrlResolver {
    private files: Map<string, Uint8Array>;
    private urls = new Map<string, string>();
    /** Stylesheets being rewritten, so two that refer to each other do not loop forever. */
    private rewriting = new Set<string>();

    /**
     * @param files - The style's files, keyed by their path inside it (e.g. 'icons/info.png')
     * @param parseCss - CSS parser, injectable to exercise recovery from analysis failures
     */
    constructor(
        files: Map<string, Uint8Array>,
        private readonly parseCss: typeof parse = parse,
    ) {
        this.files = files;
    }

    /**
     * Point the page's references to the style's files at their blob URLs.
     *
     * A reference to a file the style does not have is left as it was.
     *
     * @param html - The page
     * @returns The page with its references rewritten
     */
    resolve(html: string): string {
        return html.replace(PAGE_REFERENCE_PATTERN, (match, attribute: string, path: string) => {
            const url = this.resolveReference(path, '');
            // Themes can select icons by filename (e.g. Universal's img[src*="eng_"]). Keep
            // that identity in an attribute, leaving URL fragments available to select SVG elements.
            return url ? ` ${attribute}="${url}" data-exe-theme-${attribute}="theme/${path}"` : match;
        });
    }

    /** Release every blob URL handed out. Safe to call more than once. */
    dispose(): void {
        for (const url of this.urls.values()) URL.revokeObjectURL(url);
        this.urls.clear();
    }

    /**
     * The blob URL of one of the style's files, made the first time it is asked for.
     *
     * @returns The URL, or undefined when the style has no such file
     */
    private urlFor(path: string): string | undefined {
        const known = this.urls.get(path);
        if (known) return known;

        const data = this.files.get(path);
        if (!data || this.rewriting.has(path)) return undefined;

        const dot = path.lastIndexOf('.');
        const extension = dot === -1 ? '' : path.slice(dot).toLowerCase();
        let body: Uint8Array | string = data;
        if (extension === '.css') {
            this.rewriting.add(path);
            try {
                body = this.rewriteStylesheet(new TextDecoder().decode(data), path);
            } catch {
                // A user stylesheet must not take down the preview if parsing fails. Its CSS
                // still applies, although relative references in this fallback remain unresolved.
                body = data;
            } finally {
                this.rewriting.delete(path);
            }
        }

        // biome-ignore lint/suspicious/noExplicitAny: Uint8Array is a valid BlobPart at runtime
        const url = URL.createObjectURL(new Blob([body as any], { type: getMimeFromExtension(extension) }));
        this.urls.set(path, url);
        return url;
    }

    /**
     * Point a stylesheet's relative references at the blob URLs of the files they name.
     *
     * @param css - The stylesheet's text
     * @param cssPath - Where the stylesheet sits in the style, which its references are relative to
     * @returns The stylesheet with every reference it could resolve rewritten
     */
    private rewriteStylesheet(css: string, cssPath: string): string {
        const ast = this.parseCss(css, { positions: true, parseCustomProperty: true });
        const replacements: { start: number; end: number; text: string }[] = [];
        const resolve = (reference: string) => this.resolveReference(reference, cssPath);
        walk(ast, function (node) {
            if (!node.loc) return;
            const { offset: start } = node.loc.start;
            const { offset: end } = node.loc.end;
            const original = css.slice(start, end);
            const importedString =
                node.type === 'String' &&
                this.atrule?.name.toLowerCase() === 'import' &&
                this.atrule.prelude?.type === 'AtrulePrelude' &&
                this.atrule.prelude.children.first === node;

            if (node.type === 'Url' || importedString) {
                const resolved = resolve(node.value);
                if (!resolved) return;
                const quote = node.type === 'String' ? original[0] : original.match(/^url\(\s*(['"])/i)?.[1];
                const value = string.encode(resolved, quote === "'");
                const text = node.type === 'String' ? value : quote ? `url(${value})` : cssUrl.encode(resolved);
                replacements.push({ start, end, text });
            } else if (node.type === 'AttributeSelector' && node.matcher && node.name.loc) {
                const attribute = node.name.name.toLowerCase();
                if (attribute !== 'src' && attribute !== 'href') return;
                const nameStart = node.name.loc.start.offset - start;
                const nameEnd = node.name.loc.end.offset - start;
                const logical = `${original.slice(0, nameStart)}data-exe-theme-${attribute}${original.slice(nameEnd)}`;
                // :is() retains the attribute selector's specificity and keeps matching ordinary
                // content resources too, including inside :has(), :not() and nested rules.
                replacements.push({ start, end, text: `:is(${original},${logical})` });
            }
        });

        // Only replace recognized references/selectors. Keep comments, unknown CSS, import
        // conditions and the rest of the stylesheet verbatim, in their original cascade order.
        for (const { start, end, text } of replacements.sort((a, b) => b.start - a.start)) {
            css = css.slice(0, start) + text + css.slice(end);
        }
        return css;
    }

    /** Resolve a local reference to a shared blob URL, retaining its fragment target. */
    private resolveReference(reference: string, from: string): string | undefined {
        if (NOT_RELATIVE.test(reference)) return undefined;
        const resolved = resolvePath(from, reference);
        if (!resolved) return undefined;
        const url = this.urlFor(resolved.path);
        return url ? url + resolved.fragment : undefined;
    }
}

/**
 * Resolve a reference against the file it appears in, as a path inside the style.
 *
 * Files are found by their path alone. Preserve the fragment for SVG filters and sprites;
 * queries used for cache busting are unnecessary for the preview's own blob URLs.
 *
 * @returns The path, or undefined when the reference cannot be resolved
 */
function resolvePath(from: string, reference: string): { path: string; fragment: string } | undefined {
    try {
        const resolved = new URL(reference, new URL(from, PATH_BASE));
        return { path: decodeURIComponent(resolved.pathname.slice(1)), fragment: resolved.hash };
    } catch {
        return undefined;
    }
}
