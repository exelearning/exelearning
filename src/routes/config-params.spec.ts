import { describe, it, expect } from 'bun:test';
import { buildConfigParams } from './config-params';

const LICENSES = { 'cc-by': 'Attribution' };
const PACKAGE_LOCALES = { en: 'English', es: 'Spanish' };
const LOCALES = { en: 'English', es: 'Spanish' };

describe('buildConfigParams', () => {
    describe('with TRANS_PREFIX', () => {
        const T = 'TRANSLATABLE_TEXT:';
        const result = buildConfigParams({ TRANS_PREFIX: T, LICENSES, PACKAGE_LOCALES, LOCALES });

        it('prefixes string values', () => {
            expect(result.USER_PREFERENCES_CONFIG.locale.title).toBe(`${T}Language`);
            expect(result.ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG.highlight.title).toBe(
                `${T}Highlight this page in the website navigation menu`,
            );
            expect(result.ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG.minimized.title).toBe(`${T}Minimized`);
        });

        it('passes LICENSES through', () => {
            expect(result.USER_PREFERENCES_CONFIG.defaultLicense.options).toBe(LICENSES);
            expect(result.ODE_PROJECT_SYNC_PROPERTIES_CONFIG.properties.pp_license.options).toBe(LICENSES);
        });

        it('passes PACKAGE_LOCALES through', () => {
            expect(result.ODE_PROJECT_SYNC_PROPERTIES_CONFIG.properties.pp_lang.options).toBe(PACKAGE_LOCALES);
        });

        it('passes LOCALES through', () => {
            expect(result.USER_PREFERENCES_CONFIG.locale.options).toBe(LOCALES);
        });
    });

    describe('with empty TRANS_PREFIX (static mode)', () => {
        const result = buildConfigParams({ TRANS_PREFIX: '', LICENSES, PACKAGE_LOCALES, LOCALES });

        it('produces plain English strings', () => {
            expect(result.USER_PREFERENCES_CONFIG.locale.title).toBe('Language');
            expect(result.ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG.highlight.title).toBe(
                'Highlight this page in the website navigation menu',
            );
            expect(result.ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG.minimized.title).toBe('Minimized');
            expect(result.ODE_PROJECT_SYNC_PROPERTIES_CONFIG.properties.pp_addMathJax.title).toBe(
                'Include MathJax (advanced features)',
            );
            expect(result.ODE_PROJECT_SYNC_PROPERTIES_CONFIG.properties.pp_globalFont.options.default).toBe(
                'Style default',
            );
        });

        it('includes all defaultAI options', () => {
            const options = result.USER_PREFERENCES_CONFIG.defaultAI.options;
            expect(Object.keys(options)).toContain('https://chatgpt.com/?q=');
            expect(Object.keys(options)).toContain('https://chat.qwen.ai/?text=');
        });

        it('returns empty cataloguing config', () => {
            expect(result.ODE_PROJECT_SYNC_CATALOGUING_CONFIG).toEqual({});
        });
    });
});
