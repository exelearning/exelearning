/**
 * Tests for LibraryDetector
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LibraryDetector } from './LibraryDetector';

describe('LibraryDetector', () => {
    let detector: LibraryDetector;

    beforeEach(() => {
        detector = new LibraryDetector();
    });

    describe('detectLibraries', () => {
        it('should return empty result for empty HTML', () => {
            const result = detector.detectLibraries('');

            expect(result.count).toBe(0);
            expect(result.libraries).toHaveLength(0);
            expect(result.files).toHaveLength(0);
        });

        it('should return empty result for null/undefined', () => {
            expect(detector.detectLibraries(null as unknown as string).count).toBe(0);
            expect(detector.detectLibraries(undefined as unknown as string).count).toBe(0);
        });

        it('should detect exe_effects by class pattern', () => {
            const html = '<div class="exe-fx animated">Content</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_effects');
            expect(result.files).toContain('exe_effects/exe_effects.js');
            expect(result.files).toContain('exe_effects/exe_effects.css');
        });

        it('should detect exe_games by class pattern', () => {
            const html = '<div class="exe-game some-game">Game</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_games');
        });

        it('should detect exe_highlighter by class pattern', () => {
            const html = '<pre class="highlighted-code language-js">code</pre>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_highlighter');
        });

        it('should detect exe_lightbox by rel pattern', () => {
            const html = '<a href="image.jpg" rel="lightbox">Image</a>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_lightbox');
        });

        it('should detect exe_lightbox for galleries', () => {
            const html = '<div class="imageGallery">Gallery</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_lightbox_gallery');
            expect(result.files).toContain('exe_lightbox/exe_lightbox.js');
        });

        it('should detect exe_tooltips by class pattern', () => {
            const html = '<span class="exe-tooltip" title="Tooltip text">Hover</span>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_tooltips');
            expect(result.files).toContain('exe_tooltips/jquery.qtip.min.js');
        });

        it('should detect exe_media by class pattern', () => {
            const html = '<div class="mediaelement">Video player</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_media');
            expect(result.files).toContain('exe_media/exe_media.js');
        });

        it('should detect exe_media_link by regex pattern', () => {
            const html = '<a href="video.mp4" rel="lightbox">Watch</a>';
            const result = detector.detectLibraries(html);

            // Both exe_lightbox and exe_media_link should be detected
            expect(result.libraries.find(l => l.name === 'exe_media_link')).toBeDefined();
        });

        it('should detect exe_math by regex pattern', () => {
            const html = '<p>The formula \\(x^2 + y^2 = z^2\\) is well known.</p>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_math');
            // exe_math is a directory pattern (includes all MathJax files)
            expect(result.files).toContain('exe_math');
            expect(result.patterns.find(p => p.name === 'exe_math')?.isDirectory).toBe(true);
        });

        it('should detect exe_math with display math', () => {
            const html = '<p>\\[E = mc^2\\]</p>';
            const result = detector.detectLibraries(html);

            expect(result.libraries.find(l => l.name === 'exe_math')).toBeDefined();
        });

        it('should detect abcjs by class pattern', () => {
            const html = '<div class="abc-music">X:1\nT:Song</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('abcjs');
        });

        it('should detect mermaid by class pattern', () => {
            const html = '<div class="mermaid">graph TD; A-->B;</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('mermaid');
        });

        it('should detect jquery-ui for ordena iDevice', () => {
            const html = '<div class="ordena-IDevice">Sortable</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
        });

        it('should detect jquery-ui for clasifica iDevice', () => {
            const html = '<div class="clasifica-IDevice">Classify</div>';
            const result = detector.detectLibraries(html);

            expect(result.files).toContain('jquery-ui/jquery-ui.min.js');
        });

        it('should detect multiple libraries', () => {
            const html = `
                <div class="exe-fx animated">Effects</div>
                <pre class="highlighted-code">code</pre>
                <a href="img.jpg" rel="lightbox">Image</a>
            `;
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(3);
            expect(result.libraries.map(l => l.name)).toContain('exe_effects');
            expect(result.libraries.map(l => l.name)).toContain('exe_highlighter');
            expect(result.libraries.map(l => l.name)).toContain('exe_lightbox');
        });

        it('should not duplicate libraries', () => {
            const html = `
                <a href="img1.jpg" rel="lightbox">Image 1</a>
                <a href="img2.jpg" rel="lightbox">Image 2</a>
            `;
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries.filter(l => l.name === 'exe_lightbox')).toHaveLength(1);
        });

        it('should deduplicate files across libraries', () => {
            // exe_lightbox and exe_lightbox_gallery share the same files
            const html = `
                <a href="img.jpg" rel="lightbox">Image</a>
                <div class="imageGallery">Gallery</div>
            `;
            const result = detector.detectLibraries(html);

            // Should have 2 libraries but only 1 set of files (deduplicated)
            expect(result.count).toBe(2);
            const lightboxJsCount = result.files.filter(f => f === 'exe_lightbox/exe_lightbox.js').length;
            expect(lightboxJsCount).toBe(1);
        });

        it('should include accessibility toolbar when requested', () => {
            const html = '<p>Normal content</p>';
            const result = detector.detectLibraries(html, { includeAccessibilityToolbar: true });

            expect(result.libraries.find(l => l.name === 'exe_atools')).toBeDefined();
            expect(result.files).toContain('exe_atools/exe_atools.js');
        });

        it('should mark exe_lightbox with isDirectory=true for full directory export', () => {
            const html = '<a href="image.jpg" rel="lightbox">Image</a>';
            const result = detector.detectLibraries(html);

            const lightboxPattern = result.patterns.find(p => p.name === 'exe_lightbox');
            expect(lightboxPattern).toBeDefined();
            expect(lightboxPattern?.isDirectory).toBe(true);
            // Should still have the main files for HTML references
            expect(result.files).toContain('exe_lightbox/exe_lightbox.js');
            expect(result.files).toContain('exe_lightbox/exe_lightbox.css');
        });

        it('should mark exe_lightbox_gallery with isDirectory=true for full directory export', () => {
            const html = '<div class="imageGallery">Gallery</div>';
            const result = detector.detectLibraries(html);

            const galleryPattern = result.patterns.find(p => p.name === 'exe_lightbox_gallery');
            expect(galleryPattern).toBeDefined();
            expect(galleryPattern?.isDirectory).toBe(true);
        });

        it('should mark exe_atools with isDirectory=true for full directory export', () => {
            const html = '<p>Normal content</p>';
            const result = detector.detectLibraries(html, { includeAccessibilityToolbar: true });

            const atoolsPattern = result.patterns.find(p => p.name === 'exe_atools');
            expect(atoolsPattern).toBeDefined();
            expect(atoolsPattern?.isDirectory).toBe(true);
            // Should still have the main files for HTML references
            expect(result.files).toContain('exe_atools/exe_atools.js');
            expect(result.files).toContain('exe_atools/exe_atools.css');
        });
    });

    describe('getBaseLibraries', () => {
        it('should return base libraries', () => {
            const libs = detector.getBaseLibraries();

            expect(libs).toContain('jquery/jquery.min.js');
            expect(libs).toContain('common.js');
            expect(libs).toContain('common_i18n.js');
            expect(libs).toContain('exe_export.js');
            expect(libs.some(f => f.includes('bootstrap'))).toBe(true);
        });

        it('should return a copy (not modify original)', () => {
            const libs1 = detector.getBaseLibraries();
            libs1.push('new-lib.js');

            const libs2 = detector.getBaseLibraries();
            expect(libs2).not.toContain('new-lib.js');
        });
    });

    describe('getScormLibraries', () => {
        it('should return SCORM libraries', () => {
            const libs = detector.getScormLibraries();

            expect(libs).toContain('scorm/SCORM_API_wrapper.js');
            expect(libs).toContain('scorm/SCOFunctions.js');
        });
    });

    describe('getAllRequiredFiles', () => {
        it('should include base libraries', () => {
            const files = detector.getAllRequiredFiles('');

            expect(files).toContain('jquery/jquery.min.js');
            expect(files).toContain('common.js');
        });

        it('should include detected library files', () => {
            const html = '<div class="exe-fx">Effects</div>';
            const files = detector.getAllRequiredFiles(html);

            expect(files).toContain('exe_effects/exe_effects.js');
            expect(files).toContain('exe_effects/exe_effects.css');
        });

        it('should include SCORM files when requested', () => {
            const files = detector.getAllRequiredFiles('', { includeScorm: true });

            expect(files).toContain('scorm/SCORM_API_wrapper.js');
            expect(files).toContain('scorm/SCOFunctions.js');
        });

        it('should not include SCORM files by default', () => {
            const files = detector.getAllRequiredFiles('');

            expect(files).not.toContain('scorm/SCORM_API_wrapper.js');
        });

        it('should deduplicate files', () => {
            const files = detector.getAllRequiredFiles('');
            const jqueryCount = files.filter(f => f === 'jquery/jquery.min.js').length;

            expect(jqueryCount).toBe(1);
        });
    });

    describe('groupFilesByType', () => {
        it('should group JS and CSS files', () => {
            const files = ['script.js', 'style.css', 'lib.js', 'theme.css'];
            const grouped = detector.groupFilesByType(files);

            expect(grouped.js).toEqual(['script.js', 'lib.js']);
            expect(grouped.css).toEqual(['style.css', 'theme.css']);
        });

        it('should ignore non-js/css files', () => {
            const files = ['image.png', 'data.json', 'script.js'];
            const grouped = detector.groupFilesByType(files);

            expect(grouped.js).toEqual(['script.js']);
            expect(grouped.css).toEqual([]);
        });

        it('should handle empty array', () => {
            const grouped = detector.groupFilesByType([]);

            expect(grouped.js).toEqual([]);
            expect(grouped.css).toEqual([]);
        });
    });

    describe('case insensitivity', () => {
        it('should match class patterns case-insensitively', () => {
            const html = '<div class="EXE-FX">Effects</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_effects');
        });

        it('should match rel patterns case-insensitively', () => {
            const html = '<a href="img.jpg" rel="LIGHTBOX">Image</a>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_lightbox');
        });
    });

    describe('class with multiple values', () => {
        it('should detect pattern in class with multiple values', () => {
            const html = '<div class="container exe-fx animated fade-in">Content</div>';
            const result = detector.detectLibraries(html);

            expect(result.count).toBe(1);
            expect(result.libraries[0].name).toBe('exe_effects');
        });
    });

    describe('DataGame LaTeX detection', () => {
        // Helper to create XOR-encrypted content (matches Symfony/PHP encrypt)
        function encrypt(str: string): string {
            const key = 146;
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(key ^ str.charCodeAt(i));
            }
            return encodeURIComponent(result);
        }

        it('should detect LaTeX in DataGame with inline math', () => {
            // Create encrypted content with LaTeX inline: \(...\)
            const latexContent = 'Question: \\(x^2\\) is a formula';
            const encrypted = encrypt(latexContent);
            const html = `<div class="DataGame">${encrypted}</div>`;

            const result = detector.detectLibraries(html);

            // exe_math_datagame requires LaTeX check - should be detected if LaTeX is found
            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeDefined();
        });

        it('should detect LaTeX in DataGame with display math', () => {
            // Create encrypted content with LaTeX display: \[...\]
            const latexContent = 'Answer: \\[E = mc^2\\]';
            const encrypted = encrypt(latexContent);
            const html = `<div class="DataGame">${encrypted}</div>`;

            const result = detector.detectLibraries(html);

            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeDefined();
        });

        it('should not detect LaTeX when DataGame has no LaTeX content', () => {
            // Create encrypted content without LaTeX
            const normalContent = 'Question: What is 2+2?';
            const encrypted = encrypt(normalContent);
            const html = `<div class="DataGame">${encrypted}</div>`;

            const result = detector.detectLibraries(html);

            // exe_math_datagame should NOT be detected if no LaTeX
            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeUndefined();
        });

        it('should handle DataGame with empty content', () => {
            const html = '<div class="DataGame"></div>';

            const result = detector.detectLibraries(html);

            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeUndefined();
        });

        it('should not crash when DataGame div is not present', () => {
            const html = '<div class="DataGame-container">No actual DataGame div</div>';

            const result = detector.detectLibraries(html);

            // Should not throw, just not detect the library
            expect(result).toBeDefined();
        });

        it('should handle DataGame with invalid encrypted content', () => {
            // Put some content that will fail decodeURIComponent
            const html = '<div class="DataGame">%invalid%url%encoded%</div>';

            const result = detector.detectLibraries(html);

            // Should not throw, gracefully handle the error
            expect(result).toBeDefined();
        });

        it('should handle DataGame with null-like string content', () => {
            const html = '<div class="DataGame">undefined</div>';

            const result = detector.detectLibraries(html);

            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeUndefined();
        });

        it('should handle DataGame with literal null string', () => {
            const html = '<div class="DataGame">null</div>';

            const result = detector.detectLibraries(html);

            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeUndefined();
        });
    });

    describe('includeMathJax option', () => {
        it('should include exe_math when includeMathJax=true even without LaTeX content', () => {
            const html = '<p>No math content here at all</p>';
            const result = detector.detectLibraries(html, { includeMathJax: true });

            expect(result.libraries.some(l => l.name === 'exe_math')).toBe(true);
        });

        it('should include exe_math files when includeMathJax=true', () => {
            const html = '<p>Regular text without any formulas</p>';
            const result = detector.detectLibraries(html, { includeMathJax: true });

            // exe_math uses directory pattern
            expect(result.files.some(f => f.includes('exe_math'))).toBe(true);
        });

        it('should include patterns with isDirectory=true when includeMathJax=true', () => {
            const html = '<p>Regular text</p>';
            const result = detector.detectLibraries(html, { includeMathJax: true });

            const mathPattern = result.patterns.find(p => p.name === 'exe_math');
            expect(mathPattern).toBeDefined();
            expect(mathPattern?.isDirectory).toBe(true);
        });

        it('should work with getAllRequiredFilesWithPatterns when includeMathJax=true', () => {
            const { patterns } = detector.getAllRequiredFilesWithPatterns('<p>No math</p>', {
                includeMathJax: true,
            });

            const mathPattern = patterns.find(p => p.name === 'exe_math');
            expect(mathPattern).toBeDefined();
        });
    });

    describe('skipMathJax option', () => {
        it('should skip exe_math when skipMathJax=true even with LaTeX content', () => {
            const html = '<p>Math expression: \\(x^2 + y^2 = z^2\\)</p>';
            const result = detector.detectLibraries(html, { skipMathJax: true });

            expect(result.libraries.some(l => l.name === 'exe_math')).toBe(false);
        });

        it('should skip exe_math_datagame when skipMathJax=true', () => {
            // Helper to create XOR-encrypted content
            function encrypt(str: string): string {
                const key = 146;
                let result = '';
                for (let i = 0; i < str.length; i++) {
                    result += String.fromCharCode(key ^ str.charCodeAt(i));
                }
                return encodeURIComponent(result);
            }

            const latexContent = 'Question: \\(x^2\\) is a formula';
            const encrypted = encrypt(latexContent);
            const html = `<div class="DataGame">${encrypted}</div>`;

            const result = detector.detectLibraries(html, { skipMathJax: true });

            expect(result.libraries.some(l => l.name === 'exe_math_datagame')).toBe(false);
        });

        it('should NOT skip exe_math_mathml when skipMathJax=true (MathML needs MathJax for accessibility)', () => {
            // MathML content still needs MathJax for accessibility features (context menu, screen reader)
            // skipMathJax only skips LaTeX detection, not pre-rendered MathML
            const html = '<math><mi>x</mi><mo>=</mo><mn>5</mn></math>';
            const result = detector.detectLibraries(html, { skipMathJax: true });

            // exe_math_mathml should still be detected for accessibility
            expect(result.libraries.some(l => l.name === 'exe_math_mathml')).toBe(true);
        });

        it('should not affect other libraries when skipMathJax=true', () => {
            const html = '<div class="exe-fx">Effects</div><p>\\(x\\)</p>';
            const result = detector.detectLibraries(html, { skipMathJax: true });

            // exe_effects should still be detected
            expect(result.libraries.some(l => l.name === 'exe_effects')).toBe(true);
            // exe_math should be skipped
            expect(result.libraries.some(l => l.name === 'exe_math')).toBe(false);
        });
    });

    describe('combined includeMathJax and skipMathJax options', () => {
        it('should respect includeMathJax over skipMathJax when both specified', () => {
            // includeMathJax adds the library explicitly after content detection
            // skipMathJax only affects content detection phase
            const html = '<p>No math</p>';
            const result = detector.detectLibraries(html, {
                includeMathJax: true,
                skipMathJax: true,
            });

            // includeMathJax should still add exe_math
            expect(result.libraries.some(l => l.name === 'exe_math')).toBe(true);
        });

        it('should include exe_math when includeMathJax=true regardless of content', () => {
            const html = '<p>Plain text content without any mathematical expressions</p>';
            const result = detector.detectLibraries(html, {
                includeMathJax: true,
                skipMathJax: false,
            });

            expect(result.libraries.some(l => l.name === 'exe_math')).toBe(true);
        });
    });

    describe('_decrypt edge cases', () => {
        // To test decrypt directly, we can access it via the DataGame detection path
        function encrypt(str: string): string {
            const key = 146;
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(key ^ str.charCodeAt(i));
            }
            return encodeURIComponent(result);
        }

        it('should decrypt XOR-encoded content correctly', () => {
            // XOR encryption/decryption is symmetric
            // If we encrypt "test\\(x\\)" it should decrypt back
            const original = '\\(x^2\\)';
            const encrypted = encrypt(original);
            const html = `<div class="DataGame">${encrypted}</div>`;

            const result = detector.detectLibraries(html);

            // If decryption works, it will find the LaTeX pattern
            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeDefined();
        });

        it('should handle already decoded content', () => {
            // Content that doesn't need decoding (plain text)
            const html = '<div class="DataGame">plain text</div>';

            const result = detector.detectLibraries(html);

            // Should not crash, just not find LaTeX
            expect(result).toBeDefined();
        });

        it('should handle special characters in encrypted content', () => {
            const original = 'Question with \\(\\sum_{i=1}^{n} i\\)';
            const encrypted = encrypt(original);
            const html = `<div class="DataGame">${encrypted}</div>`;

            const result = detector.detectLibraries(html);

            const mathGames = result.libraries.find(l => l.name === 'exe_math_datagame');
            expect(mathGames).toBeDefined();
        });
    });
});
