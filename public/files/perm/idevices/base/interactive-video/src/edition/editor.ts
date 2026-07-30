/**
 * The single-editor accordion: one list where the selected row expands and
 * hosts the detail editor inside its own `<li>`, with keyboard navigation
 * (roving tabindex), inline delete confirmation, a live preview card of the
 * selected interaction, and the timeline markers kept in sync.
 */

import { escapeHtml } from '../shared/html';
import { sortInteractions } from '../shared/scheduling';
import { secondsToHms, toSeconds } from '../shared/time';
import type { Interaction, InteractionType } from '../shared/types';
import { commitBodyEditor, initBodyEditor, readEditor } from './body-editor';
import { typeLabel } from './form';
import { bindCommonFields, bindDetailForType, commonFieldsHtml, detailForType } from './interactions/common';
import type { DetailHost } from './interactions/types';
import { announce, renderTimelineMarkers, seekTo, useCurrentTime } from './player';
import type { EditionState } from './state';
import { createInteraction, duplicateOf, findCover, findInteraction, nextInteractionId, tr } from './state';

/** How long the per-row "Saved" confirmation stays visible. */
const SAVED_STATUS_VISIBLE_MS = 4000;

export interface Editor extends DetailHost {
    rerender(): void;
    renderInteractionList(): void;
    refreshMarkers(): void;
    addInteraction(type: InteractionType): void;
    deleteInteraction(id: string): void;
    duplicateInteraction(id: string): void;
    selectMarker(id: string): void;
    focusRowButton(id: string): boolean;
    focusFirstEditorField(): void;
    flashSavedStatus(interaction: Interaction): void;
}

