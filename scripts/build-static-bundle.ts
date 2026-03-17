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
 *   ├── bundles/                # Pre-built resource ZIPs (from public/bundles/)
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
import { execSync } from 'child_process';
import { XMLParser } from 'fast-xml-parser';

// Import centralized configuration
import { LOCALES, LOCALE_NAMES, PACKAGE_LOCALES, LICENSES } from './static-bundle/static-config';
import { buildConfigParams } from '../src/routes/config-params';

// Re-export config for external use
export { LOCALES, LOCALE_NAMES, PACKAGE_LOCALES, LICENSES };

const projectRoot = path.resolve(import.meta.dir, '..');
const outputDir = process.env.OUTPUT_DIR
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
                    translations[source] = target;
                }
            }
        } else if (transUnits) {
            // Single translation
            if (transUnits.source && transUnits.target) {
                translations[transUnits.source] = transUnits.target;
            }
        }
    } catch {
        // Return empty translations on parse error
    }

    return translations;
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
function loadAllTranslations(): Record<string, { translations: Record<string, string>; count: number }> {
    const result: Record<string, { translations: Record<string, string>; count: number }> = {};
    const translationsDir = path.join(projectRoot, 'translations');

    for (const locale of LOCALES) {
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
function readTemplateContent(basePath: string, folder: string, filename: string): string {
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
function buildIdevicesList(): { idevices: IdeviceConfig[] } {
    const idevicesDir = path.join(projectRoot, 'public/files/perm/idevices/base');
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
function scanThemeIcons(themePath: string, themeUrl: string): Record<string, ThemeIcon> {
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
function buildThemesList(): { themes: Theme[] } {
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
    content = content.replace(/>(\s*)\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}(\s*)</g, ' data-i18n="$2">$1$2$3<');

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
function generateMenuStructureHtml(): string {
    return processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuStructure.njk'));
}

/**
 * Generate the iDevices menu HTML
 */
function generateMenuIdevicesHtml(): string {
    return processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuIdevices.njk'));
}

/**
 * Generate the head top menu HTML
 */
function generateMenuHeadTopHtml(): string {
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
function generateMenuHeadBottomHtml(): string {
    return processNjkTemplate(path.join(projectRoot, 'views/workarea/menus/menuHeadBottom.njk'));
}

/**
 * Read and convert Nunjucks modal templates to static HTML
 * Replaces {{ 'string' | trans }} with the string itself
 */
function generateModalsHtml(): string {
    const modalsDir = path.join(projectRoot, 'views/workarea/modals');
    const modalFiles = [
        'generic/modalAlert.njk',
        'generic/modalInfo.njk',
        'generic/modalConfirm.njk',
        'generic/modalSessionLogout.njk',
        'pages/uploadtodrive.njk',
        'pages/uploadtodropbox.njk',
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
 * Build API parameters object (minimal version for static mode)
 */
export interface ApiParameters {
    routes: Record<string, { path: string; methods: string[] }>;
    userPreferencesConfig: Record<string, unknown>;
    ideviceInfoFieldsConfig: Record<string, unknown>;
    themeInfoFieldsConfig: Record<string, unknown>;
    themeEditionFieldsConfig: Record<string, unknown>;
    odeProjectSyncPropertiesConfig: Record<string, unknown>;
    odeProjectSyncCataloguingConfig: Record<string, unknown>;
    odeComponentsSyncPropertiesConfig: Record<string, unknown>;
    odeNavStructureSyncPropertiesConfig: Record<string, unknown>;
    odePagStructureSyncPropertiesConfig: Record<string, unknown>;
}

export function buildApiParameters(): ApiParameters {
    const {
        USER_PREFERENCES_CONFIG,
        IDEVICE_INFO_FIELDS_CONFIG,
        THEME_INFO_FIELDS_CONFIG,
        ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG,
        ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        ODE_PROJECT_SYNC_PROPERTIES_CONFIG,
        ODE_PROJECT_SYNC_CATALOGUING_CONFIG,
    } = buildConfigParams({
        TRANS_PREFIX: '',
        LICENSES,
        PACKAGE_LOCALES,
        LOCALES: LOCALE_NAMES,
    });

    // In static mode, we only need a minimal set of routes that are stubbed client-side
    return {
        routes: {
            // Translation routes (handled by DataProvider)
            api_translations_lists: { path: '/api/translations/lists', methods: ['GET'] },
            api_translations_list_by_locale: { path: '/api/translations/{locale}', methods: ['GET'] },

            // iDevices and themes (handled by DataProvider)
            api_idevices_installed: { path: '/api/idevices/installed', methods: ['GET'] },
            api_themes_installed: { path: '/api/themes/installed', methods: ['GET'] },

            // Upload limits (handled by DataProvider)
            api_config_upload_limits: { path: '/api/config/upload-limits', methods: ['GET'] },
        },
        userPreferencesConfig: USER_PREFERENCES_CONFIG,
        ideviceInfoFieldsConfig: IDEVICE_INFO_FIELDS_CONFIG,
        themeInfoFieldsConfig: THEME_INFO_FIELDS_CONFIG,
        // Theme edition disabled in static mode
        themeEditionFieldsConfig: {},
        odeProjectSyncPropertiesConfig: ODE_PROJECT_SYNC_PROPERTIES_CONFIG,
        odeProjectSyncCataloguingConfig: ODE_PROJECT_SYNC_CATALOGUING_CONFIG,
        odeComponentsSyncPropertiesConfig: ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG,
        odeNavStructureSyncPropertiesConfig: ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        odePagStructureSyncPropertiesConfig: ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG,
    };
}

/**
 * Generate the static index.html
 * Reads the HTML template and replaces placeholders with dynamic content
 */
function generateStaticHtml(bundleData: object): string {
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
    './libs/jquery/jquery.min.js',
    './libs/bootstrap/bootstrap.bundle.min.js',
    './libs/bootstrap/bootstrap.min.css',
    './style/workarea/main.css',
    './style/workarea/base.css',
    './data/bundle.json',
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
 * Copy directory recursively
 * @param src - Source directory
 * @param dest - Destination directory
 * @param exclude - Directory/file names to exclude (exact match)
 * @param excludePatterns - File patterns to exclude (e.g., '.test.js', '.spec.js')
 */
function copyDirRecursive(
    src: string,
    dest: string,
    exclude: string[] = [],
    excludePatterns: string[] = ['.test.js', '.spec.js'],
) {
    if (!fs.existsSync(src)) {
        console.warn(`Source not found: ${src}`);
        return;
    }

    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (exclude.includes(entry.name)) continue;
        // Skip test files
        if (excludePatterns.some(pattern => entry.name.endsWith(pattern))) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath, exclude, excludePatterns);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Main build function
 */
async function buildStaticBundle() {
    console.log('='.repeat(60));
    console.log('Building Static Distribution');
    console.log(`Version: ${buildVersion} (${buildHash})`);
    console.log('='.repeat(60));

    // Clean output directory
    if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

    // 1. Load and serialize API data
    console.log('\n1. Loading API data...');
    const apiParameters = buildApiParameters();
    const translations = loadAllTranslations();
    const idevices = buildIdevicesList();
    const themes = buildThemesList();

    // Read existing bundle manifest
    const bundleManifestPath = path.join(projectRoot, 'public/bundles/manifest.json');
    let bundleManifest = null;
    if (fs.existsSync(bundleManifestPath)) {
        bundleManifest = JSON.parse(fs.readFileSync(bundleManifestPath, 'utf-8'));
    }

    const bundleData = {
        version: buildVersion,
        builtAt: new Date().toISOString(),
        parameters: apiParameters,
        translations,
        idevices,
        themes,
        bundleManifest,
    };

    // Write bundle.json
    const dataDir = path.join(outputDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'bundle.json'), JSON.stringify(bundleData, null, 2));
    console.log('  Created data/bundle.json');

    // 2. Generate static HTML
    console.log('\n2. Generating static HTML...');
    const staticHtml = generateStaticHtml(bundleData);
    fs.writeFileSync(path.join(outputDir, 'index.html'), staticHtml);
    console.log('  Created index.html');

    // 3. Generate PWA files
    console.log('\n3. Generating PWA files...');
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), generatePwaManifest());
    fs.writeFileSync(path.join(outputDir, 'service-worker.js'), generateServiceWorker());
    console.log('  Created manifest.json');
    console.log('  Created service-worker.js');

    // 4. Copy static assets
    console.log('\n4. Copying static assets...');

    // Copy app folder
    copyDirRecursive(path.join(projectRoot, 'public/app'), path.join(outputDir, 'app'), ['test', 'spec']);
    console.log('  Copied app/');

    // Copy libs folder
    copyDirRecursive(path.join(projectRoot, 'public/libs'), path.join(outputDir, 'libs'));

    console.log('  Copied libs/');

    // Copy style folder
    copyDirRecursive(path.join(projectRoot, 'public/style'), path.join(outputDir, 'style'));
    console.log('  Copied style/');

    // Copy bundles folder (pre-built resource ZIPs)
    copyDirRecursive(path.join(projectRoot, 'public/bundles'), path.join(outputDir, 'bundles'));
    console.log('  Copied bundles/');

    // Copy files/perm (themes, iDevices, favicon)
    copyDirRecursive(path.join(projectRoot, 'public/files/perm'), path.join(outputDir, 'files/perm'));
    console.log('  Copied files/perm/');

    // Copy images folder (default-avatar.svg, logo.svg, etc.)
    copyDirRecursive(path.join(projectRoot, 'public/images'), path.join(outputDir, 'images'));
    console.log('  Copied images/');

    // Copy exelearning.png to root
    const exelearningPng = path.join(projectRoot, 'public/exelearning.png');
    if (fs.existsSync(exelearningPng)) {
        fs.copyFileSync(exelearningPng, path.join(outputDir, 'exelearning.png'));
        console.log('  Copied exelearning.png');
    }

    // Copy favicon.ico
    const faviconIco = path.join(projectRoot, 'public/favicon.ico');
    if (fs.existsSync(faviconIco)) {
        fs.copyFileSync(faviconIco, path.join(outputDir, 'favicon.ico'));
        console.log('  Copied favicon.ico');
    }

    // Copy CHANGELOG.md
    const changelogMd = path.join(projectRoot, 'public/CHANGELOG.md');
    if (fs.existsSync(changelogMd)) {
        fs.copyFileSync(changelogMd, path.join(outputDir, 'CHANGELOG.md'));
        console.log('  Copied CHANGELOG.md');
    }

    // Copy preview-sw.js (Service Worker for preview panel)
    const previewSwJs = path.join(projectRoot, 'public/preview-sw.js');
    if (fs.existsSync(previewSwJs)) {
        fs.copyFileSync(previewSwJs, path.join(outputDir, 'preview-sw.js'));
        console.log('  Copied preview-sw.js');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Static distribution built successfully!');
    console.log(`Output: ${outputDir}`);
    console.log('='.repeat(60));
}

// Run build only when executed directly (not when imported for testing)
if (import.meta.main) {
    buildStaticBundle().catch(console.error);
}
