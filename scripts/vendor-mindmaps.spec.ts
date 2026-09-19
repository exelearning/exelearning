/**
 * The vendoring contract, not the plumbing.
 *
 * What matters here is that the provenance record stays trustworthy: it covers exactly
 * what is on disk, it agrees with what the editor iframe actually loads, and it cannot
 * quietly pin a branch instead of a commit. The drift detectors are tested against
 * fixtures rather than the real tree, so a failure names the rule that broke.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    countByProvenance,
    isWritable,
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

        fs.mkdirSync(path.join(sourceRoot, 'src', 'css'), { recursive: true });
        fs.writeFileSync(path.join(sourceRoot, 'src', 'css', 'app.css'), cssSource);
        fs.mkdirSync(path.join(sourceRoot, 'src', 'img'), { recursive: true });
        fs.writeFileSync(path.join(sourceRoot, 'src', 'img', 'grid.gif'), imageSource);

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
        ];

        fs.mkdirSync(path.join(targetRoot, 'src', 'css'), { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'src', 'css', 'app.css'), normalizeLineEndings(cssSource));
        fs.mkdirSync(path.join(targetRoot, 'src', 'img'), { recursive: true });
        fs.writeFileSync(path.join(targetRoot, 'src', 'img', 'grid.gif'), recompressed);

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

        it('records a fork source for everything except the patched bundle', () => {
            for (const entry of VENDORED) {
                if (entry.path === 'min/js/script.js') {
                    expect(entry.source).toBeNull();
                    expect(entry.provenance).toBe('built');
                } else {
                    expect(entry.source, `${entry.path} has no source`).not.toBeNull();
                    expect(entry.sourceSha256, `${entry.path} has no source hash`).toMatch(/^[0-9a-f]{64}$/);
                }
                expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
            }
        });

        it('has no duplicate entries', () => {
            expect(new Set(VENDORED.map(e => e.path)).size).toBe(VENDORED.length);
        });

        it('ships the licence, because mindmaps is AGPL', () => {
            const licence = VENDORED.find(entry => entry.path === 'LICENSE');
            expect(licence?.provenance).toBe('copy');
        });

        it('only rewrites files taken from the fork verbatim', () => {
            for (const entry of VENDORED) {
                expect(isWritable(entry)).toBe(entry.provenance === 'copy' || entry.provenance === 'copy-lf');
            }
            // The bundle and the recompressed images are eXeLearning-local derivatives; a
            // refresh that overwrote them would regress localisation and asset size.
            const counts = countByProvenance();
            expect(counts.built).toBe(1);
            expect(counts.recompressed).toBeGreaterThan(0);
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
