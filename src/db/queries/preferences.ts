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
    userId: string,
    preferenceKey: string,
): Promise<UserPreference | undefined> {
    return db
        .selectFrom('users_preferences')
        .selectAll()
        .where('user_id', '=', userId)
        .where('preference_key', '=', preferenceKey)
        .executeTakeFirst();
}

export async function findAllPreferencesForUser(db: Kysely<Database>, userId: string): Promise<UserPreference[]> {
    return db.selectFrom('users_preferences').selectAll().where('user_id', '=', userId).execute();
}

export async function getPreferenceValue(
    db: Kysely<Database>,
    userId: string,
    preferenceKey: string,
): Promise<string | undefined> {
    const pref = await findPreference(db, userId, preferenceKey);
    return pref?.value;
}

export async function getPreferenceValueOrDefault(
    db: Kysely<Database>,
    userId: string,
    preferenceKey: string,
    defaultValue: string,
): Promise<string> {
    const value = await getPreferenceValue(db, userId, preferenceKey);
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
    userId: string,
    preferenceKey: string,
    value: string,
    description?: string,
): Promise<UserPreference> {
    const existing = await findPreference(db, userId, preferenceKey);
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
        user_id: userId,
        preference_key: preferenceKey,
        value,
        description: description ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        is_active: 1,
    });
}

export async function deletePreference(db: Kysely<Database>, userId: string, preferenceKey: string): Promise<boolean> {
    const existing = await findPreference(db, userId, preferenceKey);
    if (!existing) return false;

    await db.deleteFrom('users_preferences').where('id', '=', existing.id).execute();
    return true;
}

export async function deleteAllPreferencesForUser(db: Kysely<Database>, userId: string): Promise<number> {
    const result = await db
        .selectFrom('users_preferences')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst();
    const count = Number(result?.count ?? 0);

    if (count > 0) {
        await db.deleteFrom('users_preferences').where('user_id', '=', userId).execute();
    }

    return count;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

export async function setMultiplePreferences(
    db: Kysely<Database>,
    userId: string,
    preferences: Record<string, string>,
): Promise<void> {
    for (const [key, value] of Object.entries(preferences)) {
        await setPreference(db, userId, key, value);
    }
}

export async function getAllPreferencesAsMap(db: Kysely<Database>, userId: string): Promise<Map<string, string>> {
    const prefs = await findAllPreferencesForUser(db, userId);
    const map = new Map<string, string>();
    for (const pref of prefs) {
        map.set(pref.preference_key, pref.value);
    }
    return map;
}

export async function getAllPreferencesAsObject(db: Kysely<Database>, userId: string): Promise<Record<string, string>> {
    const prefs = await findAllPreferencesForUser(db, userId);
    const obj: Record<string, string> = {};
    for (const pref of prefs) {
        obj[pref.preference_key] = pref.value;
    }
    return obj;
}
