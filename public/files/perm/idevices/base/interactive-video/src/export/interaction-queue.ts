/**
 * The deterministic interaction scheduler: fold event-push time signals into
 * due interactions, present them one at a time on the single shared overlay,
 * and record what was genuinely played (for watch-based completion).
 */

import { addPlayedRange } from '../shared/playback';
import { interactionsInRange, resolveJumpTarget } from '../shared/scheduling';
import { escapeHtml } from '../shared/html';
import type { Interaction } from '../shared/types';
import type { RuntimeInstance } from './instance';
import { panelPlaceholderHtml, renderInteractionBodyHtml } from './renderer';
import { gradeInteraction, refreshResults } from './scoring';

/**
 * Longest span between two time signals still treated as continuous playback.
 * Comfortably above a normal `timeupdate` interval (~250 ms) even at high
 * playback rates, and far below any seek worth discounting.
 */
export const MAX_PLAYED_STEP = 2;

/**
 * Fold one time signal into the watched ranges.
 *
 * Consecutive `timeupdate`s are ~250 ms apart, so the span between the last
 * one and this one was genuinely played. A larger step is a seek (or a runtime
 * jump) and the skipped span is NOT counted — that is the whole point:
 * reaching the end by dragging must not read as having watched.
 */
export function recordPlayed(instance: RuntimeInstance, current: number): void {
    const previous = instance.lastTime;
    if (!isFinite(previous)) {
        return;
    }
    const step = current - previous;
    if (step <= 0 || step > MAX_PLAYED_STEP) {
        return;
    }
    instance.playback = addPlayedRange(instance.playback, previous, current, instance.duration);
}

/** Advance the deterministic scheduler for one time signal (event-push). */
export function advance(instance: RuntimeInstance, current: number): void {
    if (!isFinite(current)) {
        return;
    }
    recordPlayed(instance, current);
    // Only the cover and jumps are consumed once and for all. Everything else
    // is re-armed by rewinding: an interaction fires whenever the clock
    // crosses its time, and after a backward seek `lastTime` is behind it
    // again. So a learner who rewinds to re-read a note sees it, and one who
    // rewinds to a question is asked it again — answering again simply
    // replaces the score they had. Crossing forward can only happen once
    // without a rewind, so nothing repeats on its own.
    const due = interactionsInRange(instance.sorted, instance.lastTime, current, instance.consumed);
    instance.lastTime = current;
    // A single tick can cross several interactions (forward scrub, or two
    // authored <250ms apart). Queue them all, then present them one at a time
    // — an unanswered overlay is never overwritten by the rest of the batch.
    for (const interaction of due) {
        instance.pending.push(interaction);
    }
    pumpInteractions(instance);
}

/**
 * Present the next queued interaction, unless one is already on screen. Jumps
 * seek without an overlay so the batch keeps draining; any interaction that
 * shows an overlay halts the batch until the learner dismisses it (Continue),
 * at which point the Continue wiring pumps the next one.
 */
export function pumpInteractions(instance: RuntimeInstance): void {
    if (instance.overlayActive) {
        return;
    }
    while (instance.pending.length) {
        const next = instance.pending.shift();
        if (next) {
            fireInteraction(instance, next);
        }
        if (instance.overlayActive) {
            return;
        }
    }
}

/** Reveal an interaction at its time; pause playback via the adapter. */
export function fireInteraction(instance: RuntimeInstance, interaction: Interaction): void {
    if (interaction.type === 'jump') {
        instance.consumed.add(interaction.id);
        const target = resolveJumpTarget(interaction, instance.duration);
        if (target != null) {
            instance.seek(target);
        }
        return;
    }
    if (interaction.pause) {
        instance.pause();
    }
    showOverlay(instance, interaction);
}

/**
 * Exit native fullscreen when this instance's player is the fullscreen
 * element, so a blocking interaction is never hidden behind it. A no-op
 * everywhere else (including browsers without the Fullscreen API).
 */
export function leaveFullscreen(instance: RuntimeInstance): void {
    if (typeof document === 'undefined' || !document.fullscreenElement || !document.exitFullscreen) {
        return;
    }
    const current = document.fullscreenElement;
    const mine = instance.root && (instance.root === current || instance.root.contains(current));
    if (!mine) {
        return;
    }
    try {
        const leaving = document.exitFullscreen();
        if (leaving && typeof leaving.catch === 'function') {
            leaving.catch(() => {});
        }
    } catch {
        /* denied / not allowed — the panel simply stays hidden */
    }
}

