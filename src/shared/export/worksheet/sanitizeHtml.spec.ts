import { describe, expect, it } from 'bun:test';
import { hasPrintableContent, htmlToText, sanitizeHtml } from './sanitizeHtml';

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

    describe('content embedded from the web', () => {
        /** What the sheet prints where content from this address was embedded. */
        const address = (url: string) => `<span class="worksheet-embed-address"><a href="${url}">${url}</a></span>`;

        it('prints its address where it was, the way the document prints its frames', () => {
            const html =
                '<p>Revisa la siguiente información:</p><div><div><iframe width="1200px" ' +
                'src="https://view.genial.ly/5bb353835b64ad591a0c0924" allowfullscreen></iframe></div></div>';

            expect(sanitizeHtml(html)).toBe(
                `<p>Revisa la siguiente información:</p><div><div>${address('https://view.genial.ly/5bb353835b64ad591a0c0924')}</div></div>`,
            );
        });

        it('reads the address where each kind of embedding keeps it, and nothing inside it', () => {
            expect(sanitizeHtml('<embed src="https://v/1.swf">')).toBe(address('https://v/1.swf'));
            expect(
                sanitizeHtml('<object data="https://v/2"><param name="movie" value="x"><p>Fallback</p></object>'),
            ).toBe(address('https://v/2'));
        });

        it('gives an address without its protocol the one print recognises', () => {
            expect(sanitizeHtml('<iframe src="//www.youtube.com/embed/abc"></iframe>')).toBe(
                address('https://www.youtube.com/embed/abc'),
            );
            expect(sanitizeHtml('<iframe src=" HTTPS://v/1 "></iframe>')).toBe(address('https://v/1'));
        });

        it('escapes the address, which is the author’s', () => {
            expect(sanitizeHtml('<iframe src=\'https://v/?a=1&b="2"<x>\'></iframe>')).toBe(
                '<span class="worksheet-embed-address"><a href="https://v/?a=1&amp;b=&quot;2&quot;&lt;x&gt;">' +
                    'https://v/?a=1&amp;b=&quot;2&quot;&lt;x&gt;</a></span>',
            );
        });

        it('keeps the paragraph that held it, which now holds the address', () => {
            expect(sanitizeHtml('<p><iframe src="https://v/1"></iframe></p><p>Texto</p>')).toBe(
                `<p>${address('https://v/1')}</p><p>Texto</p>`,
            );
        });

        it.each([
            '<iframe src="https://v/1"></iframe>',
            '<embed src="https://v/1">',
            '<object data="https://v/1"></object>',
        ])('does not nest an address link inside an author link: %s', embed => {
            expect(sanitizeHtml(`<a href="https://x/doc">Before ${embed} after</a>`)).toBe(
                '<a href="https://x/doc">Before ' +
                    '<span class="worksheet-embed-address">https://v/1</span> after</a>',
            );
        });

        it('keeps the address linked when the enclosing author link is removed', () => {
            expect(sanitizeHtml('<a href="javascript:alert(1)"><iframe src="https://v/1"></iframe></a>')).toBe(
                address('https://v/1'),
            );
        });
    });

    it('removes content embedded from anywhere else, which a reader of the paper cannot reach', () => {
        expect(sanitizeHtml('<iframe src="content/resources/game.html"></iframe><p>Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<iframe src="javascript:alert(1)"></iframe><p>Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<iframe srcdoc="<p>Hi</p>"></iframe><p>Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<iframe src="https:///v"></iframe><p>Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<embed src="blob:http://localhost/abc"><p>Text</p>')).toBe('<p>Text</p>');
        expect(sanitizeHtml('<object data="x"></object><p>Text</p>')).toBe('<p>Text</p>');
        // Only the embeddings point somewhere: a picture drawn in SVG has no address to print.
        expect(sanitizeHtml('<svg src="https://v/1"></svg><p>Text</p>')).toBe('<p>Text</p>');
    });

    describe('what a removed element leaves behind', () => {
        it('takes the paragraph that held nothing but a video', () => {
            // Otherwise it prints as a hole the size of the words it replaced.
            const html = '<p><span><iframe src="video.html"></iframe><br /></span></p><p>Texto</p>';

            expect(sanitizeHtml(html)).toBe('<p>Texto</p>');
        });

        it('keeps the paragraph when something in it still prints', () => {
            const html = '<p>Mira<iframe src="video.html"></iframe></p>';

            expect(sanitizeHtml(html)).toBe('<p>Mira</p>');
        });

        it('counts a picture as something that prints', () => {
            const html = '<p><iframe src="video.html"></iframe><img src="pic.png" /></p>';

            expect(sanitizeHtml(html)).toBe('<p><img src="pic.png" /></p>');
        });

        it('takes a link left with nothing to show', () => {
            // Print would write its address after nothing at all.
            expect(sanitizeHtml('<p><a href="https://x"><iframe src="video.html"></iframe></a>Texto</p>')).toBe(
                '<p>Texto</p>',
            );
        });

        it('keeps a blank paragraph the author left, nothing having been taken out of it', () => {
            // An empty paragraph between two others is spacing they asked for.
            expect(sanitizeHtml('<p>Uno</p><p></p><p>Dos</p>')).toBe('<p>Uno</p><p></p><p>Dos</p>');
            expect(sanitizeHtml('<p>Uno</p><p><br /></p><p>Dos</p>')).toBe('<p>Uno</p><p><br /></p><p>Dos</p>');
        });

        it('keeps a table cell, whose emptiness is the shape of the table', () => {
            const html = '<table><tr><td><iframe src="video.html"></iframe></td><td>Dos</td></tr></table>';

            expect(sanitizeHtml(html)).toContain('<td></td>');
        });
    });

    it('unwraps disallowed tags but keeps their text', () => {
        expect(sanitizeHtml('<marquee>Moving</marquee>')).toBe('Moving');
        expect(sanitizeHtml('<font color="red">Red</font>')).toBe('Red');
    });

    describe('links', () => {
        it('keeps one to the web, for print to write its address after it', () => {
            const html = '<p>Consulta <a href="https://es.wikipedia.org/wiki/Gusto">este artículo</a></p>';

            expect(sanitizeHtml(html)).toBe(html);
        });

        it('keeps its address and nothing else of it', () => {
            expect(
                sanitizeHtml(
                    '<a href="http://x/?a=1&amp;b=2" target="_blank" class="btn" style="color:red" onclick="steal()">Read this</a>',
                ),
            ).toBe('<a href="http://x/?a=1&amp;b=2">Read this</a>');
        });

        it('gives an address without its protocol the one print recognises', () => {
            expect(sanitizeHtml('<a href="//x/page">Read this</a>')).toBe('<a href="https://x/page">Read this</a>');
            expect(sanitizeHtml('<a href="HTTP://x">Read this</a>')).toBe('<a href="http://x">Read this</a>');
        });

        it('keeps only the text of one leading anywhere a reader of the paper cannot go', () => {
            for (const href of [
                '#top',
                'page.html',
                'exe-node:abc',
                'asset://5f0e8a2c/file.pdf',
                'mailto:someone@example.com',
                'javascript:alert(1)',
                'java&#115;cript:alert(1)',
                ' java\tscript:alert(1)',
            ]) {
                expect(sanitizeHtml(`<a href="${href}">Read this</a>`)).toBe('Read this');
            }
            expect(sanitizeHtml('<a name="top">Read this</a>')).toBe('Read this');
        });

        it.each([
            ['<a href="https://x.com"></a>', ''],
            ['<a href="https://x.com"> </a>', ' '],
            ['<a href="https://x.com"><span></span></a>', '<span></span>'],
            ['<a href="https://x.com"><audio src="a.mp3"></audio></a>', ''],
            ['<a href="https://x.com"><video><source src="v.mp4"></video></a>', ''],
        ])('keeps no link round nothing to read, whose address would print on its own: %s', (link, left) => {
            expect(sanitizeHtml(`<p>Mira${link}</p>`)).toBe(`<p>Mira${left}</p>`);
        });

        it('keeps one round a picture, whose address print leaves out', () => {
            expect(sanitizeHtml('<a href="https://x.com"><img src="pic.png" /></a>')).toBe(
                '<a href="https://x.com"><img src="pic.png" /></a>',
            );
        });
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

describe('hasPrintableContent', () => {
    it('counts content embedded from the web, whose address prints', () => {
        expect(hasPrintableContent('<p><iframe src="https://v/1"></iframe></p>')).toBe(true);
    });

    it('does not count content embedded from anywhere else, which leaves nothing', () => {
        expect(hasPrintableContent('<p><iframe src="video.html"></iframe></p>')).toBe(false);
    });
});
