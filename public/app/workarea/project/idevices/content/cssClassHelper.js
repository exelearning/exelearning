/**
 * eXeLearning
 *
 * Helpers for handling the user-supplied CSS class property of blocks and
 * idevices. The "CSS class" field is free text, so it can contain leading,
 * trailing or repeated whitespace (or even a whole pasted CSS rule). Passing
 * the resulting empty tokens to DOMTokenList.add() throws a SyntaxError in the
 * browser ("The token provided must not be empty"), which aborts page render.
 */

/**
 * Parse a user CSS-class string into a clean list of non-empty class tokens
 * that are safe to pass to element.classList.add().
 *
 * Splits on any run of whitespace (spaces, tabs, newlines) and drops empty
 * tokens, so values like "  a  b  " or a pasted CSS rule never produce an
 * empty token.
 *
 * @param {*} value - The raw cssClass property value.
 * @returns {string[]} List of non-empty class tokens (empty array for
 *   non-string or whitespace-only input).
 */
export function parseCssClassList(value) {
    if (typeof value !== 'string') return [];
    return value.split(/\s+/).filter(Boolean);
}
