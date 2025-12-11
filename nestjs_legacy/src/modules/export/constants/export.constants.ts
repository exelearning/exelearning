import { ExportFormatType } from '../interfaces/export-strategy.interface';

/**
 * Export directory names used during export process
 */
export const EXPORT_DIRS = {
    /** HTML pages subdirectory */
    HTML: 'html',

    /** Content resources (images, media) */
    CONTENT: 'content',

    /** Resources subdirectory */
    RESOURCES: 'resources',

    /** JavaScript libraries */
    LIBS: 'libs',

    /** Theme files */
    THEME: 'theme',

    /** iDevice CSS/JS */
    IDEVICES: 'idevices',

    /** Custom user files */
    CUSTOM: 'custom',

    /** EPUB-specific directories */
    EPUB: {
        ROOT: 'EPUB',
        META_INF: 'META-INF',
        CONTENT: 'EPUB/content',
    },
} as const;

/**
 * File extensions for export formats
 */
export const FILE_EXTENSIONS: Record<ExportFormatType, string> = {
    [ExportFormatType.HTML5]: '.zip',
    [ExportFormatType.PAGE]: '.zip',
    [ExportFormatType.SCORM12]: '.zip',
    [ExportFormatType.IMS]: '.zip',
    [ExportFormatType.EPUB3]: '.epub',
    [ExportFormatType.ELPX]: '.elpx',
};

/**
 * File suffixes for export filenames
 */
export const FILE_SUFFIXES: Record<ExportFormatType, string> = {
    [ExportFormatType.HTML5]: '_web',
    [ExportFormatType.PAGE]: '_page',
    [ExportFormatType.SCORM12]: '_scorm',
    [ExportFormatType.IMS]: '_ims',
    [ExportFormatType.EPUB3]: '',
    [ExportFormatType.ELPX]: '',
};

/**
 * Schema paths for manifest validation
 */
export const SCHEMA_PATHS = {
    SCORM12: {
        BASE: 'schemas/scorm12',
        FILES: [
            'adlcp_rootv1p2.xsd',
            'ims_xml.xsd',
            'imscp_rootv1p1p2.xsd',
            'imsmd_rootv1p2p1.xsd',
        ],
    },
    IMS: {
        BASE: 'schemas/ims',
        FILES: ['imscp_rootv1p1p2.xsd', 'imsmd_rootv1p2p1.xsd', 'ims_xml.xsd'],
    },
    EPUB3: {
        BASE: 'schemas/epub3',
        FILES: [],
    },
} as const;

/**
 * Base JavaScript/CSS files to include in exports
 */
export const BASE_FILES = {
    /** jQuery and common JS */
    JAVASCRIPT: [
        'exe_jquery.js',
        'common_i18n.js',
        'common.js',
        'exe_html5.js',
    ],

    /** Base CSS files */
    CSS: ['base.css', 'content.css'],

    /** SCORM-specific JS */
    SCORM: ['SCORM_API_wrapper.js', 'SCOFunctions.js'],
} as const;

/**
 * SCORM 1.2 specific constants
 */
export const SCORM12 = {
    /** XML Namespaces */
    NAMESPACES: {
        DEFAULT: 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
        ADLCP: 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
        XSI: 'http://www.w3.org/2001/XMLSchema-instance',
        IMS: 'http://www.imsglobal.org/xsd/imsmd_rootv1p2p1',
    },

    /** Schema locations */
    SCHEMA_LOCATION:
        'http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd ' +
        'http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd ' +
        'http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd',

    /** Manifest filename */
    MANIFEST_FILE: 'imsmanifest.xml',

    /** LOM metadata filename */
    LOM_FILE: 'imslrm.xml',

    /** Resource type for web content */
    RESOURCE_TYPE: 'webcontent',

    /** SCO type attribute */
    SCO_TYPE: 'sco',

    /** Common files resource identifier */
    COMMON_FILES_ID: 'COMMON_FILES',
} as const;

/**
 * IMS Content Package constants
 */
