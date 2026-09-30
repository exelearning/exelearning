/**
 * Unit tests for the deterministic interaction scheduler.
 *
 * The queue is driven by time signals only (event-push, never polling): it
 * folds each signal into the watched ranges, works out what fell due, and
 * presents due interactions ONE AT A TIME on the single shared overlay. The
 * instance here is a hand-built state object with recording player controls, so
 * the scheduler is exercised without a real provider adapter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPlayback, uniqueWatchedTime } from '../shared/playback';
import { normalizeV2 } from '../shared/schema';
import { sortInteractions } from '../shared/scheduling';
import type { Interaction, InteractiveVideoDocumentV2 } from '../shared/types';
import type { RuntimeInstance } from './instance';
import {
    advance,
    bindContinue,
    bindSortable,
    dismissOverlay,
    ensureContinueButton,
    fireInteraction,
    leaveFullscreen,
    MAX_PLAYED_STEP,
    pumpInteractions,
    recordPlayed,
    showOverlay,
} from './interaction-queue';
import { makeTranslator, renderViewHtml } from './renderer';
import { updateScore } from './scoring';

interface PlayerCalls {
    pause: number;
    resume: number;
    seek: number[];
}

interface Harness {
    instance: RuntimeInstance;
    overlay: HTMLElement;
    root: HTMLElement;
    calls: PlayerCalls;
}

/** Normalize a partial v2 payload into a full document, as the runtime does. */
function makeDoc(overrides: Record<string, unknown> = {}): InteractiveVideoDocumentV2 {
    return normalizeV2({
        schemaVersion: 2,
        video: { provider: 'local', url: 'resources/clip.mp4' },
        ...overrides,
    });
}

/**
 * Mount a document's view and build the instance state the scheduler folds
 * into. Player control is recorded rather than performed, so pause/resume/seek
 * can be asserted without a media element.
 */
function mount(doc: InteractiveVideoDocumentV2, id = 'iv1'): Harness {
    document.body.innerHTML = renderViewHtml(doc, id, makeTranslator(doc.customTexts));
    const root = document.getElementById('exe-iv-' + id);
    const overlay = document.querySelector<HTMLElement>('.exe-iv-overlay');
    if (!root || !overlay) {
        throw new Error('the view did not mount');
    }
    const calls: PlayerCalls = { pause: 0, resume: 0, seek: [] };
    const instance: RuntimeInstance = {
        id: id,
        doc: doc,
        root: root,
        sorted: sortInteractions(doc.interactions),
        provider: 'local',
        video: null,
        iframe: null,
        adapter: null,
        t: makeTranslator(doc.customTexts),
        consumed: new Set<string>(),
        pending: [],
        answered: {},
        results: {},
        playback: emptyPlayback(),
        duration: undefined,
        seen: {},
        overlayActive: false,
        overlayTimer: null,
        lastTime: -Infinity,
        start() {},
        seek(time) {
            calls.seek.push(time);
        },
        pause() {
            calls.pause += 1;
        },
        resume() {
            calls.resume += 1;
        },
        destroy() {},
        recordResult(interactionId, fraction) {
            instance.results[interactionId] = fraction;
            instance.answered[interactionId] = true;
            updateScore(instance);
        },
    };
    return { instance, overlay, root, calls };
}

/**
 * Whether the panel is idle — holding no interaction — regardless of whether
 * the idle hint is drawn, which depends on being in the workarea.
 */
function panelIsIdle(overlay: HTMLElement): boolean {
    return !overlay.querySelector(
        '.exe-iv-question, .exe-iv-note-body, .exe-iv-pause-body, .exe-iv-cover-body, .exe-iv-continue',
    );
}

/** The fullscreen slice of `document`, which tests drive directly. */
interface FullscreenDocument {
    fullscreenElement?: Element | null;
    exitFullscreen?: () => Promise<void>;
}

function setFullscreen(element: Element | null, exit?: () => Promise<void>): void {
    Object.defineProperty(document, 'fullscreenElement', { value: element, configurable: true, writable: true });
    if (exit) {
        Object.defineProperty(document, 'exitFullscreen', { value: exit, configurable: true, writable: true });
    }
}

function clearFullscreen(): void {
    const fullscreenDocument = document as unknown as FullscreenDocument;
    delete fullscreenDocument.fullscreenElement;
    delete fullscreenDocument.exitFullscreen;
}

