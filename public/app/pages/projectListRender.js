/**
 * Project-list rendering for the standalone `/projects` landing page.
 *
 * The row markup is built as an HTML string and assigned via `innerHTML`, so
 * every user-controlled field (project title, collaborator email, version)
 * MUST be HTML-escaped before interpolation. The "Shared with me" tab renders
 * titles and emails coming from OTHER users' projects, so an unescaped value
 * is a stored-XSS vector in the victim's authenticated session.
 *
 * This module is the single source of truth for that escaping and for the row
 * markup, extracted from the inline template script so it can be unit-tested.
 */

/** Document icon shown at the start of each project row. */
const DOC_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2.26953V6.40007C14 6.96012 14 7.24015 14.109 7.45406C14.2049 7.64222 14.3578 7.7952 14.546 7.89108C14.7599 8.00007 15.0399 8.00007 15.6 8.00007H19.7305M14 17H8M16 13H8M20 9.98823V17.2C20 18.8802 20 19.7202 19.673 20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22 15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146 20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V6.8C4 5.11984 4 4.27976 4.32698 3.63803C4.6146 3.07354 5.07354 2.6146 5.63803 2.32698C6.27976 2 7.11984 2 8.8 2H12.0118C12.7455 2 13.1124 2 13.4577 2.08289C13.7638 2.15638 14.0564 2.27759 14.3249 2.44208C14.6276 2.6276 14.887 2.88703 15.4059 3.40589L18.5941 6.59411C19.113 7.11297 19.3724 7.3724 19.5579 7.67515C19.7224 7.94356 19.8436 8.2362 19.9171 8.54231C20 8.88757 20 9.25445 20 9.98823Z" stroke="#1D1D1D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Copy / duplicate action icon. */
const COPY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5.33333 5.33333V3.46667C5.33333 2.71993 5.33333 2.34656 5.47866 2.06135C5.60649 1.81047 5.81047 1.60649 6.06135 1.47866C6.34656 1.33333 6.71993 1.33333 7.46667 1.33333H12.5333C13.2801 1.33333 13.6534 1.33333 13.9387 1.47866C14.1895 1.60649 14.3935 1.81047 14.5213 2.06135C14.6667 2.34656 14.6667 2.71993 14.6667 3.46667V8.53333C14.6667 9.28007 14.6667 9.65344 14.5213 9.93865C14.3935 10.1895 14.1895 10.3935 13.9387 10.5213C13.6534 10.6667 13.2801 10.6667 12.5333 10.6667H10.6667M3.46667 14.6667H8.53333C9.28007 14.6667 9.65344 14.6667 9.93865 14.5213C10.1895 14.3935 10.3935 14.1895 10.5213 13.9387C10.6667 13.6534 10.6667 13.2801 10.6667 12.5333V7.46667C10.6667 6.71993 10.6667 6.34656 10.5213 6.06135C10.3935 5.81047 10.1895 5.60649 9.93865 5.47866C9.65344 5.33333 9.28007 5.33333 8.53333 5.33333H3.46667C2.71993 5.33333 2.34656 5.33333 2.06135 5.47866C1.81047 5.60649 1.60649 5.81047 1.47866 6.06135C1.33333 6.34656 1.33333 6.71993 1.33333 7.46667V12.5333C1.33333 13.2801 1.33333 13.6534 1.47866 13.9387C1.60649 14.1895 1.81047 14.3935 2.06135 14.5213C2.34656 14.6667 2.71993 14.6667 3.46667 14.6667Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Delete action icon. */
const DELETE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4M6.66667 7V10.3333M9.33333 7V10.3333" stroke="#C64143" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * HTML-escape an arbitrary value for safe interpolation into both element text
 * and double-quoted attribute values. Escapes `& < > " '` so a value can never
 * break out of its text node or attribute.
 *
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build the `<div class="ode-files-list">…</div>` markup for a list of
 * projects. Pure function: given the same inputs it returns the same string.
 *
 * @param {Array<Object>} projects - already filtered project descriptors.
 * @param {Object} options
 * @param {Object} options.t - translation strings.
 * @param {(value:*) => string} options.formatDate - date formatter.
 * @returns {string} HTML string ready for `container.innerHTML`.
 */
export function buildProjectRowsHtml(projects, { t, formatDate }) {
    let html = '<div class="ode-files-list">';
    for (const p of projects) {
        const isPublic = p.visibility === 'public';
        const visLabel = isPublic ? t.public_label : t.private_label;
        const visClass = isPublic ? 'ode-badge-public' : 'ode-badge-private';
        const isShared = p.role && p.role !== 'owner';
        // User-controlled fields — escape before interpolating into HTML/attrs.
        const title = escapeHtml(p.title || t.untitled);
        const version = escapeHtml(p.versionName || '1');
        const uuid = escapeHtml(p.odeId);
        const ownerEmail = escapeHtml(p.ownerEmail);
        const date = formatDate(p.updatedAt);
        const size = p.sizeFormatted || '--';

        let metaExtra = '';
        if (isShared && p.ownerEmail) {
            metaExtra =
                '<span class="dot">&bull;</span><span class="ode-owner-info" title="' +
                t.shared_by +
                ' ' +
                ownerEmail +
                '">' +
                ownerEmail +
                '</span>';
        } else {
            metaExtra = '<span class="dot">&bull;</span><span>' + (p.isManualSave ? t.manual : t.autosaved) + '</span>';
        }

        html +=
            '<article class="ode-row" data-uuid="' +
            uuid +
            '">' +
            '<span class="exe-logo">' +
            DOC_ICON +
            '</span>' +
            '<div class="ode-info">' +
            '<div class="ode-title">' +
            title +
            '</div>' +
            '<div class="ode-meta">' +
            '<span class="ode-badge">v' +
            version +
            '</span>' +
            '<span class="ode-badge ' +
            visClass +
            '">' +
            visLabel +
            '</span>' +
            '<span class="dot">&bull;</span><span>' +
            size +
            '</span>' +
            '<span class="dot">&bull;</span><span>' +
            date +
            '</span>' +
            metaExtra +
            '</div>' +
            '</div>' +
            '<div class="ode-actions">' +
            '<button type="button" class="action-copy" title="' +
            (isShared ? t.clone_to_my : t.duplicate) +
            '">' +
            COPY_ICON +
            '</button>' +
            (!isShared
                ? '<button type="button" class="open-user-ode-file-action-delete action-delete" title="' +
                  t.delete_label +
                  '">' +
                  DELETE_ICON +
                  '</button>'
                : '') +
            '</div>' +
            '</article>';
    }
    html += '</div>';
    return html;
}
