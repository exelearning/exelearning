/**
 * I18nGenerator tests
 */

import { describe, it, expect } from 'bun:test';
import { generateI18nScript, getI18nTranslation } from './I18nGenerator';

describe('I18nGenerator', () => {
    describe('generateI18nScript', () => {
        it('should generate valid JavaScript with $exe_i18n object', () => {
            const script = generateI18nScript('en');

            expect(script).toContain('$exe_i18n=');
            expect(script).toContain('$exe_i18n.exeGames=');
        });

        it('should include all required main translation keys', () => {
            const script = generateI18nScript('en');

            // Navigation keys
            expect(script).toContain('"previous"');
            expect(script).toContain('"next"');
            expect(script).toContain('"menu"');

            // Toggle/visibility keys
            expect(script).toContain('"show"');
            expect(script).toContain('"hide"');
            expect(script).toContain('"toggleContent"');

            // Feedback keys
            expect(script).toContain('"showFeedback"');
            expect(script).toContain('"hideFeedback"');
            expect(script).toContain('"correct"');
            expect(script).toContain('"incorrect"');

            // Action keys
            expect(script).toContain('"download"');
            expect(script).toContain('"print"');
            expect(script).toContain('"search"');

            // Accessibility keys
            expect(script).toContain('"accessibility_tools"');
            expect(script).toContain('"teacher_mode"');
        });

        it('should include game translation keys', () => {
            const script = generateI18nScript('en');

            expect(script).toContain('"hangManGame"');
            expect(script).toContain('"accept"');
            expect(script).toContain('"yes"');
            expect(script).toContain('"no"');
            expect(script).toContain('"play"');
            expect(script).toContain('"playAgain"');
            expect(script).toContain('"az"');
        });

        it('should include block translation for search results', () => {
            const script = generateI18nScript('en');
            expect(script).toContain('"block":"block"');

            const scriptEs = generateI18nScript('es');
            expect(scriptEs).toContain('"block":"bloque"');
        });

        it('should generate Spanish translations for es language', () => {
            const script = generateI18nScript('es');

            // Check for Spanish translations
            expect(script).toContain('"toggleContent":"Ocultar/Mostrar contenido"');
            expect(script).toContain('"previous":"Anterior"');
            expect(script).toContain('"next":"Siguiente"');
            expect(script).toContain('"show":"Mostrar"');
            expect(script).toContain('"hide":"Ocultar"');
        });

        it('should generate Catalan translations for ca language', () => {
            const script = generateI18nScript('ca');

            expect(script).toContain('"toggleContent":"Commuta el contingut"');
            expect(script).toContain('"previous":"Anterior"');
            expect(script).toContain('"next":"Següent"');
        });

        it('should include Spanish alphabet with ñ for es language', () => {
            const script = generateI18nScript('es');

            expect(script).toContain('"az":"abcdefghijklmnñopqrstuvwxyz"');
        });

        it('should include English alphabet without ñ for en language', () => {
            const script = generateI18nScript('en');

            expect(script).toContain('"az":"abcdefghijklmnopqrstuvwxyz"');
        });

        it('should include CommonJS export for tests', () => {
            const script = generateI18nScript('en');

            expect(script).toContain('module.exports');
            expect(script).toContain('$exe_i18n');
        });

        it('should produce parseable JavaScript', () => {
            const script = generateI18nScript('en');

            // Try to extract and parse the JSON part
            const mainMatch = script.match(/\$exe_i18n=(\{[^}]+\});/);
            expect(mainMatch).not.toBeNull();
            if (mainMatch) {
                const parsed = JSON.parse(mainMatch[1]);
                expect(parsed).toHaveProperty('toggleContent');
                expect(parsed).toHaveProperty('previous');
                expect(parsed).toHaveProperty('next');
            }
        });

        it('should include ELPX download translation keys', () => {
            const script = generateI18nScript('en');

            expect(script).toContain('"elpxGenerating":"Generating..."');
            expect(script).toContain('"elpxFolderPickerTimeout"');
            expect(script).toContain('"elpxFolderPickerEmpty"');
            expect(script).toContain('"elpxFileProtocolWarning"');
        });

        it('should generate Spanish ELPX download translations', () => {
            const script = generateI18nScript('es');

            expect(script).toContain('"elpxGenerating":"Generando..."');
            expect(script).toContain('"elpxFileProtocolWarning":"Modo local:');
        });

        it('should generate French ELPX download translations', () => {
            const script = generateI18nScript('fr');

            expect(script).toContain('"elpxGenerating":"Génération..."');
            expect(script).toContain('"elpxFileProtocolWarning":"Mode local :');
        });

        it('should handle unknown language by falling back to English', () => {
            const script = generateI18nScript('xx');

            // Should use English fallback
            expect(script).toContain('"toggleContent":"Toggle content"');
        });
    });

    describe('getI18nTranslation', () => {
        it('should return Spanish translation for toggleContent', () => {
            const translation = getI18nTranslation('toggleContent', 'es');
            expect(translation).toBe('Ocultar/Mostrar contenido');
        });

        it('should return English translation for toggleContent', () => {
            const translation = getI18nTranslation('toggleContent', 'en');
            expect(translation).toBe('Toggle content');
        });

        it('should return the key itself if not found', () => {
            const translation = getI18nTranslation('unknownKey', 'en');
            expect(translation).toBe('unknownKey');
        });

        it('should return translations for various keys', () => {
            expect(getI18nTranslation('previous', 'es')).toBe('Anterior');
            expect(getI18nTranslation('next', 'es')).toBe('Siguiente');
            expect(getI18nTranslation('show', 'es')).toBe('Mostrar');
            expect(getI18nTranslation('hide', 'es')).toBe('Ocultar');
        });
    });
});