const NOTE = { id: 'n', type: 'note', time: 5, pause: true, body: '<p>Hello</p>' };
const SECOND_NOTE = { id: 'n2', type: 'note', time: 5, pause: true, body: '<p>Second</p>' };
const QUESTION = {
    id: 'q',
    type: 'question',
    time: 5,
    pause: true,
    question: {
        kind: 'singleChoice',
        prompt: 'Capital?',
        answers: [
            ['Paris', 1],
            ['Rome', 0],
        ],
    },
};

afterEach(() => {
    vi.useRealTimers();
    clearFullscreen();
    document.body.innerHTML = '';
});

describe('recordPlayed', () => {
    it('claims nothing for the very first signal', () => {
        // There is nothing to measure the first signal against; at ~250 ms per
        // timeupdate the unclaimed span is noise against the threshold.
        const { instance } = mount(makeDoc());
        recordPlayed(instance, 10);
        expect(uniqueWatchedTime(instance.playback)).toBe(0);
    });

    it('counts the span between two consecutive signals as watched', () => {
        const { instance } = mount(makeDoc());
        instance.lastTime = 1;
        recordPlayed(instance, 1.25);
        expect(uniqueWatchedTime(instance.playback)).toBeCloseTo(0.25, 5);
    });

    it('discards a jump too large to be playback (a seek)', () => {
        const { instance } = mount(makeDoc());
        instance.lastTime = 1;
        recordPlayed(instance, 1 + MAX_PLAYED_STEP + 0.1);
        expect(uniqueWatchedTime(instance.playback)).toBe(0);
    });

    it('ignores a backward step', () => {
        const { instance } = mount(makeDoc());
        instance.lastTime = 10;
        recordPlayed(instance, 4);
        expect(uniqueWatchedTime(instance.playback)).toBe(0);
    });

    it('treats a step comfortably above a timeupdate interval as playback', () => {
        // ~250 ms is the usual interval; the ceiling has to sit above it even at
        // high playback rates, and far below any seek worth discounting.
        expect(MAX_PLAYED_STEP).toBe(2);
    });
});

describe('advance', () => {
    it('ignores a non-finite time signal', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE] }));
        advance(instance, Number.NaN);
        expect(panelIsIdle(overlay)).toBe(true);
        expect(instance.lastTime).toBe(-Infinity);
    });

    it('reveals an interaction when the clock crosses its time', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE] }));
        advance(instance, 4);
        expect(panelIsIdle(overlay)).toBe(true);
        advance(instance, 6);
        expect(panelIsIdle(overlay)).toBe(false);
        expect(overlay.innerHTML).toContain('Hello');
        expect(instance.lastTime).toBe(6);
    });

    it('presents two simultaneously-due interactions one at a time, discarding neither (#2147)', () => {
        // Scrubbing forward (or authoring two interactions within one
        // timeupdate) makes several fall due in a single tick. They must be
        // shown one at a time, not collapsed onto the last one.
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE, SECOND_NOTE] }));
        advance(instance, 6);
        expect(overlay.innerHTML).toContain('Hello');
        expect(overlay.innerHTML).not.toContain('Second');
        expect(instance.pending.length).toBe(1);

        overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
        expect(overlay.innerHTML).toContain('Second');
        expect(instance.pending.length).toBe(0);
    });

    it('re-arms an interaction the learner rewinds past', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE] }));
        advance(instance, 6);
        overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
        expect(panelIsIdle(overlay)).toBe(true);

        advance(instance, 2);
        advance(instance, 6);
        expect(overlay.innerHTML).toContain('Hello');
    });

    it('accumulates watched ranges from playback but not from seeks', () => {
        const { instance } = mount(makeDoc());
        instance.duration = 100;
        for (const time of [1, 2, 3]) {
            advance(instance, time);
        }
        // A jump to the end is a seek, not 96 more seconds of watching.
        advance(instance, 99);
        advance(instance, 100);
        expect(uniqueWatchedTime(instance.playback)).toBeCloseTo(3, 5);
    });

    it('skips an interaction that is already consumed', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE] }));
        instance.consumed.add('n');
        advance(instance, 6);
        expect(panelIsIdle(overlay)).toBe(true);
    });
});

