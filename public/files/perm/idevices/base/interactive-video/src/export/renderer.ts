/**
 * Declarative HTML builders for the learner runtime. Everything here returns
 * strings built from the schema-v2 document — script-free, accessible markup
 * that `renderBehaviour` later wires. No instance state enters this module.
 */

import { dropdownOptions, dropdownWordsFromSegments, htmlPromptToSegments } from '../shared/cloze';
import { escapeHtml } from '../shared/html';
import { sortInteractions } from '../shared/scheduling';
import { secondsToHms } from '../shared/time';
import type { Interaction, InteractiveVideoDocumentV2, PromptSegment, Question } from '../shared/types';
import { embedUrl as bundledEmbedUrl, mediatecaStreamUrl as bundledMediatecaUrl } from '../providers/index';
import type { ProviderFactory } from '../providers/types';

/** Translate a GUI string; an author Custom-text (by ci18n key) wins. */
export type Translate = (text: string, key?: string) => string;

export function makeTranslator(customTexts: Record<string, string> | null | undefined): Translate {
    return (text, key) => {
        if (key && customTexts && customTexts[key]) {
            return customTexts[key];
        }
        return typeof window !== 'undefined' && typeof window._ === 'function' ? window._(text) : text;
    };
}

/**
 * The provider factory, resolved THROUGH the window global when one is
 * published so tests can substitute a fake factory before the bundle binds;
 * the bundled implementation is the fallback.
 */
export function resolveProviders(bundled: ProviderFactory | null = null): ProviderFactory | null {
    if (typeof window !== 'undefined') {
        const external = window.exeInteractiveVideoProviders as ProviderFactory | undefined;
        if (external && typeof external.createAdapter === 'function') {
            return external;
        }
    }
    return bundled;
}

/**
 * Canonical, controllable embed URL rebuilt from `{provider, videoId}`. The
 * URL comes from the provider layer (so YouTube carries enablejsapi=1 for
 * postMessage control).
 */
function resolveEmbedUrl(provider: string, videoId: unknown): string {
    const providers = resolveProviders();
    if (providers && typeof providers.embedUrl === 'function') {
        return providers.embedUrl(provider, videoId);
    }
    return bundledEmbedUrl(provider, videoId);
}

/** Derived Mediateca stream URL (native `<video>` source), HTTPS-forced. */
function resolveMediatecaStreamUrl(videoId: unknown): string {
    const providers = resolveProviders();
    if (providers && typeof providers.mediatecaStreamUrl === 'function') {
        return providers.mediatecaStreamUrl(videoId);
    }
    return bundledMediatecaUrl(videoId);
}

/**
 * True only inside the eXeLearning workarea. The preview iframe and the
 * exported page both run this same runtime, and in both of them `eXe` is
 * absent — which is exactly the distinction we want.
 */
export function isAuthoring(): boolean {
    return (
        typeof eXe !== 'undefined' && !!eXe?.app && typeof eXe.app.isInExe === 'function' && eXe.app.isInExe() === true
    );
}

/** Placeholder shown in the always-visible interaction panel when idle. */
export function panelPlaceholderHtml(empty: boolean, t: Translate): string {
    // An activity with no interactions at all says so, instead of promising
    // interactions that will never come. That one IS for the learner.
    if (empty) {
        return (
            '<p class="exe-iv-panel-placeholder">' +
            escapeHtml(t('This video has no interactive elements.', 'noSlides')) +
            '</p>'
        );
    }
    // "Interactions will appear here" is authoring guidance: it tells an
    // author what the empty panel is for. A learner does not need to be told
    // that something might happen later, so in preview and in exported content
    // the idle panel stays quiet — it only keeps its space, so the video does
    // not jump when an interaction arrives.
    if (!isAuthoring()) {
        return '';
    }
    return '<p class="exe-iv-panel-placeholder">' + escapeHtml(t('Interactions will appear here.')) + '</p>';
}

