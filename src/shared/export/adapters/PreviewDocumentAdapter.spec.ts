import { describe, expect, it } from 'bun:test';
// The client policy's CSS screening is DOM-free string logic, so the backend
// spec can exercise the real implementation across the JS/TS boundary.
import { prepareStyleForPreview } from '../../../../public/app/utils/previewContentPolicy.js';
import type { ExportDocument, PreviewContentPolicy } from '../interfaces';
import { PREVIEW_METADATA_FIELD_CLASSIFICATION, PreviewDocumentAdapter } from './PreviewDocumentAdapter';
import { YjsDocumentAdapter } from './YjsDocumentAdapter';

function createDocument(): ExportDocument {
    return {
        getMetadata: () => ({
            title: 'Project',
            author: '',
            language: 'en',
            theme: 'base',
            extraHeadContent: '<script>head()</script>',
            footer: '<p onclick="footer()">Footer</p>',
        }),
        getNavigation: () => [
            {
                id: 'page-1',
                title: 'Page',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block',
                        order: 0,
                        components: [
                            {
                                id: 'component-1',
                                type: 'text',
                                order: 0,
                                content: '<img src="x" onerror="content()">',
                                properties: { nested: ['<iframe srcdoc="active"></iframe>'] },
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

const policy: PreviewContentPolicy = {
    prepare: (html, context) => ({
        html: `[${context}]${html.replaceAll('script', 'disabled')}`,
        activeContentFound: html.includes('script') || html.includes('onerror') || html.includes('onclick'),
        categories: html.includes('script') ? ['script'] : [],
        actions: html.includes('script') ? ['removed'] : [],
    }),
};

describe('PreviewDocumentAdapter', () => {
    /**
     * Block properties were the one property bag going through unfiltered — a shallow spread
     * where the page's and the component's both went through the policy. Nothing covered it,
     * which is exactly why an unexplained exception in a fail-closed adapter survived.
     */
    it('filters block properties, like the page and component ones', () => {
        // Built here rather than in the shared fixture: adding active content there shifts
        // the aggregate counts the categories test asserts.
        const source = createDocument();
        const withBlockProperties: ExportDocument = {
            ...source,
            getNavigation: () =>
                source.getNavigation().map(page => ({
                    ...page,
                    blocks: page.blocks.map(block => ({
                        ...block,
                        properties: { caption: '<img src="x" onerror="block()">' },
                    })),
                })),
        };
        const adapter = new PreviewDocumentAdapter(withBlockProperties, policy);

        const caption = adapter.getNavigation()[0].blocks[0].properties?.caption;

        expect(caption).toStartWith('[component-property]');
    });

    it('prepares author HTML in metadata, components, and nested properties without mutating the source', () => {
        const source = createDocument();
        const originalPages = source.getNavigation();
        const adapter = new PreviewDocumentAdapter(source, policy);

        const metadata = adapter.getMetadata();
        const pages = adapter.getNavigation();

        expect(metadata.extraHeadContent).toStartWith('[custom-head]');
        expect(metadata.footer).toStartWith('[custom-footer]');
        expect(pages[0].blocks[0].components[0].content).toStartWith('[component-html]');
        expect(pages[0].blocks[0].components[0].properties.nested[0]).toStartWith('[component-property]');
        expect(originalPages[0].blocks[0].components[0].content).toContain('onerror');
        expect(source.getMetadata().extraHeadContent).toContain('<script>');
    });

    it('aggregates active-content categories, actions, and source contexts', () => {
        const adapter = new PreviewDocumentAdapter(createDocument(), policy);
        adapter.getMetadata();
        adapter.getNavigation();

        expect(adapter.getReport()).toEqual({
            activeContentFound: true,
            categories: ['script'],
            actions: ['removed'],
            contexts: ['component-html', 'custom-footer', 'custom-head'],
        });
    });

    it('leaves the source document deep-equal after a full adapter pass', () => {
        const source = createDocument();
        const metadataBefore = JSON.parse(JSON.stringify(source.getMetadata()));
        const pagesBefore = JSON.parse(JSON.stringify(source.getNavigation()));

        const adapter = new PreviewDocumentAdapter(source, policy);
        adapter.getMetadata();
        adapter.getNavigation();

        expect(JSON.parse(JSON.stringify(source.getMetadata()))).toEqual(metadataBefore);
        expect(JSON.parse(JSON.stringify(source.getNavigation()))).toEqual(pagesBefore);
    });

    describe('metadata field classification (inventory enforcement)', () => {
        /**
         * THE enforcement mechanism for the inventory risk: build the REAL
         * YjsDocumentAdapter over a fully populated metadata map and assert
         * every field it actually emits is classified. Adding a field to
         * YjsDocumentAdapter without classifying it in
         * PREVIEW_METADATA_FIELD_CLASSIFICATION fails here. Do NOT fix a
         * failure by deleting this test or blanket-classifying as 'inert' —
         * decide whether the new field carries author-editable HTML/CSS and
         * classify it accordingly (see the classification's doc comment).
         */
        it('classifies every metadata field the real YjsDocumentAdapter emits', () => {
            const values: Record<string, unknown> = {
                title: 't',
                subtitle: 's',
                author: 'a',
                description: 'd',
                language: 'en',
                license: 'CC-BY',
                keywords: 'k',
                theme: 'base',
                exelearning_version: '1.0',
                createdAt: 'now',
                modifiedAt: 'now',
                customStyles: 'body{}',
                addExeLink: 'true',
                addPagination: 'false',
                addSearchBox: 'false',
                addAccessibilityToolbar: 'false',
                addMathJax: 'false',
                exportSource: 'true',
                globalFont: 'default',
                extraHeadContent: '<meta name="x">',
                footer: '<p>f</p>',
                screenshot: 'data:image/png;base64,x',
                odeIdentifier: 'ode',
                odeVersionId: 'v1',
                scormIdentifier: 'scorm',
            };
            const manager = {
                getMetadata: () => ({ get: (key: string) => values[key], toJSON: () => values }),
                getNavigation: () => ({
                    length: 0,
                    get: () => undefined,
                    toArray: () => [],
                    forEach: () => {},
                }),
                projectId: 'p1',
            };
            const emitted = new YjsDocumentAdapter(manager).getMetadata();
            const unclassified = Object.keys(emitted).filter(
                key => PREVIEW_METADATA_FIELD_CLASSIFICATION[key] === undefined,
            );
            expect(unclassified).toEqual([]);
        });

        it('treats an unclassified string field as author HTML (fail closed) and flags it', () => {
            const source = createDocument();
            const withSurprise: ExportDocument = {
                ...source,
                getMetadata: () => ({
                    ...source.getMetadata(),
                    brandNewField: '<script>surprise()</script>',
                }),
            } as ExportDocument;
            const adapter = new PreviewDocumentAdapter(withSurprise, policy);
            const metadata = adapter.getMetadata() as Record<string, unknown>;
            expect(metadata.brandNewField).toContain('[unclassified-metadata]');
            expect(metadata.brandNewField).not.toContain('<script>');
            const report = adapter.getReport();
            expect(report.categories).toContain('unclassified-metadata-field');
            expect(report.contexts).toContain('unclassified-metadata');
        });

        it('leaves inert fields untouched by the policy', () => {
            const adapter = new PreviewDocumentAdapter(createDocument(), policy);
            const metadata = adapter.getMetadata();
            expect(metadata.title).toBe('Project');
            expect(metadata.language).toBe('en');
            expect(metadata.theme).toBe('base');
        });
    });

    describe('customStyles screening (author-css)', () => {
        function documentWithStyles(customStyles: string): ExportDocument {
            const source = createDocument();
            return { ...source, getMetadata: () => ({ ...source.getMetadata(), customStyles }) } as ExportDocument;
        }

        const filteredPolicy: PreviewContentPolicy = {
            prepare: html => ({ html, activeContentFound: false, categories: [], actions: [] }),
            prepareStyle: css => prepareStyleForPreview(css, { allowActiveContent: false }),
        };

        it('passes benign author CSS through byte-identical', () => {
            const css = 'body { color: red; } /* </styleish comment stays */';
            const adapter = new PreviewDocumentAdapter(documentWithStyles(css), filteredPolicy);
            expect(adapter.getMetadata().customStyles).toBe(css);
            expect(adapter.getReport().activeContentFound).toBe(false);
        });

        it('flags a trailing bare </style (the renderer appends \\n</style> right after)', () => {
            const adapter = new PreviewDocumentAdapter(documentWithStyles('body{} </style'), filteredPolicy);
            expect(adapter.getMetadata().customStyles).toBe('');
            expect(adapter.getReport().categories).toContain('style-breakout');
        });

        it('drops CSS containing a </style> breakout and reports it', () => {
            const css = 'body{}</style><script>window.pwned=1</script><style>';
            const adapter = new PreviewDocumentAdapter(documentWithStyles(css), filteredPolicy);
            expect(adapter.getMetadata().customStyles).toBe('');
            const report = adapter.getReport();
            expect(report.activeContentFound).toBe(true);
            expect(report.categories).toContain('style-breakout');
            expect(report.contexts).toContain('custom-styles');
        });

        it('keeps the breakout byte-identical in reporting (allow) mode while still reporting', () => {
            const css = '</style><script>x()</script>';
            const allowingPolicy: PreviewContentPolicy = {
                prepare: html => ({ html, activeContentFound: false, categories: [], actions: [] }),
                prepareStyle: value => prepareStyleForPreview(value, { allowActiveContent: true }),
            };
            const adapter = new PreviewDocumentAdapter(documentWithStyles(css), allowingPolicy);
            expect(adapter.getMetadata().customStyles).toBe(css);
            expect(adapter.getReport().categories).toContain('style-breakout');
        });

        it('screens locally, fail closed, when the policy lacks prepareStyle', () => {
            const legacyPolicy: PreviewContentPolicy = {
                prepare: html => ({ html, activeContentFound: false, categories: [], actions: [] }),
            };
            const adapter = new PreviewDocumentAdapter(
                documentWithStyles('ok{}</STYLE ><script>x()</script>'),
                legacyPolicy,
            );
            expect(adapter.getMetadata().customStyles).toBe('');
            expect(adapter.getReport().categories).toContain('style-breakout');
        });
    });
});
