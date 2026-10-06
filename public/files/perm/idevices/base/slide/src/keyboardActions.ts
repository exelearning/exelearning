/**
 * Slide iDevice — pure keyboard-shortcut resolver.
 *
 * Maps a keydown event plus the editor's current state to a declarative
 * action, so the mapping stays unit-testable without a DOM or Fabric
 * canvas. The editor owns the side effects (#2218).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

/** Pixels moved per arrow-key press. */
export const NUDGE_STEP = 1;
/** Pixels moved per Shift+arrow press. */
export const NUDGE_STEP_LARGE = 10;

export interface KeyEventLike {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
}

export interface EditorKeyState {
    /** Code (JSON) view is active; the textarea owns all input. */
    codeMode: boolean;
    /** Event target is an INPUT/TEXTAREA/SELECT outside the canvas. */
    editingInput: boolean;
    /** Image crop overlay is active. */
    cropping: boolean;
    /** A Fabric IText/Textbox is in text-editing mode. */
    editingText: boolean;
}

export type SlideKeyAction =
    | { kind: 'none' }
    | { kind: 'crop-apply' }
    | { kind: 'crop-cancel' }
    | { kind: 'crop-block' }
    | { kind: 'escape-text' }
    | { kind: 'delete' }
    | { kind: 'undo' }
    | { kind: 'redo' }
    | { kind: 'duplicate' }
    | { kind: 'nudge'; dx: number; dy: number }
    | { kind: 'escape' };

const ARROW_DELTAS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
};

export function resolveKeyboardAction(event: KeyEventLike, state: EditorKeyState): SlideKeyAction {
    if (state.codeMode || state.editingInput) return { kind: 'none' };

    if (state.cropping) {
        if (event.key === 'Enter') return { kind: 'crop-apply' };
        if (event.key === 'Escape') return { kind: 'crop-cancel' };
        if (event.key === 'Delete' || event.key === 'Backspace') return { kind: 'crop-block' };
        return { kind: 'none' };
    }

    if (state.editingText) {
        if (event.key === 'Escape') return { kind: 'escape-text' };
        return { kind: 'none' };
    }

    if (event.key === 'Delete' || event.key === 'Backspace') return { kind: 'delete' };

    const meta = event.ctrlKey || event.metaKey;
    const lower = event.key.toLowerCase();
    if (meta && lower === 'z' && !event.shiftKey) return { kind: 'undo' };
    if (meta && ((lower === 'z' && event.shiftKey) || lower === 'y')) return { kind: 'redo' };
    if (meta && lower === 'd') return { kind: 'duplicate' };

    const delta = ARROW_DELTAS[event.key];
    if (delta) {
        const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
        return { kind: 'nudge', dx: delta[0] * step, dy: delta[1] * step };
    }

    if (event.key === 'Escape') return { kind: 'escape' };

    return { kind: 'none' };
}

/**
 * Rubber-band selection normally only starts on an empty canvas area. When
 * the slide is fully covered (e.g. a full-bleed background shape) there is
 * no empty pixel to start from, so holding Ctrl/Cmd during the drag forces
 * the marquee by skipping target detection (#2218).
 */
export function shouldForceMarquee(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
    return event.metaKey || event.ctrlKey;
}
