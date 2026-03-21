/**
 * LibraryDetector
 *
 * Detects required JavaScript/CSS libraries by scanning HTML content for patterns.
 * This replicates the behavior of Symfony's ExportXmlUtil::getPathForLibrariesInIdevices()
 * to ensure exports include all necessary libraries based on content patterns.
 *
 * This is a TypeScript port of public/app/yjs/exporters/LibraryDetector.js
 *
 * @example
 * ```typescript
 * const detector = new LibraryDetector();
 * const allHtml = pages.map(p => p.content).join('');
 * const result = detector.detectLibraries(allHtml);
 * // Returns: { libraries: [{ name: 'exe_effects', files: [...] }], files: [...], count: 1 }
 * ```
 */

import type { LibraryPattern, LibraryDetectionResult, LibraryDetectionOptions } from '../interfaces';
import { LIBRARY_PATTERNS, BASE_LIBRARIES, SCORM_LIBRARIES } from '../constants';

/**
 * LibraryDetector class
 * Scans HTML content for patterns that indicate required libraries
 */
export class LibraryDetector {
    // Track which libraries have been detected
    private detectedLibraries: Set<string>;
    // Track unique file paths
    private filesToInclude: Set<string>;
    // Track detected patterns (for directory-based libraries)
    private detectedPatterns: LibraryPattern[];

    constructor() {
        this.detectedLibraries = new Set();
        this.filesToInclude = new Set();
        this.detectedPatterns = [];
    }

    private resetDetection(): void {
        this.detectedLibraries.clear();
        this.filesToInclude.clear();
        this.detectedPatterns = [];
    }

    /**
     * Detect all required libraries by scanning HTML content
     * @param html - HTML content to scan
     * @param options - Detection options
     * @returns Detected libraries info
     */
    detectLibraries(html: string, options: LibraryDetectionOptions = {}): LibraryDetectionResult {
        this.resetDetection();
        this.scanHtmlFragment(html, options);
        return this.finalizeDetection(options);
    }

    /**
     * Detect all required libraries by scanning multiple HTML fragments incrementally.
     * This avoids building one giant concatenated HTML string in memory.
     */
    detectLibrariesFromFragments(
        htmlFragments: Iterable<string | null | undefined>,
        options: LibraryDetectionOptions = {},
    ): LibraryDetectionResult {
        this.resetDetection();
        for (const html of htmlFragments) {
            this.scanHtmlFragment(html, options);
        }
        return this.finalizeDetection(options);
    }

    private scanHtmlFragment(html: string | null | undefined, options: LibraryDetectionOptions): void {
        if (!html || typeof html !== 'string') {
            return;
        }

        for (const lib of LIBRARY_PATTERNS) {
            // Skip MathJax libraries if LaTeX was pre-rendered
            if (options.skipMathJax && (lib.name === 'exe_math' || lib.name === 'exe_math_datagame')) {
                continue;
            }

            if (this._matchesPattern(html, lib)) {
                // Special case: DataGame requires LaTeX check in decrypted content
                if (lib.requiresLatexCheck && !this._hasLatexInDataGame(html)) {
                    continue;
                }
                this._addLibrary(lib);
            }
        }
    }

    private finalizeDetection(options: LibraryDetectionOptions): LibraryDetectionResult {
        // Add accessibility toolbar if requested
        if (options.includeAccessibilityToolbar) {
            const atoolsLib = LIBRARY_PATTERNS.find(l => l.name === 'exe_atools');
            if (atoolsLib) {
                this._addLibrary(atoolsLib);
            }
        }

        // Add MathJax if explicitly requested (regardless of content detection)
        if (options.includeMathJax) {
            const mathLib = LIBRARY_PATTERNS.find(l => l.name === 'exe_math');
            if (mathLib) {
                this._addLibrary(mathLib);
            }
        }

        return this._buildResult();
    }

    /**
     * Check if HTML matches a library pattern
     * @param html - HTML content
     * @param lib - Library pattern definition
     * @returns True if pattern matches
     */
    private _matchesPattern(html: string, lib: LibraryPattern): boolean {
        switch (lib.type) {
            case 'class':
                // Match class="...pattern..." (with possible other classes)
                return new RegExp(`class="[^"]*${this._escapeRegex(lib.pattern as string)}[^"]*"`, 'i').test(html);

            case 'rel':
                // Match rel="...pattern..."
                return new RegExp(`rel="[^"]*${this._escapeRegex(lib.pattern as string)}[^"]*"`, 'i').test(html);

            case 'regex':
                // Use provided regex pattern
                return (lib.pattern as RegExp).test(html);

            default:
                return false;
        }
    }

