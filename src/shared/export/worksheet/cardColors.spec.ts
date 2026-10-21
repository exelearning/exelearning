import { describe, expect, it } from 'bun:test';
import {
    accentOutline,
    cardAccent,
    contrastWithPaper,
    luminance,
    readColor,
    readsOnWhite,
    textInk,
} from './cardColors';

describe('readColor', () => {
    it('reads the two forms an iDevice stores', () => {
        expect(readColor('#0d5aa7')).toBe('#0d5aa7');
        expect(readColor('#abc')).toBe('#aabbcc');
    });

    it('reads a colour whatever case it was written in', () => {
        expect(readColor('#0D5AA7')).toBe('#0d5aa7');
        expect(readColor('  #ABC  ')).toBe('#aabbcc');
    });

    it('reads nothing out of an unset colour', () => {
        expect(readColor('')).toBeNull();
        expect(readColor(undefined)).toBeNull();
        expect(readColor(null)).toBeNull();
        expect(readColor(42)).toBeNull();
    });

    it("reads nothing out of the runtime's own fallbacks", () => {
        // The activity writes these into the style attribute when the author set no colour.
        expect(readColor('inherit')).toBeNull();
        expect(readColor('trasparent')).toBeNull();
    });

    it('refuses anything that is not a hex colour, so it can be written into a style attribute', () => {
        // What comes back is interpolated unescaped, so this is the only thing standing between
        // an author's string and the document.
        expect(readColor('red; background: url(javascript:alert(1))')).toBeNull();
        expect(readColor('rgb(0,0,0)')).toBeNull();
        expect(readColor('#12345')).toBeNull();
        expect(readColor('#ggg')).toBeNull();
        expect(readColor('</style>')).toBeNull();
    });
});

describe('luminance', () => {
    it('puts black at nothing and white at one', () => {
        expect(luminance('#000000')).toBe(0);
        expect(luminance('#ffffff')).toBe(1);
    });

    it('weighs green above red above blue, as the eye does', () => {
        expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
        expect(luminance('#ff0000')).toBeGreaterThan(luminance('#0000ff'));
    });
});

describe('contrastWithPaper', () => {
    it('runs from 1 for white to 21 for black', () => {
        expect(contrastWithPaper('#ffffff')).toBeCloseTo(1, 2);
        expect(contrastWithPaper('#000000')).toBeCloseTo(21, 1);
    });
});

describe('readsOnWhite', () => {
    it('accepts a colour that meets the 3:1 bar', () => {
        expect(readsOnWhite('#0d5aa7')).toBe(true); // deep blue
        expect(readsOnWhite('#ff0000')).toBe(true); // red
        expect(readsOnWhite('#1a1a1a')).toBe(true);
    });

    it('rejects a colour a reader would lose against the paper', () => {
        expect(readsOnWhite('#ffffff')).toBe(false);
        expect(readsOnWhite('#fff9c4')).toBe(false); // pastel yellow
        expect(readsOnWhite('#cccccc')).toBe(false);
        // Pure green measures far lighter than it looks: 1.37:1 against white.
        expect(readsOnWhite('#00ff00')).toBe(false);
    });
});

describe('textInk', () => {
    it('keeps a font colour the reader can see', () => {
        expect(textInk('#0d5aa7')).toBe('#0d5aa7');
    });

    it('drops a font colour that would leave the words invisible', () => {
        // The author picked it against their own coloured card; on white paper it is not there.
        expect(textInk('#ffffff')).toBeNull();
        expect(textInk('#fff9c4')).toBeNull();
    });

    it('drops an unset colour', () => {
        expect(textInk('')).toBeNull();
        expect(textInk(undefined)).toBeNull();
    });

    it('drops the editor default, which is what the text would print as anyway', () => {
        // Every card starts at #000000, so keeping it would put a style attribute on all of them.
        expect(textInk('#000000')).toBeNull();
        expect(textInk('#000')).toBeNull();
    });

    it('keeps a dark colour that is not the default', () => {
        expect(textInk('#1a1a1a')).toBe('#1a1a1a');
    });
});

describe('cardAccent', () => {
    it('marks the card with the colour the author gave it', () => {
        expect(cardAccent('#0d5aa7')).toBe('#0d5aa7');
    });

    it('keeps a pale colour, which still reads as a tint in a band', () => {
        // Unlike text, a band does not have to be read through — only noticed.
        expect(cardAccent('#fff9c4')).toBe('#fff9c4');
    });

    it('marks nothing when the author left the editor default', () => {
        // #ffffff is what the Relate editor starts every card at.
        expect(cardAccent('#ffffff')).toBeNull();
        expect(cardAccent('#FFF')).toBeNull();
    });

    it('marks nothing when there is no colour at all', () => {
        expect(cardAccent('')).toBeNull();
        expect(cardAccent('trasparent')).toBeNull();
    });
});

describe('accentOutline', () => {
    it('outlines the card in its own colour when that can be seen', () => {
        expect(accentOutline('#0d5aa7')).toBe('#0d5aa7');
    });

    it('falls back to black rather than leaving the card with no edge', () => {
        // A pastel outline is not an outline, and a card without one runs into its neighbour.
        expect(accentOutline('#fff9c4')).toBe('#1a1a1a');
        expect(accentOutline(null)).toBe('#1a1a1a');
    });
});
