/**
 * vendor-edicuatex
 *
 * Regenerates the vendored EdiCuaTeX editor at public/app/common/edicuatex/ from
 * the pinned `edicuatex` npm package.
 *
 * The tree is not committed: it is generated into a gitignored path as the first
 * step of build:all, like every other artefact this repo builds into public/. The
 * static PWA build, the Electron app and offline installations all need the editor
 * on disk with no network, and they get it from that build.
 *
 * It used to be copied by hand, and that is exactly how it drifted: within a single
 * day the copy here and the upstream source disagreed on which MathJax components to
 * load, and the accessibility fix that closed the gap arrived through a code review
 * instead of a version bump. Deriving the tree from one pinned package removes the
 * second copy that could disagree.
 *
 *   bun scripts/vendor-edicuatex.ts            # rewrite the tree
 *   bun scripts/vendor-edicuatex.ts --check    # fail if the tree has drifted
 *
 * --check verifies a build rather than a checkout: it catches a tree left stale by an
 * interrupted build, which is why the Dockerfile runs it as a build assertion.
 *
 * The planning, copying and drift detection are shared with scripts/vendor-sirena.ts
 * and live in scripts/vendor-package.ts; this file only says what EdiCuaTeX ships.
 */

import path from 'node:path';
import {
    type CliIo,
    buildVendorPlan as buildPackagePlan,
    detectDrift,
    resolvePaths as resolvePackagePaths,
    run as runPackage,
    type VendorDrift,
    type VendoredPackage,
    type VendorPlanEntry,
    writeVendoredTree,
} from './vendor-package';

export { type CliIo, detectDrift, type VendorDrift, type VendorPlanEntry, writeVendoredTree };

/**
 * Directories copied wholesale from the package.
 *
 * `menus/vendor/` comes along: since 1.5.2 the editor serves Tailwind and SortableJS
 * from the package instead of a CDN, which is what makes it work offline and under a
 * restrictive CSP -- the same reason the MathJax font ranges are vendored next door.
 */
const VENDORED_DIRECTORIES = ['css', 'icons', 'js', 'lang', 'menus'] as const;

/**
 * Individual files copied from the package root.
 *
 * `LICENSE.txt` is not optional: the static build's pruner refuses to remove any
 * path containing "license", and an editor shipped without its licence would be a
 * distribution problem rather than a size one.
 *
 * Left out: `package.json`, `scripts/` and `tailwind.config.js`, which build the
 * package rather than run in it, and the two READMEs, which document the standalone
 * project. Nothing here loads them.
 */
const VENDORED_FILES = ['index.html', 'favicon.svg', 'LICENSE.txt'] as const;

export const EDICUATEX: VendoredPackage = {
    packageName: 'edicuatex',
    targetDirectory: 'edicuatex',
    directories: VENDORED_DIRECTORIES,
    files: VENDORED_FILES,
    regenerateWith: 'make vendor-edicuatex',
};

/**
 * Builds the list of files the vendored tree must contain, sorted by path.
 * Pure -- takes the package root, touches nothing else.
 */
export function buildVendorPlan(packageRoot: string): VendorPlanEntry[] {
    return buildPackagePlan(EDICUATEX, packageRoot);
}

export function resolvePaths(repoRoot: string): { packageRoot: string; targetRoot: string } {
    return resolvePackagePaths(EDICUATEX, repoRoot);
}

/** Runs the command and returns the process exit code. */
export function run(argv: string[], repoRoot: string, io?: CliIo): number {
    return runPackage(EDICUATEX, argv, repoRoot, io);
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
