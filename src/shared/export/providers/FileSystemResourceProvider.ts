/**
 * FileSystemResourceProvider
 *
 * Backend provider that loads theme, library, and iDevice resources from the filesystem.
 * Used by CLI commands to access resources from the public/ directory.
 *
 * Usage:
 * ```typescript
 * const provider = new FileSystemResourceProvider('/path/to/public');
 * const themeFiles = await provider.fetchTheme('base');
 * const libFiles = await provider.fetchLibraryFiles(['jquery/jquery.min.js']);
 * ```
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { ResourceProvider, LibraryPattern } from '../interfaces';
import { normalizeIdeviceType as normalizeIdeviceTypeFromConstants, LEGACY_IDEVICE_MAPPING } from '../constants';

/**
 * Resource file entry
 */
export interface ResourceFile {
    path: string;
    content: Buffer;
}

/**
 * FileSystemResourceProvider class
 * Implements ResourceProvider for backend/CLI usage
 */
export class FileSystemResourceProvider implements ResourceProvider {
    private publicDir: string;

    /**
     * @param publicDir - Path to the public/ directory containing themes and libs
     */
    constructor(publicDir: string) {
        this.publicDir = publicDir;
    }

    /**
     * Fetch all files for a theme
     * @param themeName - Name of the theme (e.g., 'base', 'intef')
     * @returns Map of file paths to content
     */
    async fetchTheme(themeName: string): Promise<Map<string, Buffer>> {
        // Themes are in public/files/perm/themes/base/{themeName}/
        const themePath = path.join(this.publicDir, 'files', 'perm', 'themes', 'base', themeName);
        // No prefix - files go directly to theme/ folder (prefix added by caller)
        return this.readDirectoryRecursive(themePath, '');
    }

    /**
     * Fetch resources for an iDevice type
     * @param ideviceType - Type of iDevice (e.g., 'FreeTextIdevice', 'text')
     * @returns Map of file paths to content
     */
    async fetchIdeviceResources(ideviceType: string): Promise<Map<string, Buffer>> {
        // iDevices export files are in public/files/perm/idevices/base/{type}/export/
        // First check for legacy iDevice name mapping
        const mappedType = LEGACY_IDEVICE_MAPPING[ideviceType] || ideviceType;
        // Then normalize type name (e.g., 'FreeTextIdevice' -> 'text')
        const typeName = this.normalizeIdeviceType(mappedType);
        const idevicePath = path.join(this.publicDir, 'files', 'perm', 'idevices', 'base', typeName, 'export');
        if (await fs.pathExists(idevicePath)) {
            // No prefix - files go to idevices/{type}/ folder (prefix added by caller)
            const files = await this.readDirectoryRecursive(idevicePath, '');
            // Filter out test files (should not be included in exports)
            for (const filePath of files.keys()) {
                if (filePath.endsWith('.test.js') || filePath.endsWith('.spec.js')) {
                    files.delete(filePath);
                }
            }
            return files;
        }
        return new Map();
    }

    /**
     * Normalize iDevice type name to directory name
     * @param ideviceType - Raw iDevice type name
     * @returns Normalized directory name
     */
    normalizeIdeviceType(ideviceType: string): string {
        // Use centralized mapping from constants.ts
        return normalizeIdeviceTypeFromConstants(ideviceType);
    }

    /**
     * Fetch base libraries (jQuery, Bootstrap, common.js, etc.)
     * @returns Map of file paths to content
     */
    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();

