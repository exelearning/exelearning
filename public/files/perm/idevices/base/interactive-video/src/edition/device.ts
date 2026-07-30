/**
 * Interactive Video iDevice — integrated editor (edition code).
 *
 * A JSON-type iDevice edited entirely inline inside the iDevice body. The
 * engine contract is `$exeDevice.init(element, previousData, path)` +
 * `$exeDevice.save()` returning the schema-v2 document stored as
 * jsonProperties.
 *
 * On open, stored data of any supported shape is hydrated through the shared
 * `hydrateDocument` pipeline: legacy content is migrated directly to v2, and
 * data claiming a NEWER schema puts the editor into a read-only "unsupported"
 * state — it refuses to save (a save would destroy that content) and keeps
 * the original payload untouched.
 */

import { normalizeCaptions } from '../shared/captions';
import { escapeHtml } from '../shared/html';
import { hydrateDocument, SCHEMA_VERSION } from '../shared/schema';
import { sortInteractions } from '../shared/scheduling';
import type { InteractiveVideoDocumentV2 } from '../shared/types';
import { newDocument } from '../shared/types';
import { isSafeVideoUrl, normalizeVideoSource } from '../shared/video-source';
import { commitBodyEditor, readEditor } from './body-editor';
import type { Editor } from './editor';
import { createEditor } from './editor';
import { addCaption, descriptionHtml, renderCaptions, tabGeneralSettingsHtml, wireHelp } from './form';
import { normalizeQuestionForKind, validateQuestions } from './interactions/question';
import {
    announce,
    currentProvider,
    currentSourceValue,
    placeTimeFromTrack,
    renderInteractionsPlayer,
    toggleSource,
    useCurrentTime,
} from './player';
import type { EditionState } from './state';
import { tr } from './state';

export interface InteractiveVideoEditionDevice {
    readonly i18n: { name: string };
    init(element: HTMLElement, previousData: unknown, path?: string): void;
    save(): InteractiveVideoDocumentV2 | false;
}

