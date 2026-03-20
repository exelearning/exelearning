import { describe, expect, it } from 'bun:test';

import { stripLegacyExeTextWrapper } from './legacyExeTextWrapper';

describe('stripLegacyExeTextWrapper', () => {
    it('unwraps legacy exe-text wrapper', () => {
        const input = '<div class="exe-text"><p>Hello</p></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe('<p>Hello</p>');
    });

    it('does not unwrap exe-text-activity class', () => {
        const input = '<div class="exe-text-activity"><p>Keep me</p></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });

    it('handles > inside quoted attributes', () => {
        const input = '<div class="exe-text" data-title="a > b"><div data-info=">"><p>Safe</p></div></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe('<div data-info=">"><p>Safe</p></div>');
    });

    it('keeps legacy feedback sibling blocks after unwrap', () => {
        const input =
            '<div class="exe-text"><p>Main</p></div>' +
            '<div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbackbutton" value="Info" /></div>' +
            '<div class="feedback js-feedback js-hidden">Info content</div>';

        const output = stripLegacyExeTextWrapper(input);
        expect(output).toContain('<p>Main</p>');
        expect(output).toContain('iDevice_buttons feedback-button');
        expect(output).toContain('Info content');
        expect(output).not.toContain('<div class="exe-text">');
    });

    it('returns original html when wrapper is malformed', () => {
        const input = '<div class="exe-text"><p>Broken';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });
});
