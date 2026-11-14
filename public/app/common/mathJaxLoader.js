/**
 * Loads MathJax on demand in the workarea.
 *
 * tex-mml-svg.js is 1.85 MB and used to be a deferred script in the page head,
 * so the application could not start until it had been downloaded and run. It
 * is now injected once the workarea is on screen. window.MathJax (the
 * configuration object) is still defined by common.js before this runs, and
 * MathJax typesets the whole document as soon as it starts, so formulas that
 * were rendered in the meantime are picked up.
 */

const COMMON_SCRIPT = '/app/common/common.js';
const MATHJAX_SCRIPT = '/app/common/exe_math/tex-mml-svg.js';

let pending = null;

/**
 * Derive the MathJax URL from the common.js script tag, which carries the base
 * path and the version (path segment or ?v= query) in every deployment mode.
 * @param {Document} doc
 * @returns {string|null}
 */
export function getMathJaxUrl(doc = document) {
    const sibling = doc.querySelector(`script[src*="${COMMON_SCRIPT}"]`);
    const src = sibling?.getAttribute('src');
    return src ? src.replace(COMMON_SCRIPT, MATHJAX_SCRIPT) : null;
}

/**
 * Resolve once MathJax is usable. Injects the script on first call.
 * Never rejects: without MathJax, formulas simply stay as LaTeX source.
 * @param {Document} doc
 * @returns {Promise<void>}
 */
export function ensureMathJax(doc = document) {
    const win = doc.defaultView || window;
    if (typeof win.MathJax?.typesetPromise === 'function') {
        return Promise.resolve();
    }
    if (pending) return pending;

    pending = new Promise((resolve) => {
        const src = getMathJaxUrl(doc);
        if (!src) {
            pending = null;
            resolve();
            return;
        }
        const script = doc.createElement('script');
        script.className = 'exe';
        script.src = src;
        script.onload = () => {
            Promise.resolve(win.MathJax?.startup?.promise).then(
                () => resolve(),
                () => resolve()
            );
        };
        script.onerror = () => {
            // Allow a later call (an export, for instance) to try again.
            pending = null;
            script.remove();
            resolve();
        };
        doc.head.appendChild(script);
    });
    return pending;
}
