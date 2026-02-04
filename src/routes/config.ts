/**
 * Configuration Routes for Elysia
 * Handles application configuration and parameter endpoints
 */
import { Elysia, t } from 'elysia';
import {
    TRANS_PREFIX,
    LOCALES,
    PACKAGE_LOCALES,
    DEFAULT_LOCALE,
    getCatalogueWithFallback,
    getAvailableLocales,
    getAvailablePackageLocales,
    getTranslationCount,
    detectLocaleFromHeader,
    translateObject,
} from '../services/translation';
import { getAppVersion } from '../utils/version';
import { db as defaultDb } from '../db/client';
import {
    getAuthMethods,
    getSettingBoolean,
    getSettingNumber,
    parseBoolean,
    parseNumber,
} from '../services/app-settings';
import { getEnabledTemplatesByLocale, findTemplateById } from '../db/queries/templates';
import { getFilesDir } from '../utils/admin-route-helpers';
import * as path from 'path';
import { getDefaultTheme, getDefaultThemeRecord } from '../db/queries/themes';
import { SUPPORTED_LOCALES } from '../services/admin-upload-validator';
import { getBasePath } from '../utils/basepath.util';
import { LICENSE_REGISTRY } from '../shared/export/constants';

/**
 * Available licenses for content dropdown
 * Derived from LICENSE_REGISTRY - the single source of truth
 * Legacy licenses (marked with legacy: true) are excluded from the dropdown
 * but are preserved when already set on a project
 */
const LICENSES: Record<string, string> = Object.fromEntries(
    Object.entries(LICENSE_REGISTRY)
        .filter(([, entry]) => !entry.legacy)
        .map(([key, entry]) => [key, `${TRANS_PREFIX}${entry.displayName}`]),
);

/**
 * User preferences configuration (expected by frontend)
 */
