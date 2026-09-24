import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditionHarness, EditorHarness } from '../test/helpers';
import { alertHistory, clearAlerts, installEditionHarness, mountEditor, pressKey } from '../test/helpers';
import type { CoverInteraction, Interaction, NoteInteraction, QuestionInteraction } from '../shared/types';
import { excerpt, rowValidity, summaryText } from './editor';
import { createInteraction } from './state';

function rowButton(id: string): HTMLButtonElement | null {
    return document.querySelector<HTMLButtonElement>(`li[data-id="${id}"] .exe-iv-edit-select`);
}

function rowIds(): Array<string | null> {
    return Array.from(document.querySelectorAll('#ivInteractionList li[data-id]')).map(li =>
        li.getAttribute('data-id'),
    );
}

function summaryOf(id: string): string {
    return document.querySelector(`li[data-id="${id}"] .exe-iv-edit-summary`)?.textContent ?? '';
}

function validityBadge(id: string): Element | null {
    return document.querySelector(`li[data-id="${id}"] .exe-iv-edit-validity`);
}

function previewHtml(): string {
    return document.getElementById('ivEditPreview')?.innerHTML ?? '';
}

function bodyEditor(): { setContent(html: string): void } | null {
    return tinymce?.get?.('ivDetailBody') as unknown as { setContent(html: string): void } | null;
}

describe('excerpt', () => {
    it('strips tags and collapses whitespace', () => {
        expect(excerpt('<p>Hello   <b>there</b></p>')).toBe('Hello there');
    });

    it('truncates long text with an ellipsis at the requested limit', () => {
        expect(excerpt('abcdefghij', 5)).toBe('abcd…');
        expect(excerpt('x'.repeat(80)).length).toBe(60);
    });

    it('treats missing values as empty', () => {
        expect(excerpt(null)).toBe('');
        expect(excerpt(undefined)).toBe('');
    });
});

describe('summaryText', () => {
    it('prefers the question prompt, then the cover title, then the body', () => {
        const question = createInteraction('question', 'iv-0', 1) as QuestionInteraction;
        question.question.prompt = 'What is the capital of France?';
        expect(summaryText(question)).toBe('What is the capital of France?');

        const cover = createInteraction('cover', 'iv-1', 0) as CoverInteraction;
        cover.title = 'Bienvenida';
        cover.body = '<p>Ignored</p>';
        expect(summaryText(cover)).toBe('Bienvenida');
        cover.title = '';
        expect(summaryText(cover)).toBe('Ignored');

        const note = createInteraction('note', 'iv-2', 2) as NoteInteraction;
        note.body = '<p>Warm-up note</p>';
        expect(summaryText(note)).toBe('Warm-up note');
    });

    it('falls back to the kind label when there is nothing authored yet', () => {
        expect(summaryText(createInteraction('question', 'iv-0', 1))).toBe('Question');
        expect(summaryText(createInteraction('note', 'iv-1', 1))).toBe('Note');
        expect(summaryText(createInteraction('jump', 'iv-2', 1))).toBe('Jump');
    });
});

describe('rowValidity', () => {
    it('flags a question with no text', () => {
        const question = createInteraction('question', 'iv-0', 1) as QuestionInteraction;
        expect(rowValidity(question)).toContain('no text yet');
        question.question.prompt = '<p>  </p>';
        expect(rowValidity(question)).toContain('no text yet');
        question.question.prompt = 'Filled';
        expect(rowValidity(question)).toBe('');
    });

    it('never flags the other kinds', () => {
        expect(rowValidity(createInteraction('note', 'iv-0', 1))).toBe('');
        expect(rowValidity(createInteraction('jump', 'iv-1', 1))).toBe('');
    });
});

