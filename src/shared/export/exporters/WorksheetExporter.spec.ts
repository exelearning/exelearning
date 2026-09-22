import { describe, expect, it } from 'bun:test';
import { WorksheetExporter } from './WorksheetExporter';
import { encryptDataGame } from '../utils/dataGameCipher';
import type { AssetProvider, ExportDocument, ExportPage } from '../interfaces';

/** Component HTML as the Guess editor writes it. */
function guessContent(
    words: Record<string, unknown>[] = [{ word: 'Valencia', definition: 'Ciudad', type: 0 }],
): string {
    // percentageShow 0 gives no letters away, so box counts here stay deterministic. The hint
    // behaviour itself is covered in GuessWorksheetAdapter.spec.ts.
    const payload = JSON.stringify({ typeGame: 'Adivina', instructions: '', percentageShow: 0, wordsGame: words });
    return `<div class="adivina-IDevice"><div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;
}

/** Component HTML for a gamified activity with no adapter yet: the map stores under 'mapa'. */
function unadaptedContent(): string {
    return `<div class="mapa-DataGame js-hidden">${encryptDataGame('{"rows":[]}')}</div>`;
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
    it('uses the worksheet identity fields instead of repeating them above each rubric', async () => {
        const content = `<div class="exe-rubrics-DataGame">${escape(
            JSON.stringify({
                categories: ['Content'],
                scores: ['Good'],
                descriptions: [[{ text: 'Complete', weight: '4' }]],
                i18n: { activity: 'Activity', name: 'Rubric name', date: 'Rubric date', score: 'Score' },
            }),
        )}</div>`;
        const result = await new WorksheetExporter(
            documentOf([{ components: [{ type: 'rubric', content }] }]),
        ).generate();
        expect(result.success).toBe(true);
        expect(result.html).toContain('worksheet-rubric-table');
        expect(result.html).toContain('<span class="worksheet-field">Name:');
        expect(result.html).toContain('<span class="worksheet-field">Date:');
        expect(result.html).not.toContain('Rubric name');
        expect(result.html).not.toContain('Rubric date');
        result.dispose?.();
    });

    it.each([
        ['electrical-circuits', 'electrical-circuits'],
        ['3dmol', 'dmole'],
    ])('resolves the current %s instruction image on the server', async (type, prefix) => {
        const id = '11111111-1111-4111-8111-111111111111';
        const content =
            `<div class="${prefix}-instructions"><img src="asset://${id}"></div>` +
            `<div class="${prefix}-DataGame">${encryptDataGame(
                JSON.stringify({
                    instructionsExe: escape('<img src="blob:https://old.example/expired">'),
                    selectsGame: [{ quextion: 'Question', options: ['A', 'B'], numberOptions: 2 }],
                }),
            )}</div>`;
        const result = await new WorksheetExporter(documentOf([{ components: [{ type, content }] }]), {
            getAllAssets: async () => [
                {
                    id,
                    filename: 'diagram.svg',
                    mime: 'image/svg+xml',
                    data: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
                },
            ],
        } as unknown as AssetProvider).generate();
        expect(result.success).toBe(true);
        expect(result.html).not.toContain('old.example');
        expect(result.html).not.toContain(`asset://${id}`);
        expect(result.html).toMatch(/<img src="blob:[^"]+"/);
        result.dispose?.();
    });

    it('exports round statements and reports unprintable headings and ring clues on the server', async () => {
        const pack = (prefix: string, data: unknown) =>
            `<div class="${prefix}-DataGame">${encryptDataGame(JSON.stringify(data))}</div>`;
        const exporter = new WorksheetExporter(
            documentOf([
                {
                    components: [
                        {
                            type: 'sort',
                            content: pack('ordena', {
                                type: 1,
                                gameColumns: 2,
                                orderedColumns: true,
                                phrasesGame: [
                                    {
                                        definition: 'Order by age',
                                        cards: ['Heading A', 'Heading B', 'Adult'].map(eText => ({ type: 1, eText })),
                                    },
                                    {
                                        definition: 'Omitted round',
                                        cards: [
                                            { type: 0, audio: 'sound.mp3' },
                                            { type: 1, eText: 'Wrong heading' },
                                        ],
                                    },
                                ],
                            }),
                        },
                        {
                            type: 'az-quiz-game',
                            content: pack('rosco', {
                                letters: 'DC',
                                wordsGame: [
                                    { word: 'DOG', type: 0, definition: '<audio controls></audio>' },
                                    { word: 'CAT', type: 0, definition: 'A small feline' },
                                ],
                            }),
                        },
                    ],
                },
            ]),
        );

        const model = await exporter.buildModel();
        expect(model.pages[0].activities.map(activity => activity.items.length)).toEqual([1, 1]);
        expect(model.unsupported.map(entry => entry.reason)).toEqual(['media-required', 'media-required']);
        const result = await exporter.generate();
        try {
            expect(result.success).toBe(true);
            expect(result.html).toContain('Order by age');
            expect(result.html).toContain('A small feline');
            expect(result.html).not.toContain('Wrong heading');
            expect(result.html).not.toContain('Starts with D');
        } finally {
            result.dispose?.();
        }
    });

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
                            { type: 'padlock', content: unadaptedContent() },
                        ],
                    },
                ]),
            );

            expect((await exporter.buildModel()).unsupported).toEqual([
                { ideviceType: 'padlock', pageTitle: 'La Edad Media' },
            ]);
        });

        it('marks as settled the activities that will never have a printed form', async () => {
            // Identify is waiting for an adapter; these three are not. The list has to say which
            // is which, or a teacher reads the whole of it as a promise.
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'Repaso',
                        components: [
                            { type: 'trivial', content: unadaptedContent() },
                            { type: 'interactive-video', content: unadaptedContent() },
                            { type: 'quick-questions-video', content: unadaptedContent() },
                            { type: 'padlock', content: unadaptedContent() },
                        ],
                    },
                ]),
            );

            const reported = (await exporter.buildModel()).unsupported;

            expect(reported.filter(entry => entry.reason === 'not-printable').map(entry => entry.ideviceType)).toEqual([
                'trivial',
                'interactive-video',
                'quick-questions-video',
            ]);
            expect(reported.find(entry => entry.ideviceType === 'padlock')?.reason).toBeUndefined();
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

        it.each(['adaptative-quiz', 'trueorfalse', 'true-or-false', 'scrambled-list'])(
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
                            { type: 'adaptative-quiz', content: '' },
                            { type: 'adaptative-quiz', content: '' },
                        ],
                    },
                ]),
            );

            const model = await exporter.buildModel();
            expect(model.pages[0].activities).toHaveLength(1);
            expect(model.unsupported).toEqual([{ ideviceType: 'adaptative-quiz', pageTitle: 'Mixed exercises' }]);
        });

        it('reports each type once per page', async () => {
            const exporter = new WorksheetExporter(
                documentOf([
                    {
                        title: 'Una',
                        components: [
                            { type: 'padlock', content: unadaptedContent() },
                            { type: 'padlock', content: unadaptedContent() },
                        ],
                    },
                    { title: 'Otra', components: [{ type: 'padlock', content: unadaptedContent() }] },
                ]),
            );

            expect((await exporter.buildModel()).unsupported).toEqual([
                { ideviceType: 'padlock', pageTitle: 'Una' },
                { ideviceType: 'padlock', pageTitle: 'Otra' },
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

describe('WorksheetExporter and the block heading', () => {
    /** One page whose block carries the given name. */
    function pageWithBlock(name: string): ExportDocument {
        const pages = [
            {
                id: 'page-0',
                title: 'El Poema',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-0',
                        name,
                        order: 0,
                        components: [{ id: 'c1', type: 'guess', order: 0, properties: {}, content: guessContent() }],
                    },
                ],
            },
        ] as unknown as ExportPage[];

        return {
            getNavigation: () => pages,
            getMetadata: () => ({ title: 'Un héroe medieval', language: 'es' }),
        } as unknown as ExportDocument;
    }

    it('names each exercise after the block the author put it in', async () => {
        // Nothing else draws that heading on a worksheet, and it is what names the exercise.
        const model = await new WorksheetExporter(pageWithBlock('Adivina el personaje')).buildModel();

        expect(model.pages[0].activities[0].blockTitle).toBe('Adivina el personaje');
    });

    it('prints it above the exercise', async () => {
        const result = await new WorksheetExporter(pageWithBlock('Adivina el personaje')).generate();

        expect(result.html).toContain('<h3 class="worksheet-activity-title">Adivina el personaje</h3>');
    });

    it('leaves the heading out when the author named no block', async () => {
        const result = await new WorksheetExporter(pageWithBlock('   ')).generate();

        expect(result.html).not.toContain('<h3 class="worksheet-activity-title">');
    });

    it('escapes a block name instead of letting it become markup', async () => {
        const result = await new WorksheetExporter(pageWithBlock('<img src=x onerror=alert(1)>')).generate();

        expect(result.html).not.toContain('<img src=x');
        expect(result.html).toContain('&lt;img');
    });
});

describe('WorksheetExporter and the molecules it has to draw first', () => {
    const MODEL = '\n  Mrv  \n\n  1  0  0  0  0  0            999 V2000\n';
    const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';

    /** Component HTML as the 3D molecules editor writes it: a model, and no picture of it. */
    function moleculeContent(): string {
        const payload = JSON.stringify({
            typeGame: '3DMol',
            activityMode: 'show',
            selectsGame: [{ modelData: MODEL, modelFormat: 'sdf', description: 'Glucosa' }],
        });
        return `<div class="dmole-IDevice"><div class="dmole-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;
    }

    function moleculeDocument(): ExportDocument {
        return documentOf([{ components: [{ type: '3dmol', content: moleculeContent() }] }]);
    }

    it('draws each molecule before the adapter is asked for an exercise', async () => {
        const model = await new WorksheetExporter(moleculeDocument()).buildModel({
            captureMolecule: async () => PICTURE,
        });

        expect(model.pages[0].activities[0].items[0].media?.src).toBe(PICTURE);
    });

    it('hands the renderer the molecule the author stored', async () => {
        const seen: { modelFormat?: string }[] = [];

        await new WorksheetExporter(moleculeDocument()).buildModel({
            captureMolecule: async view => (seen.push(view), PICTURE),
        });

        expect(seen).toHaveLength(1);
        expect(seen[0].modelFormat).toBe('sdf');
    });

    it('reports the molecule as missing when nothing can draw it', async () => {
        // A command-line export has no browser, and the activity is presenting pictures nobody drew.
        const model = await new WorksheetExporter(moleculeDocument()).buildModel();

        expect(model.pages).toHaveLength(0);
        expect(model.unsupported[0]).toMatchObject({ ideviceType: '3dmol', reason: 'media-required' });
    });
});
