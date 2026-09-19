/**
 * vendor-mindmaps
 *
 * Establishes where public/app/common/mindmaps/ comes from, and keeps it honest.
 *
 * mindmaps is David Richard's application (https://github.com/drichard/mindmaps).
 * eXeLearning embeds it in the exemindmap TinyMCE plugin's editor iframe, and takes
 * its maintained copy from the conservative maintenance fork at
 * https://github.com/exelearning/mindmaps -- `master` there mirrors upstream, `main`
 * carries eXeLearning maintenance. Background: drichard/mindmaps#107.
 *
 * The tree is committed, because exports, the static build and Electron all need it
 * on disk with no network. So this script is not part of the normal build: it
 * regenerates that committed tree from one pinned revision, and records what every
 * file in it is.
 *
 *   bun scripts/vendor-mindmaps.ts            # regenerate from the pinned revision
 *   bun scripts/vendor-mindmaps.ts --check    # verify the committed tree (no network)
 *
 * --check is the cheap one and the one CI wants: it recomputes every hash in VENDORED
 * against the working tree, with no network and no build. The default regenerates,
 * which downloads the pinned revision and builds it.
 *
 * The contract for the runtime bundle is:
 *
 *   pinned fork commit + its committed package-lock.json + npm ci + npm run build
 *     = exactly the vendored min/js/script.js
 *
 * Each file declares how it relates to the fork, because not all of them are copies:
 *
 *   copy          byte-for-byte from the fork.
 *   copy-lf       from the fork with CRLF normalised to LF. The fork stores some CSS
 *                 with CRLF; eXeLearning has always shipped it as LF. Normalising is
 *                 declared here rather than left to a .gitattributes accident.
 *   recompressed  an eXeLearning-local lossless recompression of the fork's image
 *                 (#1015, #1908, #2260 shrank the static build and exports). The
 *                 pixels match; the bytes do not. Refresh will not overwrite these,
 *                 but it does verify `sourceSha256`, so if the fork ever changes one
 *                 of these images we find out instead of silently shipping the old
 *                 recompression forever.
 *   generated     min/js/script.js, produced by building the pinned revision with
 *                 `npm ci && npm test && npm run build` and then normalising newlines
 *                 like the other text assets, which .gitattributes requires for .js.
 *                 `npm ci` and not `npm install`: the latter resolves uglify-js past
 *                 the fork's locked 3.3.27 and changes the minified output.
 *
 * That last entry used to read "built", and meant the opposite of what it says now: a
 * historical minified artefact whose sources had been deleted from eXeLearning, so
 * nothing could rebuild it and this script could only pin its hash. The sources were
 * recovered from eXeLearning's own history and now live in the fork
 * (exelearning/mindmaps#2), so the bundle is derived rather than inherited. The
 * artefact it replaces had also been hand-edited after minification, which is why it
 * could never have been reproduced by any build.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The fork, and the exact commit eXeLearning vendors from. Never a branch name. */
export const SOURCE_REPOSITORY = 'exelearning/mindmaps';

/**
 * Pinned to a commit, so the download is immutable and regenerating is reproducible.
 *
 * A branch name would defeat the whole point, and a test asserts the 40-hex shape.
 * Bumping this is how eXeLearning takes a change from the fork: merge it to the fork's
 * `main`, put the resulting commit here, and regenerate.
 *
 * This revision is the fork's `main` after exelearning/mindmaps#2, which restored the
 * eXeLearning-specific mindmaps sources that make the bundle below reproducible.
 */
export const PINNED_REVISION = '5d9db35d3d5cf2dbd04c2addaa974b287c420d70';

/** Where the vendored tree lives, relative to the repository root. */
export const VENDORED_ROOT = path.join('public', 'app', 'common', 'mindmaps');

export type Provenance = 'copy' | 'copy-lf' | 'recompressed' | 'generated';

