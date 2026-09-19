/**
 * vendor-filesaver
 *
 * Regenerates public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/js/FileSaver.min.js
 * from the pinned `file-saver` package.
 *
 * The exemindmap editor loads this file with a plain <script> tag, so the browser needs it
 * on disk: exports, the static build, the Electron app and offline installations all run
 * with no network. `file-saver` is therefore a devDependency -- tooling only, pinned to an
 * exact version with no range -- and nothing but this one built file is ever copied out of
 * it. The package itself is not shipped.
 *
 *   bun scripts/vendor-filesaver.ts            # rewrite the vendored file
 *   bun scripts/vendor-filesaver.ts --check    # fail if it has drifted
 *
 * Its only consumer is mindmaps' own SaveDocument.js, which calls
 * `window.saveAs(blob, filename)` when the editor's export dialog saves a map to disk.
 * That call site lives in exelearning/mindmaps, so nothing in this repository's sources
 * mentions FileSaver and a bad bump would break the export silently. The Playwright spec
 * test/e2e/playwright/specs/idevices/mindmap-export.spec.ts exercises the real download.
 *
 * The published `.map` is deliberately not vendored, so the `sourceMappingURL` comment is
 * stripped: a dangling announcement turns every export into a 404 the moment someone
 * opens DevTools, which is the same reason the Bootstrap dist files have theirs removed.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Exact version, never a range: the vendored bytes must be reproducible. */
export const PINNED_VERSION = '2.0.5';

/** The one file taken from the package, and where the editor loads it from. */
export const SOURCE_FILE = path.join('dist', 'FileSaver.min.js');
export const VENDORED_FILE = path.join(
    'public',
    'libs',
    'tinymce_5',
    'js',
    'tinymce',
    'plugins',
    'exemindmap',
    'editor',
    'js',
    'FileSaver.min.js',
);

/** sha256 of the package's own dist/FileSaver.min.js at PINNED_VERSION. */
export const SOURCE_SHA256 = 'c68874cbaa2fd1650b7d770b328680ea765fb3376023cc3608427fde4f0d0481';

/** sha256 of what this script writes: the same bytes with the source-map comment removed. */
export const VENDORED_SHA256 = 'ffe86b04ec39c35ccfb542342797dc4bf1376bf3fffb402b0bae71b99a6a3ad3';

export function sha256(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

/**
 * Removes the trailing `//# sourceMappingURL=` announcement.
 *
 * Only the announcement: the code above it is untouched, and a file that never had one
 * comes back unchanged.
 */
export function stripSourceMapComment(data: Buffer): Buffer {
    return Buffer.from(data.toString('utf8').replace(/\n*\/\/# sourceMappingURL=.*\s*$/, '\n'), 'utf8');
}

export function resolvePaths(repoRoot: string): { sourcePath: string; targetPath: string } {
    return {
        sourcePath: path.join(repoRoot, 'node_modules', 'file-saver', SOURCE_FILE),
        targetPath: path.join(repoRoot, VENDORED_FILE),
    };
}

export interface CliIo {
    log: (message: string) => void;
    error: (message: string) => void;
}

const consoleIo: CliIo = { log: m => console.log(m), error: m => console.error(m) };

/** Runs the command and returns the process exit code. */
export function run(argv: string[], repoRoot: string, io: CliIo = consoleIo): number {
    const { sourcePath, targetPath } = resolvePaths(repoRoot);

    if (argv.includes('--check')) {
        if (!fs.existsSync(targetPath)) {
            io.error(`${VENDORED_FILE} is missing. Run \`make vendor-filesaver\`.`);
            return 1;
        }
        const actual = sha256(fs.readFileSync(targetPath));
        if (actual === VENDORED_SHA256) {
            io.log(`${VENDORED_FILE} matches file-saver@${PINNED_VERSION}.`);
            return 0;
        }
        io.error(`${VENDORED_FILE} has drifted from file-saver@${PINNED_VERSION}:`);
        io.error(`  expected ${VENDORED_SHA256}`);
        io.error(`  found    ${actual}`);
        io.error('\nIf the change was intended, update VENDORED_SHA256 in scripts/vendor-filesaver.ts.');
        io.error('Otherwise run `make vendor-filesaver` to restore it.');
        return 1;
    }

    if (!fs.existsSync(sourcePath)) {
        io.error(`node_modules/file-saver is missing. Run \`make deps\` first.`);
        return 1;
    }

    const installed = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'node_modules', 'file-saver', 'package.json'), 'utf8'),
    ).version;
    if (installed !== PINNED_VERSION) {
        io.error(`file-saver@${installed} is installed but this script is pinned to ${PINNED_VERSION}.`);
        io.error('Update both together, then re-run.');
        return 1;
    }

    // Verify the package's own bytes before deriving anything from them, so a tampered or
    // half-written node_modules cannot be vendored unnoticed.
    const sourceBytes = fs.readFileSync(sourcePath);
    const actualSource = sha256(sourceBytes);
    if (actualSource !== SOURCE_SHA256) {
        io.error(`node_modules/file-saver/${SOURCE_FILE} is not the expected build:`);
        io.error(`  expected ${SOURCE_SHA256}`);
        io.error(`  found    ${actualSource}`);
        io.error('\nNothing was written.');
        return 1;
    }

    const vendored = stripSourceMapComment(sourceBytes);
    const vendoredHash = sha256(vendored);
    if (vendoredHash !== VENDORED_SHA256) {
        io.error(`The file this would write does not match VENDORED_SHA256:`);
        io.error(`  expected ${VENDORED_SHA256}`);
        io.error(`  found    ${vendoredHash}`);
        io.error('\nNothing was written. Update the constant if the transform changed on purpose.');
        return 1;
    }

    fs.writeFileSync(targetPath, vendored);
    io.log(`Vendored file-saver@${PINNED_VERSION} into ${VENDORED_FILE}.`);
    return 0;
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
