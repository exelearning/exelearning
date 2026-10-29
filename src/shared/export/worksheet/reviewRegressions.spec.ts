import { describe, expect, it, mock } from 'bun:test';
import { JSDOM } from 'jsdom';
import type { AssetProvider, ExportAsset, ExportDocument } from '../interfaces';
import { WorksheetExporter } from '../exporters/WorksheetExporter';
import { ServerLatexPreRenderer } from '../prerender/ServerLatexPreRenderer';
import { encryptDataGame } from '../utils/dataGameCipher';
import { AssetUrlResolver } from '../utils/AssetUrlResolver';
import { CompleteWorksheetAdapter } from './adapters/CompleteWorksheetAdapter';
import { GuessWorksheetAdapter } from './adapters/GuessWorksheetAdapter';
import { CrosswordWorksheetAdapter } from './adapters/CrosswordWorksheetAdapter';
import { QuickQuestionsWorksheetAdapter } from './adapters/QuickQuestionsWorksheetAdapter';
import { MultipleChoiceWorksheetAdapter } from './adapters/MultipleChoiceWorksheetAdapter';
import { buildCrosswordLayout } from './crosswordLayout';
import { renderWorksheet } from './WorksheetRenderer';

function content(prefix: string, payload: Record<string, unknown>, sidecars = ''): string {
    return `<div class="${prefix}-DataGame">${encryptDataGame(JSON.stringify(payload))}</div>${sidecars}`;
}

function documentOf(components: { type: string; content: string }[]): ExportDocument {
    return {
        getMetadata: () => ({ title: 'Worksheet', language: 'en' }),
        getNavigation: () => [
            {
                id: 'page',
                title: 'Page',
                blocks: [
                    {
                        id: 'block',
                        components: components.map((component, index) => ({ id: `item-${index}`, ...component })),
                    },
                ],
            },
        ],
    } as unknown as ExportDocument;
}

const image = '<img src="asset://pic" alt="A &amp; B">';
const asset: ExportAsset = {
    id: 'pic',
    filename: 'picture.png',
    originalPath: '',
    mime: 'image/png',
    data: new Uint8Array([1, 2]),
};
function provider() {
    return {
        getProjectAssets: mock(async () => [asset]),
        getAllAssets: mock(async () => [asset]),
        getAsset: mock(async (id: string) => (id === 'pic' ? asset : null)),
        listAssetMetadata: mock(async () => [asset, { ...asset, id: 'unused', filename: 'unused.png' }]),
    } satisfies AssetProvider;
}

