import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EditionHarness } from '../test/helpers';
import {
    alertHistory,
    clearAlerts,
    clickAt,
    installEditionHarness,
    installFakeProviders,
    precedes,
    stubTrackRect,
    tabTitles,
    withoutGlobal,
    withoutGlobals,
} from '../test/helpers';
import type { CoverInteraction, InteractiveVideoDocumentV2, QuestionInteraction } from '../shared/types';
import type { InteractiveVideoEditionDevice } from './device';
import { createInteractiveVideoEditionDevice } from './device';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIMEO_URL = 'https://vimeo.com/76979871';

/** A legacy htmlView island: the video link plus the slides JSON. */
function legacyIsland(url: string, contents?: unknown): string {
    const json = contents === undefined ? '' : JSON.stringify(contents);
    return (
        '<div class="exe-interactive-video"><p id="exe-interactive-video-file">' +
        '<a href="' +
        url +
        '">v</a></p>' +
        (json
            ? '<script id="exe-interactive-video-contents" type="application/json">' + json + '</script>'
            : '<script id="exe-interactive-video-contents" type="application/json"></script>') +
        '</div>'
    );
}

/** A minimal stored schema-v2 document. */
function v2Document(overrides: Partial<InteractiveVideoDocumentV2> = {}): Record<string, unknown> {
    return {
        schemaVersion: 2,
        video: { provider: 'local', url: 'resources/clip.mp4' },
        interactions: [],
        ...overrides,
    };
}

/** Replace the File Manager modal for one test; returns the undo function. */
function installFileManager(result: { assetUrl?: string; blobUrl?: string; url?: string } | null): () => void {
    const holder = globalThis as unknown as { eXeLearning?: Record<string, unknown> };
    const app = holder.eXeLearning;
    if (!app) {
        return () => {};
    }
    const previous = app.app;
    const had = 'app' in app;
    app.app = {
        modals: {
            filemanager: {
                show: (options: { onSelect: (picked: typeof result) => void }) => options.onSelect(result),
            },
        },
    };
    return () => {
        if (had) {
            app.app = previous;
        } else {
            delete app.app;
        }
    };
}

