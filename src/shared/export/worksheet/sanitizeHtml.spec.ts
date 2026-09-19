import { describe, expect, it } from 'bun:test';
import { htmlToText, sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
    it('returns empty string for empty input', () => {
        expect(sanitizeHtml('')).toBe('');
        expect(sanitizeHtml(null)).toBe('');
        expect(sanitizeHtml(undefined)).toBe('');
    });

    it('keeps formatting markup', () => {
        const html = '<p>Observe <strong>las letras</strong> y <em>rellene</em></p><ul><li>uno</li></ul>';

        expect(sanitizeHtml(html)).toBe(html);
    });

    it('drops event handler attributes', () => {
        expect(sanitizeHtml('<p onclick="steal()">Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x" />');
    });

    it('removes scripts together with their contents', () => {
        expect(sanitizeHtml('<p>Before</p><script>alert(1)</script><p>After</p>')).toBe('<p>Before</p><p>After</p>');
        expect(sanitizeHtml('<style>body{display:none}</style><p>Text</p>')).toBe('<p>Text</p>');
    });

    it('removes an unterminated script tag together with what follows it', () => {
        // HTML5 parsing treats the rest of the input as the script's content, so none of it is
        // left behind as text.
        expect(sanitizeHtml('<p>Text</p><script>alert(1)')).toBe('<p>Text</p>');
    });

    it('removes embedded frames and objects', () => {
        expect(sanitizeHtml('<iframe src="http://evil"></iframe><p>Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<object data="x"></object><p>Text</p>')).toBe('<p>Text</p>');
    });

    it('unwraps disallowed tags but keeps their text', () => {
        expect(sanitizeHtml('<a href="http://x">Read this</a>')).toBe('Read this');
        expect(sanitizeHtml('<marquee>Moving</marquee>')).toBe('Moving');
    });

    it('drops class and style from allowed tags', () => {
        expect(sanitizeHtml('<p class="danger" style="position:fixed">Text</p>')).toBe('<p>Text</p>');
    });

    it('keeps safe image sources', () => {
        expect(sanitizeHtml('<img src="blob:http://localhost/abc" alt="Castle">')).toBe(
            '<img src="blob:http://localhost/abc" alt="Castle" />',
        );
        expect(sanitizeHtml('<img src="content/resources/a.png">')).toBe('<img src="content/resources/a.png" />');
        expect(sanitizeHtml('<img src="data:image/png;base64,iVBOR">')).toBe(
            '<img src="data:image/png;base64,iVBOR" />',
        );
    });

    it('rejects dangerous image sources', () => {
        expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe('<img />');
        expect(sanitizeHtml('<img src="data:text/html,<script>alert(1)</script>">')).toBe('<img />');
    });

    it('rejects javascript URLs hidden behind entities or whitespace', () => {
        expect(sanitizeHtml('<img src="java&#115;cript:alert(1)">')).toBe('<img />');
        expect(sanitizeHtml('<img src="java\tscript:alert(1)">')).toBe('<img />');
    });

    it('escapes quotes in kept attribute values', () => {
        expect(sanitizeHtml('<img src="a.png" alt=\'He said "hi"\'>')).toBe(
            '<img src="a.png" alt="He said &quot;hi&quot;" />',
        );
    });

    it('does not let comments smuggle markup through', () => {
        expect(sanitizeHtml('<p>A</p><!-- <script>alert(1)</script> --><p>B</p>')).toBe('<p>A</p><p>B</p>');
    });

    it('neutralises malformed tags instead of leaving them to be reparsed', () => {
        expect(sanitizeHtml('<p>Text</p><img src="x" <script>')).not.toContain('<script');
    });

    it('preserves accents and non latin-1 characters', () => {
        expect(sanitizeHtml('<p>El señor de Ω</p>')).toBe('<p>El señor de Ω</p>');
    });
});

describe('htmlToText', () => {
    it('reduces markup to collapsed visible text', () => {
        expect(htmlToText('<p>Ciudad   del <strong>Cid</strong></p>')).toBe('Ciudad del Cid');
    });

    it('drops script contents rather than exposing them as text', () => {
        expect(htmlToText('<p>Text</p><script>alert(1)</script>')).toBe('Text');
    });

    it('turns non-breaking spaces into ordinary spaces', () => {
        expect(htmlToText('<p>a&nbsp;b</p>')).toBe('a b');
    });

    it('returns empty string for empty input', () => {
        expect(htmlToText('')).toBe('');
        expect(htmlToText(null)).toBe('');
    });
});