/** Learner-string defaults for the shared Custom-texts tab (ci18n keys). */
function buildCi18n(): Record<string, string> {
    const c = typeof c_ === 'function' ? c_ : tr;
    // Source strings match the previous iDevice verbatim so the existing
    // translations resolve and the tab looks identical.
    return {
        start: c('Start'),
        results: c('Results'),
        slide: c('Slide (frame)'),
        score: c('Score'),
        seen: c('Seen'),
        total: c('Total'),
        seeAll: c('see all the slides and answer all the questions'),
        noSlides: c('This video has no interactive elements.'),
        goOn: c('Continue'),
        error: c('Error'),
        dataError: c('Incompatible code'),
        cover: c('Cover'),
        right: c('Right!'),
        wrong: c('Wrong'),
        sortableListInstructions: c('Use the Move up and Move down buttons to put the items in the correct order.'),
        up: c('Move up'),
        down: c('Move down'),
        rightAnswer: c('Right answer:'),
        notAnswered: c('Please finish the activity'),
        check: c('Check'),
        newWindow: c('New Window'),
        msgSaveAuto: c('Your score will be automatically saved after each question.'),
        msgYouScore: c('Your score'),
        msgYouLastScore: c('The last score saved is'),
        msgActityComply: c('You have already done this activity.'),
        msgPlaySeveralTimes: c('You can do this activity as many times as you want'),
        msgScoreScorm: c("The score can't be saved because this page is not part of a SCORM package."),
        msgEndGameScore: c('Please start the game before saving your score.'),
        msgSeveralScore: c('You can save the score as many times as you want'),
        msgOnlySaveScore: c('You can only save the score once!'),
        msgOnlySave: c('You can only save once'),
        msgOnlySaveAuto: c('Your score will be saved after each question. You can only play once.'),
        msgUncompletedActivity: c('Incomplete activity'),
        msgSuccessfulActivity: c('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c('Activity: Not passed. Score: %s'),
        msgTypeGame: c('Interactive video'),
    };
}

export function createInteractiveVideoEditionDevice(): InteractiveVideoEditionDevice {
    const state: EditionState = {
        doc: newDocument(),
        selectedId: null,
        confirmDeleteId: null,
        adapter: null,
        duration: null,
        lastTime: 0,
        durationPending: false,
        bodyEditorId: null,
        ideviceBody: null,
        idevicePath: undefined,
        ci18n: {},
        unsupported: null,
    };
    let editor: Editor = createEditor(state);

    /** Build the working document, migrating legacy shapes once. */
    function hydrate(previousData: unknown): void {
        state.unsupported = null;
        const result = hydrateDocument(previousData);
        if (result.status === 'ok') {
            state.doc = result.document;
            return;
        }
        if (result.status === 'unsupported-version') {
            state.unsupported = { version: result.version, original: result.original };
            state.doc = newDocument();
            return;
        }
        // Invalid stored data: start from an empty document (never throw).
        state.doc = newDocument();
    }

    function alertUser(message: string): void {
        if (typeof eXe !== 'undefined' && eXe?.app?.alert) {
            eXe.app.alert(message);
        }
    }

    function bindEvents(): void {
        $('#ivAddCover').on('click', () => editor.addInteraction('cover'));
        $('#ivAddNote').on('click', () => editor.addInteraction('note'));
        $('#ivAddQuestion').on('click', () => editor.addInteraction('question'));
        $('#ivAddPause').on('click', () => editor.addInteraction('pause'));
        $('#ivAddJump').on('click', () => editor.addInteraction('jump'));
        $('#ivAddCurrentTime').on('click', () => {
            void useCurrentTime(state, 'ivAddTime');
        });
        // Clicking the timeline track (not a marker) places the add-bar time
        // proportionally and seeks the player there.
        $('#ivTimelineTrack').on('click', event => {
            const target = event.target;
            if (target?.closest?.('.exe-iv-edit-marker')) {
                return;
            }
            placeTimeFromTrack(state, event.clientX);
        });
        // Re-derive the provider whenever the single source field changes
        // (typed URL or media-library pick, which fills the field and triggers
        // change): both the subtitles visibility and the preview surface
        // depend on it.
        $('#ivVideoFile').on('change input', () => {
            toggleSource();
            renderInteractionsPlayer(state, editor.refreshMarkers);
        });
        // Add a subtitle track: pick a .vtt/.srt asset from the media library.
        $('#ivAddCaption').on('click', () => {
            const fm =
                typeof eXeLearning !== 'undefined' && eXeLearning?.app?.modals
                    ? eXeLearning.app.modals.filemanager
                    : null;
            if (fm?.show) {
                fm.show({
                    onSelect: result => {
                        addCaption(state, result?.assetUrl || result?.blobUrl || result?.url || '');
                    },
                });
            } else {
                addCaption(state, '');
            }
        });
    }

    function loadValues(): void {
        const doc = state.doc;
        const edition = typeof $exeDevicesEdition !== 'undefined' ? $exeDevicesEdition?.iDevice : null;
        // The single source field holds the stored reference verbatim (URL or
        // library path); the provider is re-detected from it on demand.
        $('#ivVideoFile').val(doc.video.url || '');
        renderCaptions(state);
        $('#ivCompletionMode').val(doc.completion?.mode || 'none');
        $('#ivRequiredScore').val(String(doc.completion?.requiredScore || 80));
        $('#ivShowResults').prop('checked', !(doc.scorm && doc.scorm.showResults === false));
        $('#ivScoreNIA').prop('checked', !!doc.meta?.legacy?.scoreNIA);

        const legacy = doc.meta?.legacy ?? {};
        if (edition?.gamification.scorm.setValues && doc.scorm) {
            edition.gamification.scorm.setValues(
                doc.scorm.enabled ? 1 : 0,
                doc.customTexts?.textButtonScorm || legacy.textButtonScorm,
                doc.scorm.repeatActivity !== false,
                doc.scorm.weight != null ? doc.scorm.weight : 100,
            );
        }
        if (edition?.gamification.progressBar?.setValues) {
            edition.gamification.progressBar.setValues({
                evaluation: legacy.evaluation,
                evaluationID: legacy.evaluationID,
            });
        }
        if (edition?.gamification.common.setLanguageTabValues && doc.customTexts) {
            edition.gamification.common.setLanguageTabValues(doc.customTexts);
        }
    }

    function createForm(): void {
        const edition = typeof $exeDevicesEdition !== 'undefined' ? $exeDevicesEdition?.iDevice : null;
        if (state.unsupported) {
            // Content from a newer eXeLearning: show what happened and refuse
            // to edit — any save from this build would destroy it.
            $(state.ideviceBody as HTMLElement).html(
                '<div id="interactiveVideoIdeviceForm" class="exe-idevice-form">' +
                    '<p class="exe-iv-unsupported-version" role="alert">' +
                    escapeHtml(
                        tr('This interactive video was created with a newer version of eXeLearning.') +
                            ' ' +
                            tr('Update eXeLearning to edit it; its content has been preserved unchanged.'),
                    ) +
                    '</p></div>',
            );
            return;
        }
        const html =
            '<div id="interactiveVideoIdeviceForm" class="exe-idevice-form">' +
            descriptionHtml() +
            tabGeneralSettingsHtml(state) +
            // Tab order matches the sibling quiz iDevices: General settings →
            // SCORM → Custom texts.
            (edition?.gamification.scorm.getTab ? edition.gamification.scorm.getTab() : '') +
            (edition?.gamification.common.getLanguageTab
                ? edition.gamification.common.getLanguageTab(state.ci18n)
                : '') +
            '</div>';
        $(state.ideviceBody as HTMLElement).html(html);

        if (edition?.tabs?.init) {
            edition.tabs.init('interactiveVideoIdeviceForm');
        }
        if (edition?.gamification.scorm.init) {
            edition.gamification.scorm.init();
        }
        if (edition?.gamification.progressBar?.addEvents) {
            edition.gamification.progressBar.addEvents();
        }
        // The workarea auto-wires .exe-file-picker inputs to the File Manager
        // (ideviceNode.legacyExeIdevicesFilePicker), injecting a single
        // "Select a file" button per input — so we must NOT wire them again.
        loadValues();
        bindEvents();
        wireHelp();
        toggleSource();
        editor.renderInteractionList();
        editor.renderDetail();
        editor.refreshMarkers();
        renderInteractionsPlayer(state, editor.refreshMarkers);
    }

    /** Read the whole form back into the document (does not validate). */
    function collect(): InteractiveVideoDocumentV2 {
        const doc = state.doc;

        // Flush the open body editor so its latest content is saved.
        commitBodyEditor(state);

        const url = currentSourceValue();
        if (url) {
            const normalized = normalizeVideoSource(url);
            if (normalized) {
                doc.video.provider = normalized.provider;
                doc.video.url = normalized.url;
                doc.video.videoId = normalized.videoId;
            } else {
                const provider = currentProvider();
                doc.video.provider =
                    provider === null ? 'local' : (provider as InteractiveVideoDocumentV2['video']['provider']);
                doc.video.url = url;
            }
        }
        doc.video.captions = normalizeCaptions(doc.video.captions);

        const completionMode = $('#ivCompletionMode').val();
        doc.completion = {
            mode:
                completionMode === 'watch' || completionMode === 'answerRequired' || completionMode === 'scoreThreshold'
                    ? completionMode
                    : 'none',
            requiredScore: parseInt($('#ivRequiredScore').val() ?? '', 10) || null,
        };

        const edition = typeof $exeDevicesEdition !== 'undefined' ? $exeDevicesEdition?.iDevice : null;
        const scormValues = edition?.gamification.scorm.getValues ? edition.gamification.scorm.getValues() : {};
        doc.scorm = {
            enabled: !!scormValues?.isScorm,
            weight: scormValues?.weighted != null ? scormValues.weighted : 100,
            repeatActivity: scormValues ? scormValues.repeatActivity !== false : true,
            showResults: $('#ivShowResults').is(':checked'),
        };

        const progressValues = edition?.gamification.progressBar?.getValues
            ? edition.gamification.progressBar.getValues()
            : null;
        doc.meta = doc.meta || { legacy: {} };
        doc.meta.legacy = doc.meta.legacy || {};
        doc.meta.legacy.scoreNIA = $('#ivScoreNIA').is(':checked');
        if (progressValues) {
            doc.meta.legacy.evaluation = progressValues.evaluation;
            doc.meta.legacy.evaluationID = progressValues.evaluationID;
        }

        // Custom texts (author overrides for learner strings).
        const customTexts: Record<string, string> = {};
        for (const key of Object.keys(state.ci18n)) {
            const value = $('#ci18n_' + key).val();
            if (value != null && value !== '') {
                customTexts[key] = value;
            }
        }
        if (scormValues?.textButtonScorm) {
            customTexts.textButtonScorm = scormValues.textButtonScorm;
        }
        doc.customTexts = customTexts;

        // Normalize each question so stored data matches its kind (segments
        // for cloze/dropdown, solution for trueFalse, answers for choices).
        for (const interaction of doc.interactions) {
            if (interaction && interaction.type === 'question' && interaction.question) {
                normalizeQuestionForKind(interaction.question);
            }
        }

        doc.interactions = sortInteractions(doc.interactions);
        doc.schemaVersion = SCHEMA_VERSION;
        return doc;
    }

    return {
        i18n: {
            name: typeof _ === 'function' ? _('Interactive video') : 'Interactive video',
        },

        init(element, previousData, path) {
            state.ideviceBody = element;
            state.idevicePath = path;
            state.ci18n = buildCi18n();
            hydrate(previousData);
            state.selectedId = null;
            state.confirmDeleteId = null;
            state.duration = null;
            state.lastTime = 0;
            state.durationPending = false;
            editor = createEditor(state);
            createForm();
        },

        save() {
            if (state.unsupported) {
                // Never overwrite content from a newer schema.
                alertUser(
                    tr(
                        'This interactive video was created with a newer version of eXeLearning and cannot be saved here.',
                    ),
                );
                return false;
            }
            const doc = collect();
            if (!doc.video.url) {
                alertUser(tr('Please set a video source.'));
                return false;
            }
            if (!isSafeVideoUrl(doc.video.url)) {
                alertUser(tr('The video URL is not valid.'));
                return false;
            }
            const questionError = validateQuestions(doc);
            if (questionError) {
                alertUser(questionError);
                return false;
            }
            return doc;
        },
    };
}

export { announce };
