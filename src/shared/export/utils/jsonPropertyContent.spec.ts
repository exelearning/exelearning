import { describe, expect, it } from 'bun:test';
import { JSON_PROPERTY_LIBRARY_EXCLUSIONS, iterateJsonPropertyStrings } from './jsonPropertyContent';

describe('iterateJsonPropertyStrings', () => {
    it('yields a plain string', () => {
        expect([...iterateJsonPropertyStrings('<p>Text</p>')]).toEqual(['<p>Text</p>']);
    });

    it('yields strings nested in arrays and objects', () => {
        const properties = {
            questionsData: [
                { baseText: '<div class="exe-fx exe-tabs">One</div>', options: ['a', 'b'] },
                { baseText: 'Second question' },
            ],
            instructions: 'Read carefully',
        };

        expect([...iterateJsonPropertyStrings(properties)]).toEqual([
            '<div class="exe-fx exe-tabs">One</div>',
            'a',
            'b',
            'Second question',
            'Read carefully',
        ]);
    });

    it('skips values that cannot hold rich text', () => {
        const properties = { width: 600, enabled: true, missing: null, absent: undefined };

        expect([...iterateJsonPropertyStrings(properties)]).toEqual([]);
    });

    it('yields nothing for empty input', () => {
        expect([...iterateJsonPropertyStrings(undefined)]).toEqual([]);
        expect([...iterateJsonPropertyStrings(null)]).toEqual([]);
        expect([...iterateJsonPropertyStrings({})]).toEqual([]);
    });
});

describe('JSON_PROPERTY_LIBRARY_EXCLUSIONS', () => {
    it('excludes the math libraries handled by the pre-rendering pipeline', () => {
        expect([...JSON_PROPERTY_LIBRARY_EXCLUSIONS].sort()).toEqual([
            'exe_math',
            'exe_math_datagame',
            'exe_math_mathml',
        ]);
    });

    it('does not exclude the effects library', () => {
        expect(JSON_PROPERTY_LIBRARY_EXCLUSIONS.has('exe_effects')).toBe(false);
    });
});