describe('fireInteraction', () => {
    it('seeks a jump without an overlay and consumes it, so it cannot trap the learner', () => {
        const { instance, overlay, calls } = mount(makeDoc());
        const jump: Interaction = {
            id: 'j1',
            type: 'jump',
            time: 10,
            duration: null,
            pause: false,
            jump: { toTime: 2 },
        };
        instance.sorted = [jump];
        advance(instance, 11);
        expect(calls.seek).toEqual([2]);
        expect(instance.consumed.has('j1')).toBe(true);
        expect(panelIsIdle(overlay)).toBe(true);
        // Crossing its time again cannot re-fire it (no backward-jump loop).
        advance(instance, 2);
        advance(instance, 11);
        expect(calls.seek).toEqual([2]);
    });

    it('pauses playback only when the interaction asks for it', () => {
        const { instance, calls } = mount(makeDoc({ interactions: [NOTE] }));
        const [paused] = instance.sorted;
        if (!paused) {
            throw new Error('the note was not normalized');
        }
        fireInteraction(instance, paused);
        expect(calls.pause).toBe(1);

        const { instance: other, calls: otherCalls } = mount(makeDoc({ interactions: [{ ...NOTE, pause: false }] }));
        const [unpaused] = other.sorted;
        if (!unpaused) {
            throw new Error('the note was not normalized');
        }
        fireInteraction(other, unpaused);
        expect(otherCalls.pause).toBe(0);
    });

    it('drops a jump whose target is not a usable time', () => {
        const { instance, calls } = mount(makeDoc());
        const jump: Interaction = {
            id: 'j2',
            type: 'jump',
            time: 10,
            duration: null,
            pause: false,
            jump: { toTime: Number.NaN },
        };
        fireInteraction(instance, jump);
        expect(calls.seek).toEqual([]);
        expect(instance.consumed.has('j2')).toBe(true);
    });
});

describe('showOverlay', () => {
    it('renders into the accessible panel and marks a note as Seen in the results table', () => {
        const { instance, overlay, root } = mount(makeDoc({ interactions: [NOTE] }));
        const [note] = instance.sorted;
        if (!note) {
            throw new Error('the note was not normalized');
        }
        showOverlay(instance, note);
        expect(instance.overlayActive).toBe(true);
        expect(overlay.getAttribute('tabindex')).toBe('-1');
        expect(instance.seen['n']).toBe(true);
        expect(root.querySelector('tr[data-iv-result="n"] .exe-iv-results-status span')?.textContent).toBe('Seen');
    });

    it('never overwrites an interaction the learner is still working on', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE, SECOND_NOTE] }));
        const [first, second] = instance.sorted;
        if (!first || !second) {
            throw new Error('the notes were not normalized');
        }
        showOverlay(instance, first);
        showOverlay(instance, second);
        expect(overlay.innerHTML).toContain('Hello');
        expect(overlay.innerHTML).not.toContain('Second');
        // The deferred one goes to the FRONT of the queue: nothing is lost.
        expect(instance.pending[0]).toBe(second);
    });

    it('auto-resumes a note once its duration elapses', () => {
        const { instance, overlay, calls } = mount(makeDoc({ interactions: [{ ...NOTE, duration: 3 }] }));
        vi.useFakeTimers();
        advance(instance, 6);
        expect(panelIsIdle(overlay)).toBe(false);
        // A timed note plays through, so it never offers a Continue button.
        expect(overlay.querySelector('.exe-iv-continue')).toBeNull();
        vi.advanceTimersByTime(3000);
        expect(panelIsIdle(overlay)).toBe(true);
        expect(calls.resume).toBe(1);
    });

    it('keeps a note with no duration up until Continue', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [{ ...NOTE, duration: null }] }));
        vi.useFakeTimers();
        advance(instance, 6);
        vi.advanceTimersByTime(60000);
        expect(panelIsIdle(overlay)).toBe(false);
        vi.useRealTimers();
        overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
        expect(panelIsIdle(overlay)).toBe(true);
    });

    it('wires Check so a graded question then offers Continue', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [QUESTION] }));
        advance(instance, 6);
        const correct = overlay.querySelector<HTMLInputElement>('input[value="0"]');
        if (!correct) {
            throw new Error('the question did not render');
        }
        correct.checked = true;
        overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
        expect(instance.results['q']).toBe(1);
        expect(overlay.querySelector('.exe-iv-continue')).not.toBeNull();
    });

    it('offers no Continue while the question is unanswered', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [QUESTION] }));
        advance(instance, 6);
        overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
        expect(instance.results['q']).toBeUndefined();
        expect(overlay.querySelector('.exe-iv-continue')).toBeNull();
    });

    it('leaves the panel alone when the instance has no overlay to render into', () => {
        const { instance } = mount(makeDoc({ interactions: [NOTE] }));
        const overlay = instance.root.querySelector('.exe-iv-overlay');
        overlay?.remove();
        const [note] = instance.sorted;
        if (!note) {
            throw new Error('the note was not normalized');
        }
        expect(() => showOverlay(instance, note)).not.toThrow();
        expect(instance.overlayActive).toBe(false);
    });
});

