import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HIDE_UI_ATTR_MAP, applyHideUI } from './ui-visibility.js';

describe('ui-visibility', () => {
    beforeEach(() => {
        // Clean all hide attributes before each test
        for (const attr of Object.values(HIDE_UI_ATTR_MAP)) {
            document.body.removeAttribute(attr);
        }
    });

    afterEach(() => {
        for (const attr of Object.values(HIDE_UI_ATTR_MAP)) {
            document.body.removeAttribute(attr);
        }
    });

    describe('HIDE_UI_ATTR_MAP', () => {
        it('should map all expected UI keys to data attributes', () => {
            expect(HIDE_UI_ATTR_MAP).toEqual({
                fileMenu: 'data-exe-hide-file-menu',
                saveButton: 'data-exe-hide-save',
                shareButton: 'data-exe-hide-share',
                userMenu: 'data-exe-hide-user-menu',
                downloadButton: 'data-exe-hide-download',
                helpMenu: 'data-exe-hide-help',
            });
        });
    });

    describe('applyHideUI', () => {
        it('should set attributes for truthy flags', () => {
            applyHideUI({ fileMenu: true, saveButton: true });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBe('true');
            expect(document.body.getAttribute('data-exe-hide-save')).toBe('true');
        });

        it('should remove attributes for falsy flags', () => {
            document.body.setAttribute('data-exe-hide-file-menu', 'true');
            document.body.setAttribute('data-exe-hide-save', 'true');

            applyHideUI({ fileMenu: false, saveButton: false });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBeNull();
            expect(document.body.getAttribute('data-exe-hide-save')).toBeNull();
        });

        it('should only touch keys present in hideFlags', () => {
            document.body.setAttribute('data-exe-hide-share', 'true');

            applyHideUI({ fileMenu: true });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBe('true');
            // Untouched — not in hideFlags
            expect(document.body.getAttribute('data-exe-hide-share')).toBe('true');
        });

        it('should handle empty hideFlags without errors', () => {
            expect(() => applyHideUI({})).not.toThrow();
        });

        it('should ignore unknown keys', () => {
            applyHideUI({ unknownKey: true, fileMenu: true });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBe('true');
            // unknownKey should not create any attribute
            expect(document.body.attributes.length).toBeLessThanOrEqual(1);
        });

        it('should handle mixed show/hide in a single call', () => {
            document.body.setAttribute('data-exe-hide-file-menu', 'true');

            applyHideUI({
                fileMenu: false,
                saveButton: true,
                shareButton: true,
            });

            expect(document.body.getAttribute('data-exe-hide-file-menu')).toBeNull();
            expect(document.body.getAttribute('data-exe-hide-save')).toBe('true');
            expect(document.body.getAttribute('data-exe-hide-share')).toBe('true');
        });
    });
});
