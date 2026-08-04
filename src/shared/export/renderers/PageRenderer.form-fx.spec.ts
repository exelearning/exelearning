import { describe, expect, it } from 'bun:test';
import type { ExportPage, PageRenderOptions } from '../interfaces';
import { PageRenderer } from './PageRenderer';

function createFormPage(): ExportPage {
    return {
        id: 'page-1',
        title: 'Form FX',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'form-1',
                        type: 'form',
                        order: 0,
                        content: '',
                        properties: {
                            questionsData: [
                                {
                                    baseText: [
                                        '<div class="exe-fx exe-tabs">',
                                        '<h2>One</h2><p>First tab with \\(x\\)</p>',
                                        '<h2>Two</h2><p>Second tab</p>',
                                        '</div>',
                                    ].join(''),
                                },
                            ],
                        },
                    },
                ],
            },
        ],
    };
}

function createOptions(page: ExportPage): PageRenderOptions {
    return {
        projectTitle: 'Form FX test',
        language: 'en',
        theme: 'base',
        allPages: [page],
        basePath: '',
        isIndex: true,
        usedIdevices: ['form'],
        author: 'Test',
        license: '',
    };
}

function expectFxReferencesWithoutMathJax(html: string): void {
    expect(html).toContain('<script src="libs/exe_effects/exe_effects.js"> </script>');
    expect(html).toContain('<link rel="stylesheet" href="libs/exe_effects/exe_effects.css">');
    expect(html).not.toContain('libs/exe_math');
}

describe('PageRenderer Form FX library detection', () => {
    it('references FX libraries stored in nested Form properties', () => {
        const page = createFormPage();
        const html = new PageRenderer().render(page, createOptions(page));

        expectFxReferencesWithoutMathJax(html);
    });

    it('references nested Form FX libraries in single-page exports', () => {
        const page = createFormPage();
        const html = new PageRenderer().renderSinglePage([page], {
            projectTitle: 'Form FX test',
            language: 'en',
            usedIdevices: ['form'],
        });

        expectFxReferencesWithoutMathJax(html);
    });
});
