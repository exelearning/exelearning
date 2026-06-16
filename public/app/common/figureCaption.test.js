import { describe, it, expect } from 'vitest';
import { buildFigureCaption, resolveCaptionLicense } from './figureCaption.js';

// This file is the browser twin of src/shared/export/figure-caption.ts.
// These tests intentionally mirror figure-caption.spec.ts so the two stay in lockstep.

describe('resolveCaptionLicense (twin)', () => {
    it('resolves CC 4.0 variants to their canonical URL + cc class', () => {
        expect(resolveCaptionLicense('Creative Commons BY')).toEqual({
            url: 'https://creativecommons.org/licenses/by/4.0/',
            cssClass: 'cc cc-by',
            isCC: true,
        });
        expect(resolveCaptionLicense('Creative Commons BY-NC-SA')).toEqual({
            url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
            cssClass: 'cc cc-by-nc-sa',
            isCC: true,
        });
    });

    it('resolves CC0 and GNU/GPL, and leaves plain licenses unlinked', () => {
        expect(resolveCaptionLicense('Creative Commons (Public Domain)')).toEqual({
            url: 'https://creativecommons.org/publicdomain/zero/1.0/',
            cssClass: 'cc cc-0',
            isCC: true,
        });
        expect(resolveCaptionLicense('GNU/GPL')).toEqual({
            url: 'https://www.gnu.org/licenses/gpl.html',
            cssClass: '',
            isCC: false,
        });
        expect(resolveCaptionLicense('Public Domain')).toEqual({ url: '', cssClass: '', isCC: false });
        expect(resolveCaptionLicense('')).toEqual({ url: '', cssClass: '', isCC: false });
    });
});

describe('buildFigureCaption (twin)', () => {
    it('returns nothing when hidden or empty', () => {
        expect(buildFigureCaption({ title: 'x', license: 'Creative Commons BY' }, { hidden: true })).toEqual({
            header: '',
            caption: '',
        });
        expect(buildFigureCaption({}, {})).toEqual({ header: '', caption: '' });
    });

    it('renders heading, linked name/author, CC license and notes', () => {
        const { header, caption } = buildFigureCaption(
            {
                title: 'Sunset',
                author: 'Ada',
                authorUrl: 'https://ada.example',
                sourceUrl: 'https://src.example/s.jpg',
                license: 'Creative Commons BY-SA',
            },
            { heading: 'Figure 1', notes: 'Cropped' },
        );
        expect(header).toBe('<div class="figcaption header"><strong>Figure 1</strong></div>');
        expect(caption).toContain(
            '<a class="title" href="https://src.example/s.jpg" target="_blank" rel="noopener"><em>Sunset</em></a>',
        );
        expect(caption).toContain('<a class="author" href="https://ada.example" target="_blank" rel="noopener">Ada</a>');
        expect(caption).toContain(
            '<a class="license cc cc-by-sa" href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener" target="_blank"><span></span>Creative Commons BY-SA</a>',
        );
        expect(caption).toContain('<span class="notes">Cropped</span>');
    });

    it('renders spans (no links) and a custom-license when URLs are absent', () => {
        const { caption } = buildFigureCaption({ title: 'Sunset', author: 'Ada', license: 'Public Domain' }, {});
        expect(caption).toContain('<span class="title"><em>Sunset</em></span>');
        expect(caption).toContain('<span class="author">Ada</span>');
        expect(caption).toContain('<span class="license custom-license">Public Domain</span>');
        expect(caption).not.toContain('<a ');
    });

    it('escapes HTML in text and quotes in URLs', () => {
        const { header, caption } = buildFigureCaption(
            { title: '<b>x</b>', author: 'A & B', sourceUrl: 'https://e.example/"a"' },
            { heading: '<i>h</i>', notes: '5 < 6' },
        );
        expect(header).toBe('<div class="figcaption header"><strong>&lt;i&gt;h&lt;/i&gt;</strong></div>');
        expect(caption).toContain('<em>&lt;b&gt;x&lt;/b&gt;</em>');
        expect(caption).toContain('A &amp; B');
        expect(caption).toContain('href="https://e.example/&quot;a&quot;"');
        expect(caption).toContain('5 &lt; 6');
    });

    it('registers itself on window for the standalone TinyMCE plugin', () => {
        expect(typeof window.exeFigureCaption.buildFigureCaption).toBe('function');
        expect(typeof window.exeFigureCaption.resolveCaptionLicense).toBe('function');
        const { caption } = window.exeFigureCaption.buildFigureCaption({ title: 'Via window' }, {});
        expect(caption).toContain('Via window');
    });
});