const USER_PREFERENCES_CONFIG = {
    locale: {
        title: `${TRANS_PREFIX}Language`,
        help: `${TRANS_PREFIX}You can choose a different language for the current project.`,
        value: null,
        type: 'select',
        options: LOCALES,
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
        value: 'base',
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
    defaultAI: {
        title: `${TRANS_PREFIX}Default AI Assistant`,
        help: `${TRANS_PREFIX}Select the AI that will be selected by default when editing iDevices.`,
        value: 'https://chatgpt.com/?q=',
        type: 'select',
        options: {
            'https://chatgpt.com/?q=': 'ChatGPT',
            'https://claude.ai/new?q=': 'Claude',
            'https://www.perplexity.ai/search?q=': 'Perplexity',
            'https://chat.mistral.ai/chat/?q=': 'Le Chat (Mistral)',
            'https://grok.com/?q=': 'Grok',
        },
        category: `${TRANS_PREFIX}General settings`,
    },
};

/**
 * iDevice info fields configuration
 */
const IDEVICE_INFO_FIELDS_CONFIG = {
    title: { title: `${TRANS_PREFIX}Title`, tag: 'text' },
    description: { title: `${TRANS_PREFIX}Description`, tag: 'textarea' },
    version: { title: `${TRANS_PREFIX}Version`, tag: 'text' },
    author: { title: `${TRANS_PREFIX}Authorship`, tag: 'text' },
    authorUrl: { title: `${TRANS_PREFIX}Author URL`, tag: 'text' },
    license: { title: `${TRANS_PREFIX}License`, tag: 'textarea' },
    licenseUrl: { title: `${TRANS_PREFIX}License URL`, tag: 'textarea' },
};

/**
 * Theme info fields configuration
 */
const THEME_INFO_FIELDS_CONFIG = {
    title: { title: `${TRANS_PREFIX}Title`, tag: 'text' },
    description: { title: `${TRANS_PREFIX}Description`, tag: 'textarea' },
    version: { title: `${TRANS_PREFIX}Version`, tag: 'text' },
    author: { title: `${TRANS_PREFIX}Authorship`, tag: 'text' },
    license: { title: `${TRANS_PREFIX}License`, tag: 'textarea' },
    licenseUrl: { title: `${TRANS_PREFIX}License URL`, tag: 'textarea' },
};

/**
 * Theme edition fields configuration
 */
const THEME_EDITION_FIELDS_CONFIG = {
    title: { title: `${TRANS_PREFIX}Title`, tag: 'text', editable: true },
    description: { title: `${TRANS_PREFIX}Description`, tag: 'textarea', editable: true },
};

/**
 * ODE components sync properties configuration
 */
const ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG = {
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
        value: '',
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
 */
const ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
    titleNode: {
        title: `${TRANS_PREFIX}Title`,
        value: '',
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
        value: '',
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
        value: '',
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
        value: '',
        type: 'textarea',
        category: `${TRANS_PREFIX}Advanced (SEO)`,
        heritable: false,
    },
};

/**
 * Block components properties configuration
 */
const ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
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
        value: '',
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
 * Group titles for project properties
 */
const GROUPS_TITLE = {
    properties_package: `${TRANS_PREFIX}Content metadata`,
    export: `${TRANS_PREFIX}Export options`,
    custom_code: `${TRANS_PREFIX}Custom code`,
};

/**
 * Project properties configuration
 * Structure: { category: { property: { title, value, type, groups, ... } } }
 * Frontend iterates through categories then flattens properties.
 * Each property has `groups` attribute for rendering collapsible sections.
 */
const ODE_PROJECT_SYNC_PROPERTIES_CONFIG = {
    // All properties under single 'properties' category
    properties: {
        // === GROUP: properties_package (Metadata) ===
        pp_title: {
            title: `${TRANS_PREFIX}Title`,
            help: `${TRANS_PREFIX}The name given to the resource.`,
            value: '',
            alwaysVisible: true,
            type: 'text',
            category: 'properties',
            groups: { properties_package: GROUPS_TITLE.properties_package },
        },
        pp_subtitle: {
            title: `${TRANS_PREFIX}Subtitle`,
            help: `${TRANS_PREFIX}Adds additional information to the main title.`,
            value: '',
            alwaysVisible: true,
            type: 'text',
            category: 'properties',
            groups: { properties_package: GROUPS_TITLE.properties_package },
        },
        pp_lang: {
            title: `${TRANS_PREFIX}Language`,
            help: `${TRANS_PREFIX}Select a language.`,
            value: 'en',
            alwaysVisible: true,
            type: 'select',
            options: PACKAGE_LOCALES,
            category: 'properties',
            groups: { properties_package: GROUPS_TITLE.properties_package },
        },
        pp_author: {
            title: `${TRANS_PREFIX}Authorship`,
            help: `${TRANS_PREFIX}Primary author/s of the resource.`,
            value: '',
            alwaysVisible: true,
            type: 'text',
            category: 'properties',
            groups: { properties_package: GROUPS_TITLE.properties_package },
        },
        pp_license: {
            title: `${TRANS_PREFIX}License`,
            value: 'creative commons: attribution - share alike 4.0',
            alwaysVisible: true,
            type: 'select',
            options: LICENSES,
            category: 'properties',
            groups: { properties_package: GROUPS_TITLE.properties_package },
        },
        pp_description: {
            title: `${TRANS_PREFIX}Description`,
            value: '',
            alwaysVisible: true,
            type: 'textarea',
            category: 'properties',
            groups: { properties_package: GROUPS_TITLE.properties_package },
        },

        // === GROUP: export (Export options) ===
        exportSource: {
            title: `${TRANS_PREFIX}Editable export`,
            help: `${TRANS_PREFIX}The exported content will be editable with eXeLearning.`,
            value: 'true',
            type: 'checkbox',
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },
        pp_addExeLink: {
            title: `${TRANS_PREFIX}"Made with eXeLearning" link`,
            help: `${TRANS_PREFIX}Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.`,
            value: 'true',
            type: 'checkbox',
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },
        pp_addPagination: {
            title: `${TRANS_PREFIX}Page counter`,
            help: `${TRANS_PREFIX}A text with the page number will be added on each page.`,
            value: 'false',
            type: 'checkbox',
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },
        pp_addSearchBox: {
            title: `${TRANS_PREFIX}Search bar (Website export only)`,
            help: `${TRANS_PREFIX}A search box will be added to every page of the website.`,
            value: 'false',
            type: 'checkbox',
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },
        pp_addAccessibilityToolbar: {
            title: `${TRANS_PREFIX}Accessibility toolbar`,
            help: `${TRANS_PREFIX}The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.`,
            value: 'false',
            type: 'checkbox',
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },
        pp_addMathJax: {
            title: `${TRANS_PREFIX}MathJax (formulas)`,
            help: `${TRANS_PREFIX}Always include the MathJax library for mathematical formulas. Enables accessibility features and context menus for LaTeX/MathML content.`,
            value: 'false',
            type: 'checkbox',
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },
        pp_globalFont: {
            title: `${TRANS_PREFIX}Global font`,
            help: `${TRANS_PREFIX}Apply a global font to all content. Useful for accessibility and early literacy.`,
            value: 'default',
            type: 'select',
            options: {
                default: `${TRANS_PREFIX}Theme default`,
                opendyslexic: 'OpenDyslexic',
                andika: 'Andika',
                'atkinson-hyperlegible-next': 'Atkinson Hyperlegible Next',
                nunito: 'Nunito',
                'playwrite-es': 'Playwrite ES',
            },
            category: 'properties',
            groups: { export: GROUPS_TITLE.export },
        },

        // === GROUP: custom_code (Código personalizado) ===
        pp_extraHeadContent: {
            title: `${TRANS_PREFIX}HEAD`,
            help: `${TRANS_PREFIX}HTML to be included at the end of HEAD: LINK, META, SCRIPT, STYLE...`,
            value: '',
            alwaysVisible: true,
            type: 'textarea',
            category: 'properties',
            groups: { custom_code: GROUPS_TITLE.custom_code },
        },
        footer: {
            title: `${TRANS_PREFIX}Page footer`,
            help: `${TRANS_PREFIX}Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.`,
            value: '',
            alwaysVisible: true,
            type: 'textarea',
            category: 'properties',
            groups: { custom_code: GROUPS_TITLE.custom_code },
        },
    },
};

/**
 * Project cataloguing configuration (LOM metadata)
 * NOTE: LOM fields have been deprecated. This config is kept empty for backwards compatibility.
 * When opening old .elp files with LOM metadata, those fields are simply ignored.
 */
const ODE_PROJECT_SYNC_CATALOGUING_CONFIG = {};

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    bytes = Math.max(bytes, 0);
    const pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    const powCapped = Math.min(pow, units.length - 1);
    const value = bytes / 1024 ** powCapped;
    return `${value.toFixed(2)} ${units[powCapped]}`;
}

