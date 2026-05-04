import { describe, expect, it } from 'bun:test';
import type { AssetProvider, ExportDocument, ExportPage, ResourceProvider } from '../interfaces';
import { FflateZipProvider } from '../providers/FflateZipProvider';
import { Scorm12SinglePageExporter } from './Scorm12SinglePageExporter';

class TestScorm12SinglePageExporter extends Scorm12SinglePageExporter {
    exposeBuildPageList(): ExportPage[] {
        return this.buildPageList();
    }
}

const pages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Page 1',
        parentId: null,
        order: 0,
        blocks: [],
    },
];

const document = {
    getMetadata: () => ({
        title: 'Project',
        author: 'Author',
        language: 'en',
        theme: 'base',
    }),
    getNavigation: () => pages,
} satisfies ExportDocument;

function makeExporter(exportDocument: ExportDocument = document): TestScorm12SinglePageExporter {
    return new TestScorm12SinglePageExporter(
        exportDocument,
        null as unknown as ResourceProvider,
        null as unknown as AssetProvider,
        new FflateZipProvider(),
    );
}

describe('Scorm12SinglePageExporter', () => {
    it('uses the page SCORM filename suffix', () => {
        expect(makeExporter().getFileSuffix()).toBe('_page_scorm12');
    });

    it('uses the full page list before a page id is assigned', () => {
        expect(makeExporter().exposeBuildPageList()).toBe(pages);
    });

    it('requires a page id', async () => {
        const result = await makeExporter().export();

        expect(result.success).toBe(false);
        expect(result.error).toBe('pageId is required');
    });
});
