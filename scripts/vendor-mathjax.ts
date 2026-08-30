/**
 * vendor-mathjax
 *
 * Regenerates the vendored MathJax tree at public/app/common/exe_math/ from the
 * pinned `mathjax` npm package in node_modules.
 *
 * The tree is committed to git because exports, the static PWA build and the
 * Electron app all need MathJax on disk with no network. Hand-copying is what
 * produced issue #2259, where a 3.2.2 combined component was left sitting next
 * to a 4.0.0 accessibility stack: the loader refused the mismatched components
 * and the whole a11y menu died. Deriving the tree from one pinned package makes
 * that state unrepresentable.
 *
 *   bun scripts/vendor-mathjax.ts            # rewrite the tree
 *   bun scripts/vendor-mathjax.ts --check    # fail if the tree has drifted
 *
 * The --check mode backs vendor-mathjax.spec.ts, so CI catches drift.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Speech-rule locales shipped for the expression explorer. */
export const VENDORED_SRE_LOCALES = [
    // Support maps, always needed: base rules, euro number formats, Nemeth braille.
    'base',
    'euro',
    'nemeth',
    // Speech locales. SRE supports af/ca/da/de/en/es/fr/hi/it/ko/nb/nn/sv; we ship the
    // five that overlap eXeLearning's own UI languages. eo/eu/gl/pt/ro/va have no SRE
    // support at all, so there is nothing to ship for them.
    'ca',
    'de',
    'en',
    'es',
    'it',
] as const;

/**
 * Directories copied wholesale from the package.
 *
 * `adaptors/` is deliberately absent: jsdom, linkedom and liteDOM are Node-only
 * DOM adaptors that a browser can never load.
 */
const VENDORED_DIRECTORIES = ['a11y', 'input', 'output', 'ui'] as const;

/**
 * Individual files copied from the package root.
 *
 * Only the `tex-mml-svg` combined component is vendored — it is the single
 * component eXeLearning loads, and in v4 it already bundles core, the SVG
 * output, the contextual menu and the speech/explorer/semantic-enrich
 * accessibility extensions. The other combined components (chtml variants,
 * `-nofont` variants) and the Node entry points are not shipped.
 */
const VENDORED_FILES = ['LICENSE', 'core.js', 'loader.js', 'startup.js', 'tex-mml-svg.js'] as const;

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
 * Pure — takes the package root, touches nothing else.
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

    entries.push({
        relativePath: 'sre/speech-worker.js',
        sourcePath: path.join(packageRoot, 'sre', 'speech-worker.js'),
    });
    for (const locale of VENDORED_SRE_LOCALES) {
        entries.push({
            relativePath: `sre/mathmaps/${locale}.json`,
            sourcePath: path.join(packageRoot, 'sre', 'mathmaps', `${locale}.json`),
        });
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
        packageRoot: path.join(repoRoot, 'node_modules', 'mathjax'),
        targetRoot: path.join(repoRoot, 'public', 'app', 'common', 'exe_math'),
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
        io.error('node_modules/mathjax is missing. Run `make deps` first.');
        return 1;
    }

    const version = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version;
    const plan = buildVendorPlan(packageRoot);

    if (argv.includes('--check')) {
        const drift = detectDrift(plan, targetRoot);
        if (drift.missing.length + drift.extra.length + drift.changed.length === 0) {
            io.log(`public/app/common/exe_math is in sync with mathjax@${version} (${plan.length} files).`);
            return 0;
        }
        io.error(`public/app/common/exe_math has drifted from mathjax@${version}:`);
        for (const file of drift.missing) io.error(`  missing  ${file}`);
        for (const file of drift.extra) io.error(`  extra    ${file}`);
        for (const file of drift.changed) io.error(`  changed  ${file}`);
        io.error('\nRun `make vendor-mathjax` to regenerate the tree.');
        return 1;
    }

    writeVendoredTree(plan, targetRoot);
    io.log(`Vendored mathjax@${version} into public/app/common/exe_math (${plan.length} files).`);
    return 0;
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
