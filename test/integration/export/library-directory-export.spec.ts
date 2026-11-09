/**
 * Integration tests for library directory export (Issue #904)
 *
 * Tests that when libraries with `isDirectory: true` are detected,
 * ALL files in their directories are exported (fonts, images, sprites),
 * not just the main JS/CSS files.
 *
 * Related libraries:
 * - exe_atools: Accessibility toolbar with font files (.woff, .woff2) and icon (.png)
 *
 * exe_lightbox (Tobii + the eXe adapter) has no images any more, so it lists its
 * files explicitly instead.
 */

import { describe, it, expect } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FileSystemResourceProvider } from '../../../src/shared/export/providers/FileSystemResourceProvider';
import { LibraryDetector } from '../../../src/shared/export/utils/LibraryDetector';
import { LIBRARY_PATTERNS } from '../../../src/shared/export/constants';

const PUBLIC_DIR = path.join(__dirname, '../../../public');

describe('Library Directory Export (Issue #904)', () => {
    describe('exe_atools directory', () => {
        it('should include all font files when exe_atools is detected', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses the accessibility toolbar
            const html = '<div class="exe-atools">Accessibility toolbar enabled</div>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Should detect exe_atools with isDirectory flag
            const atoolsPattern = detection.patterns.find(p => p.name === 'exe_atools');
            expect(atoolsPattern).toBeDefined();
            expect(atoolsPattern?.isDirectory).toBe(true);

            // Fetch library files with patterns (this should include entire directory)
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Main files should be included
            expect(files.has('exe_atools/exe_atools.js')).toBe(true);
            expect(files.has('exe_atools/exe_atools.css')).toBe(true);

            // Font files should also be included (referenced from CSS)
            const fontExtensions = ['.woff', '.woff2'];
            const fontFiles = Array.from(files.keys()).filter(f => fontExtensions.some(ext => f.endsWith(ext)));
            expect(fontFiles.length).toBeGreaterThan(0);

            // Icon file should be included
            expect(files.has('exe_atools/exe_atools.png')).toBe(true);
        });

        it('should include all actual exe_atools directory files', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // Get detection for exe_atools
            const html = '<div class="exe-atools">Content</div>';
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Fetch with patterns
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Read actual directory contents for comparison
            const atoolsDir = path.join(PUBLIC_DIR, 'libs/exe_atools');
            if (await fs.pathExists(atoolsDir)) {
                const actualFiles = await fs.readdir(atoolsDir);
                const nonTestFiles = actualFiles.filter(f => !f.endsWith('.test.js') && !f.endsWith('.spec.js'));

                // All non-test files should be included
                for (const file of nonTestFiles) {
                    const key = `exe_atools/${file}`;
                    expect(files.has(key)).toBe(true);
                }
            }
        });
    });

    describe('exe_lightbox (explicit files, no directory)', () => {
        const LIGHTBOX_FILES = [
            'exe_lightbox/tobii.min.js',
            'exe_lightbox/exe_lightbox.js',
            'exe_lightbox/tobii.min.css',
            'exe_lightbox/exe_lightbox.css',
        ];

        it.each([
            ['rel="lightbox" links', '<a href="image.jpg" rel="lightbox">View image</a>', 'exe_lightbox'],
            ['legacy imageGallery galleries', '<div class="imageGallery">Gallery content</div>', 'exe_lightbox_gallery'],
        ])('exports exactly Tobii and the adapter for %s', async (_label, html, name) => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            const pattern = detection.patterns.find(p => p.name === name);
            expect(pattern).toBeDefined();
            expect(pattern?.isDirectory).toBeUndefined();

            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);
            const lightboxFiles = Array.from(files.keys())
                .filter(f => f.startsWith('exe_lightbox/'))
                .sort();
            // Tobii is copied from npm by `bundle:vendor`; the adapter files are tracked.
            expect(lightboxFiles).toEqual([...LIGHTBOX_FILES].sort());
        });
    });

    describe('libraries without isDirectory flag', () => {
        it('should only include specified files for exe_effects (no isDirectory)', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses exe_effects
            const html = '<div class="exe-fx-none">Content with effect</div>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Should detect exe_effects without isDirectory flag
            const effectsPattern = detection.patterns.find(p => p.name === 'exe_effects');
            expect(effectsPattern).toBeDefined();
            expect(effectsPattern?.isDirectory).toBeUndefined();

            // Fetch library files with patterns
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Only the explicitly listed files should be included
            expect(files.has('exe_effects/exe_effects.js')).toBe(true);
            expect(files.has('exe_effects/exe_effects.css')).toBe(true);

            // Check that only these 2 files are included from exe_effects
            const effectsFiles = Array.from(files.keys()).filter(f => f.startsWith('exe_effects/'));
            expect(effectsFiles.length).toBe(2);
        });
    });

    describe('exe_math with isDirectory flag', () => {
        it('should include all MathJax files when exe_math is detected', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses MathJax
            const html = '<span class="exe-math">\\(x^2\\)</span>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Should detect exe_math with isDirectory flag
            const mathPattern = detection.patterns.find(p => p.name === 'exe_math');
            expect(mathPattern).toBeDefined();
            expect(mathPattern?.isDirectory).toBe(true);

            // Fetch library files with patterns
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Main MathJax files should be included
            const mathFiles = Array.from(files.keys()).filter(f => f.startsWith('exe_math/'));

            // exe_math directory should have more than just the 2 main files
            // (it includes MathJax library with many font files)
            expect(mathFiles.length).toBeGreaterThan(2);
        });
    });

    describe('combined detection', () => {
        it('should include all directory files when multiple isDirectory libraries are detected', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses both exe_atools and exe_math (both isDirectory)
            const html = `
                <div class="exe-atools">Toolbar</div>
                <span class="exe-math">\\(x^2\\)</span>
            `;

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html, { includeAccessibilityToolbar: true });

            // Both should be detected with isDirectory
            const atoolsPattern = detection.patterns.find(p => p.name === 'exe_atools');
            const mathPattern = detection.patterns.find(p => p.name === 'exe_math');
            expect(atoolsPattern?.isDirectory).toBe(true);
            expect(mathPattern?.isDirectory).toBe(true);

            // Fetch library files
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Both directories should have their complete contents
            const atoolsFiles = Array.from(files.keys()).filter(f => f.startsWith('exe_atools/'));
            const mathFiles = Array.from(files.keys()).filter(f => f.startsWith('exe_math/'));

            // exe_atools should have fonts + js + css + png
            expect(atoolsFiles.length).toBeGreaterThan(2);

            // exe_math should have the MathJax files, not just js + css
            expect(mathFiles.length).toBeGreaterThan(2);
        });
    });

    describe('test files exclusion', () => {
        it('should not include .test.js files in directory export', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // exe_atools is exported as a directory; exe_lightbox keeps its tests
            // (exe_lightbox.test.js) next to the files it exports.
            const html = '<div class="exe-atools">Toolbar</div><a rel="lightbox" href="test.jpg">Image</a>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html, { includeAccessibilityToolbar: true });

            // Fetch library files
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // No test files should be included
            const testFiles = Array.from(files.keys()).filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js'));
            expect(testFiles.length).toBe(0);
        });
    });
});
