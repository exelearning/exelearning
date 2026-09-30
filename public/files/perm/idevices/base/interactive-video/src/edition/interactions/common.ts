/**
 * The fields every interaction editor shares (time, pause-on-show, optional
 * end time) and the per-type dispatch to the kind-specific editors.
 */

import { secondsToHms, toSeconds } from '../../shared/time';
import { sortInteractions } from '../../shared/scheduling';
import { escapeHtml } from '../../shared/html';
import type { Interaction } from '../../shared/types';
import { tr } from '../state';
import { bindCover, detailCover } from './cover';
import { bindJump, detailJump } from './jump';
import { bindBodyField, detailNoteOrPause } from './note';
import { bindQuestion, detailQuestion } from './question';
import type { DetailHost } from './types';

/** The shared time / pause / end-time fields above the kind-specific editor. */
export function commonFieldsHtml(interaction: Interaction): string {
    const t = tr;
    let common: string;
    if (interaction.type === 'cover') {
        // The cover is pinned to the very start; its time is not editable.
        common =
            '<div class="exe-form-group exe-iv-detail-time"><label>' +
            t('Time') +
            '</label><span class="exe-iv-detail-fixed-time">' +
            t('Shown at the start of the video') +
            '</span></div>';
    } else {
        common =
            '<div class="exe-form-group exe-iv-detail-time"><label for="ivDetailTime">' +
            t('Time (mm:ss)') +
            '</label><input type="text" id="ivDetailTime" class="form-control exe-iv-time-input" value="' +
            secondsToHms(interaction.time) +
            '"><button type="button" id="ivDetailCurrentTime" class="btn btn-secondary btn-sm">' +
            t('Set to current time') +
            '</button></div>';
    }
    // "Pause video when shown" only makes sense for overlays that appear over
    // playing video (note/question). A pause interaction already pauses, and a
    // jump only seeks — so the toggle is omitted for those.
    if (interaction.type === 'note' || interaction.type === 'question') {
        common +=
            '<div class="exe-form-group exe-form-check"><input type="checkbox" id="ivDetailPause"' +
            (interaction.pause ? ' checked' : '') +
            '><label for="ivDetailPause">' +
            t('Pause video when shown') +
            '</label></div>';
    }
    // Optional end time: note/pause overlays can auto-dismiss and let the
    // video carry on; blank keeps them up until the learner clicks Continue.
    //
    // The author reads and writes an END TIME, like every other time in this
    // editor — what is STORED is still a duration, so moving the interaction
    // keeps its length and the end time follows it.
    if (interaction.type === 'note' || interaction.type === 'pause') {
        const endTime =
            interaction.duration != null
                ? secondsToHms(toSeconds(interaction.time) + toSeconds(interaction.duration))
                : '';
        common +=
            '<div class="exe-form-group exe-iv-detail-duration"><label for="ivDetailDuration">' +
            t('Until (mm:ss, optional)') +
            '</label><input type="text" id="ivDetailDuration" class="form-control exe-iv-time-input" value="' +
            escapeHtml(endTime) +
            '" aria-describedby="ivDetailDurationHint">' +
            '<p class="exe-iv-hint" id="ivDetailDurationHint">' +
            t('Leave it blank to wait for Continue.') +
            '</p>' +
            '<p class="exe-iv-field-error" id="ivDetailDurationError" role="alert" aria-live="polite"></p>' +
            '</div>';
    }
    return common;
}

/** The kind-specific editor below the shared fields. */
export function detailForType(interaction: Interaction): string {
    switch (interaction.type) {
        case 'cover':
            return detailCover(interaction);
        case 'note':
        case 'pause':
            return detailNoteOrPause(interaction);
        case 'jump':
            return detailJump(interaction);
        case 'question':
            return detailQuestion(interaction);
        case 'unsupported':
            return (
                '<p class="exe-iv-unsupported">' +
                tr('This interaction is preserved but cannot be edited here.') +
                '</p>'
            );
        default: {
            const exhaustive: never = interaction;
            void exhaustive;
            return '';
        }
    }
}

/** Wire the shared fields; the kind-specific bindings follow. */
export function bindCommonFields(interaction: Interaction, host: DetailHost): void {
    $('#ivDetailCurrentTime').on('click', () => {
        // Capture the playhead into the field, then COMMIT it to the model
        // (like a manual edit) so the row time, the marker and the sort all
        // move — not just the textbox value.
        void host.useCurrentTime('ivDetailTime').then(seconds => {
            if (seconds != null && isFinite(seconds)) {
                $('#ivDetailTime').trigger('change');
            }
        });
    });
    $('#ivDetailTime').on('change', function () {
        interaction.time = toSeconds($(this).val());
        host.state.doc.interactions = sortInteractions(host.state.doc.interactions);
        host.rerender();
        const moved = document.getElementById('ivDetailTime');
        if (moved) {
            moved.focus();
        }
    });
    $('#ivDetailPause').on('change', function () {
        interaction.pause = $(this).is(':checked');
    });
    $('#ivDetailDuration').on('change', function () {
        const value = String($(this).val() || '').trim();
        const error = document.getElementById('ivDetailDurationError');
        if (error) {
            error.textContent = '';
        }
        if (value === '') {
            interaction.duration = null;
            return;
        }
        const start = toSeconds(interaction.time);
        const end = toSeconds(value);
        if (!(end > start)) {
            // An end at or before the start would dismiss the interaction the
            // instant it appears; say so instead of storing it.
            interaction.duration = null;
            $(this).val('');
            const message = tr('The end time must be after the start time.');
            if (error) {
                error.textContent = message;
            }
            host.announce(message);
            return;
        }
        interaction.duration = end - start;
    });
}

/** Wire the kind-specific editor for the selected interaction. */
export function bindDetailForType(interaction: Interaction, host: DetailHost): void {
    switch (interaction.type) {
        case 'cover':
            bindCover(interaction, host);
            return;
        case 'note':
        case 'pause':
            bindBodyField(interaction, host);
            return;
        case 'jump':
            bindJump(interaction, host);
            return;
        case 'question':
            bindQuestion(interaction, host);
            return;
        default:
            return;
    }
}
