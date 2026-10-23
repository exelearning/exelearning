import { describe, expect, it } from 'bun:test';
import { printPackagePages, printPackageEntry, resolvePrintResourceUrls, serializePrintPackage } from './printPackage';
import type { ExportPage } from './interfaces';

const page = (id: string, extra: Partial<ExportPage> = {}): ExportPage => ({
    id,
    title: id,
    parentId: null,
    order: 0,
    blocks: [],
    ...extra,
});

describe('portable print package', () => {
    it('excludes hidden ancestors, blocks and components without mutating the source', () => {
        const pages = [
            page('hidden', { properties: { visibility: 'false' } }),
            page('child', { parentId: 'hidden' }),
            page('visible', {
                blocks: [
                    { id: 'hidden-block', name: '', order: 0, properties: { visibility: false }, components: [] },
                    {
                        id: 'visible-block',
                        name: '',
                        order: 1,
                        components: [
                            {
                                id: 'hidden-component',
                                type: 'text',
                                order: 0,
                                content: 'secret',
                                structureProperties: { visibility: false },
                            },
                            {
                                id: 'teacher',
                                type: 'text',
                                order: 1,
                                content: 'teacher content',
                                structureProperties: { teacherOnly: true },
                            },
                        ],
                    },
                ],
            }),
        ];
        const before = JSON.stringify(pages);
        const result = printPackagePages(pages);
        expect(result.map(item => item.id)).toEqual(['visible']);
        expect(result[0].blocks.map(item => item.id)).toEqual(['visible-block']);
        expect(result[0].blocks[0].components.map(item => item.id)).toEqual(['teacher']);
        expect(JSON.stringify(pages)).toBe(before);
    });

    it('serializes script delimiters and line separators without losing content', () => {
        const data = {
            metadata: { title: '</script><script>alert(1)</script>\u2028\u2029', author: '', theme: 'base' },
            pages: [],
            assetPaths: [],
            themeFiles: [],
            materialIcons: [],
            translations: {},
            i18n: '',
        };
        const script = serializePrintPackage(data);
        expect(script).not.toContain('<');
        expect(JSON.parse(script.slice('window.__exePrintPackage='.length, -1))).toEqual(data);
    });

    it.each(['https://example.test/html/course/', 'file:///C:/my%20course/'])(
        'resolves resources from the explicit root %s',
        root => {
            const html = `<img src="asset://id.png"><img src="asset://other/photo.svg"><link href="content/css/base.css"><script src="libs/common.js"></script><img src="theme/icon.svg"><div style="background:url('fonts/global/test.woff2')"></div><p data-json="{&quot;url&quot;:&quot;idevices/text/text.js&quot;}"></p>`;
            const result = resolvePrintResourceUrls(html, root, new Map([['id', 'images/my%20photo.png']]));
            for (const path of [
                'content/resources/images/my%20photo.png',
                'content/resources/other/photo.svg',
                'content/css/base.css',
                'libs/common.js',
                'theme/icon.svg',
                'fonts/global/test.woff2',
                'idevices/text/text.js',
            ]) {
                expect(result).toContain(new URL(path, root).href);
            }
            expect(result).not.toContain('asset://');
            expect(
                resolvePrintResourceUrls('<a href="https://other.test/theme/file">link</a>', root, new Map()),
            ).toContain('https://other.test/theme/file');
        },
    );

    it('resolves blob resources and fragments inside HTML and encoded activity data', () => {
        const html =
            '<img src="asset://picture"><a href="content/resources/figure.svg#label">' +
            '<p data-json="{&quot;src&quot;:&quot;idevices/text/text.js&quot;}"></p>';
        expect(
            resolvePrintResourceUrls(html, 'https://example.test/', new Map([['picture', 'figure.svg']]), {
                'content/resources/figure.svg': 'blob:figure',
                'idevices/text/text.js': 'blob:script',
            }),
        ).toBe(
            '<img src="blob:figure"><a href="blob:figure#label">' +
                '<p data-json="{&quot;src&quot;:&quot;blob:script&quot;}"></p>',
        );
    });

    it.each(['https://example.test/01/', 'file:///C:/course/'])(
        'resolves preprocessed worksheet pictures without leaving context markers at %s',
        root => {
            const html =
                '<img src="{{context_path}}/content/resources/perro.jpg">' +
                '<img src="%7B%7Bcontext_path%7D%7D/content/resources/rabbit.svg">' +
                '<p data-json="{&quot;url&quot;:&quot;{{context_path}}/content/resources/tigre.png&quot;}"></p>';
            const resolved = resolvePrintResourceUrls(html, root, new Map());
            for (const name of ['perro.jpg', 'rabbit.svg', 'tigre.png']) {
                expect(resolved).toContain(new URL('content/resources/' + name, root).href);
            }
            expect(resolved).not.toContain('context_path');
            expect(
                resolvePrintResourceUrls(html, root, new Map(), {
                    'content/resources/perro.jpg': 'blob:dog',
                }),
            ).toContain('src="blob:dog"');
        },
    );

    it('provides a local classic-script entry point and sanitizes the language attribute', () => {
        expect(printPackageEntry('es')).toContain('lang="es"');
        expect(printPackageEntry('')).toContain('lang="en"');
        expect(printPackageEntry('"<>')).not.toContain('lang=""<>');
        expect(printPackageEntry('es')).toContain('data-print-open="true"');
        expect(printPackageEntry('es')).not.toContain('type="module"');
    });
});
