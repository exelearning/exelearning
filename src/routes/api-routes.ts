/**
 * API Route Definitions
 *
 * Single source of truth for all API route paths and methods.
 * Used by the server (config.ts) and the static bundle builder.
 */

import { getBasePath } from '../utils/basepath.util';

export type RouteDefinition = { path: string; methods: string[] };
export type RouteMap = Record<string, RouteDefinition>;

/**
 * Complete API route definitions.
 * Format expected by frontend: { routeName: { path: string, methods: string[] } }
 */
export const API_ROUTES: RouteMap = {
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
};

/**
 * Minimal route subset for static/offline mode.
 * These routes are stubbed client-side by StaticDataProvider.
 * Derived from API_ROUTES — never define paths separately.
 */
export const STATIC_ROUTES: RouteMap = {
    api_translations_lists: API_ROUTES.api_translations_lists,
    api_translations_list_by_locale: API_ROUTES.api_translations_list_by_locale,
    api_idevices_installed: API_ROUTES.api_idevices_installed,
    api_themes_installed: API_ROUTES.api_themes_installed,
    api_config_upload_limits: API_ROUTES.api_config_upload_limits,
};

/**
 * Prefix all API route paths with BASE_PATH for subdirectory installations.
 * This ensures frontend code makes requests to the correct prefixed URLs.
 */
export function prefixRoutesWithBasePath(routes: RouteMap): RouteMap {
    const basePath = getBasePath();
    if (!basePath) {
        return routes;
    }

    const prefixedRoutes: RouteMap = {};
    for (const [key, route] of Object.entries(routes)) {
        prefixedRoutes[key] = {
            ...route,
            path: `${basePath}${route.path}`,
        };
    }
    return prefixedRoutes;
}
