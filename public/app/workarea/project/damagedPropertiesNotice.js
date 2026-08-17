/**
 * Notice for activities whose persisted properties an import could not parse (#2190).
 *
 * The importer preserves the damaged payload verbatim, which is the right
 * call — replacing it with an empty object would destroy the only copy of the
 * activity's data — but on its own that leaves the author with activities that
 * silently refuse to open. This turns the importer's report into something to
 * show them: which activities are affected, and that their data is kept.
 */

import { escapeHtml } from './missingAssetsNotice.js';

/**
 * Build the dialog content for the activities whose saved data is damaged.
 *
 * @param {Array<{componentId: string, ideviceType: string}>} malformedProperties
 *   Report from the importer (`ElpxImportResult.malformedProperties`).
 * @returns {{title: string, body: string}|null} null when nothing is damaged
 */
export function buildDamagedPropertiesNotice(malformedProperties) {
    if (!Array.isArray(malformedProperties)) return null;

    const affected = malformedProperties.filter(
        (entry) => entry && typeof entry.ideviceType === 'string'
    );
    if (affected.length === 0) return null;

    // Group by iDevice type: the ids are internal, the type is what the author
    // can recognize on the page.
    const countsByType = new Map();
    for (const entry of affected) {
        countsByType.set(
            entry.ideviceType,
            (countsByType.get(entry.ideviceType) || 0) + 1
        );
    }

    const items = [...countsByType].map(([type, count]) => {
        const suffix = count > 1 ? ` (${count})` : '';
        return `<li><strong>${escapeHtml(type)}</strong>${suffix}</li>`;
    });

    return {
        title: _('Damaged activities'),
        body: `<p>${_(
            'The saved data of these activities is damaged and could not be read. They were imported unchanged: their last content is still shown, but they cannot be edited until they are recreated.'
        )}</p><ul>${items.join('')}</ul>`,
    };
}
