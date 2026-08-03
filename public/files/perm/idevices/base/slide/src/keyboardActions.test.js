/**
 * Tests for the Slide editor keyboard action resolver.
 */

/* eslint-disable no-undef */
import { describe, it, expect } from 'vitest';
import { NUDGE_STEP, NUDGE_STEP_LARGE, resolveKeyboardAction, shouldForceMarquee } from './keyboardActions.ts';

const IDLE_STATE = { codeMode: false, editingInput: false, cropping: false, editingText: false };

function key(props) {
    return { key: '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...props };
}

describe('resolveKeyboardAction — nudge with arrow keys', () => {
    it.each([
        ['ArrowLeft', -NUDGE_STEP, 0],
        ['ArrowRight', NUDGE_STEP, 0],
        ['ArrowUp', 0, -NUDGE_STEP],
        ['ArrowDown', 0, NUDGE_STEP],
    ])('%s nudges by one step', (k, dx, dy) => {
        expect(resolveKeyboardAction(key({ key: k }), IDLE_STATE)).toEqual({ kind: 'nudge', dx, dy });
    });

    it.each([
        ['ArrowLeft', -NUDGE_STEP_LARGE, 0],
        ['ArrowRight', NUDGE_STEP_LARGE, 0],
        ['ArrowUp', 0, -NUDGE_STEP_LARGE],
        ['ArrowDown', 0, NUDGE_STEP_LARGE],
    ])('Shift+%s nudges by the large step', (k, dx, dy) => {
        expect(resolveKeyboardAction(key({ key: k, shiftKey: true }), IDLE_STATE)).toEqual({ kind: 'nudge', dx, dy });
    });
});

describe('resolveKeyboardAction — history and clipboard-style shortcuts', () => {
    it('Ctrl+Z and Cmd+Z resolve to undo', () => {
        expect(resolveKeyboardAction(key({ key: 'z', ctrlKey: true }), IDLE_STATE)).toEqual({ kind: 'undo' });
        expect(resolveKeyboardAction(key({ key: 'Z', metaKey: true }), IDLE_STATE)).toEqual({ kind: 'undo' });
    });

    it('Ctrl+Shift+Z, Cmd+Shift+Z and Ctrl+Y resolve to redo', () => {
        expect(resolveKeyboardAction(key({ key: 'z', ctrlKey: true, shiftKey: true }), IDLE_STATE)).toEqual({
            kind: 'redo',
        });
        expect(resolveKeyboardAction(key({ key: 'Z', metaKey: true, shiftKey: true }), IDLE_STATE)).toEqual({
            kind: 'redo',
        });
        expect(resolveKeyboardAction(key({ key: 'y', ctrlKey: true }), IDLE_STATE)).toEqual({ kind: 'redo' });
    });

    it('Ctrl+D and Cmd+D resolve to duplicate', () => {
        expect(resolveKeyboardAction(key({ key: 'd', ctrlKey: true }), IDLE_STATE)).toEqual({ kind: 'duplicate' });
        expect(resolveKeyboardAction(key({ key: 'D', metaKey: true }), IDLE_STATE)).toEqual({ kind: 'duplicate' });
    });

    it('a plain letter resolves to none', () => {
        expect(resolveKeyboardAction(key({ key: 'd' }), IDLE_STATE)).toEqual({ kind: 'none' });
    });

    it('Delete and Backspace resolve to delete', () => {
        expect(resolveKeyboardAction(key({ key: 'Delete' }), IDLE_STATE)).toEqual({ kind: 'delete' });
        expect(resolveKeyboardAction(key({ key: 'Backspace' }), IDLE_STATE)).toEqual({ kind: 'delete' });
    });

    it('Escape resolves to escape (deselect)', () => {
        expect(resolveKeyboardAction(key({ key: 'Escape' }), IDLE_STATE)).toEqual({ kind: 'escape' });
    });
});

describe('resolveKeyboardAction — editor state gates', () => {
    it('code mode swallows every shortcut', () => {
        const state = { ...IDLE_STATE, codeMode: true };
        expect(resolveKeyboardAction(key({ key: 'z', ctrlKey: true }), state)).toEqual({ kind: 'none' });
        expect(resolveKeyboardAction(key({ key: 'ArrowLeft' }), state)).toEqual({ kind: 'none' });
    });

    it('typing in an input swallows every shortcut', () => {
        const state = { ...IDLE_STATE, editingInput: true };
        expect(resolveKeyboardAction(key({ key: 'Delete' }), state)).toEqual({ kind: 'none' });
        expect(resolveKeyboardAction(key({ key: 'ArrowRight' }), state)).toEqual({ kind: 'none' });
    });

    it('crop mode maps Enter/Escape and blocks destructive keys', () => {
        const state = { ...IDLE_STATE, cropping: true };
        expect(resolveKeyboardAction(key({ key: 'Enter' }), state)).toEqual({ kind: 'crop-apply' });
        expect(resolveKeyboardAction(key({ key: 'Escape' }), state)).toEqual({ kind: 'crop-cancel' });
        expect(resolveKeyboardAction(key({ key: 'Delete' }), state)).toEqual({ kind: 'crop-block' });
        expect(resolveKeyboardAction(key({ key: 'Backspace' }), state)).toEqual({ kind: 'crop-block' });
        expect(resolveKeyboardAction(key({ key: 'z', ctrlKey: true }), state)).toEqual({ kind: 'none' });
    });

    it('text editing only maps Escape; the IText handles its own keys', () => {
        const state = { ...IDLE_STATE, editingText: true };
        expect(resolveKeyboardAction(key({ key: 'Escape' }), state)).toEqual({ kind: 'escape-text' });
        expect(resolveKeyboardAction(key({ key: 'Backspace' }), state)).toEqual({ kind: 'none' });
        expect(resolveKeyboardAction(key({ key: 'ArrowLeft' }), state)).toEqual({ kind: 'none' });
        expect(resolveKeyboardAction(key({ key: 'z', ctrlKey: true }), state)).toEqual({ kind: 'none' });
    });
});

describe('shouldForceMarquee', () => {
    it('is true while Ctrl or Cmd is held', () => {
        expect(shouldForceMarquee({ metaKey: true, ctrlKey: false })).toBe(true);
        expect(shouldForceMarquee({ metaKey: false, ctrlKey: true })).toBe(true);
    });

    it('is false for a plain drag', () => {
        expect(shouldForceMarquee({ metaKey: false, ctrlKey: false })).toBe(false);
    });
});
