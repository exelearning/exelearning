import { describe, expect, it } from 'bun:test';
import { WorksheetExporter } from './WorksheetExporter';
import { encryptDataGame } from '../utils/dataGameCipher';
import type { ExportDocument, ExportPage } from '../interfaces';

/** Component HTML as the Guess editor writes it. */
function guessContent(
    words: Record<string, unknown>[] = [{ word: 'Valencia', definition: 'Ciudad', type: 0 }],
): string {
    // percentageShow 0 gives no letters away, so box counts here stay deterministic. The hint
    // behaviour itself is covered in GuessWorksheetAdapter.spec.ts.
    const payload = JSON.stringify({ typeGame: 'Adivina', instructions: '', percentageShow: 0, wordsGame: words });
    return `<div class="adivina-IDevice"><div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;
}

/** Component HTML for a gamified activity with no adapter yet: word search stores under 'sopa'. */
function wordSearchContent(): string {
    return `<div class="sopa-DataGame js-hidden">${encryptDataGame('{"rows":[]}')}</div>`;
}

interface PageSpec {
    id?: string;
    title?: string;
    properties?: Record<string, unknown>;
    components?: Record<string, unknown>[];
}

function documentOf(pageSpecs: PageSpec[], metadata: Record<string, unknown> = {}): ExportDocument {
    const pages = pageSpecs.map((spec, pageIndex) => ({
        id: spec.id ?? `page-${pageIndex}`,
        title: spec.title ?? `Page ${pageIndex}`,
        parentId: null,
        order: pageIndex,
        properties: spec.properties,
        blocks: [
            {
                id: `block-${pageIndex}`,
                name: 'Block',
                order: 0,
                components: (spec.components ?? []).map((component, index) => ({
                    id: `component-${pageIndex}-${index}`,
                    order: index,
                    properties: {},
                    ...component,
                })),
            },
        ],
    })) as unknown as ExportPage[];

    return {
        getNavigation: () => pages,
        getMetadata: () => ({ title: 'Un héroe medieval', language: 'es', ...metadata }),
    } as unknown as ExportDocument;
}

describe('WorksheetExporter', () => {
    describe('buildModel', () => {
        it('collects guess activities grouped under their page', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    { title: 'El Poema de Mio Cid', components: [{ type: 'guess', content: guessContent() }] },
                ]),
            );

            const model = await exporter.buildModel();

            expect(model.projectTitle).toBe('Un héroe medieval');
            expect(model.language).toBe('es');
            expect(model.pages).toHaveLength(1);
            expect(model.pages[0].title).toBe('El Poema de Mio Cid');
            expect(model.pages[0].activities).toHaveLength(1);
            expect(model.pages[0].activities[0].items[0].answer).toEqual({
                kind: 'characterBoxes',
                groups: [[null, null, null, null, null, null, null, null]],
            });
        });

        it('keeps document order across blocks and pages', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'Primera',
                        components: [
                            { type: 'guess', content: guessContent([{ word: 'Uno', definition: 'A', type: 0 }]) },
                            { type: 'guess', content: guessContent([{ word: 'Dos', definition: 'B', type: 0 }]) },
                        ],
                    },
                    {
                        title: 'Segunda',
                        components: [
                            { type: 'guess', content: guessContent([{ word: 'Tres', definition: 'C', type: 0 }]) },
                        ],
                    },
                ]),
            );

            const model = await exporter.buildModel();

            expect(model.pages.map(page => page.title)).toEqual(['Primera', 'Segunda']);
            expect(model.pages[0].activities[0].items[0].prompt).toBe('A');
            expect(model.pages[0].activities[1].items[0].prompt).toBe('B');
            expect(model.pages[1].activities[0].items[0].prompt).toBe('C');
        });

        it('uses the translated activity title when one is supplied', async () => {
            const exporter = new WorksheetExporter(
                documentOf([{ components: [{ type: 'guess', content: guessContent() }] }]),
            );

            const model = await exporter.buildModel({ ideviceTitles: { guess: 'Adivina' } });

            expect(model.pages[0].activities[0].title).toBe('Adivina');
        });

        it('drops pages that end up with no activities', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    { title: 'Con actividad', components: [{ type: 'guess', content: guessContent() }] },
                    { title: 'Solo texto', components: [{ type: 'text', content: '<p>Texto</p>' }] },
                ]),
            );

            const model = await exporter.buildModel();

            expect(model.pages.map(page => page.title)).toEqual(['Con actividad']);
        });

        it('returns no pages for a project with nothing printable', async () => {
            const exporter = new WorksheetExporter(
                documentOf([{ components: [{ type: 'text', content: '<p>Texto</p>' }] }]),
            );

            const model = await exporter.buildModel();

            expect(model.pages).toHaveLength(0);
            expect(model.unsupported).toHaveLength(0);
        });

        it('falls back to defaults when the project has no title or language', async () => {
            const exporter = new WorksheetExporter(documentOf([], { title: '', language: '' }));

            const model = await exporter.buildModel();

            expect(model.projectTitle).toBe('eXeLearning');
            expect(model.language).toBe('en');
        });
    });

    describe('what is left out', () => {
        it('skips hidden pages', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'Oculta',
                        properties: { visibility: false },
                        components: [{ type: 'guess', content: guessContent() }],
                    },
                ]),
            );

            expect((await exporter.buildModel()).pages).toHaveLength(0);
        });

        it('skips pages hidden with the string form of the flag', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        properties: { visibility: 'false' },
                        components: [{ type: 'guess', content: guessContent() }],
                    },
                ]),
            );

            expect((await exporter.buildModel()).pages).toHaveLength(0);
        });

        it('skips hidden components', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        components: [
                            { type: 'guess', content: guessContent(), structureProperties: { visibility: false } },
                        ],
                    },
                ]),
            );

            expect((await exporter.buildModel()).pages).toHaveLength(0);
        });

        it('skips teacher-only components, by flag and by visibility type', async () => {
            const byFlag = new WorksheetExporter(
                documentOf([
                    {
                        components: [
                            { type: 'guess', content: guessContent(), structureProperties: { teacherOnly: true } },
                        ],
                    },
                ]),
            );
            const byType = new WorksheetExporter(
                documentOf([
                    {
                        components: [
                            { type: 'guess', content: guessContent(), properties: { visibilityType: 'teacher' } },
                        ],
                    },
                ]),
            );

            expect((await byFlag.buildModel()).pages).toHaveLength(0);
            expect((await byType.buildModel()).pages).toHaveLength(0);
        });

        it('skips an activity whose questions have no solutions', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        components: [
                            { type: 'guess', content: guessContent([{ word: '', definition: 'x', type: 0 }]) },
                        ],
                    },
                ]),
            );

            expect((await exporter.buildModel()).pages).toHaveLength(0);
        });
    });

    describe('activities with no adapter', () => {
        it('reports gamified activities that cannot be printed yet', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'La Edad Media',
                        components: [
                            { type: 'guess', content: guessContent() },
                            { type: 'word-search', content: wordSearchContent() },
                        ],
                    },
                ]),
            );

            expect((await exporter.buildModel()).unsupported).toEqual([
                { ideviceType: 'word-search', pageTitle: 'La Edad Media' },
            ]);
        });

        it('does not report plain content as a missing activity', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        components: [
                            { type: 'guess', content: guessContent() },
                            { type: 'text', content: '<p>Texto</p>' },
                            { type: 'image-gallery', content: '<div class="gallery"></div>' },
                            { type: 'magnifier', content: '' },
                            { type: 'digcompedu', content: '' },
                            { type: 'checklist', content: '<input type="checkbox">' },
                        ],
                    },
                ]),
            );

            expect((await exporter.buildModel()).unsupported).toHaveLength(0);
        });

        it.each(['adaptative-quiz', 'form', 'trueorfalse', 'true-or-false', 'scrambled-list'])(
            'reports an unsupported %s activity even when its HTML is empty',
            async type => {
                const exporter = new WorksheetExporter(
                    documentOf([
                        {
                            title: 'JSON exercises',
                            components: [{ type, content: '', properties: { questions: [{ text: 'Question' }] } }],
                        },
                    ]),
                );

                const model = await exporter.buildModel();
                expect(model.pages).toHaveLength(0);
                expect(model.unsupported).toEqual([{ ideviceType: type, pageTitle: 'JSON exercises' }]);
                const result = await exporter.generate();
                expect(result.success).toBe(true);
                expect(result.html).toContain('<aside class="worksheet-unsupported">');
                expect(result.html).toContain(`<li>${type} — JSON exercises</li>`);
            },
        );

        it('reports JSON omissions alongside printable exercises, once per type and page', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'Mixed exercises',
                        components: [
                            { type: 'guess', content: guessContent() },
                            { type: 'form', content: '' },
                            { type: 'form', content: '' },
                        ],
                    },
                ]),
            );

            const model = await exporter.buildModel();
            expect(model.pages[0].activities).toHaveLength(1);
            expect(model.unsupported).toEqual([{ ideviceType: 'form', pageTitle: 'Mixed exercises' }]);
        });

        it('reports each type once per page', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'Una',
                        components: [
                            { type: 'word-search', content: wordSearchContent() },
                            { type: 'word-search', content: wordSearchContent() },
                        ],
                    },
                    { title: 'Otra', components: [{ type: 'word-search', content: wordSearchContent() }] },
                ]),
            );

            expect((await exporter.buildModel()).unsupported).toEqual([
                { ideviceType: 'word-search', pageTitle: 'Una' },
                { ideviceType: 'word-search', pageTitle: 'Otra' },
            ]);
        });
    });

    describe('generate', () => {
        it('renders the collected activities as a standalone document', async () => {
            const exporter = new WorksheetExporter(
                documentOf([{ title: 'El Poema', components: [{ type: 'guess', content: guessContent() }] }]),
            );

            const result = await exporter.generate({ ideviceTitles: { guess: 'Adivina' } });

            expect(result.success).toBe(true);
            expect(result.html).toContain('<!DOCTYPE html>');
            expect(result.html).toContain('El Poema');
            // The translated name reaches the adapter but is not printed: a worksheet names the
            // exercise the way the author named their page, not after the iDevice.
            expect(result.html).not.toContain('Adivina');
            expect(result.html?.match(/class="worksheet-box"/g)).toHaveLength(8);
        });

        it('honours the activity options when building the worksheet', async () => {
            // Half of four questions, drawn at random, with every letter given away.
            const payload = JSON.stringify({
                typeGame: 'Adivina',
                percentajeQuestions: 50,
                optionsRamdon: true,
                percentageShow: 100,
                wordsGame: [
                    { word: 'Uno', definition: 'A', type: 0 },
                    { word: 'Dos', definition: 'B', type: 0 },
                    { word: 'Tres', definition: 'C', type: 0 },
                    { word: 'Cuatro', definition: 'D', type: 0 },
                ],
            });
            const content = `<div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
            const exporter = new WorksheetExporter(documentOf([{ components: [{ type: 'guess', content }] }]));

            const result = await exporter.generate({ random: () => 0 });

            expect(result.html?.match(/class="worksheet-item"/g)).toHaveLength(2);
            expect(result.html).toContain('worksheet-box-filled');
            expect(result.html).not.toContain('<span class="worksheet-box"></span>');
        });

        it('passes translated labels through to the document', async () => {
            const exporter = new WorksheetExporter(
                documentOf([{ components: [{ type: 'guess', content: guessContent() }] }]),
            );

            const result = await exporter.generate({ labels: { studentName: 'Nombre', date: 'Fecha' } });

            expect(result.html).toContain('Nombre:');
            expect(result.html).toContain('Fecha:');
        });

        it('explains itself when the project has nothing printable', async () => {
            const exporter = new WorksheetExporter(
                documentOf([{ components: [{ type: 'text', content: '<p>Texto</p>' }] }]),
            );

            const result = await exporter.generate({ labels: { empty: 'Sin actividades' } });

            expect(result.success).toBe(true);
            expect(result.html).toContain('Sin actividades');
        });

        it('reports a failure instead of throwing', async () => {
            const broken = {
                getNavigation: () => {
                    throw new Error('document unavailable');
                },
                getMetadata: () => ({}),
            } as unknown as ExportDocument;

            const result = await new WorksheetExporter(broken).generate();

            expect(result.success).toBe(false);
            expect(result.error).toBe('document unavailable');
            expect(result.html).toBeUndefined();
        });
    });
});
