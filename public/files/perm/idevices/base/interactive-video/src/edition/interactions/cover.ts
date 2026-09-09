/**
 * Detail editor for the singleton cover: an own title field (as the legacy
 * opener had) plus the shared rich-text body.
 */

import { escapeHtml } from '../../shared/html';
import type { CoverInteraction } from '../../shared/types';
import { tr } from '../state';
import { bindBodyField, bodyFieldHtml } from './note';
import type { DetailHost } from './types';

export function detailCover(interaction: CoverInteraction): string {
    // The cover keeps a title of its own, so it can be shown as a heading and
    // used as the row summary instead of being buried as markup in the body.
    const titleField =
        '<div class="exe-form-group"><label for="ivDetailTitle">' +
        tr('Title') +
        '</label><input type="text" id="ivDetailTitle" class="form-control" value="' +
        escapeHtml(interaction.title || '') +
        '"></div>';
    return titleField + bodyFieldHtml(interaction);
}

export function bindCover(interaction: CoverInteraction, host: DetailHost): void {
    bindBodyField(interaction, host);
    $('#ivDetailTitle').on('input', function () {
        interaction.title = $(this).val() ?? '';
        host.updateRowSummary(interaction);
        host.renderEditPreview();
    });
}
