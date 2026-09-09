/**
 * The rich-text body editor for note/pause/cover interactions.
 *
 * This attaches eXe's own shared TinyMCE configuration (`$exeTinyMCE`) to the
 * single `#ivDetailBody` textarea — not a bespoke config. That is what gives
 * the body the Media Library image and media buttons (`exeimage`/`exemedia`),
 * so an image inserted here is stored as an `asset://` reference and travels
 * through preview, export and .elpx like any other eXe image. Degrades
 * gracefully: with no TinyMCE (unit tests) the plain textarea and its input
 * binding are used, and `readEditor()` falls back to the raw value.
 */

import type { Interaction } from '../shared/types';
import type { EditionState } from './state';
import { findInteraction } from './state';

/** Read a rich-text field: the live TinyMCE content, else the raw value. */
export function readEditor(id: string): string {
    if (typeof tinyMCE !== 'undefined' && tinyMCE?.get?.(id)) {
        return tinyMCE.get(id)?.getContent() ?? '';
    }
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    return el ? el.value : '';
}

/**
 * Attach the shared TinyMCE to the body textarea of the selected interaction.
 * The textarea only exists while an interaction is selected, so the page-wide
 * `.exe-html-editor` pass has long finished by then and this per-field init is
 * the hook. `onEdit` keeps the row summary / validity / live preview in sync
 * as the author types (TinyMCE does not bubble DOM input events); its
 * `changed` argument is false for the events TinyMCE fires while merely
 * INITIALIZING (SetContent/NodeChange with a pristine document), so callers
 * can tell a real edit from opening the card.
 */
export function initBodyEditor(
    state: EditionState,
    interaction: Interaction,
    onEdit: (changed: boolean) => void,
): void {
    if (!document.getElementById('ivDetailBody')) {
        return;
    }
    state.bodyEditorId = interaction.id;
    if (typeof tinymce === 'undefined' || !tinymce?.init) {
        return;
    }
    if (tinymce.get?.('ivDetailBody')) {
        tinymce.get('ivDetailBody')?.remove();
    }
    if (typeof $exeTinyMCE !== 'undefined' && $exeTinyMCE?.init) {
        $exeTinyMCE.init('multiple-visible', '#ivDetailBody');
    } else {
        return;
    }
    whenBodyEditorReady(editor => {
        editor.on('input change keyup NodeChange SetContent', () => {
            // Read the dirty state BEFORE save(): editor.save() resets it.
            const changed = typeof editor.isDirty === 'function' ? editor.isDirty() : true;
            editor.save();
            onEdit(changed);
        });
    });
}

/**
 * Run `callback` with the body editor once TinyMCE has created it. The shared
 * init is asynchronous, so poll briefly rather than assume it is ready.
 */
function whenBodyEditorReady(callback: (editor: ExeTinyMceEditor) => void): void {
    let tries = 0;
    function attempt(): void {
        const editor = typeof tinymce !== 'undefined' && tinymce?.get ? tinymce.get('ivDetailBody') : null;
        if (editor) {
            callback(editor);
            return;
        }
        tries += 1;
        if (tries < 100) {
            setTimeout(attempt, 30);
        }
    }
    attempt();
}

/**
 * Flush the open body editor back into its interaction and tear down the
 * TinyMCE instance, BEFORE the accordion/detail DOM is rebuilt. Idempotent: a
 * no-op when no body editor is open. Called from every re-render and from
 * collect() so edits are never lost.
 */
export function commitBodyEditor(state: EditionState): void {
    if (!state.bodyEditorId) {
        return;
    }
    if (document.getElementById('ivDetailBody')) {
        const interaction = findInteraction(state.doc, state.bodyEditorId);
        if (interaction && 'body' in interaction) {
            interaction.body = readEditor('ivDetailBody');
        }
    }
    if (typeof tinymce !== 'undefined' && tinymce?.get?.('ivDetailBody')) {
        tinymce.get('ivDetailBody')?.remove();
    }
    state.bodyEditorId = null;
}
