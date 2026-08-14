/**
 * Static-distribution pruning.
 *
 * The static build copies public/ wholesale, which drags in two kinds of dead
 * weight that only exist for the server runtime or for development:
 *
 *  1. A fixed list of server-only / documentation files (STATIC_ONLY_PRUNE_PATHS),
 *     each with its justification inline. Every listed path MUST exist in the
 *     freshly built dist — a missing entry means the tree moved and the list
 *     is stale, so the build fails loudly instead of silently drifting.
 *
 *  2. The sources of app.bundle.js. bundle:app inlines ~110 files under
 *     public/app into the minified bundle, and the copy step ships those same
 *     files loose next to it (~2 MB that no static page ever loads). The list
 *     is derived from the real esbuild module graph at build time — never
 *     hardcoded — so new imports are picked up automatically. Files that the
 *     static index.html ALSO loads loose (ES-module entry points) are kept
 *     via KEEP_LOOSE_APP_FILES.
 *
 * License and attribution files are never prunable: pruneDistPaths refuses
 * any path containing "license" (any case) and the runtime-fetched
 * libs/README.md + libs/LICENSES.md attribution files are additionally pinned
 * by the spec.
 */

import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

/**
 * Files/directories that exist in public/ for the server runtime or for
 * developers, with no load path in the static distribution.
 */
export const STATIC_ONLY_PRUNE_PATHS: string[] = [
    // Server-rendered admin page assets (views/admin/index.njk); the static
    // build has no admin route.
    'app/admin',
    'libs/chartjs',
    // Server page styling (views/base.njk) and the login background image:
    // the static index never renders body.login-page, so the image referenced
    // from main.css/login.css is never fetched. login.css itself is KEPT —
    // the resource-bundle manifest enumerates public/style/workarea/*.css,
    // and pruning it would leave a dangling contentCss manifest entry.
    'style/server.css',
    'style/workarea/images/exe-login-image.jpg',
    // Test utilities: the copy step excludes dirs named test/spec but not
    // this one.
    'app/test-helpers',
    // Unreferenced anywhere (no script tag, no loader group, no import):
    // consumers guard on the optional global with inline fallbacks.
    'app/workarea/mock-electron-api.js',
    'app/common/logger.js',
    'app/yjs/AssetPriorityQueue.js',
    'app/yjs/YjsProviderFactory.js',
    // Export file formats inline these payloads in src/shared/export
    // (ODE_DTD_CONTENT, EPUB3_MIMETYPE, generateContainerXml); nothing
    // fetches the loose copies.
    'app/schemas',
    // esbuild inputs for the generated libs/yjs/*.min.js shims.
    'libs/yjs/build',
    // Developer documentation (runtime-fetched docs like /CHANGELOG.md,
    // libs/README.md and libs/LICENSES.md are copied individually by
    // run-build.ts and are NOT in this list).
    'app/yjs/INTEGRATION.md',
    'app/common/edicuatex/README.md',
    'app/common/edicuatex/README_es.md',
    'app/common/fix_webm_duration/README.md',
    'app/common/fix_webm_duration/package.json',
    'files/perm/idevices/base/lomloe/README.md',
    'files/perm/idevices/base/lomloe/ES-VC-descriptors-alignment.md',
    'images/logo_readme.png',
];

/**
 * Bundle inputs that must stay loose anyway: the static index.html loads
 * app_common.js as an ES module, which imports app_date_conversion.js.
 */
export const KEEP_LOOSE_APP_FILES = ['app/common/app_common.js', 'app/common/app_date_conversion.js'];

/**
 * Derive the list of public/app sources that are compiled into app.bundle.js,
 * as dist-relative paths ("app/..."), excluding KEEP_LOOSE_APP_FILES.
 *
 * Uses esbuild's metafile over the same entry point bundle:app uses. The
 * graph is resolved from the real sources at build time, so the result
 * follows the code instead of a hardcoded list.
 */
export async function computeBundledAppSources(rootDir: string): Promise<string[]> {
    const entry = path.join(rootDir, 'public/app/app.js');
    const result = await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        metafile: true,
        format: 'iife',
        platform: 'browser',
        logLevel: 'silent',
        // Metafile input keys are cwd-relative; pin them to the repo root so
        // the derivation works no matter where the build was launched from.
        absWorkingDir: rootDir,
    });
    const publicDir = path.join(rootDir, 'public');
    const inputs = Object.keys(result.metafile.inputs)
        .map(input => path.relative(publicDir, path.resolve(rootDir, input)))
        .map(rel => rel.split(path.sep).join('/'))
        .filter(rel => rel.startsWith('app/'));
    // Guard against a broken graph silently pruning nothing (or everything
    // outside app/): the bundle is known to span dozens of modules.
    if (inputs.length < 50 || !inputs.includes('app/app.js')) {
        throw new Error(
            `computeBundledAppSources: implausible bundle graph (${inputs.length} inputs) — refusing to prune`,
        );
    }
    return inputs.filter(rel => !KEEP_LOOSE_APP_FILES.includes(rel)).sort();
}

/**
 * Remove the given dist-relative paths from the output directory.
 * Throws if a path is missing (stale list) or looks like license material.
 */
export function pruneDistPaths(distDir: string, relPaths: string[]): { files: number; bytes: number } {
    let files = 0;
    let bytes = 0;
    for (const rel of relPaths) {
        if (rel.toLowerCase().includes('license') || rel.toLowerCase().includes('licence')) {
            throw new Error(`pruneDistPaths: refusing to prune license material: ${rel}`);
        }
        const abs = path.join(distDir, rel);
        if (!fs.existsSync(abs)) {
            throw new Error(`pruneDistPaths: listed path not found in dist (stale prune list?): ${rel}`);
        }
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
            for (const file of walkFiles(abs)) {
                files += 1;
                bytes += fs.statSync(file).size;
            }
            fs.rmSync(abs, { recursive: true });
        } else {
            files += 1;
            bytes += stat.size;
            fs.unlinkSync(abs);
        }
    }
    return { files, bytes };
}

function walkFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const abs = path.join(dir, entry.name);
        return entry.isDirectory() ? walkFiles(abs) : [abs];
    });
}

/**
 * Remove directories left empty by pruning (depth-first). Returns the number
 * of directories removed. The root itself is never removed.
 */
export function removeEmptyDirs(dir: string): number {
    let removed = 0;
    if (!fs.existsSync(dir)) return removed;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const abs = path.join(dir, entry.name);
        removed += removeEmptyDirs(abs);
        if (fs.readdirSync(abs).length === 0) {
            fs.rmdirSync(abs);
            removed += 1;
        }
    }
    return removed;
}