export interface VendoredFile {
    /** Path inside VENDORED_ROOT, POSIX separators. */
    path: string;
    provenance: Provenance;
    /** Path inside the fork this file comes from, or null when nothing maps to it. */
    source: string | null;
    /** sha256 of the fork's file at PINNED_REVISION. Absent only when source is null. */
    sourceSha256?: string;
    /** sha256 of the committed file here. */
    sha256: string;
}

/**
 * Every file eXeLearning ships from mindmaps, and nothing else.
 *
 * The first five are the live set: the editor iframe loads min/js/script.js plus those
 * four stylesheets, and LICENSE ships because an AGPL application must carry it. The
 * rest are referenced from the CSS. The development half of the upstream tree (src/js,
 * src/index.html, src/about.html, src/cache.appcache, src/css/about.css) is
 * deliberately absent -- see public/app/common/vendored_assets.test.js.
 */
export const VENDORED: readonly VendoredFile[] = [
    {
        path: 'LICENSE',
        provenance: 'copy',
        source: 'LICENSE',
        sourceSha256: '91b65277959ec273763d28ef002e83a6b3fba57c7a35436c9e5b66536333d720',
        sha256: '91b65277959ec273763d28ef002e83a6b3fba57c7a35436c9e5b66536333d720',
    },
    {
        path: 'min/js/script.js',
        provenance: 'generated',
        // Produced by the fork's own Jakefile, which writes dist/js/script.js.
        source: 'dist/js/script.js',
        // The build output as emitted. Verifying this proves the build was reproduced
        // before anything is written, and catches a toolchain that has drifted.
        sourceSha256: '2ef32154b15a3a4267404ff3835bddf39537f5c9d94160f8f453373a5a55f7bf',
        // The same bytes with newlines normalised, which is what ships here.
        sha256: 'd27f2379253300a8593509480809aa895ab840864d5b1eeefa9948c3d589de93',
    },
    {
        path: 'src/css/Aristo/images/bg_fallback.png',
        provenance: 'recompressed',
        source: 'src/css/Aristo/images/bg_fallback.png',
        sourceSha256: '1dd120f7d1847260c637bbdf4351b7112624a72ade8a2c292b81ecfef19f80ca',
        sha256: '2d3da83a0c4f86779868970ae5cea4997134e2570e2e4e1dce61763fa880f6ba',
    },
    {
        path: 'src/css/Aristo/images/icon_sprite.png',
        provenance: 'recompressed',
        source: 'src/css/Aristo/images/icon_sprite.png',
        sourceSha256: '6c6790bc0d3cbd7ab641601afdd959127db01381fdbb442322a1764808c935c6',
        sha256: 'b7a2c383efa4500efb4901dc1e8b963eea8cd7a2b9bd3887720b2807b6609374',
    },
    {
        path: 'src/css/Aristo/images/progress_bar.gif',
        provenance: 'recompressed',
        source: 'src/css/Aristo/images/progress_bar.gif',
        sourceSha256: '6127765ca60a3b1edbf1f38b74cc8047edf5a56d9b5dcb397557e5ba98274896',
        sha256: 'a2ed712d76dcffc7a06918cd389511bca2cf7bb91c12b1d865bf44c7b2c46289',
    },
    {
        path: 'src/css/Aristo/images/slider_handles.png',
        provenance: 'recompressed',
        source: 'src/css/Aristo/images/slider_handles.png',
        sourceSha256: '7cccc7df5771e3dd1ca470b72bd8e5c92ebf659002c01a6948b01aeab733a362',
        sha256: 'c1ea1470b6481092b088d71d76b9ccbed848ca2085027d968371938638ea92e2',
    },
    {
        path: 'src/css/Aristo/images/ui-icons_222222_256x240.png',
        provenance: 'recompressed',
        source: 'src/css/Aristo/images/ui-icons_222222_256x240.png',
        sourceSha256: 'a2ccfdc001858222885a9df39200840ac7a3f479ba889727d32a10398db7918a',
        sha256: '3bf3c80b69008d47a7480e7bf89ff8ff388ffad663f39ebad3d3fe9b51df2b21',
    },
    {
        path: 'src/css/Aristo/images/ui-icons_454545_256x240.png',
        provenance: 'recompressed',
        source: 'src/css/Aristo/images/ui-icons_454545_256x240.png',
        sourceSha256: 'cb36e80beaf2a527d463da552a5c679a46c4ff8c881318a194bb0ccb61cb2d5c',
        sha256: 'c3f55fa4ff1db6c7fd56b4c0f44f4d77c6fe00faf89552642a61fb098e2d2020',
    },
    {
        path: 'src/css/Aristo/jquery-ui-1.8.7.custom.css',
        provenance: 'copy-lf',
        source: 'src/css/Aristo/jquery-ui-1.8.7.custom.css',
        sourceSha256: '77d751610f8d1727dd2413f5484142ef835a95f6e4b6f6fd7032384205f28c9b',
        sha256: '3b308d74d644ec4fbcbcb2ecdfe1cd44346272518a1631da11c1a2815d5f3d16',
    },
    {
        path: 'src/css/app.css',
        provenance: 'copy-lf',
        source: 'src/css/app.css',
        sourceSha256: '8a9fcf93575a6fb2b5b2f2852ad850e0fd85eda9823043a612bc5fcdd0083fa4',
        sha256: '042a96f080b05b2fad4426e780b901554a493e2ecba2e98ce7d7a0329046990c',
    },
    {
        path: 'src/css/common.css',
        provenance: 'copy-lf',
        source: 'src/css/common.css',
        sourceSha256: '356683300c73cdbadc79d647d6c60d8379b73daf4b9b9a152061352a20b4e8e6',
        sha256: '73ec02f1384ef5270c5eaac4d2e9207f9a7520a9a4f159180274b42f176a81ab',
    },
    {
        path: 'src/css/minicolors/images/circle.gif',
        provenance: 'recompressed',
        source: 'src/css/minicolors/images/circle.gif',
        sourceSha256: 'c624c7b31c6f0007f8f302d84445c14ecc907dbac4ac669aab54bb1231227b40',
        sha256: '116cb5a86249b41bb455a8e993b267765a64bcaaed939b09c6607c3ebfa31187',
    },
    {
        path: 'src/css/minicolors/images/gradient.png',
        provenance: 'recompressed',
        source: 'src/css/minicolors/images/gradient.png',
        sourceSha256: '473bc8ca699232bc002945702515df870395a8bb97448954d759a445db459e7c',
        sha256: '237c9dc7e2c61b6f9f9afae6728130e22a74a54cea34e927d30432b537bd1f31',
    },
    {
        path: 'src/css/minicolors/images/line.gif',
        provenance: 'recompressed',
        source: 'src/css/minicolors/images/line.gif',
        sourceSha256: '6cf57ad99fbb92585b31dd1936407973c27f3fe9844cd02297ba5449da46686d',
        sha256: 'c1304c233e90a20a213402b549cbe88de15b65832d9883b365a5b2e0e95bc689',
    },
    {
        path: 'src/css/minicolors/images/rainbow.png',
        provenance: 'recompressed',
        source: 'src/css/minicolors/images/rainbow.png',
        sourceSha256: 'cd5bd8d758a9efca5e176dcdb08965fc1419d49d87c3bfd6038b56e935576058',
        sha256: '92840826c32774242730fb3c01576f77082b7013b86d78ad3c6ae4501ce272b1',
    },
    {
        path: 'src/css/minicolors/images/trigger.png',
        provenance: 'recompressed',
        source: 'src/css/minicolors/images/trigger.png',
        sourceSha256: '9aa01be23bf2286b2fe5fd33140f9a1db6441bf6936b6e69cceb8af242d0fb05',
        sha256: 'ba1b8954265fe16284dc265965f8f547c24631ede3ad22cd70d6b3b067011776',
    },
    {
        path: 'src/css/minicolors/jquery.miniColors.css',
        provenance: 'copy',
        source: 'src/css/minicolors/jquery.miniColors.css',
        sourceSha256: '10605d2fe0dd13da5942c604b461e5f6a3cbb48e4d21bd907ce846747b2380dc',
        sha256: '10605d2fe0dd13da5942c604b461e5f6a3cbb48e4d21bd907ce846747b2380dc',
    },
    {
        path: 'src/img/ajax-loader.gif',
        provenance: 'recompressed',
        source: 'src/img/ajax-loader.gif',
        sourceSha256: 'f6ecff617ec2ba7f559e6f535cad9b70a3f91120737535dab4d4548a6c83576c',
        sha256: 'bbe10e2c8cc41eb0613798530547255880c80d28709cfe19b3a06ffb04f45a08',
    },
    {
        path: 'src/img/closedhand.png',
        provenance: 'recompressed',
        source: 'src/img/closedhand.png',
        sourceSha256: '4dbda38788f30c13c30079eaf55a4c952e9188ae21fe7d4f4ef05460c5b33de2',
        sha256: '2a4f0c3f1cd73f62427841a899a98974c6c7da575832a15580667cb949ff79df',
    },
    {
        path: 'src/img/creator-nub-sprite.png',
        provenance: 'recompressed',
        source: 'src/img/creator-nub-sprite.png',
        sourceSha256: '8bf6883a4cc44367278005340f7909ca81e9f221454a3b7024c7b1b23fa21df6',
        sha256: 'aeddd1e3802e9d569119a5540f0f983f1e2ff2f37dcc144910ebac346acf3f7e',
    },
    {
        path: 'src/img/favicon.png',
        provenance: 'recompressed',
        source: 'src/img/favicon.png',
        sourceSha256: 'a82df30ae87b63faedcb2499e386550a7602b42f85f412009dda36d41a888219',
        sha256: 'e654aee1459e0cf21c017b8ea8ab8ae08c4329e01bf53e56c2a38832edc426c9',
    },
    {
        path: 'src/img/grid.gif',
        provenance: 'recompressed',
        source: 'src/img/grid.gif',
        sourceSha256: '41b87113aecdc0e51c69c88984735ebce03a9754a6262d1d3dd724304b0f0aaf',
        sha256: '9323856e5c690596ab70528c954a2a1874d173e5804e8beca405b228cfb583fd',
    },
    {
        path: 'src/img/openhand.png',
        provenance: 'recompressed',
        source: 'src/img/openhand.png',
        sourceSha256: 'dd901ae268dc46e9b45799195c6f4fe487bc6197a92884d1631113c912b08caf',
        sha256: 'aae4c54e769de4760964709a5951a5aa76f8c7f5c14b8527b360f10d8ca5b4ac',
    },
    {
        path: 'src/img/plus-minus.png',
        provenance: 'recompressed',
        source: 'src/img/plus-minus.png',
        sourceSha256: '86ea79b19c0e8e180b681572f63ed074bc0055411155491ad85c05a5560b3a3e',
        sha256: '97ca0ff6853fcb84f70efcee0ffadc5d3d1de0613efe6b563b25815ff0219ec9',
    },
] as const;

