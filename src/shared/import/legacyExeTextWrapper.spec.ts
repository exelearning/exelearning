import { describe, expect, it } from 'bun:test';

import { stripLegacyExeTextWrapper } from './legacyExeTextWrapper';

describe('stripLegacyExeTextWrapper', () => {
    it('returns empty html unchanged', () => {
        expect(stripLegacyExeTextWrapper('')).toBe('');
    });

    it('returns non-wrapper html unchanged', () => {
        const input = '<p>No wrapper</p>';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });

    it('unwraps legacy exe-text wrapper', () => {
        const input = '<div class="exe-text"><p>Hello</p></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe('<p>Hello</p>');
    });

    it('unwraps wrapper with leading whitespace and BOM', () => {
        const input = '\n\uFEFF  <div class="exe-text"><p>Hello</p></div>  \n';
        expect(stripLegacyExeTextWrapper(input)).toBe('<p>Hello</p>');
    });

    it('does not unwrap exe-text-activity class', () => {
        const input = '<div class="exe-text-activity"><p>Keep me</p></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });

    it('keeps html unchanged when opening tag is truncated', () => {
        const input = '<div class="exe-text"';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });

    it('skips comments while matching the closing div', () => {
        const input = '<div class="exe-text"><!-- note --><p>Hello</p></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe('<!-- note --><p>Hello</p>');
    });

    it('returns original html when a comment is unterminated', () => {
        const input = '<div class="exe-text"><!-- note<p>Hello</p></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });

    it('handles > inside quoted attributes', () => {
        const input = '<div class="exe-text" data-title="a > b"><div data-info=">"><p>Safe</p></div></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe('<div data-info=">"><p>Safe</p></div>');
    });

    it('keeps html unchanged when a tag name is invalid', () => {
        const input = '<div class="exe-text"><$bad></div>';
        expect(stripLegacyExeTextWrapper(input)).toBe('<$bad>');
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

    it('keeps single-quoted feedback siblings after unwrap', () => {
        const input = "<div class='exe-text'><p>Main</p></div><div class='feedback js-feedback js-hidden'>Info</div>";
        expect(stripLegacyExeTextWrapper(input)).toBe(
            "<p>Main</p><div class='feedback js-feedback js-hidden'>Info</div>",
        );
    });

    it('keeps html unchanged when trailing content is not legacy feedback', () => {
        const input = '<div class="exe-text"><p>Main</p></div><div class="other">Other</div>';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });

    it('returns original html when wrapper is malformed', () => {
        const input = '<div class="exe-text"><p>Broken';
        expect(stripLegacyExeTextWrapper(input)).toBe(input);
    });
});
