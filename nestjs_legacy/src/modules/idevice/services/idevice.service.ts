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

export interface IDeviceIcon {
    name: string;
    url: string | null; // Can be null for exe-icon type
    type: string;
}

export interface IDevice {
    name: string;
    dirName: string;
    title: string;
    cssClass: string;
    category: string;
    icon: IDeviceIcon;
    url: string;
    version?: string;
    componentType?: string;
    editionJs: string[];
    editionCss: string[];
    exportJs: string[];
    exportCss: string[];
    exportTemplateFilename?: string;
    exportTemplateContent?: string;
    enabled: boolean;
    visible: boolean;
    downloadable?: string;
}

@Injectable()
export class IDeviceService {
    private readonly idevicesBasePath: string;
    private readonly xmlParser: XMLParser;

    constructor() {
        // Path to iDevices directory
        this.idevicesBasePath = path.join(
            process.cwd(),
            'public',
            'files',
            'perm',
            'idevices',
            'base',
        );

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
     * Get all installed iDevices by scanning the filesystem
     */
    async getInstalledIDevices(): Promise<IDevice[]> {
        try {
            // Check if idevices directory exists
            if (!(await fs.pathExists(this.idevicesBasePath))) {
                console.warn(`iDevices directory not found: ${this.idevicesBasePath}`);
                return [];
            }

            // Read all directories in base idevices path
            const entries = await fs.readdir(this.idevicesBasePath, {
                withFileTypes: true,
            });

            const idevices: IDevice[] = [];

            for (const entry of entries) {
                // Skip non-directories and hidden files
                if (!entry.isDirectory() || entry.name.startsWith('.')) {
                    continue;
                }

                const idevicePath = path.join(this.idevicesBasePath, entry.name);
                const configPath = path.join(idevicePath, 'config.xml');

                // Check if config.xml exists
                if (!(await fs.pathExists(configPath))) {
                    continue;
                }

                try {
                    // Parse config.xml
                    const idevice = await this.parseIDeviceConfig(entry.name, configPath);
                    if (idevice) {
                        idevices.push(idevice);
                    }
                } catch (error) {
                    console.warn(
                        `Failed to parse iDevice config for ${entry.name}:`,
                        error.message,
                    );
                }
            }

            // Sort iDevices by title
            idevices.sort((a, b) => a.title.localeCompare(b.title));

            return idevices;
        } catch (error) {
            console.error('Error loading installed iDevices:', error);
            return [];
        }
    }

    /**
     * Parse an iDevice config.xml file
     */
    private async parseIDeviceConfig(dirName: string, configPath: string): Promise<IDevice | null> {
        try {
            const xmlContent = await fs.readFile(configPath, 'utf-8');
            const parsed = this.xmlParser.parse(xmlContent);

            if (!parsed.idevice) {
                return null;
            }

            const config = parsed.idevice;

            // Extract icon information
            // Symfony DTO logic: icon can be either a string or an object
            let icon: IDeviceIcon;
            if (typeof config.icon === 'string') {
                // Icon is just a string (e.g., "groups") - use exe-icon type
                icon = {
                    name: config.icon,
                    url: null,
                    type: 'exe-icon',
                };
            } else if (config.icon && typeof config.icon === 'object') {
                // Icon is an object with url property
                const iconFileName = config.icon.url || `${dirName}-icon.svg`;
                icon = {
                    name: config.icon.name || dirName,
                    url: iconFileName, // Just the filename, not the full path
                    type: config.icon.type || 'img',
                };
            } else {
                // No icon specified, use default
                icon = {
                    name: dirName,
                    url: `${dirName}-icon.svg`,
                    type: 'img',
                };
            }

            // Build iDevice object matching Symfony format
            // URL includes version for cache busting: /{version}/files/perm/idevices/base/{dirName}
            // NOTE: basePath is NOT included here because frontend adds it via symfonyURL in idevice.js
            const version = getAppVersion();
            const idevice: IDevice = {
                name: dirName,
                dirName: dirName,
                title: config.title || dirName,
                cssClass: config['css-class'] || config.cssClass || dirName,
                category: config.category || 'General',
                componentType: config['component-type'] || 'html',
                icon: icon,
                url: `/${version}/files/perm/idevices/base/${dirName}`,
                enabled: true,
                visible: true,
                downloadable: config.downloadable || '0',
                // Initialize arrays - frontend expects these to always be arrays
                editionJs: [],
                editionCss: [],
                exportJs: [],
                exportCss: [],
            };

            // Add optional fields if present
            if (config.version) {
                idevice.version = config.version;
            }

            // Parse JS/CSS files from config
            // XML tags use hyphens (edition-js), and contain objects with 'filename' field
            // When XML has multiple <filename> elements, fast-xml-parser returns { filename: [...] }
            const extractFilenames = (data: any): string[] => {
                if (!data) return [];
                if (Array.isArray(data)) {
                    return data.map((item) =>
                        typeof item === 'object' && item.filename ? item.filename : String(item),
                    );
                }
                if (typeof data === 'object' && data.filename) {
                    // data.filename can be a single string or array of strings
                    if (Array.isArray(data.filename)) {
                        return data.filename;
                    }
                    return [data.filename];
                }
                return [String(data)];
            };

            // Extract JS/CSS filenames from config, or use defaults based on dirName
            // This matches Symfony behavior where iDevices without explicit files use {name}.js/{name}.css
            const editionJs = extractFilenames(config['edition-js']);
            const editionCss = extractFilenames(config['edition-css']);
            const exportJs = extractFilenames(config['export-js']);
            const exportCss = extractFilenames(config['export-css']);

            // Apply defaults when config doesn't specify files (most iDevices don't)
            idevice.editionJs = editionJs.length > 0 ? editionJs : [`${dirName}.js`];
            idevice.editionCss = editionCss.length > 0 ? editionCss : [`${dirName}.css`];
            idevice.exportJs = exportJs.length > 0 ? exportJs : [`${dirName}.js`];
            idevice.exportCss = exportCss.length > 0 ? exportCss : [`${dirName}.css`];

            // Load export template HTML file
            // Determine template filename from config or use default
            const templateFilename = config['export-template-filename'] || `${dirName}.html`;
            const templatePath = path.join(
                this.idevicesBasePath,
                dirName,
                'export',
                templateFilename,
            );

            // Check if template file exists and load it
            if (await fs.pathExists(templatePath)) {
                try {
                    idevice.exportTemplateFilename = templateFilename;
                    // Read and trim template content (matching Symfony behavior)
                    const templateContent = await fs.readFile(templatePath, 'utf-8');
                    idevice.exportTemplateContent = templateContent.trim();
                } catch (error) {
                    console.warn(`Failed to load export template for ${dirName}: ${error.message}`);
                }
            }

            return idevice;
        } catch (error) {
            console.error(`Error parsing iDevice config ${configPath}:`, error);
            return null;
        }
    }

    /**
     * Get a specific iDevice by name
     */
    async getIDeviceByName(name: string): Promise<IDevice | null> {
        const idevices = await this.getInstalledIDevices();
        return idevices.find((idev) => idev.name === name) || null;
    }
}
