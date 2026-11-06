/**
 * HTML helpers: escaping, one-level entity recovery, and the DOM-based blank
 * detection shared by the legacy cloze/dropdown migration and the runtime.
 *
 * Everything here operates on strings or on a caller-supplied parsed DOM —
 * never on live page elements — so the editor, the runtime and the tests can
 * share one definition of "what is a blank".
 */

/** Escape a value for safe insertion into HTML text/attribute contexts. */
export function escapeHtml(value: unknown): string {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Unescape one level of HTML entities (used to recover double-escaped markup). */
export function unescapeEntitiesOnce(str: unknown): string {
    return String(str == null ? '' : str)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&amp;/g, '&');
}

/** True if `el` is a strike-through element used to mark a legacy blank. */
export function isDropdownBlank(el: Element | null): boolean {
    if (!el || el.nodeType !== 1) {
        return false;
    }
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 's' || tag === 'strike' || tag === 'del') {
        return true;
    }
    const styleAttr = typeof el.getAttribute === 'function' ? el.getAttribute('style') || '' : '';
    if (/line-through/i.test(styleAttr)) {
        return true;
    }
    const style = (el as HTMLElement).style;
    const decoration = style ? style.textDecoration || style.textDecorationLine || '' : '';
    return /line-through/i.test(decoration);
}

/** True if any ancestor of `el` is itself a blank (avoids nested double-count). */
function hasDropdownBlankAncestor(el: Element): boolean {
    let parent = el.parentNode;
    while (parent && parent.nodeType === 1) {
        if (isDropdownBlank(parent as Element)) {
            return true;
        }
        parent = parent.parentNode;
    }
    return false;
}

/**
 * Collect the blank ELEMENT nodes under a DOM root (a parsed document body or
 * a live host element), in document order: outermost strike-through elements
 * with non-empty trimmed text. Shared by the runtime (to replace each blank
 * with a control) and by the migration (to read the correct words), so the two
 * can never drift in order or count.
 */
export function collectDropdownBlankNodes(root: ParentNode | null): Element[] {
    const out: Element[] = [];
    if (!root || typeof root.querySelectorAll !== 'function') {
        return out;
    }
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (!el || !isDropdownBlank(el) || hasDropdownBlankAncestor(el)) {
            continue;
        }
        if ((el.textContent || '').replace(/^\s+|\s+$/g, '') === '') {
            continue;
        }
        out.push(el);
    }
    return out;
}

