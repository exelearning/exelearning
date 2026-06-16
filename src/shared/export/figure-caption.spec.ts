import { describe, it, expect } from 'bun:test';
import { buildFigureCaption, resolveCaptionLicense } from './figure-caption';

describe('resolveCaptionLicense', () => {
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

    it('resolves the CC0 / public-domain-dedication label', () => {
        expect(resolveCaptionLicense('Creative Commons (Public Domain)')).toEqual({
            url: 'https://creativecommons.org/publicdomain/zero/1.0/',
            cssClass: 'cc cc-0',
            isCC: true,
        });
    });

    it('resolves GNU/GPL to its URL with no CC icon', () => {
        expect(resolveCaptionLicense('GNU/GPL')).toEqual({
            url: 'https://www.gnu.org/licenses/gpl.html',
            cssClass: '',
            isCC: false,
        });
    });

    it('returns no URL for plain/custom licenses', () => {
        expect(resolveCaptionLicense('Public Domain')).toEqual({ url: '', cssClass: '', isCC: false });
        expect(resolveCaptionLicense('Copyright (All Rights Reserved)')).toEqual({
            url: '',
            cssClass: '',
            isCC: false,
        });
        expect(resolveCaptionLicense('')).toEqual({ url: '', cssClass: '', isCC: false });
        expect(resolveCaptionLicense(undefined)).toEqual({ url: '', cssClass: '', isCC: false });
    });
});

describe('buildFigureCaption', () => {
    it('returns nothing when the caption is hidden', () => {
        const out = buildFigureCaption(
            { title: 'Sunset', author: 'Ada', license: 'Creative Commons BY' },
            { hidden: true },
        );
        expect(out).toEqual({ header: '', caption: '' });
    });

    it('returns nothing when there is no metadata and no per-instance text', () => {
        expect(buildFigureCaption({}, {})).toEqual({ header: '', caption: '' });
    });

    it('renders the per-instance heading as a header block', () => {
        const out = buildFigureCaption({}, { heading: 'Figure 1' });
        expect(out.header).toBe('<div class="figcaption header"><strong>Figure 1</strong></div>');
    });

    it('links the image name to the source URL and the author to the author URL', () => {
        const { caption } = buildFigureCaption(
            {
                title: 'Sunset',
                author: 'Ada',
                authorUrl: 'https://ada.example',
                sourceUrl: 'https://src.example/s.jpg',
            },
            {},
        );
        expect(caption).toContain('<figcaption class="figcaption">');
        expect(caption).toContain(
            '<a class="title" href="https://src.example/s.jpg" target="_blank" rel="noopener"><em>Sunset</em></a>',
        );
        expect(caption).toContain(
            '<a class="author" href="https://ada.example" target="_blank" rel="noopener">Ada</a>',
        );
    });

    it('renders the name/author as spans when no URLs are present', () => {
        const { caption } = buildFigureCaption({ title: 'Sunset', author: 'Ada' }, {});
        expect(caption).toContain('<span class="title"><em>Sunset</em></span>');
        expect(caption).toContain('<span class="author">Ada</span>');
        expect(caption).not.toContain('<a ');
    });

    it('renders a CC license as a rel="license" link with the cc icon class', () => {
        const { caption } = buildFigureCaption({ license: 'Creative Commons BY-SA' }, {});
        expect(caption).toContain(
            '<a class="license cc cc-by-sa" href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener" target="_blank"><span></span>Creative Commons BY-SA</a>',
        );
    });

    it('renders a non-linkable license as a custom-license span', () => {
        const { caption } = buildFigureCaption({ license: 'Public Domain' }, {});
        expect(caption).toContain('<span class="license custom-license">Public Domain</span>');
        expect(caption).not.toContain('<a ');
    });

    it('appends per-instance notes', () => {
        const { caption } = buildFigureCaption({ title: 'Sunset' }, { notes: 'Cropped for clarity' });
        expect(caption).toContain('<span class="notes">Cropped for clarity</span>');
    });

    it('escapes HTML in text values and quotes in URLs', () => {
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
});
