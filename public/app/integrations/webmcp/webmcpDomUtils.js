/**
 * Shared DOM helpers for the WebMCP integration.
 */

/**
 * Escape an arbitrary string so it can be safely embedded as the body of a
 * double-quoted CSS attribute-selector value, e.g. `[nav-id="<value>"]`.
 *
 * The backslash MUST be escaped first; otherwise a value containing a single
 * backslash would corrupt the escaping of a following quote and allow a
 * selector-injection (CodeQL js/incomplete-sanitization).
 *
 * @param {*} value - The raw value (coerced to string).
 * @returns {string} The value escaped for use inside `[attr="..."]`.
 */
export function escapeCssAttributeValue(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
