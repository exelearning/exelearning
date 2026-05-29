/**
 * Unit tests for the resolveDefaultThemeForNewProject helper.
 *
 * The helper encapsulates the precedence rules that decide which theme is
 * baked into the Yjs document when a user creates a new project. Keeping it
 * pure makes the rules trivially testable without bringing the database, the
 * Elysia router, or any session machinery into the test.
 */
import { describe, it, expect } from 'bun:test';
import { resolveDefaultThemeForNewProject } from './project';
import type { Theme } from '../db/types';

const FAKE_DB = {} as never;
const USER_ID = 42;

function makeTheme(overrides: Partial<Theme> = {}): Theme {
    return {
        id: 1,
        dir_name: 'spectrum128k',
        display_name: 'Spectrum 128k',
        description: null,
        version: null,
        author: null,
        license: null,
        storage_path: null,
        is_builtin: 0,
        is_enabled: 1,
        is_default: 0,
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    } as Theme;
}

describe('resolveDefaultThemeForNewProject', () => {
    it('returns "base" when nothing is configured', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => {
                throw new Error('table missing');
            },
            findThemeByDirName: async () => undefined,
            getPreferenceValue: async () => undefined,
        });
        expect(result).toBe('base');
    });

    it('falls back to the admin-wide default when the user has no preference', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'base', dirName: 'base' }),
            findThemeByDirName: async () => undefined,
            getPreferenceValue: async () => undefined,
        });
        expect(result).toBe('base');
    });

    it('honors the user defaultTheme preference when the theme exists and is enabled', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'base', dirName: 'base' }),
            getPreferenceValue: async () => 'spectrum128k',
            findThemeByDirName: async () => makeTheme({ dir_name: 'spectrum128k', is_enabled: 1 }),
        });
        expect(result).toBe('spectrum128k');
    });

    it('takes precedence over the admin default when the user preference is set', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'site', dirName: 'corporate' }),
            getPreferenceValue: async () => 'spectrum128k',
            findThemeByDirName: async () => makeTheme({ dir_name: 'spectrum128k' }),
        });
        expect(result).toBe('spectrum128k');
    });

    it('ignores the user preference when the referenced theme is disabled', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'base', dirName: 'base' }),
            getPreferenceValue: async () => 'spectrum128k',
            findThemeByDirName: async () => makeTheme({ dir_name: 'spectrum128k', is_enabled: 0 }),
        });
        expect(result).toBe('base');
    });

    it('ignores the user preference when the theme has been deleted', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'base', dirName: 'base' }),
            getPreferenceValue: async () => 'gone',
            findThemeByDirName: async () => undefined,
        });
        expect(result).toBe('base');
    });

    it('treats an empty preference value as "use the site default"', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'site', dirName: 'corporate' }),
            getPreferenceValue: async () => '',
            // findThemeByDirName must NOT be hit when the preference is empty.
            findThemeByDirName: async () => {
                throw new Error('should not be called when preference is empty');
            },
        });
        expect(result).toBe('corporate');
    });

    it('swallows errors thrown by the preference query and keeps the admin default', async () => {
        const result = await resolveDefaultThemeForNewProject(FAKE_DB, USER_ID, {
            getDefaultTheme: async () => ({ type: 'base', dirName: 'base' }),
            getPreferenceValue: async () => {
                throw new Error('users_preferences missing');
            },
            findThemeByDirName: async () => undefined,
        });
        expect(result).toBe('base');
    });
});
