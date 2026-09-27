/**
 * Tests for copy-vendor-libs.js
 *
 * Verifies the vendor-copy step that turns gitignored npm distributions into
 * the files served from public/. Regressions here ship a build that is missing
 * (or stale on) a runtime-loaded vendor file — e.g. the rubric html2canvas copy
 * that public/app/yjs/YjsProjectBridge.js loads at runtime.
 */

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import * as os from 'os';
import * as path from 'path';

// Require fs the same way the script under test does, so spyOn targets the
// exact binding copy-vendor-libs.js calls (the ESM `fs` namespace is a separate
// view and would not intercept the CommonJS script's fs.mkdirSync call).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const copyVendor = require('./copy-vendor-libs.js');

const projectRoot = path.resolve(__dirname, '..');

type Copy = { src: string; dest: string; stripSourceMap?: boolean };
const COPIES: Copy[] = copyVendor.COPIES;

afterEach(() => {
    // Keep the per-directory cache clean between tests.
    copyVendor.resetCreatedDirs();
});

describe('copy-vendor-libs', () => {
    describe('COPIES table', () => {
        it('lists at least one entry', () => {
            expect(Array.isArray(COPIES)).toBe(true);
            expect(COPIES.length).toBeGreaterThan(0);
        });

        it('includes the rubric html2canvas copy loaded at runtime by YjsProjectBridge.js', () => {
            // YjsProjectBridge.js / rubric.js load
            // /files/perm/idevices/base/rubric/export/html2canvas.js at runtime.
            // That file is gitignored, so it MUST be produced here or the build
            // ships without it (or with a stale tracked copy).
            const dests = COPIES.map(c => c.dest);
            const rubricCopy = dests.find(d =>
                d.replace(/\\/g, '/').endsWith('files/perm/idevices/base/rubric/export/html2canvas.js'),
            );
            expect(rubricCopy).toBeDefined();
        });

        it('copies all three html2canvas iDevice destinations from the npm package', () => {
            const html2canvasCopies = COPIES.filter(c =>
                c.src.replace(/\\/g, '/').endsWith('html2canvas/dist/html2canvas.min.js'),
            );
            const dests = html2canvasCopies.map(c => c.dest.replace(/\\/g, '/'));
            expect(html2canvasCopies.length).toBe(3);
            expect(dests.some(d => d.endsWith('progress-report/export/html2canvas.js'))).toBe(true);
            expect(dests.some(d => d.endsWith('checklist/export/html2canvas.js'))).toBe(true);
            expect(dests.some(d => d.endsWith('rubric/export/html2canvas.js'))).toBe(true);
        });

        it('copies model-viewer and its local Draco/KTX2 decoders into the 3D viewer iDevice', () => {
            const exportDir = 'files/perm/idevices/base/three-d-viewer/export/';
            const dests = COPIES.map(c => c.dest.replace(/\\/g, '/'));
            const modelViewer = COPIES[dests.findIndex(d => d.endsWith(`${exportDir}model-viewer.min.js`))];
            // The UMD build defines window.ModelViewerElement, which model-viewer-decoders.js hooks.
            expect(modelViewer?.src.replace(/\\/g, '/')).toEndWith('@google/model-viewer/dist/model-viewer-umd.min.js');
            expect(modelViewer?.stripSourceMap).toBe(true);
            for (const file of [
                'draco/draco_wasm_wrapper.js',
                'draco/draco_decoder.wasm',
                'basis/basis_transcoder.js',
                'basis/basis_transcoder.wasm',
            ]) {
                expect(
                    dests.some(d => d.endsWith(exportDir + file)),
                    file,
                ).toBe(true);
            }
        });

        // (c) every COPIES src path resolves after install
        it('resolves every source path (run `bun install` first)', () => {
            const missing = COPIES.filter(c => !fs.existsSync(c.src)).map(c => path.relative(projectRoot, c.src));
            expect(missing).toEqual([]);
        });

        it('never overwrites the eXe-patched SimpleLightbox fork of the image-gallery iDevice', () => {
            // image-gallery/export/simple-lightbox.min.{js,css} is a locally patched
            // SimpleLightbox 2.10.3 tracked in git. An npm copy here would replace it
            // with upstream and drop the author/license captions.
            const dests = COPIES.map(c => c.dest.replace(/\\/g, '/'));
            expect(dests.filter(d => d.includes('simple-lightbox'))).toEqual([]);
        });

        it('strips sourceMappingURL from the Bootstrap dist copies exports actually load', () => {
            const stripped = COPIES.filter(c => c.stripSourceMap).map(c => c.dest.replace(/\\/g, '/'));
            expect(stripped.some(d => d.endsWith('libs/bootstrap/bootstrap.bundle.min.js'))).toBe(true);
            expect(stripped.some(d => d.endsWith('libs/bootstrap/bootstrap.min.css'))).toBe(true);
            expect(stripped.some(d => d.endsWith('.map'))).toBe(false);
        });
    });

    describe('copyFile', () => {
        // (a) a missing source triggers the error path
        it('throws when the source file does not exist', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-vendor-'));
            try {
                const src = path.join(tmpDir, 'does-not-exist.js');
                const dest = path.join(tmpDir, 'out', 'copy.js');
                expect(() => copyVendor.copyFile(src, dest)).toThrow(/could not copy/);
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        // (b) destination dirs are created once each (createdDirs cache)
        it('creates each destination directory exactly once via the createdDirs cache', () => {
            copyVendor.resetCreatedDirs();
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-vendor-'));
            try {
                const src = path.join(tmpDir, 'source.js');
                fs.writeFileSync(src, '// vendor');

                const destDir = path.join(tmpDir, 'nested', 'libs');
                const destA = path.join(destDir, 'a.js');
                const destB = path.join(destDir, 'b.js');

                const mkdirSpy = spyOn(fs, 'mkdirSync');
                let mkdirCalls: number;
                try {
                    copyVendor.copyFile(src, destA);
                    copyVendor.copyFile(src, destB);
                    // Capture the count BEFORE mockRestore (which clears call history).
                    mkdirCalls = mkdirSpy.mock.calls.length;
                } finally {
                    mkdirSpy.mockRestore();
                }

                // Same destination directory -> only one mkdir despite two copies.
                expect(mkdirCalls).toBe(1);
                expect(fs.existsSync(destA)).toBe(true);
                expect(fs.existsSync(destB)).toBe(true);
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        it('strips sourceMappingURL when stripSourceMap is set', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-vendor-strip-'));
            try {
                const src = path.join(tmpDir, 'bootstrap.bundle.min.js');
                fs.writeFileSync(src, '!function(){}();\n//# sourceMappingURL=bootstrap.bundle.min.js.map\n');
                const dest = path.join(tmpDir, 'out', 'bootstrap.bundle.min.js');
                copyVendor.copyFile(src, dest, { stripSourceMap: true });
                expect(fs.readFileSync(dest, 'utf8')).not.toContain('sourceMappingURL');
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });
});
