import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { getSetting as getSettingRecord } from '../db/queries/admin';

export type AppSettingType = 'string' | 'number' | 'boolean' | 'json';

type AppSettingsTable = {
    key: string;
    value: string;
    type: string;
    updated_at: string | null;
    updated_by: number | null;
};

type AppSettingsDb = Kysely<Database & { app_settings: AppSettingsTable }>;

export function parseBoolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).toLowerCase().trim();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
}

export function parseNumber(value: unknown, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

export async function getSettingValue(
    db: Kysely<Database>,
    key: string,
    fallback: string | null,
): Promise<string | null> {
    try {
        const setting = await getSettingRecord(db as unknown as AppSettingsDb, key);
        if (setting?.value !== undefined && setting?.value !== null) {
            return setting.value;
        }
    } catch {
        // Ignore DB errors and fall back to env/defaults
    }
    return fallback;
}

export async function getSettingString(db: Kysely<Database>, key: string, fallback: string): Promise<string> {
    const value = await getSettingValue(db, key, fallback);
    return value === null || value === undefined ? fallback : String(value);
}

export async function getSettingBoolean(db: Kysely<Database>, key: string, fallback: boolean): Promise<boolean> {
    const value = await getSettingValue(db, key, fallback ? 'true' : 'false');
    return parseBoolean(value, fallback);
}

export async function getSettingNumber(db: Kysely<Database>, key: string, fallback: number): Promise<number> {
    const value = await getSettingValue(db, key, String(fallback));
    return parseNumber(value, fallback);
}

export function parseAuthMethods(raw: string): string[] {
    return raw
        .split(',')
        .map(method => method.trim().toLowerCase())
        .filter(Boolean);
}

export async function getAuthMethods(db: Kysely<Database>, fallback: string): Promise<string[]> {
    const value = await getSettingString(db, 'APP_AUTH_METHODS', fallback);
    return parseAuthMethods(value);
}