/** The player mount: a native `<video>` for local/Mediateca, an embed otherwise. */
export function renderPlayerHtml(doc: InteractiveVideoDocumentV2, t: Translate): string {
    const esc = escapeHtml;
    const video = doc.video;
    const provider = video.provider || 'local';
    // Local files and Mediateca both play through a native <video> (Mediateca
    // over the derived legacy stream URL), so they share the same declarative
    // markup and the HTML5 adapter (native timeupdate -> scheduler).
    if (provider === 'local' || provider === 'mediateca') {
        const src = provider === 'mediateca' && video.videoId ? resolveMediatecaStreamUrl(video.videoId) : video.url;
        const tracks = (video.captions || [])
            .map(
                caption =>
                    '<track kind="captions" srclang="' +
                    esc(caption.lang) +
                    '" label="' +
                    esc(caption.label) +
                    '" src="' +
                    esc(caption.src) +
                    '"' +
                    (caption.default ? ' default' : '') +
                    '>',
            )
            .join('');
        return (
            '<video class="exe-iv-video" controls preload="metadata" playsinline data-iv-provider="' +
            esc(provider) +
            '">' +
            '<source src="' +
            esc(src) +
            '">' +
            tracks +
            '</video>'
        );
    }
    // External providers: embed inline via the canonical privacy-enhanced URL
    // (YouTube nocookie / Vimeo). No new-window facade for embeddable providers.
    const embed = resolveEmbedUrl(provider, video.videoId);
    if (embed) {
        return (
            '<div class="exe-iv-embed" data-iv-provider="' +
            esc(provider) +
            '">' +
            '<iframe class="exe-iv-embed-frame" src="' +
            esc(embed) +
            // `autoplay` delegates the page's autoplay permission to the
            // cross-origin player. Without it Chromium refuses the adapter's
            // play command: the learner dismisses an interaction, the runtime
            // posts `playVideo`, the player buffers and falls straight back to
            // "unstarted" — so no time events ever arrive and no further
            // interaction can fire. The permission only ever acts on the
            // learner's own gesture (Start / Continue), never on page load.
            '" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" title="' +
            esc(t('Video')) +
            '"></iframe></div>'
        );
    }
    // No inline embed available: a keyboard-accessible external link.
    return (
        '<div class="exe-iv-embed" data-iv-provider="' +
        esc(provider) +
        '"><a class="exe-iv-embed-facade" href="' +
        esc(video.url) +
        '" target="_blank" rel="noopener">' +
        esc(t('Play video')) +
        '</a></div>'
    );
}

/**
 * The collapsed "Results" table: the cover first, then one row per interaction
 * labelled by a timestamp that seeks the video, plus a status column and a
 * Total row. Opt-in via the "Show results" option. Statuses are filled in by
 * the scoring module from the same state the score reporting uses.
 */
export function renderResultsHtml(doc: InteractiveVideoDocumentV2, t: Translate): string {
    if (doc.scorm && doc.scorm.showResults === false) {
        return '';
    }
    const esc = escapeHtml;
    const interactions = sortInteractions(doc.interactions || []);
    const rows = interactions
        .map(interaction => {
            const time =
                interaction.type === 'cover'
                    ? esc(t('Cover', 'cover'))
                    : '<a href="#" class="exe-iv-results-seek" data-iv-seek="' +
                      esc(interaction.time) +
                      '">' +
                      esc(secondsToHms(interaction.time)) +
                      '</a>';
            return (
                '<tr data-iv-result="' +
                esc(interaction.id) +
                '"><td class="exe-iv-results-slide">' +
                time +
                '</td><td class="exe-iv-results-status"><span>-</span></td></tr>'
            );
        })
        .join('');
    return (
        '<div class="exe-iv-results"><details class="exe-iv-results-details">' +
        '<summary class="exe-iv-results-toggle">' +
        esc(t('Results', 'results')) +
        '</summary><table class="exe-iv-results-table"><thead><tr><th>' +
        esc(t('Slide', 'slide')) +
        '</th><th>' +
        esc(t('Score', 'score')) +
        '</th></tr></thead><tbody>' +
        rows +
        '</tbody><tfoot><tr><th class="exe-iv-results-total-label">' +
        esc(t('Total', 'total')) +
        ' <em>(' +
        esc(t('see all the slides and answer all the questions', 'seeAll')) +
        ')</em>' +
        '</th><td class="exe-iv-results-total"><span>-</span></td></tr></tfoot></table></details></div>'
    );
}