/** Files the exemindmap editor iframe loads directly. Kept in step with vendored_assets.test.js. */
export const LIVE_ASSETS: readonly string[] = [
    'min/js/script.js',
    'src/css/common.css',
    'src/css/app.css',
    'src/css/Aristo/jquery-ui-1.8.7.custom.css',
    'src/css/minicolors/jquery.miniColors.css',
    'LICENSE',
] as const;

export function tarballUrl(revision = PINNED_REVISION): string {
    return `https://codeload.github.com/${SOURCE_REPOSITORY}/tar.gz/${revision}`;
}

export function sha256(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

/**
 * CRLF -> LF, for the `copy-lf` files. Lone CR is left alone: the fork's CSS uses
 * CRLF throughout, and rewriting a bare CR would be a transform nobody asked for.
 */
export function normalizeLineEndings(data: Buffer): Buffer {
    return Buffer.from(data.toString('binary').replace(/\r\n/g, '\n'), 'binary');
}

/** Bytes this file should have, given the fork's bytes. Null for files we do not write. */
export function renderFile(entry: VendoredFile, sourceBytes: Buffer): Buffer | null {
    if (entry.provenance === 'copy') return sourceBytes;
    // The generated bundle is normalised for the same reason the CSS is: .gitattributes
    // pins *.js to LF here, while the fork stores its sources with CRLF.
    if (entry.provenance === 'copy-lf' || entry.provenance === 'generated') return normalizeLineEndings(sourceBytes);
    return null;
}

export function isWritable(entry: VendoredFile): boolean {
    return entry.provenance === 'copy' || entry.provenance === 'copy-lf' || entry.provenance === 'generated';
}

/** True for entries that only exist once the pinned revision has been built. */
export function needsBuild(entry: VendoredFile): boolean {
    return entry.provenance === 'generated';
}

function listFilesRecursively(root: string, prefix = ''): string[] {
    const here = path.join(root, prefix);
    if (!fs.existsSync(here)) return [];
    const files: string[] = [];
    for (const entry of fs.readdirSync(here, { withFileTypes: true })) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) files.push(...listFilesRecursively(root, relativePath));
        else files.push(relativePath);
    }
    return files.sort();
}

