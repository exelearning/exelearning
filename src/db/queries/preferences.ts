/**
 * User Preferences Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, UserPreference, NewUserPreference, UserPreferenceUpdate } from '../types';
import { now } from '../types';
import { insertAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// READ QUERIES
// ============================================================================

export async function findPreferenceById(db: Kysely<Database>, id: number): Promise<UserPreference | undefined> {
    return db.selectFrom('users_preferences').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findPreference(
    db: Kysely<Database>,
    ownerId: number,
    preferenceKey: string,
): Promise<UserPreference | undefined> {
    return db
        .selectFrom('users_preferences')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('preference_key', '=', preferenceKey)
        .executeTakeFirst();
}

export async function findAllPreferencesForUser(db: Kysely<Database>, ownerId: number): Promise<UserPreference[]> {
    return db.selectFrom('users_preferences').selectAll().where('owner_id', '=', ownerId).execute();
}

export async function getPreferenceValue(
    db: Kysely<Database>,
    ownerId: number,
    preferenceKey: string,
): Promise<string | undefined> {
    const pref = await findPreference(db, ownerId, preferenceKey);
    return pref?.value;
}

export async function getPreferenceValueOrDefault(
    db: Kysely<Database>,
    ownerId: number,
    preferenceKey: string,
    defaultValue: string,
): Promise<string> {
    const value = await getPreferenceValue(db, ownerId, preferenceKey);
    return value ?? defaultValue;
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createPreference(db: Kysely<Database>, data: NewUserPreference): Promise<UserPreference> {
    const timestamp = now();
    return insertAndReturn(db, 'users_preferences', {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        is_active: 1,
    });
}

export async function updatePreference(
    db: Kysely<Database>,
    id: number,
    data: UserPreferenceUpdate,
): Promise<UserPreference | undefined> {
    return updateByIdAndReturn(db, 'users_preferences', id, {
        ...data,
        updated_at: now(),
    });
}

export async function setPreference(
    db: Kysely<Database>,
    ownerId: number,
    preferenceKey: string,
    value: string,
    description?: string,
): Promise<UserPreference> {
    const existing = await findPreference(db, ownerId, preferenceKey);
    const timestamp = now();

    if (existing) {
        const updated = await updateByIdAndReturn(db, 'users_preferences', existing.id, {
            value,
            description: description ?? existing.description,
            updated_at: timestamp,
        });
        return updated!;
    }

    return insertAndReturn(db, 'users_preferences', {
        owner_id: ownerId,
        preference_key: preferenceKey,
        value,
        description: description ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        is_active: 1,
    });
}

export async function deletePreference(db: Kysely<Database>, ownerId: number, preferenceKey: string): Promise<boolean> {
    const existing = await findPreference(db, ownerId, preferenceKey);
    if (!existing) return false;

    await db.deleteFrom('users_preferences').where('id', '=', existing.id).execute();
    return true;
}

export async function deleteAllPreferencesForUser(db: Kysely<Database>, ownerId: number): Promise<number> {
    // Execute DELETE directly and return affected row count
    // DeleteResult.numDeletedRows returns a BigInt, convert to number
    const result = await db.deleteFrom('users_preferences').where('owner_id', '=', ownerId).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export async function setMultiplePreferences(
    db: Kysely<Database>,
    ownerId: number,
    preferences: Record<string, string>,
): Promise<void> {
    for (const [key, value] of Object.entries(preferences)) {
        await setPreference(db, ownerId, key, value);
    }
}

export async function getAllPreferencesAsMap(db: Kysely<Database>, ownerId: number): Promise<Map<string, string>> {
    const prefs = await findAllPreferencesForUser(db, ownerId);
    const map = new Map<string, string>();
    for (const pref of prefs) {
        map.set(pref.preference_key, pref.value);
    }
    return map;
}

export async function getAllPreferencesAsObject(
    db: Kysely<Database>,
    ownerId: number,
): Promise<Record<string, string>> {
    const prefs = await findAllPreferencesForUser(db, ownerId);
    const obj: Record<string, string> = {};
    for (const pref of prefs) {
        obj[pref.preference_key] = pref.value;
    }
    return obj;
}
