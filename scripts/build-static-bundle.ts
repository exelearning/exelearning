#!/usr/bin/env bun
/**
 * Build script for static/offline distribution
 *
 * Generates a self-contained static distribution that can run without a server.
 *
 * Output structure:
 *   dist/static/
 *   ├── index.html              # Static entry point
 *   ├── app/                    # Bundled JavaScript
 *   ├── libs/                   # External libraries
 *   ├── style/                  # CSS
 *   ├── bundles/                # Bundle manifest only (zips assembled client-side)
 *   ├── data/
 *   │   ├── bundle.json         # Pre-serialized API data
 *   │   └── translations/       # Per-locale JSON
 *   ├── manifest.json           # PWA manifest
 *   └── service-worker.js       # PWA service worker
 *
 * Usage:
 *   bun scripts/build-static-bundle.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { execSync } from 'child_process';
import { XMLParser } from 'fast-xml-parser';

// Import centralized configuration
import { LOCALES, LOCALE_NAMES, PACKAGE_LOCALES, LICENSES } from './static-bundle/static-config';
import { buildConfigParams } from '../src/routes/config-params';
import { STATIC_ROUTES } from '../src/routes/api-routes';
import { buildParameterResponse } from '../src/routes/parameter-response';
import { VOID_ELEMENTS } from '../src/shared/utils/html-constants';

// Re-export config for external use
export { LOCALES, LOCALE_NAMES, PACKAGE_LOCALES, LICENSES };

export const projectRoot = path.resolve(import.meta.dir, '..');
export const outputDir = process.env.OUTPUT_DIR
    ? path.resolve(process.env.OUTPUT_DIR)
    : path.join(projectRoot, 'dist/static');

// Read version from environment variable or package.json
// VERSION is used by GitHub Actions workflows, APP_VERSION is used by the backend
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));

// =============================================================================
// VERSION RESOLUTION
// =============================================================================
// The version is resolved automatically based on the input type:
// - Semver tags (v3.0.2, v3.0.2-rc1) → used directly for releases
// - "main"/"master" → v0.0.0-nightly-YYYYMMDDHHMM for nightly builds
// - Other strings (branch names, PR numbers) → v0.0.0-<name>-YYYYMMDDHHMM for previews
//
// This allows CI/CD to simply pass VERSION=main or VERSION=pr123 without
// generating the full version string, keeping workflow files simple.
// =============================================================================

/**
 * Check if a string is a valid semver version (with optional prerelease)
 * Matches: v1.0.0, v1.0.0-rc1, v1.0.0-beta.2, v1.0.0-alpha+build123
 */
export function isSemver(version: string): boolean {
    // Semver regex: optional v + major.minor.patch + optional prerelease/build metadata
    return /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version);
}

/**
 * Generate date string for version: YYYYMMDDHHMM
 */
function getDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * Resolve version based on input type:
 * - Semver (vX.X.X, vX.X.X-rc1) → use directly
 * - "main" or "master" → v0.0.0-nightly-YYYYMMDDHHMM
 * - Other (branch name) → v0.0.0-<branch>-YYYYMMDDHHMM
 */
export function resolveVersion(input: string | undefined): string {
    // Default to package.json version if no input
    if (!input) {
        return `v${packageJson.version}`;
    }

    // Semver: use directly
    if (isSemver(input)) {
        return input.startsWith('v') ? input : `v${input}`;
    }

    const dateStr = getDateString();

    // Main branch: nightly
    if (input === 'main' || input === 'master') {
        return `v0.0.0-nightly-${dateStr}`;
    }

    // Other branch: include branch name
    // Sanitize branch name (replace invalid chars with -)
    const sanitizedBranch = input.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/-+/g, '-');
    return `v0.0.0-${sanitizedBranch}-${dateStr}`;
}

// Parse --version= from CLI arguments (e.g., --version=main)
const versionArg = process.argv.find(arg => arg.startsWith('--version='))?.split('=')[1];
const versionInput = versionArg || process.env.VERSION || process.env.APP_VERSION;
const buildVersion = resolveVersion(versionInput);

// Log version resolution for CI/CD debugging
const versionSource = versionArg
    ? 'CLI'
    : process.env.VERSION
      ? 'VERSION env'
      : process.env.APP_VERSION
        ? 'APP_VERSION env'
        : 'default';
console.log(`[Version] Input: ${versionInput || '(none)'} (${versionSource}) → Output: ${buildVersion}`);

// Get git commit hash for cache busting (ensures cache invalidation on each deploy)
let buildHash: string;
try {
    buildHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
    // Fallback to timestamp if git not available
    buildHash = Date.now().toString(36);
}

// Export version info for testing
export function getBuildVersion(): string {
    return buildVersion;
}

export function getBuildHash(): string {
    return buildHash;
}

