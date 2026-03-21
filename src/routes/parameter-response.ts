/**
 * Parameter Response Builder
 *
 * Single source of truth for the shape of the parameter response returned to the frontend.
 * Used by both the server route (/api/parameter-management/parameters/data/list)
 * and the static bundle builder (buildApiParameters).
 *
 * This ensures that adding or removing a config group only requires a change
 * in config-params.ts — the response shape stays in sync automatically.
 */

import type { buildConfigParams } from './config-params';
import type { RouteMap } from './api-routes';

/**
 * Server-only application settings.
 * Omitted in static mode (frontend handles missing keys gracefully).
 */
export interface AppSettings {
    canInstallThemes?: number;
    canInstallIdevices?: number;
    autosaveOdeFilesFunction?: boolean;
    autosaveIntervalTime?: number;
    generateNewItemKey?: string;
}

export interface ParameterResponseOptions {
    /** Config objects from buildConfigParams (plain or already translated). */
    configParams: ReturnType<typeof buildConfigParams>;
    /** Route definitions to include in the response. */
    routes: RouteMap;
    /** Server-only app settings. Omit for static builds. */
    appSettings?: AppSettings;
    /** When true, returns empty themeEditionFieldsConfig (static/offline mode). */
    disableThemeEdition?: boolean;
}

/**
 * Assembles the parameter response that the frontend expects.
 * Both server and static call this with their respective inputs.
 */
export function buildParameterResponse(opts: ParameterResponseOptions) {
    const { configParams, routes, appSettings = {}, disableThemeEdition = false } = opts;

    return {
        userPreferencesConfig: configParams.USER_PREFERENCES_CONFIG,
        ideviceInfoFieldsConfig: configParams.IDEVICE_INFO_FIELDS_CONFIG,
        themeInfoFieldsConfig: configParams.THEME_INFO_FIELDS_CONFIG,
        themeEditionFieldsConfig: disableThemeEdition ? {} : configParams.THEME_EDITION_FIELDS_CONFIG,
        odeComponentsSyncPropertiesConfig: configParams.ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG,
        odeNavStructureSyncPropertiesConfig: configParams.ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        odePagStructureSyncPropertiesConfig: configParams.ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        odeProjectSyncPropertiesConfig: configParams.ODE_PROJECT_SYNC_PROPERTIES_CONFIG,
        odeProjectSyncCataloguingConfig: configParams.ODE_PROJECT_SYNC_CATALOGUING_CONFIG,
        routes,
        ...appSettings,
    };
}
