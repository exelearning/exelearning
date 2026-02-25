/**
 * Shared UI visibility mapping and utility for embedding mode.
 *
 * Maps hideUI flag keys to body data attributes that CSS uses to hide elements.
 * Used by both app.js (_applyEmbeddedUIVisibility) and EmbeddingBridge (CONFIGURE).
 */

export const HIDE_UI_ATTR_MAP = {
    fileMenu: 'data-exe-hide-file-menu',
    saveButton: 'data-exe-hide-save',
    shareButton: 'data-exe-hide-share',
    userMenu: 'data-exe-hide-user-menu',
    downloadButton: 'data-exe-hide-download',
    helpMenu: 'data-exe-hide-help',
};

/**
 * Apply hide UI flags to document.body data attributes.
 * Sets attribute to "true" when the flag is truthy, removes it when falsy.
 * Only touches keys present in hideFlags — other attributes are left untouched.
 *
 * @param {Object} hideFlags - e.g. { fileMenu: true, saveButton: false }
 */
export function applyHideUI(hideFlags) {
    const body = document.body;
    for (const [key, attr] of Object.entries(HIDE_UI_ATTR_MAP)) {
        if (key in hideFlags) {
            if (hideFlags[key]) {
                body.setAttribute(attr, 'true');
            } else {
                body.removeAttribute(attr);
            }
        }
    }
}