describe('dismissOverlay', () => {
    it('restores the idle placeholder and resumes playback', () => {
        const { instance, overlay, calls } = mount(makeDoc({ interactions: [NOTE] }));
        advance(instance, 6);
        dismissOverlay(instance, overlay);
        expect(instance.overlayActive).toBe(false);
        expect(panelIsIdle(overlay)).toBe(true);
        expect(calls.resume).toBe(1);
    });

    it('presents the next queued interaction instead of resuming', () => {
        const { instance, overlay, calls } = mount(makeDoc({ interactions: [NOTE, SECOND_NOTE] }));
        advance(instance, 6);
        dismissOverlay(instance, overlay);
        expect(overlay.innerHTML).toContain('Second');
        expect(calls.resume).toBe(0);
    });

    it('clears a pending auto-resume timer so it cannot fire twice', () => {
        const { instance, overlay, calls } = mount(makeDoc({ interactions: [{ ...NOTE, duration: 3 }] }));
        vi.useFakeTimers();
        advance(instance, 6);
        expect(instance.overlayTimer).not.toBeNull();
        dismissOverlay(instance, overlay);
        expect(instance.overlayTimer).toBeNull();
        vi.advanceTimersByTime(10000);
        expect(calls.resume).toBe(1);
    });

    it('announces the empty panel when the document has no interactions at all', () => {
        const { instance, overlay } = mount(makeDoc());
        dismissOverlay(instance, overlay);
        expect(overlay.textContent).toContain('This video has no interactive elements.');
    });
});

describe('pumpInteractions', () => {
    it('does nothing while an interaction is on screen', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [NOTE, SECOND_NOTE] }));
        advance(instance, 6);
        pumpInteractions(instance);
        expect(overlay.innerHTML).toContain('Hello');
        expect(instance.pending.length).toBe(1);
    });

    it('drains jumps in the same batch without stopping (they show no overlay)', () => {
        const { instance, overlay, calls } = mount(makeDoc());
        instance.sorted = [
            { id: 'j1', type: 'jump', time: 5, duration: null, pause: false, jump: { toTime: 1 } },
            { id: 'j2', type: 'jump', time: 6, duration: null, pause: false, jump: { toTime: 2 } },
        ];
        advance(instance, 7);
        expect(calls.seek).toEqual([1, 2]);
        expect(panelIsIdle(overlay)).toBe(true);
        expect(instance.pending.length).toBe(0);
    });
});

describe('bindContinue', () => {
    it('is a no-op when the overlay has no Continue button', () => {
        const { instance, overlay } = mount(makeDoc());
        overlay.innerHTML = '<p>nothing to continue</p>';
        expect(() => bindContinue(instance, overlay)).not.toThrow();
    });
});

describe('ensureContinueButton', () => {
    it('adds a working Continue after Check, exactly once', () => {
        const { instance, overlay, calls } = mount(makeDoc({ interactions: [QUESTION] }));
        advance(instance, 6);
        ensureContinueButton(instance, overlay);
        ensureContinueButton(instance, overlay);
        expect(overlay.querySelectorAll('.exe-iv-continue').length).toBe(1);
        overlay.querySelector<HTMLElement>('.exe-iv-continue')?.click();
        expect(calls.resume).toBe(1);
    });

    it('adds nothing when the overlay has no Check button', () => {
        const { instance, overlay } = mount(makeDoc());
        overlay.innerHTML = '<p>a note</p>';
        ensureContinueButton(instance, overlay);
        expect(overlay.querySelector('.exe-iv-continue')).toBeNull();
    });
});

