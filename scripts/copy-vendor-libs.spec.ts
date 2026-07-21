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

type Copy = { src: string; dest: string };
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

        // (c) every COPIES src path resolves after install
        it('resolves every source path (run `bun install` first)', () => {
            const missing = COPIES.filter(c => !fs.existsSync(c.src)).map(c => path.relative(projectRoot, c.src));
            expect(missing).toEqual([]);
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
    });

    describe('APPENDS table (local simplelightbox override)', () => {
        type Append = { dest: string; content: string };
        const APPENDS: Append[] = copyVendor.APPENDS;

        it('re-applies the override to both generated simple-lightbox.min.css copies', () => {
            const dests = APPENDS.map(a => a.dest.replace(/\\/g, '/'));
            expect(dests.some(d => d.endsWith('libs/simplelightbox/dist/simple-lightbox.min.css'))).toBe(true);
            expect(
                dests.some(d => d.endsWith('files/perm/idevices/base/image-gallery/export/simple-lightbox.min.css')),
            ).toBe(true);
        });

        it('only appends to files that COPIES also generates', () => {
            const copyDests = new Set(COPIES.map(c => c.dest));
            for (const a of APPENDS) {
                expect(copyDests.has(a.dest)).toBe(true);
            }
        });

        it('carries the SDWEB marker and the recovered override rules', () => {
            for (const a of APPENDS) {
                expect(a.content).toContain('SDWEB');
                expect(a.content).toContain('.sl-wrapper a{color:aqua}');
            }
            expect(copyVendor.SIMPLELIGHTBOX_CSS_OVERRIDE).toContain('padding-right:0');
        });
    });

    describe('appendFile', () => {
        it('appends content to an existing file without truncating it', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-vendor-append-'));
            try {
                const dest = path.join(tmpDir, 'style.min.css');
                fs.writeFileSync(dest, '.base{color:red}');
                copyVendor.appendFile(dest, '\n.override{color:aqua}\n');
                const out = fs.readFileSync(dest, 'utf8');
                expect(out.startsWith('.base{color:red}')).toBe(true);
                expect(out).toContain('.override{color:aqua}');
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        it('throws when the destination cannot be written', () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-vendor-append-'));
            try {
                // Appending to a directory path fails (EISDIR), exercising the error branch.
                expect(() => copyVendor.appendFile(tmpDir, 'x')).toThrow(/could not append/);
            } finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });
});
