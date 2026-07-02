import { describe, it, expect } from 'vitest';
import { inlinePreviewPage } from './srcdocInliner.js';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const WOFF2_BYTES = new Uint8Array([0x77, 0x4f, 0x46, 0x32]);
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function page(body, head = '') {
    return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('srcdocInliner', () => {
    it('inlines stylesheets as <style> blocks', () => {
        const files = { 'content/css/base.css': 'body { color: rgb(1, 2, 3); }' };
        const html = page('', '<link rel="stylesheet" href="content/css/base.css">');
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).not.toContain('<link');
        expect(out).toContain('body { color: rgb(1, 2, 3); }');
    });

    it('resolves stylesheet hrefs relative to the page path', () => {
        const files = { 'content/css/base.css': 'h1 { margin: 0; }' };
        const html = page('', '<link rel="stylesheet" href="../content/css/base.css">');
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'html/page2.html' });
        expect(out).toContain('h1 { margin: 0; }');
    });

    it('resolves CSS url() references relative to the CSS file directory', () => {
        const files = {
            'theme/style.css': '.hero { background-image: url(../content/resources/bg.png); }',
            'content/resources/bg.png': PNG_BYTES,
        };
        const html = page('', '<link rel="stylesheet" href="theme/style.css">');
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).toContain('data:image/png;base64,');
        expect(out).not.toContain('url(../content/resources/bg.png)');
    });

    it('inlines fonts referenced from CSS as data URIs', () => {
        const files = {
            'theme/style.css': "@font-face { src: url('fonts/x.woff2') format('woff2'); }",
            'theme/fonts/x.woff2': WOFF2_BYTES,
        };
        const html = page('', '<link rel="stylesheet" href="theme/style.css">');
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).toContain('data:font/woff2;base64,');
    });

    it('resolves @import chains recursively with a cycle guard', () => {
        const files = {
            'a.css': '@import url("b.css"); .a { color: red; }',
            'b.css': '@import "a.css"; .b { color: blue; }',
        };
        const html = page('', '<link rel="stylesheet" href="a.css">');
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).toContain('.a { color: red; }');
        expect(out).toContain('.b { color: blue; }');
        expect(out).not.toContain('@import');
    });

    it('inlines scripts and escapes closing tags', () => {
        const files = { 'libs/x.js': 'var t = "</script>"; var ok = 1;' };
        const html = page('<script src="libs/x.js"></script>');
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).toContain('var ok = 1;');
        expect(out).toContain('<\\/script>');
    });

    it('converts img src and srcset candidates to data URIs', () => {
        const files = { 'content/resources/a.png': PNG_BYTES, 'content/resources/b.png': PNG_BYTES };
        const html = page(
            '<img src="content/resources/a.png" srcset="content/resources/a.png 1x, content/resources/b.png 2x">',
        );
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).not.toContain('src="content/resources/a.png"');
        expect((out.match(/data:image\/png;base64,/g) || []).length).toBeGreaterThanOrEqual(3);
        expect(out).toContain('1x');
        expect(out).toContain('2x');
    });

    it('inlines <a> hrefs that point to image assets but leaves page-navigation hrefs alone', () => {
        // Image iDevices (before/after, gallery, magnifier) carry their images as anchor
        // hrefs and promote them to <img> at runtime — those must be inlined for srcdoc.
        const files = { 'content/resources/before.jpg': PNG_BYTES };
        const html = page(
            '<a href="content/resources/before.jpg">img</a><a href="html/page2.html">Next page</a>',
        );
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).toContain('data:image/jpeg;base64,');
        expect(out).not.toContain('href="content/resources/before.jpg"');
        // Page-navigation hrefs resolve to a non-image class and stay untouched.
        expect(out).toContain('href="html/page2.html"');
    });

    it('converts audio/video/source/track/poster references to data URIs', () => {
        const files = {
            'content/resources/a.mp3': new Uint8Array([1]),
            'content/resources/v.mp4': new Uint8Array([2]),
            'content/resources/p.png': PNG_BYTES,
            'content/resources/t.vtt': 'WEBVTT',
        };
        const html = page(
            '<audio src="content/resources/a.mp3"></audio>' +
                '<video src="content/resources/v.mp4" poster="content/resources/p.png">' +
                '<source src="content/resources/v.mp4" type="video/mp4">' +
                '<track src="content/resources/t.vtt" kind="captions">' +
                '</video>',
        );
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect(out).toContain('data:audio/mpeg;base64,');
        expect(out).toContain('data:video/mp4;base64,');
        expect(out).toContain('poster="data:image/png;base64,');
        expect(out).not.toContain('src="content/resources/v.mp4"');
    });

    it('replaces PDF embeds with data-URI placeholders', () => {
        const files = { 'content/resources/doc.pdf': PDF_BYTES };
        const html = page(
            '<object data="content/resources/doc.pdf" width="600" height="400">fallback</object>' +
                '<embed src="content/resources/doc.pdf">' +
                '<iframe src="content/resources/doc.pdf"></iframe>',
        );
        const { html: out } = inlinePreviewPage(html, files, { pagePath: 'index.html' });
        expect((out.match(/data-exe-pdf-src="data:application\/pdf;base64,/g) || []).length).toBe(3);
        expect(out).not.toContain('<object');
        expect(out).not.toContain('<embed');
    });

    it('skips oversized assets, keeps the original reference and reports them', () => {
        const big = new Uint8Array(64);
        const files = { 'content/resources/big.png': big, 'content/resources/ok.png': PNG_BYTES };
        const html = page('<img src="content/resources/big.png"><img src="content/resources/ok.png">');
        const { html: out, stats } = inlinePreviewPage(html, files, {
            pagePath: 'index.html',
            perAssetCaps: { image: 16 },
        });
        expect(out).toContain('src="content/resources/big.png"');
        expect(out).toContain('data:image/png;base64,');
        expect(stats.skipped).toEqual([
            { path: 'content/resources/big.png', size: 64, reason: 'per-asset-cap' },
        ]);
    });

    it('stops inlining once the total budget is exhausted and reports it', () => {
        const files = { 'a.png': new Uint8Array(30), 'b.png': new Uint8Array(30) };
        const html = page('<img src="a.png"><img src="b.png">');
        const { html: out, stats } = inlinePreviewPage(html, files, {
            pagePath: 'index.html',
            totalBudget: 50,
        });
        const inlined = (out.match(/data:image\/png;base64,/g) || []).length;
        expect(inlined).toBe(1);
        expect(stats.skipped.some((s) => s.reason === 'total-budget')).toBe(true);
    });

    it('leaves references to missing files untouched', () => {
        const html = page('<img src="nope.png">', '<link rel="stylesheet" href="nope.css">');
        const { html: out, stats } = inlinePreviewPage(html, {}, { pagePath: 'index.html' });
        expect(out).toContain('src="nope.png"');
        expect(out).toContain('href="nope.css"');
        expect(stats.skipped).toEqual([]);
    });

    it('never touches data:, blob: or external URLs', () => {
        const html = page(
            '<img src="data:image/png;base64,AAA="><img src="https://example.com/x.png"><img src="blob:x">',
        );
        const { html: out } = inlinePreviewPage(html, {}, { pagePath: 'index.html' });
        expect(out).toContain('data:image/png;base64,AAA=');
        expect(out).toContain('https://example.com/x.png');
        expect(out).toContain('blob:x');
    });
});
