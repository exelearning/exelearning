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
        blobs.get([...css.matchAll(/url\(['"]?(blob:[^'")]+)/g)][index]?.[1]?.split('#')[0]);

    describe('the page', () => {
        it("points each reference to the style's files at a blob URL of the right type", () => {
            const html = style({ 'style.css': 'body{}', 'style.js': 'void 0', 'icons/info.svg': '<svg/>' }).resolve(
                '<link rel="stylesheet" href="theme/style.css"><script src="theme/style.js"></script><img src="theme/icons/info.svg">',
            );

            expect(html).not.toMatch(/\s(?:src|href)="theme\//);
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
            expect(html.match(/ src="blob:http:\/\/localhost\/1"/g)).toHaveLength(2);
            expect(html.match(/ data-exe-theme-src="theme\/icons\/info.png"/g)).toHaveLength(2);
        });

        it('keeps SVG fragments and the original path without allocating another copy of the file', () => {
            const resolver = style({ 'icons/sprite.svg': '<svg/>' });
            const html = resolver.resolve(
                '<img src="theme/icons/sprite.svg?v=2#first"><img src="theme/icons/sprite.svg#second">',
            );

            expect(html).toContain(' src="blob:http://localhost/1#first"');
            expect(html).toContain(' src="blob:http://localhost/1#second"');
            expect(html).toContain('data-exe-theme-src="theme/icons/sprite.svg?v=2#first"');
            expect(blobs.size).toBe(1);
            expect(resolver.resolve(html)).toBe(html);
            resolver.dispose();
            expect(revoked).toEqual(['blob:http://localhost/1']);
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

        it('resolves string imports recursively without changing their conditions or cascade order', async () => {
            const html = style({
                'style.css': '@import "css/print.css" layer(paper) print;\n@import url(css/screen.css) screen;',
                'css/print.css': "@import 'nested.css'; .print{background:url(../img/stripe.png)}",
                'css/nested.css': '.nested{color:red}',
                'css/screen.css': '.screen{color:blue}',
                'img/stripe.png': 'stripe',
            }).resolve('<link href="theme/style.css">');

            const css = (await linkedStylesheet(html)) ?? '';
            expect(css).toMatch(/^@import "blob:[^"]+" layer\(paper\) print;\n@import url\(blob:[^)]+\) screen;$/);
            const print = (await blobs.get(css.match(/@import "([^"]+)"/)![1])!.text()) ?? '';
            expect(await blobs.get(print.match(/@import '([^']+)'/)![1])!.text()).toBe('.nested{color:red}');
            expect(await referenced(print)?.text()).toBe('stripe');
            expect(await referenced(css)?.text()).toBe('.screen{color:blue}');
        });

        it('resolves parentheses and CSS escapes in quoted and unquoted URLs', async () => {
            const html = style({
                'style.css': String.raw`.a{background:URL("img/photo(1).png")} .b{--icon:url(img/photo\(1\).png)}`,
                'img/photo(1).png': 'photo',
            }).resolve('<link href="theme/style.css">');

            const css = (await linkedStylesheet(html)) ?? '';
            expect(await referenced(css, 0)?.text()).toBe('photo');
            expect(referenced(css, 1)).toBe(referenced(css, 0));
        });

        it('preserves SVG fragment targets while sharing and releasing the underlying blob', async () => {
            const resolver = style({
                'style.css': '.a{filter:url(img/effects.svg?v=2#shadow)} .b{mask:url("img/effects.svg#mask")}',
                'img/effects.svg': '<svg/>',
            });
            const css = (await linkedStylesheet(resolver.resolve('<link href="theme/style.css">'))) ?? '';

            expect(css).toContain('url(blob:http://localhost/1#shadow)');
            expect(css).toContain('url("blob:http://localhost/1#mask")');
            expect(referenced(css, 0)).toBe(referenced(css, 1));
            resolver.dispose();
            expect(revoked).toEqual(['blob:http://localhost/1', 'blob:http://localhost/2']);
        });

        it('preserves comments, content strings, external imports and unrecognized CSS', async () => {
            const original =
                '/* url(icon.png) */ @import "https://example.test/theme.css"; ' +
                ".a{content:'url(icon.png)';invalid ???;color:blue}";
            const html = style({ 'style.css': original, 'icon.png': 'image' }).resolve('<link href="theme/style.css">');

            expect(await linkedStylesheet(html)).toBe(original);
            expect(blobs.size).toBe(1);
        });

        it('keeps attribute selectors matching both original theme paths and ordinary resources', async () => {
            const html = style({
                'style.css':
                    '.box:has(img[src*="eng_" i]){color:green} ' +
                    'a[href$=".pdf"]{color:red} [src],[title="src"]{color:blue}',
            }).resolve('<link href="theme/style.css">');

            expect(await linkedStylesheet(html)).toBe(
                '.box:has(img:is([src*="eng_" i],[data-exe-theme-src*="eng_" i])){color:green} ' +
                    'a:is([href$=".pdf"],[data-exe-theme-href$=".pdf"]){color:red} [src],[title="src"]{color:blue}',
            );
        });

        it('keeps the original stylesheet and other resources usable if CSS analysis fails', async () => {
            const original = '.box{color:green;background:url(image.png)}';
            const resolver = new ThemeFileUrlResolver(
                new Map([
                    ['style.css', new TextEncoder().encode(original)],
                    ['icons/info.svg', new TextEncoder().encode('<svg/>')],
                ]),
                () => {
                    throw new Error('Cannot parse user CSS');
                },
            );
            const html = resolver.resolve('<link href="theme/style.css"><img src="theme/icons/info.svg">');

            expect(await linkedStylesheet(html)).toBe(original);
            expect(html).toContain('src="blob:http://localhost/2"');
            expect(resolver.resolve('<link href="theme/style.css">')).toContain('href="blob:http://localhost/1"');
            resolver.dispose();
            expect(revoked).toEqual(['blob:http://localhost/1', 'blob:http://localhost/2']);
            // Parsing failure must not leave the cycle guard set after disposal.
            expect(resolver.resolve('<link href="theme/style.css">')).toContain('href="blob:http://localhost/3"');
            resolver.dispose();
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
