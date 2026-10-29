/**
 * Carrying a stored SVG drawing onto the worksheet
 *
 * The Electrical circuits iDevice keeps each circuit twice: as the TikZ source the author wrote,
 * and as the SVG that source was rendered into. The SVG is what a printed sheet wants — a vector
 * drawing prints sharp at any size, where a screenshot would not.
 *
 * It is also author-influenced content, so it does not go into the document as markup. It goes in
 * as the `src` of an `<img>`, which is what makes it safe, and the reasoning is worth writing down
 * because it is the whole of the argument:
 *
 * - **A browser never runs script in an SVG loaded through `<img>`.** Scripts, event handlers and
 *   external references are all inert in that context. This is the boundary, not a filter we
 *   maintain — an allow-list of SVG elements would be one more thing to keep current, and would be
 *   wrong the first time a TikZ release emits an element nobody listed.
 * - **The text is percent-encoded**, so nothing in it can close the attribute it sits in. That
 *   holds whatever the string turns out to contain.
 * - **The media type is ours**, written here rather than taken from the payload.
 *
 * What is left is a cosmetic question — whether the thing really is a drawing — and a drawing that
 * is not one simply fails to load. So the check below is light on purpose: it is not standing
 * between an author and the document, because the two rules above already are.
 */

/**
 * Largest drawing to carry, in characters of SVG source.
 *
 * A circuit diagram runs to a few kilobytes. Something far larger is a pasted photograph traced
 * into paths, and inlining it would bloat every copy of the sheet; the activity is reported as
 * having lost it rather than the document being made unusable.
 */
const MAX_SVG_LENGTH = 512 * 1024;

/**
 * Turn a stored SVG into something an `<img>` can load.
 *
 * @param svg - The drawing as the activity stored it
 * @returns A data URI, or null when there is no usable drawing
 */
export function circuitImageSource(svg: unknown): string | null {
    if (typeof svg !== 'string') return null;

    const source = svg.trim();
    if (!source.includes('<svg') || source.length > MAX_SVG_LENGTH) return null;

    return `data:image/svg+xml,${encodeURIComponent(source)}`;
}
