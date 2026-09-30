import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EditionHarness } from '../test/helpers';
import { installEditionHarness, makeState, mountForm, precedes } from '../test/helpers';
import type { EditionState } from './state';
import {
    addCaption,
    captionFileName,
    descriptionHtml,
    helpHtml,
    legendHtml,
    renderCaptions,
    typeLabel,
    wireHelp,
} from './form';

describe('typeLabel', () => {
    it('labels every interaction kind, falling back for unknown types', () => {
        expect(typeLabel('cover')).toBe('Cover');
        expect(typeLabel('note')).toBe('Note');
        expect(typeLabel('question')).toBe('Question');
        expect(typeLabel('pause')).toBe('Pause');
        expect(typeLabel('jump')).toBe('Jump');
        expect(typeLabel('unsupported')).toBe('Interaction');
    });
});

describe('captionFileName', () => {
    it('shows the last path segment, without query or fragment', () => {
        expect(captionFileName('resources/subs/es.vtt')).toBe('es.vtt');
        expect(captionFileName('asset://uuid/es.vtt?v=2')).toBe('es.vtt');
        expect(captionFileName('https://example.com/a/b.srt#t')).toBe('b.srt');
        expect(captionFileName('es.vtt')).toBe('es.vtt');
    });

    it('returns an empty name for a missing source', () => {
        expect(captionFileName(undefined)).toBe('');
        expect(captionFileName('')).toBe('');
    });
});

describe('helpHtml', () => {
    it('escapes the hint text and starts hidden', () => {
        const html = helpHtml('Use <b>this</b>');
        expect(html).toContain('help-hidden');
        expect(html).toContain('Use &lt;b&gt;this&lt;/b&gt;');
        expect(html).not.toContain('<b>');
    });
});

describe('legendHtml', () => {
    it('lists the five kinds in colour order', () => {
        document.body.innerHTML = legendHtml();
        const swatches = document.querySelectorAll('.exe-iv-legend .exe-iv-legend-swatch');
        expect(swatches.length).toBe(5);
        expect(Array.from(swatches).map(s => s.className)).toEqual([
            'exe-iv-legend-swatch exe-iv-kind--cover',
            'exe-iv-legend-swatch exe-iv-kind--note',
            'exe-iv-legend-swatch exe-iv-kind--question',
            'exe-iv-legend-swatch exe-iv-kind--pause',
            'exe-iv-legend-swatch exe-iv-kind--jump',
        ]);
    });
});

