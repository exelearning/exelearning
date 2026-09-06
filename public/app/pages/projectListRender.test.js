import { describe, it, expect } from 'vitest';
import { buildProjectRowsHtml, escapeHtml } from './projectListRender.js';

const t = {
    untitled: 'Untitled',
    private_label: 'Private',
    public_label: 'Public',
    manual: 'Manual',
    autosaved: 'Autosaved',
    duplicate: 'Duplicate',
    clone_to_my: 'Clone to my projects',
    delete_label: 'Delete',
    shared_by: 'Shared by',
};

const formatDate = () => '21/07/2026 12:00';

describe('escapeHtml', () => {
    it('escapes the five HTML-significant characters', () => {
        expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
        expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
    });

    it('returns an empty string for null/undefined', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('buildProjectRowsHtml XSS protection', () => {
    it('escapes a malicious project title so no live element is injected', () => {
        const html = buildProjectRowsHtml(
            [{ odeId: 'u1', role: 'owner', title: '<img src=x onerror=alert(1)>', versionName: '1' }],
            { t, formatDate },
        );

        // The payload survives only as escaped text, never as raw markup.
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');

        const container = document.createElement('div');
        container.innerHTML = html;

        // No live <img> node and therefore no onerror handler ever runs.
        expect(container.querySelector('img')).toBeNull();
        // The title renders as literal text, byte-for-byte.
        expect(container.querySelector('.ode-title').textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('escapes a collaborator email in both the title attribute and the text', () => {
        const html = buildProjectRowsHtml(
            [
                {
                    odeId: 'u2',
                    role: 'editor',
                    title: 'Shared project',
                    versionName: '1',
                    // Attribute-breakout attempt: a bare " would otherwise inject onmouseover.
                    ownerEmail: 'x" onmouseover="alert(1)',
                },
            ],
            { t, formatDate },
        );

        const container = document.createElement('div');
        container.innerHTML = html;

        const owner = container.querySelector('.ode-owner-info');
        expect(owner).not.toBeNull();
        // No injected event handler attribute leaked out of the title="".
        expect(owner.getAttribute('onmouseover')).toBeNull();
        // Email is preserved verbatim as text and as the title attribute value.
        expect(owner.textContent).toBe('x" onmouseover="alert(1)');
        expect(owner.getAttribute('title')).toBe('Shared by x" onmouseover="alert(1)');
    });

    it('escapes a malicious version string', () => {
        const html = buildProjectRowsHtml(
            [{ odeId: 'u3', role: 'owner', title: 'Ok', versionName: '<img src=x onerror=alert(2)>' }],
            { t, formatDate },
        );
        const container = document.createElement('div');
        container.innerHTML = html;
        expect(container.querySelector('img')).toBeNull();
    });
});
