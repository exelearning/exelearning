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
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

export interface VendorPlanEntry {
    /** Path relative to the vendored root, using POSIX separators. */
    relativePath: string;
    /** Absolute path of the source file inside node_modules. */
    sourcePath: string;
}

function listFilesRecursively(root: string, prefix = ''): string[] {
    const entries = fs.readdirSync(path.join(root, prefix), { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            files.push(...listFilesRecursively(root, relativePath));
        } else {
            files.push(relativePath);
        }
    }
    return files.sort();
}

/**
 * Builds the list of files the vendored tree must contain, sorted by path.
 * Pure -- takes the package root, touches nothing else.
 */
export function buildVendorPlan(packageRoot: string): VendorPlanEntry[] {
    const entries: VendorPlanEntry[] = [];

    for (const file of VENDORED_FILES) {
        entries.push({ relativePath: file, sourcePath: path.join(packageRoot, file) });
    }

    for (const directory of VENDORED_DIRECTORIES) {
        for (const file of listFilesRecursively(path.join(packageRoot, directory))) {
            const relativePath = `${directory}/${file}`;
            entries.push({ relativePath, sourcePath: path.join(packageRoot, directory, ...file.split('/')) });
        }
    }

    return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function sha256(filePath: string): string {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export interface VendorDrift {
    missing: string[];
    extra: string[];
    changed: string[];
}

/** Compares the vendored tree against the plan without writing anything. */
export function detectDrift(plan: VendorPlanEntry[], targetRoot: string): VendorDrift {
    const expected = new Map(plan.map((entry) => [entry.relativePath, entry.sourcePath]));
    const actual = fs.existsSync(targetRoot) ? new Set(listFilesRecursively(targetRoot)) : new Set<string>();

    const missing: string[] = [];
    const changed: string[] = [];
    for (const [relativePath, sourcePath] of expected) {
        if (!actual.has(relativePath)) {
            missing.push(relativePath);
        } else if (sha256(sourcePath) !== sha256(path.join(targetRoot, ...relativePath.split('/')))) {
            changed.push(relativePath);
        }
    }
    const extra = [...actual].filter((relativePath) => !expected.has(relativePath)).sort();

    return { missing: missing.sort(), extra, changed: changed.sort() };
}

/** Writes the plan to disk, removing anything the plan does not list. */
export function writeVendoredTree(plan: VendorPlanEntry[], targetRoot: string): void {
    fs.rmSync(targetRoot, { recursive: true, force: true });
    for (const entry of plan) {
        const destination = path.join(targetRoot, ...entry.relativePath.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(entry.sourcePath, destination);
    }
}

export function resolvePaths(repoRoot: string): { packageRoot: string; targetRoot: string } {
    return {
        packageRoot: path.join(repoRoot, 'node_modules', 'edicuatex'),
        targetRoot: path.join(repoRoot, 'public', 'app', 'common', 'edicuatex'),
    };
}

export interface CliIo {
    log: (message: string) => void;
    error: (message: string) => void;
}

const consoleIo: CliIo = { log: (m) => console.log(m), error: (m) => console.error(m) };

/** Runs the command and returns the process exit code. */
export function run(argv: string[], repoRoot: string, io: CliIo = consoleIo): number {
    const { packageRoot, targetRoot } = resolvePaths(repoRoot);

    if (!fs.existsSync(packageRoot)) {
        io.error('node_modules/edicuatex is missing. Run `make deps` first.');
        return 1;
    }

    const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
    const plan = buildVendorPlan(packageRoot);

    if (argv.includes('--check')) {
        const drift = detectDrift(plan, targetRoot);
        if (drift.missing.length + drift.extra.length + drift.changed.length === 0) {
            io.log(`public/app/common/edicuatex is in sync with edicuatex@${version} (${plan.length} files).`);
            return 0;
        }
        io.error(`public/app/common/edicuatex has drifted from edicuatex@${version}:`);
        for (const file of drift.missing) io.error(`  missing  ${file}`);
        for (const file of drift.extra) io.error(`  extra    ${file}`);
        for (const file of drift.changed) io.error(`  changed  ${file}`);
        io.error('\nRun `make vendor-edicuatex` to regenerate the tree.');
        return 1;
    }

    writeVendoredTree(plan, targetRoot);
    io.log(`Vendored edicuatex@${version} into public/app/common/edicuatex (${plan.length} files).`);
    return 0;
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