async function getUploadLimits() {
    const maxSizeMb = await getSettingNumber(
        defaultDb,
        'FILE_UPLOAD_MAX_SIZE',
        parseInt(process.env.FILE_UPLOAD_MAX_SIZE || '1024', 10),
    );
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    return {
        maxFileSize: maxSizeBytes,
        maxFileSizeFormatted: formatBytes(maxSizeBytes),
        maxUploadSize: maxSizeBytes,
        allowedMimeTypes: [
            'image/*',
            'audio/*',
            'video/*',
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
            'text/plain',
            'text/html',
            'text/css',
            'text/javascript',
            'application/javascript',
            'application/json',
            'application/xml',
            'font/*',
        ],
    };
}

/**
 * API Routes configuration
 * Format expected by frontend: { routes: { routeName: { path: string, methods: string[] } } }
 */
const API_ROUTES = {
    routes: {
        // iDevices
        api_idevices_installed: { path: '/api/idevices/installed', methods: ['GET'] },
        api_idevices_installed_idevice: { path: '/api/idevices/installed/{ideviceId}', methods: ['GET'] },
        api_idevices_upload: { path: '/api/idevices/upload', methods: ['POST'] },
        api_idevices_installed_delete: { path: '/api/idevices/{ideviceId}/delete', methods: ['DELETE'] },
        api_idevices_installed_download: { path: '/api/idevices/{ideviceId}/download', methods: ['GET'] },
        api_idevices_download_ode_components: { path: '/api/idevices/download-ode-components', methods: ['GET'] },
        api_idevices_download_file_resources: { path: '/api/idevices/download-file-resources', methods: ['GET'] },
        api_idevices_force_download_file_resources: {
            path: '/api/idevices/force-download-file-resources',
            methods: ['GET'],
        },
        api_idevices_upload_file_resources: { path: '/api/idevices/upload/file/resources', methods: ['POST'] },
        api_idevices_upload_large_file_resources: {
            path: '/api/idevices/upload/large/file/resources',
            methods: ['POST'],
        },

        // Themes
        api_themes_installed: { path: '/api/themes/installed', methods: ['GET'] },
        api_themes_installed_theme: { path: '/api/themes/installed/{themeId}', methods: ['GET'] },
        api_themes_upload: { path: '/api/themes/upload', methods: ['POST'] },
        api_themes_installed_delete: { path: '/api/themes/{themeId}/delete', methods: ['DELETE'] },
        api_themes_download: { path: '/api/themes/{themeId}/download', methods: ['GET'] },
        api_themes_new: { path: '/api/themes/new', methods: ['POST'] },
        api_themes_edit: { path: '/api/themes/{themeId}/edit', methods: ['PUT'] },
        api_ode_theme_import: { path: '/api/themes/import', methods: ['POST'] },

        // ODE/Projects
        api_odes_ode_elp_open: { path: '/api/odes/elp/open', methods: ['POST'] },
        api_odes_ode_local_elp_open: { path: '/api/odes/local/elp/open', methods: ['POST'] },
        api_odes_ode_local_large_elp_open: { path: '/api/odes/local/large-elp/open', methods: ['POST'] },
        api_odes_ode_local_xml_properties_open: { path: '/api/odes/local/xml-properties/open', methods: ['POST'] },
        api_odes_ode_local_idevices_open: { path: '/api/odes/local/idevices/open', methods: ['POST'] },
        api_odes_ode_local_elp_import_root: { path: '/api/odes/local/elp/import-root', methods: ['POST'] },
        api_odes_ode_local_elp_import_root_from_local: {
            path: '/api/odes/local/elp/import-root-from-local',
            methods: ['POST'],
        },
        api_odes_ode_multiple_local_elp_open: { path: '/api/odes/multiple-local/elp/open', methods: ['POST'] },
        api_nav_structures_import_elp_child: { path: '/api/nav-structures/import-elp-child', methods: ['POST'] },
        api_odes_remove_ode_file: { path: '/api/odes/remove-ode-file', methods: ['POST'] },
        api_odes_remove_date_ode_files: { path: '/api/odes/remove-date-ode-files', methods: ['POST'] },
        api_odes_check_before_leave_ode_session: { path: '/api/odes/check-before-leave', methods: ['POST'] },
        api_odes_clean_init_autosave_elp: { path: '/api/odes/clean-init-autosave', methods: ['POST'] },
        api_odes_ode_session_close: { path: '/api/odes/session/close', methods: ['POST'] },
        api_odes_ode_save_manual: { path: '/api/odes/save/manual', methods: ['POST'] },
        api_odes_ode_save_auto: { path: '/api/odes/save/auto', methods: ['POST'] },
        api_odes_ode_save_as: { path: '/api/odes/save-as', methods: ['POST'] },
        api_odes_last_updated: { path: '/api/odes/last-updated', methods: ['GET'] },
        api_odes_current_users: { path: '/api/odes/current-users', methods: ['GET'] },
        api_odes_properties_get: { path: '/api/odes/{sessionId}/properties', methods: ['GET'] },
        api_odes_properties_save: { path: '/api/odes/{sessionId}/properties', methods: ['POST'] },
        api_odes_session_get_used_files: { path: '/api/ode-management/odes/session/usedfiles', methods: ['POST'] },
        api_odes_session_get_broken_links: { path: '/api/ode-management/odes/session/brokenlinks', methods: ['POST'] },
        api_odes_pag_get_broken_links: { path: '/api/odes/{sessionId}/pag/{pagId}/broken-links', methods: ['GET'] },
        api_odes_block_get_broken_links: {
            path: '/api/odes/{sessionId}/block/{blockId}/broken-links',
            methods: ['GET'],
        },
        api_odes_idevice_get_broken_links: {
            path: '/api/odes/{sessionId}/idevice/{ideviceId}/broken-links',
            methods: ['GET'],
        },
        check_current_users_ode_session_id: { path: '/api/odes/{sessionId}/check-current-users', methods: ['GET'] },
        get_current_block_update: { path: '/api/odes/current-block-update', methods: ['GET'] },

        // Navigation structures
        api_nav_structures_nav_structure_get: { path: '/api/nav-structures/{sessionId}', methods: ['GET'] },

        // Games (progress-report iDevice)
        api_games_session_idevices: { path: '/api/games/{odeSessionId}/idevices', methods: ['GET'] },

        // Export
        api_ode_export_download: { path: '/api/export/{odeSessionId}/{exportType}/download', methods: ['GET', 'POST'] },
        api_export_html5: { path: '/api/export/html5', methods: ['POST'] },
        api_export_scorm12: { path: '/api/export/scorm12', methods: ['POST'] },
        api_export_scorm2004: { path: '/api/export/scorm2004', methods: ['POST'] },
        api_export_epub3: { path: '/api/export/epub3', methods: ['POST'] },
        api_export_ims: { path: '/api/export/ims', methods: ['POST'] },

        // Assets
        api_assets_upload: { path: '/api/assets/upload', methods: ['POST'] },
        api_assets_list: { path: '/api/assets/list', methods: ['GET'] },

        // Auth
        api_auth_login: { path: '/api/auth/login', methods: ['POST'] },
        api_auth_logout: { path: '/api/auth/logout', methods: ['POST'] },
        api_auth_check: { path: '/api/auth/check', methods: ['GET'] },
        api_session_check: { path: '/api/session/check', methods: ['GET'] },

        // User
        api_user_set_lopd_accepted: { path: '/api/user/lopd-accepted', methods: ['POST'] },
        api_user_preferences_get: { path: '/api/user/preferences', methods: ['GET'] },
        api_user_preferences_save: { path: '/api/user/preferences', methods: ['PUT'] },
        api_user_storage_get: { path: '/api/user/storage', methods: ['GET'] },

        // Translations
        api_translations_lists: { path: '/api/translations/lists', methods: ['GET'] },
        api_translations_list_by_locale: { path: '/api/translations/{locale}', methods: ['GET'] },

        // Platform
        set_platform_new_ode: { path: '/api/platform/integration/set_platform_new_ode', methods: ['POST'] },
        open_platform_elp: { path: '/api/platform/integration/openPlatformElp', methods: ['POST'] },

        // Config
        api_config_upload_limits: { path: '/api/config/upload-limits', methods: ['GET'] },
        api_config_parameters: { path: '/api/config/parameters', methods: ['GET'] },
    },
};

