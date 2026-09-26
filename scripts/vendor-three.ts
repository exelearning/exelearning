/**
 * vendor-three
 *
 * Regenerates the Three.js files shipped by the 3D viewer and 360° viewer iDevices
 * from the pinned `three` npm package, so both run the same release.
 *
 * Since r186 the npm package no longer ships minified builds, and r160 already
 * dropped the UMD build and `examples/js`, so the browser files are built here:
 *
 *   three-d-viewer/export/three.module.min.js   ES module, the whole library
 *   three-d-viewer/export/OrbitControls.js      upstream addon, `three` -> ./three.module.min.js
 *   three-d-viewer/export/STLLoader.js          upstream addon, `three` -> ./three.module.min.js
 *   three-sixty-viewer/export/three.min.js      classic script: window.THREE + THREE.OrbitControls
 *
 * The 360° viewer stays a classic script on purpose: it is listed in config.xml
 * export-js and loaded with plain <script> tags, which keeps it independent of
 * module loading (ES modules never load from file://). OrbitControls is bundled
 * into the same file so script order cannot leave THREE.OrbitControls undefined.
 *
 *   bun scripts/vendor-three.ts
 *
 * vendor-three.spec.ts fails when the committed files drift from what this produces.
 */

import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const repoRoot = path.resolve(import.meta.dir, '..');
const idevicesRoot = path.join(repoRoot, 'public/files/perm/idevices/base');

export const THREE_PACKAGE_ROOT = path.join(repoRoot, 'node_modules/three');
export const THREE_D_EXPORT = path.join(idevicesRoot, 'three-d-viewer/export');
export const THREE_SIXTY_EXPORT = path.join(idevicesRoot, 'three-sixty-viewer/export');

/** Upstream addons copied verbatim next to three.module.min.js. */
export const THREE_D_ADDONS: Record<string, string> = {
    'OrbitControls.js': 'examples/jsm/controls/OrbitControls.js',
    'STLLoader.js': 'examples/jsm/loaders/STLLoader.js',
};

/** Points an addon's bare `three` import at the sibling module build. */
export function rewriteAddonImports(source: string): string {
    return source.replace(/from 'three';/g, "from './three.module.min.js';");
}

const ENTRIES = {
    module: "export * from 'three';\n",
    classic:
        "import * as THREE from 'three';\n" +
        "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';\n" +
        'globalThis.THREE = Object.assign({}, THREE, { OrbitControls });\n',
};

export function threeVersion(): string {
    return JSON.parse(fs.readFileSync(path.join(THREE_PACKAGE_ROOT, 'package.json'), 'utf-8')).version;
}

async function bundle(entry: keyof typeof ENTRIES, format: 'esm' | 'iife'): Promise<string> {
    // esbuild (pinned in bun.lock) keeps the output reproducible and the @license comments.
    const result = await build({
        stdin: { contents: ENTRIES[entry], resolveDir: repoRoot },
        bundle: true,
        minify: true,
        format,
        legalComments: 'inline',
        banner: { js: `/*! three.js ${threeVersion()} (MIT), built by scripts/vendor-three.ts */` },
        write: false,
    });
    return result.outputFiles[0].text;
}

/** Every vendored file, keyed by absolute path, as the pinned package produces it. */
export async function buildVendoredFiles(): Promise<Record<string, string>> {
    const files: Record<string, string> = {
        [path.join(THREE_D_EXPORT, 'three.module.min.js')]: await bundle('module', 'esm'),
        [path.join(THREE_SIXTY_EXPORT, 'three.min.js')]: await bundle('classic', 'iife'),
    };
    for (const [name, source] of Object.entries(THREE_D_ADDONS)) {
        const code = fs.readFileSync(path.join(THREE_PACKAGE_ROOT, source), 'utf-8');
        files[path.join(THREE_D_EXPORT, name)] = rewriteAddonImports(code);
    }
    return files;
}

if (import.meta.main) {
    for (const [file, contents] of Object.entries(await buildVendoredFiles())) fs.writeFileSync(file, contents);
    console.log(`Vendored three ${threeVersion()}`);
}
