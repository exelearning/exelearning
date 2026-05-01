import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { getSetting, setSetting } from '../db/queries/admin';

type AppSettingsTable = {
    key: string;
    value: string;
    type: string;
    updated_at: number | null;
    updated_by: number | null;
};

type AppSettingsDb = Kysely<Database & { app_settings: AppSettingsTable }>;

export const DISABLED_IDEVICES_SETTING_KEY = 'ADMIN_DISABLED_IDEVICES';

export function parseDisabledIdeviceIds(value: string | null | undefined): Set<string> {
    if (!value) return new Set();

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()));
    } catch {
        return new Set();
    }
}

export async function getDisabledIdeviceIds(db: Kysely<Database>): Promise<Set<string>> {
    try {
        const setting = await getSetting(db as unknown as AppSettingsDb, DISABLED_IDEVICES_SETTING_KEY);
        return parseDisabledIdeviceIds(setting?.value);
    } catch {
        return new Set();
    }
}

export async function setDisabledIdeviceIds(
    db: Kysely<Database>,
    ids: Iterable<string>,
    updatedBy?: number,
): Promise<void> {
    const normalized = [...new Set([...ids].map(id => id.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    await setSetting(
        db as unknown as AppSettingsDb,
        DISABLED_IDEVICES_SETTING_KEY,
        JSON.stringify(normalized),
        'json',
        updatedBy,
    );
}
