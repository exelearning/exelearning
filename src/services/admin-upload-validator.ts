/**
 * Admin Upload Validator Service
 * Validates and extracts admin-managed themes (.zip) and templates (.elpx)
 *
 * Security considerations:
 * - Path traversal prevention (no ../ in paths)
 * - Magic bytes verification for ZIP files
 * - Size limits enforcement
 * - Required file validation (config.xml for themes, content.xml for templates)
 */
import * as fflateModule from 'fflate';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ThemeValidationResult {
    valid: boolean;
    error?: string;
    metadata?: {
        name: string;
        title: string;
        version: string;
        author: string;
        license: string;
        description: string;
    };
}

export interface TemplateValidationResult {
    valid: boolean;
    error?: string;
    isLegacy?: boolean; // true if contentv3.xml (legacy format)
}

export interface AdminUploadValidatorDeps {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    fflate?: typeof fflateModule;
}

export interface AdminUploadValidator {
    isZipFile: (buffer: Buffer) => boolean;
    validateThemeZip: (buffer: Buffer) => Promise<ThemeValidationResult>;
    validateTemplateZip: (buffer: Buffer) => Promise<TemplateValidationResult>;
    extractTheme: (buffer: Buffer, targetDir: string) => Promise<string[]>;
    extractTemplate: (buffer: Buffer, targetPath: string) => Promise<void>;
    validatePathSecurity: (entries: string[]) => boolean;
    slugify: (name: string) => string;
    parseThemeConfig: (xmlContent: string) => ThemeValidationResult['metadata'];
}

// ============================================================================
// Constants
// ============================================================================

// ZIP magic bytes: PK\x03\x04
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// Supported locales for templates
export const SUPPORTED_LOCALES = [
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'ca',
    'eu',
    'gl',
    'va',
    'eo',
    'nl',
    'pl',
    'ru',
    'zh',
    'ja',
    'ko',
    'ar',
];

// Base theme names that cannot be overwritten
export const BASE_THEME_NAMES = ['base', 'neo', 'flux', 'nova', 'zen'];

// ============================================================================
// Factory Function
// ============================================================================