describe('worksheet review regressions', () => {
    it('H02 resolves images after decrypting instructions, rich text, options and Complete text', async () => {
        const assets = provider();
        const result = await new WorksheetExporter(
            documentOf([
                {
                    type: 'guess',
                    content: content('adivina', {
                        instructions: image,
                        wordsGame: [{ type: 3, word: 'A', eText: escape(image) }],
                    }),
                },
                {
                    type: 'quick-questions',
                    content: content('quext', {
                        questionsGame: [{ quextion: image, options: [image, 'text'], numberOptions: 2 }],
                    }),
                },
                { type: 'complete', content: content('completa', { textText: escape(`${image} @@word@@`) }) },
            ]),
            assets,
        ).generate();
        expect(result.success).toBe(true);
        const dom = new JSDOM(result.html);
        expect(dom.window.document.querySelectorAll('img')).toHaveLength(5);
        for (const img of dom.window.document.querySelectorAll('img')) {
            expect(img.src).toStartWith('blob:');
            expect(img.alt).toBe('A & B');
        }
        expect(assets.getAsset.mock.calls).toEqual([['pic']]);
        expect(assets.getAllAssets).not.toHaveBeenCalled();
        result.dispose?.();
        result.dispose?.();
        dom.window.close();
    });

    it('H02 prefers the current Complete rich text sidecar', () => {
        const activity = CompleteWorksheetAdapter.build(
            content(
                'completa',
                {
                    textText: escape('OLD @@old@@'),
                },
                '<div class="completa-text-game"><p>NEW @@new@@</p></div>',
            ),
            {},
        );
        expect(activity?.items[0].prompt).toContain('NEW');
        expect(activity?.items[0].prompt).not.toContain('OLD');
    });

    for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999]) {
        it(`H03/H04 keeps every clue numbered and forbids parallel overlap (${randomValue})`, () => {
            const layout = buildCrosswordLayout(['CASA', 'CAMA', 'CASA', 'SALA', 'AMOR'], [], {
                randomSource: () => randomValue,
                crop: false,
            });
            const occupied = new Set<string>();
            for (const placement of layout.placements) {
                expect(layout.rows[placement.row][placement.col]?.number).toBe(placement.number);
                placement.letters.forEach((_, offset) => {
                    const row = placement.row + (placement.horizontal ? 0 : offset);
                    const col = placement.col + (placement.horizontal ? offset : 0);
                    const key = `${row}:${col}:${placement.horizontal}`;
                    expect(occupied.has(key)).toBe(false);
                    occupied.add(key);
                });
            }
            expect(layout.placements.length).toBeGreaterThan(1);
        });
    }

    it('H03 tells apart two clues sharing a start by the column each is set in', () => {
        const activity = CrosswordWorksheetAdapter.build(
            content('crucigrama', {
                wordsGame: [
                    { word: 'CASA', definition: 'Home' },
                    { word: 'CAMA', definition: 'Bed' },
                ],
            }),
            { random: () => 0.5 },
        )!;
        expect(activity.items.map(item => item.number)).toEqual([1, 1]);
        expect(activity.items.map(item => item.direction)).toEqual(['down', 'across']);
        const html = renderWorksheet(
            {
                projectTitle: '',
                language: 'es',
                unsupported: [],
                pages: [{ pageId: 'p', title: '', activities: [activity] }],
            },
            { across: 'Horizontal', down: 'Vertical' },
        );
        const columns = html.slice(html.indexOf('<body>')).split('class="worksheet-clue-column"').slice(1);
        expect(columns).toHaveLength(2);
        expect(columns[0]).toContain('>Horizontal</h4>');
        expect(columns[0]).toContain('value="1"');
        expect(columns[1]).toContain('>Vertical</h4>');
        expect(columns[1]).toContain('value="1"');
    });

    it('H05 keeps per-gap distractors in limited select mode', () => {
        const activity = CompleteWorksheetAdapter.build(
            content('completa', {
                type: 2,
                wordsLimit: true,
                wordsErrors: 'unrelated',
                textText: escape('Capital @@Madrid|Barcelona|Sevilla@@. Color @@red|blue@@.'),
            }),
            { random: () => 0 },
        )!;
        const dom = new JSDOM(activity.items[0].prompt);
        const choices = [...dom.window.document.querySelectorAll('.worksheet-gap-options')];
        expect(choices).toHaveLength(2);
        expect(choices[0].textContent).toBe(' (Barcelona / Sevilla / Madrid)');
        expect(choices[1].textContent).toBe(' (blue / red)');
        expect(activity.board).toBeUndefined();
        expect(activity.items[0].prompt).not.toContain('unrelated');
        dom.window.close();
    });

    it('H05 retains all alternatives in the shared select bank and primary answers for drag mode', () => {
        for (const type of [0, 1, 2]) {
            const activity = CompleteWorksheetAdapter.build(
                content('completa', {
                    type,
                    wordsLimit: false,
                    wordsErrors: 'Sevilla|Bilbao',
                    textText: escape('Capital @@Madrid|Barcelona@@.'),
                }),
                { random: () => 0 },
            )!;
            if (type === 0) expect(activity.board).toBeUndefined();
            else {
                expect(activity.board?.kind).toBe('wordBank');
                if (activity.board?.kind === 'wordBank')
                    expect(activity.board.words.toSorted()).toEqual(
                        (type === 2
                            ? ['Madrid', 'Barcelona', 'Sevilla', 'Bilbao']
                            : ['Madrid', 'Sevilla', 'Bilbao']
                        ).sort(),
                    );
            }
        }
    });

    it('H05 does not inject answer-space markup into an attribute', () => {
        const activity = CompleteWorksheetAdapter.build(
            content('completa', {
                type: 2,
                wordsLimit: true,
                textText: escape('<img alt="@@x|y@@" src="a.png"> @@yes|no@@'),
            }),
            {},
        )!;
        const dom = new JSDOM(activity.items[0].prompt);
        expect(dom.window.document.querySelectorAll('.worksheet-gap')).toHaveLength(1);
        expect(dom.window.document.querySelector('img')?.getAttribute('alt')).toBe('{{gap-0}}');
        dom.window.close();
    });

    it('H05 preserves repeated draggable words for repeated gaps', () => {
        const activity = CompleteWorksheetAdapter.build(
            content('completa', {
                type: 1,
                textText: escape('@@same@@ and @@same@@'),
            }),
            {},
        )!;
        expect(activity.board).toEqual({ kind: 'wordBank', words: ['same', 'same'] });
    });

    it('H06/H09 preserves comparisons, decoded entities and signed image parameters', () => {
        const activity = GuessWorksheetAdapter.build(
            content(
                'adivina',
                {
                    wordsGame: [{ word: 'yes', definition: '3 < 5; A &amp; B', type: 1 }],
                },
                '<a class="adivina-LinkImages" href="https://host/image?a=1&amp;b=2">0</a>',
            ),
            {},
        )!;
        const dom = new JSDOM(activity.items[0].prompt);
        expect(dom.window.document.body.textContent).toBe('3 < 5; A & B');
        expect(activity.items[0].media?.src).toBe('https://host/image?a=1&b=2');
        dom.window.close();
    });

    it('H07 awaits the real server formula renderer and preserves its SVG', async () => {
        const renderer = new ServerLatexPreRenderer();
        const result = await new WorksheetExporter(
            documentOf([
                {
                    type: 'quick-questions',
                    content: content('quext', {
                        questionsGame: [
                            { quextion: 'Solve \\(x^2=4\\)<script>alert(1)</script>', options: ['2', '3'] },
                        ],
                    }),
                },
            ]),
        ).generate({ preRenderLatex: html => renderer.preRender(html) });
        expect(result.success).toBe(true);
        expect(result.html).toContain('<svg');
        expect(result.html).not.toContain('<script>alert');
        const dom = new JSDOM(result.html);
        expect(dom.window.document.body.textContent).not.toContain('\\(x^2=4\\)');
        dom.window.close();
        result.dispose?.();
    });

    it('H07 reports formula rendering failures without publishing raw formulas', async () => {
        const exporter = new WorksheetExporter(documentOf([]));
        const result = await exporter.generate({
            preRenderLatex: async html => ({
                html,
                hasLatex: true,
                latexRendered: false,
                count: 0,
            }),
        });
        expect(result.success).toBe(false);
        expect(result.html).toBeUndefined();
    });

    it('H10 keeps image-only options in both Test and Select', () => {
        for (const [adapter, prefix, key] of [
            [QuickQuestionsWorksheetAdapter, 'quext', 'questionsGame'],
            [MultipleChoiceWorksheetAdapter, 'selecciona', 'selectsGame'],
        ] as const) {
            const activity = adapter.build(
                content(prefix, {
                    [key]: [
                        {
                            type: 0,
                            typeSelect: 0,
                            quextion: 'Choose',
                            question: 'Choose',
                            options: [image, 'Text', '<p> </p>', '<img src="javascript:bad">'],
                            numberOptions: 4,
                        },
                    ],
                }),
                {},
            )!;
            const answer = activity.items[0].answer;
            expect(answer?.kind).toBe('options');
            if (answer?.kind === 'options') {
                expect(answer.labels).toHaveLength(2);
                expect(answer.labels[0]).toContain('<img');
            }
        }
    });

    it('H11 reports multimedia omissions without losing other questions', async () => {
        const result = await new WorksheetExporter(
            documentOf([
                {
                    type: 'guess',
                    content: content('adivina', {
                        wordsGame: [
                            { type: 2, word: 'video', definition: 'Watch' },
                            { type: 0, word: 'paper', definition: 'Read' },
                        ],
                    }),
                },
                {
                    type: 'crossword',
                    content: content('crucigrama', { wordsGame: [{ word: 'CASA', audio: 'asset://sound' }] }),
                },
                { type: 'quick-questions', content: content('quext', { questionsGame: [{ type: 2 }] }) },
                {
                    type: 'quick-questions-multiple-choice',
                    content: content('selecciona', { selectsGame: [{ type: 2 }] }),
                },
            ]),
        ).buildModel({ ideviceTitles: { guess: 'Adivina' } });
        expect(result.pages[0].activities[0].items).toHaveLength(1);
        expect(result.unsupported).toHaveLength(4);
        expect(result.unsupported.every(entry => entry.reason === 'media-required' && entry.count === 1)).toBe(true);
        expect(result.unsupported[0].title).toBe('Adivina');
        expect(new Set(result.unsupported.map(entry => entry.componentId)).size).toBe(4);
    });

    it('M02 isolates invalid payloads and invalid entries while keeping healthy activities', async () => {
        const result = await new WorksheetExporter(
            documentOf([
                {
                    type: 'guess',
                    content: content('adivina', { wordsGame: [null, { word: 'yes', definition: 'OK' }] }),
                },
                {
                    type: 'crossword',
                    content: content('crucigrama', { wordsGame: [{ word: 3, definition: 'broken' }] }),
                },
                { type: 'complete', content: '<div class="completa-DataGame">broken</div>' },
            ]),
        ).buildModel();
        expect(result.pages[0].activities).toHaveLength(1);
        expect(result.unsupported).toHaveLength(3);
        expect(result.unsupported.every(entry => entry.reason === 'invalid-data')).toBe(true);
    });

    it('M01 skips asset loading for text-only worksheets and can release and rebuild a resolver', async () => {
        const assets = provider();
        const resolver = new AssetUrlResolver(assets);
        await resolver.build('<p>Text</p>');
        expect(assets.listAssetMetadata).not.toHaveBeenCalled();
        resolver.dispose();
        await resolver.build(image);
        expect(resolver.resolve(image)).toContain('blob:');
        resolver.dispose();
        expect(resolver.getExportPathMap()).toBeUndefined();
    });
});