        // Core libraries mapping: source path -> destination path in ZIP
        // Some files are in libs/, others in app/common/
        const libsMapping: { src: string; dest: string }[] = [
            // jQuery
            { src: 'libs/jquery/jquery.min.js', dest: 'jquery/jquery.min.js' },
            // Bootstrap
            { src: 'libs/bootstrap/bootstrap.bundle.min.js', dest: 'bootstrap/bootstrap.bundle.min.js' },
            { src: 'libs/bootstrap/bootstrap.min.css', dest: 'bootstrap/bootstrap.min.css' },
            // Bootstrap source maps (for debugging)
            { src: 'libs/bootstrap/bootstrap.bundle.min.js.map', dest: 'bootstrap/bootstrap.bundle.min.js.map' },
            { src: 'libs/bootstrap/bootstrap.min.css.map', dest: 'bootstrap/bootstrap.min.css.map' },
            // Common JS files (in app/common/)
            { src: 'app/common/exe_export.js', dest: 'exe_export.js' },
            { src: 'app/common/common.js', dest: 'common.js' },
            { src: 'app/common/common_i18n.js', dest: 'common_i18n.js' },
            // exe_lightbox (always included - hardcoded in PageRenderer)
            { src: 'app/common/exe_lightbox/exe_lightbox.js', dest: 'exe_lightbox/exe_lightbox.js' },
            { src: 'app/common/exe_lightbox/exe_lightbox.css', dest: 'exe_lightbox/exe_lightbox.css' },
        ];

        for (const { src, dest } of libsMapping) {
            const fullPath = path.join(this.publicDir, src);
            if (await fs.pathExists(fullPath)) {
                const content = await fs.readFile(fullPath);
                // Store with destination path (prefix added by caller)
                files.set(dest, content);
            }
        }

