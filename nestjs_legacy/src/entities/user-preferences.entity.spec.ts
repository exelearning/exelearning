import { UserPreferences } from './user-preferences.entity';

describe('UserPreferences Entity', () => {
    describe('Entity Creation', () => {
        it('should create a UserPreferences instance with all required fields', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'advancedMode';
            preference.value = 'true';
            preference.description = 'Enable advanced mode';

            expect(preference.userId).toBe('user123');
            expect(preference.preferenceKey).toBe('advancedMode');
            expect(preference.value).toBe('true');
            expect(preference.description).toBe('Enable advanced mode');
        });

        it('should create a UserPreferences instance with null description', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'locale';
            preference.value = 'en';
            preference.description = null;

            expect(preference.description).toBeNull();
        });

        it('should inherit BaseEntity fields', () => {
            const preference = new UserPreferences();

            // BaseEntity fields should be accessible
            expect(preference.id).toBeUndefined();
            expect(preference.isActive).toBeUndefined();
            expect(preference.createdAt).toBeUndefined();
            expect(preference.updatedAt).toBeUndefined();
        });

        it('should trigger lifecycle hooks from BaseEntity', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'testKey';
            preference.value = 'testValue';

            // Simulate @BeforeInsert
            preference.setCreatedAt();

            expect(preference.createdAt).toBeDefined();
            expect(preference.updatedAt).toBeDefined();
            expect(preference.isActive).toBe(true);
        });
    });

    describe('Field Constraints', () => {
        it('should handle long text values', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'longConfig';
            preference.value = 'x'.repeat(10000); // Very long value

            expect(preference.value.length).toBe(10000);
        });

        it('should handle special characters in values', () => {
            const preference = new UserPreferences();
            preference.userId = 'user@example.com';
            preference.preferenceKey = 'config.nested.key';
            preference.value = '{"json": "value", "special": "<>&\'""}';

            expect(preference.value).toContain('"json"');
            expect(preference.value).toContain('<>&');
        });

        it('should handle empty string values', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'emptyPref';
            preference.value = '';

            expect(preference.value).toBe('');
        });
    });

    describe('Common Use Cases', () => {
        it('should represent a boolean preference', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'advancedMode';
            preference.value = 'true';
            preference.description = 'Enable advanced mode features';

            expect(preference.value).toBe('true');
            // In real usage, would be parsed as: JSON.parse(preference.value)
        });

        it('should represent a locale preference', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'locale';
            preference.value = 'es';
            preference.description = 'User interface language';

            expect(preference.value).toBe('es');
        });

        it('should represent a JSON object preference', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'editorSettings';
            preference.value = JSON.stringify({
                fontSize: 14,
                theme: 'dark',
                lineNumbers: true,
            });

            const parsed = JSON.parse(preference.value);
            expect(parsed.fontSize).toBe(14);
            expect(parsed.theme).toBe('dark');
        });
    });

    describe('Lifecycle Management', () => {
        it('should maintain timestamps across updates', async () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'testKey';
            preference.value = 'initialValue';

            // Simulate insert
            preference.setCreatedAt();
            const initialCreatedAt = preference.createdAt;
            const initialUpdatedAt = preference.updatedAt;

            // Wait a bit
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Simulate update
            preference.value = 'updatedValue';
            preference.setUpdatedAt();

            // createdAt should not change
            expect(preference.createdAt).toBe(initialCreatedAt);
            // updatedAt should be newer
            expect(preference.updatedAt!.getTime()).toBeGreaterThan(initialUpdatedAt!.getTime());
        });

        it('should handle soft delete via isActive flag', () => {
            const preference = new UserPreferences();
            preference.userId = 'user123';
            preference.preferenceKey = 'testKey';
            preference.value = 'testValue';
            preference.setCreatedAt();

            // Initially active
            expect(preference.isActive).toBe(true);

            // Soft delete
            preference.isActive = false;

            expect(preference.isActive).toBe(false);
            expect(preference.value).toBe('testValue'); // Data still present
        });
    });
});