/** Render the interaction into the accessible aria-live overlay. */
export function showOverlay(instance: RuntimeInstance, interaction: Interaction): void {
    const overlay = instance.root.querySelector<HTMLElement>('.exe-iv-overlay');
    if (!overlay) {
        return;
    }
    // Never overwrite an interaction the learner is still working on: if one
    // is already active, defer this one back onto the queue so it is shown
    // once the current interaction is dismissed.
    if (instance.overlayActive) {
        instance.pending.unshift(interaction);
        return;
    }
    // The interaction panel sits outside the video element, so it is invisible
    // while the video is in native fullscreen — the legacy runtime could only
    // alert the learner to press Esc. Leave fullscreen instead, so the
    // interaction they are being stopped for is actually on screen.
    leaveFullscreen(instance);
    overlay.innerHTML = renderInteractionBodyHtml(interaction, instance.id, instance.t);
    bindSortable(instance, overlay);
    instance.overlayActive = true;
    overlay.setAttribute('tabindex', '-1');
    // Mark note/pause/cover as seen for the results table.
    if (interaction.type === 'note' || interaction.type === 'pause' || interaction.type === 'cover') {
        instance.seen[interaction.id] = true;
        refreshResults(instance);
    }

    const check = overlay.querySelector('.exe-iv-check');
    if (check && interaction.type === 'question') {
        check.addEventListener('click', () => {
            if (gradeInteraction(instance, interaction, overlay)) {
                ensureContinueButton(instance, overlay);
            }
        });
    }
    bindContinue(instance, overlay);
    // Optional auto-resume: a note/pause with a positive `duration`
    // auto-dismisses after that many seconds — matching the legacy end-time
    // behaviour. A blank duration keeps the "stay until Continue" default.
    if (
        (interaction.type === 'note' || interaction.type === 'pause') &&
        interaction.duration &&
        isFinite(interaction.duration) &&
        interaction.duration > 0
    ) {
        instance.overlayTimer = setTimeout(() => {
            dismissOverlay(instance, overlay);
        }, interaction.duration * 1000);
    }
    overlay.focus();
}

/**
 * Dismiss the visible overlay: clear any pending auto-resume timer, restore
 * the idle placeholder (stable panel size), present the next interaction due
 * in the same tick, and resume playback once the whole batch has been shown.
 * Shared by the Continue button and the duration auto-resume.
 */
export function dismissOverlay(instance: RuntimeInstance, overlay: HTMLElement): void {
    if (instance.overlayTimer) {
        clearTimeout(instance.overlayTimer);
        instance.overlayTimer = null;
    }
    instance.overlayActive = false;
    overlay.innerHTML = panelPlaceholderHtml(!(instance.sorted || []).length, instance.t);
    pumpInteractions(instance);
    if (!instance.overlayActive) {
        instance.resume();
    }
}

/** Wire any Continue button in the overlay to resume playback via the adapter. */
export function bindContinue(instance: RuntimeInstance, overlay: HTMLElement): void {
    const continueButton = overlay.querySelector('.exe-iv-continue');
    if (!continueButton) {
        return;
    }
    continueButton.addEventListener('click', () => {
        dismissOverlay(instance, overlay);
    });
}

/** After grading, offer Continue if the overlay does not have one yet. */
export function ensureContinueButton(instance: RuntimeInstance, overlay: HTMLElement): void {
    const check = overlay.querySelector('.exe-iv-check');
    if (check && !overlay.querySelector('.exe-iv-continue')) {
        check.insertAdjacentHTML(
            'afterend',
            '<button type="button" class="exe-iv-continue">' + escapeHtml(instance.t('Continue', 'goOn')) + '</button>',
        );
        bindContinue(instance, overlay);
    }
}

/** Wire Move up / Move down buttons for a sortable-list overlay. */
export function bindSortable(instance: RuntimeInstance, overlay: HTMLElement): void {
    const t = instance.t;
    const list = overlay.querySelector<HTMLElement>('.exe-iv-sortable-list');
    if (!list) {
        return;
    }
    const status = overlay.querySelector('.exe-iv-sortable-status');
    function itemNodes(): NodeListOf<HTMLElement> {
        return (list as HTMLElement).querySelectorAll<HTMLElement>('.exe-iv-sortable-item');
    }
    function refresh(): void {
        const items = itemNodes();
        for (let i = 0; i < items.length; i++) {
            const up = items[i]?.querySelector<HTMLButtonElement>('.exe-iv-sort-up');
            const down = items[i]?.querySelector<HTMLButtonElement>('.exe-iv-sort-down');
            if (up) {
                up.disabled = i === 0;
            }
            if (down) {
                down.disabled = i === items.length - 1;
            }
        }
    }
    function move(li: HTMLElement, dir: string | null): void {
        if (!list) {
            return;
        }
        if (dir === 'up' && li.previousElementSibling) {
            list.insertBefore(li, li.previousElementSibling);
        } else if (dir === 'down' && li.nextElementSibling) {
            list.insertBefore(li.nextElementSibling, li);
        } else {
            return;
        }
        refresh();
        const items = itemNodes();
        const newPos = Array.prototype.indexOf.call(items, li);
        if (status) {
            const label = li.querySelector('.exe-iv-sortable-label');
            status.textContent =
                (label ? label.textContent : '') +
                ': ' +
                t('position') +
                ' ' +
                (newPos + 1) +
                ' ' +
                t('of') +
                ' ' +
                items.length;
        }
        let button = li.querySelector<HTMLButtonElement>(dir === 'up' ? '.exe-iv-sort-up' : '.exe-iv-sort-down');
        if (button?.disabled) {
            button = li.querySelector<HTMLButtonElement>(dir === 'up' ? '.exe-iv-sort-down' : '.exe-iv-sort-up');
        }
        if (button) {
            button.focus();
        }
    }
    list.addEventListener('click', event => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest ? target.closest<HTMLButtonElement>('.exe-iv-sort-btn') : null;
        if (!button || button.disabled) {
            return;
        }
        const li = button.closest<HTMLElement>('.exe-iv-sortable-item');
        if (li) {
            move(li, button.getAttribute('data-iv-move'));
        }
    });
    refresh();
}

