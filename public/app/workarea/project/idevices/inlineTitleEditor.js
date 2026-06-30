/**
 * eXeLearning
 *
 * Shared inline title-editing helper.
 *
 * Encapsulates the contenteditable edit lifecycle that is common to the
 * structure-tree page rename and the workspace page title rename:
 * enter edit mode, place the caret, commit on Enter/blur, cancel on Escape,
 * trim whitespace and reject empty/unchanged values.
 *
 * Context-specific behaviour (how the new value is persisted, how the element
 * is restored, LaTeX typesetting, etc.) lives in the onCommit/onCancel
 * callbacks supplied by the caller, so this module stays focused and testable.
 */

/**
 * Normalize a raw title value: coerce to string and trim surrounding
 * whitespace. A whitespace-only or nullish value normalizes to ''.
 *
 * @param {*} raw
 * @returns {string}
 */
export function normalizeTitle(raw) {
    return String(raw ?? '').trim();
}

/**
 * Activate inline contenteditable editing on a title element.
 *
 * @param {HTMLElement} element - The element to edit in place.
 * @param {Object} options
 * @param {string} options.rawText - Raw (un-rendered) title used as the editing seed.
 * @param {string} [options.ariaLabel] - Accessible label applied while editing.
 * @param {'end'|'all'} [options.selection='end'] - Caret placement when entering edit mode.
 * @param {(value: string) => void} options.onCommit - Called with the trimmed value when a
 *        non-empty, changed value is confirmed (Enter or blur).
 * @param {() => void} [options.onCancel] - Called when editing is cancelled or the value is
 *        empty/whitespace-only/unchanged (Escape, or an invalid Enter/blur).
 * @returns {(() => void)|null} A teardown function that ends editing, or null if the element
 *          was already being edited.
 */
export function startInlineTitleEdit(element, options = {}) {
    const {
        rawText = '',
        ariaLabel = null,
        selection = 'end',
        onCommit,
        onCancel,
    } = options;

    if (!element || element.getAttribute('contenteditable') === 'true') {
        return null;
    }

    // Seed the editable element with the raw text (avoids editing rendered MathJax DOM).
    element.textContent = rawText;
    element.setAttribute('contenteditable', 'true');
    if (ariaLabel) {
        element.setAttribute('aria-label', ariaLabel);
    }
    element.focus();
    placeCaret(element, selection);

    let finished = false;

    const cleanup = () => {
        element.removeAttribute('contenteditable');
        if (ariaLabel) {
            element.removeAttribute('aria-label');
        }
        element.removeEventListener('blur', onBlur);
        element.removeEventListener('keydown', onKeydown);
    };

    const finishEditing = (save) => {
        if (finished) return;
        finished = true;

        const value = normalizeTitle(element.textContent);
        cleanup();

        if (save && value && value !== normalizeTitle(rawText)) {
            if (typeof onCommit === 'function') onCommit(value);
        } else if (typeof onCancel === 'function') {
            onCancel();
        }
    };

    function onBlur() {
        finishEditing(true);
    }

    function onKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            finishEditing(true);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            finishEditing(false);
        }
    }

    element.addEventListener('blur', onBlur);
    element.addEventListener('keydown', onKeydown);

    return () => finishEditing(false);
}

/**
 * Place the caret inside an editable element.
 *
 * @param {HTMLElement} element
 * @param {'end'|'all'} mode
 */
function placeCaret(element, mode) {
    try {
        const selection = window.getSelection?.();
        if (!selection || typeof selection.addRange !== 'function') return;
        const range = document.createRange();
        range.selectNodeContents(element);
        if (mode !== 'all') {
            // Collapse to the end of the content (caret after the last character).
            range.collapse(false);
        }
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (e) {
        // Caret placement is a best-effort enhancement; ignore environment gaps.
    }
}