/**
 * Appends version query string to local asset URLs in HTML content.
 * Skips external URLs, data URLs, template placeholders, and already versioned URLs.
 *
 * @param html - The HTML content to process
 * @param version - The version string to append (e.g., 'v1.0.0')
 * @returns HTML with version query strings appended to local asset URLs
 */
export function appendVersionToUrls(html: string, version: string): string {
    // Pattern to match src="..." or href="..." attributes (but not data-src, etc.)
    // Uses negative lookbehind (?<!-) to ensure we don't match hyphenated attributes
    // Captures: attribute name (src/href), quote char, and URL value
    const attrPattern = /(?<![-\w])(src|href)=(["'])([^"']*)\2/g;

    return html.replace(attrPattern, (match, attr, quote, url) => {
        // Skip empty URLs
        if (!url || url.trim() === '') {
            return match;
        }

        // Skip external URLs (http://, https://, //)
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
            return match;
        }

        // Skip data URLs
        if (url.startsWith('data:')) {
            return match;
        }

        // Skip anchor-only hrefs
        if (url.startsWith('#')) {
            return match;
        }

        // Skip template placeholders ({{...}})
        if (url.includes('{{') || url.includes('}}')) {
            return match;
        }

        // Skip URLs that already have a version parameter (?v= or &v=)
        if (/[?&]v=/.test(url)) {
            return match;
        }

        // Append version: use & if URL already has query string, otherwise use ?
        const separator = url.includes('?') ? '&' : '?';
        return `${attr}=${quote}${url}${separator}v=${version}${quote}`;
    });
}

/**
 * Parse XLF content string to extract translations (pure function, testable)
 */
export function parseXlfContent(content: string): Record<string, string> {
    const translations: Record<string, string> = {};

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });

    try {
        const parsed = parser.parse(content);
        const transUnits = parsed?.xliff?.file?.body?.['trans-unit'];

        if (Array.isArray(transUnits)) {
            for (const unit of transUnits) {
                const source = unit.source;
                const target = unit.target;
                if (source && target) {
                    translations[source] = stripFuzzyMarker(target);
                }
            }
        } else if (transUnits) {
            // Single translation
            if (transUnits.source && transUnits.target) {
                translations[transUnits.source] = stripFuzzyMarker(transUnits.target);
            }
        }
    } catch {
        // Return empty translations on parse error
    }

    return translations;
}

/**
 * Strip the leading "~" fuzzy marker used to flag machine-translated
 * placeholder entries in the XLF files. The marker must never reach
 * the static bundle — it is kept only on disk so translators can spot
 * entries that still need review.
 */
function stripFuzzyMarker(target: string): string {
    if (typeof target !== 'string') return target;
    return target.startsWith('~') ? target.slice(1) : target;
}

/**
 * Parse XLF file to extract translations
 */
export function parseXlfFile(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) {
        console.warn(`Translation file not found: ${filePath}`);
        return {};
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return parseXlfContent(content);
}

/**
 * Load all translations
 */
export function loadAllTranslations(
    translationsDir: string = path.join(projectRoot, 'translations'),
    locales: readonly string[] = LOCALES,
): Record<string, { translations: Record<string, string>; count: number }> {
    const result: Record<string, { translations: Record<string, string>; count: number }> = {};

    for (const locale of locales) {
        const filePath = path.join(translationsDir, `messages.${locale}.xlf`);
        const translations = parseXlfFile(filePath);
        result[locale] = {
            translations,
            count: Object.keys(translations).length,
        };
        console.log(`  Loaded ${Object.keys(translations).length} translations for ${locale}`);
    }

    return result;
}

export interface IdeviceConfig {
    name: string;
    id: string;
    title: string;
    cssClass: string;
    category: string;
    icon: { name: string; url: string; type: string };
    version: string;
    apiVersion: string;
    componentType: string;
    author: string;
    authorUrl: string;
    license: string;
    licenseUrl: string;
    description: string;
    downloadable: boolean;
    url: string;
    editionJs: string[];
    editionCss: string[];
    exportJs: string[];
    exportCss: string[];
    editionTemplateFilename: string;
    exportTemplateFilename: string;
    editionTemplateContent: string;
    exportTemplateContent: string;
    exportObject: string;
    location: string;
    locationType: string;
}

/**
 * Read template file content safely
 */
export function readTemplateContent(basePath: string, folder: string, filename: string): string {
    if (!filename) return '';
    try {
        const templatePath = path.join(basePath, folder, filename);
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, 'utf-8');
        }
    } catch {
        // Ignore errors, return empty string
    }
    return '';
}

/**
 * Parse iDevice config.xml (same logic as server)
 */