describe('the single-editor accordion', () => {
    let edition: EditionHarness;
    let harness: EditorHarness;

    beforeEach(() => {
        edition = installEditionHarness();
        harness = mountEditor();
    });

    afterEach(() => {
        edition.restore();
    });

    /** Add an interaction at `time` (mm:ss) through the add bar. */
    function addAt(time: string, type: Parameters<EditorHarness['editor']['addInteraction']>[0]): Interaction {
        $('#ivAddTime').val(time);
        harness.editor.addInteraction(type);
        const interactions = harness.state.doc.interactions;
        return interactions[interactions.length - 1] as Interaction;
    }

    it('shows an empty-state hint at first paint', () => {
        const empty = document.querySelector('#ivInteractionList .exe-iv-empty');
        expect(empty).not.toBeNull();
        expect(empty?.textContent?.length).toBeGreaterThan(0);
        expect(document.getElementById('ivInteractionsCount')?.textContent).toBe('');
    });

    it('adds an interaction at the entered time', () => {
        $('#ivAddTime').val('00:10');
        harness.editor.addInteraction('note');
        expect(harness.state.doc.interactions.length).toBe(1);
        expect(harness.state.doc.interactions[0]).toMatchObject({ type: 'note', time: 10 });
        expect(document.querySelectorAll('#ivInteractionList .exe-iv-edit-select').length).toBe(1);
    });

    it('renders each interaction exactly once — a single editor hosted inside its own row', () => {
        harness.editor.addInteraction('question');
        harness.editor.addInteraction('question');
        // Only the selected (second) row is expanded, so exactly one prompt exists.
        expect(document.querySelectorAll('#ivQuestionPrompt').length).toBe(1);
        const panel = document.getElementById('ivDetailPanel');
        expect(panel).not.toBeNull();
        const li = panel?.closest('li[data-id]');
        expect(li?.getAttribute('data-id')).toBe(harness.state.selectedId);
        // There is no detached #ivDetailPanel as a sibling of the list.
        const list = document.getElementById('ivInteractionList');
        expect(list?.parentNode?.querySelector(':scope > #ivDetailPanel')).toBeNull();
        expect(rowIds().length).toBe(2);
    });

    it('expands the selected row and collapses the others', () => {
        const first = addAt('00:05', 'note');
        const second = addAt('00:15', 'note');
        expect(rowButton(second.id)?.getAttribute('aria-expanded')).toBe('true');
        expect(rowButton(first.id)?.getAttribute('aria-expanded')).toBe('false');
        expect(rowButton(first.id)?.getAttribute('tabindex')).toBe('-1');
        rowButton(first.id)?.click();
        expect(harness.state.selectedId).toBe(first.id);
        expect(rowButton(first.id)?.getAttribute('aria-expanded')).toBe('true');
        expect(rowButton(second.id)?.getAttribute('aria-expanded')).toBe('false');
    });

    it('adds an interaction and focuses the first editor field', () => {
        harness.editor.addInteraction('question');
        expect(document.activeElement?.id).toBe('ivDetailTime');
    });

    it('makes the first row tabbable while nothing is selected', () => {
        const first = addAt('00:05', 'note');
        rowButton(first.id)?.click(); // collapse it again
        expect(harness.state.selectedId).toBeNull();
        expect(rowButton(first.id)?.getAttribute('tabindex')).toBe('0');
    });

    it('deletes an interaction and moves focus to the neighbouring row', () => {
        const first = addAt('00:05', 'note');
        const second = addAt('00:15', 'note');
        document.querySelector<HTMLElement>(`li[data-id="${first.id}"] .exe-iv-edit-del`)?.click();
        document.querySelector<HTMLElement>(`li[data-id="${first.id}"] .exe-iv-edit-del-yes`)?.click();
        expect(harness.state.doc.interactions.length).toBe(1);
        expect(document.activeElement).toBe(rowButton(second.id));
    });

    it('falls back to the previous row, then to the add button, as rows run out', () => {
        const first = addAt('00:05', 'note');
        const second = addAt('00:15', 'note');
        // Deleting the LAST row focuses the previous one.
        document.querySelector<HTMLElement>(`li[data-id="${second.id}"] .exe-iv-edit-del`)?.click();
        document.querySelector<HTMLElement>(`li[data-id="${second.id}"] .exe-iv-edit-del-yes`)?.click();
        expect(document.activeElement).toBe(rowButton(first.id));
        // Deleting the only remaining row falls back to the add bar.
        document.querySelector<HTMLElement>(`li[data-id="${first.id}"] .exe-iv-edit-del`)?.click();
        document.querySelector<HTMLElement>(`li[data-id="${first.id}"] .exe-iv-edit-del-yes`)?.click();
        expect(harness.state.doc.interactions.length).toBe(0);
        expect(document.activeElement).toBe(document.getElementById('ivAddQuestion'));
    });

    it('ignores a delete for an id that is not in the document', () => {
        addAt('00:05', 'note');
        harness.editor.deleteInteraction('iv-nope');
        expect(harness.state.doc.interactions.length).toBe(1);
    });

    it('confirms deletion inline (no modal) and can be cancelled', () => {
        const note = addAt('00:05', 'note');
        expect(harness.state.selectedId).toBe(note.id);
        // Delete collapses the editor and shows the inline confirm (nothing deleted).
        document.querySelector<HTMLElement>(`li[data-id="${note.id}"] .exe-iv-edit-del`)?.click();
        expect(harness.state.selectedId).toBeNull();
        expect(document.getElementById('ivDetailPanel')).toBeNull();
        expect(document.querySelector(`li[data-id="${note.id}"] .exe-iv-edit-del-yes`)).not.toBeNull();
        expect(harness.state.doc.interactions.length).toBe(1);
        // Cancel returns to a clean collapsed row (no stale empty editor panel).
        document.querySelector<HTMLElement>(`li[data-id="${note.id}"] .exe-iv-edit-del-no`)?.click();
        expect(document.querySelector(`li[data-id="${note.id}"] .exe-iv-edit-del-yes`)).toBeNull();
        expect(document.getElementById('ivDetailPanel')).toBeNull();
        expect(harness.state.selectedId).toBeNull();
        expect(harness.state.doc.interactions.length).toBe(1);
        expect(document.activeElement).toBe(rowButton(note.id));
    });

    it('toggles a row open and closed, with no redundant edit/pencil control', () => {
        const note = addAt('00:05', 'note');
        expect(harness.state.selectedId).toBe(note.id);
        expect(document.querySelector('.exe-iv-edit-edit')).toBeNull();
        // Reuses the standard workarea icon sprites for duplicate/delete.
        expect(
            document.querySelector(`li[data-id="${note.id}"] .exe-iv-edit-dup .duplicate-icon-green`),
        ).not.toBeNull();
        expect(document.querySelector(`li[data-id="${note.id}"] .exe-iv-edit-del .delete-icon-red`)).not.toBeNull();
        rowButton(note.id)?.click();
        expect(harness.state.selectedId).toBeNull();
        rowButton(note.id)?.click();
        expect(harness.state.selectedId).toBe(note.id);
    });

    it('shows the interaction count next to the section title', () => {
        const count = document.getElementById('ivInteractionsCount');
        harness.editor.addInteraction('note');
        expect(count?.textContent).toBe('1 interaction');
        harness.editor.addInteraction('pause');
        expect(count?.textContent).toBe('2 interactions');
        harness.editor.deleteInteraction(harness.state.doc.interactions[0]!.id);
        harness.editor.deleteInteraction(harness.state.doc.interactions[0]!.id);
        expect(count?.textContent).toBe('');
    });

    it('colours row badges by kind and accents the selected row', () => {
        addAt('00:05', 'question');
        const li = document.querySelector('#ivInteractionList li[data-id]');
        expect(li?.className).toContain('exe-iv-kind--question');
        expect(li?.className).toContain('is-selected');
        expect(li?.querySelector('.exe-iv-edit-badge')?.className).not.toContain('text-bg-secondary');
        expect(li?.querySelector('.exe-iv-edit-time')?.textContent).toBe('00:05');
    });

    it('keeps a stable aria-live region across list re-renders', () => {
        const region = document.getElementById('ivEditorLive');
        expect(region?.getAttribute('aria-live')).toBe('polite');
        harness.editor.addInteraction('note');
        expect(document.getElementById('ivEditorLive')).toBe(region);
        expect(region?.textContent).toContain('Note');
    });

    it('does nothing when the list is not mounted', () => {
        document.body.innerHTML = '';
        expect(() => harness.editor.renderInteractionList()).not.toThrow();
        expect(() => harness.editor.renderDetail()).not.toThrow();
        expect(() => harness.editor.refreshMarkers()).not.toThrow();
        expect(() => harness.editor.focusFirstEditorField()).not.toThrow();
        expect(harness.editor.focusRowButton('iv-0')).toBe(false);
    });

    it('ignores keyboard navigation once the list has gone away', () => {
        const note = addAt('00:05', 'note');
        const button = rowButton(note.id) as HTMLElement;
        document.getElementById('ivInteractionList')?.removeAttribute('id');
        expect(() => pressKey(button, 'ArrowDown')).not.toThrow();
    });

    it('escapes authored text in the row summary', () => {
        const note = addAt('00:05', 'note') as NoteInteraction;
        // Collapse first: while the row is open the rich-text editor owns the
        // body and would flush its own (empty) content over this assignment.
        rowButton(note.id)?.click();
        note.body = 'Tricky & "quoted" <img src=x onerror=alert(1)>';
        harness.editor.renderInteractionList();
        // The excerpt strips the markup and the remaining text is escaped, so
        // nothing an author typed can become an element.
        expect(document.querySelector('#ivInteractionList img')).toBeNull();
        expect(summaryOf(note.id)).toBe('Tricky & "quoted"');
    });

    describe('keyboard navigation', () => {
        it('roves with ArrowDown/ArrowUp/Home/End, toggles with Enter, collapses with Esc', () => {
            const first = addAt('00:05', 'note');
            const second = addAt('00:15', 'note');
            const third = addAt('00:25', 'note');
            // The freshly-added third row is open; collapse it so nothing is selected.
            pressKey(rowButton(third.id) as Element, 'Escape');
            expect(harness.state.selectedId).toBeNull();
            expect(document.activeElement).toBe(rowButton(third.id));

            rowButton(first.id)?.focus();
            pressKey(rowButton(first.id) as Element, 'ArrowDown');
            expect(document.activeElement).toBe(rowButton(second.id));
            pressKey(rowButton(second.id) as Element, 'ArrowUp');
            expect(document.activeElement).toBe(rowButton(first.id));
            pressKey(rowButton(first.id) as Element, 'End');
            expect(document.activeElement).toBe(rowButton(third.id));
            pressKey(rowButton(third.id) as Element, 'Home');
            expect(document.activeElement).toBe(rowButton(first.id));
            // ArrowUp on the first row stays put (bounded roving).
            pressKey(rowButton(first.id) as Element, 'ArrowUp');
            expect(document.activeElement).toBe(rowButton(first.id));

            // Enter expands the focused (collapsed) row, and again collapses it.
            pressKey(rowButton(first.id) as Element, 'Enter');
            expect(harness.state.selectedId).toBe(first.id);
            expect(rowButton(first.id)?.getAttribute('aria-expanded')).toBe('true');
            pressKey(rowButton(first.id) as Element, 'Enter');
            expect(harness.state.selectedId).toBeNull();
            // Space toggles too.
            pressKey(rowButton(first.id) as Element, ' ');
            expect(harness.state.selectedId).toBe(first.id);
            // Esc collapses and returns focus to the row button.
            pressKey(rowButton(first.id) as Element, 'Escape');
            expect(harness.state.selectedId).toBeNull();
            expect(document.activeElement).toBe(rowButton(first.id));
        });

        it('ignores keys that are not navigation, and Escape with nothing selected', () => {
            const note = addAt('00:05', 'note');
            pressKey(rowButton(note.id) as Element, 'Escape');
            expect(harness.state.selectedId).toBeNull();
            expect(() => pressKey(rowButton(note.id) as Element, 'Escape')).not.toThrow();
            pressKey(rowButton(note.id) as Element, 'a');
            expect(harness.state.selectedId).toBeNull();
            // A key from inside the expanded editor is not row navigation.
            rowButton(note.id)?.click();
            const field = document.getElementById('ivDetailTime') as HTMLElement;
            field.focus();
            pressKey(field, 'ArrowDown');
            expect(document.activeElement).toBe(field);
        });
    });

    describe('duplicate', () => {
        it('keeps deterministic order for same-time interactions and lands a copy after its source', () => {
            const first = addAt('00:10', 'note');
            const second = addAt('00:10', 'note');
            expect(rowIds()).toEqual([first.id, second.id]);
            harness.editor.duplicateInteraction(first.id);
            const ids = rowIds();
            expect(ids.length).toBe(3);
            expect(ids.indexOf(harness.state.selectedId)).toBeGreaterThan(ids.indexOf(first.id));
        });

        it('copies the authored content and ignores an unknown id', () => {
            const question = addAt('00:10', 'question') as QuestionInteraction;
            $('#ivQuestionPrompt').val('Copy me').trigger('input');
            document.querySelector<HTMLElement>(`li[data-id="${question.id}"] .exe-iv-edit-dup`)?.click();
            const copy = harness.state.doc.interactions[1] as QuestionInteraction;
            expect(copy.question.prompt).toBe('Copy me');
            expect(copy.id).not.toBe(question.id);
            expect(harness.state.selectedId).toBe(copy.id);
            harness.editor.duplicateInteraction('iv-nope');
            expect(harness.state.doc.interactions.length).toBe(2);
        });
    });

    describe('the cover', () => {
        it('pins the cover to time 0, sorts it first and does not let its time be edited', () => {
            addAt('00:30', 'note');
            harness.editor.addInteraction('cover');
            const cover = harness.state.doc.interactions[0] as CoverInteraction;
            expect(cover).toMatchObject({ type: 'cover', time: 0, pause: false });
            expect(document.getElementById('ivDetailTime')).toBeNull();
            expect(document.querySelector('.exe-iv-detail-fixed-time')).not.toBeNull();
        });

        it('blocks a second cover with an alert', () => {
            harness.editor.addInteraction('cover');
            clearAlerts();
            harness.editor.addInteraction('cover');
            expect(harness.state.doc.interactions.filter(i => i.type === 'cover').length).toBe(1);
            expect(alertHistory().length).toBeGreaterThan(0);
            expect(document.getElementById('ivEditorLive')?.textContent).toContain('already a cover');
        });

        it('uses the authored cover title as the row summary and preview heading', () => {
            harness.editor.addInteraction('cover');
            const cover = harness.state.doc.interactions[0] as CoverInteraction;
            $('#ivDetailTitle').val('Bienvenida al vídeo').trigger('input');
            expect(cover.title).toBe('Bienvenida al vídeo');
            expect(summaryOf(cover.id)).toContain('Bienvenida al vídeo');
            expect(previewHtml()).toContain('exe-iv-cover-title');
            expect(previewHtml()).toContain('Bienvenida al vídeo');
        });
    });

    describe('the live preview', () => {
        it('shows a placeholder until something is selected', () => {
            expect(document.getElementById('ivEditPreview')?.textContent).toContain('Select an interaction');
        });

        it('reflects the body typed into the shared rich-text editor', () => {
            harness.editor.addInteraction('note');
            bodyEditor()?.setContent('<p>Preview me</p>');
            expect(previewHtml()).toContain('Preview me');
            expect(document.querySelector('#ivEditPreview .exe-iv-kind--note')).not.toBeNull();
        });

        it('shows the question prompt, or a hint while there is none', () => {
            harness.editor.addInteraction('question');
            expect(previewHtml()).toContain('No question text yet');
            $('#ivQuestionPrompt').val('Which one?').trigger('input');
            harness.editor.renderEditPreview();
            expect(previewHtml()).toContain('Which one?');
        });

        it('explains what a jump does', () => {
            harness.editor.addInteraction('jump');
            expect(previewHtml()).toContain('Jumps the video to another time');
        });

        it('renders a card with no body for a preserved unsupported interaction', () => {
            harness.state.doc.interactions = [createInteraction('unsupported', 'iv-0', 5)];
            harness.state.selectedId = 'iv-0';
            harness.editor.renderEditPreview();
            expect(previewHtml()).toContain('exe-iv-kind--unsupported');
            expect(previewHtml()).toContain('Interaction');
        });

        it('does nothing when the preview panel is not mounted', () => {
            harness.editor.addInteraction('note');
            document.getElementById('ivEditPreview')?.remove();
            expect(() => harness.editor.renderEditPreview()).not.toThrow();
        });
    });

    describe('row summary and validity, live', () => {
        it('updates the row summary in place while the note body is typed', () => {
            const note = addAt('00:05', 'note') as NoteInteraction;
            note.body = 'Warm-up note';
            harness.editor.updateRowSummary(note);
            expect(summaryOf(note.id)).toContain('Warm-up note');
            // An interaction with no row is simply skipped.
            expect(() => harness.editor.updateRowSummary(createInteraction('note', 'iv-nope', 1))).not.toThrow();
        });

        it('clears the incomplete warning as soon as the prompt is filled, without reopening', () => {
            const question = addAt('00:05', 'question') as QuestionInteraction;
            expect(validityBadge(question.id)).not.toBeNull();
            $('#ivQuestionPrompt').val('What is the capital of France?').trigger('input');
            expect(question.question.prompt).toBe('What is the capital of France?');
            expect(validityBadge(question.id)).toBeNull();
            // The editor was updated in place, not re-rendered from scratch.
            expect(document.getElementById('ivQuestionPrompt')).not.toBeNull();
        });

        it('re-adds the incomplete warning when the prompt is emptied again', () => {
            const question = addAt('00:05', 'question') as QuestionInteraction;
            $('#ivQuestionPrompt').val('Filled').trigger('input');
            expect(validityBadge(question.id)).toBeNull();
            $('#ivQuestionPrompt').val('   ').trigger('input');
            expect(validityBadge(question.id)).not.toBeNull();
            expect(validityBadge(question.id)?.getAttribute('title')).toContain('no text yet');
        });

        it('skips validity reconciliation for a row that is not rendered', () => {
            expect(() => harness.editor.refreshRowValidity(createInteraction('question', 'iv-nope', 1))).not.toThrow();
        });
    });

    describe('marker selection', () => {
        it('selects the interaction, seeks the inline video and announces it', () => {
            const note = addAt('00:10', 'note');
            const player = document.getElementById('ivInteractionsPlayer') as HTMLElement;
            player.innerHTML = '<video id="ivEditPlayerVideo"></video>';
            rowButton(note.id)?.click(); // collapse, so selection is observable
            const marker = document.querySelector<HTMLElement>(`#ivEditTimeline button[data-iv-id="${note.id}"]`);
            expect(marker).not.toBeNull();
            marker?.click();
            expect(harness.state.selectedId).toBe(note.id);
            expect((document.getElementById('ivEditPlayerVideo') as HTMLVideoElement).currentTime).toBe(10);
            expect(document.getElementById('ivEditorLive')?.textContent).toContain('00:10');
            expect(document.activeElement).toBe(rowButton(note.id));
        });

        it('still selects when the interaction has vanished from the document', () => {
            const note = addAt('00:10', 'note');
            harness.state.doc.interactions = [];
            expect(() => harness.editor.selectMarker(note.id)).not.toThrow();
            expect(harness.state.selectedId).toBe(note.id);
        });
    });

    describe('detail re-renders', () => {
        it('keeps focus and the caret when the editor re-renders', () => {
            addAt('00:05', 'question');
            $('#ivQuestionPrompt').val('Guess').trigger('input');
            const prompt = document.getElementById('ivQuestionPrompt') as HTMLTextAreaElement;
            prompt.focus();
            prompt.setSelectionRange(3, 3);
            document.getElementById('ivAddAnswer')?.click();
            const restored = document.getElementById('ivQuestionPrompt') as HTMLTextAreaElement;
            expect(document.activeElement).toBe(restored);
            expect(restored.selectionStart).toBe(3);
        });

        it('renders only the preview when no row is expanded', () => {
            addAt('00:05', 'note');
            harness.state.selectedId = null;
            harness.editor.renderInteractionList();
            harness.editor.renderDetail();
            expect(document.getElementById('ivDetailPanel')).toBeNull();
            expect(document.getElementById('ivEditPreview')?.textContent).toContain('Select an interaction');
        });

        it('bails out when the selected interaction is gone', () => {
            addAt('00:05', 'note');
            const panel = document.getElementById('ivDetailPanel') as HTMLElement;
            harness.state.doc.interactions = [];
            harness.editor.renderDetail();
            // The stale panel is left untouched rather than rebuilt from nothing.
            expect(document.getElementById('ivDetailPanel')).toBe(panel);
        });
    });

    describe('the Saved confirmation', () => {
        it('flashes a green check next to the row actions each time a field is edited', () => {
            const note = addAt('00:05', 'note');
            const status = document.querySelector(`li[data-id="${note.id}"] .exe-iv-saved-status`) as HTMLElement;
            expect(status).not.toBeNull();
            expect(status.classList.contains('is-saved')).toBe(false);
            expect(status.textContent).toBe('');

            const body = document.getElementById('ivDetailBody') as HTMLTextAreaElement;
            body.value = '<p>Hi</p>';
            body.dispatchEvent(new Event('input', { bubbles: true }));

            expect(status.classList.contains('is-saved')).toBe(true);
            expect(status.textContent).toContain('Saved');
            expect(status.querySelector('.exe-icon')?.textContent).toBe('check');
            expect(status.getAttribute('role')).toBe('status');

            // A second edit re-confirms (the state class is re-applied).
            body.value = '<p>Hi again</p>';
            body.dispatchEvent(new Event('input', { bubbles: true }));
            expect(status.classList.contains('is-saved')).toBe(true);
        });

        it('is a safe no-op when the interaction has no rendered row', () => {
            expect(() => harness.editor.flashSavedStatus(createInteraction('note', 'iv-ghost', 1))).not.toThrow();
        });

        it('does not appear from merely expanding a card (TinyMCE init is not an edit)', () => {
            const note = addAt('00:05', 'note');
            (harness.state.doc.interactions.find(i => i.id === note.id) as { body: string }).body = '<p>Existing</p>';
            // Collapse and re-expand: the body editor re-initializes over the
            // existing content, firing TinyMCE's init-time events.
            rowButton(note.id)?.click();
            rowButton(note.id)?.click();
            const status = document.querySelector(`li[data-id="${note.id}"] .exe-iv-saved-status`) as HTMLElement;
            expect(status.classList.contains('is-saved')).toBe(false);
            expect(status.textContent).toBe('');
        });

        it('fades out on its own after a few seconds', () => {
            vi.useFakeTimers();
            try {
                const note = addAt('00:05', 'note');
                const body = document.getElementById('ivDetailBody') as HTMLTextAreaElement;
                body.value = '<p>Hi</p>';
                body.dispatchEvent(new Event('input', { bubbles: true }));
                const status = document.querySelector(`li[data-id="${note.id}"] .exe-iv-saved-status`) as HTMLElement;
                expect(status.classList.contains('is-saved')).toBe(true);
                vi.advanceTimersByTime(4100);
                expect(status.classList.contains('is-saved')).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    describe('the Done (collapse) button', () => {
        it('appears only on the expanded row and folds its editor back up', () => {
            const first = addAt('00:05', 'note');
            const second = addAt('00:10', 'question');
            // `second` is selected; only it offers Done.
            expect(document.querySelector(`li[data-id="${second.id}"] .exe-iv-edit-done`)).not.toBeNull();
            expect(document.querySelector(`li[data-id="${first.id}"] .exe-iv-edit-done`)).toBeNull();

            (document.querySelector(`li[data-id="${second.id}"] .exe-iv-edit-done`) as HTMLElement).click();
            expect(harness.state.selectedId).toBeNull();
            expect(document.getElementById('ivDetailPanel')).toBeNull();
            expect(rowButton(second.id)?.getAttribute('aria-expanded')).toBe('false');
        });
    });
});