export interface TreeDrift {
    missing: string[];
    extra: string[];
    changed: string[];
}

/** Compares the vendored tree against VENDORED. Reads only; no network. */
export function verifyVendoredTree(vendoredRoot: string, manifest: readonly VendoredFile[] = VENDORED): TreeDrift {
    const expected = new Map(manifest.map(entry => [entry.path, entry]));
    const actual = new Set(listFilesRecursively(vendoredRoot));

    const missing: string[] = [];
    const changed: string[] = [];
    for (const [relativePath, entry] of expected) {
        if (!actual.has(relativePath)) {
            missing.push(relativePath);
            continue;
        }
        if (sha256(fs.readFileSync(path.join(vendoredRoot, ...relativePath.split('/')))) !== entry.sha256) {
            changed.push(relativePath);
        }
    }
    const extra = [...actual].filter(relativePath => !expected.has(relativePath)).sort();

    return { missing: missing.sort(), extra, changed: changed.sort() };
}

export interface SourceDrift {
    missing: string[];
    changed: string[];
}

/**
 * Checks the downloaded revision still contains what VENDORED says it does.
 *
 * This runs before anything is written, and a failure here means the manifest and the
 * pin disagree -- so refusing to write is the point: a half-refreshed tree is worse
 * than an unrefreshed one.
 */
