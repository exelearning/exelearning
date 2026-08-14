/**
 * Minify first-party editor JavaScript inside the static distribution.
 *
 * Scope is deliberately narrow:
 *  - only our own code (never vendored trees like exe_math/mermaid/mindmaps/
 *    edicuatex/exe_tooltips/exe_media, and never app/common/scorm, whose two
 *    vendored pipwerks files carry a byte-identity contract);
 *  - only editor-side files that are NOT copied into exported packages
 *    (common.js, common_i18n.js, exe_export.js, xapi and the exe_* library
 *    dirs feed exports, so they are excluded to keep exported packages
 *    byte-identical between server and static modes);
 *  - already-minified artifacts (*.min.js, *.bundle.js) are skipped.
 *
 * Git remains the readable source of truth; only the dist copy is minified
 * (WordPress.org guideline 4 is satisfied by linking the repository from the
 * plugin readme).
 *
 * esbuild's transform API is used per file. Unlike the bundling path it does
 * not rename top-level bindings, which classic scripts rely on for their
 * de-facto globals (e.g. `class AssetManager` + `window.AssetManager`); the
 * spec pins that behavior.
 */

import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

/**
 * Directories (dist-relative) whose own-code .js files are minified.
 * app/common/i18n is deliberately absent: exporters embed
 * common_i18n.<lang>.js into every package as libs/common_i18n.js
 * (ResourceFetcher.fetchI18nFile), so minifying it would break the
 * server/static export byte-identity this module promises.
 */
export const MINIFY_DIRS = ['app/core', 'app/editor', 'app/workarea', 'app/yjs'];

/** Individual editor-only files in app/common that are safe to minify. */
export const MINIFY_FILES = [
    'app/common/app_common.js',
    'app/common/app_date_conversion.js',
    'app/common/asset_url_resolver.js',
    'app/common/common_edition.js',
    'app/common/connectionMonitor.js',
    'app/common/LatexPreRenderer.js',
    'app/common/MermaidPreRenderer.js',
    'app/common/mime-sniff.js',
];

export function isMinifiableJs(relPath: string): boolean {
    if (!relPath.endsWith('.js')) return false;
    if (relPath.endsWith('.min.js') || relPath.endsWith('.bundle.js')) return false;
    if (MINIFY_FILES.includes(relPath)) return true;
    return MINIFY_DIRS.some(dir => relPath.startsWith(`${dir}/`));
}

export async function minifyJsSource(source: string): Promise<string> {
    const result = await esbuild.transform(source, { minify: true });
    // Never let an unexpected esbuild edge case grow a file.
    return result.code.length < source.length ? result.code : source;
}

/**
 * Minify every eligible file under distDir. Every MINIFY_FILES entry must
 * exist (stale-list guard). Returns aggregate before/after sizes.
 */
export async function minifyDistJs(distDir: string): Promise<{ files: number; before: number; after: number }> {
    for (const rel of MINIFY_FILES) {
        if (!fs.existsSync(path.join(distDir, rel))) {
            throw new Error(`minifyDistJs: listed file not found in dist (stale MINIFY_FILES?): ${rel}`);
        }
    }
    let files = 0;
    let before = 0;
    let after = 0;
    for (const abs of walkFiles(distDir)) {
        const rel = path.relative(distDir, abs).split(path.sep).join('/');
        if (!isMinifiableJs(rel)) continue;
        const source = fs.readFileSync(abs, 'utf-8');
        const minified = await minifyJsSource(source);
        fs.writeFileSync(abs, minified);
        files += 1;
        before += Buffer.byteLength(source);
        after += Buffer.byteLength(minified);
    }
    return { files, before, after };
}

function walkFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const abs = path.join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(abs) : [abs];
    });
}
