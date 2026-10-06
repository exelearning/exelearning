/**
 * Detail editor for note and pause interactions (and the shared rich-text
 * body field the cover reuses): a single TinyMCE-backed body textarea. Note
 * and pause share one editor — a pause is a note that always halts playback.
 */

import { escapeHtml } from '../../shared/html';
import type { CoverInteraction, NoteInteraction, PauseInteraction } from '../../shared/types';
import { tr } from '../state';
import type { DetailHost } from './types';

type BodyInteraction = NoteInteraction | PauseInteraction | CoverInteraction;

/** The rich-text body field (`.exe-html-editor` hooks the shared TinyMCE). */
export function bodyFieldHtml(interaction: BodyInteraction): string {
    const bodyLabel = interaction.type === 'cover' ? tr('Cover content (image or text)') : tr('Text');
    return (
        '<div class="exe-form-group"><label for="ivDetailBody">' +
        bodyLabel +
        '</label><textarea id="ivDetailBody" class="form-control exe-html-editor" rows="4">' +
        escapeHtml(interaction.body || '') +
        '</textarea></div>'
    );
}

export function detailNoteOrPause(interaction: NoteInteraction | PauseInteraction): string {
    return bodyFieldHtml(interaction);
}

/** Keep the model in sync while the plain textarea is used (no TinyMCE). */
export function bindBodyField(interaction: BodyInteraction, _host: DetailHost): void {
    $('#ivDetailBody').on('input', function () {
        interaction.body = $(this).val() ?? '';
    });
}