/**
 * Template item structure returned by /api/templates endpoint
 */
interface TemplateItem {
    name: string;
    displayName: string;
    path: string;
    source: 'admin';
    description?: string;
}

/**
 * Prefix all API route paths with BASE_PATH for subdirectory installations.
 * This ensures frontend code makes requests to the correct prefixed URLs.
 */
function prefixRoutesWithBasePath(
    routes: Record<string, { path: string; methods: string[] }>,
): Record<string, { path: string; methods: string[] }> {
    const basePath = getBasePath();
    if (!basePath) {
        return routes; // No prefix needed
    }

    const prefixedRoutes: Record<string, { path: string; methods: string[] }> = {};
    for (const [key, route] of Object.entries(routes)) {
        prefixedRoutes[key] = {
            ...route,
            path: `${basePath}${route.path}`,
        };
    }
    return prefixedRoutes;
}

async function getDefaultParameters(uploadLimits: { maxFileSize: number }) {
    const authMethods = await getAuthMethods(defaultDb, process.env.APP_AUTH_METHODS || 'password,guest');

    // Get global default theme (can be builtin or admin)
    let defaultThemeDirName = 'base';
    try {
        const defaultThemeSetting = await getDefaultTheme(defaultDb);
        defaultThemeDirName = defaultThemeSetting.dirName;
    } catch {
        // If table doesn't exist yet (pre-migration), use 'base'
    }

    return {
        // General settings
        appName: 'eXeLearning',
        appVersion: '4.0.0',
        locale: 'es',

        // Feature flags
        enableCollaboration: true,
        enableGuestAccess: authMethods.includes('guest'),
        enableCas: authMethods.includes('cas'),
        enableOidc: authMethods.includes('openid'),

        // Export settings
        defaultExportFormat: 'html5',
        availableExportFormats: ['html5', 'scorm12', 'scorm2004', 'epub3', 'ims'],

        // Editor settings
        autoSaveInterval: 30000, // 30 seconds
        maxAutoSaveRetries: 3,

        // Theme settings
        defaultTheme: defaultThemeDirName,

        // File settings
        maxFileSize: uploadLimits.maxFileSize,
        allowedExtensions: [
            'jpg',
            'jpeg',
            'png',
            'gif',
            'svg',
            'webp',
            'mp3',
            'ogg',
            'wav',
            'm4a',
            'mp4',
            'webm',
            'ogv',
            'pdf',
            'zip',
            'txt',
            'html',
            'htm',
            'css',
            'js',
            'json',
            'xml',
            'ttf',
            'woff',
            'woff2',
            'eot',
        ],
    };
}

