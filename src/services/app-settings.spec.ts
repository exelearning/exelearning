/**
 * Tests for App Settings Service
 */
import { describe, it, expect } from 'bun:test';
import {
    parseBoolean,
    parseNumber,
    getSettingValue,
    getSettingString,
    getSettingBoolean,
    getSettingNumber,
    parseAuthMethods,
    getAuthMethods,
} from './app-settings';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

describe('App Settings Service', () => {
    describe('parseBoolean', () => {
        it('should return fallback for undefined', () => {
            expect(parseBoolean(undefined, true)).toBe(true);
            expect(parseBoolean(undefined, false)).toBe(false);
        });

        it('should return fallback for null', () => {
            expect(parseBoolean(null, true)).toBe(true);
            expect(parseBoolean(null, false)).toBe(false);
        });

        it('should return boolean values as-is', () => {
            expect(parseBoolean(true, false)).toBe(true);
            expect(parseBoolean(false, true)).toBe(false);
        });

        it('should parse truthy string values', () => {
            expect(parseBoolean('1', false)).toBe(true);
            expect(parseBoolean('true', false)).toBe(true);
            expect(parseBoolean('TRUE', false)).toBe(true);
            expect(parseBoolean('yes', false)).toBe(true);
            expect(parseBoolean('YES', false)).toBe(true);
            expect(parseBoolean('on', false)).toBe(true);
            expect(parseBoolean('ON', false)).toBe(true);
        });

        it('should parse falsy string values', () => {
            expect(parseBoolean('0', true)).toBe(false);
            expect(parseBoolean('false', true)).toBe(false);
            expect(parseBoolean('FALSE', true)).toBe(false);
            expect(parseBoolean('no', true)).toBe(false);
            expect(parseBoolean('NO', true)).toBe(false);
            expect(parseBoolean('off', true)).toBe(false);
            expect(parseBoolean('OFF', true)).toBe(false);
        });

        it('should handle whitespace in values', () => {
            expect(parseBoolean('  true  ', false)).toBe(true);
            expect(parseBoolean('  false  ', true)).toBe(false);
        });

        it('should return fallback for unrecognized values', () => {
            expect(parseBoolean('maybe', true)).toBe(true);
            expect(parseBoolean('maybe', false)).toBe(false);
            expect(parseBoolean('2', true)).toBe(true);
            expect(parseBoolean('', false)).toBe(false);
        });
    });

    describe('parseNumber', () => {
        it('should return fallback for undefined', () => {
            expect(parseNumber(undefined, 42)).toBe(42);
        });

        it('should return fallback for null', () => {
            expect(parseNumber(null, 42)).toBe(42);
        });

        it('should return fallback for empty string', () => {
            expect(parseNumber('', 42)).toBe(42);
        });

        it('should parse valid integers', () => {
            expect(parseNumber('123', 0)).toBe(123);
            expect(parseNumber('0', 42)).toBe(0);
            expect(parseNumber('-5', 0)).toBe(-5);
        });

        it('should parse numeric values', () => {
            expect(parseNumber(100, 0)).toBe(100);
        });

        it('should return fallback for non-numeric strings', () => {
            expect(parseNumber('abc', 42)).toBe(42);
            expect(parseNumber('12abc', 42)).toBe(12); // parseInt behavior
        });

        it('should handle floating point by truncating', () => {
            expect(parseNumber('3.14', 0)).toBe(3);
            expect(parseNumber('99.9', 0)).toBe(99);
        });
    });

    describe('parseAuthMethods', () => {
        it('should parse comma-separated methods', () => {
            expect(parseAuthMethods('password,cas,openid')).toEqual(['password', 'cas', 'openid']);
        });

        it('should handle single method', () => {
            expect(parseAuthMethods('password')).toEqual(['password']);
        });

        it('should trim whitespace', () => {
            expect(parseAuthMethods('password , cas , openid')).toEqual(['password', 'cas', 'openid']);
        });

        it('should lowercase methods', () => {
            expect(parseAuthMethods('PASSWORD,CAS')).toEqual(['password', 'cas']);
        });

        it('should filter empty values', () => {
            expect(parseAuthMethods('password,,cas')).toEqual(['password', 'cas']);
            expect(parseAuthMethods('password,  ,cas')).toEqual(['password', 'cas']);
        });

        it('should return empty array for empty string', () => {
            expect(parseAuthMethods('')).toEqual([]);
        });
    });

    // Helper to create mock db for app_settings queries
    // The query pattern is: db.selectFrom('app_settings').selectAll().where('key', '=', key).executeTakeFirst()
    const createMockSettingsDb = (settings: Record<string, string | null> = {}) => {
        return {
            selectFrom: () => ({
                selectAll: () => ({
                    where: (_col: string, _op: string, key: string) => ({
                        executeTakeFirst: async () => {
                            if (key in settings) {
                                return { key, value: settings[key], type: 'string' };
                            }
                            return undefined;
                        },
                    }),
                }),
            }),
        } as unknown as Kysely<Database>;
    };

    describe('getSettingValue', () => {
        it('should return fallback when database query fails', async () => {
            const mockDb = {
                selectFrom: () => {
                    throw new Error('Table not found');
                },
            } as unknown as Kysely<Database>;

            const result = await getSettingValue(mockDb, 'TEST_KEY', 'fallback');
            expect(result).toBe('fallback');
        });

        it('should return fallback when setting not found', async () => {
            const mockDb = createMockSettingsDb({});

            const result = await getSettingValue(mockDb, 'MISSING_KEY', 'default');
            expect(result).toBe('default');
        });

        it('should return value when setting exists', async () => {
            const mockDb = createMockSettingsDb({ MY_KEY: 'stored_value' });

            const result = await getSettingValue(mockDb, 'MY_KEY', 'fallback');
            expect(result).toBe('stored_value');
        });

        it('should return fallback when value is null', async () => {
            const mockDb = createMockSettingsDb({ NULL_KEY: null });

            const result = await getSettingValue(mockDb, 'NULL_KEY', 'fallback');
            expect(result).toBe('fallback');
        });
    });

    describe('getSettingString', () => {
        it('should return string value from database', async () => {
            const mockDb = createMockSettingsDb({ GREETING: 'hello' });

            const result = await getSettingString(mockDb, 'GREETING', 'default');
            expect(result).toBe('hello');
        });

        it('should return fallback when not found', async () => {
            const mockDb = createMockSettingsDb({});

            const result = await getSettingString(mockDb, 'MISSING', 'fallback');
            expect(result).toBe('fallback');
        });
    });

    describe('getSettingBoolean', () => {
        it('should return true for truthy values', async () => {
            const mockDb = createMockSettingsDb({ ENABLED: 'true' });

            const result = await getSettingBoolean(mockDb, 'ENABLED', false);
            expect(result).toBe(true);
        });

        it('should return false for falsy values', async () => {
            const mockDb = createMockSettingsDb({ DISABLED: 'false' });

            const result = await getSettingBoolean(mockDb, 'DISABLED', true);
            expect(result).toBe(false);
        });

        it('should return fallback when not found', async () => {
            const mockDb = createMockSettingsDb({});

            const result = await getSettingBoolean(mockDb, 'MISSING', true);
            expect(result).toBe(true);
        });
    });

    describe('getSettingNumber', () => {
        it('should return numeric value from database', async () => {
            const mockDb = createMockSettingsDb({ MAX_SIZE: '100' });

            const result = await getSettingNumber(mockDb, 'MAX_SIZE', 0);
            expect(result).toBe(100);
        });

        it('should return fallback for non-numeric value', async () => {
            const mockDb = createMockSettingsDb({ BAD_NUMBER: 'invalid' });

            const result = await getSettingNumber(mockDb, 'BAD_NUMBER', 42);
            expect(result).toBe(42);
        });

        it('should return fallback when not found', async () => {
            const mockDb = createMockSettingsDb({});

            const result = await getSettingNumber(mockDb, 'MISSING', 50);
            expect(result).toBe(50);
        });
    });

    describe('getAuthMethods', () => {
        it('should return parsed auth methods from database', async () => {
            const mockDb = createMockSettingsDb({ APP_AUTH_METHODS: 'password,cas' });

            const result = await getAuthMethods(mockDb, 'password');
            expect(result).toEqual(['password', 'cas']);
        });

        it('should return fallback methods when not configured', async () => {
            const mockDb = createMockSettingsDb({});

            const result = await getAuthMethods(mockDb, 'password,guest');
            expect(result).toEqual(['password', 'guest']);
        });
    });
});
