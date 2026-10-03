/**
 * vendor-package
 *
 * Shared machinery for the editors vendored out of a pinned npm package into
 * public/app/common/<name>/: EdiCuaTeX (scripts/vendor-edicuatex.ts) and Sirena
 * (scripts/vendor-sirena.ts). Each script only declares what its package ships;
 * planning, copying, drift detection and the CLI live here, so the two cannot
 * drift apart in how they do it.
 *
 * The trees are not committed: they are generated into gitignored paths as the
 * first step of build:all, like every other artefact this repo builds into
 * public/. The static PWA build, the Electron app and offline installations all
 * need the editors on disk with no network, and they get them from that build.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** What a vendored package ships and where it lands. */
export interface VendoredPackage {
    /** npm package name, which is also its directory under node_modules. */
    packageName: string;
    /** Directory under public/app/common/ the tree is written to. */
    targetDirectory: string;
    /** Directories copied wholesale from the package root. */
    directories: readonly string[];
    /** Individual files copied from the package root. */
    files: readonly string[];
    /** Command that regenerates the tree, quoted in every drift report. */
    regenerateWith: string;
}

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
export function buildVendorPlan(vendored: VendoredPackage, packageRoot: string): VendorPlanEntry[] {
    const entries: VendorPlanEntry[] = [];

    for (const file of vendored.files) {
        entries.push({ relativePath: file, sourcePath: path.join(packageRoot, file) });
    }

    for (const directory of vendored.directories) {
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
    const expected = new Map(plan.map(entry => [entry.relativePath, entry.sourcePath]));
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
    const extra = [...actual].filter(relativePath => !expected.has(relativePath)).sort();

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

export function resolvePaths(vendored: VendoredPackage, repoRoot: string): { packageRoot: string; targetRoot: string } {
    return {
        packageRoot: path.join(repoRoot, 'node_modules', vendored.packageName),
        targetRoot: path.join(repoRoot, 'public', 'app', 'common', vendored.targetDirectory),
    };
}

/**
 * Compares a vendored tree against what its script would write, for the translation
 * extraction (`GENERATED_SOURCE_DIRS` in src/cli/commands/translations.ts).
 *
 * Reuses the script's own plan rather than a second list that could disagree with it.
 * Returns null when the package is not installed at all: there is then no pinned version
 * to compare against, and the non-destructive commands must not start depending on
 * node_modules.
 */
export function inspectVendoredTree(
    vendored: VendoredPackage,
    cwd: string,
): { complete: boolean; detail: string } | null {
    const { packageRoot, targetRoot } = resolvePaths(vendored, cwd);
    if (!fs.existsSync(packageRoot)) {
        return null;
    }

    // `buildVendorPlan` walks the package's own directories, so a half-written package in
    // node_modules -- an interrupted `bun install` -- makes it throw. The tree on disk is
    // then whatever the previous version left, and no comparison can say whether it still
    // matches. That is a *problem*, not an absence of one: `--remove-obsolete` would scan a
    // stale `lang/en.js` and delete every string only the newer package carries. It is
    // reported as `incomplete` rather than swallowed, which warns on `--extract-only` and
    // `translations:sort` (neither of which fails on a warning) and blocks the deletion.
    let drift: VendorDrift;
    try {
        drift = detectDrift(buildVendorPlan(vendored, packageRoot), targetRoot);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { complete: false, detail: `the pinned package could not be read (${reason})` };
    }

    // A file that exists with different content hides strings just as effectively as one that
    // was never written: an older `lang/en.js` is scanned without complaint and the keys only
    // the newer one carries look obsolete. `extra` is deliberately not a trust problem -- a
    // leftover file can only add keys to the scan, never hide one.
    const unusable = [...drift.missing, ...drift.changed].sort();
    if (unusable.length === 0) {
        return { complete: true, detail: `in sync with the pinned ${vendored.packageName} package` };
    }

    const sample = unusable.slice(0, 3).join(', ');
    const rest = unusable.length > 3 ? `, and ${unusable.length - 3} more` : '';
    return { complete: false, detail: `${unusable.length} file(s) out of sync: ${sample}${rest}` };
}

export interface CliIo {
    log: (message: string) => void;
    error: (message: string) => void;
}

const consoleIo: CliIo = { log: m => console.log(m), error: m => console.error(m) };

/** Runs the vendoring command for one package and returns the process exit code. */
export function run(vendored: VendoredPackage, argv: string[], repoRoot: string, io: CliIo = consoleIo): number {
    const { packageRoot, targetRoot } = resolvePaths(vendored, repoRoot);
    const name = vendored.packageName;
    const target = `public/app/common/${vendored.targetDirectory}`;

    if (!fs.existsSync(packageRoot)) {
        io.error(`node_modules/${name} is missing. Run \`make deps\` first.`);
        return 1;
    }

    const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
    const plan = buildVendorPlan(vendored, packageRoot);

    if (argv.includes('--check')) {
        const drift = detectDrift(plan, targetRoot);
        if (drift.missing.length + drift.extra.length + drift.changed.length === 0) {
            io.log(`${target} is in sync with ${name}@${version} (${plan.length} files).`);
            return 0;
        }
        io.error(`${target} has drifted from ${name}@${version}:`);
        for (const file of drift.missing) io.error(`  missing  ${file}`);
        for (const file of drift.extra) io.error(`  extra    ${file}`);
        for (const file of drift.changed) io.error(`  changed  ${file}`);
        io.error(`\nRun \`${vendored.regenerateWith}\` to regenerate the tree.`);
        return 1;
    }

    writeVendoredTree(plan, targetRoot);
    io.log(`Vendored ${name}@${version} into ${target} (${plan.length} files).`);
    return 0;
}
