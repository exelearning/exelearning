import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EditionHarness, EditorHarness } from '../../test/helpers';
import { installEditionHarness, installFakeProviders, mountEditor } from '../../test/helpers';
import type {
    CoverInteraction,
    Interaction,
    JumpInteraction,
    NoteInteraction,
    PauseInteraction,
} from '../../shared/types';
import { createInteraction } from '../state';
import { bindDetailForType, commonFieldsHtml, detailForType } from './common';
import { detailJump } from './jump';
import { bindBodyField, bodyFieldHtml } from './note';
import type { DetailHost } from './types';

/** Render detail markup on its own, without the accordion around it. */
function mountDetail(html: string): void {
    document.body.innerHTML = '<div id="ivDetailPanel">' + html + '</div>';
}

function fieldsFor(interaction: Interaction): void {
    mountDetail(commonFieldsHtml(interaction) + detailForType(interaction));
}

describe('the shared detail fields', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('gives note and question an editable time with a "Set to current time" control', () => {
        for (const type of ['note', 'question'] as const) {
            fieldsFor(createInteraction(type, 'iv-0', 65));
            expect(document.querySelector<HTMLInputElement>('#ivDetailTime')?.value).toBe('01:05');
            expect(document.getElementById('ivDetailCurrentTime')).not.toBeNull();
            expect(document.querySelector('label[for="ivDetailTime"]')?.textContent).toContain('mm:ss');
        }
    });

    it('pins the cover time and never offers to edit it', () => {
        fieldsFor(createInteraction('cover', 'iv-0', 0));
        expect(document.getElementById('ivDetailTime')).toBeNull();
        expect(document.querySelector('.exe-iv-detail-fixed-time')?.textContent).toContain('start of the video');
        expect(document.getElementById('ivDetailPause')).toBeNull();
        expect(document.getElementById('ivDetailDuration')).toBeNull();
    });

    it('offers "Pause video when shown" only for the overlays that need it', () => {
        fieldsFor(createInteraction('note', 'iv-0', 5));
        expect(document.querySelector<HTMLInputElement>('#ivDetailPause')?.checked).toBe(true);
        fieldsFor(createInteraction('question', 'iv-0', 5));
        expect(document.getElementById('ivDetailPause')).not.toBeNull();
        // A pause already halts playback and a jump only seeks.
        fieldsFor(createInteraction('pause', 'iv-0', 5));
        expect(document.getElementById('ivDetailPause')).toBeNull();
        fieldsFor(createInteraction('jump', 'iv-0', 5));
        expect(document.getElementById('ivDetailPause')).toBeNull();
    });

    it('reflects an unchecked pause flag', () => {
        const note = createInteraction('note', 'iv-0', 5) as NoteInteraction;
        note.pause = false;
        fieldsFor(note);
        expect(document.querySelector<HTMLInputElement>('#ivDetailPause')?.checked).toBe(false);
    });

    it('offers the optional END time for note and pause only, as an end time', () => {
        const note = createInteraction('note', 'iv-0', 10) as NoteInteraction;
        fieldsFor(note);
        expect(document.querySelector<HTMLInputElement>('#ivDetailDuration')?.value).toBe('');
        expect(document.querySelector('label[for="ivDetailDuration"]')?.textContent).toContain('Until');
        expect(document.getElementById('ivDetailDurationHint')?.textContent).toContain('Continue');
        // The model stores a duration; the author reads and writes an end time.
        note.duration = 8;
        fieldsFor(note);
        expect(document.querySelector<HTMLInputElement>('#ivDetailDuration')?.value).toBe('00:18');

        fieldsFor(createInteraction('pause', 'iv-0', 10));
        expect(document.getElementById('ivDetailDuration')).not.toBeNull();
        fieldsFor(createInteraction('question', 'iv-0', 10));
        expect(document.getElementById('ivDetailDuration')).toBeNull();
        fieldsFor(createInteraction('jump', 'iv-0', 10));
        expect(document.getElementById('ivDetailDuration')).toBeNull();
    });

    it('dispatches to the editor of each kind', () => {
        fieldsFor(createInteraction('cover', 'iv-0', 0));
        expect(document.getElementById('ivDetailTitle')).not.toBeNull();
        expect(document.getElementById('ivDetailBody')?.className).toContain('exe-html-editor');

        fieldsFor(createInteraction('note', 'iv-0', 1));
        expect(document.getElementById('ivDetailBody')).not.toBeNull();
        expect(document.getElementById('ivDetailTitle')).toBeNull();
        expect(document.querySelector('label[for="ivDetailBody"]')?.textContent).toBe('Text');

        fieldsFor(createInteraction('pause', 'iv-0', 1));
        expect(document.getElementById('ivDetailBody')).not.toBeNull();
        expect(document.getElementById('ivDetailTitle')).toBeNull();

        fieldsFor(createInteraction('jump', 'iv-0', 1));
        expect(document.querySelector<HTMLInputElement>('#ivDetailJump')?.value).toBe('00:00');

        fieldsFor(createInteraction('question', 'iv-0', 1));
        expect(document.getElementById('ivQuestionKind')).not.toBeNull();

        fieldsFor(createInteraction('unsupported', 'iv-0', 1));
        expect(document.querySelector('.exe-iv-unsupported')?.textContent).toContain('cannot be edited here');
    });

    it('has nothing to bind for a preserved unsupported interaction', () => {
        const interaction = createInteraction('unsupported', 'iv-0', 1);
        fieldsFor(interaction);
        expect(() => bindDetailForType(interaction, {} as unknown as DetailHost)).not.toThrow();
    });

    it('shows 00:00 for a jump whose target was never stored', () => {
        const jump = { id: 'iv-0', time: 5, duration: null, pause: true, type: 'jump' } as JumpInteraction;
        mountDetail(detailJump(jump));
        expect(document.querySelector<HTMLInputElement>('#ivDetailJump')?.value).toBe('00:00');
    });

    it('labels the cover body as cover content and escapes what is in it', () => {
        const cover = createInteraction('cover', 'iv-0', 0) as CoverInteraction;
        cover.title = 'A & B';
        cover.body = '<p>Hola</p>';
        fieldsFor(cover);
        expect(document.querySelector('label[for="ivDetailBody"]')?.textContent).toContain('Cover content');
        expect(document.querySelector<HTMLInputElement>('#ivDetailTitle')?.value).toBe('A & B');
        // The body arrives as TEXT in the textarea, not as parsed markup.
        expect(document.querySelector<HTMLTextAreaElement>('#ivDetailBody')?.value).toBe('<p>Hola</p>');
        expect(document.querySelector('#ivDetailPanel p')).toBeNull();
    });
});

