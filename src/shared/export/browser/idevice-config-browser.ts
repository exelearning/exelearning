/**
 * Browser-compatible iDevice Configuration
 *
 * This is a browser shim for src/services/idevice-config.ts
 * In the browser, we can't read config.xml files from the filesystem,
 * so we provide sensible defaults based on the idevice type name.
 */

export interface IdeviceConfigCache {
    cssClass: string;
    componentType: 'json' | 'html';
    template: string;
}

/**
 * Get iDevice configuration for browser rendering
 * Returns sensible defaults based on the type name
 *
 * @param type - iDevice type (e.g., 'text', 'FreeTextIdevice', 'multi-choice')
 * @returns Configuration object
 */
export function getIdeviceConfig(type: string): IdeviceConfigCache {
    // Normalize type name - remove 'Idevice' suffix and convert to lowercase
    const normalized = type
        .replace(/Idevice$/i, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, ''); // Remove leading hyphen

    // Map common legacy types to their CSS class
    const typeMap: Record<string, string> = {
        'text': 'text',
        'freetext': 'text',
        'freetextfpd': 'text',
        'generic': 'text',
        'reflection': 'text',
        'reflectionfpd': 'text',
        'multi-choice': 'multi-choice',
        'multichoice': 'multi-choice',
        'true-false': 'true-false',
        'truefalse': 'true-false',
        'cloze': 'cloze',
        'clozeactivity': 'cloze',
        'case-study': 'casestudy',
        'casestudy': 'casestudy',
    };

    const cssClass = typeMap[normalized] || normalized || 'text';

    // JSON idevices need JS initialization via renderView()
    // These idevices store data in jsonProperties and have export JS that renders from JSON
    // The data-idevice-json-data attribute is added for these types
    const jsonIdevices = [
        // Text-type iDevices
        'text',
        'freetext',
        'freetextfpd',
        'generic',
        'reflection',
        'reflectionfpd',
        // iDevices with <component-type>json</component-type> in config.xml
        'image-gallery',
        'form',
        'casestudy',
        'case-study',
        'example',
        'trueorfalse',
        'true-or-false',
        'scrambled-list',
        'magnifier',
    ];
    const isJson = jsonIdevices.includes(cssClass) || jsonIdevices.includes(normalized);

    return {
        cssClass,
        componentType: isJson ? 'json' : 'html',
        template: `${cssClass}.html`,
    };
}

/**
 * Check if an iDevice type uses JSON properties
 * @param type - iDevice type
 * @returns true if JSON-based
 */
export function isJsonIdevice(type: string): boolean {
    const jsonTypes = [
        'multi-choice',
        'multichoice',
        'true-false',
        'truefalse',
        'cloze',
        'clozeactivity',
        'drag-and-drop',
        'draganddrop',
        'fill-blanks',
        'fillblanks',
        'matching',
        'ordering',
    ];
    const normalized = type
        .toLowerCase()
        .replace(/idevice$/i, '')
        .replace(/-/g, '');
    return jsonTypes.some(t => t.replace(/-/g, '') === normalized);
}

// Stub functions that would be used in Node.js environment
export function loadIdeviceConfigs(): void {
    // No-op in browser - configs are derived from type names
}

export function resetIdeviceConfigCache(): void {
    // No-op in browser
}

export function setIdevicesBasePath(): void {
    // No-op in browser
}

/**
 * Known iDevice dependencies that need to be loaded alongside the main file.
 * This is a static mapping for browser context where we can't scan the filesystem.
 * Key is the iDevice type name, value is array of additional JS files.
 */
const IDEVICE_JS_DEPENDENCIES: Record<string, string[]> = {
    checklist: ['html2canvas.js'],
    'progress-report': ['html2canvas.js'],
    'select-media-files': ['mansory-jq.js'],
    'image-gallery': ['simple-lightbox.min.js'],
};

/**
 * Known CSS dependencies for iDevices.
 * Key is the iDevice type name, value is array of additional CSS files.
 */
const IDEVICE_CSS_DEPENDENCIES: Record<string, string[]> = {
    'image-gallery': ['simple-lightbox.min.css'],
};

/**
 * Get all export files for an iDevice type (JS or CSS)
 * In browser context, we use a static mapping of known dependencies.
 *
 * @param typeName - The iDevice type name (e.g., 'checklist')
 * @param extension - The file extension ('.js' or '.css')
 * @returns Array of filenames (e.g., ['checklist.js', 'html2canvas.js'])
 */
export function getIdeviceExportFiles(typeName: string, extension: '.js' | '.css'): string[] {
    const mainFile = `${typeName}${extension}`;

    if (extension === '.js') {
        const dependencies = IDEVICE_JS_DEPENDENCIES[typeName] || [];
        return [mainFile, ...dependencies];
    }

    // For CSS, check for known dependencies (e.g., SimpleLightbox for image-gallery)
    const cssDependencies = IDEVICE_CSS_DEPENDENCIES[typeName] || [];
    return [mainFile, ...cssDependencies];
}
