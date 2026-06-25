/**
 * Tests for the translation function _ in EdiCuaTeX.
 * The _ function resolves translated strings based on the document language,
 * falling back to eXe translations or the original string if not found.
 */

describe('EdiCuaTeX Translation Function', () => {

    beforeEach(() => {
        global.$i18n = {
            'eXe': {
                'Hello': 'Hello (eXe)',
                'Cancel': 'Cancel (eXe)'
            },
            'es': {
                'Hello': 'Hola',
                'Cancel': 'Cancelar'
            },
            'gl': {
                'Hello': 'Ola'
                // 'Cancel' not translated in gl
            }
        };

        global.isInExe = false;
    });

    /**
     * Helper function that replicates the _ function logic from the script.
     * appLang is read once outside the function, as in the real implementation.
     */
    function buildTranslationFn(lang) {
        const appLang = lang;
        return function _(str) {
            if (isInExe) return parent._(str);
            let translations = $i18n['eXe'];
            if (typeof $i18n[appLang] == 'object') translations = $i18n[appLang];
            if (typeof translations[str] == 'string') return translations[str];
            return str;
        };
    }

    describe('Local language translations', () => {
        it('should return translation in local language when available', () => {
            const _ = buildTranslationFn('es');
            expect(_('Hello')).toBe('Hola');
        });

        it('should return original string when not available in local language', () => {
            const _ = buildTranslationFn('gl');
            expect(_('Cancel')).toBe('Cancel');
        });

        it('should return original string when not found in any translation', () => {
            const _ = buildTranslationFn('es');
            expect(_('Unknown string')).toBe('Unknown string');
        });

        it('should fall back to eXe translations for unknown language', () => {
            const _ = buildTranslationFn('fr');
            expect(_('Hello')).toBe('Hello (eXe)');
        });

        it('should return original string when not found in eXe either', () => {
            const _ = buildTranslationFn('fr');
            expect(_('Completely unknown')).toBe('Completely unknown');
        });
    });

    describe('isInExe mode', () => {
        it('should call parent._() when isInExe is true', () => {
            global.isInExe = true;
            global.parent = { _: (str) => 'translated by parent' };

            const _ = buildTranslationFn('es');
            expect(_('Hello')).toBe('translated by parent');
        });

        it('should not use $i18n when isInExe is true', () => {
            global.isInExe = true;
            let callCount = 0;
            global.parent = { _: (str) => { callCount++; return 'parent translation'; } };

            const _ = buildTranslationFn('es');
            _('Hello');
            expect(callCount).toBe(1);
        });

        it('should pass the original string to parent._()', () => {
            global.isInExe = true;
            let received = null;
            global.parent = { _: (str) => { received = str; return 'anything'; } };

            const _ = buildTranslationFn('es');
            _('Cancel');
            expect(received).toBe('Cancel');
        });
    });

    describe('Real-world language scenarios', () => {
        it('should handle Spanish translations', () => {
            const _ = buildTranslationFn('es');
            expect(_('Cancel')).toBe('Cancelar');
        });

        it('should handle Galician returning original string when not translated', () => {
            const _ = buildTranslationFn('gl');
            expect(_('Hello')).toBe('Ola');
            expect(_('Cancel')).toBe('Cancel');
        });

        it('should handle missing language gracefully', () => {
            const _ = buildTranslationFn('zh');
            expect(_('Hello')).toBe('Hello (eXe)');
        });

        it('should handle empty string', () => {
            const _ = buildTranslationFn('es');
            expect(_('')).toBe('');
        });
    });
});