describe('the General settings markup', () => {
    let harness: EditionHarness;
    let state: EditionState;

    beforeEach(() => {
        harness = installEditionHarness();
        state = makeState();
        mountForm(state);
    });

    afterEach(() => {
        harness.restore();
    });

    it('orders the tab: Options fieldset → Video source → Interactions list', () => {
        const options = document.getElementById('ivCompletionMode');
        const video = document.getElementById('ivVideoFile');
        const interactions = document.getElementById('ivInteractionList');
        expect(options).not.toBeNull();
        expect(video).not.toBeNull();
        expect(interactions).not.toBeNull();
        expect(precedes(options, video)).toBe(true);
        expect(precedes(video, interactions)).toBe(true);
    });

    it('keeps the Video source and the Interactions authoring in the SAME fieldset', () => {
        const sourceFieldset = document.getElementById('ivVideoFile')?.closest('fieldset');
        const interactionsFieldset = document.getElementById('ivInteractionList')?.closest('fieldset');
        expect(sourceFieldset).not.toBeNull();
        expect(interactionsFieldset).toBe(sourceFieldset);
        // The Interactions block keeps its titled sub-heading + live count.
        expect(sourceFieldset?.querySelector('.exe-iv-section-title')).not.toBeNull();
        expect(document.getElementById('ivInteractionsCount')).not.toBeNull();
    });

    it('wraps the Options block in a collapsed standard exe-fieldset', () => {
        const fieldset = document.getElementById('ivCompletionMode')?.closest('fieldset');
        expect(fieldset?.classList.contains('exe-fieldset')).toBe(true);
        expect(fieldset?.classList.contains('exe-fieldset-closed')).toBe(true);
        // The private class is gone; the shared legend-collapse anchor is present.
        expect(document.querySelector('.exe-iv-fieldset')).toBeNull();
        expect(fieldset?.querySelector('legend a')).not.toBeNull();
    });

    it('offers no Content before/after boxes (sibling Text iDevices own that role)', () => {
        expect(document.getElementById('eXeIdeviceTextBefore')).toBeNull();
        expect(document.getElementById('eXeIdeviceTextAfter')).toBeNull();
        expect(harness.stubs.getTextFieldset).not.toHaveBeenCalled();
    });

    it('offers a single source field that doubles as the media-library picker', () => {
        const field = document.getElementById('ivVideoFile');
        expect(field?.classList.contains('exe-file-picker')).toBe(true);
        // No separate URL field, no URL/Local-file mode select, no provider radios.
        expect(document.getElementById('ivUrl')).toBeNull();
        expect(document.getElementById('ivSourceMode')).toBeNull();
        expect(document.querySelector('input[name="ivProviderRadio"]')).toBeNull();
        expect(document.getElementById('ivUrlError')).not.toBeNull();
    });

    it('keeps the subtitles inside the collapsed Options fieldset and drops the poster option', () => {
        const options = document.querySelector('fieldset.exe-fieldset-closed');
        expect(options?.querySelector('.exe-iv-captions-section')).not.toBeNull();
        // The separate poster option was replaced by the cover interaction.
        expect(document.getElementById('ivPosterImage')).toBeNull();
        // Subtitles are not in the Video fieldset.
        const video = document.getElementById('ivVideoFile')?.closest('fieldset');
        expect(video?.querySelector('.exe-iv-captions-section')).toBeNull();
    });

    it('has no standalone preview surface or refresh button', () => {
        expect(document.getElementById('ivRefreshPreview')).toBeNull();
        expect(document.getElementById('ivPreview')).toBeNull();
    });

    it('renders the timeline track, progress, playhead, hint and legend', () => {
        expect(document.getElementById('ivInteractionsPlayer')).not.toBeNull();
        expect(document.getElementById('ivTimelineBox')).not.toBeNull();
        expect(document.getElementById('ivTimelineTrack')).not.toBeNull();
        expect(document.getElementById('ivTimelineProgress')).not.toBeNull();
        expect(document.getElementById('ivTimelinePlayhead')).not.toBeNull();
        expect(document.getElementById('ivEditTimeline')).not.toBeNull();
        expect(document.querySelectorAll('.exe-iv-timeline-foot .exe-iv-legend-swatch').length).toBe(5);
    });

    it('keeps the add bar in design order: label, time, current-time, spacer, add buttons', () => {
        for (const id of ['ivAddNote', 'ivAddQuestion', 'ivAddPause', 'ivAddJump']) {
            expect(document.getElementById(id)?.className).toContain('btn-primary');
        }
        expect(document.querySelector('.exe-iv-add-bar .exe-iv-add-spacer')).not.toBeNull();
        expect(document.querySelector('label[for="ivAddTime"]')?.textContent).toBe('Add at');
        expect(document.getElementById('ivAddCurrentTime')).not.toBeNull();
        expect(precedes(document.getElementById('ivAddTime'), document.getElementById('ivAddCurrentTime'))).toBe(true);
    });

    it('gives the cover its own non-primary add button', () => {
        const button = document.getElementById('ivAddCover');
        expect(button?.classList.contains('exe-iv-add-cover')).toBe(true);
        expect(button?.classList.contains('btn-primary')).toBe(false);
    });

    it('keeps a live region and a live preview panel for the editor', () => {
        const region = document.getElementById('ivEditorLive');
        expect(region?.getAttribute('aria-live')).toBe('polite');
        expect(region?.getAttribute('role')).toBe('status');
        expect(document.getElementById('ivEditPreview')?.getAttribute('aria-live')).toBe('polite');
    });

    it('inserts the shared progress-report contents into the Options fieldset', () => {
        expect(harness.stubs.progressGetContents).toHaveBeenCalledWith(state.idevicePath);
    });

    it('explains the completion mode through a quext-style help link', () => {
        const link = document.getElementById('ivCompletionHelpLnk');
        const text = document.getElementById('ivCompletionHelp');
        expect(link).not.toBeNull();
        expect(text?.classList.contains('exe-block-info')).toBe(true);
        expect(text?.textContent).toContain('Video watched');
        expect(link?.querySelector('img')?.getAttribute('src')).toContain('quextIEHelp.png');
        // Hidden until the author asks for it; the link toggles it.
        expect(text?.classList.contains('is-open')).toBe(false);
        wireHelp();
        (link as HTMLElement).click();
        expect(text?.classList.contains('is-open')).toBe(true);
        (link as HTMLElement).click();
        expect(text?.classList.contains('is-open')).toBe(false);
    });

    it('lists the supported sources in an always-visible hint under the video field', () => {
        const hint = document.getElementById('ivVideoSourceHint');
        expect(hint?.classList.contains('exe-iv-hint')).toBe(true);
        for (const source of ['Local video file', 'YouTube', 'Vimeo', 'Mediateca', 'direct video URL']) {
            expect(hint?.textContent).toContain(source);
        }
        expect(document.getElementById('ivVideoFile')?.getAttribute('aria-describedby')).toBe('ivVideoSourceHint');
    });

    it('reveals a help hint on click and hides it again', () => {
        wireHelp();
        const help = document.querySelector('#interactiveVideoIdeviceForm .exe-form-help');
        expect(help).not.toBeNull();
        const content = help?.querySelector('.help-content');
        expect(content?.classList.contains('help-hidden')).toBe(true);
        (help?.querySelector('.form-help-exe-icon') as HTMLElement).click();
        expect(content?.classList.contains('help-hidden')).toBe(false);
        expect(help?.classList.contains('help-content-disabled')).toBe(false);
        (help?.querySelector('.form-help-exe-icon') as HTMLElement).click();
        expect(content?.classList.contains('help-hidden')).toBe(true);
    });
});

