import { describe, expect, it } from 'bun:test';
import { BaseExporter } from './BaseExporter';
import type {
    AssetProvider,
    ExportDocument,
    ExportPage,
    ExportResult,
    ResourceProvider,
    ZipProvider,
} from '../interfaces';

class TestExporter extends BaseExporter {
    async export(): Promise<ExportResult> {
        return { success: true, filename: 'test.zip' };
    }

    getFileExtension(): string {
        return '.zip';
    }

    getFileSuffix(): string {
        return '_test';
    }

    detectLibraries(pages: ExportPage[]) {
        return this.getRequiredLibraryFilesForPages(pages);
    }
}

function createExporter(): TestExporter {
    const document: ExportDocument = {
        getMetadata: () => ({
            title: 'Form FX test',
            author: 'Test',
            language: 'en',
            theme: 'base',
        }),
        getNavigation: () => [],
    };

    return new TestExporter(document, {} as ResourceProvider, {} as AssetProvider, {} as ZipProvider);
}

function createFormPage(content: string, properties: Record<string, unknown>): ExportPage {
    return {
        id: 'page-1',
        title: 'Page 1',
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
                        content,
                        properties,
                    },
                ],
            },
        ],
    };
}

describe('BaseExporter Form FX library detection', () => {
    it('detects nested FX without bypassing JSON iDevice MathJax handling', () => {
        const pages = [
            createFormPage('', {
                questionsData: [
                    {
                        baseText: [
                            '<div class="exe-fx exe-tabs">',
                            '<h2>One</h2><p>First tab with \\(x\\)</p>',
                            '<h2>Two</h2><p>Second tab</p>',
                            '</div>',
                        ].join(''),
                        answers: [[false, '<p>Plain answer</p>']],
                        enabled: true,
                        score: 1,
                        optional: null,
                    },
                ],
            }),
        ];

        const result = createExporter().detectLibraries(pages);

        expect(result.files).toContain('exe_effects/exe_effects.js');
        expect(result.files).toContain('exe_effects/exe_effects.css');
        expect(result.files).not.toContain('exe_math');
        expect(result.patterns.some(pattern => pattern.name === 'exe_effects')).toBe(true);
        expect(result.patterns.some(pattern => pattern.name.startsWith('exe_math'))).toBe(false);
    });

    it('continues detecting FX markup in component content', () => {
        const pages = [createFormPage('<div class="exe-fx exe-tabs"></div>', {})];

        const result = createExporter().detectLibraries(pages);

        expect(result.files).toContain('exe_effects/exe_effects.js');
        expect(result.files).toContain('exe_effects/exe_effects.css');
    });
});
