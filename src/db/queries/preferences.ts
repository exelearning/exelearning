/**
 * User Preferences Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, UserPreference, NewUserPreference, UserPreferenceUpdate } from '../types';
import { now } from '../types';
import { supportsReturning } from '../helpers';

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
    const values = {
        ...data,
        created_at: timestamp,
        updated_at: timestamp,
        is_active: 1,
    };

    if (supportsReturning()) {
        return db.insertInto('users_preferences').values(values).returningAll().executeTakeFirstOrThrow();
    }

    // MySQL: Insert then SELECT
    const result = await db.insertInto('users_preferences').values(values).executeTakeFirstOrThrow();
    const insertId = Number(result.insertId);
    const pref = await db.selectFrom('users_preferences').selectAll().where('id', '=', insertId).executeTakeFirst();
    if (!pref) {
        throw new Error('Failed to create preference');
    }
    return pref;
}

export async function updatePreference(
    db: Kysely<Database>,
    id: number,
    data: UserPreferenceUpdate,
): Promise<UserPreference | undefined> {
    const values = {
        ...data,
        updated_at: now(),
    };

    if (supportsReturning()) {
        return db.updateTable('users_preferences').set(values).where('id', '=', id).returningAll().executeTakeFirst();
    }

    // MySQL: Update then SELECT
    const result = await db.updateTable('users_preferences').set(values).where('id', '=', id).executeTakeFirst();
    if (!result || result.numUpdatedRows === 0n) {
        return undefined;
    }
    return db.selectFrom('users_preferences').selectAll().where('id', '=', id).executeTakeFirst();
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
        const updateValues = {
            value,
            description: description ?? existing.description,
            updated_at: timestamp,
        };

        if (supportsReturning()) {
            const updated = await db
                .updateTable('users_preferences')
                .set(updateValues)
                .where('id', '=', existing.id)
                .returningAll()
                .executeTakeFirst();
            return updated!;
        }

        // MySQL: Update then SELECT
        await db.updateTable('users_preferences').set(updateValues).where('id', '=', existing.id).execute();
        const updated = await db
            .selectFrom('users_preferences')
            .selectAll()
            .where('id', '=', existing.id)
            .executeTakeFirst();
        return updated!;
    }

    // Insert new preference
    const insertValues = {
        user_id: userId,
        preference_key: preferenceKey,
        value,
        description: description ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        is_active: 1,
    };

    if (supportsReturning()) {
        return db.insertInto('users_preferences').values(insertValues).returningAll().executeTakeFirstOrThrow();
    }

    // MySQL: Insert then SELECT
    const result = await db.insertInto('users_preferences').values(insertValues).executeTakeFirstOrThrow();
    const insertId = Number(result.insertId);
    const pref = await db.selectFrom('users_preferences').selectAll().where('id', '=', insertId).executeTakeFirst();
    if (!pref) {
        throw new Error('Failed to create preference');
    }
    return pref;
}

export async function deletePreference(db: Kysely<Database>, userId: string, preferenceKey: string): Promise<boolean> {
    const existing = await findPreference(db, userId, preferenceKey);
    if (!existing) return false;

    await db.deleteFrom('users_preferences').where('id', '=', existing.id).execute();
    return true;
}

export async function deleteAllPreferencesForUser(db: Kysely<Database>, userId: string): Promise<number> {
    if (supportsReturning()) {
        const result = await db.deleteFrom('users_preferences').where('user_id', '=', userId).returningAll().execute();
        return result.length;
    }

    // MySQL: Count first, then delete
    const existing = await db.selectFrom('users_preferences').selectAll().where('user_id', '=', userId).execute();
    if (existing.length > 0) {
        await db.deleteFrom('users_preferences').where('user_id', '=', userId).execute();
    }
    return existing.length;
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
