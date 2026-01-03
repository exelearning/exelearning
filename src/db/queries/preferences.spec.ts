/**
 * Tests for User Preferences Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    findPreferenceById,
    findPreference,
    findAllPreferencesForUser,
    getPreferenceValue,
    getPreferenceValueOrDefault,
    createPreference,
    updatePreference,
    setPreference,
    deletePreference,
    deleteAllPreferencesForUser,
    setMultiplePreferences,
    getAllPreferencesAsMap,
    getAllPreferencesAsObject,
} from './preferences';

describe('Preferences Queries', () => {
    let db: Kysely<Database>;
    const testUserId = 'test-user-123';

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
    });

    // ============================================================================
    // READ QUERIES
    // ============================================================================

    describe('findPreferenceById', () => {
        it('should find preference by id', async () => {
            const created = await createPreference(db, {
                user_id: testUserId,
                preference_key: 'theme',
                value: 'dark',
                description: 'User theme',
            });

            const found = await findPreferenceById(db, created.id);

            expect(found).toBeDefined();
            expect(found!.id).toBe(created.id);
            expect(found!.preference_key).toBe('theme');
            expect(found!.value).toBe('dark');
        });

        it('should return undefined for non-existent id', async () => {
            const found = await findPreferenceById(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findPreference', () => {
        it('should find preference by user_id and key', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'language',
                value: 'es',
            });

            const found = await findPreference(db, testUserId, 'language');

            expect(found).toBeDefined();
            expect(found!.value).toBe('es');
        });

        it('should return undefined for non-existent preference', async () => {
            const found = await findPreference(db, testUserId, 'nonexistent');
            expect(found).toBeUndefined();
        });

        it('should differentiate by user_id', async () => {
            await createPreference(db, {
                user_id: 'user-a',
                preference_key: 'theme',
                value: 'dark',
            });
            await createPreference(db, {
                user_id: 'user-b',
                preference_key: 'theme',
                value: 'light',
            });

            const prefA = await findPreference(db, 'user-a', 'theme');
            const prefB = await findPreference(db, 'user-b', 'theme');

            expect(prefA!.value).toBe('dark');
            expect(prefB!.value).toBe('light');
        });
    });

    describe('findAllPreferencesForUser', () => {
        it('should return all preferences for user', async () => {
            await createPreference(db, { user_id: testUserId, preference_key: 'theme', value: 'dark' });
            await createPreference(db, { user_id: testUserId, preference_key: 'language', value: 'en' });
            await createPreference(db, { user_id: testUserId, preference_key: 'fontSize', value: '14' });

            const prefs = await findAllPreferencesForUser(db, testUserId);

            expect(prefs.length).toBe(3);
            expect(prefs.map(p => p.preference_key).sort()).toEqual(['fontSize', 'language', 'theme']);
        });

        it('should return empty array for user with no preferences', async () => {
            const prefs = await findAllPreferencesForUser(db, 'nonexistent-user');
            expect(prefs).toEqual([]);
        });

        it('should not return preferences for other users', async () => {
            await createPreference(db, { user_id: 'user-a', preference_key: 'pref1', value: 'v1' });
            await createPreference(db, { user_id: 'user-b', preference_key: 'pref2', value: 'v2' });

            const prefsA = await findAllPreferencesForUser(db, 'user-a');

            expect(prefsA.length).toBe(1);
            expect(prefsA[0].preference_key).toBe('pref1');
        });
    });

    describe('getPreferenceValue', () => {
        it('should return value for existing preference', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'color',
                value: 'blue',
            });

            const value = await getPreferenceValue(db, testUserId, 'color');

            expect(value).toBe('blue');
        });

        it('should return undefined for non-existent preference', async () => {
            const value = await getPreferenceValue(db, testUserId, 'nonexistent');
            expect(value).toBeUndefined();
        });
    });

    describe('getPreferenceValueOrDefault', () => {
        it('should return value for existing preference', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'size',
                value: 'large',
            });

            const value = await getPreferenceValueOrDefault(db, testUserId, 'size', 'medium');

            expect(value).toBe('large');
        });

        it('should return default for non-existent preference', async () => {
            const value = await getPreferenceValueOrDefault(db, testUserId, 'nonexistent', 'default-value');
            expect(value).toBe('default-value');
        });
    });

    // ============================================================================
    // WRITE QUERIES
    // ============================================================================

    describe('createPreference', () => {
        it('should create a new preference', async () => {
            const pref = await createPreference(db, {
                user_id: testUserId,
                preference_key: 'newPref',
                value: 'newValue',
                description: 'A new preference',
            });

            expect(pref.id).toBeDefined();
            expect(pref.preference_key).toBe('newPref');
            expect(pref.value).toBe('newValue');
            expect(pref.description).toBe('A new preference');
            expect(pref.is_active).toBe(1);
        });

        it('should set timestamps', async () => {
            const before = Date.now();
            const pref = await createPreference(db, {
                user_id: testUserId,
                preference_key: 'timestamped',
                value: 'value',
            });
            const after = Date.now();

            expect(pref.created_at).toBeDefined();
            expect(pref.updated_at).toBeDefined();
            expect(pref.created_at!).toBeGreaterThanOrEqual(before);
            expect(pref.created_at!).toBeLessThanOrEqual(after);
        });
    });

    describe('updatePreference', () => {
        it('should update an existing preference', async () => {
            const created = await createPreference(db, {
                user_id: testUserId,
                preference_key: 'theme',
                value: 'light',
            });

            const updated = await updatePreference(db, created.id, { value: 'dark' });

            expect(updated!.value).toBe('dark');
            expect(updated!.preference_key).toBe('theme');
        });

        it('should return undefined for non-existent id', async () => {
            const updated = await updatePreference(db, 99999, { value: 'new' });
            expect(updated).toBeUndefined();
        });

        it('should update updated_at timestamp', async () => {
            const created = await createPreference(db, {
                user_id: testUserId,
                preference_key: 'pref',
                value: 'old',
            });
            const originalTimestamp = created.updated_at;

            await new Promise(r => setTimeout(r, 10));

            const updated = await updatePreference(db, created.id, { value: 'new' });

            expect(updated!.updated_at! > originalTimestamp!).toBe(true);
        });
    });

    describe('setPreference (upsert)', () => {
        it('should insert new preference if not exists', async () => {
            const pref = await setPreference(db, testUserId, 'newKey', 'newValue', 'description');

            expect(pref.preference_key).toBe('newKey');
            expect(pref.value).toBe('newValue');
            expect(pref.description).toBe('description');
        });

        it('should update existing preference', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'existingKey',
                value: 'oldValue',
            });

            const updated = await setPreference(db, testUserId, 'existingKey', 'updatedValue');

            expect(updated.value).toBe('updatedValue');

            // Verify only one preference exists
            const prefs = await findAllPreferencesForUser(db, testUserId);
            expect(prefs.length).toBe(1);
        });

        it('should preserve description if not provided on update', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'withDesc',
                value: 'value1',
                description: 'original description',
            });

            const updated = await setPreference(db, testUserId, 'withDesc', 'value2');

            expect(updated.description).toBe('original description');
        });

        it('should override description if provided on update', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'withDesc',
                value: 'value1',
                description: 'original',
            });

            const updated = await setPreference(db, testUserId, 'withDesc', 'value2', 'new description');

            expect(updated.description).toBe('new description');
        });
    });

    describe('deletePreference', () => {
        it('should delete existing preference and return true', async () => {
            await createPreference(db, {
                user_id: testUserId,
                preference_key: 'toDelete',
                value: 'value',
            });

            const result = await deletePreference(db, testUserId, 'toDelete');

            expect(result).toBe(true);

            const found = await findPreference(db, testUserId, 'toDelete');
            expect(found).toBeUndefined();
        });

        it('should return false for non-existent preference', async () => {
            const result = await deletePreference(db, testUserId, 'nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('deleteAllPreferencesForUser', () => {
        it('should delete all preferences for user', async () => {
            await createPreference(db, { user_id: testUserId, preference_key: 'pref1', value: 'v1' });
            await createPreference(db, { user_id: testUserId, preference_key: 'pref2', value: 'v2' });
            await createPreference(db, { user_id: testUserId, preference_key: 'pref3', value: 'v3' });

            const count = await deleteAllPreferencesForUser(db, testUserId);

            expect(count).toBe(3);

            const remaining = await findAllPreferencesForUser(db, testUserId);
            expect(remaining.length).toBe(0);
        });

        it('should return 0 for user with no preferences', async () => {
            const count = await deleteAllPreferencesForUser(db, 'nonexistent');
            expect(count).toBe(0);
        });

        it('should not delete other users preferences', async () => {
            await createPreference(db, { user_id: 'user-a', preference_key: 'pref', value: 'v' });
            await createPreference(db, { user_id: 'user-b', preference_key: 'pref', value: 'v' });

            await deleteAllPreferencesForUser(db, 'user-a');

            const prefsB = await findAllPreferencesForUser(db, 'user-b');
            expect(prefsB.length).toBe(1);
        });
    });

    // ============================================================================
    // BULK OPERATIONS
    // ============================================================================

    describe('setMultiplePreferences', () => {
        it('should set multiple preferences at once', async () => {
            await setMultiplePreferences(db, testUserId, {
                theme: 'dark',
                language: 'es',
                fontSize: '16',
            });

            const prefs = await findAllPreferencesForUser(db, testUserId);
            expect(prefs.length).toBe(3);

            const themeValue = await getPreferenceValue(db, testUserId, 'theme');
            const langValue = await getPreferenceValue(db, testUserId, 'language');
            const sizeValue = await getPreferenceValue(db, testUserId, 'fontSize');

            expect(themeValue).toBe('dark');
            expect(langValue).toBe('es');
            expect(sizeValue).toBe('16');
        });

        it('should update existing and create new preferences', async () => {
            await createPreference(db, { user_id: testUserId, preference_key: 'existing', value: 'old' });

            await setMultiplePreferences(db, testUserId, {
                existing: 'updated',
                new: 'new-value',
            });

            const existingValue = await getPreferenceValue(db, testUserId, 'existing');
            const newValue = await getPreferenceValue(db, testUserId, 'new');

            expect(existingValue).toBe('updated');
            expect(newValue).toBe('new-value');
        });
    });

    describe('getAllPreferencesAsMap', () => {
        it('should return preferences as Map', async () => {
            await createPreference(db, { user_id: testUserId, preference_key: 'key1', value: 'value1' });
            await createPreference(db, { user_id: testUserId, preference_key: 'key2', value: 'value2' });

            const map = await getAllPreferencesAsMap(db, testUserId);

            expect(map instanceof Map).toBe(true);
            expect(map.get('key1')).toBe('value1');
            expect(map.get('key2')).toBe('value2');
            expect(map.size).toBe(2);
        });

        it('should return empty Map for user with no preferences', async () => {
            const map = await getAllPreferencesAsMap(db, 'nonexistent');
            expect(map.size).toBe(0);
        });
    });

    describe('getAllPreferencesAsObject', () => {
        it('should return preferences as object', async () => {
            await createPreference(db, { user_id: testUserId, preference_key: 'objKey1', value: 'objValue1' });
            await createPreference(db, { user_id: testUserId, preference_key: 'objKey2', value: 'objValue2' });

            const obj = await getAllPreferencesAsObject(db, testUserId);

            expect(obj.objKey1).toBe('objValue1');
            expect(obj.objKey2).toBe('objValue2');
            expect(Object.keys(obj).length).toBe(2);
        });

        it('should return empty object for user with no preferences', async () => {
            const obj = await getAllPreferencesAsObject(db, 'nonexistent');
            expect(Object.keys(obj).length).toBe(0);
        });
    });
});
