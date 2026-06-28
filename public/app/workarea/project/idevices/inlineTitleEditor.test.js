/**
 * inlineTitleEditor Tests
 *
 * Unit tests for the shared inline title-editing helper used by the workspace
 * page title and the structure-tree inline rename.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeTitle, startInlineTitleEdit } from './inlineTitleEditor.js';

describe('inlineTitleEditor', () => {
    describe('normalizeTitle', () => {
        it('trims leading and trailing whitespace', () => {
            expect(normalizeTitle('  Hello  ')).toBe('Hello');
            expect(normalizeTitle('\tHello world\n')).toBe('Hello world');
        });

        it('returns an empty string for whitespace-only input', () => {
            expect(normalizeTitle('   ')).toBe('');
            expect(normalizeTitle('\n\t ')).toBe('');
        });

        it('returns an empty string for nullish input', () => {
            expect(normalizeTitle(null)).toBe('');
            expect(normalizeTitle(undefined)).toBe('');
            expect(normalizeTitle('')).toBe('');
        });

        it('preserves inner whitespace', () => {
            expect(normalizeTitle('a   b')).toBe('a   b');
        });

        it('coerces non-string input to string before trimming', () => {
            expect(normalizeTitle(42)).toBe('42');
        });
    });

    describe('startInlineTitleEdit', () => {
        let element;
        let onCommit;
        let onCancel;

        beforeEach(() => {
            element = document.createElement('h1');
            element.textContent = 'rendered';
            document.body.appendChild(element);
            onCommit = vi.fn();
            onCancel = vi.fn();
        });

        afterEach(() => {
            element.remove();
            vi.clearAllMocks();
        });

        const start = (overrides = {}) =>
            startInlineTitleEdit(element, {
                rawText: 'Original',
                ariaLabel: 'Page title',
                onCommit,
                onCancel,
                ...overrides,
            });

        it('enters edit mode: sets raw text, contenteditable and aria-label', () => {
            start();
            expect(element.getAttribute('contenteditable')).toBe('true');
            expect(element.getAttribute('aria-label')).toBe('Page title');
            expect(element.textContent).toBe('Original');
        });

        it('does not re-enter when already editing', () => {
            element.setAttribute('contenteditable', 'true');
            const teardown = start();
            expect(teardown).toBeNull();
            expect(onCommit).not.toHaveBeenCalled();
        });

        it('commits a changed value on Enter and cleans up', () => {
            start();
            element.textContent = 'New title';
            element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            expect(onCommit).toHaveBeenCalledWith('New title');
            expect(onCancel).not.toHaveBeenCalled();
            expect(element.hasAttribute('contenteditable')).toBe(false);
            expect(element.hasAttribute('aria-label')).toBe(false);
        });

        it('commits a changed value on blur', () => {
            start();
            element.textContent = 'Blurred title';
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).toHaveBeenCalledWith('Blurred title');
        });

        it('trims surrounding whitespace before committing', () => {
            start();
            element.textContent = '   Spaced   ';
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).toHaveBeenCalledWith('Spaced');
        });

        it('cancels (no commit) on Escape', () => {
            start();
            element.textContent = 'Discard me';
            element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(onCancel).toHaveBeenCalledTimes(1);
            expect(onCommit).not.toHaveBeenCalled();
        });

        it('cancels when the value is emptied', () => {
            start();
            element.textContent = '';
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).not.toHaveBeenCalled();
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('cancels when the value is whitespace-only', () => {
            start();
            element.textContent = '    ';
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).not.toHaveBeenCalled();
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('cancels when the value is unchanged', () => {
            start();
            element.textContent = 'Original';
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).not.toHaveBeenCalled();
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('treats a whitespace-padded unchanged value as unchanged', () => {
            start();
            element.textContent = '  Original  ';
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).not.toHaveBeenCalled();
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('only finishes once (Enter then blur does not double-fire)', () => {
            start();
            element.textContent = 'New title';
            element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            element.dispatchEvent(new Event('blur'));
            expect(onCommit).toHaveBeenCalledTimes(1);
        });

        it('does not require onCancel to be provided', () => {
            expect(() =>
                startInlineTitleEdit(element, { rawText: 'Original', onCommit }),
            ).not.toThrow();
            element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(onCommit).not.toHaveBeenCalled();
        });

        it('does not throw when committing without an onCommit callback', () => {
            startInlineTitleEdit(element, { rawText: 'Original' });
            element.textContent = 'Changed';
            expect(() =>
                element.dispatchEvent(new Event('blur')),
            ).not.toThrow();
        });

        it('supports selecting all content on entry', () => {
            expect(() => start({ selection: 'all' })).not.toThrow();
            expect(element.getAttribute('contenteditable')).toBe('true');
        });

        it('returns an idempotent teardown that cancels editing when called', () => {
            const teardown = start();
            expect(typeof teardown).toBe('function');
            element.textContent = 'Changed';
            teardown();
            // A second call is a no-op (one-shot guard).
            teardown();
            expect(onCommit).not.toHaveBeenCalled();
            expect(onCancel).toHaveBeenCalledTimes(1);
            expect(element.hasAttribute('contenteditable')).toBe(false);
        });
    });
});