    /**
     * Check if DataGame content contains LaTeX after decryption
     * @param html - HTML content
     * @returns True if LaTeX is found in decrypted DataGame content
     */
    private _hasLatexInDataGame(html: string): boolean {
        // Extract DataGame div content
        const match = html.match(/<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>(.*?)<\/div>/s);
        if (!match) return false;

        // Decrypt the content (same algorithm as Symfony)
        const decrypted = this._decrypt(match[1]);

        // Check for LaTeX patterns
        return /\\\(|\\\[/.test(decrypted);
    }

    /**
     * Decrypt XOR-encoded string (matches Symfony's decrypt method)
     * @param str - Encrypted string
     * @returns Decrypted string
     */
    private _decrypt(str: string): string {
        if (!str || str === 'undefined' || str === 'null') return '';

        try {
            str = decodeURIComponent(str);
            const key = 146;
            let result = '';
            for (let i = 0; i < str.length; i++) {
                result += String.fromCharCode(key ^ str.charCodeAt(i));
            }
            return result;
        } catch {
            return '';
        }
    }

    /**
     * Add a library and its files to the detected set
     * @param lib - Library pattern
     */
    private _addLibrary(lib: LibraryPattern): void {
        // Avoid duplicates by library name
        if (this.detectedLibraries.has(lib.name)) return;

        this.detectedLibraries.add(lib.name);
        this.detectedPatterns.push(lib);

        // Add all files for this library
        for (const file of lib.files) {
            this.filesToInclude.add(file);
        }
    }

    /**
     * Build the result object
     * @returns Detection result
     */
    private _buildResult(): LibraryDetectionResult {
        const libraries: Array<{ name: string; files: string[] }> = [];

        // Group files by library name
        for (const lib of LIBRARY_PATTERNS) {
            if (this.detectedLibraries.has(lib.name)) {
                libraries.push({
                    name: lib.name,
                    files: lib.files,
                });
            }
        }

        return {
            libraries,
            files: Array.from(this.filesToInclude),
            count: libraries.length,
            patterns: this.detectedPatterns,
        };
    }

    /**
     * Get base libraries (always included)
     * @returns Array of base library file paths
     */
    getBaseLibraries(): string[] {
        return [...BASE_LIBRARIES];
    }

    /**
     * Get SCORM-specific libraries
     * @returns Array of SCORM library file paths
     */
    getScormLibraries(): string[] {
        return [...SCORM_LIBRARIES];
    }

    /**
     * Get all files needed for export (base + detected)
     * @param html - HTML content to scan
     * @param options - Options
     * @returns Array of file paths
     */
    getAllRequiredFiles(html: string, options: LibraryDetectionOptions = {}): string[] {
        return this.getAllRequiredFilesWithPatterns(html, options).files;
    }

    /**
     * Get all files needed for export with pattern information
     * @param html - HTML content to scan
     * @param options - Options
     * @returns Object with files and patterns for directory-based libraries
     */
    getAllRequiredFilesWithPatterns(
        html: string,
        options: LibraryDetectionOptions = {},
    ): { files: string[]; patterns: LibraryPattern[] } {
        const detected = this.detectLibraries(html, options);
        return this.buildRequiredFilesResult(detected, options);
    }

    /**
     * Get all files needed for export with pattern information from HTML fragments.
     * This incremental API avoids concatenating all content into one large string.
     */
    getAllRequiredFilesWithPatternsFromFragments(
        htmlFragments: Iterable<string | null | undefined>,
        options: LibraryDetectionOptions = {},
    ): { files: string[]; patterns: LibraryPattern[] } {
        const detected = this.detectLibrariesFromFragments(htmlFragments, options);
        return this.buildRequiredFilesResult(detected, options);
    }

    private buildRequiredFilesResult(
        detected: LibraryDetectionResult,
        options: LibraryDetectionOptions,
    ): { files: string[]; patterns: LibraryPattern[] } {
        const files = new Set(this.getBaseLibraries());

        // Add detected library files
        for (const file of detected.files) {
            files.add(file);
        }

        // Add SCORM files if requested
        if (options.includeScorm) {
            for (const file of this.getScormLibraries()) {
                files.add(file);
            }
        }

        return {
            files: Array.from(files),
            patterns: detected.patterns,
        };
    }

    /**
     * Group files by type for HTML head generation
     * @param files - Array of file paths
     * @returns Object with js and css arrays
     */
    groupFilesByType(files: string[]): { js: string[]; css: string[] } {
        const js: string[] = [];
        const css: string[] = [];

        for (const file of files) {
            const ext = file.split('.').pop()?.toLowerCase();
            if (ext === 'js') {
                js.push(file);
            } else if (ext === 'css') {
                css.push(file);
            }
        }

        return { js, css };
    }

    /**
     * Escape special regex characters in a string
     * @param str - String to escape
     * @returns Escaped string
     */
    private _escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