/**
 * Configuration routes
 */
export const configRoutes = new Elysia({ name: 'config-routes' })
    // GET /api/config/upload-limits - Get upload limits
    .get('/api/config/upload-limits', async () => {
        return await getUploadLimits();
    })

    // GET /api/parameter-management/parameters/data/list - Get ALL parameters (expected by frontend)
    // Applies translations based on Accept-Language header
    .get('/api/parameter-management/parameters/data/list', async ({ request, query }) => {
        // Prioritize locale query param (from user preference), then Accept-Language header
        const localeParam = (query as { locale?: string })?.locale;
        const acceptLanguage = request.headers.get('accept-language');
        const locale = localeParam || detectLocaleFromHeader(acceptLanguage);
        const canInstallThemes = await getSettingBoolean(
            defaultDb,
            'ONLINE_THEMES_INSTALL',
            parseBoolean(process.env.ONLINE_THEMES_INSTALL, false),
        );
        const canInstallIdevices = await getSettingBoolean(
            defaultDb,
            'ONLINE_IDEVICES_INSTALL',
            parseBoolean(process.env.ONLINE_IDEVICES_INSTALL, false),
        );
        const autosaveOdeFilesFunction = await getSettingBoolean(
            defaultDb,
            'AUTOSAVE_ODE_FILES_FUNCTION',
            parseBoolean(process.env.AUTOSAVE_ODE_FILES_FUNCTION, true),
        );
        const autosaveIntervalTime = await getSettingNumber(
            defaultDb,
            'PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL',
            parseNumber(process.env.PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL, 600),
        );

        return {
            // Property configurations (required by frontend) - translated
            userPreferencesConfig: translateObject(USER_PREFERENCES_CONFIG, locale),
            ideviceInfoFieldsConfig: translateObject(IDEVICE_INFO_FIELDS_CONFIG, locale),
            themeInfoFieldsConfig: translateObject(THEME_INFO_FIELDS_CONFIG, locale),
            themeEditionFieldsConfig: translateObject(THEME_EDITION_FIELDS_CONFIG, locale),
            odeComponentsSyncPropertiesConfig: translateObject(ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG, locale),
            odeNavStructureSyncPropertiesConfig: translateObject(ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG, locale),
            odePagStructureSyncPropertiesConfig: translateObject(ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG, locale),
            odeProjectSyncPropertiesConfig: translateObject(ODE_PROJECT_SYNC_PROPERTIES_CONFIG, locale),
            odeProjectSyncCataloguingConfig: translateObject(ODE_PROJECT_SYNC_CATALOGUING_CONFIG, locale),

            // Application settings
            canInstallThemes: canInstallThemes ? 1 : 0,
            canInstallIdevices: canInstallIdevices ? 1 : 0,
            autosaveOdeFilesFunction,
            autosaveIntervalTime,
            generateNewItemKey: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

            // API routes - prefix all paths with BASE_PATH for subdirectory installations
            routes: prefixRoutesWithBasePath(API_ROUTES.routes),
        };
    })

    // GET /api/config/parameters - Alternative endpoint for parameters
    .get('/api/config/parameters', async () => {
        const uploadLimits = await getUploadLimits();
        return await getDefaultParameters(uploadLimits);
    })

    // GET /api/config - General configuration endpoint
    .get('/api/config', async () => {
        const uploadLimits = await getUploadLimits();
        const parameters = await getDefaultParameters(uploadLimits);
        return {
            uploadLimits,
            parameters,
        };
    })

    // GET /api/translations/:locale - Get translations for a locale
    .get('/api/translations/:locale', ({ params }) => {
        const locale = params.locale;
        const translations = getCatalogueWithFallback(locale);
        const count = getTranslationCount(locale);

        return {
            locale,
            translations,
            count,
            message: count > 0 ? `Loaded ${count} translations for ${locale}` : 'Using fallback translations',
        };
    })

    // GET /api/translations/lists - Get available translation lists
    .get('/api/translations/lists', () => {
        return {
            locales: getAvailableLocales(),
            packageLocales: getAvailablePackageLocales(),
            defaultLocale: DEFAULT_LOCALE,
            localesLabels: LOCALES,
            packageLocalesLabels: PACKAGE_LOCALES,
        };
    })

    // GET /api/translations/detect - Detect locale from Accept-Language header
    .get('/api/translations/detect', ({ request }) => {
        const acceptLanguage = request.headers.get('accept-language');
        const detectedLocale = detectLocaleFromHeader(acceptLanguage);
        return {
            detected: detectedLocale,
            header: acceptLanguage,
            available: getAvailableLocales(),
        };
    })

    // GET /api/translations/translated-params/:locale - Get parameters with translations applied
    .get('/api/translations/translated-params/:locale', ({ params }) => {
        const locale = params.locale;

        // Return the parameters with TRANSLATABLE_TEXT: values translated
        return {
            userPreferencesConfig: translateObject(USER_PREFERENCES_CONFIG, locale),
            ideviceInfoFieldsConfig: translateObject(IDEVICE_INFO_FIELDS_CONFIG, locale),
            themeInfoFieldsConfig: translateObject(THEME_INFO_FIELDS_CONFIG, locale),
            themeEditionFieldsConfig: translateObject(THEME_EDITION_FIELDS_CONFIG, locale),
            odeComponentsSyncPropertiesConfig: translateObject(ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG, locale),
            odeNavStructureSyncPropertiesConfig: translateObject(ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG, locale),
            odePagStructureSyncPropertiesConfig: translateObject(ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG, locale),
            odeProjectSyncPropertiesConfig: translateObject(ODE_PROJECT_SYNC_PROPERTIES_CONFIG, locale),
            odeProjectSyncCataloguingConfig: translateObject(ODE_PROJECT_SYNC_CATALOGUING_CONFIG, locale),
        };
    })

    // GET /api/version - Get application version
    .get('/api/version', () => {
        return { version: getAppVersion() };
    })

    // GET /api/templates - Get templates for a specific locale
    // Returns admin-managed templates from the database
    .get(
        '/api/templates',
        async ({ query, set }) => {
            const { locale } = query;

            if (!locale) {
                set.status = 400;
                return { error: 'Bad Request', message: 'Locale parameter is required' };
            }

            // Validate locale
            if (!SUPPORTED_LOCALES.includes(locale)) {
                set.status = 400;
                return {
                    error: 'Bad Request',
                    message: `Invalid locale. Supported: ${SUPPORTED_LOCALES.join(', ')}`,
                };
            }

            // Get templates from database
            let templates: TemplateItem[] = [];
            try {
                const templatesDb = await getEnabledTemplatesByLocale(defaultDb, locale);
                templates = templatesDb.map(t => ({
                    name: t.filename,
                    displayName: t.display_name,
                    path: `/api/templates/${t.id}/download`,
                    source: 'admin' as const,
                    description: t.description || undefined,
                }));
            } catch {
                // Silently ignore if templates table doesn't exist yet
            }

            // Sort by displayName
            templates.sort((a, b) => a.displayName.localeCompare(b.displayName));

            return {
                templates,
                locale,
                supportedLocales: SUPPORTED_LOCALES,
            };
        },
        {
            query: t.Object({
                locale: t.String(),
            }),
        },
    )

    // GET /api/templates/:id/download - Public download of an enabled template
    // No authentication required, but only serves enabled templates
    .get(
        '/api/templates/:id/download',
        async ({ params, set }) => {
            const id = Number(params.id);

            if (isNaN(id) || id <= 0) {
                set.status = 400;
                return { error: 'Bad Request', message: 'Invalid template ID' };
            }

            // Find template by ID
            let template;
            try {
                template = await findTemplateById(defaultDb, id);
            } catch {
                // Table doesn't exist yet
                set.status = 404;
                return { error: 'Not Found', message: 'Template not found' };
            }

            if (!template) {
                set.status = 404;
                return { error: 'Not Found', message: 'Template not found' };
            }

            // SECURITY: Only serve enabled templates publicly
            // Disabled templates return 404 (don't reveal they exist)
            if (!template.is_enabled) {
                set.status = 404;
                return { error: 'Not Found', message: 'Template not found' };
            }

            // Build file path
            const filesDir = getFilesDir();
            const filePath = path.join(filesDir, 'templates', template.locale, `${template.filename}.elpx`);

            // Check if file exists
            const file = Bun.file(filePath);
            if (!(await file.exists())) {
                set.status = 404;
                return { error: 'Not Found', message: 'Template file not found' };
            }

            // Return file with proper headers
            set.headers['Content-Type'] = 'application/zip';
            set.headers['Content-Disposition'] = `attachment; filename="${template.filename}.elpx"`;

            return file;
        },
        {
            params: t.Object({
                id: t.String(),
            }),
        },
    )

    // GET /api/config/default-theme - Get the global default theme (base or site)
    .get('/api/config/default-theme', async () => {
        try {
            const defaultThemeSetting = await getDefaultTheme(defaultDb);
            const version = getAppVersion();

            if (defaultThemeSetting.type === 'site') {
                // Get site theme details from themes table
                const siteTheme = await getDefaultThemeRecord(defaultDb);
                if (siteTheme && siteTheme.is_builtin === 0) {
                    return {
                        defaultTheme: {
                            type: 'site',
                            dirName: siteTheme.dir_name,
                            displayName: siteTheme.display_name,
                            url: `/${version}/site-files/themes/${siteTheme.dir_name}`,
                        },
                    };
                }
            }

            // Base theme
            return {
                defaultTheme: {
                    type: 'base',
                    dirName: defaultThemeSetting.dirName,
                    displayName: defaultThemeSetting.dirName,
                    url: `/files/perm/themes/base/${defaultThemeSetting.dirName}`,
                },
            };
        } catch {
            // If table doesn't exist yet, return default 'base' theme
            return {
                defaultTheme: {
                    type: 'base',
                    dirName: 'base',
                    displayName: 'base',
                    url: '/files/perm/themes/base/base',
                },
            };
        }
    });