export const IMS = {
    /** XML Namespaces */
    NAMESPACES: {
        DEFAULT: 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
        IMS: 'http://www.imsglobal.org/xsd/imsmd_rootv1p2p1',
        XSI: 'http://www.w3.org/2001/XMLSchema-instance',
    },

    /** Schema location */
    SCHEMA_LOCATION:
        'http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd ' +
        'http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd',

    /** Manifest filename */
    MANIFEST_FILE: 'imsmanifest.xml',

    /** Resource type */
    RESOURCE_TYPE: 'webcontent',
} as const;

/**
 * EPUB3 constants
 */
export const EPUB3 = {
    /** Media type for EPUB */
    MIMETYPE: 'application/epub+zip',

    /** XML Namespaces */
    NAMESPACES: {
        OPF: 'http://www.idpf.org/2007/opf',
        DC: 'http://purl.org/dc/elements/1.1/',
        XHTML: 'http://www.w3.org/1999/xhtml',
        EPUB: 'http://www.idpf.org/2007/ops',
        CONTAINER: 'urn:oasis:names:tc:opendocument:xmlns:container',
    },

    /** Required files */
    FILES: {
        MIMETYPE: 'mimetype',
        CONTAINER: 'META-INF/container.xml',
        PACKAGE: 'EPUB/package.opf',
        NAV: 'EPUB/nav.xhtml',
    },

    /** EPUB version */
    VERSION: '3.0',

    /** Media types for spine items */
    MEDIA_TYPES: {
        XHTML: 'application/xhtml+xml',
        CSS: 'text/css',
        JS: 'application/javascript',
        PNG: 'image/png',
        JPG: 'image/jpeg',
        GIF: 'image/gif',
        SVG: 'image/svg+xml',
    },
} as const;

/**
 * ELPX (eXeLearning Package) constants
 */
export const ELPX = {
    /** Content XML filename */
    CONTENT_FILE: 'content.xml',

    /** Legacy content filename */
    LEGACY_CONTENT_FILE: 'contentv3.xml',

    /** Version metadata */
    VERSION: '0.5',
} as const;

/**
 * HTML generation constants
 */
export const HTML = {
    /** DOCTYPE for HTML5 */
    DOCTYPE: '<!DOCTYPE html>',

    /** DOCTYPE for XHTML (EPUB) */
    DOCTYPE_XHTML:
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>',

    /** Default language */
    DEFAULT_LANG: 'en',

    /** Character encoding */
    CHARSET: 'utf-8',

    /** Generator meta content */
    GENERATOR: 'eXeLearning - exelearning.net',

    /** Index filename */
    INDEX_FILE: 'index.html',

    /** Index XHTML filename (EPUB) */
    INDEX_XHTML: 'index.xhtml',
} as const;

/**
 * iDevice type identifiers
 */
export const IDEVICE_TYPES = {
    FREE_TEXT: 'FreeTextIdevice',
    MULTI_CHOICE: 'MultiChoiceIdevice',
    TRUE_FALSE: 'TrueFalseIdevice',
    CLOZE: 'ClozeIdevice',
    READING: 'ReadingActivityIdevice',
    OBJECTIVES: 'ObjectivesIdevice',
    PREKNOWLEDGE: 'PreknowledgeIdevice',
    CASE_STUDY: 'CaseStudyIdevice',
    REFLECTION: 'ReflectionIdevice',
    WIKI: 'WikipediaIdevice',
    EXTERNAL_URL: 'ExternalUrlIdevice',
    IMAGE_GALLERY: 'ImageGalleryIdevice',
    IMAGE_MAGNIFIER: 'ImageMagnifierIdevice',
    FLASH_WITH_TEXT: 'FlashWithTextIdevice',
    ATTACHMENT: 'AttachmentIdevice',
    APPLET: 'AppletIdevice',
    SCORM_TEST: 'ScormTestIdevice',
    MULTI_SELECT: 'MultiSelectIdevice',
    QUIZ: 'QuizTestIdevice',
} as const;

/**
 * Default values for exports
 */
export const EXPORT_DEFAULTS = {
    /** Default compression level for ZIP */
    COMPRESSION_LEVEL: 9,

    /** Default language if not specified */
    LANGUAGE: 'en',

    /** Default license */
    LICENSE: 'Creative Commons Attribution Share Alike License 4.0',

    /** License URL */
    LICENSE_URL: 'http://creativecommons.org/licenses/by-sa/4.0/',
} as const;
