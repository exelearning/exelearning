/**
 * Property configurations for various entities
 * Ported from Symfony's Properties.php
 *
 * Note: TRANS_PREFIX ('TRANSLATABLE_TEXT:') is used in Symfony to indicate
 * strings that should be translated. In the endpoint response, these should
 * be replaced with actual translations.
 */

export const TRANS_PREFIX = 'TRANSLATABLE_TEXT:';

/**
 * Available licenses for content
 */
export const LICENSES = {
    'creative commons: attribution 4.0': `${TRANS_PREFIX}creative commons: attribution 4.0 (BY)`,
    'creative commons: attribution - share alike 4.0': `${TRANS_PREFIX}creative commons: attribution - share alike 4.0 (BY-SA)`,
    'creative commons: attribution - non derived work 4.0': `${TRANS_PREFIX}creative commons: attribution - non derived work 4.0 (BY-ND)`,
    'creative commons: attribution - non commercial 4.0': `${TRANS_PREFIX}creative commons: attribution - non commercial 4.0 (BY-NC)`,
    'creative commons: attribution - non commercial - share alike 4.0': `${TRANS_PREFIX}creative commons: attribution - non commercial - share alike 4.0 (BY-NC-SA)`,
    'creative commons: attribution - non derived work - non commercial 4.0': `${TRANS_PREFIX}creative commons: attribution - non derived work - non commercial 4.0 (BY-NC-ND)`,
    'public domain': `${TRANS_PREFIX}public domain`,
    'free software license EUPL': `${TRANS_PREFIX}free software license EUPL`,
    'free software license GPL': `${TRANS_PREFIX}free software license GPL`,
    'dual free content license GPL and EUPL': `${TRANS_PREFIX}dual free content license GPL and EUPL`,
    'license GFDL': `${TRANS_PREFIX}license GFDL`,
    'other free software licenses': `${TRANS_PREFIX}other free software licenses`,
    'propietary license': `${TRANS_PREFIX}proprietary license`,
    'intellectual property license': `${TRANS_PREFIX}intellectual property license`,
    'not appropriate': `${TRANS_PREFIX}not appropriate`,
    // Old licenses (3.0 versions)
    'creative commons: attribution 3.0': `${TRANS_PREFIX}creative commons: attribution 3.0 (BY)`,
    'creative commons: attribution - share alike 3.0': `${TRANS_PREFIX}creative commons: attribution - share alike 3.0 (BY-SA)`,
    'creative commons: attribution - non derived work 3.0': `${TRANS_PREFIX}creative commons: attribution - non derived work 3.0 (BY-ND)`,
    'creative commons: attribution - non commercial 3.0': `${TRANS_PREFIX}creative commons: attribution - non commercial 3.0 (BY-NC)`,
    'creative commons: attribution - non commercial - share alike 3.0': `${TRANS_PREFIX}creative commons: attribution - non commercial - share alike 3.0 (BY-NC-SA)`,
    'creative commons: attribution - non derived work - non commercial 3.0': `${TRANS_PREFIX}creative commons: attribution - non derived work - non commercial 3.0 (BY-NC-ND)`,
    // Old licenses (2.5 versions)
    'creative commons: attribution 2.5': `${TRANS_PREFIX}creative commons: attribution 2.5 (BY)`,
    'creative commons: attribution - share alike 2.5': `${TRANS_PREFIX}creative commons: attribution - share alike 2.5 (BY-SA)`,
    'creative commons: attribution - non derived work 2.5': `${TRANS_PREFIX}creative commons: attribution - non derived work 2.5 (BY-ND)`,
    'creative commons: attribution - non commercial 2.5': `${TRANS_PREFIX}creative commons: attribution - non commercial 2.5 (BY-NC)`,
    'creative commons: attribution - non commercial - share alike 2.5': `${TRANS_PREFIX}creative commons: attribution - non commercial - share alike 2.5 (BY-NC-SA)`,
    'creative commons: attribution - non derived work - non commercial 2.5': `${TRANS_PREFIX}creative commons: attribution - non derived work - non commercial 2.5 (BY-NC-ND)`,
};

/**
 * Group titles for project properties form
 */
export const GROUPS_TITLE = {
    properties_package: `${TRANS_PREFIX}Content metadata`,
    export: `${TRANS_PREFIX}Export options`,
    custom_code: `${TRANS_PREFIX}Custom code`,
};

/**
 * User preferences configuration
 * Defines the user-level settings available in the application
 */
export const USER_PREFERENCES_CONFIG = {
    locale: {
        title: `${TRANS_PREFIX}Language`,
        help: `${TRANS_PREFIX}You can choose a different language for the current project.`,
        value: null,
        type: 'select',
        options: null, // Will be populated with Settings.LOCALES
        category: `${TRANS_PREFIX}General settings`,
    },
    advancedMode: {
        title: `${TRANS_PREFIX}Advanced mode`,
        value: 'true',
        type: 'checkbox',
        hide: true,
        category: `${TRANS_PREFIX}General settings`,
    },
    defaultLicense: {
        title: `${TRANS_PREFIX}License for the new documents`,
        help: `${TRANS_PREFIX}You can choose a different licence for the current project.`,
        value: 'creative commons: attribution - share alike 4.0',
        type: 'select',
        options: LICENSES,
        category: `${TRANS_PREFIX}General settings`,
    },
    theme: {
        title: `${TRANS_PREFIX}Style`,
        value: 'base', // Constants.THEME_DEFAULT
        type: 'text',
        hide: true,
        category: `${TRANS_PREFIX}General settings`,
    },
    versionControl: {
        title: `${TRANS_PREFIX}Version control`,
        value: 'true',
        type: 'checkbox',
        category: `${TRANS_PREFIX}General settings`,
    },
};

