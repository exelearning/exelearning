import { prefixPath } from './basepath.util';

/**
 * Rewrite the document-relative asset paths inside the codemagic editor HTML into
 * absolute paths that include BASE_PATH.
 *
 * The codemagic editor is served as a static HTML page whose <link>/<script>/<img>
 * tags reference assets relative to the document (`includes/...`, `images/...`).
 * Behind a reverse proxy that only mounts the BASE_PATH namespace, emitting these as
 * bare-absolute paths (`/api/codemagic-editor/...`) makes the browser resolve them at
 * the origin root, bypassing BASE_PATH, so they 404/502 (see #1802, #1806). Routing
 * the rewrite through prefixPath() keeps them inside the mounted namespace. In flat
 * dev (no BASE_PATH) prefixPath() is a no-op, so the paths stay bare.
 */
export function rewriteCodemagicAssetPaths(html: string): string {
    const base = prefixPath('/api/codemagic-editor');
    return html
        .replace(/src="includes\//g, `src="${base}/includes/`)
        .replace(/href="includes\//g, `href="${base}/includes/`)
        .replace(/src="images\//g, `src="${base}/images/`);
}