/** Build the full declarative content for one iDevice instance. */
export function renderViewHtml(doc: InteractiveVideoDocumentV2, id: string, t: Translate): string {
    const esc = escapeHtml;
    const title = doc.title ? '<h3 class="exe-iv-title">' + esc(doc.title) + '</h3>' : '';
    const description = doc.description ? '<div class="exe-iv-description">' + doc.description + '</div>' : '';
    return (
        '<div class="exe-iv" id="exe-iv-' +
        esc(id) +
        '" data-iv-id="' +
        esc(id) +
        '">' +
        title +
        description +
        // Side-panel layout: the player always sits on the left and the
        // interaction panel always on the right (stacked below on narrow
        // screens). The panel keeps a stable size — it shows a placeholder
        // when no interaction is active, so the video never resizes.
        '<div class="exe-iv-stage">' +
        '<div class="exe-iv-player-wrap">' +
        renderPlayerHtml(doc, t) +
        '</div>' +
        '<div class="exe-iv-overlay" role="region" aria-live="polite" aria-label="' +
        esc(t('Current interaction')) +
        '">' +
        panelPlaceholderHtml(!(doc.interactions || []).length, t) +
        '</div>' +
        '</div>' +
        renderResultsHtml(doc, t) +
        '</div>'
    );
}

// ---------------------------------------------------------------------------
// Interaction bodies
// ---------------------------------------------------------------------------

/** Return a shuffled copy of an array (Fisher-Yates); never mutates input. */
export function shuffle<T>(list: readonly T[]): T[] {
    const arr = Array.isArray(list) ? list.slice() : [];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i] as T;
        arr[i] = arr[j] as T;
        arr[j] = tmp;
    }
    return arr;
}

/** Fisher-Yates index shuffle, guaranteed non-identity for length > 1. */
export function shuffleIndices(n: number): number[] {
    const order: number[] = [];
    for (let i = 0; i < n; i++) {
        order.push(i);
    }
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = order[i] as number;
        order[i] = order[j] as number;
        order[j] = tmp;
    }
    let isIdentity = true;
    for (let i = 0; i < n; i++) {
        if (order[i] !== i) {
            isIdentity = false;
            break;
        }
    }
    if (isIdentity && n > 1) {
        const first = order[0] as number;
        order[0] = order[1] as number;
        order[1] = first;
    }
    return order;
}

/**
 * The canonical HTML-free blank segments for a cloze/dropdown question. v2
 * documents carry `question.segments`; legacy data hydrated at render time may
 * have only an HTML prompt, so segments are derived on demand via the shared
 * DOM-based parser (never a regex).
 */
export function segmentsFor(question: Question | null | undefined): PromptSegment[] {
    if (question && Array.isArray((question as { segments?: unknown }).segments)) {
        return (question as { segments: PromptSegment[] }).segments;
    }
    return htmlPromptToSegments(question ? question.prompt : '');
}

/** Namespace a per-interaction DOM id with the instance id (page-unique ids). */
export function scopeId(ns: string, id: string): string {
    return (ns ? ns + '-' : '') + id;
}

function checkAndFeedbackHtml(t: Translate): string {
    return (
        '<button type="button" class="exe-iv-check">' +
        escapeHtml(t('Check', 'check')) +
        '</button><p class="exe-iv-feedback" role="status" aria-live="polite"></p>'
    );
}

