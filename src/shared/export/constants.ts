/**
 * Unified Export System - Constants
 *
 * Contains library patterns and export format constants.
 * These are used by both frontend (browser) and backend (CLI) export code.
 *
 * NOTE: iDevice configs are now loaded dynamically from config.xml files
 * via src/services/idevice-config.ts
 */

import type { LibraryPattern } from './interfaces';

// =============================================================================
// Export Formats
// =============================================================================

/**
 * Supported export formats
 */
export enum ExportFormat {
    HTML5 = 'html5',
    HTML5_SINGLE_PAGE = 'html5-sp',
    SCORM_12 = 'scorm12',
    SCORM_2004 = 'scorm2004',
    IMS = 'ims',
    EPUB3 = 'epub3',
    ELPX = 'elpx',
}

/**
 * Export format metadata
 */
export const EXPORT_FORMAT_INFO: Record<
    ExportFormat,
    { name: string; extension: string; suffix: string; description: string }
> = {
    [ExportFormat.HTML5]: {
        name: 'HTML5 Website',
        extension: '.zip',
        suffix: '_web',
        description: 'Multi-page HTML5 website',
    },
    [ExportFormat.HTML5_SINGLE_PAGE]: {
        name: 'HTML5 Single Page',
        extension: '.zip',
        suffix: '_sp',
        description: 'Single-page HTML5 with anchor navigation',
    },
    [ExportFormat.SCORM_12]: {
        name: 'SCORM 1.2',
        extension: '.zip',
        suffix: '_scorm',
        description: 'SCORM 1.2 package for LMS',
    },
    [ExportFormat.SCORM_2004]: {
        name: 'SCORM 2004',
        extension: '.zip',
        suffix: '_scorm2004',
        description: 'SCORM 2004 package for LMS',
    },
    [ExportFormat.IMS]: {
        name: 'IMS Content Package',
        extension: '.zip',
        suffix: '_ims',
        description: 'IMS Content Package standard',
    },
    [ExportFormat.EPUB3]: {
        name: 'EPUB3',
        extension: '.epub',
        suffix: '',
        description: 'EPUB3 ebook format',
    },
    [ExportFormat.ELPX]: {
        name: 'eXeLearning Project',
        extension: '.elpx',
        suffix: '',
        description: 'Native eXeLearning project format',
    },
};

// NOTE: IDEVICE_CONFIGS and getIdeviceConfig() have been moved to src/services/idevice-config.ts
// The configs are now loaded dynamically from config.xml files for each iDevice
// Re-export for backwards compatibility
export { getIdeviceConfig } from '../../services/idevice-config';

// =============================================================================
// Legacy iDevice Type Mapping
// =============================================================================

/**
 * Maps legacy iDevice type names to current names
 * Used to support ELP files created with older eXeLearning versions
 */
export const LEGACY_IDEVICE_MAPPING: Record<string, string> = {
    'download-package': 'download-source-file',
    // Add more legacy mappings as discovered
};

// =============================================================================
// Library Patterns (for detecting required JS/CSS libraries)
// =============================================================================

/**
 * Library detection patterns
 * Used to scan HTML content and determine which libraries to include
 */
