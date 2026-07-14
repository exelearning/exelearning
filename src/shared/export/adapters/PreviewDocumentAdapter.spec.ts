import { describe, expect, it } from 'bun:test';
import type { ExportDocument, PreviewContentPolicy } from '../interfaces';
import { PreviewDocumentAdapter } from './PreviewDocumentAdapter';

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
});