export function verifySourceTree(sourceRoot: string, manifest: readonly VendoredFile[] = VENDORED): SourceDrift {
    const missing: string[] = [];
    const changed: string[] = [];
    for (const entry of manifest) {
        if (entry.source === null) continue;
        const sourcePath = path.join(sourceRoot, ...entry.source.split('/'));
        if (!fs.existsSync(sourcePath)) {
            missing.push(entry.source);
            continue;
        }
        if (sha256(fs.readFileSync(sourcePath)) !== entry.sourceSha256) changed.push(entry.source);
    }
    return { missing: missing.sort(), changed: changed.sort() };
}

/**
 * Writes the `copy` and `copy-lf` files. Touches nothing else under the destination,
 * and nothing at all outside it: `recompressed` and `built` files are left exactly as
 * committed, so this never removes the tree it cannot fully rebuild.
 */
export function writeWritableFiles(
    sourceRoot: string,
    vendoredRoot: string,
    manifest: readonly VendoredFile[] = VENDORED,
): string[] {
    const written: string[] = [];
    for (const entry of manifest) {
        if (!isWritable(entry) || entry.source === null) continue;
        const bytes = renderFile(entry, fs.readFileSync(path.join(sourceRoot, ...entry.source.split('/'))));
        if (bytes === null) continue;
        const destination = path.join(vendoredRoot, ...entry.path.split('/'));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, bytes);
        written.push(entry.path);
    }
    return written;
}