export function parseIdeviceConfig(xmlContent: string, ideviceId: string, basePath: string): IdeviceConfig | null {
    try {
        const getValue = (tag: string): string => {
            const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
            return match ? match[1].trim() : '';
        };

        const getNestedValue = (parent: string, child: string): string => {
            const parentMatch = xmlContent.match(new RegExp(`<${parent}>([\\s\\S]*?)<\\/${parent}>`));
            if (!parentMatch) return '';
            const childMatch = parentMatch[1].match(new RegExp(`<${child}>([\\s\\S]*?)<\\/${child}>`));
            return childMatch ? childMatch[1].trim() : '';
        };

        // Parse list of filenames and verify they exist on disk
        const getValidFilenames = (tag: string, subfolder: 'edition' | 'export'): string[] => {
            const parentMatch = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
            let filenames: string[];

            if (!parentMatch) {
                const folderPath = path.join(basePath, subfolder);
                const extension = tag.includes('js') ? '.js' : '.css';
                if (fs.existsSync(folderPath)) {
                    try {
                        filenames = fs
                            .readdirSync(folderPath)
                            .filter(
                                file =>
                                    file.endsWith(extension) && !file.includes('.test.') && !file.includes('.spec.'),
                            )
                            .sort((a, b) => {
                                if (a === `${ideviceId}${extension}`) return -1;
                                if (b === `${ideviceId}${extension}`) return 1;
                                return a.localeCompare(b);
                            });
                    } catch {
                        filenames = [`${ideviceId}${extension}`];
                    }
                } else {
                    filenames = [`${ideviceId}${extension}`];
                }
            } else {
                filenames = [];
                const filenameMatches = parentMatch[1].matchAll(/<filename>([^<]+)<\/filename>/g);
                for (const match of filenameMatches) {
                    filenames.push(match[1].trim());
                }
                if (filenames.length === 0) {
                    filenames = [`${ideviceId}.${tag.includes('js') ? 'js' : 'css'}`];
                }
            }

            return filenames.filter(filename => {
                const filePath = path.join(basePath, subfolder, filename);
                return fs.existsSync(filePath);
            });
        };

        // Handle icon
        let icon = { name: `${ideviceId}-icon`, url: `${ideviceId}-icon.svg`, type: 'img' };
        const iconContent = getValue('icon');
        if (iconContent && !iconContent.includes('<')) {
            icon = { name: iconContent, url: iconContent, type: 'icon' };
        } else if (iconContent) {
            icon = {
                name: getNestedValue('icon', 'name') || `${ideviceId}-icon`,
                url: getNestedValue('icon', 'url') || `${ideviceId}-icon.svg`,
                type: getNestedValue('icon', 'type') || 'img',
            };
        }

        // Get template filenames
        const editionTemplateFilename = getValue('edition-template-filename') || '';
        const exportTemplateFilename = getValue('export-template-filename') || '';

        // Read template content from files
        const editionTemplateContent = readTemplateContent(basePath, 'edition', editionTemplateFilename);
        const exportTemplateContent = readTemplateContent(basePath, 'export', exportTemplateFilename);

        // exportObject is the global JS object name used for rendering (e.g., '$text')
        // Can be specified in config.xml or defaults to '$' + ideviceId (without dashes)
        const exportObject = getValue('export-object') || `$${ideviceId.split('-').join('')}`;

        return {
            name: ideviceId,
            id: ideviceId,
            title: getValue('title') || ideviceId,
            cssClass: getValue('css-class') || ideviceId,
            category: getValue('category') || 'Uncategorized',
            icon,
            version: getValue('version') || '1.0',
            apiVersion: getValue('api-version') || '3.0',
            componentType: getValue('component-type') || 'html',
            author: getValue('author') || '',
            authorUrl: getValue('author-url') || '',
            license: getValue('license') || '',
            licenseUrl: getValue('license-url') || '',
            description: getValue('description') || '',
            downloadable: getValue('downloadable') === '1',
            url: `/files/perm/idevices/base/${ideviceId}`,
            editionJs: getValidFilenames('edition-js', 'edition'),
            editionCss: getValidFilenames('edition-css', 'edition'),
            exportJs: getValidFilenames('export-js', 'export'),
            exportCss: getValidFilenames('export-css', 'export'),
            editionTemplateFilename,
            exportTemplateFilename,
            editionTemplateContent,
            exportTemplateContent,
            exportObject,
            location: getValue('location') || '',
            locationType: getValue('location-type') || '',
        };
    } catch {
        return null;
    }
}

/**
 * Build iDevices list from directory structure with full config data
 */
export function buildIdevicesList(
    idevicesDir: string = path.join(projectRoot, 'public/files/perm/idevices/base'),
): { idevices: IdeviceConfig[] } {
    const idevices: IdeviceConfig[] = [];

    if (!fs.existsSync(idevicesDir)) {
        console.warn('iDevices directory not found:', idevicesDir);
        return { idevices };
    }

    const dirs = fs.readdirSync(idevicesDir, { withFileTypes: true });
    for (const dir of dirs) {
        if (dir.isDirectory() && !dir.name.startsWith('.')) {
            const configPath = path.join(idevicesDir, dir.name, 'config.xml');
            if (fs.existsSync(configPath)) {
                const xmlContent = fs.readFileSync(configPath, 'utf-8');
                const config = parseIdeviceConfig(xmlContent, dir.name, path.join(idevicesDir, dir.name));
                if (config) {
                    idevices.push(config);
                }
            }
        }
    }

    // Sort by category then title
    idevices.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.title.localeCompare(b.title);
    });

    console.log(`  Found ${idevices.length} iDevices`);
    return { idevices };
}

