/**
 * Remove `sourceMappingURL` announcements from the static distribution.
 *
 * The static build ships no `.map` files, so every `//# sourceMappingURL=…`
 * left in a `.js`/`.css` file is a promise the distribution cannot keep: with
 * DevTools open the browser requests a map that 404s. It costs nothing at
 * runtime (a map is only fetched when DevTools is open) but it pollutes
 * consoles and server logs, and it is exactly the reason jQuery dropped the
 * comment from its distributed minified build in 1.11/2.1.
 *
 * Scope is the dist copy only. The vendored files under `public/` keep their
 * comments and their maps, so server mode and local debugging are untouched —
 * the same "act on dist, never on the sources" rule the rest of the static
 * build follows.
 *
 * This runs as its own pass rather than inside `copyDirRecursive` for two
 * reasons: that helper should keep meaning "copy with exclusions" rather than
 * "copy and rewrite", and the dangling references are not limited to the maps
 * this build excludes — several vendored libraries were committed without
 * their map in the first place and have been announcing a missing file all
 * along, including inside exported packages.
 */

import fs from 'fs';
import path from 'path';

/**
 * Source-map comment matchers, taken verbatim from `convert-source-map` v2.0.0
 * (MIT) — the same pair Babel and istanbul use.
 *
 * The `m` flag is the load-bearing part: in JavaScript `$` without it anchors
 * only to the absolute end of the string, never before a trailing newline, so
 * the obvious hand-rolled `/…sourceMappingURL=[^\r\n]*$/` silently misses every
 * file that ends with a line break — which is most minified bundles.
 *
 * `MAP_FILE_COMMENT` covers both `//` and `/* *\/` styles and the legacy `//@`
 * spelling; `INLINE_COMMENT` covers maps embedded as a `data:` URI.
 */
const MAP_FILE_COMMENT =
    /(?:\/\/[@#][ \t]+?sourceMappingURL=([^\s'"`]+?)[ \t]*?$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*?(?:\*\/){1}[ \t]*?$)/gm;
const INLINE_COMMENT =
    /^\s*?\/[\/*][@#]\s+?sourceMappingURL=data:(((?:application|text)\/json)(?:;charset=([^;,]+?)?)?)?(?:;(base64))?,(.*?)$/gm;

/** File extensions that can carry a source-map comment. */
const REWRITABLE = /\.(?:js|mjs|css)$/;

/**
 * Strip every source-map announcement from a JavaScript or CSS source.
 * Content without one is returned unchanged.
 */
export function stripSourceMappingUrl(content: string): string {
    return content.replace(INLINE_COMMENT, '').replace(MAP_FILE_COMMENT, '');
}

/**
 * Rewrite every `.js`/`.mjs`/`.css` file under `distDir` that announces a
 * source map. Throws if a reference survives the rewrite, so an unforeseen
 * comment shape fails the build loudly instead of shipping a silent 404.
 */
export function stripSourceMapReferences(distDir: string): { files: number; bytes: number } {
    let files = 0;
    let bytes = 0;

    for (const absPath of walkFiles(distDir)) {
        if (!REWRITABLE.test(absPath)) continue;

        const content = fs.readFileSync(absPath, 'utf-8');
        if (!content.includes('sourceMappingURL')) continue;

        const stripped = stripSourceMappingUrl(content);
        if (stripped.includes('sourceMappingURL')) {
            throw new Error(
                `stripSourceMapReferences: reference survived in ${path.relative(distDir, absPath)}. ` +
                    'An unhandled comment shape reached the dist; extend the matchers above.',
            );
        }

        fs.writeFileSync(absPath, stripped);
        files += 1;
        bytes += Buffer.byteLength(content) - Buffer.byteLength(stripped);
    }

    return { files, bytes };
}

function walkFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const absPath = path.join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(absPath) : [absPath];
    });
}
