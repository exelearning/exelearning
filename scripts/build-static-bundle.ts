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

const projectRoot = path.resolve(import.meta.dir, '..');
const outputDir = path.join(projectRoot, 'dist/static');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const buildVersion = `v${packageJson.version}`;

// Get git commit hash for cache busting (ensures cache invalidation on each deploy)
let buildHash: string;
try {
    buildHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
    // Fallback to timestamp if git not available
    buildHash = Date.now().toString(36);
}

// Supported locales (from translations/)
const LOCALES = ['ca', 'en', 'eo', 'es', 'eu', 'gl', 'pt', 'ro', 'va'];

// Locale display names
const LOCALE_NAMES: Record<string, string> = {
    ca: 'Català',
    en: 'English',
    eo: 'Esperanto',
    es: 'Español',
    eu: 'Euskara',
    gl: 'Galego',
    pt: 'Português',
    ro: 'Română',
    va: 'Valencià',
};

/**
 * Parse XLF file to extract translations
 */
function parseXlfFile(filePath: string): Record<string, string> {
    const translations: Record<string, string> = {};

    if (!fs.existsSync(filePath)) {
        console.warn(`Translation file not found: ${filePath}`);
        return translations;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
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
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
    }

    return translations;
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

interface IdeviceConfig {
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
function parseIdeviceConfig(xmlContent: string, ideviceId: string, basePath: string): IdeviceConfig | null {
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
                        filenames = fs.readdirSync(folderPath)
                            .filter(file => file.endsWith(extension) && !file.includes('.test.') && !file.includes('.spec.'))
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
            // Use relative URL (./...) to work in subdirectory deployments like PR previews
            const themeUrl = `./files/perm/themes/base/${themeName}`;

            // Parse more data from config.xml if available
            let title = themeName.charAt(0).toUpperCase() + themeName.slice(1);
            let downloadable = '0';
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
                cssFiles: ['style.css'], // Default CSS file
                icons: icons,
            });
        }
    }

    console.log(`  Found ${themes.length} themes`);
    return { themes };
}

/**
 * Process a Nunjucks template file and convert to static HTML
 * Replaces Nunjucks syntax with static values
 */