/** Dropdown (fill-the-blank with a `<select>` per blank), rendered from segments. */
function renderDropdown(interaction: Interaction & { type: 'question' }, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const id = scopeId(ns, interaction.id);
    const question = interaction.question;
    const segments = segmentsFor(question);
    const words = dropdownWordsFromSegments(segments);
    const pool = dropdownOptions(words, (question as { additionalWords?: string[] }).additionalWords);
    const shuffled = shuffle(pool);
    let optionHtml = '<option value="">' + esc(t('Choose…')) + '</option>';
    for (const option of shuffled) {
        optionHtml += '<option value="' + esc(option) + '">' + esc(option) + '</option>';
    }
    let promptHtml = '';
    let blankIndex = 0;
    for (const seg of segments) {
        if (seg && seg.t === 'blank') {
            const selectId = id + '-b' + blankIndex;
            promptHtml +=
                '<span class="exe-iv-dropdown-blank"><label class="exe-iv-visually-hidden" for="' +
                esc(selectId) +
                '">' +
                esc(t('Blank') + ' ' + (blankIndex + 1)) +
                '</label><select class="exe-iv-dropdown-select" id="' +
                esc(selectId) +
                '" data-blank="' +
                blankIndex +
                '">' +
                optionHtml +
                '</select></span>';
            blankIndex++;
        } else if (seg) {
            promptHtml += esc(seg.text);
        }
    }
    return (
        '<div class="exe-iv-question exe-iv-question--dropdown" role="group" aria-label="' +
        esc(t('Fill in the blanks')) +
        '"><div class="exe-iv-question-prompt" id="' +
        esc(id) +
        '-prompt">' +
        promptHtml +
        '</div>' +
        checkAndFeedbackHtml(t) +
        '</div>'
    );
}

/** Cloze (fill-in-the-blank with `<input>`s), rendered from segments (escape-only). */
function renderCloze(interaction: Interaction & { type: 'question' }, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const id = scopeId(ns, interaction.id);
    const segments = segmentsFor(interaction.question);
    let promptHtml = '';
    let blankIndex = 0;
    for (const seg of segments) {
        if (seg && seg.t === 'blank') {
            const answers = Array.isArray(seg.answers) ? seg.answers : [];
            let longest = 0;
            for (const answer of answers) {
                longest = Math.max(longest, String(answer == null ? '' : answer).length);
            }
            const size = Math.max(4, Math.min(40, longest + 1));
            promptHtml +=
                '<input type="text" class="exe-iv-cloze-input" id="' +
                esc(id) +
                '-blank-' +
                blankIndex +
                '" data-cloze-index="' +
                blankIndex +
                '" size="' +
                size +
                '" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" aria-label="' +
                esc(t('Blank') + ' ' + (blankIndex + 1)) +
                '">';
            blankIndex++;
        } else if (seg) {
            promptHtml += esc(seg.text);
        }
    }
    return (
        '<div class="exe-iv-question exe-iv-question--cloze" role="group" aria-label="' +
        esc(t('Fill in the blanks')) +
        '"><div class="exe-iv-question-prompt exe-iv-cloze-text" id="' +
        esc(id) +
        '-prompt">' +
        promptHtml +
        '</div>' +
        checkAndFeedbackHtml(t) +
        '</div>'
    );
}

/** Dedicated True/False control: a fixed labelled radio pair (value 1=True, 0=False). */
function renderTrueFalse(interaction: Interaction & { type: 'question' }, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const question = interaction.question;
    const id = scopeId(ns, interaction.id);
    const trueId = id + '-tf-true';
    const falseId = id + '-tf-false';
    return (
        '<div class="exe-iv-question exe-iv-question--truefalse" role="group" aria-labelledby="' +
        esc(id) +
        '-prompt"><div class="exe-iv-question-prompt" id="' +
        esc(id) +
        '-prompt">' +
        esc(question.prompt || '') +
        '</div><div class="exe-iv-options">' +
        '<div class="exe-iv-option"><input type="radio" name="' +
        esc(id) +
        '" id="' +
        esc(trueId) +
        '" value="1"><label for="' +
        esc(trueId) +
        '">' +
        esc(t('True')) +
        '</label></div>' +
        '<div class="exe-iv-option"><input type="radio" name="' +
        esc(id) +
        '" id="' +
        esc(falseId) +
        '" value="0"><label for="' +
        esc(falseId) +
        '">' +
        esc(t('False')) +
        '</label></div></div>' +
        checkAndFeedbackHtml(t) +
        '</div>'
    );
}

