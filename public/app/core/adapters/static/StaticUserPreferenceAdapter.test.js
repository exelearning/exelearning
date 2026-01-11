import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StaticUserPreferenceAdapter } from './StaticUserPreferenceAdapter.js';

describe('StaticUserPreferenceAdapter', () => {
    let adapter;
    let localStorageData;

    beforeEach(() => {
        localStorageData = {};

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn((key) => localStorageData[key] || null),
                setItem: vi.fn((key, value) => { localStorageData[key] = value; }),
                removeItem: vi.fn((key) => { delete localStorageData[key]; }),
            },
            writable: true,
        });

        adapter = new StaticUserPreferenceAdapter();
    });

    afterEach(() => {
        delete window.eXeLearning;
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should set default storageKey', () => {
            expect(adapter.storageKey).toBe('exelearning_user_preferences');
        });

        it('should set default lopdKey', () => {
            expect(adapter.lopdKey).toBe('exelearning_lopd_accepted');
        });

        it('should allow custom options', () => {
            const customAdapter = new StaticUserPreferenceAdapter({
                defaultPreferences: { theme: { value: 'dark' } },
                storageKey: 'custom_prefs',
            });

            expect(customAdapter.storageKey).toBe('custom_prefs');
            expect(customAdapter.defaultPreferences.theme.value).toBe('dark');
        });
    });

    describe('_getDefaultPreferences', () => {
        it('should return fallback defaults if no bundled config', () => {
            const defaults = adapter._getDefaultPreferences();

            expect(defaults.locale).toBeDefined();
            expect(defaults.advancedMode).toBeDefined();
            expect(defaults.versionControl).toBeDefined();
        });

        it('should use bundled preferences if available', () => {
            window.eXeLearning = {
                app: {
                    apiCall: {
                        parameters: {
                            userPreferencesConfig: {
                                locale: { title: 'Language', value: 'es', type: 'select' },
                                customPref: { title: 'Custom', value: 'test', type: 'text' },
                            },
                        },
                    },
                },
            };

            const defaults = adapter._getDefaultPreferences();

            expect(defaults.locale.value).toBe('es');
            expect(defaults.customPref.value).toBe('test');
        });

        it('should use defaultPreferences from constructor', () => {
            const customAdapter = new StaticUserPreferenceAdapter({
                defaultPreferences: {
                    locale: { title: 'Language', value: 'fr', type: 'select' },
                    advancedMode: { title: 'Advanced', value: 'true', type: 'checkbox' },
                    versionControl: { title: 'Version', value: 'false', type: 'checkbox' },
                },
            });

            const defaults = customAdapter._getDefaultPreferences();

            expect(defaults.locale.value).toBe('fr');
        });

        it('should fill in missing required fields with fallbacks', () => {
            window.eXeLearning = {
                app: {
                    apiCall: {
                        parameters: {
                            userPreferencesConfig: {
                                locale: { title: 'Language', value: null, type: 'select' },
                            },
                        },
                    },
                },
            };

            const defaults = adapter._getDefaultPreferences();

            // Should use fallback for null value
            expect(defaults.locale.value).toBe('en');
        });
    });

    describe('_loadStoredPreferences', () => {
        it('should load preferences from localStorage', () => {
            localStorageData.exelearning_user_preferences = JSON.stringify({ locale: 'es' });

            const stored = adapter._loadStoredPreferences();

            expect(stored.locale).toBe('es');
        });

        it('should return empty object if nothing stored', () => {
            const stored = adapter._loadStoredPreferences();

            expect(stored).toEqual({});
        });

        it('should return empty object on parse error', () => {
            localStorageData.exelearning_user_preferences = 'invalid json';
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const stored = adapter._loadStoredPreferences();

            expect(stored).toEqual({});
            consoleSpy.mockRestore();
        });
    });

    describe('_saveStoredPreferences', () => {
        it('should save preferences to localStorage', () => {
            const result = adapter._saveStoredPreferences({ locale: 'es' });

            expect(result).toBe(true);
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                'exelearning_user_preferences',
                JSON.stringify({ locale: 'es' })
            );
        });

        it('should return false on error', () => {
            window.localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = adapter._saveStoredPreferences({ locale: 'es' });

            expect(result).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('getPreferences', () => {
        it('should merge stored values into defaults', async () => {
            localStorageData.exelearning_user_preferences = JSON.stringify({ locale: 'es' });

            const result = await adapter.getPreferences();

            expect(result.userPreferences.locale.value).toBe('es');
            expect(result.userPreferences.advancedMode).toBeDefined();
        });

        it('should return defaults if nothing stored', async () => {
            const result = await adapter.getPreferences();

            expect(result.userPreferences.locale).toBeDefined();
            expect(result.userPreferences.advancedMode).toBeDefined();
        });
    });

    describe('savePreferences', () => {
        it('should merge and save preferences', async () => {
            localStorageData.exelearning_user_preferences = JSON.stringify({ locale: 'en' });

            const result = await adapter.savePreferences({ theme: 'dark' });

            expect(result.success).toBe(true);
            const saved = JSON.parse(localStorageData.exelearning_user_preferences);
            expect(saved.locale).toBe('en');
            expect(saved.theme).toBe('dark');
        });
    });

    describe('acceptLopd', () => {
        it('should save LOPD acceptance to localStorage', async () => {
            const result = await adapter.acceptLopd();

            expect(result.success).toBe(true);
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                'exelearning_lopd_accepted',
                'true'
            );
        });

        it('should return success false on error', async () => {
            window.localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage full');
            });
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            const result = await adapter.acceptLopd();

            expect(result.success).toBe(false);
            consoleSpy.mockRestore();
        });
    });

    describe('isLopdAccepted', () => {
        it('should return true if LOPD is accepted', async () => {
            localStorageData.exelearning_lopd_accepted = 'true';

            const result = await adapter.isLopdAccepted();

            expect(result).toBe(true);
        });

        it('should return false if LOPD not accepted', async () => {
            const result = await adapter.isLopdAccepted();

            expect(result).toBe(false);
        });

        it('should return false on error', async () => {
            window.localStorage.getItem.mockImplementation(() => {
                throw new Error('Storage error');
            });

            const result = await adapter.isLopdAccepted();

            expect(result).toBe(false);
        });
    });

    describe('getPreference', () => {
        it('should return stored preference value', async () => {
            localStorageData.exelearning_user_preferences = JSON.stringify({ locale: 'es' });

            const result = await adapter.getPreference('locale');

            expect(result).toBe('es');
        });

        it('should return default value if not found', async () => {
            const result = await adapter.getPreference('nonexistent', 'default');

            expect(result).toBe('default');
        });
    });

    describe('setPreference', () => {
        it('should save single preference', async () => {
            const result = await adapter.setPreference('locale', 'es');

            expect(result.success).toBe(true);
            const saved = JSON.parse(localStorageData.exelearning_user_preferences);
            expect(saved.locale).toBe('es');
        });
    });
});
