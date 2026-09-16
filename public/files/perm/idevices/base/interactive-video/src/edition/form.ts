/**
 * Static form markup for the inline editor: the description banner, the
 * "General settings" tab (Options fieldset → Video fieldset with the
 * Interactions authoring surface) and the subtitle
 * rows. Follows the repo-wide iDevice contract so the shared tab/fieldset
 * wiring in common_edition.js applies unchanged.
 */

import { escapeHtml } from '../shared/html';
import type { EditionState } from './state';
import { tr } from './state';

/** Standard eXe help hint: an info icon that reveals help text on click. */
export function helpHtml(text: string): string {
    return (
        '<span class="exe-form-help help-content-disabled" title="' +
        tr('Information') +
        '"><span class="form-help-exe-icon icon-medium info-icon-solid-green"></span>' +
        '<span class="help-content help-hidden">' +
        escapeHtml(text) +
        '</span></span>'
    );
}

/** Wire the help icons (delegated, so dynamically-rendered hints work too). */
export function wireHelp(): void {
    $('#interactiveVideoIdeviceForm')
        .off('click.ivhelp')
        .on('click.ivhelp', '.form-help-exe-icon', function () {
            const container = $(this).closest('.exe-form-help');
            const content = container.find('.help-content');
            const willShow = content.hasClass('help-hidden');
            content.toggleClass('help-hidden', !willShow);
            container.toggleClass('help-content-disabled', !willShow);
        });
    // The quext-style help links toggle their target block paragraph.
    $('#interactiveVideoIdeviceForm')
        .off('click.ivhelplnk')
        .on('click.ivhelplnk', '.exe-iv-help-link', function (event) {
            event.preventDefault();
            const targetId = ($(this).attr('href') || '').replace(/^#/, '');
            const target = targetId ? document.getElementById(targetId) : null;
            if (target) {
                target.classList.toggle('is-open');
            }
        });
}

/** Human label for an interaction type (color is never the sole cue). */
export function typeLabel(type: string): string {
    switch (type) {
        case 'cover':
            return 'Cover';
        case 'note':
            return 'Note';
        case 'question':
            return 'Question';
        case 'pause':
            return 'Pause';
        case 'jump':
            return 'Jump';
        default:
            return 'Interaction';
    }
}

/** The colour legend under the timeline (kind -> colour mapping). */
export function legendHtml(): string {
    return (
        '<ul class="exe-iv-legend">' +
        ['cover', 'note', 'question', 'pause', 'jump']
            .map(
                kind =>
                    '<li class="exe-iv-legend-item"><span class="exe-iv-legend-swatch exe-iv-kind--' +
                    kind +
                    '" aria-hidden="true"></span>' +
                    escapeHtml(tr(typeLabel(kind))) +
                    '</li>',
            )
            .join('') +
        '</ul>'
    );
}

/**
 * The "Interactions" authoring surface, rendered inside the Video fieldset: a
 * titled sub-heading with a live interaction count → inline player →
 * proportional timeline (progress + playhead + one positioned, colour-coded
 * marker per interaction, with a hint and a colour legend underneath) → add
 * bar → single-editor accordion list. A stable aria-live region announces
 * editor changes regardless of which row is expanded.
 */
export function interactionsSectionHtml(): string {
    const t = tr;
    return (
        '<div class="exe-iv-interactions-section">' +
        '<div class="exe-iv-section-head"><h4 class="exe-iv-section-title">' +
        t('Interactions') +
        '</h4><span id="ivInteractionsCount" class="exe-iv-fieldset-count"></span></div>' +
        '<div class="exe-iv-interactions">' +
        // Two-column edit stage, mirroring the learner side-panel: the player
        // + timeline on the left, a live preview of the selected interaction
        // on the right (stacked below on narrow screens).
        '<div class="exe-iv-edit-stage">' +
        '<div class="exe-iv-edit-stage-main">' +
        // Inline video preview so the author sees where interactions land.
        '<div id="ivInteractionsPlayer" class="exe-iv-edit-player"></div>' +
        // Timeline joined under the player: progress bar, playhead knob and
        // the positioned markers layer, then the hint + colour legend.
        '<div id="ivTimelineBox" class="exe-iv-timeline-box">' +
        '<div id="ivTimelineTrack" class="exe-iv-timeline-track">' +
        '<div id="ivTimelineProgress" class="exe-iv-timeline-progress"></div>' +
        '<div id="ivTimelinePlayhead" class="exe-iv-timeline-playhead"></div>' +
        '<ol id="ivEditTimeline" class="exe-iv-edit-timeline" aria-label="' +
        t('Interaction markers') +
        '"></ol>' +
        '</div>' +
        '<div class="exe-iv-timeline-foot">' +
        '<span class="exe-iv-hint">' +
        t('Click the timeline to place an interaction, or use the current time.') +
        '</span>' +
        legendHtml() +
        '</div>' +
        '</div>' +
        '</div>' +
        // Right-hand live preview of the selected interaction.
        '<div id="ivEditPreview" class="exe-iv-edit-preview" aria-live="polite"></div>' +
        '</div>' +
        '<div class="exe-iv-add-bar" role="group" aria-label="' +
        t('Add interaction') +
        '">' +
        helpHtml(
            'Play the video and press "Use current time", click the timeline, or type a time. Then add a Note, Question, Pause or Jump at that moment.',
        ) +
        ' ' +
        '<label for="ivAddTime">' +
        t('Add at') +
        '</label>' +
        '<input type="text" id="ivAddTime" class="form-control exe-iv-time-input" value="00:00" size="8">' +
        '<button type="button" id="ivAddCurrentTime" class="btn btn-secondary">' +
        t('Use current time') +
        '</button>' +
        '<span class="exe-iv-add-spacer"></span>' +
        // The cover is the opener pinned to the start; its Add button uses a
        // distinct kind colour (magenta, not the primary/note teal).
        '<button type="button" id="ivAddCover" class="btn exe-iv-add-cover">+ ' +
        t('Cover') +
        '</button>' +
        '<button type="button" id="ivAddNote" class="btn btn-primary">+ ' +
        t('Note') +
        '</button>' +
        '<button type="button" id="ivAddQuestion" class="btn btn-primary">+ ' +
        t('Question') +
        '</button>' +
        '<button type="button" id="ivAddPause" class="btn btn-primary">+ ' +
        t('Pause') +
        '</button>' +
        '<button type="button" id="ivAddJump" class="btn btn-primary">+ ' +
        t('Jump') +
        '</button>' +
        '</div>' +
        // Stable, screen-reader-only live region for editor announcements.
        '<div id="ivEditorLive" class="sr-av" role="status" aria-live="polite"></div>' +
        '<ol id="ivInteractionList" class="exe-iv-edit-list"></ol>' +
        '</div></div>'
    );
}

/**
 * The collapsed "Options" fieldset: behaviour/scoring, the progress report and
 * the subtitle tracks. Uses the standard `exe-fieldset exe-fieldset-closed`
 * markup so the central legend-collapse wiring in common_edition.js applies.
 */
export function optionsFieldsetHtml(state: EditionState): string {
    const t = tr;
    const edition = typeof $exeDevicesEdition !== 'undefined' ? $exeDevicesEdition?.iDevice : null;
    const progress = edition?.gamification.progressBar?.getContents
        ? edition.gamification.progressBar.getContents(state.idevicePath)
        : '';
    return (
        '<fieldset class="exe-fieldset exe-fieldset-closed"><legend><a href="#">' +
        t('Options') +
        '</a></legend><div>' +
        '<div class="exe-form-group"><label for="ivCompletionMode">' +
        t('Completion mode') +
        '</label> ' +
        // The quext-style help link every game iDevice uses: an icon that
        // toggles an explanatory block paragraph (see e.g. electrical-circuits
        // `GameModeHelpLink`). The icon asset already ships with this iDevice.
        '<a href="#ivCompletionHelp" id="ivCompletionHelpLnk" class="exe-iv-help-link" title="' +
        t('Help') +
        '"><img src="' +
        escapeHtml((state.idevicePath || '') + 'quextIEHelp.png') +
        '" width="18" height="18" alt="' +
        t('Help') +
        '"></a>' +
        '<p id="ivCompletionHelp" class="exe-block-info exe-iv-help-text">' +
        t('None: the activity never reports completion.') +
        ' ' +
        t('Video watched: complete once at least 95% of the video has actually been played (seeking ahead does not count).') +
        ' ' +
        t('All questions answered: complete when every question has been answered.') +
        ' ' +
        t('Minimum score: complete when the score reaches the required percentage.') +
        '</p>' +
        '<select id="ivCompletionMode" class="form-select">' +
        '<option value="none">' +
        t('None') +
        '</option>' +
        '<option value="watch">' +
        t('Video watched') +
        '</option>' +
        '<option value="answerRequired">' +
        t('All questions answered') +
        '</option>' +
        '<option value="scoreThreshold">' +
        t('Minimum score') +
        '</option>' +
        '</select></div>' +
        '<div class="exe-form-group"><label for="ivRequiredScore">' +
        t('Required score (%)') +
        '</label>' +
        '<input type="number" id="ivRequiredScore" class="form-control" min="0" max="100" value="80"></div>' +
        '<div class="exe-form-group exe-form-check"><input type="checkbox" id="ivShowResults" checked><label for="ivShowResults">' +
        t('Show results') +
        '</label></div>' +
        '<div class="exe-form-group exe-form-check"><input type="checkbox" id="ivScoreNIA"><label for="ivScoreNIA">' +
        t('Score non-interactive activities') +
        '</label></div>' +
        progress +
        // Subtitles / captions for the native <video> (library file, direct
        // media URL or Mediateca). SRT assets are converted to WebVTT at
        // export by the shared subtitle pipeline (issue #2035).
        '<div class="exe-form-group exe-iv-captions-section"><label>' +
        t('Subtitles') +
        '</label> ' +
        helpHtml(
            'Subtitle tracks for the video. Pick a .vtt file from the media library (or .srt, which is converted to WebVTT on export). Set a language code and a label, and mark one track as the default.',
        ) +
        '<div id="ivCaptions"></div>' +
        '<button type="button" id="ivAddCaption" class="btn btn-secondary btn-sm">+ ' +
        t('Subtitle') +
        '</button></div>' +
        '</div></fieldset>'
    );
}

/**
 * The open "Video" fieldset: a single source control — one text input that
 * accepts either a URL (YouTube / Vimeo / Mediateca / direct media file) or a
 * media-library path. The workarea auto-injects a video-filtered "Select a
 * file" button to its right (the id contains "video" and the class is
 * exe-file-picker). The provider is auto-detected from the value — there is
 * no URL-vs-file mode to pick. Followed, in the SAME section, by the
 * Interactions authoring surface.
 */
export function videoFieldsetHtml(): string {
    const t = tr;
    return (
        '<fieldset class="exe-fieldset"><legend><a href="#">' +
        t('Video') +
        '</a></legend><div>' +
        '<div class="exe-form-group exe-iv-source-row">' +
        '<input type="text" id="ivVideoFile" class="exe-file-picker form-control" placeholder="' +
        t('Enter a URL or select a file') +
        '" aria-label="' +
        t('Video source (URL or file)') +
        '" aria-describedby="ivVideoSourceHint">' +
        '</div>' +
        // Always visible: what the field accepts is essential, not optional help.
        '<p class="exe-iv-hint" id="ivVideoSourceHint">' +
        t('Local video file, YouTube, Vimeo, EducaMadrid Mediateca or a direct video URL.') +
        '</p>' +
        '<p class="exe-iv-field-error" id="ivUrlError" role="alert" aria-live="polite"></p>' +
        interactionsSectionHtml() +
        '</div></fieldset>'
    );
}

/**
 * Tab 1 — "General settings". In default (non-advanced) mode this is the only
 * visible tab, so it holds everything essential (mirroring the sibling
 * iDevice contract).
 */
export function tabGeneralSettingsHtml(state: EditionState): string {
    // No before/after text boxes: content around the video belongs to sibling
    // Text iDevices in the same block (the importer converts legacy fields).
    return (
        '<div class="exe-form-tab" title="' +
        tr('General settings') +
        '">' +
        optionsFieldsetHtml(state) +
        videoFieldsetHtml() +
        '</div>'
    );
}

/** The dismissible description banner shown above the tabs (sibling parity). */
export function descriptionHtml(): string {
    const edition = typeof $exeDevicesEdition !== 'undefined' ? $exeDevicesEdition?.iDevice : null;
    if (!edition?.common?.getIdeviceDescription) {
        return '';
    }
    return edition.common.getIdeviceDescription(
        'Add timed interactions — notes, questions, pauses and jumps — to a local or embedded video.',
    );
}

// ---------------------------------------------------------------------------
// Subtitle rows
// ---------------------------------------------------------------------------

/** Display name for a caption source (last path segment). */
export function captionFileName(src: string | undefined): string {
    if (!src) {
        return '';
    }
    const clean = String(src).split('?')[0]?.split('#')[0] ?? '';
    const parts = clean.split('/');
    return parts[parts.length - 1] || clean;
}

/** Render the subtitle rows from the live doc.video.captions model. */
export function renderCaptions(state: EditionState): void {
    const t = tr;
    const container = $('#ivCaptions');
    if (!container.length) {
        return;
    }
    if (!Array.isArray(state.doc.video.captions)) {
        state.doc.video.captions = [];
    }
    const captions = state.doc.video.captions;
    if (!captions.length) {
        container.html('<p class="exe-iv-hint">' + t('No subtitles yet.') + '</p>');
        return;
    }
    container.html(
        captions
            .map(
                (caption, index) =>
                    '<div class="exe-iv-caption-row" data-index="' +
                    index +
                    '"><span class="exe-iv-caption-file" title="' +
                    escapeHtml(caption.src || '') +
                    '">' +
                    escapeHtml(captionFileName(caption.src) || t('(no file)')) +
                    '</span>' +
                    '<input type="text" class="form-control exe-iv-caption-lang" data-index="' +
                    index +
                    '" placeholder="' +
                    t('Lang') +
                    '" size="4" value="' +
                    escapeHtml(caption.lang || '') +
                    '">' +
                    '<input type="text" class="form-control exe-iv-caption-label" data-index="' +
                    index +
                    '" placeholder="' +
                    t('Label') +
                    '" value="' +
                    escapeHtml(caption.label || '') +
                    '">' +
                    '<label class="exe-iv-caption-default"><input type="radio" name="ivCaptionDefault" class="exe-iv-caption-default-radio" data-index="' +
                    index +
                    '"' +
                    (caption.default ? ' checked' : '') +
                    '> ' +
                    t('Default') +
                    '</label>' +
                    '<button type="button" class="exe-iv-caption-del" data-index="' +
                    index +
                    '" aria-label="' +
                    t('Delete') +
                    '">✕</button></div>',
            )
            .join(''),
    );
    bindCaptionRows(state);
}

/** Wire the per-row subtitle inputs to the live model. */
function bindCaptionRows(state: EditionState): void {
    const caps = state.doc.video.captions;
    const rowIndex = (el: HTMLElement): number => parseInt($(el).attr('data-index') ?? '', 10);
    $('#ivCaptions')
        .find('.exe-iv-caption-lang')
        .on('input', function () {
            const caption = caps[rowIndex(this)];
            if (caption) {
                caption.lang = $(this).val() ?? '';
            }
        });
    $('#ivCaptions')
        .find('.exe-iv-caption-label')
        .on('input', function () {
            const caption = caps[rowIndex(this)];
            if (caption) {
                caption.label = $(this).val() ?? '';
            }
        });
    $('#ivCaptions')
        .find('.exe-iv-caption-default-radio')
        .on('change', function () {
            const idx = rowIndex(this);
            caps.forEach((caption, i) => {
                caption.default = i === idx;
            });
        });
    $('#ivCaptions')
        .find('.exe-iv-caption-del')
        .on('click', function () {
            caps.splice(rowIndex(this), 1);
            renderCaptions(state);
        });
}

/** Add a subtitle track (src is the picked asset reference) and re-render. */
export function addCaption(state: EditionState, src: string | undefined): void {
    if (!Array.isArray(state.doc.video.captions)) {
        state.doc.video.captions = [];
    }
    const hasDefault = state.doc.video.captions.some(caption => caption.default);
    state.doc.video.captions.push({ src: src || '', lang: '', label: '', default: !hasDefault });
    renderCaptions(state);
}
