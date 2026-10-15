import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditionHarness } from '../test/helpers';
import { installEditionHarness, makeState, withoutGlobal } from '../test/helpers';
import type { QuestionInteraction } from '../shared/types';
import { commitBodyEditor, initBodyEditor, readEditor } from './body-editor';
import type { EditionState } from './state';
import { createInteraction } from './state';

/** The body textarea the detail editor renders for note/pause/cover. */
function mountBodyField(value = ''): HTMLTextAreaElement {
    document.body.innerHTML = '<textarea id="ivDetailBody" class="form-control exe-html-editor"></textarea>';
    const field = document.getElementById('ivDetailBody') as HTMLTextAreaElement;
    field.value = value;
    return field;
}

function bodyEditor(): { setContent(html: string): void; getContent(): string } | null {
    return tinymce?.get?.('ivDetailBody') as unknown as {
        setContent(html: string): void;
        getContent(): string;
    } | null;
}

describe('readEditor', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('reads the raw textarea value when no rich-text editor is attached', () => {
        mountBodyField('<p>Plain</p>');
        expect(readEditor('ivDetailBody')).toBe('<p>Plain</p>');
    });

    it('reads the live editor content when TinyMCE owns the field', () => {
        const harness = installEditionHarness();
        try {
            mountBodyField();
            initBodyEditor(makeState(), createInteraction('note', 'iv-0', 1), () => {});
            bodyEditor()?.setContent('<p>Rich</p>');
            expect(readEditor('ivDetailBody')).toContain('Rich');
        } finally {
            harness.restore();
        }
    });

    it('returns an empty string when the field does not exist', () => {
        expect(readEditor('ivDetailBody')).toBe('');
    });
});

