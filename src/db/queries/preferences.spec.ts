/**
 * Tests for User Preferences Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser } from '../../../test/helpers/test-db';
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
    let testOwnerId: number;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        // Create a test user for FK constraint
        testOwnerId = await seedTestUser(db, { email: 'test@example.com', user_id: 'test-user-123' });
    });

    // ============================================================================
    // READ QUERIES
    // ============================================================================

    describe('findPreferenceById', () => {
        it('should find preference by id', async () => {
            const created = await createPreference(db, {
                owner_id: testOwnerId,
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
        it('should find preference by owner_id and key', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'language',
                value: 'es',
            });

            const found = await findPreference(db, testOwnerId, 'language');

            expect(found).toBeDefined();
            expect(found!.value).toBe('es');
        });

        it('should return undefined for non-existent preference', async () => {
            const found = await findPreference(db, testOwnerId, 'nonexistent');
            expect(found).toBeUndefined();
        });

        it('should differentiate by owner_id', async () => {
            const ownerA = await seedTestUser(db, { email: 'a@test.com', user_id: 'user-a' });
            const ownerB = await seedTestUser(db, { email: 'b@test.com', user_id: 'user-b' });

            await createPreference(db, {
                owner_id: ownerA,
                preference_key: 'theme',
                value: 'dark',
            });
            await createPreference(db, {
                owner_id: ownerB,
                preference_key: 'theme',
                value: 'light',
            });

            const prefA = await findPreference(db, ownerA, 'theme');
            const prefB = await findPreference(db, ownerB, 'theme');

            expect(prefA!.value).toBe('dark');
            expect(prefB!.value).toBe('light');
        });
    });

    describe('findAllPreferencesForUser', () => {
        it('should return all preferences for user', async () => {
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'theme', value: 'dark' });
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'language', value: 'en' });
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'fontSize', value: '14' });

            const prefs = await findAllPreferencesForUser(db, testOwnerId);

            expect(prefs.length).toBe(3);
            expect(prefs.map(p => p.preference_key).sort()).toEqual(['fontSize', 'language', 'theme']);
        });

        it('should return empty array for user with no preferences', async () => {
            const otherOwner = await seedTestUser(db, { email: 'other@test.com', user_id: 'other-user' });
            const prefs = await findAllPreferencesForUser(db, otherOwner);
            expect(prefs).toEqual([]);
        });

        it('should not return preferences for other users', async () => {
            const ownerA = await seedTestUser(db, { email: 'a@test.com', user_id: 'user-a' });
            const ownerB = await seedTestUser(db, { email: 'b@test.com', user_id: 'user-b' });

            await createPreference(db, { owner_id: ownerA, preference_key: 'pref1', value: 'v1' });
            await createPreference(db, { owner_id: ownerB, preference_key: 'pref2', value: 'v2' });

            const prefsA = await findAllPreferencesForUser(db, ownerA);

            expect(prefsA.length).toBe(1);
            expect(prefsA[0].preference_key).toBe('pref1');
        });
    });

    describe('getPreferenceValue', () => {
        it('should return value for existing preference', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'color',
                value: 'blue',
            });

            const value = await getPreferenceValue(db, testOwnerId, 'color');

            expect(value).toBe('blue');
        });

        it('should return undefined for non-existent preference', async () => {
            const value = await getPreferenceValue(db, testOwnerId, 'nonexistent');
            expect(value).toBeUndefined();
        });
    });

    describe('getPreferenceValueOrDefault', () => {
        it('should return value for existing preference', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'size',
                value: 'large',
            });

            const value = await getPreferenceValueOrDefault(db, testOwnerId, 'size', 'medium');

            expect(value).toBe('large');
        });

        it('should return default for non-existent preference', async () => {
            const value = await getPreferenceValueOrDefault(db, testOwnerId, 'nonexistent', 'default-value');
            expect(value).toBe('default-value');
        });
    });

    // ============================================================================
    // WRITE QUERIES
    // ============================================================================

    describe('createPreference', () => {
        it('should create a new preference', async () => {
            const pref = await createPreference(db, {
                owner_id: testOwnerId,
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
                owner_id: testOwnerId,
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
                owner_id: testOwnerId,
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
                owner_id: testOwnerId,
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
            const pref = await setPreference(db, testOwnerId, 'newKey', 'newValue', 'description');

            expect(pref.preference_key).toBe('newKey');
            expect(pref.value).toBe('newValue');
            expect(pref.description).toBe('description');
        });

        it('should handle empty description', async () => {
            const pref = await setPreference(db, testOwnerId, 'emptyDescKey', 'value', '');

            expect(pref.preference_key).toBe('emptyDescKey');
            expect(pref.value).toBe('value');
            expect(pref.description).toBe('');
        });

        it('should update existing preference', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'existingKey',
                value: 'oldValue',
            });

            const updated = await setPreference(db, testOwnerId, 'existingKey', 'updatedValue');

            expect(updated.value).toBe('updatedValue');

            // Verify only one preference exists
            const prefs = await findAllPreferencesForUser(db, testOwnerId);
            expect(prefs.length).toBe(1);
        });

        it('should preserve description if not provided on update', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'withDesc',
                value: 'value1',
                description: 'original description',
            });

            const updated = await setPreference(db, testOwnerId, 'withDesc', 'value2');

            expect(updated.description).toBe('original description');
        });

        it('should override description if provided on update', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'withDesc',
                value: 'value1',
                description: 'original',
            });

            const updated = await setPreference(db, testOwnerId, 'withDesc', 'value2', 'new description');

            expect(updated.description).toBe('new description');
        });
    });

    describe('deletePreference', () => {
        it('should delete existing preference and return true', async () => {
            await createPreference(db, {
                owner_id: testOwnerId,
                preference_key: 'toDelete',
                value: 'value',
            });

            const result = await deletePreference(db, testOwnerId, 'toDelete');

            expect(result).toBe(true);

            const found = await findPreference(db, testOwnerId, 'toDelete');
            expect(found).toBeUndefined();
        });

        it('should return false for non-existent preference', async () => {
            const result = await deletePreference(db, testOwnerId, 'nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('deleteAllPreferencesForUser', () => {
        it('should delete all preferences for user', async () => {
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'pref1', value: 'v1' });
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'pref2', value: 'v2' });
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'pref3', value: 'v3' });

            const count = await deleteAllPreferencesForUser(db, testOwnerId);

            expect(count).toBe(3);

            const remaining = await findAllPreferencesForUser(db, testOwnerId);
            expect(remaining.length).toBe(0);
        });

        it('should return 0 for user with no preferences', async () => {
            const otherOwner = await seedTestUser(db, { email: 'other@test.com', user_id: 'other-user' });
            const count = await deleteAllPreferencesForUser(db, otherOwner);
            expect(count).toBe(0);
        });

        it('should not delete other users preferences', async () => {
            const ownerA = await seedTestUser(db, { email: 'a@test.com', user_id: 'user-a' });
            const ownerB = await seedTestUser(db, { email: 'b@test.com', user_id: 'user-b' });

            await createPreference(db, { owner_id: ownerA, preference_key: 'pref', value: 'v' });
            await createPreference(db, { owner_id: ownerB, preference_key: 'pref', value: 'v' });

            await deleteAllPreferencesForUser(db, ownerA);

            const prefsB = await findAllPreferencesForUser(db, ownerB);
            expect(prefsB.length).toBe(1);
        });
    });

    // ============================================================================
    // BULK OPERATIONS
    // ============================================================================

    describe('setMultiplePreferences', () => {
        it('should set multiple preferences at once', async () => {
            await setMultiplePreferences(db, testOwnerId, {
                theme: 'dark',
                language: 'es',
                fontSize: '16',
            });

            const prefs = await findAllPreferencesForUser(db, testOwnerId);
            expect(prefs.length).toBe(3);

            const themeValue = await getPreferenceValue(db, testOwnerId, 'theme');
            const langValue = await getPreferenceValue(db, testOwnerId, 'language');
            const sizeValue = await getPreferenceValue(db, testOwnerId, 'fontSize');

            expect(themeValue).toBe('dark');
            expect(langValue).toBe('es');
            expect(sizeValue).toBe('16');
        });

        it('should handle empty object without errors', async () => {
            // Set up an existing preference first
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'existing', value: 'v' });

            // Call with empty object - should not throw and not affect existing
            await setMultiplePreferences(db, testOwnerId, {});

            const prefs = await findAllPreferencesForUser(db, testOwnerId);
            expect(prefs.length).toBe(1);
            expect(prefs[0].preference_key).toBe('existing');
        });

        it('should update existing and create new preferences', async () => {
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'existing', value: 'old' });

            await setMultiplePreferences(db, testOwnerId, {
                existing: 'updated',
                new: 'new-value',
            });

            const existingValue = await getPreferenceValue(db, testOwnerId, 'existing');
            const newValue = await getPreferenceValue(db, testOwnerId, 'new');

            expect(existingValue).toBe('updated');
            expect(newValue).toBe('new-value');
        });
    });

    describe('getAllPreferencesAsMap', () => {
        it('should return preferences as Map', async () => {
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'key1', value: 'value1' });
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'key2', value: 'value2' });

            const map = await getAllPreferencesAsMap(db, testOwnerId);

            expect(map instanceof Map).toBe(true);
            expect(map.get('key1')).toBe('value1');
            expect(map.get('key2')).toBe('value2');
            expect(map.size).toBe(2);
        });

        it('should return empty Map for user with no preferences', async () => {
            const otherOwner = await seedTestUser(db, { email: 'other@test.com', user_id: 'other-user' });
            const map = await getAllPreferencesAsMap(db, otherOwner);
            expect(map.size).toBe(0);
        });
    });

    describe('getAllPreferencesAsObject', () => {
        it('should return preferences as object', async () => {
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'objKey1', value: 'objValue1' });
            await createPreference(db, { owner_id: testOwnerId, preference_key: 'objKey2', value: 'objValue2' });

            const obj = await getAllPreferencesAsObject(db, testOwnerId);

            expect(obj.objKey1).toBe('objValue1');
            expect(obj.objKey2).toBe('objValue2');
            expect(Object.keys(obj).length).toBe(2);
        });

        it('should return empty object for user with no preferences', async () => {
            const otherOwner = await seedTestUser(db, { email: 'other@test.com', user_id: 'other-user' });
            const obj = await getAllPreferencesAsObject(db, otherOwner);
            expect(Object.keys(obj).length).toBe(0);
        });
    });
});
