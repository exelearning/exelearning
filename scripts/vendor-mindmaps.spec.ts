/**
 * The vendoring contract, not the plumbing.
 *
 * What matters here is that the provenance record stays trustworthy: it covers exactly
 * what is on disk, it agrees with what the editor iframe actually loads, and it cannot
 * quietly pin a branch instead of a commit. The drift detectors are tested against
 * fixtures rather than the real tree, so a failure names the rule that broke.
 *
 * The runtime bundle now has a contract of its own, so it gets its own block: it is the
 * build output of the pinned revision, both of its hashes are pinned, and no entry is
 * an artefact whose origin is unknown any more.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    countByProvenance,
    isWritable,
    needsBuild,
    LIVE_ASSETS,
    normalizeLineEndings,
    PINNED_REVISION,
    renderFile,
    run,
    sha256,
    SOURCE_REPOSITORY,
    tarballUrl,
    VENDORED,
    VENDORED_ROOT,
    writeWritableFiles,
    type CliIo,
    verifySourceTree,
    verifyVendoredTree,
    type VendoredFile,
} from './vendor-mindmaps';

const repoRoot = path.resolve(import.meta.dir, '..');
const vendoredRoot = path.join(repoRoot, VENDORED_ROOT);

function collectIo(): CliIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, log: m => out.push(m), error: m => err.push(m) };
}

describe('vendor-mindmaps', () => {
    const temporaryRoots: string[] = [];

    function temporaryRoot(): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-mindmaps-spec-'));
        temporaryRoots.push(root);
        return root;
    }

    /** A two-file stand-in for the vendored tree: one we rewrite, one we never do. */
    function fixture(): { sourceRoot: string; vendoredRoot: string; manifest: VendoredFile[] } {
        const sourceRoot = temporaryRoot();
        const targetRoot = temporaryRoot();

        const cssSource = Buffer.from('a {\r\n  color: red;\r\n}\r\n');
        const imageSource = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01]);
        const recompressed = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        // Stands in for the fork's build output, newlines and all.
        const buildOutput = Buffer.from('var a=1;\r\nvar b=2;\r\n');

        fs.mkdirSync(path.join(sourceRoot, 'src', 'css'), { recursive: true });
        fs.writeFileSync(path.join(sourceRoot, 'src', 'css', 'app.css'), cssSource);
        fs.mkdirSync(path.join(sourceRoot, 'src', 'img'), { recursive: true });
        fs.writeFileSync(path.join(sourceRoot, 'src', 'img', 'grid.gif'), imageSource);
        fs.mkdirSync(path.join(sourceRoot, 'dist', 'js'), { recursive: true });
        fs.writeFileSync(path.join(sourceRoot, 'dist', 'js', 'script.js'), buildOutput);

        const manifest: VendoredFile[] = [
            {
                path: 'src/css/app.css',
                provenance: 'copy-lf',
                source: 'src/css/app.css',
                sourceSha256: sha256(cssSource),
                sha256: sha256(normalizeLineEndings(cssSource)),
            },
            {
                path: 'src/img/grid.gif',
                provenance: 'recompressed',
                source: 'src/img/grid.gif',
                sourceSha256: sha256(imageSource),
                sha256: sha256(recompressed),
            },
            {
                path: 'min/js/script.js',
                provenance: 'generated',
                source: 'dist/js/script.js',
                sourceSha256: sha256(buildOutput),
                sha256: sha256(normalizeLineEndings(buildOutput)),
            },
        ];

        fs.mkdirSync(path.join(targetRoot, 'src', 'css'), { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'src', 'css', 'app.css'), normalizeLineEndings(cssSource));
        fs.mkdirSync(path.join(targetRoot, 'src', 'img'), { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'src', 'img', 'grid.gif'), recompressed);
        fs.mkdirSync(path.join(targetRoot, 'min', 'js'), { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'min', 'js', 'script.js'), normalizeLineEndings(buildOutput));

        return { sourceRoot, vendoredRoot: targetRoot, manifest };
    }

    afterEach(() => {
        for (const root of temporaryRoots.splice(0)) {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    describe('the pinned source', () => {
        it('names the eXeLearning maintenance fork', () => {
            expect(SOURCE_REPOSITORY).toBe('exelearning/mindmaps');
        });

        it('pins a full commit SHA rather than a branch', () => {
            // A tag or `main` here would make the vendored tree unreproducible, which is
            // the whole failure this script exists to rule out.
            expect(PINNED_REVISION).toMatch(/^[0-9a-f]{40}$/);
        });

        it('downloads that exact revision', () => {
            expect(tarballUrl()).toBe(`https://codeload.github.com/exelearning/mindmaps/tar.gz/${PINNED_REVISION}`);
            expect(tarballUrl()).not.toContain('main');
        });
    });

    describe('the provenance record', () => {
        it('lists every file in the vendored tree, and no others', () => {
            expect(verifyVendoredTree(vendoredRoot)).toEqual({ missing: [], extra: [], changed: [] });
        });

        it('covers every asset the exemindmap editor iframe loads', () => {
            const recorded = new Set(VENDORED.map(entry => entry.path));
            for (const asset of LIVE_ASSETS) {
                expect(recorded.has(asset), `${asset} is loaded at runtime but has no provenance entry`).toBe(true);
            }
        });

        it('still excludes the development half of the upstream tree', () => {
            // public/app/common/vendored_assets.test.js pins this too; repeating it here
            // keeps a well-meaning refresh from vendoring src/js back in.
            const recorded = VENDORED.map(entry => entry.path);
            for (const gone of [
                'src/js',
                'src/index.html',
                'src/about.html',
                'src/cache.appcache',
                'src/css/about.css',
            ]) {
                expect(
                    recorded.some(p => p === gone || p.startsWith(`${gone}/`)),
                    `${gone} should stay out`,
                ).toBe(false);
            }
        });

        it('records a fork source and a pair of hashes for every file', () => {
            // There is no longer any entry whose origin is unknown. The bundle used to be
            // one -- an opaque artefact with `source: null` that nothing could rebuild.
            for (const entry of VENDORED) {
                expect(entry.source, `${entry.path} has no source`).not.toBeNull();
                expect(entry.sourceSha256, `${entry.path} has no source hash`).toMatch(/^[0-9a-f]{64}$/);
                expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
            }
        });

        it('no longer treats anything as an unreproducible historical artefact', () => {
            expect(VENDORED.every(entry => entry.source !== null)).toBe(true);
            expect(VENDORED.some(entry => (entry.provenance as string) === 'built')).toBe(false);
        });

        it('has no duplicate entries', () => {
            expect(new Set(VENDORED.map(e => e.path)).size).toBe(VENDORED.length);
        });

        it('ships the licence, because mindmaps is AGPL', () => {
            const licence = VENDORED.find(entry => entry.path === 'LICENSE');
            expect(licence?.provenance).toBe('copy');
        });

        it('rewrites everything it can derive, and leaves the recompressed images alone', () => {
            for (const entry of VENDORED) {
                expect(isWritable(entry)).toBe(entry.provenance !== 'recompressed');
            }
            // The images are eXeLearning's own lossless recompression: regenerating them
            // from the fork would undo the size work, so they are verified, never written.
            const counts = countByProvenance();
            expect(counts.generated).toBe(1);
            expect(counts.recompressed).toBeGreaterThan(0);
        });

        it('builds the pinned revision only for the generated bundle', () => {
            const built = VENDORED.filter(needsBuild);

            expect(built.map(entry => entry.path)).toEqual(['min/js/script.js']);
            expect(built[0].source).toBe('dist/js/script.js');
        });
    });

    describe('normalizeLineEndings', () => {
        it('turns CRLF into LF and leaves the rest of the bytes alone', () => {
            expect(normalizeLineEndings(Buffer.from('a\r\nb\n')).toString()).toBe('a\nb\n');
        });

        it('is idempotent, so a refresh cannot keep changing the file', () => {
            const once = normalizeLineEndings(Buffer.from('a\r\nb\r\n'));
            expect(normalizeLineEndings(once).equals(once)).toBe(true);
        });

        it('does not corrupt bytes that merely look like text', () => {
            const binary = Buffer.from([0x89, 0x50, 0x0d, 0x0a, 0xff, 0xfe]);
            // \r\n does collapse, which is exactly why images are never `copy-lf`.
            expect(normalizeLineEndings(binary)).toHaveLength(5);
            expect(
                renderFile(
                    { path: 'x', provenance: 'recompressed', source: 'x', sha256: '', sourceSha256: '' },
                    binary,
                ),
            ).toBeNull();
        });
    });

    describe('drift detection', () => {
        it('reports a file edited by hand', () => {
            const { vendoredRoot: root, manifest } = fixture();
            fs.writeFileSync(path.join(root, 'src', 'css', 'app.css'), 'tampered');

            expect(verifyVendoredTree(root, manifest).changed).toEqual(['src/css/app.css']);
        });

        it('reports a file that disappeared', () => {
            const { vendoredRoot: root, manifest } = fixture();
            fs.rmSync(path.join(root, 'src', 'img', 'grid.gif'));

            expect(verifyVendoredTree(root, manifest).missing).toEqual(['src/img/grid.gif']);
        });

        it('reports a file nobody declared', () => {
            const { vendoredRoot: root, manifest } = fixture();
            fs.writeFileSync(path.join(root, 'src', 'stray.js'), 'x');

            expect(verifyVendoredTree(root, manifest).extra).toEqual(['src/stray.js']);
        });

        it('reports a fork whose contents moved out from under the pin', () => {
            const { sourceRoot, manifest } = fixture();
            fs.writeFileSync(path.join(sourceRoot, 'src', 'css', 'app.css'), 'upstream changed this');

            expect(verifySourceTree(sourceRoot, manifest)).toEqual({ missing: [], changed: ['src/css/app.css'] });
        });

        it('reports a fork that no longer has a file we vendor', () => {
            const { sourceRoot, manifest } = fixture();
            fs.rmSync(path.join(sourceRoot, 'src', 'img', 'grid.gif'));

            expect(verifySourceTree(sourceRoot, manifest).missing).toEqual(['src/img/grid.gif']);
        });
    });

    describe('the generated bundle', () => {
        const bundle = VENDORED.find(entry => entry.path === 'min/js/script.js') as VendoredFile;

        it('is the build output of the pinned revision, recorded by hash', () => {
            // Both hashes are pinned on purpose: sourceSha256 is what `npm run build`
            // must emit, sha256 is what gets committed here. Swapping the bundle for one
            // nobody can rebuild would have to change these lines to pass.
            expect(bundle.sourceSha256).toBe('a3a26210ce5e662136417e436b5e75ba36a80e68bcd0e90f34602d378faedd26');
            expect(bundle.sha256).toBe('3e0a868d17d402559fc0540b72f8a79005697ba4385340642ca99cb61dae18d6');
        });

        it('is the committed file, byte for byte', () => {
            const committed = fs.readFileSync(path.join(vendoredRoot, 'min', 'js', 'script.js'));

            expect(sha256(committed)).toBe(bundle.sha256);
        });

        it('differs from the build output only by newline normalisation', () => {
            // .gitattributes pins *.js to LF here while the fork stores CRLF sources, so
            // the two hashes must differ -- and only for that reason.
            expect(bundle.sourceSha256).not.toBe(bundle.sha256);
            expect(fs.readFileSync(path.join(vendoredRoot, 'min', 'js', 'script.js')).includes(0x0d)).toBe(false);
        });

        it('still carries the translation hooks the editor needs', () => {
            const committed = fs.readFileSync(path.join(vendoredRoot, 'min', 'js', 'script.js'), 'utf8');

            expect(committed).toContain('_("Add")');
            expect(committed).toContain('_("Central Idea")');
            expect(committed).toMatch(/_r\(/);
            // The fallback, so the bundle cannot throw when the host installs no translator.
            expect(committed).toContain('typeof window._r');
        });

        it('carries the four hooks eXeLearning wrapped but never rebuilt', () => {
            // exelearning/mindmaps#3 brought these in. They were added to eXeLearning's
            // source in a87f7b759 and no build ever followed, so this is the first
            // bundle to contain them.
            const committed = fs.readFileSync(path.join(vendoredRoot, 'min', 'js', 'script.js'), 'utf8');

            for (const hook of ['_("Mind map saved")', '_("Warning")', '_("Error")']) {
                expect(committed).toContain(hook);
            }
        });

        it('is reported as drifted when the build output changes', () => {
            const { sourceRoot, manifest } = fixture();
            fs.writeFileSync(path.join(sourceRoot, 'dist', 'js', 'script.js'), 'var a=2;\r\n');

            expect(verifySourceTree(sourceRoot, manifest).changed).toEqual(['dist/js/script.js']);
        });

        it('is reported as drifted when someone edits the vendored copy by hand', () => {
            const { vendoredRoot: root, manifest } = fixture();
            fs.writeFileSync(path.join(root, 'min', 'js', 'script.js'), 'tampered');

            expect(verifyVendoredTree(root, manifest).changed).toEqual(['min/js/script.js']);
        });

        it('is written identically twice, so regenerating leaves no diff', () => {
            const { sourceRoot, vendoredRoot: root, manifest } = fixture();
            const target = path.join(root, 'min', 'js', 'script.js');

            writeWritableFiles(sourceRoot, root, manifest);
            const first = fs.readFileSync(target);
            writeWritableFiles(sourceRoot, root, manifest);
            const second = fs.readFileSync(target);

            expect(second.equals(first)).toBe(true);
            expect(verifyVendoredTree(root, manifest)).toEqual({ missing: [], extra: [], changed: [] });
        });

        it('leaves the recompressed images untouched when regenerating', () => {
            const { sourceRoot, vendoredRoot: root, manifest } = fixture();
            const image = path.join(root, 'src', 'img', 'grid.gif');
            const before = fs.readFileSync(image);

            writeWritableFiles(sourceRoot, root, manifest);

            expect(fs.readFileSync(image).equals(before)).toBe(true);
        });

        it('leaves no temporary build directory behind', () => {
            // Every exit path of the regenerate command removes its work directory; the
            // download, the npm build and the verification all sit inside one try/finally.
            const leftovers = fs
                .readdirSync(os.tmpdir())
                .filter(name => name.startsWith('vendor-mindmaps-') && !name.startsWith('vendor-mindmaps-spec-'));

            expect(leftovers).toEqual([]);
        });
    });

    describe('--check', () => {
        it('passes on the committed tree and says what it verified', () => {
            const io = collectIo();

            expect(run(['--check'], repoRoot, io)).toBe(0);
            expect(io.err).toEqual([]);
            expect(io.out.join('\n')).toContain(PINNED_REVISION.slice(0, 10));
        });

        it('fails loudly, naming the file and how to recover', () => {
            const io = collectIo();
            const brokenRepo = temporaryRoot();
            // A repo whose vendored tree is simply absent: every entry is missing.
            fs.mkdirSync(path.join(brokenRepo, VENDORED_ROOT), { recursive: true });

            expect(run(['--check'], brokenRepo, io)).toBe(1);
            const errors = io.err.join('\n');
            expect(errors).toContain('min/js/script.js');
            expect(errors).toContain('make vendor-mindmaps');
        });
    });
});