describe('bindSortable', () => {
    const SORTABLE = {
        id: 's',
        type: 'question',
        time: 5,
        pause: true,
        question: { kind: 'sortableList', prompt: 'Order', items: ['one', 'two', 'three'] },
    };

    function order(overlay: HTMLElement): string[] {
        return Array.from(overlay.querySelectorAll('.exe-iv-sortable-item')).map(
            item => item.getAttribute('data-iv-index') ?? '',
        );
    }

    it('moves an item down and back up, keeping the ends disabled', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [SORTABLE] }));
        advance(instance, 6);
        const before = order(overlay);
        const first = overlay.querySelector<HTMLElement>('.exe-iv-sortable-item');
        first?.querySelector<HTMLElement>('.exe-iv-sort-down')?.click();
        expect(order(overlay)[1]).toBe(before[0]);
        // Now at position 1, it can move back up.
        first?.querySelector<HTMLElement>('.exe-iv-sort-up')?.click();
        expect(order(overlay)).toEqual(before);
        // The first item can never move up and the last can never move down.
        const items = overlay.querySelectorAll('.exe-iv-sortable-item');
        expect(items[0]?.querySelector<HTMLButtonElement>('.exe-iv-sort-up')?.disabled).toBe(true);
        expect(items[items.length - 1]?.querySelector<HTMLButtonElement>('.exe-iv-sort-down')?.disabled).toBe(true);
    });

    it('announces the new position for screen readers', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [SORTABLE] }));
        advance(instance, 6);
        const first = overlay.querySelector<HTMLElement>('.exe-iv-sortable-item');
        const label = first?.querySelector('.exe-iv-sortable-label')?.textContent ?? '';
        first?.querySelector<HTMLElement>('.exe-iv-sort-down')?.click();
        const status = overlay.querySelector('.exe-iv-sortable-status')?.textContent ?? '';
        expect(status).toContain(label);
        expect(status).toContain('position 2 of 3');
    });

    it('ignores clicks that are not on an enabled move button', () => {
        const { instance, overlay } = mount(makeDoc({ interactions: [SORTABLE] }));
        advance(instance, 6);
        const before = order(overlay);
        overlay.querySelector<HTMLElement>('.exe-iv-sortable-label')?.click();
        // The first item's "up" is disabled: clicking it must not reorder.
        overlay.querySelector<HTMLElement>('.exe-iv-sortable-item .exe-iv-sort-up')?.click();
        expect(order(overlay)).toEqual(before);
    });

    it('is a no-op for an overlay with no sortable list', () => {
        const { instance, overlay } = mount(makeDoc());
        overlay.innerHTML = '<p>a note</p>';
        expect(() => bindSortable(instance, overlay)).not.toThrow();
    });
});

describe('leaveFullscreen', () => {
    beforeEach(() => {
        clearFullscreen();
    });

    it('exits fullscreen owned by this instance, so the panel is visible', () => {
        // The interaction panel sits outside the video element, so it is
        // invisible while the video is in native fullscreen.
        const { instance } = mount(makeDoc({ interactions: [NOTE] }));
        let exited = 0;
        setFullscreen(instance.root, () => {
            exited += 1;
            return Promise.resolve();
        });
        leaveFullscreen(instance);
        expect(exited).toBe(1);
    });

    it('leaves fullscreen owned by something else on the page alone', () => {
        const { instance } = mount(makeDoc({ interactions: [NOTE] }));
        let exited = 0;
        setFullscreen(document.head, () => {
            exited += 1;
            return Promise.resolve();
        });
        leaveFullscreen(instance);
        expect(exited).toBe(0);
    });

    it('is a no-op without the Fullscreen API, and when exiting is refused', () => {
        const { instance } = mount(makeDoc({ interactions: [NOTE] }));
        expect(() => leaveFullscreen(instance)).not.toThrow();
        setFullscreen(instance.root, () => {
            throw new Error('denied');
        });
        expect(() => leaveFullscreen(instance)).not.toThrow();
        // A rejected promise is swallowed too: the panel simply stays hidden.
        setFullscreen(instance.root, () => Promise.reject(new Error('denied')));
        expect(() => leaveFullscreen(instance)).not.toThrow();
    });

    it('exits when the fullscreen element is inside this instance', () => {
        const { instance } = mount(makeDoc({ interactions: [NOTE] }));
        const inner = instance.root.querySelector('.exe-iv-stage');
        let exited = 0;
        setFullscreen(inner, () => {
            exited += 1;
            return Promise.resolve();
        });
        leaveFullscreen(instance);
        expect(exited).toBe(1);
    });
});
