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
        'case-study': 'case-study',
        'casestudy': 'case-study',
    };

    const cssClass = typeMap[normalized] || normalized || 'text';

    return {
        cssClass,
        componentType: 'html', // Default to HTML for browser rendering
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
