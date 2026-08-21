/**
 * Notice for asset references an import could not satisfy (#2223).
 *
 * The importer preserves a reference it cannot resolve, which is the right
 * call — rewriting it would destroy the only record of what the activity
 * pointed at — but on its own that leaves the author reading a raw
 * `{{context_path}}/…` placeholder in a form field with no idea a file is
 * missing. This turns the importer's report into something to show them.
 */

/** Files listed per activity before the list is cut short. */
const MAX_PATHS_PER_ACTIVITY = 10;

/**
 * Escape text that came from the imported package before it reaches innerHTML.
 * Activity types and file names are attacker-controlled in a crafted package.
 * Shared with damagedPropertiesNotice.js (#2190).
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Build the dialog content for the activities that reference missing files.
 *
 * @param {Array<{componentId: string, ideviceType: string, paths: string[]}>} missingAssets
 *   Report from the importer (`ElpxImportResult.missingAssets`).
 * @returns {{title: string, body: string}|null} null when nothing is missing
 */
export function buildMissingAssetsNotice(missingAssets) {
    if (!Array.isArray(missingAssets)) return null;

    const affected = missingAssets.filter(
        (entry) => entry && Array.isArray(entry.paths) && entry.paths.length > 0
    );
    if (affected.length === 0) return null;

    const items = affected.map((entry) => {
        const shown = entry.paths.slice(0, MAX_PATHS_PER_ACTIVITY);
        const hidden = entry.paths.length - shown.length;
        let files = shown.map(escapeHtml).join(', ');
        if (hidden > 0) {
            files += `, ${_('and %1 more').replace('%1', hidden)}`;
        }
        return `<li><strong>${escapeHtml(entry.ideviceType)}</strong>: ${files}</li>`;
    });

    return {
        title: _('Missing files'),
        body: `<p>${_(
            'These activities refer to files that are not included in the imported package. The references have been kept, so adding the files back will restore them.'
        )}</p><ul>${items.join('')}</ul>`,
    };
}
