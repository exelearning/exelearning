import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { ThemeFileUrlResolver } from './ThemeFileUrlResolver';

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('ThemeFileUrlResolver', () => {
    /** Every blob handed out, keyed by its URL, so a test can read what it holds. */
    let blobs: Map<string, Blob>;
    let revoked: string[];

    beforeEach(() => {
        blobs = new Map();
        revoked = [];
        let counter = 0;
        URL.createObjectURL = (blob: Blob) => {
            const url = `blob:http://localhost/${++counter}`;
            blobs.set(url, blob);
            return url;
        };
        URL.revokeObjectURL = (url: string) => {
            revoked.push(url);
        };
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
    });

    /** A style made of the given files, each holding the given text. */
    const style = (files: Record<string, string>) =>
        new ThemeFileUrlResolver(
            new Map(Object.entries(files).map(([path, text]) => [path, new TextEncoder().encode(text)])),
        );

    /** The text of the stylesheet a page now links to. */
    const linkedStylesheet = (html: string) => {
        const url = html.match(/href="(blob:[^"]+)"/)?.[1];
        return url ? blobs.get(url)?.text() : undefined;
    };

    /** The blob a stylesheet's reference now points at. */
    const referenced = (css: string, index = 0) =>
        blobs.get([...css.matchAll(/url\(['"]?(blob:[^'")]+)/g)][index]?.[1]);

    describe('the page', () => {
        it("points each reference to the style's files at a blob URL of the right type", () => {
            const html = style({ 'style.css': 'body{}', 'style.js': 'void 0', 'icons/info.svg': '<svg/>' }).resolve(
                '<link rel="stylesheet" href="theme/style.css"><script src="theme/style.js"></script><img src="theme/icons/info.svg">',
            );

            expect(html).not.toContain('"theme/');
            // Bun adds a charset to text types and names JavaScript text/javascript; browsers keep
            // the type as given. What matters is the kind: a stylesheet must be served as CSS to
            // be applied, and an SVG as SVG to be drawn.
            const [css, js, svg] = [...blobs.values()].map(blob => blob.type);
            expect(css).toStartWith('text/css');
            expect(js).toContain('javascript');
            expect(svg).toBe('image/svg+xml');
        });

        it('gives a file one URL, however often the page refers to it', () => {
            const html = style({ 'icons/info.png': 'png' }).resolve(
                '<img src="theme/icons/info.png"><img src="theme/icons/info.png">',
            );

            expect(blobs.size).toBe(1);
            expect(html).toBe('<img src="blob:http://localhost/1"><img src="blob:http://localhost/1">');
        });

        it('leaves alone a reference to a file the style does not have', () => {
            const html = style({}).resolve('<img src="theme/icons/missing.png">');

            expect(html).toBe('<img src="theme/icons/missing.png">');
            expect(blobs.size).toBe(0);
        });

        it('leaves alone an attribute that only ends in src', () => {
            const html = style({ 'icons/info.png': 'png' }).resolve('<img data-src="theme/icons/info.png">');

            expect(html).toBe('<img data-src="theme/icons/info.png">');
        });
    });

    describe('a stylesheet', () => {
        it('has its relative references pointed at the files they name, quoted as they were', async () => {
            const html = style({
                'style.css':
                    '.a{background:url(img/a.png)} .b{background:url(\'img/b.svg\')} .c{src:url("fonts/c.woff2?v=1#x")}',
                'img/a.png': 'a',
                'img/b.svg': '<svg/>',
                'fonts/c.woff2': 'c',
            }).resolve('<link href="theme/style.css">');

            const css = (await linkedStylesheet(html)) ?? '';
            expect(css).toMatch(
                /^\.a\{background:url\(blob:[^)]+\)\} \.b\{background:url\('blob:[^']+'\)\} \.c\{src:url\("blob:[^"]+"\)\}$/,
            );
            expect([0, 1, 2].map(index => referenced(css, index)?.type)).toEqual([
                'image/png',
                'image/svg+xml',
                'application/octet-stream',
            ]);
        });

        it('resolves references against the folder it sits in', async () => {
            const html = style({
                'css/extra.css': '.a{background:url(../img/a.png)} .b{background:url(./b.png)}',
                'img/a.png': 'a',
                'css/b.png': 'b',
            }).resolve('<link href="theme/css/extra.css">');

            const css = (await linkedStylesheet(html)) ?? '';
            expect(await referenced(css, 0)?.text()).toBe('a');
            expect(await referenced(css, 1)?.text()).toBe('b');
        });

        it('finds a file whose name it had to escape', async () => {
            const html = style({ 'style.css': '.a{background:url(img/my%20bg.png)}', 'img/my bg.png': 'bg' }).resolve(
                '<link href="theme/style.css">',
            );

            expect(await referenced((await linkedStylesheet(html)) ?? '')?.text()).toBe('bg');
        });

        it('leaves alone what is not relative to it, or names no file the style has', async () => {
            const original =
                '.a{background:url(data:image/png;base64,AAAA)} .b{background:url(https://cdn.example.test/b.png)} ' +
                '.c{background:url(/c.png)} .d{mask:url(#d)} .e{background:url(img/missing.png)} .f{background:url(img/100%.png)}';
            const html = style({ 'style.css': original }).resolve('<link href="theme/style.css">');

            expect(await linkedStylesheet(html)).toBe(original);
        });

        it('does not loop on stylesheets that refer to each other', async () => {
            const html = style({ 'a.css': '@import url(b.css);', 'b.css': '@import url(a.css);' }).resolve(
                '<link href="theme/a.css">',
            );

            const a = (await linkedStylesheet(html)) ?? '';
            // a.css points at b.css; b.css could not point back at a.css while it was being made.
            expect(await referenced(a)?.text()).toBe('@import url(a.css);');
        });
    });

    describe('dispose', () => {
        it('releases every URL it handed out, once', () => {
            const resolver = style({ 'style.css': '.a{background:url(a.png)}', 'a.png': 'a' });
            resolver.resolve('<link href="theme/style.css">');

            resolver.dispose();
            resolver.dispose();

            expect(revoked.sort()).toEqual([...blobs.keys()].sort());
        });
    });
});