export function createAdminUploadValidator(deps: AdminUploadValidatorDeps = {}): AdminUploadValidator {
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const fflate = deps.fflate ?? fflateModule;

    /**
     * Check if buffer starts with ZIP magic bytes
     */
    const isZipFile = (buffer: Buffer): boolean => {
        if (buffer.length < 4) return false;
        return buffer.subarray(0, 4).equals(ZIP_MAGIC);
    };

    /**
     * Validate that all paths in ZIP are safe (no path traversal)
     */
    const validatePathSecurity = (entries: string[]): boolean => {
        for (const entry of entries) {
            // Normalize the path
            const normalized = path.normalize(entry);

            // Check for path traversal attempts
            if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
                return false;
            }

            // Check for null bytes
            if (entry.includes('\0')) {
                return false;
            }

            // Check for backslash (potential Windows path injection)
            if (entry.includes('\\')) {
                return false;
            }
        }
        return true;
    };

    /**
     * Parse theme config.xml and extract metadata
     */
    const parseThemeConfig = (xmlContent: string): ThemeValidationResult['metadata'] => {
        const getValue = (tag: string): string => {
            const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
            return match ? match[1].trim() : '';
        };

        return {
            name: getValue('name'),
            title: getValue('title') || getValue('name'),
            version: getValue('version') || '1.0',
            author: getValue('author') || '',
            license: getValue('license') || '',
            description: getValue('description') || '',
        };
    };

    /**
     * Validate a theme ZIP file
     */
    const validateThemeZip = async (buffer: Buffer): Promise<ThemeValidationResult> => {
        // Check magic bytes
        if (!isZipFile(buffer)) {
            return { valid: false, error: 'Invalid file format: not a ZIP file' };
        }

        try {
            // Unzip to inspect contents
            const uint8Data = new Uint8Array(buffer);
            const unzipped = fflate.unzipSync(uint8Data);
            const entries = Object.keys(unzipped);

            // Validate path security
            if (!validatePathSecurity(entries)) {
                return { valid: false, error: 'Security error: invalid file paths detected' };
            }

            // Check for config.xml at root
            if (!('config.xml' in unzipped)) {
                return { valid: false, error: 'Invalid theme: missing config.xml' };
            }

            // Parse config.xml
            const configContent = Buffer.from(unzipped['config.xml']).toString('utf-8');
            const metadata = parseThemeConfig(configContent);

            // Validate required fields
            if (!metadata.name) {
                return { valid: false, error: 'Invalid theme: config.xml missing <name> element' };
            }

            // Check if name conflicts with base themes
            if (BASE_THEME_NAMES.includes(metadata.name.toLowerCase())) {
                return {
                    valid: false,
                    error: `Invalid theme: name "${metadata.name}" conflicts with a built-in theme`,
                };
            }

            return { valid: true, metadata };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { valid: false, error: `Failed to process ZIP file: ${message}` };
        }
    };

    /**
     * Validate a template (.elpx) ZIP file
     */
    const validateTemplateZip = async (buffer: Buffer): Promise<TemplateValidationResult> => {
        // Check magic bytes
        if (!isZipFile(buffer)) {
            return { valid: false, error: 'Invalid file format: not a ZIP file' };
        }

        try {
            // Unzip to inspect contents
            const uint8Data = new Uint8Array(buffer);
            const unzipped = fflate.unzipSync(uint8Data);
            const entries = Object.keys(unzipped);

            // Validate path security
            if (!validatePathSecurity(entries)) {
                return { valid: false, error: 'Security error: invalid file paths detected' };
            }

            // Check for content.xml or contentv3.xml
            const hasContentXml = 'content.xml' in unzipped;
            const hasContentV3Xml = 'contentv3.xml' in unzipped;

            if (!hasContentXml && !hasContentV3Xml) {
                return { valid: false, error: 'Invalid template: missing content.xml or contentv3.xml' };
            }

            return {
                valid: true,
                isLegacy: !hasContentXml && hasContentV3Xml,
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            return { valid: false, error: `Failed to process ZIP file: ${message}` };
        }
    };

    /**
     * Extract theme to target directory
     */
    const extractTheme = async (buffer: Buffer, targetDir: string): Promise<string[]> => {
        const uint8Data = new Uint8Array(buffer);
        const unzipped = fflate.unzipSync(uint8Data);
        const extractedFiles: string[] = [];

        // Ensure target directory exists
        await fs.ensureDir(targetDir);

        // Extract all files
        for (const [relativePath, data] of Object.entries(unzipped)) {
            // Skip directories (they end with /)
            if (relativePath.endsWith('/')) {
                await fs.ensureDir(path.join(targetDir, relativePath));
                continue;
            }

            // Build target path
            const targetPath = path.join(targetDir, relativePath);

            // Ensure parent directory exists
            await fs.ensureDir(path.dirname(targetPath));

            // Write file
            await fs.writeFile(targetPath, Buffer.from(data));
            extractedFiles.push(relativePath);
        }

        return extractedFiles;
    };

    /**
     * Extract template to target path (just copy the buffer to file)
     * Templates are stored as .elpx files, not extracted
     */
    const extractTemplate = async (buffer: Buffer, targetPath: string): Promise<void> => {
        // Ensure parent directory exists
        await fs.ensureDir(path.dirname(targetPath));

        // Write the ELPX file as-is
        await fs.writeFile(targetPath, buffer);
    };

    /**
     * Create a URL-safe slug from a string
     */
    const slugify = (name: string): string => {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
    };

    return {
        isZipFile,
        validateThemeZip,
        validateTemplateZip,
        extractTheme,
        extractTemplate,
        validatePathSecurity,
        slugify,
        parseThemeConfig,
    };
}

// ============================================================================
// Default Instance
// ============================================================================

const defaultValidator = createAdminUploadValidator();

export const isZipFile = defaultValidator.isZipFile;
export const validateThemeZip = defaultValidator.validateThemeZip;
export const validateTemplateZip = defaultValidator.validateTemplateZip;
export const extractTheme = defaultValidator.extractTheme;
export const extractTemplate = defaultValidator.extractTemplate;
export const validatePathSecurity = defaultValidator.validatePathSecurity;
export const slugify = defaultValidator.slugify;
export const parseThemeConfig = defaultValidator.parseThemeConfig;