export function countByProvenance(manifest: readonly VendoredFile[] = VENDORED): Record<Provenance, number> {
    const counts: Record<Provenance, number> = { copy: 0, 'copy-lf': 0, recompressed: 0, generated: 0 };
    for (const entry of manifest) counts[entry.provenance] += 1;
    return counts;
}

export interface CliIo {
    log: (message: string) => void;
    error: (message: string) => void;
}

const consoleIo: CliIo = { log: m => console.log(m), error: m => console.error(m) };

function reportTreeDrift(drift: TreeDrift, io: CliIo): void {
    for (const file of drift.missing) io.error(`  missing  ${file}`);
    for (const file of drift.extra) io.error(`  extra    ${file}`);
    for (const file of drift.changed) io.error(`  changed  ${file}`);
}

/** Downloads the pinned revision into a fresh temp directory and returns its root. */
function downloadPinnedRevision(io: CliIo): { root: string; cleanup: () => void } {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-mindmaps-'));
    const cleanup = () => fs.rmSync(workDir, { recursive: true, force: true });
    try {
        const url = tarballUrl();
        io.log(`Downloading ${SOURCE_REPOSITORY}@${PINNED_REVISION.slice(0, 10)} ...`);
        // curl over fetch: this is a one-shot developer command, and curl already
        // fails the exit code on a 404, which is what a bad pin looks like.
        execFileSync(
            'curl',
            ['--fail', '--silent', '--show-error', '--location', '--output', path.join(workDir, 'source.tar.gz'), url],
            { stdio: ['ignore', 'ignore', 'inherit'] },
        );
        execFileSync('tar', ['-xzf', path.join(workDir, 'source.tar.gz'), '-C', workDir], {
            stdio: ['ignore', 'ignore', 'inherit'],
        });

        const extracted = fs
            .readdirSync(workDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => e.name);
        if (extracted.length !== 1) {
            throw new Error(
                `expected exactly one directory in the tarball, found ${extracted.length}: ${extracted.join(', ')}`,
            );
        }
        return { root: path.join(workDir, extracted[0]), cleanup };
    } catch (error) {
        cleanup();
        throw error;
    }
}

/**
 * Builds the downloaded revision in place, so `dist/js/script.js` exists.
 *
 * Runs the fork's own documented commands and nothing clever: `npm ci` to honour its
 * committed lockfile, `npm test` because a bundle that fails the fork's own checks has
 * no business shipping here, then `npm run build`. Everything happens inside the
 * throwaway directory the download created -- no node_modules, dist or lockfile is
 * ever written into this repository.
 */
function buildPinnedRevision(sourceRoot: string, io: CliIo): void {
    // `npm ci`, never `npm install`: install would resolve uglify-js past the fork's
    // locked 3.3.27 and silently change the minified output.
    for (const args of [['ci'], ['test'], ['run', 'build']]) {
        io.log(`  npm ${args.join(' ')} ...`);
        execFileSync('npm', args, { cwd: sourceRoot, stdio: ['ignore', 'ignore', 'inherit'] });
    }
}

