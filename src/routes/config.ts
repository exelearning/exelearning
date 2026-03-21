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
import { LICENSE_REGISTRY } from '../shared/export/constants';
import { ALLOWED_EXTENSIONS } from '../config';
import { buildConfigParams } from './config-params';
import { API_ROUTES, prefixRoutesWithBasePath } from './api-routes';
import { buildParameterResponse } from './parameter-response';

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

const configParams = buildConfigParams({ TRANS_PREFIX, LICENSES, PACKAGE_LOCALES, LOCALES });

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
 * Template item structure returned by /api/templates endpoint
 */
interface TemplateItem {
    name: string;
    displayName: string;
    path: string;
    source: 'admin';
    description?: string;
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
        allowedExtensions: ALLOWED_EXTENSIONS,
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

        // Translate all config params for the requested locale
        const translatedParams = translateObject(configParams, locale);

        return buildParameterResponse({
            configParams: translatedParams,
            routes: prefixRoutesWithBasePath(API_ROUTES),
            appSettings: {
                canInstallThemes: canInstallThemes ? 1 : 0,
                canInstallIdevices: canInstallIdevices ? 1 : 0,
                autosaveOdeFilesFunction,
                autosaveIntervalTime,
                generateNewItemKey: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            },
        });
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
        // Return translated config params only (no routes or app settings)
        const translatedParams = translateObject(configParams, locale);
        return buildParameterResponse({
            configParams: translatedParams,
            routes: {},
        });
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