/**
 * Theme icon interface
 */
interface ThemeIcon {
    id: string;
    title: string;
    type: 'img';
    value: string; // URL path to the icon image
}

/**
 * Theme interface matching what navbarStyles.js expects
 */
interface Theme {
    id: string;
    name: string;
    dirName: string;
    title: string;
    type: 'base' | 'site' | 'admin' | 'user';
    url: string; // Used by Theme class to build path
    description: string;
    valid: boolean;
    downloadable: string;
    cssFiles: string[]; // CSS files to load for the theme
    icons: Record<string, ThemeIcon>; // Theme icons for block icon picker
}

/**
 * Scan theme directory for icon files
 */
export function scanThemeIcons(themePath: string, themeUrl: string): Record<string, ThemeIcon> {
    const iconsPath = path.join(themePath, 'icons');
    if (!fs.existsSync(iconsPath)) return {};

    const icons: Record<string, ThemeIcon> = {};
    const entries = fs.readdirSync(iconsPath, { withFileTypes: true });

    for (const entry of entries) {
        if (
            entry.isFile() &&
            (entry.name.endsWith('.png') ||
                entry.name.endsWith('.svg') ||
                entry.name.endsWith('.gif') ||
                entry.name.endsWith('.jpg') ||
                entry.name.endsWith('.jpeg'))
        ) {
            const iconId = path.basename(entry.name, path.extname(entry.name));
            icons[iconId] = {
                id: iconId,
                title: iconId,
                type: 'img',
                value: `${themeUrl}/icons/${entry.name}`,
            };
        }
    }
    return icons;
}

/**
 * Build themes list from directory structure
 */
export function buildThemesList(): { themes: Theme[] } {
    const themesDir = path.join(projectRoot, 'public/files/perm/themes/base');
    const themes: Theme[] = [];

    if (!fs.existsSync(themesDir)) {
        console.warn('Themes directory not found:', themesDir);
        return { themes };
    }

    const dirs = fs.readdirSync(themesDir, { withFileTypes: true });
    for (const dir of dirs) {
        if (dir.isDirectory() && !dir.name.startsWith('.')) {
            // Check for config.xml or config.json
            const configXmlPath = path.join(themesDir, dir.name, 'config.xml');
            const configJsonPath = path.join(themesDir, dir.name, 'config.json');
            const hasConfig = fs.existsSync(configXmlPath) || fs.existsSync(configJsonPath);

            // Parse description from config.xml if available
            let description = '';
            if (fs.existsSync(configXmlPath)) {
                const configContent = fs.readFileSync(configXmlPath, 'utf-8');
                const descMatch = configContent.match(/<description>(.*?)<\/description>/s);
                if (descMatch) {
                    description = descMatch[1].trim();
                }
            }

            const themeName = dir.name;
            const themePath = path.join(themesDir, dir.name);
            // Use absolute URL (starting with /) so it concatenates correctly with basePath
            // basePath + '/files/...' = '/pr-preview/pr-20/files/...' (correct)
            const themeUrl = `/files/perm/themes/base/${themeName}`;

            // Parse more data from config.xml if available
            let title = themeName.charAt(0).toUpperCase() + themeName.slice(1);
            let downloadable = '0';
            let version = '1.0';
            let author = '';
            let authorUrl = '';
            let license = '';
            let licenseUrl = '';
            if (fs.existsSync(configXmlPath)) {
                const configContent = fs.readFileSync(configXmlPath, 'utf-8');
                const titleMatch = configContent.match(/<title>(.*?)<\/title>/s);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                }
                const downloadableMatch = configContent.match(/<downloadable>(.*?)<\/downloadable>/s);
                if (downloadableMatch) {
                    downloadable = downloadableMatch[1].trim();
                }
                const versionMatch = configContent.match(/<version>(.*?)<\/version>/s);
                if (versionMatch) {
                    version = versionMatch[1].trim();
                }
                const authorMatch = configContent.match(/<author>(.*?)<\/author>/s);
                if (authorMatch) {
                    author = authorMatch[1].trim();
                }
                const authorUrlMatch = configContent.match(/<author-url>(.*?)<\/author-url>/s);
                if (authorUrlMatch) {
                    authorUrl = authorUrlMatch[1].trim();
                }
                const licenseMatch = configContent.match(/<license>(.*?)<\/license>/s);
                if (licenseMatch) {
                    license = licenseMatch[1].trim();
                }
                const licenseUrlMatch = configContent.match(/<license-url>(.*?)<\/license-url>/s);
                if (licenseUrlMatch) {
                    licenseUrl = licenseUrlMatch[1].trim();
                }
            }

            // Scan theme icons
            const icons = scanThemeIcons(themePath, themeUrl);

            themes.push({
                id: themeName,
                name: themeName,
                dirName: themeName,
                title: title,
                type: 'base', // All themes in base/ folder are base themes
                url: themeUrl,
                description: description || `${title} theme`,
                valid: hasConfig,
                downloadable: downloadable,
                version: version,
                author: author,
                authorUrl: authorUrl,
                license: license,
                licenseUrl: licenseUrl,
                cssFiles: ['style.css'], // Default CSS file
                icons: icons,
            });
        }
    }

    console.log(`  Found ${themes.length} themes`);
    return { themes };
}

