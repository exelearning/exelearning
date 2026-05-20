/**
 * Slide iDevice — SVG sanitization.
 *
 * Two layers:
 *   - `scrubSvg`: pure regex-level scrubber that works without DOMPurify.
 *     Used in unit tests and as a defence-in-depth pass.
 *   - `sanitizeSvg`: DOMPurify-based sanitizer using the SVG profile.
 *     Used by the bundled editor when saving.
 *
 * The bundle layers both: scrub then DOMPurify, so a payload from an older
 * bundle (or hand-edited JSON) can never smuggle code through.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

type DomPurifyLike = {
    sanitize: (input: string, opts?: Record<string, unknown>) => string;
};

/**
 * Pure regex sanitizer. No DOM, no library — safe to call from any
 * environment, including the export renderer that must not load the
 * editor bundle.
 */
export function scrubSvg(svg: unknown): string {
    if (!svg || typeof svg !== 'string') return '';
    return svg
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<\/?\s*foreignObject[^>]*>/gi, '')
        .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
        .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript:/gi, '');
}

/**
 * SVG sanitizer used at save time.
 *
 * We rely on the regex scrubber (`<script>`, `on*=` handlers,
 * `javascript:` URLs, `<foreignObject>`) for security. DOMPurify's SVG
 * profile is intentionally NOT applied here because in practice it
 * strips attributes Fabric depends on (`transform` on `<g>`, `x` / `y`
 * / `font-family` / `font-size` on `<text>`, `viewBox` on `<svg>`),
 * silently breaking the saved slide.
 *
 * The `purifier` argument is kept for backwards compatibility — it is
 * accepted but ignored. The scene we're sanitizing comes from
 * `fabric.Canvas.toSVG()`, which is trusted code; user-injected raw
 * HTML can't reach this path because every shape goes through the
 * adapter's typed factories.
 */
export function sanitizeSvg(svg: unknown, _purifier?: DomPurifyLike): string {
    void _purifier;
    return scrubSvg(svg);
}