/** Strip tags and collapse whitespace to a short single-line excerpt. */
export function excerpt(value: unknown, max?: number): string {
    const limit = max || 60;
    let text = String(value == null ? '' : value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (text.length > limit) {
        text = text.slice(0, limit - 1) + '…';
    }
    return text;
}

/** The one-line summary shown in a list row (title, else excerpt, else type). */
export function summaryText(interaction: Interaction): string {
    if (interaction.type === 'question' && interaction.question && interaction.question.prompt) {
        return excerpt(interaction.question.prompt);
    }
    if (interaction.type === 'cover' && interaction.title) {
        return excerpt(interaction.title);
    }
    if (
        (interaction.type === 'note' || interaction.type === 'pause' || interaction.type === 'cover') &&
        interaction.body
    ) {
        return excerpt(interaction.body);
    }
    return tr(typeLabel(interaction.type));
}

/** A short validity hint for a row, or '' when the interaction is complete. */
export function rowValidity(interaction: Interaction): string {
    if (interaction.type === 'question') {
        const question = interaction.question;
        const prompt = String(question?.prompt == null ? '' : question.prompt)
            .replace(/<[^>]*>/g, '')
            .trim();
        if (!prompt) {
            return tr('This question has no text yet.');
        }
    }
    return '';
}

/**
 * Row action controls. Reuses the standard workarea icon sprites
 * (duplicate-icon-green / delete-icon-red) with native `title` tooltips and
 * `aria-label`s. There is no separate "edit" control: expanding the row IS
 * entering edition. Delete switches the row to an inline Yes/No confirm.
 */
function rowActionsHtml(interaction: Interaction, isSelected: boolean): string {
    const t = tr;
    const id = interaction.id;
    // An expanded row offers an explicit way to fold its editor back up (the
    // row header and Esc also collapse; this makes it discoverable). A check
    // icon, not a diskette: nothing is persisted here — the change is already
    // in the working document, and the diskette would promise a save that only
    // happens with the iDevice's own Save.
    const doneButton = isSelected
        ? '<button type="button" class="btn btn-secondary exe-iv-edit-done" data-id="' +
          id +
          '" title="' +
          t('Done') +
          '" aria-label="' +
          t('Done (collapse this editor)') +
          '"><span class="exe-icon" aria-hidden="true">check</span></button>'
        : '';
    return (
        // The transient "Saved" chip sits left of the actions; role=status
        // makes each confirmation audible to screen readers too (mirrors the
        // file manager's metadata autosave indicator, PR #1868).
        '<span class="exe-iv-saved-status" role="status" aria-live="polite"></span>' +
        '<span class="btn-group btn-group-sm exe-iv-edit-actions" role="group">' +
        doneButton +
        '<button type="button" class="btn btn-secondary exe-iv-edit-dup" data-id="' +
        id +
        '" title="' +
        t('Duplicate') +
        '" aria-label="' +
        t('Duplicate') +
        '"><span class="small-icon duplicate-icon-green" aria-hidden="true"></span></button>' +
        '<button type="button" class="btn btn-secondary exe-iv-edit-del" data-id="' +
        id +
        '" title="' +
        t('Delete') +
        '" aria-label="' +
        t('Delete') +
        '"><span class="small-icon delete-icon-red" aria-hidden="true"></span></button>' +
        '</span>'
    );
}

export function createEditor(state: EditionState): Editor {
    let savedStatusTimer: ReturnType<typeof setTimeout> | null = null;
    const editor: Editor = {
        state: state,
        announce: announce,

        /** Re-render the list, the selected editor and the marker strip together. */
        rerender() {
            // A full rerender (add / duplicate / select / delete) always clears
            // the pending inline delete-confirm; only the delete button itself
            // sets it and re-renders the list directly.
            state.confirmDeleteId = null;
            editor.renderInteractionList();
            editor.renderDetail();
            editor.refreshMarkers();
        },

        refreshMarkers() {
            renderTimelineMarkers(state, editor.selectMarker);
        },

        renderInteractionList() {
            const list = $('#ivInteractionList');
            if (!list.length) {
                return;
            }
            // Flush any open body editor before the list (and its detail
            // panel) is rebuilt, so edits survive the re-render.
            commitBodyEditor(state);
            state.doc.interactions = sortInteractions(state.doc.interactions);
            const t = tr;
            const html = state.doc.interactions
                .map(interaction => {
                    // Inline delete confirmation replaces the whole row with a
                    // banner (no modal).
                    if (interaction.id === state.confirmDeleteId) {
                        return (
                            '<li class="exe-iv-edit-item is-confirming" data-id="' +
                            interaction.id +
                            '"><div class="exe-iv-delete-confirm" role="group" aria-label="' +
                            t('Delete this interaction?') +
                            '"><span class="exe-iv-delete-confirm-text">' +
                            t('Delete this interaction?') +
                            '</span><div class="exe-iv-delete-confirm-actions">' +
                            '<button type="button" class="btn btn-sm btn-danger exe-iv-edit-del-yes" data-id="' +
                            interaction.id +
                            '">' +
                            t('Delete') +
                            '</button><button type="button" class="btn btn-sm btn-secondary exe-iv-edit-del-no" data-id="' +
                            interaction.id +
                            '">' +
                            t('Cancel') +
                            '</button></div></div></li>'
                        );
                    }
                    const isSelected = interaction.id === state.selectedId;
                    const validity = rowValidity(interaction);
                    const validityHtml = validity
                        ? '<span class="exe-iv-edit-validity" title="' +
                          escapeHtml(validity) +
                          '" aria-label="' +
                          escapeHtml(validity) +
                          '">⚠</span>'
                        : '';
                    // The selected row hosts the single editor inside the <li>,
                    // as a sibling of the row button (never nested in a button).
                    const detailHtml = isSelected ? '<div class="exe-iv-edit-detail" id="ivDetailPanel"></div>' : '';
                    return (
                        '<li class="exe-iv-edit-item exe-iv-kind--' +
                        escapeHtml(interaction.type) +
                        (isSelected ? ' is-selected' : '') +
                        '" data-id="' +
                        interaction.id +
                        '">' +
                        '<div class="exe-iv-edit-row">' +
                        '<button type="button" class="exe-iv-edit-select" data-id="' +
                        interaction.id +
                        '" aria-expanded="' +
                        (isSelected ? 'true' : 'false') +
                        '" tabindex="' +
                        (isSelected ? '0' : '-1') +
                        '">' +
                        '<span class="exe-iv-edit-time">' +
                        secondsToHms(interaction.time) +
                        '</span>' +
                        '<span class="badge exe-iv-edit-badge">' +
                        escapeHtml(t(typeLabel(interaction.type))) +
                        '</span>' +
                        '<span class="exe-iv-edit-summary">' +
                        escapeHtml(summaryText(interaction)) +
                        '</span>' +
                        validityHtml +
                        '</button>' +
                        rowActionsHtml(interaction, isSelected) +
                        '</div>' +
                        detailHtml +
                        '</li>'
                    );
                })
                .join('');
            list.html(
                html ||
                    '<li class="exe-iv-empty exe-iv-hint" role="note">' +
                        t('No interactions yet. Use the buttons above to add a note, question, pause or jump.') +
                        '</li>',
            );
            // Interaction count shown next to the section title.
            const count = state.doc.interactions.length;
            const countEl = document.getElementById('ivInteractionsCount');
            if (countEl) {
                countEl.textContent = count ? count + ' ' + t(count === 1 ? 'interaction' : 'interactions') : '';
            }
            // Roving tabindex: when nothing is selected, the first row is tabbable.
            if (!state.selectedId) {
                const firstButton = list[0]?.querySelector('.exe-iv-edit-select');
                if (firstButton) {
                    firstButton.setAttribute('tabindex', '0');
                }
            }

            list.find('.exe-iv-edit-select').on('click', function () {
                toggleRow($(this).attr('data-id') ?? '');
            });
            list.find('.exe-iv-edit-done').on('click', function () {
                toggleRow($(this).attr('data-id') ?? '');
            });
            list.find('.exe-iv-edit-dup').on('click', function () {
                editor.duplicateInteraction($(this).attr('data-id') ?? '');
            });
            // Delete asks for inline confirmation first (no modal). Collapse
            // the row's editor while confirming so cancelling returns to a
            // clean collapsed row.
            list.find('.exe-iv-edit-del').on('click', function () {
                state.selectedId = null;
                state.confirmDeleteId = $(this).attr('data-id') ?? null;
                editor.renderInteractionList();
            });
            list.find('.exe-iv-edit-del-yes').on('click', function () {
                const id = $(this).attr('data-id') ?? '';
                state.confirmDeleteId = null;
                editor.deleteInteraction(id);
            });
            list.find('.exe-iv-edit-del-no').on('click', function () {
                state.confirmDeleteId = null;
                editor.renderInteractionList();
                editor.focusRowButton($(this).attr('data-id') ?? '');
            });

            // Keyboard: roving Arrow/Home/End navigation, Enter/Space expand,
            // Esc collapse. Bound once on the container via delegation.
            list.off('keydown.ivkbd').on('keydown.ivkbd', event => {
                onListKeydown(event);
            });
        },

        renderDetail() {
            const panel = $('#ivDetailPanel');
            if (!panel.length) {
                editor.renderEditPreview();
                return;
            }
            const interaction = findInteraction(state.doc, state.selectedId);
            if (!interaction) {
                return;
            }
            // Preserve focus/caret across re-renders (e.g. adding an answer row).
            const active = document.activeElement as HTMLInputElement | null;
            const activeId = active?.id;
            const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;

            // Flush the previously-open body editor before replacing the DOM.
            commitBodyEditor(state);
            panel.html(
                '<h4 class="exe-iv-detail-heading">' +
                    tr(typeLabel(interaction.type)) +
                    '</h4>' +
                    commonFieldsHtml(interaction) +
                    detailForType(interaction),
            );

            // Restore focus/caret if the previously-active field still exists.
            if (activeId) {
                const restored = document.getElementById(activeId) as HTMLInputElement | null;
                if (restored?.focus) {
                    restored.focus();
                    if (caret != null && restored.setSelectionRange) {
                        try {
                            restored.setSelectionRange(caret, caret);
                        } catch {
                            /* not a text field */
                        }
                    }
                }
            }

            bindCommonFields(interaction, editor);
            bindDetailForType(interaction, editor);
            // Keep the row's "incomplete" warning (⚠) live: any edit inside
            // the open editor re-evaluates validity so the badge clears as
            // soon as the fields are filled. Namespaced off/on: renderDetail
            // re-runs in place (add answer, kind switch…) and `.html()` does
            // not unbind the panel itself, so a plain `.on` would stack a
            // handler per re-render.
            panel.off('input.ivdetail change.ivdetail').on('input.ivdetail change.ivdetail', () => {
                editor.refreshRowValidity(interaction);
                editor.renderEditPreview();
                editor.flashSavedStatus(interaction);
            });
            // Attach the shared lite TinyMCE to the body textarea.
            initBodyEditor(state, interaction, changed => {
                // Always resync: SetContent changes content without dirtying
                // the editor (programmatic writes), so `changed` cannot gate
                // the preview/validity refresh — only the confirmation chip.
                editor.refreshRowValidity(interaction);
                editor.renderEditPreview();
                // TinyMCE fires SetContent/NodeChange while merely
                // initializing; only a real edit earns the confirmation.
                if (changed) {
                    editor.flashSavedStatus(interaction);
                }
            });
            editor.renderEditPreview();
        },

        /**
         * Live preview of the selected interaction in the right-hand edit
         * panel, mirroring the learner side-panel. Reflects unsaved body edits
         * from the open editor; shows a placeholder when nothing is selected.
         */
        renderEditPreview() {
            const panel = document.getElementById('ivEditPreview');
            if (!panel) {
                return;
            }
            const t = tr;
            const interaction = state.selectedId ? findInteraction(state.doc, state.selectedId) : undefined;
            if (!interaction) {
                panel.innerHTML =
                    '<p class="exe-iv-hint">' + escapeHtml(t('Select an interaction to preview it here.')) + '</p>';
                return;
            }
            // Reflect the latest (possibly unsaved) body from the open editor.
            if (
                state.bodyEditorId === interaction.id &&
                document.getElementById('ivDetailBody') &&
                'body' in interaction
            ) {
                interaction.body = readEditor('ivDetailBody');
            }
            let inner: string;
            if (interaction.type === 'note' || interaction.type === 'pause' || interaction.type === 'cover') {
                const coverTitle =
                    interaction.type === 'cover' && interaction.title
                        ? '<h3 class="exe-iv-cover-title">' + escapeHtml(interaction.title) + '</h3>'
                        : '';
                inner = '<div class="exe-iv-edit-preview-body">' + coverTitle + (interaction.body || '') + '</div>';
            } else if (interaction.type === 'question') {
                const prompt = interaction.question?.prompt || '';
                inner =
                    '<div class="exe-iv-edit-preview-body">' +
                    (prompt || '<span class="exe-iv-hint">' + escapeHtml(t('No question text yet.')) + '</span>') +
                    '</div>';
            } else if (interaction.type === 'jump') {
                inner = '<p class="exe-iv-hint">' + escapeHtml(t('Jumps the video to another time.')) + '</p>';
            } else {
                inner = '';
            }
            panel.innerHTML =
                '<div class="exe-iv-edit-preview-card exe-iv-kind--' +
                escapeHtml(interaction.type) +
                '"><h5 class="exe-iv-edit-preview-title">' +
                escapeHtml(t(typeLabel(interaction.type))) +
                '</h5>' +
                inner +
                '</div>';
        },

        addInteraction(type) {
            // The cover is a singleton pinned to the start; block a second one.
            if (type === 'cover' && findCover(state.doc)) {
                const message = tr('There is already a cover. You can only add one per video.');
                announce(message);
                if (typeof eXe !== 'undefined' && eXe?.app?.alert) {
                    eXe.app.alert(message);
                }
                return;
            }
            const time = type === 'cover' ? 0 : toSecondsFromAddBar();
            const interaction = createInteraction(type, nextInteractionId(state.doc), time);
            state.doc.interactions.push(interaction);
            state.doc.interactions = sortInteractions(state.doc.interactions);
            state.selectedId = interaction.id;
            editor.rerender();
            announce(tr('Editing') + ' ' + tr(typeLabel(type)));
            editor.focusFirstEditorField();
        },

        deleteInteraction(id) {
            const interactions = state.doc.interactions;
            let idx = -1;
            for (let i = 0; i < interactions.length; i++) {
                if (interactions[i]?.id === id) {
                    idx = i;
                    break;
                }
            }
            // Choose the focus target before removal: next row, else previous.
            let neighbourId: string | null = null;
            if (idx > -1) {
                if (interactions[idx + 1]) {
                    neighbourId = interactions[idx + 1]?.id ?? null;
                } else if (interactions[idx - 1]) {
                    neighbourId = interactions[idx - 1]?.id ?? null;
                }
            }
            state.doc.interactions = interactions.filter(interaction => interaction.id !== id);
            if (state.selectedId === id) {
                state.selectedId = null;
            }
            editor.rerender();
            if (neighbourId && editor.focusRowButton(neighbourId)) {
                return;
            }
            const addButton = document.getElementById('ivAddQuestion');
            if (addButton) {
                addButton.focus();
            }
        },

        duplicateInteraction(id) {
            const source = findInteraction(state.doc, id);
            if (!source) {
                return;
            }
            const copy = duplicateOf(source, nextInteractionId(state.doc));
            state.doc.interactions.push(copy);
            state.doc.interactions = sortInteractions(state.doc.interactions);
            state.selectedId = copy.id;
            editor.rerender();
            editor.focusFirstEditorField();
        },

        /** Marker click: select the row and seek the player to that time. */
        selectMarker(id) {
            const interaction = findInteraction(state.doc, id);
            state.selectedId = id;
            editor.rerender();
            if (interaction) {
                seekTo(state, interaction.time);
                announce(tr('Seeking to') + ' ' + secondsToHms(interaction.time));
            }
            editor.focusRowButton(id);
        },

        /** Focus a row's select button; returns true if it exists. */
        focusRowButton(id) {
            const button = document.querySelector<HTMLButtonElement>(
                '#ivInteractionList li[data-id="' + id + '"] .exe-iv-edit-select',
            );
            if (button) {
                button.setAttribute('tabindex', '0');
                button.focus();
                return true;
            }
            return false;
        },

        /** Focus the first editable field inside the expanded editor. */
        focusFirstEditorField() {
            const panel = document.getElementById('ivDetailPanel');
            if (!panel) {
                return;
            }
            const field = panel.querySelector<HTMLElement>('input, select, textarea');
            if (field?.focus) {
                field.focus();
            }
        },

        /** Update a row's summary text in place (no full re-render) while typing. */
        updateRowSummary(interaction) {
            const row = document.querySelector('#ivInteractionList li[data-id="' + interaction.id + '"]');
            const summary = row?.querySelector('.exe-iv-edit-summary');
            if (summary) {
                summary.textContent = summaryText(interaction);
            }
        },

        /**
         * Reconcile a row's "incomplete" warning badge (⚠) in place while the
         * author edits its fields, so it clears the moment the question
         * becomes valid — instead of lingering until the row is collapsed and
         * reopened.
         */
        refreshRowValidity(interaction) {
            const row = document.querySelector('#ivInteractionList li[data-id="' + interaction.id + '"]');
            const button = row?.querySelector('.exe-iv-edit-select');
            if (!button) {
                return;
            }
            let badge = button.querySelector('.exe-iv-edit-validity');
            const validity = rowValidity(interaction);
            if (validity) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'exe-iv-edit-validity';
                    badge.textContent = '⚠';
                    button.appendChild(badge);
                }
                badge.setAttribute('title', validity);
                badge.setAttribute('aria-label', validity);
            } else if (badge?.parentNode) {
                badge.parentNode.removeChild(badge);
            }
        },

        useCurrentTime(targetId) {
            return useCurrentTime(state, targetId);
        },

        /**
         * Show the green "Saved" check in the row header each time an edit
         * lands in the working document (the change is kept from that moment
         * on; the workarea Save persists the whole iDevice). Re-adding the
         * state class restarts the fade-in so repeated edits visibly re-confirm.
         */
        flashSavedStatus(interaction) {
            const row = document.querySelector('#ivInteractionList li[data-id="' + interaction.id + '"]');
            const status = row?.querySelector('.exe-iv-saved-status');
            if (!(status instanceof HTMLElement)) {
                return;
            }
            status.classList.remove('is-saved');
            // Force a reflow so removing+re-adding the class restarts the animation.
            void status.offsetWidth;
            status.innerHTML = '<span class="exe-icon" aria-hidden="true">check</span> ' + escapeHtml(tr('Saved'));
            status.classList.add('is-saved');
            // Fade the confirmation out after a few seconds: the screen reader
            // announced it when it appeared, and a permanent "Saved" would go
            // stale the moment the author types again.
            if (savedStatusTimer) {
                clearTimeout(savedStatusTimer);
            }
            savedStatusTimer = setTimeout(() => {
                savedStatusTimer = null;
                status.classList.remove('is-saved');
            }, SAVED_STATUS_VISIBLE_MS);
        },
    };

    /** Toggle a row: collapse it if already open, otherwise expand it. */
    function toggleRow(id: string): void {
        if (state.selectedId === id) {
            state.selectedId = null;
            state.confirmDeleteId = null;
            editor.rerender();
            editor.focusRowButton(id);
            return;
        }
        selectRow(id);
    }

    /** Select a row (expand it) without seeking; re-renders and keeps focus. */
    function selectRow(id: string): void {
        state.selectedId = id;
        state.confirmDeleteId = null;
        editor.rerender();
        const interaction = findInteraction(state.doc, id);
        if (interaction) {
            announce(tr('Editing') + ' ' + tr(typeLabel(interaction.type)) + ' — ' + secondsToHms(interaction.time));
        }
        editor.focusRowButton(id);
    }

    /** Keyboard handler for the accordion list (delegated on the <ol>). */
    function onListKeydown(event: ExeJQueryEvent): void {
        const list = document.getElementById('ivInteractionList');
        if (!list) {
            return;
        }
        const domEvent = event as unknown as KeyboardEvent & { target: HTMLElement };
        const target = domEvent.target;
        if (domEvent.key === 'Escape') {
            const li = target.closest ? target.closest('li[data-id]') : null;
            const id = li ? li.getAttribute('data-id') : state.selectedId;
            if (state.selectedId) {
                state.selectedId = null;
                editor.rerender();
                if (id) {
                    editor.focusRowButton(id);
                }
                domEvent.preventDefault();
            }
            return;
        }
        const isRowButton = target.classList?.contains('exe-iv-edit-select');
        if (!isRowButton) {
            return;
        }
        const buttons = Array.prototype.slice.call(list.querySelectorAll('.exe-iv-edit-select')) as HTMLButtonElement[];
        const index = buttons.indexOf(target as HTMLButtonElement);
        if (domEvent.key === 'ArrowDown') {
            domEvent.preventDefault();
            focusRovingIndex(buttons, index + 1);
        } else if (domEvent.key === 'ArrowUp') {
            domEvent.preventDefault();
            focusRovingIndex(buttons, index - 1);
        } else if (domEvent.key === 'Home') {
            domEvent.preventDefault();
            focusRovingIndex(buttons, 0);
        } else if (domEvent.key === 'End') {
            domEvent.preventDefault();
            focusRovingIndex(buttons, buttons.length - 1);
        } else if (domEvent.key === 'Enter' || domEvent.key === ' ' || domEvent.key === 'Spacebar') {
            domEvent.preventDefault();
            toggleRow(target.getAttribute('data-id') ?? '');
        }
    }

    /** Move roving focus (and the single tabbable index) to buttons[index]. */
    function focusRovingIndex(buttons: HTMLButtonElement[], index: number): void {
        if (!buttons.length) {
            return;
        }
        const bounded = Math.min(Math.max(index, 0), buttons.length - 1);
        for (const button of buttons) {
            button.setAttribute('tabindex', '-1');
        }
        const target = buttons[bounded];
        if (target) {
            target.setAttribute('tabindex', '0');
            target.focus();
        }
    }

    return editor;
}

/** The add-bar time, parsed with the shared coercion (mm:ss or plain numbers). */
function toSecondsFromAddBar(): number {
    return toSeconds($('#ivAddTime').val());
}
