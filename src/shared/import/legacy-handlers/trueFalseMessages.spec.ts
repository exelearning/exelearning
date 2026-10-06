/**
 * Tests for the localized True/False message catalogue used by legacy imports.
 *
 * See issue #2252: a legacy .elp authored in Spanish must keep its interface
 * texts in Spanish once imported, instead of falling back to English.
 */

import { describe, it, expect } from 'bun:test';
import {
    getTrueFalseMessages,
    TRUE_FALSE_DEFAULT_MESSAGES,
    TRUE_FALSE_MESSAGE_TRANSLATIONS,
} from './trueFalseMessages';

describe('getTrueFalseMessages', () => {
    it('should return Spanish labels for a Spanish project', () => {
        const msgs = getTrueFalseMessages('es');

        expect(msgs.msgTrue).toBe('Verdadero');
        expect(msgs.msgFalse).toBe('Falso');
        expect(msgs.msgSuggestion).toBe('Sugerencia');
        expect(msgs.msgFeedback).toBe('Retroalimentación');
    });

    it('should return Galician labels for a Galician project', () => {
        const msgs = getTrueFalseMessages('gl');

        expect(msgs.msgTrue).toBe('Verdadeiro');
        expect(msgs.msgFalse).toBe('Falso');
        expect(msgs.msgSuggestion).toBe('Suxestión');
    });

    it('should normalize regional language codes to their base language', () => {
        expect(getTrueFalseMessages('es-ES').msgTrue).toBe('Verdadero');
        expect(getTrueFalseMessages('CA').msgTrue).toBe('Veritat');
    });

    it('should fall back to English when the language has no catalogue', () => {
        expect(getTrueFalseMessages('xx')).toEqual(TRUE_FALSE_DEFAULT_MESSAGES);
        expect(getTrueFalseMessages('')).toEqual(TRUE_FALSE_DEFAULT_MESSAGES);
        expect(getTrueFalseMessages(undefined)).toEqual(TRUE_FALSE_DEFAULT_MESSAGES);
        expect(getTrueFalseMessages('en')).toEqual(TRUE_FALSE_DEFAULT_MESSAGES);
    });

    it('should return a fresh object so callers cannot mutate the catalogue', () => {
        const first = getTrueFalseMessages('es');
        first.msgTrue = 'mutated';

        expect(getTrueFalseMessages('es').msgTrue).toBe('Verdadero');
    });

    it('should translate every message key in every supported language', () => {
        const keys = Object.keys(TRUE_FALSE_DEFAULT_MESSAGES);

        for (const lang of Object.keys(TRUE_FALSE_MESSAGE_TRANSLATIONS)) {
            const msgs = getTrueFalseMessages(lang);
            for (const key of keys) {
                expect(typeof msgs[key as keyof typeof msgs]).toBe('string');
                expect(msgs[key as keyof typeof msgs].length).toBeGreaterThan(0);
            }
        }
    });
});
