/**
 * The colours an author gave a card, read for paper
 *
 * Some activities let the teacher colour each card: a font colour and a background colour, stored
 * as hex. On screen both are applied literally. On paper neither can be, for two reasons.
 *
 * The first is ink. A filled card is a block of toner on every copy, and a class set is thirty
 * copies; the colour is drawn as an outline and a band instead, which says the same thing for a
 * fraction of the cost. The second is that a colour chosen against a screen's backlight does not
 * survive the trip: white text was legible on the author's coloured card and is invisible on
 * white paper, and a pastel outline is not an outline at all.
 *
 * So a stored colour is not used as given — it is read, and what it is usable *for* is decided
 * here. Everything in this module is a pure function over a string, which is also what makes the
 * rules checkable rather than a matter of opinion.
 */

/** Hex colours the iDevices store: `#rgb` or `#rrggbb`. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Contrast a colour needs against the paper to count as visible.
 *
 * 3:1 is the WCAG 2.2 bar for a graphical object (level AA, 1.4.11) and for large text (1.4.3),
 * which is what a card's outline and its centred label are. Picking the published bar rather than
 * a number of our own means the rule can be checked against the standard instead of argued about.
 */
const MIN_CONTRAST = 3;

/** Expand `#abc` to `#aabbcc` so one parser handles both stored forms. */
function expand(hex: string): string {
    if (hex.length !== 4) return hex.toLowerCase();
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
}

/**
 * Read a stored colour, or nothing.
 *
 * Returns null for anything that is not a hex colour, which covers the empty string, the runtime's
 * own 'inherit' and 'trasparent' fallbacks, and any attempt to smuggle something else into a style
 * attribute — the caller can interpolate what comes back without escaping it.
 *
 * @param value - Whatever the activity stored
 * @returns The colour as `#rrggbb`, or null when there is none
 */
export function readColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const hex = value.trim();
    return HEX.test(hex) ? expand(hex) : null;
}

/**
 * Relative luminance, as WCAG defines it: 0 is black, 1 is white.
 *
 * @param color - A colour already read by `readColor`
 * @returns Luminance between 0 and 1
 */
export function luminance(color: string): number {
    const channel = (offset: number): number => {
        const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * How far a colour stands out from white paper, as a WCAG contrast ratio.
 *
 * @param color - A colour already read by `readColor`
 * @returns The ratio, from 1 (white) to 21 (black)
 */
export function contrastWithPaper(color: string): number {
    return 1.05 / (luminance(color) + 0.05);
}

/**
 * Whether a colour is dark enough to be seen on white paper.
 *
 * @param color - A colour already read by `readColor`
 * @returns true when it can carry a line or a word
 */
export function readsOnWhite(color: string): boolean {
    return contrastWithPaper(color) >= MIN_CONTRAST;
}

/**
 * The colour to write a card's text in.
 *
 * Nothing comes back for either of the two cases where saying something would be pointless or
 * wrong. Black is where the editors start every card, and is already the colour of the printed
 * word, so repeating it would put a style attribute on nearly every card to no effect. A colour
 * too pale to read is dropped rather than printed: the author chose it against their own coloured
 * background, and on white paper the words simply would not be there.
 *
 * @param value - The font colour the activity stored
 * @returns The colour, or null to leave the text as it is
 */
export function textInk(value: unknown): string | null {
    const color = readColor(value);
    if (!color || color === '#000000') return null;

    return readsOnWhite(color) ? color : null;
}

/**
 * The colour to mark a card with, from the background the author gave it.
 *
 * White is the editor's own default and means the author chose nothing, so it marks nothing. Any
 * other colour is kept whatever its lightness — a pale band still reads as a tint even where a
 * pale outline would not, and `accentOutline` decides that half separately.
 *
 * @param value - The background colour the activity stored
 * @returns The colour, or null when the card is unmarked
 */
export function cardAccent(value: unknown): string | null {
    const color = readColor(value);
    return color && color !== '#ffffff' ? color : null;
}

/**
 * The colour to outline a card in.
 *
 * The accent when it is dark enough to be seen, and black when it is not. A card always has a
 * visible edge: it is what separates one answer from the next.
 *
 * @param accent - The card's accent, as returned by `cardAccent`
 * @returns The outline colour
 */
export function accentOutline(accent: string | null): string {
    return accent && readsOnWhite(accent) ? accent : '#1a1a1a';
}
