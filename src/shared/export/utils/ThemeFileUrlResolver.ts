/**
 * ThemeFileUrlResolver
 *
 * Hands a style's own files to a preview as blob URLs, for a style that is not served from
 * anywhere: one the user imported, which is kept with the project rather than on the server.
 *
 * The page refers to the style's files as `theme/<path>`, which resolves to nothing in a preview
 * shown as a blob: document. Each file the page refers to becomes a blob URL of its bytes. A
 * stylesheet is rewritten first, because its own relative `url()` references — backgrounds,
 * fonts — would resolve to nothing from a blob URL either: they are pointed at the blob URLs of
 * the files they name.
 *
 * Files are turned into URLs only when something refers to them, and every URL handed out
 * belongs to this resolver until `dispose()` releases it.
 */

import { getMimeFromExtension } from '../constants';

/** The page's references to the style's files, as the renderer writes them. */
const PAGE_REFERENCE_PATTERN = /(\s(?:src|href)=")theme\/([^"]+)"/g;

/** A stylesheet's references to other files: url(x), url('x') and url("x"). */
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

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
     */
    constructor(files: Map<string, Uint8Array>) {
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
            const url = this.urlFor(path);
            return url ? `${attribute}${url}"` : match;
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
            body = this.rewriteStylesheet(new TextDecoder().decode(data), path);
            this.rewriting.delete(path);
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
        return css.replace(CSS_URL_PATTERN, (match, quote: string, reference: string) => {
            const target = reference.trim();
            if (NOT_RELATIVE.test(target)) return match;

            const path = resolvePath(cssPath, target);
            const url = path === undefined ? undefined : this.urlFor(path);
            return url ? `url(${quote}${url}${quote})` : match;
        });
    }
}

/**
 * Resolve a reference against the file it appears in, as a path inside the style.
 *
 * A query or a fragment is dropped: the style's files are found by their path alone.
 *
 * @returns The path, or undefined when the reference cannot be resolved
 */
function resolvePath(from: string, reference: string): string | undefined {
    try {
        return decodeURIComponent(new URL(reference, new URL(from, PATH_BASE)).pathname.slice(1));
    } catch {
        return undefined;
    }
}
