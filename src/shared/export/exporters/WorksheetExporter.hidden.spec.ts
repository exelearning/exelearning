import { describe, expect, it } from 'bun:test';
import { WorksheetExporter } from './WorksheetExporter';
import { encryptDataGame } from '../utils/dataGameCipher';
import type { ExportDocument, ExportPage } from '../interfaces';

/** Component HTML as the Guess editor writes it. */
function guessContent(): string {
    const payload = JSON.stringify({
        typeGame: 'Adivina',
        percentageShow: 0,
        wordsGame: [{ word: 'Valencia', definition: 'Ciudad', type: 0 }],
    });
    return `<div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
}

interface PageSpec {
    id: string;
    parentId: string | null;
    visibility?: boolean;
}

function documentOf(specs: PageSpec[]): ExportDocument {
    const pages = specs.map((spec, index) => ({
        id: spec.id,
        title: spec.id,
        parentId: spec.parentId,
        order: index,
        properties: spec.visibility === undefined ? {} : { visibility: spec.visibility },
        blocks: [
            {
                id: `block-${spec.id}`,
                name: 'Block',
                order: 0,
                components: [{ id: `c-${spec.id}`, type: 'guess', order: 0, properties: {}, content: guessContent() }],
            },
        ],
    })) as unknown as ExportPage[];

    return {
        getNavigation: () => pages,
        getMetadata: () => ({ title: 'Demo', language: 'es' }),
    } as unknown as ExportDocument;
}

/** One page with one block carrying one guess activity. */
function blockDocument(blockProperties: Record<string, unknown>): ExportDocument {
    const pages = [
        {
            id: 'p',
            title: 'P',
            parentId: null,
            order: 0,
            properties: {},
            blocks: [
                {
                    id: 'b',
                    name: 'Block',
                    order: 0,
                    properties: blockProperties,
                    components: [{ id: 'c', type: 'guess', order: 0, properties: {}, content: guessContent() }],
                },
            ],
        },
    ] as unknown as ExportPage[];

    return {
        getNavigation: () => pages,
        getMetadata: () => ({ title: 'Demo', language: 'es' }),
    } as unknown as ExportDocument;
}

describe('WorksheetExporter and hidden blocks', () => {
    it('leaves out the components of a hidden block', async () => {
        const model = await new WorksheetExporter(blockDocument({ visibility: false })).buildModel();

        expect(model.pages).toHaveLength(0);
    });

    it('leaves out the components of a teacher-only block', async () => {
        const model = await new WorksheetExporter(blockDocument({ teacherOnly: true })).buildModel();

        expect(model.pages).toHaveLength(0);
    });

    it('keeps the components of an ordinary block', async () => {
        const model = await new WorksheetExporter(blockDocument({})).buildModel();

        expect(model.pages).toHaveLength(1);
    });
});

describe('WorksheetExporter and hidden pages', () => {
    it('leaves out a page inside a hidden one', async () => {
        // The child is visible in its own right; its parent is not, so neither reaches the sheet.
        const model = await new WorksheetExporter(
            documentOf([
                { id: 'parent', parentId: null, visibility: false },
                { id: 'child', parentId: 'parent' },
            ]),
        ).buildModel();

        expect(model.pages).toHaveLength(0);
    });

    it('leaves out a page further down a hidden branch', async () => {
        const model = await new WorksheetExporter(
            documentOf([
                { id: 'root', parentId: null, visibility: false },
                { id: 'middle', parentId: 'root' },
                { id: 'leaf', parentId: 'middle' },
            ]),
        ).buildModel();

        expect(model.pages).toHaveLength(0);
    });

    it('keeps a page whose ancestors are all visible', async () => {
        const model = await new WorksheetExporter(
            documentOf([
                { id: 'parent', parentId: null },
                { id: 'child', parentId: 'parent' },
            ]),
        ).buildModel();

        expect(model.pages.map(page => page.pageId)).toEqual(['parent', 'child']);
    });

    it('survives a parent reference that loops', async () => {
        // Malformed navigation must not hang the export.
        const model = await new WorksheetExporter(
            documentOf([
                { id: 'a', parentId: 'b' },
                { id: 'b', parentId: 'a' },
            ]),
        ).buildModel();

        expect(model.pages).toHaveLength(0);
    });

    it('keeps a page whose parent is not in the navigation', async () => {
        const model = await new WorksheetExporter(documentOf([{ id: 'orphan', parentId: 'gone' }])).buildModel();

        expect(model.pages).toHaveLength(1);
    });
});