/** Match the pairs: one labelled `<select>` per left item (keyboard-first). */
function renderMatchElements(interaction: Interaction & { type: 'question' }, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const id = scopeId(ns, interaction.id);
    const question = interaction.question as { prompt?: string; pairs?: unknown };
    const pairs = Array.isArray(question.pairs) ? question.pairs : [];
    const prompt =
        '<div class="exe-iv-question-prompt" id="' + esc(id) + '-prompt">' + esc(question.prompt || '') + '</div>';
    const rights = pairs.map(pair => (pair && pair[1] != null ? String(pair[1]) : ''));
    const shuffled = shuffle(rights);
    const optionsHtml =
        '<option value="">' +
        esc(t('Choose…')) +
        '</option>' +
        shuffled.map(right => '<option value="' + esc(right) + '">' + esc(right) + '</option>').join('');
    const rows = pairs
        .map((pair, index) => {
            const left = pair && pair[0] != null ? String(pair[0]) : '';
            const selectId = id + '-m' + index;
            return (
                '<li class="exe-iv-match-row"><label class="exe-iv-match-left" for="' +
                esc(selectId) +
                '">' +
                esc(left) +
                '</label><select class="exe-iv-match-select" id="' +
                esc(selectId) +
                '" data-index="' +
                index +
                '">' +
                optionsHtml +
                '</select></li>'
            );
        })
        .join('');
    return (
        '<div class="exe-iv-question exe-iv-question--match" role="group" aria-labelledby="' +
        esc(id) +
        '-prompt">' +
        prompt +
        '<ol class="exe-iv-match-list">' +
        rows +
        '</ol>' +
        checkAndFeedbackHtml(t) +
        '</div>'
    );
}

/** Sortable list: Move up / Move down buttons (keyboard-first, no drag). */
function renderSortableList(interaction: Interaction & { type: 'question' }, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const question = interaction.question as { prompt?: string; items?: unknown };
    const items = Array.isArray(question.items) ? question.items : [];
    const id = scopeId(ns, interaction.id);
    const prompt =
        '<div class="exe-iv-question-prompt" id="' + esc(id) + '-prompt">' + esc(question.prompt || '') + '</div>';
    const order = shuffleIndices(items.length);
    const rows = order
        .map((originalIndex, displayPos) => {
            const label = esc(items[originalIndex]);
            const upDisabled = displayPos === 0 ? ' disabled' : '';
            const downDisabled = displayPos === order.length - 1 ? ' disabled' : '';
            return (
                '<li class="exe-iv-sortable-item" data-iv-index="' +
                originalIndex +
                '"><span class="exe-iv-sortable-label" id="' +
                esc(id) +
                '-si-' +
                originalIndex +
                '">' +
                label +
                '</span><span class="exe-iv-sortable-controls">' +
                '<button type="button" class="exe-iv-sort-btn exe-iv-sort-up" data-iv-move="up"' +
                upDisabled +
                ' aria-label="' +
                esc(t('Move up', 'up') + ': ' + items[originalIndex]) +
                '"><span aria-hidden="true">▲</span></button>' +
                '<button type="button" class="exe-iv-sort-btn exe-iv-sort-down" data-iv-move="down"' +
                downDisabled +
                ' aria-label="' +
                esc(t('Move down', 'down') + ': ' + items[originalIndex]) +
                '"><span aria-hidden="true">▼</span></button></span></li>'
            );
        })
        .join('');
    return (
        '<div class="exe-iv-question exe-iv-sortable" role="group" aria-labelledby="' +
        esc(id) +
        '-prompt">' +
        prompt +
        '<p class="exe-iv-sortable-instructions" id="' +
        esc(id) +
        '-inst">' +
        esc(
            t(
                'Use the Move up and Move down buttons to put the items in the correct order.',
                'sortableListInstructions',
            ),
        ) +
        '</p><ol class="exe-iv-sortable-list" aria-describedby="' +
        esc(id) +
        '-inst">' +
        rows +
        '</ol><p class="exe-iv-sortable-status exe-visually-hidden" role="status" aria-live="polite"></p>' +
        checkAndFeedbackHtml(t) +
        '</div>'
    );
}

