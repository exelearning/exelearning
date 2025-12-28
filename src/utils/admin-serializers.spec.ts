/**
 * Tests for Admin Serializers
 */
import { describe, expect, test } from 'bun:test';
import { snakeToCamel, serializeRecord, createSerializer } from './admin-serializers';

describe('Admin Serializers', () => {
    describe('snakeToCamel', () => {
        test('should convert snake_case to camelCase', () => {
            expect(snakeToCamel('display_name')).toBe('displayName');
        });

        test('should handle multiple underscores', () => {
            expect(snakeToCamel('is_enabled_flag')).toBe('isEnabledFlag');
        });

        test('should return same string if no underscores', () => {
            expect(snakeToCamel('name')).toBe('name');
        });

        test('should handle empty string', () => {
            expect(snakeToCamel('')).toBe('');
        });

        test('should handle leading underscore', () => {
            expect(snakeToCamel('_private')).toBe('Private');
        });

        test('should handle trailing underscore', () => {
            expect(snakeToCamel('value_')).toBe('value_');
        });

        test('should handle consecutive underscores', () => {
            expect(snakeToCamel('some__value')).toBe('some_Value');
        });
    });

    describe('serializeRecord', () => {
        test('should convert snake_case keys to camelCase', () => {
            const record = {
                id: 1,
                display_name: 'Test Name',
                created_at: '2024-01-01',
            };

            const result = serializeRecord(record);

            expect(result).toEqual({
                id: 1,
                displayName: 'Test Name',
                createdAt: '2024-01-01',
            });
        });

        test('should convert specified fields to booleans', () => {
            const record = {
                id: 1,
                is_enabled: 1,
                is_default: 0,
                name: 'Test',
            };

            const result = serializeRecord(record, ['is_enabled', 'is_default']);

            expect(result).toEqual({
                id: 1,
                isEnabled: true,
                isDefault: false,
                name: 'Test',
            });
        });

        test('should handle null values', () => {
            const record = {
                id: 1,
                description: null,
                is_enabled: 1,
            };

            const result = serializeRecord(record, ['is_enabled']);

            expect(result).toEqual({
                id: 1,
                description: null,
                isEnabled: true,
            });
        });

        test('should handle empty record', () => {
            const result = serializeRecord({});
            expect(result).toEqual({});
        });

        test('should not convert non-1 values to true', () => {
            const record = {
                is_enabled: 2,
                is_active: 'yes',
            };

            const result = serializeRecord(record, ['is_enabled', 'is_active']);

            expect(result.isEnabled).toBe(false);
            expect(result.isActive).toBe(false);
        });
    });

    describe('createSerializer', () => {
        test('should create a reusable serializer function', () => {
            interface Theme {
                id: number;
                display_name: string;
                is_enabled: number;
                is_default: number;
            }

            const serializeTheme = createSerializer<Theme>(['is_enabled', 'is_default']);

            const theme: Theme = {
                id: 1,
                display_name: 'Neo Theme',
                is_enabled: 1,
                is_default: 0,
            };

            const result = serializeTheme(theme);

            expect(result).toEqual({
                id: 1,
                displayName: 'Neo Theme',
                isEnabled: true,
                isDefault: false,
            });
        });

        test('should create serializer with no boolean fields', () => {
            const serialize = createSerializer([]);

            const record = {
                id: 1,
                is_enabled: 1,
            };

            const result = serialize(record);

            expect(result).toEqual({
                id: 1,
                isEnabled: 1, // Not converted to boolean
            });
        });

        test('should handle complex objects', () => {
            interface Template {
                id: number;
                filename: string;
                display_name: string;
                description: string | null;
                locale: string;
                is_enabled: number;
                sort_order: number;
                storage_path: string;
                file_size: number | null;
                created_at: string;
                updated_at: string;
            }

            const serializeTemplate = createSerializer<Template>(['is_enabled']);

            const template: Template = {
                id: 42,
                filename: 'my-template',
                display_name: 'My Template',
                description: 'A test template',
                locale: 'es',
                is_enabled: 1,
                sort_order: 5,
                storage_path: 'templates/es/my-template.elpx',
                file_size: 54321,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
            };

            const result = serializeTemplate(template);

            expect(result.id).toBe(42);
            expect(result.filename).toBe('my-template');
            expect(result.displayName).toBe('My Template');
            expect(result.description).toBe('A test template');
            expect(result.locale).toBe('es');
            expect(result.isEnabled).toBe(true);
            expect(result.sortOrder).toBe(5);
            expect(result.storagePath).toBe('templates/es/my-template.elpx');
            expect(result.fileSize).toBe(54321);
            expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
            expect(result.updatedAt).toBe('2024-01-02T00:00:00Z');
        });
    });
});