describe('the plain-textarea body field', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('keeps the model in sync while no rich-text editor is attached', () => {
        const note = createInteraction('note', 'iv-0', 5) as NoteInteraction;
        mountDetail(bodyFieldHtml(note));
        // `bindBodyField` needs no host: this is the degraded, TinyMCE-less path.
        bindBodyField(note, {} as unknown as DetailHost);
        $('#ivDetailBody').val('<p>Typed</p>').trigger('input');
        expect(note.body).toBe('<p>Typed</p>');
    });
});

describe('the shared detail bindings', () => {
    let edition: EditionHarness;
    let harness: EditorHarness;

    beforeEach(() => {
        edition = installEditionHarness();
        installFakeProviders();
        harness = mountEditor();
    });

    afterEach(() => {
        edition.restore();
    });

    function addAt(time: string, type: Parameters<EditorHarness['editor']['addInteraction']>[0]): Interaction {
        $('#ivAddTime').val(time);
        harness.editor.addInteraction(type);
        const interactions = harness.state.doc.interactions;
        return interactions[interactions.length - 1] as Interaction;
    }

    /** Mount an inline <video> whose playhead sits at `seconds`. */
    function mountVideoAt(seconds: number): void {
        const player = document.getElementById('ivInteractionsPlayer') as HTMLElement;
        player.innerHTML = '<video id="ivEditPlayerVideo"></video>';
        (document.getElementById('ivEditPlayerVideo') as HTMLVideoElement).currentTime = seconds;
    }

    it('writes an edited time into the model, re-sorts and keeps the field focused', () => {
        const first = addAt('00:05', 'note');
        const second = addAt('00:15', 'note');
        // The second row is open; move it before the first.
        $('#ivDetailTime').val('00:01').trigger('change');
        expect(second.time).toBe(1);
        expect(harness.state.doc.interactions[0]?.id).toBe(second.id);
        expect(harness.state.doc.interactions[1]?.id).toBe(first.id);
        expect(document.activeElement?.id).toBe('ivDetailTime');
    });

    it('writes the pause flag', () => {
        const note = addAt('00:05', 'note') as NoteInteraction;
        $('#ivDetailPause').prop('checked', false).trigger('change');
        expect(note.pause).toBe(false);
        $('#ivDetailPause').prop('checked', true).trigger('change');
        expect(note.pause).toBe(true);
    });

    it('stores an authored END time as a duration and reopens showing the end time', () => {
        const note = addAt('00:10', 'note') as NoteInteraction;
        expect(note.time).toBe(10);
        $('#ivDetailDuration').val('00:18').trigger('change');
        expect(note.duration).toBe(8); // 00:18 − 00:10
        harness.editor.renderDetail();
        expect(document.querySelector<HTMLInputElement>('#ivDetailDuration')?.value).toBe('00:18');
        // Clearing the field returns to the "wait for Continue" default.
        $('#ivDetailDuration').val('').trigger('change');
        expect(note.duration).toBeNull();
        expect(document.getElementById('ivDetailDurationError')?.textContent).toBe('');
    });

    it('rejects an end time that is not after the start', () => {
        const note = addAt('00:10', 'note') as NoteInteraction;
        $('#ivDetailDuration').val('00:05').trigger('change');
        expect(note.duration).toBeNull();
        expect(document.querySelector<HTMLInputElement>('#ivDetailDuration')?.value).toBe('');
        expect(document.getElementById('ivDetailDurationError')?.textContent).toContain('after the start');
        expect(document.getElementById('ivEditorLive')?.textContent).toContain('after the start');
        // An end time exactly at the start is refused too.
        $('#ivDetailDuration').val('00:10').trigger('change');
        expect(note.duration).toBeNull();
    });

    it('keeps the end time relative when the interaction is moved', () => {
        const pause = addAt('00:10', 'pause') as PauseInteraction;
        $('#ivDetailDuration').val('00:18').trigger('change');
        expect(pause.duration).toBe(8);
        $('#ivDetailTime').val('01:00').trigger('change');
        expect(pause.time).toBe(60);
        // The stored duration is untouched, so the end time follows the start.
        expect(pause.duration).toBe(8);
        expect(document.querySelector<HTMLInputElement>('#ivDetailDuration')?.value).toBe('01:08');
    });

    it('commits the captured playhead to the model, not just to the textbox', async () => {
        const note = addAt('00:05', 'note');
        mountVideoAt(42);
        document.getElementById('ivDetailCurrentTime')?.click();
        await Promise.resolve();
        await Promise.resolve();
        // The model time moves, so the row and its marker move and re-sort.
        expect(note.time).toBe(42);
        expect(document.querySelector(`#ivEditTimeline button[data-iv-id="${note.id}"]`)).not.toBeNull();
        expect(document.querySelector<HTMLInputElement>('#ivDetailTime')?.value).toBe('00:42');
    });

    it('leaves the detail time untouched when no playback time is available', async () => {
        const note = addAt('00:05', 'note');
        document.getElementById('ivDetailCurrentTime')?.click();
        await Promise.resolve();
        await Promise.resolve();
        expect(note.time).toBe(5);
        expect(document.getElementById('ivEditorLive')?.textContent?.length).toBeGreaterThan(0);
    });

    it('writes the cover title and refreshes the row summary and preview', () => {
        harness.editor.addInteraction('cover');
        const cover = harness.state.doc.interactions[0] as CoverInteraction;
        $('#ivDetailTitle').val('Portada').trigger('input');
        expect(cover.title).toBe('Portada');
        expect(document.querySelector(`li[data-id="${cover.id}"] .exe-iv-edit-summary`)?.textContent).toBe('Portada');
        expect(document.getElementById('ivEditPreview')?.innerHTML).toContain('Portada');
    });

    it('writes the jump target time', () => {
        const jump = addAt('00:05', 'jump') as JumpInteraction;
        $('#ivDetailJump').val('01:05').trigger('change');
        expect(jump.jump).toEqual({ toTime: 65 });
    });
});
