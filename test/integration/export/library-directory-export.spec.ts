/**
 * Integration tests for library directory export (Issue #904)
 *
 * Tests that when libraries with `isDirectory: true` are detected,
 * ALL files in their directories are exported (fonts, images, sprites),
 * not just the main JS/CSS files.
 *
 * Related libraries:
 * - exe_atools: Accessibility toolbar with font files (.woff, .woff2) and icon (.png)
 * - exe_lightbox: Lightbox with sprite images (.png, .gif)
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
            const atoolsDir = path.join(PUBLIC_DIR, 'app/common/exe_atools');
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

    describe('exe_lightbox directory', () => {
        it('should include all sprite images when exe_lightbox is detected via rel="lightbox"', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses lightbox via rel attribute
            const html = '<a href="image.jpg" rel="lightbox">View image</a>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Should detect exe_lightbox with isDirectory flag
            const lightboxPattern = detection.patterns.find(p => p.name === 'exe_lightbox');
            expect(lightboxPattern).toBeDefined();
            expect(lightboxPattern?.isDirectory).toBe(true);

            // Fetch library files with patterns
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Main files should be included
            expect(files.has('exe_lightbox/exe_lightbox.js')).toBe(true);
            expect(files.has('exe_lightbox/exe_lightbox.css')).toBe(true);

            // Sprite/image files should also be included (referenced from CSS)
            const imageExtensions = ['.png', '.gif'];
            const imageFiles = Array.from(files.keys()).filter(f => imageExtensions.some(ext => f.endsWith(ext)));
            expect(imageFiles.length).toBeGreaterThan(0);
        });

        it('should include all sprite images when exe_lightbox_gallery is detected via imageGallery class', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses lightbox gallery
            const html = '<div class="imageGallery">Gallery content</div>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Should detect exe_lightbox_gallery with isDirectory flag
            const galleryPattern = detection.patterns.find(p => p.name === 'exe_lightbox_gallery');
            expect(galleryPattern).toBeDefined();
            expect(galleryPattern?.isDirectory).toBe(true);

            // Fetch library files with patterns
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Main files should be included (shares files with exe_lightbox)
            expect(files.has('exe_lightbox/exe_lightbox.js')).toBe(true);
            expect(files.has('exe_lightbox/exe_lightbox.css')).toBe(true);

            // Sprite/image files should also be included
            const imageExtensions = ['.png', '.gif'];
            const imageFiles = Array.from(files.keys()).filter(
                f => f.startsWith('exe_lightbox/') && imageExtensions.some(ext => f.endsWith(ext)),
            );
            expect(imageFiles.length).toBeGreaterThan(0);
        });

        it('should include all actual exe_lightbox directory files', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // Get detection for exe_lightbox
            const html = '<a rel="lightbox" href="test.jpg">Image</a>';
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Fetch with patterns
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Read actual directory contents for comparison
            const lightboxDir = path.join(PUBLIC_DIR, 'app/common/exe_lightbox');
            if (await fs.pathExists(lightboxDir)) {
                const actualFiles = await fs.readdir(lightboxDir);
                const nonTestFiles = actualFiles.filter(f => !f.endsWith('.test.js') && !f.endsWith('.spec.js'));

                // All non-test files should be included
                for (const file of nonTestFiles) {
                    const key = `exe_lightbox/${file}`;
                    expect(files.has(key)).toBe(true);
                }
            }
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

            // HTML content that uses both exe_atools and exe_lightbox
            const html = `
                <div class="exe-atools">Toolbar</div>
                <a href="photo.jpg" rel="lightbox">View photo</a>
            `;

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Both should be detected with isDirectory
            const atoolsPattern = detection.patterns.find(p => p.name === 'exe_atools');
            const lightboxPattern = detection.patterns.find(p => p.name === 'exe_lightbox');
            expect(atoolsPattern?.isDirectory).toBe(true);
            expect(lightboxPattern?.isDirectory).toBe(true);

            // Fetch library files
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // Both directories should have their complete contents
            const atoolsFiles = Array.from(files.keys()).filter(f => f.startsWith('exe_atools/'));
            const lightboxFiles = Array.from(files.keys()).filter(f => f.startsWith('exe_lightbox/'));

            // exe_atools should have fonts + js + css + png
            expect(atoolsFiles.length).toBeGreaterThan(2);

            // exe_lightbox should have sprites + js + css
            expect(lightboxFiles.length).toBeGreaterThan(2);
        });
    });

    describe('test files exclusion', () => {
        it('should not include .test.js files in directory export', async () => {
            const provider = new FileSystemResourceProvider(PUBLIC_DIR);

            // HTML content that uses exe_lightbox
            const html = '<a rel="lightbox" href="test.jpg">Image</a>';

            // Detect libraries
            const detector = new LibraryDetector(LIBRARY_PATTERNS);
            const detection = detector.detectLibraries(html);

            // Fetch library files
            const files = await provider.fetchLibraryFiles(detection.files, detection.patterns);

            // No test files should be included
            const testFiles = Array.from(files.keys()).filter(f => f.endsWith('.test.js') || f.endsWith('.spec.js'));
            expect(testFiles.length).toBe(0);
        });
    });
});
