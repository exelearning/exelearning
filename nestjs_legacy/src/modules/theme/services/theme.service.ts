import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Find package.json by traversing up from current directory
const findPackageJson = (): any => {
    let currentDir = __dirname;
    for (let i = 0; i < 10; i++) {
        const packagePath = join(currentDir, 'package.json');
        if (existsSync(packagePath)) {
            return JSON.parse(readFileSync(packagePath, 'utf-8'));
        }
        currentDir = join(currentDir, '..');
    }
    return { version: 'unknown' };
};

const packageJson = findPackageJson();

// Get version from APP_VERSION env var or package.json (with 'v' prefix)
const getAppVersion = () => process.env.APP_VERSION || `v${packageJson.version}`;

export interface ThemeIcon {
    id: string;
    title: string;
    type: string;
    value: string;
}

export interface Theme {
    name: string;
    dirName: string;
    displayName: string;
    title: string;
    url: string;
    type: string; // 'base' for system themes, 'user' for uploaded themes
    version?: string;
    compatibility?: string;
    author?: string;
    license?: string;
    licenseUrl?: string;
    description?: string;
    downloadable?: string;
    preview?: string;
    cssFiles?: string[];
    js?: string[];
    icons?: Record<string, ThemeIcon>;
    logoImg?: string; // Logo image filename (from config.xml)
    logoImgUrl?: string; // Full URL path to logo image
    headerImg?: string; // Header image filename (from config.xml)
    headerImgUrl?: string; // Full URL path to header image
    textColor?: string; // Text color from config.xml
    linkColor?: string; // Link color from config.xml
}

@Injectable()
export class ThemeService {
    private readonly themesBasePath: string;
    private readonly themesUserPath: string;
    private readonly xmlParser: XMLParser;