/**
 * Process Nunjucks template content and convert to static HTML (pure function, testable)
 * Replaces Nunjucks syntax with static values
 *
 * @param content - The template content string
 * @param version - The build version string (for app_version replacement)
 * @returns Processed HTML string
 */
export function processNjkTemplateContent(content: string, version: string): string {
    // Remove Nunjucks comments {# ... #} (can span multiple lines)
    content = content.replace(/\{#[\s\S]*?#\}/g, '');

    // =============================================================================
    // TRANSLATION HANDLING FOR STATIC MODE
    // Transform {{ 'string' | trans }} and {{ t.xxx or 'default' }} patterns
    // into elements/attributes with data-i18n-* for client-side translation
    // =============================================================================

    // STEP 1: Handle translations in ATTRIBUTES first (before content processing)
    // This prevents inserting <span> tags inside attribute values (invalid HTML)

    // 1a. Handle {{ 'Text' | trans }} in known attributes
    content = content.replace(
        /title="\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}"/g,
        'title="$1" data-i18n-title="$1"',
    );
    content = content.replace(
        /placeholder="\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}"/g,
        'placeholder="$1" data-i18n-placeholder="$1"',
    );
    content = content.replace(
        /aria-label="\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}"/g,
        'aria-label="$1" data-i18n-aria-label="$1"',
    );
    content = content.replace(/alt="\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}"/g, 'alt="$1" data-i18n-alt="$1"');

    // 1b. Handle {{ t.xxx or 'Text' }} in known attributes
    content = content.replace(
        /title="\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}"/g,
        'title="$1" data-i18n-title="$1"',
    );
    content = content.replace(
        /placeholder="\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}"/g,
        'placeholder="$1" data-i18n-placeholder="$1"',
    );
    content = content.replace(
        /aria-label="\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}"/g,
        'aria-label="$1" data-i18n-aria-label="$1"',
    );
    content = content.replace(/alt="\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}"/g, 'alt="$1" data-i18n-alt="$1"');

    // 1c. Handle translations in OTHER attributes (just use text, can't add data-i18n)
    // This catches data-*, aria-*, and any other attributes we don't specifically handle
    content = content.replace(/(\w[-\w]*)="\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}"/g, '$1="$2"');
    content = content.replace(/(\w[-\w]*)="\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}"/g, '$1="$2"');

    // STEP 2: Handle translations in ELEMENT CONTENT

    // 2a. Handle {{ 'Text' | trans }} that is the SOLE content of an element
    // Match opening tag (<tagname ...>) followed by {{ 'Text' | trans }} as sole content.
    // - Uses (<[a-z][^>]*) to only match opening tags (not closing tags like </span>)
    // - Excludes HTML void elements (input, img, br, etc.) which can't have text content
    const voidElements = VOID_ELEMENTS.join('|');
    content = content.replace(
        new RegExp(
            `(<(?!${voidElements})[a-z][^>]*)>(\\s*)\\{\\{\\s*['"]([^'"]+)['"]\\s*\\|\\s*trans\\s*\\}\\}(\\s*)<`,
            'gi',
        ),
        '$1 data-i18n="$3">$2$3$4<',
    );

    // 2b. Handle remaining {{ 'Text' | trans }} (mixed with other content)
    content = content.replace(/\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}/g, '<span data-i18n="$1">$1</span>');

    // 2c. Handle {{ t.xxx or 'Text' }} in content (wrap in span)
    content = content.replace(/\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}/g, '<span data-i18n="$1">$1</span>');

    // Replace {{ basePath }}/path with ./path (relative paths for static mode)
    content = content.replace(/\{\{\s*basePath\s*\}\}\//g, './');

    // Replace {{ 'path' | asset }} with ./path (relative paths for static mode)
    // Matches both single and double quotes
    content = content.replace(/\{\{\s*['"]([^'"]+)['"]\s*\|\s*asset\s*\}\}/g, './$1');

    // Replace {{ app_version }} with the actual build version
    content = content.replace(/\{\{\s*app_version\s*\}\}/g, version);

    // Handle {% if '-' in app_version %}...{% endif %} conditional
    // Keep content if version contains '-', remove otherwise
    if (version.includes('-')) {
        // Keep the content, just remove the conditional tags
        content = content.replace(/\{%\s*if\s+'-'\s+in\s+app_version\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, '$1');
    } else {
        // Remove the entire conditional block
        content = content.replace(/\{%\s*if\s+'-'\s+in\s+app_version\s*%\}[\s\S]*?\{%\s*endif\s*%\}/g, '');
    }

    // Replace other simple {{ variable }} patterns (remove them for static)
    content = content.replace(/\{\{[^}]+\}\}/g, '');

    // Process conditionals for isOfflineInstallation (true in static mode):
    // KEEP content inside {% if config.isOfflineInstallation %}...{% endif %}
    content = content.replace(/\{%\s*if\s+config\.isOfflineInstallation\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, '$1');
    // REMOVE content inside {% if not config.isOfflineInstallation %}...{% endif %}
    content = content.replace(/\{%\s*if\s+not\s+config\.isOfflineInstallation\s*%\}[\s\S]*?\{%\s*endif\s*%\}/g, '');
    // Process conditionals for platformIntegration (false in static mode):
    // REMOVE content inside {% if config.platformIntegration %}...{% endif %}
    content = content.replace(/\{%\s*if\s+config\.platformIntegration\s*%\}[\s\S]*?\{%\s*endif\s*%\}/g, '');

    // REMOVE user-related conditionals (no user in static mode)
    // Matches {% if user.something %}...{% else %}...{% endif %} or {% if user.something %}...{% endif %}
    content = content.replace(/\{%\s*if\s+user\.\w+\s*%\}[\s\S]*?\{%\s*endif\s*%\}/g, '');

    // Remove remaining {% ... %} tags (other conditionals, includes, etc.)
    content = content.replace(/\{%[\s\S]*?%\}/g, '');

    return content;
}

/**
 * Process a Nunjucks template file and convert to static HTML
 * Replaces Nunjucks syntax with static values
 */
export function processNjkTemplate(filePath: string): string {
    if (!fs.existsSync(filePath)) {
        console.warn(`  Template not found: ${filePath}`);
        return '';
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return processNjkTemplateContent(content, buildVersion);
}

/**
 * Generate the menu structure HTML
 */
export function generateMenuStructureHtml(): string {
    return processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuStructure.njk'));
}

/**
 * Generate the iDevices menu HTML
 */
export function generateMenuIdevicesHtml(): string {
    return processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuIdevices.njk'));
}

/**
 * Generate the head top menu HTML
 */
export function generateMenuHeadTopHtml(): string {
    // Process main head top template
    let content = processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuHeadTop.njk'));

    // Also include navbar
    const navbarContent = processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuNavbar.njk'));
    content = content.replace('</div>', navbarContent + '</div>');

    return content;
}

/**
 * Generate the head bottom menu HTML
 */
export function generateMenuHeadBottomHtml(): string {
    return processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuHeadBottom.njk'));
}

/**
 * Read and convert Nunjucks modal templates to static HTML
 * Replaces {{ 'string' | trans }} with the string itself
 */
export function generateModalsHtml(): string {
    const modalsDir = path.join(projectRoot, 'views/workarea/modals');
    const modalFiles = [
        'generic/modalAlert.njk',
        'generic/modalInfo.njk',
        'generic/modalConfirm.njk',
        'generic/modalSessionLogout.njk',
        'pages/filemanager.njk',
        'pages/stylemanager.njk',
        'pages/idevicemanager.njk',
        'pages/odebrokenlinks.njk',
        'pages/odeusedfiles.njk',
        'pages/lopd.njk',
        'pages/assistant.njk',
        'pages/releasenotes.njk',
        'pages/legalnotes.njk',
        'pages/about.njk',
        'pages/easteregg.njk',
        'pages/properties.njk',
        // Inert in static builds (no accounts, so the menu entry never renders),
        // but ModalsManagement instantiates every modal unconditionally and the
        // base Modal constructor requires its root element to exist.
        'pages/changepassword.njk',
        'pages/openuserodefiles.njk',
        'pages/templateselection.njk',
        'pages/modalShare.njk',
        'pages/printpreview.njk',
        'pages/imageoptimizer.njk',
        'pages/globalsearch.njk',
    ];

    let modalsHtml = '';
    for (const modalFile of modalFiles) {
        modalsHtml += processNjkTemplate(path.join(modalsDir, modalFile)) + '\n';
    }
    return modalsHtml;
}

/**
 * Build API parameters object (minimal version for static mode).
 * Delegates to the shared buildParameterResponse to keep the response shape
 * in sync with the server.
 */
export type ApiParameters = ReturnType<typeof buildApiParameters>;

export function buildApiParameters() {
    // Static mode bundles every base theme found on disk; the user-preference
    // dropdown shows them so the user can pick a default style without a server.
    const themesList = buildThemesList().themes;
    const THEMES: Record<string, string> = {};
    for (const theme of themesList) {
        THEMES[theme.dirName] = theme.title || theme.dirName;
    }

    const configParams = buildConfigParams({
        TRANS_PREFIX: '',
        LICENSES,
        PACKAGE_LOCALES,
        LOCALES: LOCALE_NAMES,
        THEMES,
    });

    return buildParameterResponse({
        configParams,
        routes: STATIC_ROUTES,
        disableThemeEdition: true,
    });
}

/**
 * Generate the static index.html
 * Reads the HTML template and replaces placeholders with dynamic content
 */
export function generateStaticHtml(bundleData: object): string {
    // Read the HTML template
    const templatePath = path.join(import.meta.dir, 'static-bundle/static-index.html');
    let html = fs.readFileSync(templatePath, 'utf-8');

    // Replace placeholders with dynamic content
    html = html.replace(/\{\{BUILD_VERSION\}\}/g, buildVersion);
    html = html.replace('{{MENU_STRUCTURE_HTML}}', generateMenuStructureHtml());
    html = html.replace('{{MENU_IDEVICES_HTML}}', generateMenuIdevicesHtml());
    html = html.replace('{{MENU_HEAD_TOP_HTML}}', generateMenuHeadTopHtml());
    html = html.replace('{{MENU_HEAD_BOTTOM_HTML}}', generateMenuHeadBottomHtml());
    html = html.replace('{{MODALS_HTML}}', generateModalsHtml());

    // Post-process: ensure all local URLs have version query string for cache busting
    // This handles both template URLs and dynamically generated content from .njk files
    html = appendVersionToUrls(html, buildVersion);

    return html;
}

/**
 * Generate PWA manifest.json (pure function, testable)
 * Creates a complete manifest for installable PWA
 *
 * @param version - The build version string
 * @param hash - The build hash string
 * @returns JSON string of the manifest
 */
export function generatePwaManifestContent(version: string, hash: string): string {
    return JSON.stringify(
        {
            name: `eXeLearning Editor (${version})`,
            short_name: 'eXeLearning',
            description: 'Create interactive educational content offline. Open source authoring tool for educators.',
            start_url: './index.html',
            scope: './',
            display: 'standalone',
            orientation: 'any',
            background_color: '#ffffff',
            theme_color: '#00a99d',
            categories: ['education', 'productivity'],
            lang: 'en',
            dir: 'ltr',
            icons: [
                {
                    src: './favicon.ico',
                    sizes: '48x48',
                    type: 'image/x-icon',
                },
                {
                    src: './exelearning.png',
                    sizes: '96x96',
                    type: 'image/png',
                    purpose: 'any',
                },
                {
                    src: './images/logo.svg',
                    sizes: 'any',
                    type: 'image/svg+xml',
                    purpose: 'any maskable',
                },
            ],
            file_handlers: [
                {
                    action: './index.html',
                    accept: {
                        'application/x-exelearning': ['.elpx', '.elp'],
                    },
                },
            ],
            share_target: {
                action: './index.html',
                method: 'POST',
                enctype: 'multipart/form-data',
                params: {
                    files: [
                        {
                            name: 'file',
                            accept: ['.elpx', '.elp', 'application/zip'],
                        },
                    ],
                },
            },
            launch_handler: {
                client_mode: 'navigate-existing',
            },
            id: `exelearning-${version}-${hash}`,
        },
        null,
        2,
    );
}

/**
 * Generate PWA manifest.json using current build version and hash
 */
export function generatePwaManifest(): string {
    return generatePwaManifestContent(buildVersion, buildHash);
}

/**
 * Generate service worker content (pure function, testable)
 *
 * @param version - The build version string
 * @param hash - The build hash string
 * @returns Service worker JavaScript code
 */
export function generateServiceWorkerContent(version: string, hash: string): string {
    return `/**
 * Service Worker for eXeLearning Static Mode
 * Provides offline-first caching for PWA
 */

const CACHE_NAME = 'exelearning-static-${version}-${hash}';
const STATIC_ASSETS = [
    './',
    './index.html',
    './app/app.bundle.js',
    './app/yjs/exporters.bundle.js',
    './libs/yjs/yjs.min.js',
    './libs/yjs/y-indexeddb.min.js',
    './libs/fflate/fflate.umd.js',
    './libs/fzstd/fzstd.umd.js',
    './libs/jquery/jquery.min.js',
    './libs/bootstrap/bootstrap.bundle.min.js',
    './libs/bootstrap/bootstrap.min.css',
    './style/workarea/main.css',
    './style/workarea/base.css',
    './data/bundle.json.zst',
];

// Install: Cache all static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key.startsWith('exelearning-static-') && key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network-first strategy (always online when possible)
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Network succeeded - update cache and return
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed - try cache (offline fallback)
                return caches.match(event.request).then(cached => {
                    if (cached) {
                        console.log('[SW] Serving from cache (offline):', event.request.url);
                        return cached;
                    }
                    // Navigation fallback
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
            })
    );
});
`;
}

/**
 * Generate service worker using current build version and hash
 */
export function generateServiceWorker(): string {
    return generateServiceWorkerContent(buildVersion, buildHash);
}

/**
 * Directories (relative to dist/static/) whose .json files must be shipped as
 * .json.zst. Large repetitive curricular data — zstd-19 compresses ~94% (vs
 * ~81% for gzip), saving an extra ~6.5 MB over gzip in the static build and
 * Electron package. Decompressed on the fly in the browser via `fzstd`
 * (public/libs/fzstd/fzstd.umd.js) — see lomloe.js / digcompedu.js.
 *
 * Add new entries when introducing other large JSON datasets that the iDevice
 * loaders fetch through the .zst-first pattern.
 */
export const COMPRESS_JSON_DIRS = [
    'files/perm/idevices/base/lomloe/data',
    'files/perm/idevices/base/digcompedu/data',
];

export function shouldCompressJson(fileName: string): boolean {
    return fileName.endsWith('.json');
}

export function zstdCompressBuffer(input: Buffer): Buffer {
    return zlib.zstdCompressSync(input, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } });
}

/**
 * Walk a directory, zstd-compress every .json into a sibling .json.zst, and
 * delete the raw .json. Returns aggregate stats for logging.
 */
export function compressJsonInDir(absDir: string): { count: number; origTotal: number; compressedTotal: number } {
    let count = 0;
    let origTotal = 0;
    let compressedTotal = 0;
    if (!fs.existsSync(absDir)) return { count, origTotal, compressedTotal };
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
        const abs = path.join(absDir, entry.name);
        if (entry.isDirectory()) {
            const sub = compressJsonInDir(abs);
            count += sub.count;
            origTotal += sub.origTotal;
            compressedTotal += sub.compressedTotal;
            continue;
        }
        if (!shouldCompressJson(entry.name)) continue;
        const data = fs.readFileSync(abs);
        const compressed = zstdCompressBuffer(data);
        fs.writeFileSync(abs + '.zst', compressed);
        fs.unlinkSync(abs);
        count += 1;
        origTotal += data.length;
        compressedTotal += compressed.length;
    }
    return { count, origTotal, compressedTotal };
}