describe('the Interactive Video edition device', () => {
    let harness: EditionHarness;
    let device: InteractiveVideoEditionDevice;
    let element: HTMLElement;

    beforeEach(() => {
        harness = installEditionHarness();
        // Keep the inline player deterministic: no real provider adapters.
        installFakeProviders();
        device = createInteractiveVideoEditionDevice();
        element = document.createElement('div');
        element.setAttribute('idevice-id', 'iv1');
        document.body.appendChild(element);
    });

    afterEach(() => {
        harness.restore();
    });

    /** save(), asserting it did not refuse (and narrowing the type). */
    function saved(): InteractiveVideoDocumentV2 {
        const doc = device.save();
        if (doc === false) {
            throw new Error('save() refused the document: ' + alertHistory().join(' | '));
        }
        return doc;
    }

    function setSource(url: string): void {
        $('#ivVideoFile').val(url).trigger('change');
    }

    describe('the form it builds', () => {
        beforeEach(() => {
            device.init(element, null, '/path/');
        });

        it('renders exactly three tabs: General settings, SCORM, Custom texts', () => {
            expect(document.getElementById('interactiveVideoIdeviceForm')).not.toBeNull();
            expect(tabTitles()).toEqual(['General settings', 'SCORM', 'Custom texts']);
            for (const title of ['Video', 'Interactions', 'Behaviour and scoring', 'Preview']) {
                expect(tabTitles()).not.toContain(title);
            }
            expect(harness.stubs.getLanguageTab).toHaveBeenCalled();
            expect(harness.stubs.scormGetTab).toHaveBeenCalled();
            // No detached editor.
            expect(document.querySelector('.modal-fullscreen')).toBeNull();
        });

        it('renders the iDevice description banner above the first tab', () => {
            const banner = document.querySelector('#interactiveVideoIdeviceForm .alert.alert-info');
            expect(banner).not.toBeNull();
            expect(precedes(banner, document.querySelector('.exe-form-tab'))).toBe(true);
        });

        it('wires the shared tab, SCORM and progress-report helpers', () => {
            expect(harness.stubs.tabsInit).toHaveBeenCalledWith('interactiveVideoIdeviceForm');
            expect(harness.stubs.scormInit).toHaveBeenCalled();
            expect(harness.stubs.progressAddEvents).toHaveBeenCalled();
        });

        it('offers no Content before/after fields (sibling Text iDevices own that role)', () => {
            expect(document.getElementById('eXeIdeviceTextBefore')).toBeNull();
            expect(document.getElementById('eXeIdeviceTextAfter')).toBeNull();
        });

        it('hands the full learner-string set to the Custom texts tab', () => {
            const ci18n = harness.values.languageTabArgs[0] as Record<string, string>;
            expect(Object.keys(ci18n).length).toBeGreaterThan(30);
            expect(ci18n.goOn).toBeDefined();
            expect(ci18n.right).toBeDefined();
            expect(ci18n.msgYouScore).toBeDefined();
        });

        it('shows help hints that reveal on click', () => {
            const help = document.querySelector('#interactiveVideoIdeviceForm .exe-form-help');
            const content = help?.querySelector('.help-content');
            expect(content?.classList.contains('help-hidden')).toBe(true);
            (help?.querySelector('.form-help-exe-icon') as HTMLElement).click();
            expect(content?.classList.contains('help-hidden')).toBe(false);
        });

        it('starts from an empty document when there is no previous data', () => {
            expect(document.querySelector('#ivInteractionList .exe-iv-empty')).not.toBeNull();
            expect($('#ivVideoFile').val()).toBe('');
            expect(document.getElementById('ivInteractionsCount')?.textContent).toBe('');
        });

        it('names itself through the workarea i18n', () => {
            expect(device.i18n.name).toBe('Interactive video');
        });
    });

    describe('outside the workarea', () => {
        it('still builds a usable editor without the shared edition helpers', () => {
            withoutGlobal('$exeDevicesEdition', () => {
                const bare = createInteractiveVideoEditionDevice();
                bare.init(element, null, '/path/');
                // The authoring surface is there; only the shared tabs are missing.
                expect(document.getElementById('ivVideoFile')).not.toBeNull();
                expect(document.getElementById('ivInteractionList')).not.toBeNull();
                expect(document.getElementById('eXeIdeviceTextBefore')).toBeNull();
                expect(tabTitles()).toEqual(['General settings']);
                $('#ivVideoFile').val(YOUTUBE_URL);
                const doc = bare.save();
                expect(doc).not.toBe(false);
                expect((doc as InteractiveVideoDocumentV2).scorm).toMatchObject({ enabled: false, weight: 100 });
            });
        });

        it('falls back to the source strings when no translator is on the page', () => {
            withoutGlobals(['_', 'c_'], () => {
                const untranslated = createInteractiveVideoEditionDevice();
                expect(untranslated.i18n.name).toBe('Interactive video');
                untranslated.init(element, null, '/path/');
                expect(harness.values.languageTabArgs.pop()?.goOn).toBe('Continue');
            });
        });
    });

    describe('hydrating the stored document', () => {
        it('reopens a schema-v2 document as it was saved', () => {
            device.init(
                element,
                v2Document({
                    interactions: [{ id: 'iv-0', type: 'note', time: 4, body: '<p>x</p>' }],
                } as unknown as Partial<InteractiveVideoDocumentV2>),
                '/path/',
            );
            expect($('#ivVideoFile').val()).toBe('resources/clip.mp4');
            expect(document.querySelectorAll('#ivInteractionList li[data-id]').length).toBe(1);
            const doc = saved();
            expect(doc.schemaVersion).toBe(2);
            expect(doc.interactions).toHaveLength(1);
            expect(doc.video.url).toBe('resources/clip.mp4');
        });

        it('reopens a stored remote source and a stored library file verbatim', () => {
            device.init(
                element,
                v2Document({ video: { provider: 'youtube', url: YOUTUBE_URL, videoId: 'dQw4w9WgXcQ' } } as never),
                '/path/',
            );
            expect($('#ivVideoFile').val()).toBe(YOUTUBE_URL);

            device.init(
                element,
                v2Document({ video: { provider: 'local', url: 'asset://abc/clip.mp4' } } as never),
                '/path/',
            );
            expect($('#ivVideoFile').val()).toBe('asset://abc/clip.mp4');
        });

        it('recovers a legacy island passed as a raw string', () => {
            device.init(element, legacyIsland(YOUTUBE_URL), '/path/');
            expect($('#ivVideoFile').val()).toBe(YOUTUBE_URL);
            expect(saved().video.provider).toBe('youtube');
        });

        it('recovers a legacy island stored in textTextarea, migrating the slides', () => {
            device.init(
                element,
                {
                    textTextarea: legacyIsland(YOUTUBE_URL, {
                        slides: [{ type: 'text', text: '<p>hi</p>', startTime: 2 }],
                    }),
                },
                '/path/',
            );
            const doc = saved();
            expect(doc.video.provider).toBe('youtube');
            expect(doc.interactions).toHaveLength(1);
            expect(doc.interactions[0]).toMatchObject({ type: 'note', time: 2 });
        });

        it('recovers a legacy island stored in htmlView', () => {
            device.init(element, { htmlView: legacyIsland(VIMEO_URL) }, '/path/');
            expect(saved().video.provider).toBe('vimeo');
        });

        it('recovers the legacy video URL when opened from a {slides, htmlView} object (#2147)', () => {
            // The workarea hands the editor pre-migration jsonProperties augmented
            // with the preserved legacy island (slides in jsonProperties, URL only
            // in the island).
            const island = legacyIsland('https://www.youtube.com/watch?v=uGNFMMn-U8M', {
                slides: [{ type: 'text', text: '<p>Body</p>', startTime: 5, title: 'Note' }],
            });
            device.init(element, { slides: [{ type: 'text', startTime: 5 }], htmlView: island }, '/path/');
            const doc = saved();
            expect(doc.video.provider).toBe('youtube');
            expect(doc.video.videoId).toBe('uGNFMMn-U8M');
            expect(doc.interactions).toHaveLength(1);
        });

        it('falls back to an empty document for input it cannot make sense of', () => {
            for (const previousData of [42, true, 'not an island']) {
                device.init(element, previousData, '/path/');
                expect(document.querySelector('#ivInteractionList .exe-iv-empty')).not.toBeNull();
                expect($('#ivVideoFile').val()).toBe('');
            }
        });

        it('reopens the stored behaviour, SCORM and custom-text values', () => {
            device.init(
                element,
                v2Document({
                    completion: { mode: 'scoreThreshold', requiredScore: 65 },
                    scorm: { enabled: true, weight: 50, repeatActivity: false, showResults: false },
                    customTexts: { check: 'Verify', textButtonScorm: 'Guardar' },
                    meta: { legacy: { scoreNIA: true, evaluation: true, evaluationID: 'ABC12' } },
                } as never),
                '/path/',
            );
            expect($('#ivCompletionMode').val()).toBe('scoreThreshold');
            expect($('#ivRequiredScore').val()).toBe('65');
            expect($('#ivShowResults').is(':checked')).toBe(false);
            expect($('#ivScoreNIA').is(':checked')).toBe(true);
            expect(harness.stubs.scormSetValues).toHaveBeenCalledWith(1, 'Guardar', false, 50);
            expect(harness.stubs.progressSetValues).toHaveBeenCalledWith({ evaluation: true, evaluationID: 'ABC12' });
            expect(harness.stubs.setLanguageTabValues).toHaveBeenCalledWith({
                check: 'Verify',
                textButtonScorm: 'Guardar',
            });
        });

        it('reopens the stored subtitle tracks', () => {
            device.init(
                element,
                v2Document({
                    video: {
                        provider: 'local',
                        url: 'resources/clip.mp4',
                        captions: [{ src: 'resources/es.vtt', lang: 'es', label: 'Español', default: true }],
                    },
                } as never),
                '/path/',
            );
            expect(document.querySelectorAll('#ivCaptions .exe-iv-caption-row').length).toBe(1);
            expect(document.querySelector('#ivCaptions .exe-iv-caption-file')?.textContent).toBe('es.vtt');
        });
    });

    describe('content from a newer eXeLearning', () => {
        const newer = { schemaVersion: 99, video: { provider: 'youtube', url: YOUTUBE_URL }, interactions: [{}] };

        it('explains the situation instead of rendering an editor', () => {
            device.init(element, newer, '/path/');
            const warning = document.querySelector('.exe-iv-unsupported-version');
            expect(warning).not.toBeNull();
            expect(warning?.getAttribute('role')).toBe('alert');
            expect(warning?.textContent).toContain('newer version of eXeLearning');
            // None of the authoring form is rendered, so nothing can be edited.
            expect(document.getElementById('ivVideoFile')).toBeNull();
            expect(document.getElementById('ivInteractionList')).toBeNull();
            expect(tabTitles()).toEqual([]);
        });

        it('refuses to save so the content is never overwritten', () => {
            device.init(element, newer, '/path/');
            clearAlerts();
            expect(device.save()).toBe(false);
            expect(alertHistory().join(' ')).toContain('cannot be saved here');
        });

        it('also detects a newer schema inside a legacy island', () => {
            device.init(element, { htmlView: legacyIsland(YOUTUBE_URL, { schemaVersion: 42 }) }, '/path/');
            expect(document.querySelector('.exe-iv-unsupported-version')).not.toBeNull();
            expect(device.save()).toBe(false);
        });

        it('returns to a normal editor when reopened with supported content', () => {
            device.init(element, newer, '/path/');
            device.init(element, v2Document(), '/path/');
            expect(document.querySelector('.exe-iv-unsupported-version')).toBeNull();
            expect(document.getElementById('ivVideoFile')).not.toBeNull();
            expect(saved().video.url).toBe('resources/clip.mp4');
        });
    });

    describe('save', () => {
        beforeEach(() => {
            device.init(element, null, '/path/');
        });

        it('refuses to save without a video source', () => {
            clearAlerts();
            expect(device.save()).toBe(false);
            expect(alertHistory().join(' ')).toContain('video source');
        });

        it('refuses a source whose scheme could execute script', () => {
            $('#ivVideoFile').val('javascript:alert(1)');
            clearAlerts();
            expect(device.save()).toBe(false);
            expect(alertHistory().join(' ')).toContain('not valid');
        });

        it('saves a versioned document with the video and SCORM (no before/after fields)', () => {
            setSource(YOUTUBE_URL);
            const doc = saved();
            expect(doc.schemaVersion).toBe(2);
            expect(doc.video).toMatchObject({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            expect('contentBefore' in doc).toBe(false);
            expect('contentAfter' in doc).toBe(false);
            expect(doc.scorm).toMatchObject({ enabled: false, weight: 100, repeatActivity: true, showResults: true });
        });

        it('keeps a media-library reference verbatim', () => {
            setSource('asset://abc/clip.mp4');
            const doc = saved();
            expect(doc.video).toMatchObject({ provider: 'local', url: 'asset://abc/clip.mp4' });
        });

        it('persists every behaviour field now that they live in General settings', () => {
            setSource(YOUTUBE_URL);
            $('#ivCompletionMode').val('scoreThreshold');
            $('#ivRequiredScore').val('65');
            $('#ivShowResults').prop('checked', false);
            $('#ivScoreNIA').prop('checked', true);
            const doc = saved();
            expect(doc.completion).toMatchObject({ mode: 'scoreThreshold', requiredScore: 65 });
            expect(doc.scorm.showResults).toBe(false);
            expect(doc.meta.legacy.scoreNIA).toBe(true);
            // The poster option is gone; the cover interaction replaced it.
            expect(doc.video).not.toHaveProperty('posterAssetId');
        });

        it('falls back to sane values for an unknown completion mode or a blank score', () => {
            setSource(YOUTUBE_URL);
            $('#ivCompletionMode').val('nonsense');
            $('#ivRequiredScore').val('');
            const doc = saved();
            expect(doc.completion).toEqual({ mode: 'none', requiredScore: null });
        });

        it('takes the SCORM and progress-report values from the shared tabs', () => {
            setSource(YOUTUBE_URL);
            harness.values.scorm = { isScorm: 1, textButtonScorm: 'Guardar', repeatActivity: false, weighted: 50 };
            harness.values.progress = { evaluation: true, evaluationID: 'ABC12' };
            const doc = saved();
            expect(doc.scorm).toMatchObject({ enabled: true, weight: 50, repeatActivity: false });
            expect(doc.customTexts.textButtonScorm).toBe('Guardar');
            expect(doc.meta.legacy).toMatchObject({ evaluation: true, evaluationID: 'ABC12' });
        });

        it('survives shared tabs that report nothing', () => {
            setSource(YOUTUBE_URL);
            harness.values.progress = null;
            harness.stubs.scormGetValues.mockReturnValue(null);
            const doc = saved();
            expect(doc.scorm).toMatchObject({ enabled: false, weight: 100, repeatActivity: true });
            expect(doc.meta.legacy).not.toHaveProperty('evaluation');
        });

        it('saves custom-text overrides into doc.customTexts', () => {
            setSource(YOUTUBE_URL);
            $('#ci18n_check').val('Verify');
            expect(saved().customTexts.check).toBe('Verify');
        });

        it('drops a subtitle row that never got a file', () => {
            expect(document.querySelector('.exe-iv-captions-section')).not.toBeNull();
            setSource('resources/clip.mp4');
            // No File Manager on the page, so the row is added with no source.
            document.getElementById('ivAddCaption')?.click();
            $('#ivCaptions .exe-iv-caption-lang').val('es').trigger('input');
            expect(saved().video.captions).toHaveLength(0);
        });

        it('saves a picked subtitle track with its language, label and default flag', () => {
            const restore = installFileManager({ assetUrl: 'resources/es.vtt' });
            try {
                setSource('resources/clip.mp4');
                document.getElementById('ivAddCaption')?.click();
                $('#ivCaptions .exe-iv-caption-lang').val('es').trigger('input');
                $('#ivCaptions .exe-iv-caption-label').val('Español').trigger('input');
                const doc = saved();
                expect(doc.video.captions).toHaveLength(1);
                expect(doc.video.captions[0]).toMatchObject({
                    src: 'resources/es.vtt',
                    lang: 'es',
                    label: 'Español',
                    default: true,
                });
            } finally {
                restore();
            }
        });

        it('normalizes each question to its kind before storing it', () => {
            setSource(YOUTUBE_URL);
            document.getElementById('ivAddQuestion')?.click();
            $('#ivQuestionKind').val('trueFalse').trigger('change');
            $('#ivQuestionPrompt').val('The sky is green').trigger('input');
            const falseRadio = document.querySelector<HTMLInputElement>('.exe-iv-tf-correct[value="0"]');
            falseRadio!.checked = true;
            $(falseRadio!).trigger('change');
            const doc = saved();
            const question = (doc.interactions[0] as QuestionInteraction).question as Record<string, unknown>;
            expect(question.kind).toBe('trueFalse');
            // The authored solution survives the save; the choice answers are dropped.
            expect(question.solution).toBe(0);
            expect(question).not.toHaveProperty('answers');
        });

        it('stores cloze blanks as segments', () => {
            setSource(YOUTUBE_URL);
            document.getElementById('ivAddQuestion')?.click();
            $('#ivQuestionKind').val('cloze').trigger('change');
            $('#ivQuestionPrompt').val('el caballo [[blanco]]').trigger('input');
            const doc = saved();
            const question = (doc.interactions[0] as QuestionInteraction).question as {
                segments: Array<{ t: string }>;
            };
            expect(question.segments.filter(segment => segment.t === 'blank')).toHaveLength(1);
        });

        it('refuses to save a question that is not finished', () => {
            setSource(YOUTUBE_URL);
            document.getElementById('ivAddQuestion')?.click();
            $('#ivQuestionPrompt').val('Pick one').trigger('input');
            // A brand-new single choice has two EMPTY answers, so it cannot pass.
            clearAlerts();
            expect(device.save()).toBe(false);
            expect(alertHistory().join(' ')).toContain('at least two answers');
        });

        it('accepts the question once it is complete', () => {
            setSource(YOUTUBE_URL);
            document.getElementById('ivAddQuestion')?.click();
            $('#ivQuestionPrompt').val('Pick one').trigger('input');
            const answers = document.querySelectorAll<HTMLInputElement>('#ivAnswers .exe-iv-answer-text');
            $(answers[0]!).val('A').trigger('input');
            $(answers[1]!).val('B').trigger('input');
            const doc = saved();
            expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({ kind: 'singleChoice' });
        });

        it('sorts the interactions, cover first, before storing them', () => {
            setSource(YOUTUBE_URL);
            $('#ivAddTime').val('00:30');
            document.getElementById('ivAddNote')?.click();
            $('#ivAddTime').val('00:10');
            document.getElementById('ivAddPause')?.click();
            document.getElementById('ivAddCover')?.click();
            const doc = saved();
            expect(doc.interactions.map(interaction => interaction.type)).toEqual(['cover', 'pause', 'note']);
            expect((doc.interactions[0] as CoverInteraction).time).toBe(0);
        });

        it('flushes the open body editor into the document', () => {
            setSource(YOUTUBE_URL);
            document.getElementById('ivAddNote')?.click();
            (tinymce?.get?.('ivDetailBody') as unknown as { setContent(html: string): void } | null)?.setContent(
                '<p>Unsaved body</p>',
            );
            const doc = saved();
            expect(doc.interactions[0]).toMatchObject({ type: 'note' });
            expect((doc.interactions[0] as { body: string }).body).toContain('Unsaved body');
        });
    });

    describe('the wiring between the form and the editor', () => {
        beforeEach(() => {
            device.init(element, null, '/path/');
        });

        it('adds an interaction of each kind from the add bar', () => {
            for (const id of ['ivAddNote', 'ivAddQuestion', 'ivAddPause', 'ivAddJump', 'ivAddCover']) {
                document.getElementById(id)?.click();
            }
            expect(document.querySelectorAll('#ivInteractionList li[data-id]').length).toBe(5);
            expect(document.getElementById('ivInteractionsCount')?.textContent).toBe('5 interactions');
        });

        it('renders the inline player and the subtitles only for native sources', () => {
            const section = document.querySelector<HTMLElement>('.exe-iv-captions-section');
            expect(document.getElementById('ivInteractionsPlayer')).not.toBeNull();
            setSource('resources/clip.mp4');
            expect(document.getElementById('ivEditPlayerVideo')?.getAttribute('src')).toBe('resources/clip.mp4');
            expect(section?.style.display).not.toBe('none');
            setSource(YOUTUBE_URL);
            expect(document.getElementById('ivEditPlayerVideo')).toBeNull();
            expect(document.getElementById('ivEditPlayerFrame')).not.toBeNull();
            expect(section?.style.display).toBe('none');
        });

        it('never silently no-ops "Use current time"', () => {
            $('#ivAddTime').val('00:00');
            document.getElementById('ivAddCurrentTime')?.click();
            expect($('#ivAddTime').val()).toBe('00:00');
            expect(document.getElementById('ivEditorLive')?.textContent?.length).toBeGreaterThan(0);
        });

        it('places the add-bar time when the timeline track is clicked', () => {
            setSource('resources/clip.mp4');
            $('#ivAddTime').val('00:19');
            document.getElementById('ivAddNote')?.click();
            // No duration is known, so the fallback scale spreads the markers.
            const track = stubTrackRect(100) as HTMLElement;
            clickAt(track, 50);
            expect($('#ivAddTime').val()).toBe('00:10');
        });

        it('selects a marker instead of placing a time when the marker is clicked', () => {
            setSource('resources/clip.mp4');
            $('#ivAddTime').val('00:19');
            document.getElementById('ivAddNote')?.click();
            const id = document.querySelector('#ivInteractionList li[data-id]')?.getAttribute('data-id');
            document.querySelector<HTMLButtonElement>(`li[data-id="${id}"] .exe-iv-edit-select`)?.click();
            $('#ivAddTime').val('00:07');
            stubTrackRect(100);
            const marker = document.querySelector<HTMLElement>(`#ivEditTimeline button[data-iv-id="${id}"]`);
            clickAt(marker as HTMLElement, 99);
            expect($('#ivAddTime').val()).toBe('00:07');
            expect(
                document.querySelector(`li[data-id="${id}"] .exe-iv-edit-select`)?.getAttribute('aria-expanded'),
            ).toBe('true');
        });

        it('adds a subtitle row through the File Manager, or an empty one without it', () => {
            const restore = installFileManager({ url: 'resources/en.vtt' });
            try {
                document.getElementById('ivAddCaption')?.click();
                expect(document.querySelector('#ivCaptions .exe-iv-caption-file')?.textContent).toBe('en.vtt');
            } finally {
                restore();
            }
            // With no File Manager on the page the row is added empty.
            document.getElementById('ivAddCaption')?.click();
            expect(document.querySelectorAll('#ivCaptions .exe-iv-caption-row').length).toBe(2);
            expect(document.querySelectorAll('#ivCaptions .exe-iv-caption-file')[1]?.textContent).toBe('(no file)');
        });
    });
});
