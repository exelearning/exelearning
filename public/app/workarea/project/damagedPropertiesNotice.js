/**
 * Notices for activities whose persisted properties an import could not parse
 * (#2190) or had to repair (#2611).
 *
 * The importer preserves the damaged payload verbatim, which is the right
 * call — replacing it with an empty object would destroy the only copy of the
 * activity's data — but on its own that leaves the author with activities that
 * silently refuse to open. This turns the importer's report into something to
 * show them: which activities are affected, and that their data is kept.
 */

import { escapeHtml } from './missingAssetsNotice.js';

/**
 * List the reported activities grouped by iDevice type: the ids are internal,
 * the type is what the author can recognize on the page.
 *
 * @param {Array<{componentId: string, ideviceType: string}>} entries
 * @returns {string|null} the `<ul>` markup, null when no entry is usable
 */
function listActivitiesByType(entries) {
    if (!Array.isArray(entries)) return null;

    const affected = entries.filter(
        (entry) => entry && typeof entry.ideviceType === 'string'
    );
    if (affected.length === 0) return null;

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
    return `<ul>${items.join('')}</ul>`;
}

/**
 * Build the dialog content for the activities whose saved data is damaged.
 *
 * @param {Array<{componentId: string, ideviceType: string}>} malformedProperties
 *   Report from the importer (`ElpxImportResult.malformedProperties`).
 * @returns {{title: string, body: string}|null} null when nothing is damaged
 */
export function buildDamagedPropertiesNotice(malformedProperties) {
    const list = listActivitiesByType(malformedProperties);
    if (!list) return null;

    return {
        title: _('Damaged activities'),
        body: `<p>${_(
            'The saved data of these activities is damaged and could not be read. They were imported unchanged: their last content is still shown, but they cannot be edited until they are recreated.'
        )}</p>${list}`,
    };
}

/**
 * Build the dialog content for the activities whose damaged saved data the
 * importer repaired (#2611). The repair only fixes unambiguous damage, but it
 * is still a change the author did not make, so they are asked to check it.
 *
 * @param {Array<{componentId: string, ideviceType: string}>} repairedProperties
 *   Report from the importer (`ElpxImportResult.repairedProperties`).
 * @returns {{title: string, body: string}|null} null when nothing was repaired
 */
export function buildRepairedPropertiesNotice(repairedProperties) {
    const list = listActivitiesByType(repairedProperties);
    if (!list) return null;

    return {
        title: _('Repaired activities'),
        body: `<p>${_(
            'The saved data of these activities was damaged, usually because the file was edited outside eXeLearning, and has been repaired automatically. Check that their content is correct.'
        )}</p>${list}`,
    };
}