/**
 * Copy directory recursively
 * @param src - Source directory
 * @param dest - Destination directory
 * @param exclude - Directory/file names to exclude, matched either as a bare
 *   name at any depth ('test') or as a path relative to the copy root
 *   ('idevices/base/slide/src'). Prefer the relative form for a one-off
 *   exclusion, so a future directory of the same name elsewhere in the tree is
 *   not dropped along with it.
 * @param excludePatterns - File suffixes to exclude (e.g., '.test.js', '.js.map').
 *   Suffixes are deliberately specific: '.map' alone would also swallow a data
 *   file that happens to end in it.
 */
export function copyDirRecursive(
    src: string,
    dest: string,
    exclude: string[] = [],
    excludePatterns: string[] = ['.test.js', '.spec.js', '.js.map', '.css.map', '.d.ts'],
    root: string = src,
) {
    if (!fs.existsSync(src)) {
        console.warn(`Source not found: ${src}`);
        return;
    }

    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const srcPath = path.join(src, entry.name);
        const relPath = path.relative(root, srcPath).split(path.sep).join('/');

        if (exclude.includes(entry.name) || exclude.includes(relPath)) continue;
        // Skip test files
        if (excludePatterns.some(pattern => entry.name.endsWith(pattern))) continue;

        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath, exclude, excludePatterns, root);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Ship only the bundle manifest into the static distribution, never the
 * pre-built resource ZIPs.
 *
 * In static mode the client assembles each bundle on demand from the loose
 * files (copied separately) using the manifest's per-bundle file lists, then
 * persists the result to IndexedDB. Copying the zips would be a redundant,
 * incompressible ~17 MB duplicate of bytes that ship loosely anyway. Server
 * mode still serves `public/bundles/*.zip` via `/api/resources/bundle/*`.
 *
 * Returns `true` when the manifest was copied, `false` when the source
 * manifest is missing (caller-visible so the build can warn).
 */
export function copyBundleManifest(projectRoot: string, outputDir: string): boolean {
    const manifestSrc = path.join(projectRoot, 'public/bundles/manifest.json');
    if (!fs.existsSync(manifestSrc)) {
        return false;
    }
    const bundlesOut = path.join(outputDir, 'bundles');
    fs.mkdirSync(bundlesOut, { recursive: true });
    fs.copyFileSync(manifestSrc, path.join(bundlesOut, 'manifest.json'));
    return true;
}

// Run build only when executed directly (not when imported for testing).
// The orchestrator lives in ./static-bundle/run-build.ts and is loaded lazily so
// that importing this module for its helpers never pulls in the build itself.
if (import.meta.main) {
    const { buildStaticBundle } = await import('./static-bundle/run-build');
    buildStaticBundle().catch(console.error);
}