/** Accessible question form (radiogroup / checkboxes) with a Check button. */
export function renderQuestionHtml(interaction: Interaction & { type: 'question' }, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const question = interaction.question;
    const kind = question.kind;
    if (kind === 'dropdown') {
        return renderDropdown(interaction, ns, t);
    }
    if (kind === 'cloze') {
        return renderCloze(interaction, ns, t);
    }
    if (kind === 'matchElements') {
        return renderMatchElements(interaction, ns, t);
    }
    if (kind === 'sortableList') {
        return renderSortableList(interaction, ns, t);
    }
    if (kind === 'trueFalse') {
        return renderTrueFalse(interaction, ns, t);
    }
    const id = scopeId(ns, interaction.id);
    // Choice prompts are escaped at the prompt site (no raw author HTML).
    const prompt =
        '<div class="exe-iv-question-prompt" id="' + esc(id) + '-prompt">' + esc(question.prompt || '') + '</div>';
    const answers = Array.isArray((question as { answers?: unknown }).answers)
        ? (question as { answers: unknown[] }).answers
        : [];
    const inputType = kind === 'multipleChoice' ? 'checkbox' : 'radio';
    const options = answers
        .map((answer, index) => {
            const optionId = id + '-a' + index;
            const label = Array.isArray(answer) ? answer[0] : '';
            return (
                '<div class="exe-iv-option"><input type="' +
                inputType +
                '" name="' +
                esc(id) +
                '" id="' +
                esc(optionId) +
                '" value="' +
                index +
                '"><label for="' +
                esc(optionId) +
                '">' +
                esc(label) +
                '</label></div>'
            );
        })
        .join('');
    return (
        '<div class="exe-iv-question" role="group" aria-labelledby="' +
        esc(id) +
        '-prompt">' +
        prompt +
        '<div class="exe-iv-options">' +
        options +
        '</div>' +
        checkAndFeedbackHtml(t) +
        '</div>'
    );
}

/**
 * Declarative, accessible HTML for one interaction's body. Matches the legacy
 * layout: just the content — no "Note/Question" type heading. A Continue
 * button is shown only when the interaction waits for the learner: notes/
 * pauses with no auto-resume duration; a timed note plays through and
 * auto-dismisses, so it has no button. `ns` (the instance id) namespaces the
 * question controls' ids so multiple videos can share a page.
 */
export function renderInteractionBodyHtml(interaction: Interaction, ns: string, t: Translate): string {
    const esc = escapeHtml;
    const timed = !!interaction.duration && isFinite(interaction.duration) && interaction.duration > 0;
    const continueBtn = '<button type="button" class="exe-iv-continue">' + esc(t('Continue', 'goOn')) + '</button>';
    switch (interaction.type) {
        case 'cover': {
            // The cover is the opener: its own title (the legacy opener had
            // one), the content, and a Start affordance.
            const coverTitle = interaction.title
                ? '<h3 class="exe-iv-cover-title">' + esc(interaction.title) + '</h3>'
                : '';
            return (
                coverTitle +
                '<div class="exe-iv-cover-body">' +
                (interaction.body || '') +
                '</div>' +
                '<button type="button" class="exe-iv-continue">' +
                esc(t('Start', 'start')) +
                '</button>'
            );
        }
        case 'note': {
            const media = interaction.asset
                ? '<img class="exe-iv-note-image" src="' +
                  esc(interaction.asset.url) +
                  '" alt="' +
                  esc(interaction.asset.alt) +
                  '">'
                : '';
            return (
                '<div class="exe-iv-note-body">' +
                (interaction.body || '') +
                media +
                '</div>' +
                (timed ? '' : continueBtn)
            );
        }
        case 'pause':
            return '<div class="exe-iv-pause-body">' + (interaction.body || '') + '</div>' + (timed ? '' : continueBtn);
        case 'question':
            return renderQuestionHtml(interaction, ns, t);
        case 'jump':
        case 'unsupported':
            // Preserve but do not lose; offer a way to continue.
            return (
                '<p class="exe-iv-unsupported">' +
                esc(t('This interaction type is not supported in this view.')) +
                '</p>' +
                continueBtn
            );
        default: {
            const exhaustive: never = interaction;
            void exhaustive;
            return continueBtn;
        }
    }
}