export const LIBRARY_PATTERNS: LibraryPattern[] = [
    // Effects library (animations, transitions)
    {
        name: 'exe_effects',
        type: 'class',
        pattern: 'exe-fx',
        files: ['exe_effects/exe_effects.js', 'exe_effects/exe_effects.css'],
    },

    // Games library
    {
        name: 'exe_games',
        type: 'class',
        pattern: 'exe-game',
        files: ['exe_games/exe_games.js', 'exe_games/exe_games.css'],
    },

    // Code highlighting
    {
        name: 'exe_highlighter',
        type: 'class',
        pattern: 'highlighted-code',
        files: ['exe_highlighter/exe_highlighter.js', 'exe_highlighter/exe_highlighter.css'],
    },

    // Lightbox for images
    // isDirectory: true to include sprite images (PNG, GIF) referenced from CSS
    {
        name: 'exe_lightbox',
        type: 'rel',
        pattern: 'lightbox',
        files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
        isDirectory: true,
    },

    // Lightbox for image galleries
    // isDirectory: true to include sprite images (PNG, GIF) referenced from CSS
    {
        name: 'exe_lightbox_gallery',
        type: 'class',
        pattern: 'imageGallery',
        files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
        isDirectory: true,
    },

    // Tooltips (qTip2)
    {
        name: 'exe_tooltips',
        type: 'class',
        pattern: 'exe-tooltip',
        files: [
            'exe_tooltips/exe_tooltips.js',
            'exe_tooltips/jquery.qtip.min.js',
            'exe_tooltips/jquery.qtip.min.css',
            'exe_tooltips/imagesloaded.pkg.min.js',
        ],
    },

    // Image magnifier
    {
        name: 'exe_magnify',
        type: 'class',
        pattern: 'ImageMagnifierIdevice',
        files: ['exe_magnify/mojomagnify.js'],
    },

    // Wikipedia content styling
    {
        name: 'exe_wikipedia',
        type: 'class',
        pattern: 'exe-wikipedia-content',
        files: ['exe_wikipedia/exe_wikipedia.css'],
    },

    // Media player (MediaElement.js)
    {
        name: 'exe_media',
        type: 'class',
        pattern: 'mediaelement',
        files: [
            'exe_media/exe_media.js',
            'exe_media/exe_media.css',
            'exe_media/exe_media_background.png',
            'exe_media/exe_media_bigplay.png',
            'exe_media/exe_media_bigplay.svg',
            'exe_media/exe_media_controls.png',
            'exe_media/exe_media_controls.svg',
            'exe_media/exe_media_loading.gif',
        ],
    },

    // Media player via audio/video file links with lightbox
    {
        name: 'exe_media_link',
        type: 'regex',
        pattern: /href="[^"]*\.(mp3|mp4|flv|ogg|ogv)"[^>]*rel="[^"]*lightbox/i,
        files: [
            'exe_media/exe_media.js',
            'exe_media/exe_media.css',
            'exe_media/exe_media_background.png',
            'exe_media/exe_media_bigplay.png',
            'exe_media/exe_media_bigplay.svg',
            'exe_media/exe_media_controls.png',
            'exe_media/exe_media_controls.svg',
            'exe_media/exe_media_loading.gif',
        ],
    },

    // ABC Music notation (abcjs)
    {
        name: 'abcjs',
        type: 'class',
        pattern: 'abc-music',
        files: ['abcjs/abcjs-basic-min.js', 'abcjs/exe_abc_music.js', 'abcjs/abcjs-audio.css'],
    },

    // LaTeX math expressions (MathJax)
    // Includes entire exe_math directory for dynamic extension loading and context menu
    {
        name: 'exe_math',
        type: 'regex',
        pattern: /\\\(|\\\[/,
        files: ['exe_math'],
        isDirectory: true,
    },

    // DataGame with encrypted LaTeX (special case)
    {
        name: 'exe_math_datagame',
        type: 'class',
        pattern: 'DataGame',
        files: ['exe_math'],
        isDirectory: true,
        requiresLatexCheck: true,
    },

    // Pre-rendered math with MathML (already converted from LaTeX to SVG+MathML)
    // This enables MathJax accessibility features (right-click menu, screen reader support)
    {
        name: 'exe_math_mathml',
        type: 'regex',
        pattern: /<math[\s>]/i,
        files: ['exe_math'],
        isDirectory: true,
    },

    // NOTE: Mermaid library is NOT included in exports.
    // Mermaid diagrams are always pre-rendered to static SVG (class="exe-mermaid-rendered")
    // before export, so the ~2.7MB mermaid.min.js library is never needed.
    // The MermaidPreRenderer.js handles conversion in the workarea.

    // jQuery UI for sortable/draggable iDevices
    {
        name: 'jquery_ui_ordena',
        type: 'class',
        pattern: 'ordena-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_clasifica',
        type: 'class',
        pattern: 'clasifica-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_relaciona',
        type: 'class',
        pattern: 'relaciona-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_dragdrop',
        type: 'class',
        pattern: 'dragdrop-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_completa',
        type: 'class',
        pattern: 'completa-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },

    // Accessibility toolbar
    // isDirectory: true to include font files (woff, woff2) and icon (png) referenced from CSS
    {
        name: 'exe_atools',
        type: 'class',
        pattern: 'exe-atools',
        files: ['exe_atools/exe_atools.js', 'exe_atools/exe_atools.css'],
        isDirectory: true,
    },

    // ELPX download support (for download-source-file iDevice)
    // Includes fflate for client-side ZIP generation
    {
        name: 'exe_elpx_download',
        type: 'class',
        pattern: 'exe-download-package-link',
        files: ['fflate/fflate.umd.js', 'exe_elpx_download/exe_elpx_download.js'],
    },
    // ELPX download support for manual links using exe-package:elp protocol
    {
        name: 'exe_elpx_download_protocol',
        type: 'regex',
        pattern: /exe-package:elp/,
        files: ['fflate/fflate.umd.js', 'exe_elpx_download/exe_elpx_download.js'],
    },
];

// =============================================================================
// Base Libraries (always included in exports)
// =============================================================================

/**
 * Base libraries always included in exports
 * Order matters: jQuery must load before Bootstrap
 */
export const BASE_LIBRARIES = [
    // jQuery
    'jquery/jquery.min.js',
    // Common eXe scripts
    'common_i18n.js',
    'common.js',
    'exe_export.js',
    // Bootstrap (JS bundle includes Popper)
    'bootstrap/bootstrap.bundle.min.js',
    'bootstrap/bootstrap.bundle.min.js.map',
    'bootstrap/bootstrap.min.css',
    'bootstrap/bootstrap.min.css.map',
] as const;

/**
 * SCORM-specific libraries
 */
export const SCORM_LIBRARIES = ['scorm/SCORM_API_wrapper.js', 'scorm/SCOFunctions.js'] as const;

// =============================================================================
// MIME Type to Extension Mapping
// =============================================================================

/**
 * MIME type to file extension mapping
 */
export const MIME_TO_EXTENSION: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/x-icon': '.ico',
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/webm': '.weba',
    'application/zip': '.zip',
    'application/json': '.json',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/css': '.css',
    'application/javascript': '.js',
    'application/octet-stream': '.bin',
};

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mime: string): string {
    return MIME_TO_EXTENSION[mime] || '.bin';
}

// =============================================================================
// License Registry (Single Source of Truth)
// =============================================================================

/**
 * License entry in the registry
 */
export interface LicenseEntry {
    /** Full display name with version and short code */
    displayName: string;
    /** Official license URL (empty if none) */
    url: string;
    /** CSS class for license icon (only CC and propietary have icons in themes) */
    cssClass: string;
    /** If true, license is preserved but not selectable in dropdown (legacy from older eXe versions) */
    legacy?: boolean;
    /** If true, no license section is shown in export footer (e.g., propietary, not appropriate) */
    hideInFooter?: boolean;
}

/**
 * Central registry of all supported licenses.
 * This is the single source of truth - all other license mappings derive from this.
 *
 * Includes:
 * - CC 4.0 licenses (current)
 * - CC 3.0 licenses (legacy support)
 * - CC 2.5 licenses (legacy support)
 * - GNU/GPL licenses
 * - EUPL license
 * - GFDL license
 * - Other license types
 */
export const LICENSE_REGISTRY: Record<string, LicenseEntry> = {
    // === Creative Commons 4.0 (Current) ===
    'creative commons: attribution 4.0': {
        displayName: 'creative commons: attribution 4.0 (BY)',
        url: 'https://creativecommons.org/licenses/by/4.0/',
        cssClass: 'cc',
    },
    'creative commons: attribution - share alike 4.0': {
        displayName: 'creative commons: attribution - share alike 4.0 (BY-SA)',
        url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        cssClass: 'cc cc-by-sa',
    },
    'creative commons: attribution - non derived work 4.0': {
        displayName: 'creative commons: attribution - non derived work 4.0 (BY-ND)',
        url: 'https://creativecommons.org/licenses/by-nd/4.0/',
        cssClass: 'cc cc-by-nd',
    },
    'creative commons: attribution - non commercial 4.0': {
        displayName: 'creative commons: attribution - non commercial 4.0 (BY-NC)',
        url: 'https://creativecommons.org/licenses/by-nc/4.0/',
        cssClass: 'cc cc-by-nc',
    },
    'creative commons: attribution - non commercial - share alike 4.0': {
        displayName: 'creative commons: attribution - non commercial - share alike 4.0 (BY-NC-SA)',
        url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        cssClass: 'cc cc-by-nc-sa',
    },
    'creative commons: attribution - non derived work - non commercial 4.0': {
        displayName: 'creative commons: attribution - non derived work - non commercial 4.0 (BY-NC-ND)',
        url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        cssClass: 'cc cc-by-nc-nd',
    },

    // === Creative Commons 3.0 (Legacy - not selectable in dropdown) ===
    'creative commons: attribution 3.0': {
        displayName: 'creative commons: attribution 3.0 (BY)',
        url: 'https://creativecommons.org/licenses/by/3.0/',
        cssClass: 'cc',
        legacy: true,
    },
    'creative commons: attribution - share alike 3.0': {
        displayName: 'creative commons: attribution - share alike 3.0 (BY-SA)',
        url: 'https://creativecommons.org/licenses/by-sa/3.0/',
        cssClass: 'cc cc-by-sa',
        legacy: true,
    },
    'creative commons: attribution - non derived work 3.0': {
        displayName: 'creative commons: attribution - non derived work 3.0 (BY-ND)',
        url: 'https://creativecommons.org/licenses/by-nd/3.0/',
        cssClass: 'cc cc-by-nd',
        legacy: true,
    },
    'creative commons: attribution - non commercial 3.0': {
        displayName: 'creative commons: attribution - non commercial 3.0 (BY-NC)',
        url: 'https://creativecommons.org/licenses/by-nc/3.0/',
        cssClass: 'cc cc-by-nc',
        legacy: true,
    },
    'creative commons: attribution - non commercial - share alike 3.0': {
        displayName: 'creative commons: attribution - non commercial - share alike 3.0 (BY-NC-SA)',
        url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
        cssClass: 'cc cc-by-nc-sa',
        legacy: true,
    },
    'creative commons: attribution - non derived work - non commercial 3.0': {
        displayName: 'creative commons: attribution - non derived work - non commercial 3.0 (BY-NC-ND)',
        url: 'https://creativecommons.org/licenses/by-nc-nd/3.0/',
        cssClass: 'cc cc-by-nc-nd',
        legacy: true,
    },

    // === Creative Commons 2.5 (Legacy - not selectable in dropdown) ===
    'creative commons: attribution 2.5': {
        displayName: 'creative commons: attribution 2.5 (BY)',
        url: 'https://creativecommons.org/licenses/by/2.5/',
        cssClass: 'cc',
        legacy: true,
    },
    'creative commons: attribution - share alike 2.5': {
        displayName: 'creative commons: attribution - share alike 2.5 (BY-SA)',
        url: 'https://creativecommons.org/licenses/by-sa/2.5/',
        cssClass: 'cc cc-by-sa',
        legacy: true,
    },
    'creative commons: attribution - non derived work 2.5': {
        displayName: 'creative commons: attribution - non derived work 2.5 (BY-ND)',
        url: 'https://creativecommons.org/licenses/by-nd/2.5/',
        cssClass: 'cc cc-by-nd',
        legacy: true,
    },
    'creative commons: attribution - non commercial 2.5': {
        displayName: 'creative commons: attribution - non commercial 2.5 (BY-NC)',
        url: 'https://creativecommons.org/licenses/by-nc/2.5/',
        cssClass: 'cc cc-by-nc',
        legacy: true,
    },
    'creative commons: attribution - non commercial - share alike 2.5': {
        displayName: 'creative commons: attribution - non commercial - share alike 2.5 (BY-NC-SA)',
        url: 'https://creativecommons.org/licenses/by-nc-sa/2.5/',
        cssClass: 'cc cc-by-nc-sa',
        legacy: true,
    },
    'creative commons: attribution - non derived work - non commercial 2.5': {
        displayName: 'creative commons: attribution - non derived work - non commercial 2.5 (BY-NC-ND)',
        url: 'https://creativecommons.org/licenses/by-nc-nd/2.5/',
        cssClass: 'cc cc-by-nc-nd',
        legacy: true,
    },

    // === Creative Commons CC0 1.0 (Public Domain Dedication) ===
    'creative commons: cc0 1.0': {
        displayName: 'creative commons: public domain 1.0 (CC0)',
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        cssClass: 'cc cc-0',
    },

    // === Public Domain (generic, no specific license link) ===
    'public domain': {
        displayName: 'public domain',
        url: '',
        cssClass: '',
    },

    // === GNU/GPL Licenses (Legacy - not selectable in dropdown, no icon in themes) ===
    'gnu/gpl': {
        displayName: 'gnu/gpl',
        url: 'https://www.gnu.org/licenses/gpl.html',
        cssClass: '',
        legacy: true,
    },
    'free software license gpl': {
        displayName: 'free software license GPL',
        url: 'https://www.gnu.org/licenses/gpl.html',
        cssClass: '',
        legacy: true,
    },

    // === EUPL License (Legacy - not selectable in dropdown, no icon in themes) ===
    'free software license eupl': {
        displayName: 'free software license EUPL',
        url: 'https://eupl.eu/',
        cssClass: '',
        legacy: true,
    },

    // === Dual License GPL + EUPL (Legacy - not selectable in dropdown, no icon in themes) ===
    'dual free content license gpl and eupl': {
        displayName: 'dual free content license GPL and EUPL',
        url: '',
        cssClass: '',
        legacy: true,
    },

    // === GFDL License (Legacy - not selectable in dropdown, no icon in themes) ===
    'license gfdl': {
        displayName: 'license GFDL',
        url: 'https://www.gnu.org/licenses/fdl.html',
        cssClass: '',
        legacy: true,
    },

    // === Other Licenses (Legacy - not selectable in dropdown) ===
    'other free software licenses': {
        displayName: 'other free software licenses',
        url: '',
        cssClass: '',
        legacy: true,
    },
    'propietary license': {
        displayName: 'propietary license',
        url: '',
        cssClass: '',
        hideInFooter: true,
    },
    'intellectual property license': {
        displayName: 'intellectual property license',
        url: '',
        cssClass: '',
        legacy: true,
    },
    'not appropriate': {
        displayName: 'not appropriate',
        url: '',
        cssClass: '',
        hideInFooter: true,
    },
};

// =============================================================================
// License CSS Class Lookup
// =============================================================================

/**
 * Get CSS class for license icon display.
 * Looks up the cssClass from LICENSE_REGISTRY.
 *
 * @param licenseName - License name to look up
 * @returns The CSS class(es) for the license icon (empty string if no icon)
 */
export function getLicenseClass(licenseName: string): string {
    if (!licenseName) {
        return '';
    }

    const cleanName = licenseName.toLowerCase().trim().replace(/\s+/g, ' ');

    // Direct lookup in registry
    if (LICENSE_REGISTRY[cleanName]) {
        return LICENSE_REGISTRY[cleanName].cssClass;
    }

    return '';
}

/**
 * Get URL for a given license name.
 *
 * @param licenseName - The license name
 * @returns The URL for the license (empty string if not found or no URL)
 */
export function getLicenseUrl(licenseName: string): string {
    if (!licenseName) return '';
    const key = licenseName.toLowerCase().trim().replace(/\s+/g, ' ');
    return LICENSE_REGISTRY[key]?.url || '';
}

/**
 * Format license text for display in footer.
 * Returns the displayName from registry if found, otherwise returns the input as-is.
 *
 * @param licenseName - The license name from metadata
 * @returns Formatted license text for display
 */
export function formatLicenseText(licenseName: string): string {
    if (!licenseName) return '';
    const key = licenseName.toLowerCase().trim();
    return LICENSE_REGISTRY[key]?.displayName || licenseName;
}

/**
 * Format license text for Fichero Fuente display.
 * Generates the short format (e.g., "Creative Commons BY-NC 4.0") matching the editor view.
 *
 * @param licenseName - The license name from metadata
 * @returns Short formatted license text, or displayName if not a standard CC license
 */
export function formatShortLicenseText(licenseName: string): string {
    if (!licenseName) return '';
    const key = licenseName.toLowerCase().trim().replace(/\s+/g, ' ');
    const entry = LICENSE_REGISTRY[key];

    if (entry?.url?.includes('creativecommons.org/licenses/')) {
        const match = entry.url.match(/licenses\/([^/]+\/[^/]+)\/?/);
        if (match?.[1]) {
            const type = match[1].replace('/', ' ').toUpperCase();
            return `Creative Commons ${type}`;
        }
    }

    if (entry?.url?.includes('creativecommons.org/publicdomain/zero/')) {
        return 'Creative Commons CC0 1.0';
    }

    return licenseName;
}

/**
 * Check if a license should show a footer in exports.
 * Returns false for empty license or licenses with hideInFooter: true in the registry.
 *
 * @param licenseName - The license name from metadata
 * @returns true if footer should be shown, false otherwise
 */
export function shouldShowLicenseFooter(licenseName: string): boolean {
    if (!licenseName) return false;

    const cleaned = licenseName.toLowerCase().trim().replace(/\s+/g, ' ');
    const entry = LICENSE_REGISTRY[cleaned];

    // If license is in registry and has hideInFooter, don't show footer
    if (entry?.hideInFooter) return false;

    return true;
}

// =============================================================================
// XML Namespaces
// =============================================================================

/**
 * SCORM 1.2 XML namespaces
 */
export const SCORM_12_NAMESPACES = {
    imscp: 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
    adlcp: 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
    imsmd: 'http://www.imsglobal.org/xsd/imsmd_v1p2',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * SCORM 2004 XML namespaces
 */
export const SCORM_2004_NAMESPACES = {
    imscp: 'http://www.imsglobal.org/xsd/imscp_v1p1',
    adlcp: 'http://www.adlnet.org/xsd/adlcp_v1p3',
    adlseq: 'http://www.adlnet.org/xsd/adlseq_v1p3',
    adlnav: 'http://www.adlnet.org/xsd/adlnav_v1p3',
    imsss: 'http://www.imsglobal.org/xsd/imsss',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * IMS Content Package namespaces
 */
export const IMS_NAMESPACES = {
    imscp: 'http://www.imsglobal.org/xsd/imscp_v1p1',
    imsmd: 'http://www.imsglobal.org/xsd/imsmd_v1p2',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * LOM metadata namespaces
 */
export const LOM_NAMESPACES = {
    lom: 'http://www.imsglobal.org/xsd/imsmd_rootv1p2p1',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * EPUB3 XML namespaces
 */
export const EPUB3_NAMESPACES = {
    OPF: 'http://www.idpf.org/2007/opf',
    DC: 'http://purl.org/dc/elements/1.1/',
    XHTML: 'http://www.w3.org/1999/xhtml',
    EPUB: 'http://www.idpf.org/2007/ops',
    CONTAINER: 'urn:oasis:names:tc:opendocument:xmlns:container',
} as const;

/**
 * EPUB3 MIME type
 */
export const EPUB3_MIMETYPE = 'application/epub+zip';

// =============================================================================
// iDevice Type Mappings
// =============================================================================

/**
 * Maps iDevice type names from XML/ELP files to their export folder names.
 *
 * This handles:
 * - Spanish → English name mappings (e.g., 'adivina' → 'guess')
 * - Legacy name → current name (e.g., 'freetext' → 'text')
 * - Plural → singular (e.g., 'rubrics' → 'rubric')
 * - Variant names (e.g., 'download-package' → 'download-source-file')
 * - Legacy Python eXeLearning types (e.g., 'jsidevice' → 'text')
 *
 * The key is the lowercase type name (after removing 'idevice' suffix),
 * the value is the canonical export folder name.
 */
export const IDEVICE_TYPE_MAP: Record<string, string> = {
    // Text/FreeText variations
    freetext: 'text',
    text: 'text',
    freetextidevice: 'text',
    textidevice: 'text',

    // Legacy Python eXeLearning iDevice types (pre-v3.0)
    // JsIdevice was a text iDevice in old Python eXeLearning
    jsidevice: 'text',
    js: 'text',
    // GalleryImages from old Python format
    galleryimages: 'image-gallery',

    // Spanish → English mappings
    adivina: 'guess',
    'adivina-activity': 'guess',
    listacotejo: 'checklist',
    'listacotejo-activity': 'checklist',
    ordena: 'sort',
    clasifica: 'classify',
    relaciona: 'relate',
    completa: 'complete',

    // Plural → singular
    rubrics: 'rubric',

    // Alternative names
    'download-package': 'download-source-file',
    'pbl-tools': 'udl-content', // PBL tools maps to UDL content

    // Quiz variants
    selecciona: 'quick-questions-multiple-choice',
    'selecciona-activity': 'quick-questions-multiple-choice',
    quiz: 'quick-questions',
    'quiz-activity': 'quick-questions',

    // Game variants
    'quiz-game': 'az-quiz-game',
    trivialquiz: 'trivial',

    // Interactive variants
    'before-after': 'beforeafter',
    'image-magnifier': 'magnifier',
    'word-puzzle': 'word-search',
    'palabras-puzzle': 'word-search',
    'sopa-de-letras': 'word-search',

    // Case study variants
    'case-study': 'casestudy',
    'estudio-de-caso': 'casestudy',

    // Example/model variants
    ejemplo: 'example',
    modelo: 'example',

    // Challenge variants
    reto: 'challenge',
    desafio: 'challenge',

    // External website variants
    'sitio-externo': 'external-website',
    'web-externa': 'external-website',

    // Form variants
    formulario: 'form',

    // Flipcards variants
    tarjetas: 'flipcards',
    'flash-cards': 'flipcards',

    // Image gallery variants
    galeria: 'image-gallery',
    'galeria-imagenes': 'image-gallery',

    // Crossword variants
    crucigrama: 'crossword',

    // Puzzle variants
    rompecabezas: 'puzzle',

    // Map variants
    mapa: 'map',

    // Discover variants
    descubre: 'discover',

    // Identify variants
    identifica: 'identify',

    // Hidden image variants
    'imagen-oculta': 'hidden-image',

    // Padlock variants
    candado: 'padlock',

    // Periodic table variants
    'tabla-periodica': 'periodic-table',

    // Progress report variants
    'informe-progreso': 'progress-report',

    // Scrambled list variants
    'lista-desordenada': 'scrambled-list',

    // True/false variants
    verdaderofalso: 'trueorfalse',
    'verdadero-falso': 'trueorfalse',

    // Interactive video variants
    'video-interactivo': 'interactive-video',

    // Dragdrop variants
    'arrastrar-soltar': 'dragdrop',

    // Select media files variants
    'seleccionar-archivos': 'select-media-files',

    // Math operations variants
    'operaciones-matematicas': 'mathematicaloperations',

    // Math problems variants
    'problemas-matematicos': 'mathproblems',

    // GeoGebra variants
    geogebra: 'geogebra-activity',
};

/**
 * Normalize an iDevice type name to its canonical export folder name.
 *
 * @param typeName - The iDevice type name (from XML or component type)
 * @returns The canonical export folder name
 */
export function normalizeIdeviceType(typeName: string): string {
    if (!typeName) return 'text';

    // Normalize: lowercase, remove 'idevice' suffix (with or without dash)
    let normalized = typeName.toLowerCase();
    normalized = normalized.replace(/-?idevice$/i, '');

    // Look up in map or return as-is
    return IDEVICE_TYPE_MAP[normalized] || normalized || 'text';
}

// =============================================================================
// ODE Content DTD (for ELPX and EPUB exports)
// =============================================================================

/**
 * ODE DTD filename (included in ELPX and EPUB exports with content.xml)
 */
export const ODE_DTD_FILENAME = 'content.dtd';

/**
 * ODE format version (exported in content.xml odeResources section as exe_version)
 */
export const ODE_VERSION = '3.0';

/**
 * ODE Content DTD
 * Embedded DTD for exports that include content.xml - validates content.xml structure
 */
export const ODE_DTD_CONTENT = `<!--
    ODE Content DTD
    Document Type Definition for eXeLearning ODE XML format (content.xml)
    Version: 2.0
    Namespace: http://www.intef.es/xsd/ode
    Copyright (C) 2025 eXeLearning - License: AGPL-3.0
-->

<!ELEMENT ode (userPreferences?, odeResources?, odeProperties?, odeNavStructures)>
<!ATTLIST ode
    xmlns CDATA #FIXED "http://www.intef.es/xsd/ode"
    version CDATA #IMPLIED>

<!-- User Preferences -->
<!ELEMENT userPreferences (userPreference*)>
<!ELEMENT userPreference (key, value)>

<!-- ODE Resources -->
<!ELEMENT odeResources (odeResource*)>
<!ELEMENT odeResource (key, value)>

<!-- ODE Properties -->
<!ELEMENT odeProperties (odeProperty*)>
<!ELEMENT odeProperty (key, value)>

<!-- Shared Key-Value Elements -->
<!ELEMENT key (#PCDATA)>
<!ELEMENT value (#PCDATA)>

<!-- Navigation Structures (Pages) -->
<!ELEMENT odeNavStructures (odeNavStructure*)>
<!ELEMENT odeNavStructure (odePageId, odeParentPageId, pageName, odeNavStructureOrder, odeNavStructureProperties?, odePagStructures?)>

<!ELEMENT odePageId (#PCDATA)>
<!ELEMENT odeParentPageId (#PCDATA)>
<!ELEMENT pageName (#PCDATA)>
<!ELEMENT odeNavStructureOrder (#PCDATA)>

<!ELEMENT odeNavStructureProperties (odeNavStructureProperty*)>
<!ELEMENT odeNavStructureProperty (key, value)>

<!-- Block Structures -->
<!ELEMENT odePagStructures (odePagStructure*)>
<!ELEMENT odePagStructure (odePageId, odeBlockId, blockName, iconName?, odePagStructureOrder, odePagStructureProperties?, odeComponents?)>

<!ELEMENT odeBlockId (#PCDATA)>
<!ELEMENT blockName (#PCDATA)>
<!ELEMENT iconName (#PCDATA)>
<!ELEMENT odePagStructureOrder (#PCDATA)>

<!ELEMENT odePagStructureProperties (odePagStructureProperty*)>
<!ELEMENT odePagStructureProperty (key, value)>

<!-- Components (iDevices) -->
<!ELEMENT odeComponents (odeComponent*)>
<!ELEMENT odeComponent (odePageId, odeBlockId, odeIdeviceId, odeIdeviceTypeName, htmlView?, jsonProperties?, odeComponentsOrder, odeComponentsProperties?)>

<!ELEMENT odeIdeviceId (#PCDATA)>
<!ELEMENT odeIdeviceTypeName (#PCDATA)>
<!ELEMENT htmlView (#PCDATA)>
<!ELEMENT jsonProperties (#PCDATA)>
<!ELEMENT odeComponentsOrder (#PCDATA)>

<!ELEMENT odeComponentsProperties (odeComponentsProperty*)>
<!ELEMENT odeComponentsProperty (key, value)>
`;
