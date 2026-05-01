/**
 * Local mode utilities
 *
 * Determines whether the running instance is in "local mode" (Electron, dev,
 * or self-hosted offline) and whether local-only features (such as the iDevice
 * installer) should be exposed.
 *
 * Convention:
 *   - APP_ONLINE_MODE=0    → offline / local install
 *   - APP_ONLINE_MODE=1    → online (default)
 *   - APP_ENV=dev          → development mode (treated as local)
 *   - ONLINE_IDEVICES_INSTALL=1 → admin opt-in to allow iDevice install in online mode
 */
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { getSettingBoolean, parseBoolean } from '../services/app-settings';

/**
 * True when the runtime is configured as offline/local (env-only check).
 */
export const isLocalMode = (): boolean => String(process.env.APP_ONLINE_MODE ?? '1') === '0';

/**
 * True when the runtime is APP_ENV=dev.
 */
export const isDevEnv = (): boolean => process.env.APP_ENV === 'dev';

/**
 * Synchronous, env-only check used by route guards that don't have DB access
 * (or for the frontend-facing initial gate). For full enforcement against the
 * admin-controlled DB setting, use {@link canInstallIdevices}.
 */
export const canInstallIdevicesFromEnv = (): boolean => {
    if (isLocalMode() || isDevEnv()) return true;
    return parseBoolean(process.env.ONLINE_IDEVICES_INSTALL, false);
};

/**
 * Full check that combines the env-only signal with the DB-stored
 * ONLINE_IDEVICES_INSTALL admin override. Use this in handlers that have
 * a Kysely instance available.
 */
export const canInstallIdevices = async (db: Kysely<Database>): Promise<boolean> => {
    if (isLocalMode() || isDevEnv()) return true;
    return getSettingBoolean(db, 'ONLINE_IDEVICES_INSTALL', parseBoolean(process.env.ONLINE_IDEVICES_INSTALL, false));
};