/** Runs the command and returns the process exit code. */
export function run(argv: string[], repoRoot: string, io: CliIo = consoleIo): number {
    const vendoredRoot = path.join(repoRoot, VENDORED_ROOT);
    const counts = countByProvenance();
    const pinLabel = `${SOURCE_REPOSITORY}@${PINNED_REVISION.slice(0, 10)}`;

    if (argv.includes('--check')) {
        const drift = verifyVendoredTree(vendoredRoot);
        if (drift.missing.length + drift.extra.length + drift.changed.length === 0) {
            io.log(`${VENDORED_ROOT} matches its provenance record (${VENDORED.length} files, pinned to ${pinLabel}).`);
            io.log(
                `  ${counts.generated} generated from source, ${counts.copy} verbatim, ${counts['copy-lf']} newline-normalised, ${counts.recompressed} recompressed here.`,
            );
            return 0;
        }
        io.error(`${VENDORED_ROOT} has drifted from its provenance record:`);
        reportTreeDrift(drift, io);
        io.error('\nIf the change was intended, update VENDORED in scripts/vendor-mindmaps.ts.');
        io.error('Otherwise run `make vendor-mindmaps` to regenerate the tree from the pinned revision.');
        return 1;
    }

    let source: { root: string; cleanup: () => void };
    try {
        source = downloadPinnedRevision(io);
    } catch (error) {
        io.error(`Could not fetch ${tarballUrl()}: ${error instanceof Error ? error.message : String(error)}`);
        io.error('Check network access and that PINNED_REVISION exists in the fork.');
        return 1;
    }

    try {
        // Check the files the tarball already carries before paying for a build, so a
        // stale pin fails in seconds rather than after npm ci.
        const checkedOut = VENDORED.filter(entry => !needsBuild(entry));
        const reportSourceDrift = (drift: SourceDrift): void => {
            io.error(`${pinLabel} does not match what scripts/vendor-mindmaps.ts expects, so nothing was written:`);
            for (const file of drift.missing) io.error(`  missing in fork  ${file}`);
            for (const file of drift.changed) io.error(`  hash mismatch    ${file}`);
            io.error('\nThis means PINNED_REVISION and VENDORED disagree. Update both together.');
        };

        const sourceDrift = verifySourceTree(source.root, checkedOut);
        if (sourceDrift.missing.length + sourceDrift.changed.length > 0) {
            reportSourceDrift(sourceDrift);
            return 1;
        }

        const generated = VENDORED.filter(needsBuild);
        if (generated.length > 0) {
            io.log(`Building ${pinLabel} ...`);
            try {
                buildPinnedRevision(source.root, io);
            } catch (error) {
                io.error(`\nBuilding ${pinLabel} failed: ${error instanceof Error ? error.message : String(error)}`);
                io.error('Nothing was written. npm needs network access for `npm ci`.');
                return 1;
            }

            // The build has to land on the exact bytes recorded here. If it does not,
            // the toolchain moved and the bundle is not the one that was reviewed.
            const buildDrift = verifySourceTree(source.root, generated);
            if (buildDrift.missing.length + buildDrift.changed.length > 0) {
                reportSourceDrift(buildDrift);
                io.error('A hash mismatch here means the build is no longer reproducible.');
                return 1;
            }
        }

        const written = writeWritableFiles(source.root, vendoredRoot);

        const drift = verifyVendoredTree(vendoredRoot);
        if (drift.missing.length + drift.extra.length + drift.changed.length > 0) {
            io.error(`${VENDORED_ROOT} does not match its provenance record after regenerating:`);
            reportTreeDrift(drift, io);
            return 1;
        }

        io.log(`Wrote ${written.length} file(s) in ${VENDORED_ROOT} from ${pinLabel}.`);
        io.log(`  left as committed: ${counts.recompressed} locally recompressed image(s).`);
        return 0;
    } finally {
        // Also runs when a build or a verification failed, so no temporary tree and no
        // downloaded node_modules survives this command.
        source.cleanup();
    }
}

if (import.meta.main) {
    process.exit(run(process.argv.slice(2), path.resolve(import.meta.dir, '..')));
}