/**
 * iDevice info fields configuration
 * Defines metadata fields for iDevices (interactive learning devices)
 */
export const IDEVICE_INFO_FIELDS_CONFIG = {
    title: {
        title: `${TRANS_PREFIX}Title`,
        tag: 'text',
    },
    description: {
        title: `${TRANS_PREFIX}Description`,
        tag: 'textarea',
    },
    version: {
        title: `${TRANS_PREFIX}Version`,
        tag: 'text',
    },
    author: {
        title: `${TRANS_PREFIX}Authorship`,
        tag: 'text',
    },
    authorUrl: {
        title: `${TRANS_PREFIX}Author URL`,
        tag: 'text',
    },
    license: {
        title: `${TRANS_PREFIX}License`,
        tag: 'textarea',
    },
    licenseUrl: {
        title: `${TRANS_PREFIX}License URL`,
        tag: 'textarea',
    },
};

/**
 * iDevice components properties configuration
 * Defines properties for OdeComponentsSync entities (iDevice instances)
 */
export const ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG = {
    visibility: {
        title: `${TRANS_PREFIX}Visible in export`,
        value: 'true',
        type: 'checkbox',
        category: null,
        heritable: true,
    },
    teacherOnly: {
        title: `${TRANS_PREFIX}Teacher only`,
        value: 'false',
        type: 'checkbox',
        category: null,
        heritable: true,
    },
    identifier: {
        title: `${TRANS_PREFIX}ID`,
        type: 'text',
        category: null,
        heritable: false,
    },
    cssClass: {
        title: `${TRANS_PREFIX}CSS Class`,
        value: '',
        type: 'text',
        category: null,
        heritable: true,
    },
};

/**
 * Navigation structure properties configuration
 * Defines properties for OdeNavStructureSync entities (pages in nav tree)
 */
export const ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
    titleNode: {
        title: `${TRANS_PREFIX}Title`,
        type: 'text',
        category: `${TRANS_PREFIX}General`,
        heritable: false,
    },
    hidePageTitle: {
        title: `${TRANS_PREFIX}Hide page title`,
        type: 'checkbox',
        category: `${TRANS_PREFIX}General`,
        value: 'false',
        heritable: false,
    },
    titleHtml: {
        title: `${TRANS_PREFIX}Title HTML`,
        type: 'text',
        category: `${TRANS_PREFIX}Advanced (SEO)`,
        heritable: false,
    },
    editableInPage: {
        title: `${TRANS_PREFIX}Different title on the page`,
        type: 'checkbox',
        category: `${TRANS_PREFIX}General`,
        value: 'false',
        alwaysVisible: true,
    },
    titlePage: {
        title: `${TRANS_PREFIX}Title in page`,
        type: 'text',
        category: `${TRANS_PREFIX}General`,
        heritable: false,
    },
    visibility: {
        title: `${TRANS_PREFIX}Visible in export`,
        value: 'true',
        type: 'checkbox',
        category: `${TRANS_PREFIX}General`,
        heritable: true,
    },
    highlight: {
        title: `${TRANS_PREFIX}Highlight this page in the website navigation menu`,
        value: 'false',
        type: 'checkbox',
        category: `${TRANS_PREFIX}General`,
        heritable: false,
    },
    description: {
        title: `${TRANS_PREFIX}Description`,
        type: 'textarea',
        category: `${TRANS_PREFIX}Advanced (SEO)`,
        heritable: false,
    },
};

/**
 * Block components properties configuration
 * Defines properties for OdePagStructureSync entities (blocks containing iDevices)
 */
export const ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
    visibility: {
        title: `${TRANS_PREFIX}Visible in export`,
        value: 'true',
        type: 'checkbox',
        category: null,
        heritable: true,
    },
    teacherOnly: {
        title: `${TRANS_PREFIX}Teacher only`,
        value: 'false',
        type: 'checkbox',
        category: null,
        heritable: true,
    },
    allowToggle: {
        title: `${TRANS_PREFIX}Allows to minimize/display content`,
        value: 'true',
        type: 'checkbox',
        category: null,
        heritable: true,
    },
    minimized: {
        title: `${TRANS_PREFIX}Minimized`,
        value: 'false',
        type: 'checkbox',
        category: null,
        heritable: true,
    },
    identifier: {
        title: `${TRANS_PREFIX}ID`,
        type: 'text',
        category: null,
        heritable: false,
    },
    cssClass: {
        title: `${TRANS_PREFIX}CSS Class`,
        value: '',
        type: 'text',
        category: null,
        heritable: true,
    },
};