describe('descriptionHtml', () => {
    it('renders the shared banner when the edition helper is available', () => {
        const harness = installEditionHarness();
        try {
            expect(descriptionHtml()).toContain('alert-info');
            expect(harness.stubs.getIdeviceDescription).toHaveBeenCalled();
        } finally {
            harness.restore();
        }
    });

    it('renders nothing when the workarea helper is absent', () => {
        const layer = $exeDevicesEdition?.iDevice;
        const previous = layer?.common;
        if (layer) {
            layer.common = {};
        }
        try {
            expect(descriptionHtml()).toBe('');
        } finally {
            if (layer) {
                layer.common = previous;
            }
        }
    });
});

describe('subtitle rows', () => {
    let harness: EditionHarness;
    let state: EditionState;

    beforeEach(() => {
        harness = installEditionHarness();
        state = makeState();
        mountForm(state);
    });

    afterEach(() => {
        harness.restore();
    });

    it('shows a hint while there are no tracks', () => {
        renderCaptions(state);
        expect(document.querySelector('#ivCaptions .exe-iv-hint')?.textContent).toBe('No subtitles yet.');
    });

    it('marks only the first added track as the default', () => {
        addCaption(state, 'resources/es.vtt');
        addCaption(state, 'resources/en.vtt');
        expect(state.doc.video.captions.map(caption => caption.default)).toEqual([true, false]);
        expect(document.querySelectorAll('#ivCaptions .exe-iv-caption-row').length).toBe(2);
        expect(document.querySelector('#ivCaptions .exe-iv-caption-file')?.textContent).toBe('es.vtt');
    });

    it('names a track with no file at all', () => {
        addCaption(state, '');
        expect(document.querySelector('#ivCaptions .exe-iv-caption-file')?.textContent).toBe('(no file)');
    });

    it('writes the language and label into the model as they are typed', () => {
        addCaption(state, 'resources/es.vtt');
        $('#ivCaptions .exe-iv-caption-lang').val('es').trigger('input');
        $('#ivCaptions .exe-iv-caption-label').val('Español').trigger('input');
        expect(state.doc.video.captions[0]).toMatchObject({ lang: 'es', label: 'Español' });
    });

    it('moves the default flag to the chosen track', () => {
        addCaption(state, 'resources/es.vtt');
        addCaption(state, 'resources/en.vtt');
        const radios = document.querySelectorAll<HTMLInputElement>('#ivCaptions .exe-iv-caption-default-radio');
        radios[1]!.checked = true;
        $(radios[1]!).trigger('change');
        expect(state.doc.video.captions.map(caption => caption.default)).toEqual([false, true]);
    });

    it('deletes a track and re-renders the remaining rows', () => {
        addCaption(state, 'resources/es.vtt');
        addCaption(state, 'resources/en.vtt');
        (document.querySelectorAll<HTMLElement>('#ivCaptions .exe-iv-caption-del')[0] as HTMLElement).click();
        expect(state.doc.video.captions.map(caption => caption.src)).toEqual(['resources/en.vtt']);
        expect(document.querySelectorAll('#ivCaptions .exe-iv-caption-row').length).toBe(1);
    });

    it('recovers from a captions field that is not an array', () => {
        (state.doc.video as unknown as { captions: unknown }).captions = 'nonsense';
        renderCaptions(state);
        expect(state.doc.video.captions).toEqual([]);
        (state.doc.video as unknown as { captions: unknown }).captions = null;
        addCaption(state, 'resources/es.vtt');
        expect(state.doc.video.captions).toHaveLength(1);
    });

    it('does nothing when the subtitle container is not mounted', () => {
        document.body.innerHTML = '';
        expect(() => renderCaptions(state)).not.toThrow();
    });

    it('escapes an authored label so it cannot inject markup', () => {
        addCaption(state, 'resources/es.vtt');
        state.doc.video.captions[0]!.label = '"><img src=x>';
        renderCaptions(state);
        expect(document.querySelector('#ivCaptions img')).toBeNull();
        expect(document.querySelector<HTMLInputElement>('#ivCaptions .exe-iv-caption-label')?.value).toBe(
            '"><img src=x>',
        );
    });
});