        return files;
    }

    /**
     * Fetch specific library files
     * @param filePaths - Array of file paths relative to libs/
     * @param patterns - Optional library patterns to identify directory-based libraries
     * @returns Map of file paths to content (without libs/ prefix, caller adds it)
     */
    async fetchLibraryFiles(filePaths: string[], patterns?: LibraryPattern[]): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();

        // Mapping for specific files that are in app/common/ instead of libs/
        const commonFilesMapping: Record<string, string> = {
            'common_i18n.js': 'app/common/common_i18n.js',
            'common.js': 'app/common/common.js',
            'exe_export.js': 'app/common/exe_export.js',
        };

        // Libraries that live in app/common/ instead of libs/
        // These are exe_* libraries with their own subdirectories
        const appCommonLibraries = new Set([
            'exe_lightbox',
            'exe_tooltips',
            'exe_effects',
            'exe_games',
            'exe_media',
            'exe_magnify',
            'exe_highlighter',
            'exe_slidesjs',
            'exe_media_link',
            'exe_math', // MathJax library
            'exe_atools', // Accessibility toolbar (also exists in libs/)
            'mermaid', // Mermaid diagram library
        ]);

        // Build lookup for directory patterns
        const directoryPatterns = new Set<string>();
        if (patterns) {
            for (const lib of patterns) {
                if (lib.isDirectory) {
                    for (const file of lib.files) {
                        directoryPatterns.add(file);
                    }
                }
            }
        }

        for (const filePath of filePaths) {
            // Check if this is a directory pattern (entire directory should be included)
            if (directoryPatterns.has(filePath)) {
                // Recursively read all files from directory
                const firstPart = filePath.split('/')[0];
                let dirPath: string;
                if (appCommonLibraries.has(firstPart)) {
                    dirPath = path.join(this.publicDir, 'app/common', filePath);
                } else {
                    dirPath = path.join(this.publicDir, 'libs', filePath);
                }
                const dirFiles = await this.readDirectoryRecursive(dirPath, filePath);
                for (const [subPath, content] of dirFiles) {
                    files.set(subPath, content);
                }
                continue;
            }

            let sourcePath: string;

            // Check if this is a specific mapped file
            if (commonFilesMapping[filePath]) {
                sourcePath = path.join(this.publicDir, commonFilesMapping[filePath]);
            } else {
                // Check if this is an app/common library (exe_* libraries)
                const firstPart = filePath.split('/')[0];
                if (appCommonLibraries.has(firstPart)) {
                    sourcePath = path.join(this.publicDir, 'app/common', filePath);
                } else {
                    // Default: libs/ folder
                    sourcePath = path.join(this.publicDir, 'libs', filePath);
                }
            }

            if (await fs.pathExists(sourcePath)) {
                const content = await fs.readFile(sourcePath);
                // Return without prefix - caller will add libs/ prefix
                files.set(filePath, content);
            }
        }

        return files;
    }

    /**
     * Fetch content CSS files
     * Uses style/workarea/base.css as source, maps to content/css/base.css for export
     * @returns Map of file paths to content
     */
    async fetchContentCss(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        const cssPath = path.join(this.publicDir, 'style', 'workarea', 'base.css');
        if (await fs.pathExists(cssPath)) {
            const content = await fs.readFile(cssPath);
            files.set('content/css/base.css', content);
        }
        return files;
    }

    /**
     * Fetch SCORM API wrapper files
     * @param version - SCORM version: '1.2' or '2004' (files are the same for both)
     * @returns Map of file paths to content
     */
    async fetchScormFiles(_version: '1.2' | '2004' = '1.2'): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();

        // SCORM API files are in app/common/scorm/
        const scormPath = path.join(this.publicDir, 'app', 'common', 'scorm');
        const scormFileNames = ['SCORM_API_wrapper.js', 'SCOFunctions.js'];

        for (const fileName of scormFileNames) {
            const fullPath = path.join(scormPath, fileName);
            if (await fs.pathExists(fullPath)) {
                const content = await fs.readFile(fullPath);
                // Store with just the filename (caller will add libs/ prefix)
                files.set(fileName, content);
            }
        }

        return files;
    }

    /**
     * Fetch SCORM schema XSD files
     * @param version - SCORM version: '1.2' or '2004'
     * @returns Map of file paths to content
     */
    async fetchScormSchemas(version: '1.2' | '2004'): Promise<Map<string, Buffer>> {
        // Schema files are in app/schemas/scorm12/ or app/schemas/scorm2004/
        const schemaDir = version === '1.2' ? 'scorm12' : 'scorm2004';
        const schemaPath = path.join(this.publicDir, 'app', 'schemas', schemaDir);
        return this.readDirectoryRecursive(schemaPath, '');
    }

    /**
     * Read all files from a directory recursively
     * @param dirPath - Directory path
     * @param prefix - Prefix for output paths (can be empty string)
     * @returns Map of file paths to content
     */
    private async readDirectoryRecursive(dirPath: string, prefix: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();

        if (!(await fs.pathExists(dirPath))) {
            return files;
        }

        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            // Handle empty prefix correctly to avoid leading slashes
            const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                const subFiles = await this.readDirectoryRecursive(fullPath, entryPath);
                for (const [subPath, content] of subFiles) {
                    files.set(subPath, content);
                }
            } else if (entry.isFile()) {
                const content = await fs.readFile(fullPath);
                files.set(entryPath, content);
            }
        }

        return files;
    }

    /**
     * Check if a resource exists
     * @param relativePath - Path relative to public/
     * @returns True if resource exists
     */
    async exists(relativePath: string): Promise<boolean> {
        const fullPath = path.join(this.publicDir, relativePath);
        return fs.pathExists(fullPath);
    }

    /**
     * Read a single resource file
     * @param relativePath - Path relative to public/
     * @returns File content or null if not found
     */
    async readFile(relativePath: string): Promise<Buffer | null> {
        const fullPath = path.join(this.publicDir, relativePath);
        if (await fs.pathExists(fullPath)) {
            return fs.readFile(fullPath);
        }
        return null;
    }

    /**
     * Fetch the eXeLearning "powered by" logo
     * @returns Logo image as Buffer, or null if not found
     */
    async fetchExeLogo(): Promise<Uint8Array | null> {
        const logoPath = path.join(this.publicDir, 'app', 'common', 'exe_powered_logo', 'exe_powered_logo.png');
        if (await fs.pathExists(logoPath)) {
            return fs.readFile(logoPath);
        }
        return null;
    }
}
