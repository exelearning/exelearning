import { describe, it, expect } from 'vitest';
import { printPreviewShell } from './printPreviewShell.js';

describe('shared print preview shell', () => {
    it('provides the editor controls, accessible dialog and safe translated labels', () => {
        document.body.innerHTML = printPreviewShell(key => key === 'Close' ? '<img src=x onerror=alert(1)>"&\'' : key);
        expect(document.querySelector('[role="dialog"]').getAttribute('aria-modal')).toBe('true');
        expect(document.getElementById('printOptLinkUrls').checked).toBe(true);
        expect(document.getElementById('printOptUnfoldBlocks').checked).toBe(false);
        expect(document.getElementById('printOptTeacherOnly').checked).toBe(false);
        expect(document.querySelector('.print-preview-close-btn').textContent).toContain('<img src=x');
        expect(document.querySelector('img')).toBeNull();
        expect(document.querySelector('iframe').title).toBe('Print preview');
    });
});