describe('initBodyEditor', () => {
    let harness: EditionHarness;
    let state: EditionState;

    beforeEach(() => {
        harness = installEditionHarness();
        state = makeState();
    });

    afterEach(() => {
        harness.restore();
    });

    it('does nothing when no body field is rendered (question detail)', () => {
        document.body.innerHTML = '';
        initBodyEditor(state, createInteraction('note', 'iv-0', 1), () => {});
        expect(state.bodyEditorId).toBeNull();
        expect(harness.stubs.tinyMceInit).not.toHaveBeenCalled();
    });

    it("attaches eXe's SHARED rich-text editor to the body field", () => {
        mountBodyField();
        const interaction = createInteraction('note', 'iv-3', 1);
        initBodyEditor(state, interaction, () => {});
        expect(state.bodyEditorId).toBe('iv-3');
        // The SHARED editor is what gets attached — that is where the Media
        // Library image/media buttons come from.
        expect(harness.stubs.tinyMceInit).toHaveBeenCalledWith('multiple-visible', '#ivDetailBody');
        expect(bodyEditor()).not.toBeNull();
    });

    it('replaces a stale editor instance left on the same field', () => {
        mountBodyField();
        initBodyEditor(state, createInteraction('note', 'iv-0', 1), () => {});
        const first = bodyEditor();
        initBodyEditor(state, createInteraction('note', 'iv-1', 2), () => {});
        expect(harness.stubs.tinyMceInit).toHaveBeenCalledTimes(2);
        expect(bodyEditor()).not.toBe(first);
        expect(state.bodyEditorId).toBe('iv-1');
    });

    it('reports edits so the row summary, validity and preview stay in sync', () => {
        mountBodyField();
        const onEdit = vi.fn();
        initBodyEditor(state, createInteraction('note', 'iv-0', 1), onEdit);
        bodyEditor()?.setContent('<p>Typing</p>');
        expect(onEdit).toHaveBeenCalled();
    });

    it('tells real edits apart from initialization events via the dirty state', () => {
        mountBodyField();
        const handlers: Array<() => void> = [];
        let dirty = false;
        const editor = {
            getContent: () => '<p>x</p>',
            save: vi.fn(() => {
                // TinyMCE's save() resets the dirty state; the flag must have
                // been read BEFORE, or every event would report "unchanged".
                dirty = false;
            }),
            remove: () => {},
            isDirty: () => dirty,
            on: (_events: string, handler: () => void) => handlers.push(handler),
        };
        const holder = globalThis as unknown as Record<string, unknown>;
        const previousTinymce = holder.tinymce;
        holder.tinymce = { init: () => {}, get: () => editor };
        try {
            const onEdit = vi.fn();
            initBodyEditor(state, createInteraction('note', 'iv-0', 1), onEdit);
            // Initialization-time SetContent: pristine document -> changed=false.
            handlers[0]?.();
            expect(onEdit).toHaveBeenLastCalledWith(false);
            // The author types: dirty -> changed=true (read before save reset it).
            dirty = true;
            handlers[0]?.();
            expect(onEdit).toHaveBeenLastCalledWith(true);
            expect(editor.save).toHaveBeenCalledTimes(2);
        } finally {
            holder.tinymce = previousTinymce;
        }
    });

    it('degrades to the plain textarea when TinyMCE is not on the page', () => {
        mountBodyField();
        withoutGlobal('tinymce', () => {
            initBodyEditor(state, createInteraction('note', 'iv-0', 1), () => {});
        });
        // The field is still owned by the editor state (so commit flushes it),
        // but no rich-text instance was requested.
        expect(state.bodyEditorId).toBe('iv-0');
        expect(harness.stubs.tinyMceInit).not.toHaveBeenCalled();
    });

    it('waits for the shared (asynchronous) init before wiring the edit signals', () => {
        vi.useFakeTimers();
        try {
            mountBodyField();
            const handlers: Array<() => void> = [];
            const editor = {
                getContent: () => '<p>Late</p>',
                save: () => {},
                remove: () => {},
                on: (_events: string, handler: () => void) => handlers.push(handler),
            };
            let ready = false;
            const holder = globalThis as unknown as Record<string, unknown>;
            const previousTinymce = holder.tinymce;
            holder.tinymce = { init: () => {}, get: () => (ready ? editor : null) };
            try {
                const onEdit = vi.fn();
                initBodyEditor(state, createInteraction('note', 'iv-0', 1), onEdit);
                // Nothing to wire yet: the shared init has not created it.
                expect(handlers).toHaveLength(0);
                ready = true;
                vi.advanceTimersByTime(30);
                expect(handlers).toHaveLength(1);
                handlers[0]?.();
                expect(onEdit).toHaveBeenCalled();
            } finally {
                holder.tinymce = previousTinymce;
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('gives up politely when the shared init never produces an editor', () => {
        vi.useFakeTimers();
        try {
            mountBodyField();
            const holder = globalThis as unknown as Record<string, unknown>;
            const previousTinymce = holder.tinymce;
            holder.tinymce = { init: () => {}, get: () => null };
            try {
                initBodyEditor(state, createInteraction('note', 'iv-0', 1), () => {});
                // 100 attempts, 30 ms apart, then it stops rescheduling.
                vi.advanceTimersByTime(30 * 120);
                expect(vi.getTimerCount()).toBe(0);
            } finally {
                holder.tinymce = previousTinymce;
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it('degrades when the shared bootstrapper is missing', () => {
        mountBodyField();
        withoutGlobal('$exeTinyMCE', () => {
            initBodyEditor(state, createInteraction('note', 'iv-0', 1), () => {});
        });
        expect(state.bodyEditorId).toBe('iv-0');
        expect(bodyEditor()).toBeNull();
    });
});

describe('commitBodyEditor', () => {
    let harness: EditionHarness;
    let state: EditionState;

    beforeEach(() => {
        harness = installEditionHarness();
        state = makeState();
    });

    afterEach(() => {
        harness.restore();
    });

    it('flushes the open editor into the interaction and tears TinyMCE down', () => {
        const interaction = createInteraction('note', 'iv-0', 1);
        state.doc.interactions = [interaction];
        mountBodyField();
        initBodyEditor(state, interaction, () => {});
        bodyEditor()?.setContent('<p>Typed body</p>');
        commitBodyEditor(state);
        expect(interaction).toHaveProperty('body');
        expect((interaction as { body: string }).body).toContain('Typed body');
        expect(state.bodyEditorId).toBeNull();
        expect(bodyEditor()).toBeNull();
    });

    it('keeps an image inserted in the body, asset reference and all', () => {
        const interaction = createInteraction('cover', 'iv-0', 0);
        state.doc.interactions = [interaction];
        mountBodyField();
        initBodyEditor(state, interaction, () => {});
        bodyEditor()?.setContent('<p><img src="asset://abc123/photo.jpg" alt="Una foto"></p>');
        commitBodyEditor(state);
        const body = (interaction as { body: string }).body;
        expect(body).toContain('asset://abc123/photo.jpg');
        expect(body).toContain('Una foto');
    });

    it('flushes the plain textarea when there is no rich-text editor', () => {
        const interaction = createInteraction('pause', 'iv-0', 4);
        state.doc.interactions = [interaction];
        mountBodyField('<p>From the textarea</p>');
        state.bodyEditorId = 'iv-0';
        commitBodyEditor(state);
        expect((interaction as { body: string }).body).toBe('<p>From the textarea</p>');
    });

    it('is a no-op when no body editor is open, and is idempotent', () => {
        commitBodyEditor(state);
        expect(state.bodyEditorId).toBeNull();
        const interaction = createInteraction('note', 'iv-0', 1);
        state.doc.interactions = [interaction];
        mountBodyField('<p>Once</p>');
        state.bodyEditorId = 'iv-0';
        commitBodyEditor(state);
        (interaction as { body: string }).body = 'untouched';
        commitBodyEditor(state);
        expect((interaction as { body: string }).body).toBe('untouched');
    });

    it('never invents a body on an interaction that has none', () => {
        const interaction = createInteraction('question', 'iv-0', 1) as QuestionInteraction;
        state.doc.interactions = [interaction];
        mountBodyField('<p>Stray</p>');
        state.bodyEditorId = 'iv-0';
        commitBodyEditor(state);
        expect(interaction).not.toHaveProperty('body');
        expect(state.bodyEditorId).toBeNull();
    });

    it('clears the open-editor state even when the field is already gone', () => {
        state.bodyEditorId = 'iv-0';
        document.body.innerHTML = '';
        commitBodyEditor(state);
        expect(state.bodyEditorId).toBeNull();
    });
});
