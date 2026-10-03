/**
 * vendor-sirena
 *
 * Regenerates the vendored Sirena diagram editor at public/app/common/sirena/ from
 * the pinned `sirenaapp` npm package (https://sirenaapp.github.io).
 *
 * Sirena is what the Mermaid button of the TinyMCE editor opens: the diagram is
 * written as code on one side and drawn on the other, and "Insert" writes it back
 * into the iDevice as `<pre class="mermaid">`, the format the button always used.
 * It is vendored the same way as EdiCuaTeX, for the same reasons: the static PWA
 * build, the Electron app and offline installations need it on disk with no
 * network, and deriving the tree from one pinned package leaves no second copy
 * that could drift.
 *
 *   bun scripts/vendor-sirena.ts            # rewrite the tree
 *   bun scripts/vendor-sirena.ts --check    # fail if the tree has drifted
 *
 * The planning, copying and drift detection are shared with
 * scripts/vendor-edicuatex.ts and live in scripts/vendor-package.ts; this file only
 * says what Sirena ships.
 */

import path from 'node:path';
import {
    type CliIo,
    buildVendorPlan as buildPackagePlan,
    resolvePaths as resolvePackagePaths,
    run as runPackage,
    type VendoredPackage,
    type VendorPlanEntry,
} from './vendor-package';

/**
 * Directories copied wholesale from the package.
 *
 * `vendor/` holds the Lucide icon licence. The package brings no Mermaid (since
 * `sirenaapp` 2.0.0): inside eXe, Sirena draws with eXe's own, so there is a
 * single Mermaid version for editing, preview and export. `lang/en.js` carries the
 * interface strings wrapped in `_()`, which is what the translation extraction
 * picks up; inside eXe, Sirena asks `_()` for every string before using its own.
 */
const VENDORED_DIRECTORIES = ['css', 'js', 'lang', 'vendor'] as const;

/**
 * Individual files copied from the package root.
 *
 * Both licences travel with the editor: `LICENSE.txt` for the code (AGPL-3.0-or-later)
 * and `LICENSE-CONTENIDOS` for its texts and examples (CC BY-SA 4.0).
 *
 * Left out: `package.json` and `README.md`, which describe the standalone project.
 * Nothing here loads them.
 */
const VENDORED_FILES = ['index.html', 'favicon.svg', 'LICENSE.txt', 'LICENSE-CONTENIDOS'] as const;

export const SIRENA: VendoredPackage = {
    packageName: 'sirenaapp',
    targetDirectory: 'sirena',
    directories: VENDORED_DIRECTORIES,
    files: VENDORED_FILES,
    regenerateWith: 'make vendor-sirena',
};

/**
 * Builds the list of files the vendored tree must contain, sorted by path.
 * Pure -- takes the package root, touches nothing else.
 */
export function buildVendorPlan(packageRoot: string): VendorPlanEntry[] {
    return buildPackagePlan(SIRENA, packageRoot);
}

export function resolvePaths(repoRoot: string): { packageRoot: string; targetRoot: string } {
    return resolvePackagePaths(SIRENA, repoRoot);
}

/** Runs the command and returns the process exit code. */
export function run(argv: string[], repoRoot: string, io?: CliIo): number {
    return runPackage(SIRENA, argv, repoRoot, io);
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