    constructor() {
        // Path to base themes directory
        this.themesBasePath = path.join(process.cwd(), 'public', 'files', 'perm', 'themes', 'base');
        // Path to user themes directory
        this.themesUserPath = path.join(process.cwd(), 'public', 'files', 'perm', 'themes', 'users');

        // Configure XML parser
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true,
            trimValues: true,
        });
    }

    /**
     * Get all installed themes by scanning both base and user directories
     */
    async getInstalledThemes(): Promise<Theme[]> {
        try {
            const baseThemes = await this.getBaseThemes();
            const userThemes = await this.getUserThemes();

            // Combine and sort by display name
            const allThemes = [...baseThemes, ...userThemes];
            allThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return allThemes;
        } catch (error) {
            console.error('Error loading installed themes:', error);
            return [];
        }
    }

    /**
     * Get base (system) themes
     */
    async getBaseThemes(): Promise<Theme[]> {
        return this.scanThemesDirectory(this.themesBasePath, 'base');
    }

    /**
     * Get user-uploaded themes
     */
    async getUserThemes(): Promise<Theme[]> {
        return this.scanThemesDirectory(this.themesUserPath, 'user');
    }

    /**
     * Scan a themes directory and return all valid themes
     */
    private async scanThemesDirectory(themesPath: string, type: 'base' | 'user'): Promise<Theme[]> {
        try {
            // Check if themes directory exists
            if (!(await fs.pathExists(themesPath))) {
                return [];
            }

            // Read all directories
            const entries = await fs.readdir(themesPath, {
                withFileTypes: true,
            });

            const themes: Theme[] = [];

            for (const entry of entries) {
                // Skip non-directories and hidden files
                if (!entry.isDirectory() || entry.name.startsWith('.')) {
                    continue;
                }

                const themePath = path.join(themesPath, entry.name);
                const configPath = path.join(themePath, 'config.xml');

                // Check if config.xml exists
                if (!(await fs.pathExists(configPath))) {
                    continue;
                }

                try {
                    // Parse config.xml
                    const theme = await this.parseThemeConfig(entry.name, configPath, type);
                    if (theme) {
                        themes.push(theme);
                    }
                } catch (error) {
                    console.warn(`Failed to parse theme config for ${entry.name}:`, error.message);
                }
            }

            return themes;
        } catch (error) {
            console.error(`Error loading themes from ${themesPath}:`, error);
            return [];
        }
    }

    /**
     * Check if a theme is installed (by name or dirName)
     */
    async isThemeInstalled(themeName: string): Promise<boolean> {
        const themes = await this.getInstalledThemes();
        return themes.some(t => t.name === themeName || t.dirName === themeName);
    }

    /**
     * Import a theme from a session's extracted ELP package
     * @param sessionTempDir - Path to the session's temp directory where ELP was extracted
     * @param themeName - Name for the imported theme
     * @returns Result with success status and imported theme
     */
    async importThemeFromSession(
        sessionTempDir: string,
        themeName: string,
    ): Promise<{ success: boolean; message: string; theme?: Theme }> {
        const sourceThemeDir = path.join(sessionTempDir, 'theme');
        const configPath = path.join(sourceThemeDir, 'config.xml');

        // Verify that theme directory exists
        if (!(await fs.pathExists(sourceThemeDir))) {
            return { success: false, message: 'Theme directory not found in package' };
        }

        // Verify config.xml exists
        if (!(await fs.pathExists(configPath))) {
            return { success: false, message: 'Theme configuration not found' };
        }

        try {
            // Parse config.xml to verify it's valid and check if downloadable
            const xmlContent = await fs.readFile(configPath, 'utf-8');
            const parsed = this.xmlParser.parse(xmlContent);

            if (!parsed.theme) {
                return { success: false, message: 'Invalid theme configuration' };
            }

            // Check if theme is installable (downloadable property)
            const isDownloadable = parsed.theme.downloadable === '1' ||
                                   parsed.theme.downloadable === 1 ||
                                   parsed.theme.downloadable === true;
            if (!isDownloadable) {
                return { success: false, message: 'Theme is not installable' };
            }

            // Determine the target directory name
            const targetDirName = themeName || parsed.theme.name || path.basename(sessionTempDir);
            const targetThemeDir = path.join(this.themesUserPath, targetDirName);

            // Ensure user themes directory exists
            await fs.ensureDir(this.themesUserPath);

            // Copy theme directory (overwrite if exists)
            await fs.copy(sourceThemeDir, targetThemeDir, { overwrite: true });

            // Parse the newly installed theme
            const newConfigPath = path.join(targetThemeDir, 'config.xml');
            const theme = await this.parseThemeConfig(targetDirName, newConfigPath, 'user');

            if (!theme) {
                return { success: false, message: 'Failed to parse imported theme' };
            }

            return { success: true, message: 'OK', theme };
        } catch (error) {
            console.error('Error importing theme:', error);
            return { success: false, message: `Installation failed: ${error.message}` };
        }
    }

    /**
     * Parse a theme config.xml file
     * @param dirName - Directory name of the theme
     * @param configPath - Path to config.xml
     * @param type - 'base' for system themes, 'user' for user-uploaded themes
     */
    private async parseThemeConfig(
        dirName: string,
        configPath: string,
        type: 'base' | 'user' = 'base',
    ): Promise<Theme | null> {
        try {
            const xmlContent = await fs.readFile(configPath, 'utf-8');
            const parsed = this.xmlParser.parse(xmlContent);

            if (!parsed.theme) {
                return null;
            }

            const config = parsed.theme;
            const themePath = path.dirname(configPath);

            // Build theme object matching Symfony format
            // URL includes version for cache busting
            // NOTE: basePath is NOT included here because frontend adds it via symfonyURL in theme.js
            const version = getAppVersion();
            const themeBasePath = type === 'base'
                ? `/${version}/files/perm/themes/base/${dirName}`
                : `/${version}/files/perm/themes/users/${dirName}`;
            const previewPath = type === 'base'
                ? `/${version}/style/${dirName}/preview.png`
                : `${themeBasePath}/preview.png`;

            const theme: Theme = {
                name: config.name || dirName,
                dirName: dirName,
                displayName: config.title || config.name || dirName,
                title: config.title || config.name || dirName,
                preview: previewPath,
                url: themeBasePath,
                type: type,
            };

            // Add optional fields
            if (config.version) {
                theme.version = config.version;
            }
            if (config.compatibility) {
                theme.compatibility = config.compatibility;
            }
            if (config.author) {
                theme.author = config.author;
            }
            if (config.license) {
                theme.license = config.license;
            }
            if (config['license-url'] || config.licenseUrl) {
                theme.licenseUrl = config['license-url'] || config.licenseUrl;
            }
            if (config.description) {
                theme.description = config.description;
            }
            if (config.downloadable) {
                theme.downloadable = config.downloadable;
            }

            // Parse logo and header images (used by frontend for page header rendering)
            // NOTE: basePath is NOT included here because frontend adds it where needed
            if (config['logo-img'] || config.logoImg) {
                theme.logoImg = config['logo-img'] || config.logoImg;
                theme.logoImgUrl = `${themeBasePath}/img/${theme.logoImg}`;
            }
            if (config['header-img'] || config.headerImg) {
                theme.headerImg = config['header-img'] || config.headerImg;
                theme.headerImgUrl = `${themeBasePath}/img/${theme.headerImg}`;
            }

            // Parse color configuration
            if (config['text-color'] || config.textColor) {
                theme.textColor = config['text-color'] || config.textColor;
            }
            if (config['link-color'] || config.linkColor) {
                theme.linkColor = config['link-color'] || config.linkColor;
            }

            // Scan for CSS files (frontend expects 'cssFiles' key)
            theme.cssFiles = await this.scanThemeFiles(themePath, '.css');

            // Scan for JS files
            theme.js = await this.scanThemeFiles(themePath, '.js');

            // Scan for icons (pass theme URL for building icon paths)
            theme.icons = await this.scanThemeIcons(themePath, theme.url);

            return theme;
        } catch (error) {
            console.error(`Error parsing theme config ${configPath}:`, error);
            return null;
        }
    }

    /**
     * Scan theme directory for files with specific extension
     */
    private async scanThemeFiles(themePath: string, extension: string): Promise<string[]> {
        try {
            const files: string[] = [];
            const entries = await fs.readdir(themePath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith(extension)) {
                    files.push(entry.name);
                }
            }

            return files;
        } catch (error) {
            return [];
        }
    }

    /**
     * Scan theme directory for icon files
     * Returns icons as an object keyed by icon id, matching Symfony legacy format
     */
    private async scanThemeIcons(
        themePath: string,
        themeUrl: string,
    ): Promise<Record<string, ThemeIcon>> {
        try {
            const iconsPath = path.join(themePath, 'icons');

            if (!(await fs.pathExists(iconsPath))) {
                return {};
            }

            const entries = await fs.readdir(iconsPath, { withFileTypes: true });
            const icons: Record<string, ThemeIcon> = {};

            for (const entry of entries) {
                if (
                    entry.isFile() &&
                    (entry.name.endsWith('.png') ||
                        entry.name.endsWith('.svg') ||
                        entry.name.endsWith('.gif') ||
                        entry.name.endsWith('.jpg') ||
                        entry.name.endsWith('.jpeg'))
                ) {
                    // Icon id is filename without extension (matching Symfony behavior)
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
        } catch (error) {
            return {};
        }
    }

    /**
     * Get a specific theme by name
     */
    async getThemeByName(name: string): Promise<Theme | null> {
        const themes = await this.getInstalledThemes();
        return themes.find((theme) => theme.name === name) || null;
    }
}
