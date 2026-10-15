/**
 * The FileSaver vendoring contract.
 *
 * What matters: the version is pinned exactly rather than by range, the bytes on disk are
 * the ones the pinned package builds, the source-map announcement is gone because the map
 * is not shipped, and drift in either direction is reported instead of absorbed.
 */
import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {
    PINNED_VERSION,
    resolvePaths,
    run,
    sha256,
    SOURCE_SHA256,
    stripSourceMapComment,
    VENDORED_FILE,
    VENDORED_SHA256,
    type CliIo,
} from './vendor-filesaver';

const repoRoot = path.resolve(import.meta.dir, '..');

function collectIo(): CliIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, log: m => out.push(m), error: m => err.push(m) };
}

describe('vendor-filesaver', () => {
    it('pins an exact version rather than a range', () => {
        expect(PINNED_VERSION).toMatch(/^\d+\.\d+\.\d+$/);

        const declared = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
        // Tooling only: the browser loads the vendored file, so the package must not be a
        // runtime dependency, and the spec must not carry ^ or ~.
        expect(declared.devDependencies['file-saver']).toBe(PINNED_VERSION);
        expect(declared.dependencies?.['file-saver']).toBeUndefined();
    });

    it('vendors the file the editor loads, and only that file', () => {
        expect(VENDORED_FILE.split(path.sep).join('/')).toBe(
            'public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/js/FileSaver.min.js',
        );

        const editorHtml = fs.readFileSync(
            path.join(repoRoot, 'public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor/index.html'),
            'utf8',
        );
        expect(editorHtml).toContain('js/FileSaver.min.js');
    });

    it('matches the pinned package, byte for byte after stripping the source map comment', () => {
        const { sourcePath, targetPath } = resolvePaths(repoRoot);
        if (!fs.existsSync(sourcePath)) {
            // node_modules is not installed; the committed-file check below still applies.
            expect(fs.existsSync(targetPath)).toBe(true);
            return;
        }

        const source = fs.readFileSync(sourcePath);
        expect(sha256(source)).toBe(SOURCE_SHA256);
        expect(sha256(stripSourceMapComment(source))).toBe(VENDORED_SHA256);
    });

    it('is the file currently committed', () => {
        const { targetPath } = resolvePaths(repoRoot);

        expect(sha256(fs.readFileSync(targetPath))).toBe(VENDORED_SHA256);
    });

    it('ships no dangling source map announcement', () => {
        const { targetPath } = resolvePaths(repoRoot);
        const vendored = fs.readFileSync(targetPath, 'utf8');

        // The .map is not vendored, so announcing it would 404 in DevTools -- the same
        // reason the Bootstrap dist files have theirs stripped.
        expect(vendored).not.toContain('sourceMappingURL');
        expect(fs.existsSync(`${targetPath}.map`)).toBe(false);
    });

    it('still exposes saveAs as a global for a plain script tag', () => {
        const { targetPath } = resolvePaths(repoRoot);
        const vendored = fs.readFileSync(targetPath, 'utf8');

        // mindmaps' SaveDocument.js calls window.saveAs(blob, filename); the UMD wrapper
        // assigns it onto the global when there is no module loader.
        expect(vendored).toMatch(/saveAs=/);
    });

    it('leaves the source-map comment alone when there is none', () => {
        const plain = Buffer.from('var a=1;\n');

        expect(stripSourceMapComment(plain).toString()).toBe('var a=1;\n');
    });

    describe('--check', () => {
        it('passes on the committed file', () => {
            const io = collectIo();

            expect(run(['--check'], repoRoot, io)).toBe(0);
            expect(io.err).toEqual([]);
            expect(io.out.join('\n')).toContain(PINNED_VERSION);
        });

        it('fails loudly when the file has been edited, naming how to recover', () => {
            const io = collectIo();
            const scratch = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vendor-filesaver-spec-'));

            try {
                const target = path.join(scratch, VENDORED_FILE);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, 'tampered');

                expect(run(['--check'], scratch, io)).toBe(1);
                expect(io.err.join('\n')).toContain('make vendor-filesaver');
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
        });

        it('fails when the file is absent', () => {
            const io = collectIo();
            const scratch = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'vendor-filesaver-spec-'));

            try {
                expect(run(['--check'], scratch, io)).toBe(1);
                expect(io.err.join('\n')).toContain('missing');
            } finally {
                fs.rmSync(scratch, { recursive: true, force: true });
            }
        });
    });
});