function processNjkTemplate(filePath: string): string {
    if (!fs.existsSync(filePath)) {
        console.warn(`  Template not found: ${filePath}`);
        return '';
    }

    let content = fs.readFileSync(filePath, 'utf-8');

    // Remove Nunjucks comments {# ... #} (can span multiple lines)
    content = content.replace(/\{#[\s\S]*?#\}/g, '');

    // Replace {{ 'string' | trans }} with 'string'
    content = content.replace(/\{\{\s*['"]([^'"]+)['"]\s*\|\s*trans\s*\}\}/g, '$1');

    // Replace {{ t.something or 'default' }} with 'default'
    content = content.replace(/\{\{\s*t\.\w+\s+or\s+['"]([^'"]+)['"]\s*\}\}/g, '$1');

    // Replace {{ basePath }}/path with ./path (relative paths for static mode)
    content = content.replace(/\{\{\s*basePath\s*\}\}\//g, './');

    // Replace other simple {{ variable }} patterns (remove them for static)
    content = content.replace(/\{\{[^}]+\}\}/g, '');

    // Remove {% ... %} tags (conditionals, includes, etc.) - multiline support
    content = content.replace(/\{%[\s\S]*?%\}/g, '');

    return content;
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
interface ApiParameters {
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

// Package locales for project language selection
const PACKAGE_LOCALES: Record<string, string> = {
    ca: 'Català',
    en: 'English',
    eo: 'Esperanto',
    es: 'Español',
    eu: 'Euskara',
    gl: 'Galego',
    pt: 'Português',
    ro: 'Română',
    va: 'Valencià',
};

// Available licenses
const LICENSES: Record<string, string> = {
    'creative commons: attribution 4.0': 'creative commons: attribution 4.0 (BY)',
    'creative commons: attribution - share alike 4.0': 'creative commons: attribution - share alike 4.0 (BY-SA)',
    'creative commons: attribution - non derived work 4.0': 'creative commons: attribution - non derived work 4.0 (BY-ND)',
    'creative commons: attribution - non commercial 4.0': 'creative commons: attribution - non commercial 4.0 (BY-NC)',
    'creative commons: attribution - non commercial - share alike 4.0': 'creative commons: attribution - non commercial - share alike 4.0 (BY-NC-SA)',
    'creative commons: attribution - non derived work - non commercial 4.0': 'creative commons: attribution - non derived work - non commercial 4.0 (BY-NC-ND)',
    'public domain': 'public domain',
    'propietary license': 'proprietary license',
};

function buildApiParameters(): ApiParameters {
    // Group titles for project properties
    const GROUPS_TITLE = {
        properties_package: 'Content metadata',
        export: 'Export options',
        custom_code: 'Custom code',
    };

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
        // User preferences configuration (required by frontend)
        userPreferencesConfig: {
            locale: {
                title: 'Language',
                help: 'You can choose a different language for the current project.',
                value: null,
                type: 'select',
                options: ['ca', 'en', 'eo', 'es', 'eu', 'gl', 'pt', 'ro', 'va'],
                category: 'General settings',
            },
            advancedMode: {
                title: 'Advanced mode',
                value: 'true',
                type: 'checkbox',
                hide: true,
                category: 'General settings',
            },
            defaultLicense: {
                title: 'License for the new documents',
                help: 'You can choose a different licence for the current project.',
                value: 'creative commons: attribution - share alike 4.0',
                type: 'select',
                options: [],
                category: 'General settings',
            },
            theme: {
                title: 'Style',
                value: 'base',
                type: 'text',
                hide: true,
                category: 'General settings',
            },
            versionControl: {
                title: 'Version control',
                value: 'true',
                type: 'checkbox',
                category: 'General settings',
            },
        },
        // iDevice info fields configuration
        ideviceInfoFieldsConfig: {
            title: { title: 'Title', tag: 'text' },
            description: { title: 'Description', tag: 'textarea' },
            version: { title: 'Version', tag: 'text' },
            author: { title: 'Authorship', tag: 'text' },
            authorUrl: { title: 'Author URL', tag: 'text' },
            license: { title: 'License', tag: 'textarea' },
            licenseUrl: { title: 'License URL', tag: 'textarea' },
        },
        // Theme info fields configuration
        themeInfoFieldsConfig: {
            title: { title: 'Title', tag: 'text' },
            description: { title: 'Description', tag: 'textarea' },
            version: { title: 'Version', tag: 'text' },
            author: { title: 'Authorship', tag: 'text' },
            authorUrl: { title: 'Author URL', tag: 'text' },
            license: { title: 'License', tag: 'textarea' },
            licenseUrl: { title: 'License URL', tag: 'textarea' },
        },
        // Theme edition fields configuration (for style manager)
        themeEditionFieldsConfig: {
            // Empty config - theme editing disabled in static mode
        },
        // Project properties configuration (required by projectProperties.js)
        odeProjectSyncPropertiesConfig: {
            properties: {
                pp_title: {
                    title: 'Title',
                    help: 'The name given to the resource.',
                    value: '',
                    alwaysVisible: true,
                    type: 'text',
                    category: 'properties',
                    groups: { properties_package: GROUPS_TITLE.properties_package },
                },
                pp_subtitle: {
                    title: 'Subtitle',
                    help: 'Adds additional information to the main title.',
                    value: '',
                    alwaysVisible: true,
                    type: 'text',
                    category: 'properties',
                    groups: { properties_package: GROUPS_TITLE.properties_package },
                },
                pp_lang: {
                    title: 'Language',
                    help: 'Select a language.',
                    value: 'en',
                    alwaysVisible: true,
                    type: 'select',
                    options: PACKAGE_LOCALES,
                    category: 'properties',
                    groups: { properties_package: GROUPS_TITLE.properties_package },
                },
                pp_author: {
                    title: 'Authorship',
                    help: 'Primary author/s of the resource.',
                    value: '',
                    alwaysVisible: true,
                    type: 'text',
                    category: 'properties',
                    groups: { properties_package: GROUPS_TITLE.properties_package },
                },
                pp_license: {
                    title: 'License',
                    value: 'creative commons: attribution - share alike 4.0',
                    alwaysVisible: true,
                    type: 'select',
                    options: LICENSES,
                    category: 'properties',
                    groups: { properties_package: GROUPS_TITLE.properties_package },
                },
                pp_description: {
                    title: 'Description',
                    value: '',
                    alwaysVisible: true,
                    type: 'textarea',
                    category: 'properties',
                    groups: { properties_package: GROUPS_TITLE.properties_package },
                },
                exportSource: {
                    title: 'Editable export',
                    help: 'The exported content will be editable with eXeLearning.',
                    value: 'true',
                    type: 'checkbox',
                    category: 'properties',
                    groups: { export: GROUPS_TITLE.export },
                },
                pp_addExeLink: {
                    title: '"Made with eXeLearning" link',
                    help: 'Help us spreading eXeLearning.',
                    value: 'true',
                    type: 'checkbox',
                    category: 'properties',
                    groups: { export: GROUPS_TITLE.export },
                },
                pp_addPagination: {
                    title: 'Page counter',
                    help: 'A text with the page number will be added on each page.',
                    value: 'false',
                    type: 'checkbox',
                    category: 'properties',
                    groups: { export: GROUPS_TITLE.export },
                },
                pp_addSearchBox: {
                    title: 'Search bar (Website export only)',
                    help: 'A search box will be added to every page of the website.',
                    value: 'false',
                    type: 'checkbox',
                    category: 'properties',
                    groups: { export: GROUPS_TITLE.export },
                },
                pp_addAccessibilityToolbar: {
                    title: 'Accessibility toolbar',
                    help: 'The accessibility toolbar allows visitors to manipulate some aspects of your site.',
                    value: 'false',
                    type: 'checkbox',
                    category: 'properties',
                    groups: { export: GROUPS_TITLE.export },
                },
                pp_addMathJax: {
                    title: 'MathJax (formulas)',
                    help: 'Always include the MathJax library for mathematical formulas.',
                    value: 'false',
                    type: 'checkbox',
                    category: 'properties',
                    groups: { export: GROUPS_TITLE.export },
                },
                pp_extraHeadContent: {
                    title: 'HEAD',
                    help: 'HTML to be included at the end of HEAD.',
                    value: '',
                    alwaysVisible: true,
                    type: 'textarea',
                    category: 'properties',
                    groups: { custom_code: GROUPS_TITLE.custom_code },
                },
                footer: {
                    title: 'Page footer',
                    help: 'Type any HTML. It will be placed after every page content.',
                    value: '',
                    alwaysVisible: true,
                    type: 'textarea',
                    category: 'properties',
                    groups: { custom_code: GROUPS_TITLE.custom_code },
                },
            },
        },
        // Cataloguing configuration (LOM - deprecated, kept empty for backwards compatibility)
        odeProjectSyncCataloguingConfig: {},
        // Component properties
        odeComponentsSyncPropertiesConfig: {
            visibility: { title: 'Visible in export', value: 'true', type: 'checkbox', category: null, heritable: true },
            teacherOnly: { title: 'Teacher only', value: 'false', type: 'checkbox', category: null, heritable: true },
            identifier: { title: 'ID', value: '', type: 'text', category: null, heritable: false },
            cssClass: { title: 'CSS Class', value: '', type: 'text', category: null, heritable: true },
        },
        // Navigation structure properties
        odeNavStructureSyncPropertiesConfig: {
            titleNode: { title: 'Title', value: '', type: 'text', category: 'General', heritable: false },
            hidePageTitle: { title: 'Hide page title', type: 'checkbox', category: 'General', value: 'false', heritable: false },
            titleHtml: { title: 'Title HTML', value: '', type: 'text', category: 'Advanced (SEO)', heritable: false },
            editableInPage: { title: 'Different title on the page', type: 'checkbox', category: 'General', value: 'false', alwaysVisible: true },
            titlePage: { title: 'Title in page', value: '', type: 'text', category: 'General', heritable: false },
            visibility: { title: 'Visible in export', value: 'true', type: 'checkbox', category: 'General', heritable: true },
            highlight: { title: 'Highlight this page', value: 'false', type: 'checkbox', category: 'General', heritable: false },
            description: { title: 'Description', value: '', type: 'textarea', category: 'Advanced (SEO)', heritable: false },
        },
        // Block/page structure properties
        odePagStructureSyncPropertiesConfig: {
            identifier: { title: 'ID', value: '', type: 'text', category: null, heritable: false },
            visibility: { title: 'Visible in export', value: 'true', type: 'checkbox', category: null, heritable: true },
            teacherOnly: { title: 'Teacher only', value: 'false', type: 'checkbox', category: null, heritable: true },
            allowToggle: { title: 'Allows to minimize/display content', value: 'true', type: 'checkbox', category: null, heritable: true },
            minimized: { title: 'Start minimized', value: 'false', type: 'checkbox', category: null, heritable: true },
            cssClass: { title: 'CSS Class', value: '', type: 'text', category: null, heritable: true },
        },
    };
}

/**
 * Generate the static index.html
 */
function generateStaticHtml(bundleData: object): string {
    const workareaTemplate = fs.readFileSync(
        path.join(projectRoot, 'views/workarea/workarea.njk'),
        'utf-8'
    );

    // Build a simplified static HTML version
    // We can't use Nunjucks at runtime, so we pre-render a static version
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#00a99d">
    <meta name="description" content="Create interactive educational content offline. Open source authoring tool for educators.">
    <title>eXeLearning - Static Editor</title>
    <link rel="icon" type="image/x-icon" href="./favicon.ico">
    <link rel="manifest" href="./manifest.json">
    <link rel="apple-touch-icon" href="./exelearning.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <meta name="apple-mobile-web-app-title" content="eXeLearning">

    <!-- Styles -->
    <link rel="stylesheet" href="./libs/bootstrap/bootstrap.min.css">
    <link rel="stylesheet" href="./style/workarea/main.css">
    <link rel="stylesheet" href="./style/workarea/base.css">
    <link rel="stylesheet" href="./style/workarea/custom.css">
    <link rel="stylesheet" href="./app/common/exe_effects/exe_effects.css">
    <link rel="stylesheet" href="./app/common/exe_games/exe_games.css">
    <link rel="stylesheet" href="./app/common/exe_highlighter/exe_highlighter.css">
    <link rel="stylesheet" href="./app/common/exe_lightbox/exe_lightbox.css">
    <link rel="stylesheet" href="./app/common/exe_media/exe_media.css">
    <link rel="stylesheet" href="./app/common/exe_wikipedia/exe_wikipedia.css">

    <!-- Static mode overrides -->
    <style>
        /* Show exe-online items in static mode (they contain Open and Recent Projects) */
        .exe-online { display: block !important; }
        li.exe-online { display: list-item !important; }
        /* Hide exe-online items that don't make sense in static mode (Save, Share) */
        #navbar-button-save.exe-online,
        #navbar-button-share { display: none !important; }
    </style>
</head>
<body id="main">
    <!-- Static Mode Configuration -->
    <script>
        // Static mode flag
        window.__EXE_STATIC_MODE__ = true;

        // Pre-bundled API data (loaded on demand from bundle.json)
        window.__EXE_STATIC_DATA__ = null;

        // eXeLearning configuration
        window.__APP_ENV__ = "prod";
        window.__APP_DEBUG__ = "0";
        window.__APP_ONLINE_MODE__ = false;

        window.eXeLearning = {
            version: "${buildVersion}",
            expires: "",
            extension: "elpx",
            user: JSON.stringify({
                id: 0,
                username: "guest",
                email: "guest@local",
                roles: ["ROLE_USER"]
            }),
            config: JSON.stringify({
                isOfflineInstallation: true,
                isStaticMode: true,
                locale: navigator.language?.split('-')[0] || 'en',
                basePath: '.',
                baseURL: '.',
                fullURL: '.',
                yjsEnabled: true,
                userStyles: false,
                defaultTheme: 'base',
                themeBaseType: 'base',
                themeTypeBase: 'base',
                themeTypeUser: 'user',
                clientCallWaitingTime: 5000
            }),
            projectId: null
        };

        // MathJax configuration with relative paths for static mode
        // Must be defined BEFORE common.js loads to override version-based path detection
        var externalExtensions = [
            'amscd', 'bbox', 'boldsymbol', 'braket', 'bussproofs', 'cancel',
            'cases', 'centernot', 'color', 'colortbl', 'empheq', 'enclose',
            'extpfeil', 'gensymb', 'html', 'mathtools', 'mhchem', 'noerrors',
            'physics', 'tagformat', 'textcomp', 'unicode', 'upgreek', 'verb',
            'setoptions'
        ];
        window.MathJax = {
            tex: {
                inlineMath: [["\\\\(", "\\\\)"]],
                displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
                processEscapes: true,
                tags: 'ams',
                packages: { '[+]': externalExtensions }
            },
            loader: {
                paths: { mathjax: './app/common/exe_math' },
                load: externalExtensions.map(function(ext) { return '[tex]/' + ext; })
            },
            options: {
                // Exclude navbar dropdown menus from MathJax processing (File, Edit, etc.)
                // Note: nav-element is NOT excluded - page titles with LaTeX must be processed
                ignoreHtmlClass: 'tex2jax_ignore|dropdown-menu|dropdown-item|modal',
                // Skip processing inside these HTML tags
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
            }
        };
    </script>

    <!-- Load Screen (visible by default in static mode) -->
    <div id="load-screen-main" class="load-screen loading" data-testid="loading-main" data-visible="true">
        <span>eXeLearning ${buildVersion}</span>
    </div>

    <!-- Main Workarea Container (visible by default in static mode) -->
    <div id="workarea" class="container-fluid d-flex flex-nowrap" data-preview-pinned="false">
        <aside class="asideleft col-md-4 col-lg-3 bg-light vh-100">
            <div class="content-info">
                <div id="exe-title" class="title-not-editing">
                    <h2 class="exe-title content" id="change_title">...</h2>
                    <button class="btn button-square button-tertiary tertiary-green title-menu-button exe-app-tooltip"
                            data-bs-toggle="tooltip" data-bs-placement="bottom" title="Change title" aria-label="Change title">
                        <span class="exe-icon small-icon edit-icon-green"></span>
                    </button>
                </div>
            </div>
            <div class="accordion" id="menus_content">
                ${generateMenuStructureHtml()}
                ${generateMenuIdevicesHtml()}
            </div>
        </aside>
        <main>
            <header id="head">
                <nav class="navbar bg-transparent">
                    ${generateMenuHeadTopHtml()}
                    ${generateMenuHeadBottomHtml()}
                </nav>
            </header>
            <div id="main-content-wrapper" class="main-content-wrapper">
                <section id="node-content-container" class="exe-content js flex-grow-1 d-flex flex-column">
                    <div id="load-screen-node-content" class="load-screen hide" data-testid="loading-content" data-visible="false"></div>
                    <div id="node-content" class="content" drop='["idevice","box"]' data-testid="node-content" data-ready="false">
                        <div>
                            <div id="header-node-content" class="header"></div>
                            <h1 id="page-title-node-content" class="page-title" data-testid="page-title"></h1>
                        </div>
                    </div>
                    <div id="idevices-bottom" class="idevices-bottom-menu" data-testid="idevices-quickbar"></div>
                </section>
                <aside id="preview-pinned-container" class="preview-pinned" aria-label="Preview">
                    <div class="preview-pinned-header">
                        <h2 class="preview-pinned-title">Preview</h2>
                        <div class="preview-pinned-actions">
                            <button id="preview-pinned-extract-button" class="btn button-square button-tertiary" title="Open in new tab">
                                <span class="small-icon external-link-icon"></span>
                            </button>
                            <button id="preview-unpin-button" class="btn button-square button-tertiary" title="Unpin preview">
                                <span class="small-icon unpin-icon"></span>
                            </button>
                            <button id="preview-pinned-refresh-button" class="btn button-square button-tertiary" title="Refresh preview">
                                <span class="small-icon refresh-icon"></span>
                            </button>
                        </div>
                    </div>
                    <div class="preview-pinned-body">
                        <iframe id="preview-pinned-iframe" class="preview-iframe" title="Content preview"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-presentation"></iframe>
                    </div>
                </aside>
            </div>
        </main>
    </div>

    <!-- Preview Sidebar -->
    <div id="previewsidenav-content" class="preview-panel-container">
        <div id="preview-sidenav-overlay" class="sidenav-overlay"></div>
        <aside id="previewsidenav" class="preview-sidenav" role="complementary">
            <div class="preview-panel-header">
                <h1 class="preview-title">Preview</h1>
                <div class="preview-header-actions">
                    <button id="preview-extract-button" class="btn button-square button-tertiary" title="Open in new tab">
                        <span class="small-icon external-link-icon"></span>
                    </button>
                    <button id="preview-pin-button" class="btn button-square button-tertiary" title="Pin preview">
                        <span class="small-icon pin-icon"></span>
                    </button>
                    <button id="preview-refresh-button" class="btn button-square button-tertiary" title="Refresh preview">
                        <span class="small-icon refresh-icon"></span>
                    </button>
                    <div id="previewsidenavclose" class="navbar-close" role="button" tabindex="0" aria-label="Close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M15 5L5 15M5 5L15 15" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="preview-panel-body">
                <iframe id="preview-iframe" class="preview-iframe" title="Content preview"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-presentation"></iframe>
            </div>
        </aside>
    </div>

    <!-- Styles Sidebar -->
    <div id="stylessidenav-content" class="relative z-50 navbar-menu">
        <div id="sidenav-overlay" class="sidenav-overlay"></div>
        <aside id="stylessidenav" class="sidenav" role="complementary">
            <div class="content-styles-header">
                <h1 class="styles-title">Styles</h1>
                <div id="stylessidenavclose" class="navbar-close">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M15 5L5 15M5 5L15 15" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
            <div class="content-tabs">
                <ul class="nav nav-tabs" id="styleslist" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="exestylescontent-tab" data-bs-toggle="tab"
                                data-bs-target="#exestylescontent" type="button" role="tab"
                                aria-controls="exestylescontent" aria-selected="true">System</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="importedstylescontent-tab" data-bs-toggle="tab"
                                data-bs-target="#importedstylescontent" type="button" role="tab"
                                aria-controls="importedstylescontent" aria-selected="false">Imported</button>
                    </li>
                </ul>
            </div>
            <div class="tab-content mt-3" id="styleslistContent">
                <div class="tab-pane fade show active" id="exestylescontent" role="tabpanel" aria-labelledby="exestylescontent-tab"></div>
                <div class="tab-pane fade" id="importedstylescontent" role="tabpanel" aria-labelledby="importedstylescontent-tab"></div>
            </div>
        </aside>
    </div>

    <!-- Modals Container -->
    <div class="modals-container">
        ${generateModalsHtml()}
    </div>

    <!-- Toasts Container -->
    <div class="toasts-container">
        <div id="toastDefault" class="toast" role="alert" data-bs-autohide="false" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <span class="toast-icon exe-icon rounded me-2">info</span>
                <strong class="toast-title me-auto"></strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body"></div>
        </div>
    </div>

    <!-- External Libraries -->
    <script src="./libs/jquery/jquery.min.js"></script>
    <script src="./libs/jquery-ui/jquery-ui.min.js"></script>
    <script src="./libs/bootstrap/bootstrap.bundle.min.js"></script>
    <script src="./libs/multi-dropdown.js"></script>
    <script src="./libs/interact/interact.min.js"></script>
    <script src="./libs/showdown/showdown.min.js"></script>
    <script src="./libs/fflate/fflate.umd.js"></script>

    <!-- Asset URL Resolver -->
    <script src="./app/common/asset_url_resolver.js"></script>

    <!-- eXeLearning Common -->
    <script type="module" src="./app/common/app_common.js"></script>
    <script src="./app/common/common_i18n.js"></script>
    <script src="./app/common/common_edition.js"></script>
    <script src="./app/common/common.js"></script>
    <script src="./app/common/exe_effects/exe_effects.js"></script>
    <script src="./app/common/exe_games/exe_games.js"></script>
    <script src="./app/common/exe_highlighter/exe_highlighter.js"></script>
    <script src="./app/common/exe_lightbox/exe_lightbox.js"></script>
    <script src="./app/common/exe_media/exe_media.js"></script>
    <script src="./app/common/exe_math/tex-mml-svg.js"></script>
    <script src="./app/common/LatexPreRenderer.js"></script>
    <script src="./app/common/MermaidPreRenderer.js"></script>
    <script src="./app/common/fix_webm_duration/fix_webm_duration.js"></script>
    <script src="./libs/abcjs/exe_abc_music.js"></script>

    <!-- TinyMCE -->
    <script src="./libs/tinymce_5/js/tinymce/tinymce.min.js"></script>
    <script src="./app/editor/tinymce_5_settings.js"></script>

    <!-- Yjs Collaborative Editing -->
    <script src="./libs/yjs/yjs.min.js"></script>
    <script src="./libs/yjs/y-indexeddb.min.js"></script>
    <script src="./app/yjs/yjs-loader.js"></script>

    <!-- Connection Monitor -->
    <script type="module" src="./app/common/connectionMonitor.js"></script>

    <!-- Static Mode Initialization -->
    <script>
        // Load static data bundle
        async function loadStaticData() {
            try {
                const response = await fetch('./data/bundle.json');
                window.__EXE_STATIC_DATA__ = await response.json();
                console.log('[Static] Loaded bundle.json');
            } catch (e) {
                console.error('[Static] Failed to load bundle.json:', e);
                window.__EXE_STATIC_DATA__ = {
                    parameters: { routes: {} },
                    translations: {},
                    idevices: { idevices: [] },
                    themes: { themes: [] }
                };
            }
        }

        // UUID generation with fallback for non-secure contexts
        function generateUUID() {
            // Use crypto.randomUUID if available (secure contexts only)
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            // Fallback using crypto.getRandomValues (works in all contexts)
            if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
                return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
            }
            // Last resort fallback using Math.random (not cryptographically secure)
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }

        // Initialize static mode - auto-start with blank project
        async function initStaticMode() {
            await loadStaticData();

            // Generate UUID and set project ID
            const uuid = generateUUID();
            window.eXeLearning.projectId = uuid;

            // Start the app
            if (window.__startExeApp) {
                window.__startExeApp();
            }

            // Setup File menu handlers after app bundle loads
            setTimeout(() => {
                setupFileMenuHandlers();
            }, 100);
        }

        // Setup File menu handlers for static mode
        function setupFileMenuHandlers() {
            // File > New - create new blank project
            const newBtn = document.getElementById('navbar-button-new');
            if (newBtn) {
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (confirm('Create a new project? Unsaved changes will be lost.')) {
                        window.newProject();
                    }
                });
            }

            // File > Open is handled by navbarFile.js openUserOdeFilesEvent()
            // which detects __EXE_STATIC_MODE__ and uses openFileInputStatic()

            // Populate Recent Projects menu
            populateRecentProjects();
        }

        // Populate recent projects submenu
        async function populateRecentProjects() {
            const recentMenu = document.getElementById('navbar-dropdown-menu-recent-projects');
            if (!recentMenu) return;

            if (window.indexedDB?.databases) {
                try {
                    const dbs = await window.indexedDB.databases();
                    const projects = dbs.filter(db => db.name?.startsWith('exelearning-project-'));

                    if (projects.length > 0) {
                        recentMenu.innerHTML = '';
                        for (const db of projects.slice(0, 10)) {
                            const uuid = db.name.replace('exelearning-project-', '');
                            const li = document.createElement('li');
                            li.innerHTML = \`
                                <a class="dropdown-item" href="#" onclick="event.preventDefault(); openProject('\${uuid}')">
                                    \${uuid.substring(0, 8)}...
                                </a>
                            \`;
                            recentMenu.appendChild(li);
                        }
                    } else {
                        recentMenu.innerHTML = '<li class="dropdown-item text-muted">No recent projects</li>';
                    }
                } catch (e) {
                    console.log('[Static] Could not list IndexedDB databases');
                    recentMenu.innerHTML = '<li class="dropdown-item text-muted">No recent projects</li>';
                }
            }
        }

        // Create new blank project
        window.newProject = function() {
            const uuid = generateUUID();
            window.eXeLearning.projectId = uuid;
            // Reload the page to start fresh
            location.reload();
        };

        // Open existing project from recent list
        window.openProject = async function(uuid) {
            window.eXeLearning.projectId = uuid;
            // Reload the page with the new project ID
            location.reload();
        };

        // Delete project
        window.deleteProject = async function(uuid) {
            if (confirm('Delete this project? This cannot be undone.')) {
                try {
                    await new Promise((resolve, reject) => {
                        const req = indexedDB.deleteDatabase('exelearning-project-' + uuid);
                        req.onsuccess = resolve;
                        req.onerror = reject;
                    });
                    await new Promise((resolve, reject) => {
                        const req = indexedDB.deleteDatabase('exelearning-assets-' + uuid);
                        req.onsuccess = resolve;
                        req.onerror = reject;
                    });
                    populateRecentProjects();
                } catch (e) {
                    console.error('Failed to delete project:', e);
                }
            }
        };

        // Start initialization
        initStaticMode();
    </script>

    <!-- Main Application Bundle -->
    <script src="./app/app.bundle.js"></script>

    <!-- Register Service Worker for PWA -->
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(reg => console.log('[PWA] Service worker registered'))
                    .catch(err => console.log('[PWA] Service worker registration failed:', err));
            });
        }
    </script>
</body>
</html>`;
}

/**
 * Generate PWA manifest.json
 * Creates a complete manifest for installable PWA
 */
function generatePwaManifest(): string {
    return JSON.stringify({
        name: `eXeLearning Editor (${buildVersion})`,
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
        id: `exelearning-${buildVersion}-${buildHash}`,
    }, null, 2);
}

/**
 * Generate service worker
 */
function generateServiceWorker(): string {
    return `/**
 * Service Worker for eXeLearning Static Mode
 * Provides offline-first caching for PWA
 */

const CACHE_NAME = 'exelearning-static-${buildVersion}-${buildHash}';
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

// Fetch: Cache-first strategy
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) {
                    return cached;
                }

                return fetch(event.request).then(response => {
                    // Cache successful responses
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});
`;
}

/**
 * Copy directory recursively
 */
function copyDirRecursive(src: string, dest: string, exclude: string[] = []) {
    if (!fs.existsSync(src)) {
        console.warn(`Source not found: ${src}`);
        return;
    }

    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (exclude.includes(entry.name)) continue;

        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath, exclude);
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
    fs.writeFileSync(
        path.join(dataDir, 'bundle.json'),
        JSON.stringify(bundleData, null, 2)
    );
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
    copyDirRecursive(
        path.join(projectRoot, 'public/app'),
        path.join(outputDir, 'app'),
        ['test', 'spec']
    );
    console.log('  Copied app/');

    // Copy libs folder
    copyDirRecursive(
        path.join(projectRoot, 'public/libs'),
        path.join(outputDir, 'libs')
    );
    console.log('  Copied libs/');

    // Copy style folder
    copyDirRecursive(
        path.join(projectRoot, 'public/style'),
        path.join(outputDir, 'style')
    );
    console.log('  Copied style/');

    // Copy bundles folder (pre-built resource ZIPs)
    copyDirRecursive(
        path.join(projectRoot, 'public/bundles'),
        path.join(outputDir, 'bundles')
    );
    console.log('  Copied bundles/');

    // Copy files/perm (themes, iDevices, favicon)
    copyDirRecursive(
        path.join(projectRoot, 'public/files/perm'),
        path.join(outputDir, 'files/perm')
    );
    console.log('  Copied files/perm/');

    // Copy images folder (default-avatar.svg, logo.svg, etc.)
    copyDirRecursive(
        path.join(projectRoot, 'public/images'),
        path.join(outputDir, 'images')
    );
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

    console.log('\n' + '='.repeat(60));
    console.log('Static distribution built successfully!');
    console.log(`Output: ${outputDir}`);
    console.log('='.repeat(60));
}

// Run build
buildStaticBundle().catch(console.error);
