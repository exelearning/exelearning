import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../utils/dataGameCipher';
import type { ExportComponent, ExportPage } from '../interfaces';
import {
    applyActivityMode,
    PRINTABLE_ACTIVITY_TYPE,
    type ApplyActivityModeOptions,
    type DocumentActivityMode,
} from './printActivityModes';

/** Component HTML the Guess editor writes, with one answerable question. */
function guessHtml(definition = 'Ciudad conquistada', word = 'Valencia'): string {
    const payload = JSON.stringify({
        typeGame: 'Adivina',
        wordsGame: [{ definition, word, percentageShow: 0 }],
    });
    return `<div class="adivina-IDevice"><div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;
}

/** Component HTML the Crossword editor writes, with two words that can cross. */
function crosswordHtml(): string {
    const payload = JSON.stringify({
        typeGame: 'Crucigrama',
        difficulty: 100,
        wordsGame: [
            { word: 'CASA', definition: 'Hogar' },
            { word: 'SOL', definition: 'Astro' },
        ],
    });
    return `<div class="crucigrama-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
}

function component(overrides: Partial<ExportComponent> = {}): ExportComponent {
    return { id: 'c1', type: 'guess', order: 0, content: guessHtml(), properties: {}, ...overrides };
}

/** One page, one block, holding the given components. */
function page(components: ExportComponent[], overrides: Partial<ExportPage> = {}): ExportPage {
    return {
        id: 'p1',
        title: 'El Poema de Mio Cid',
        parentId: null,
        order: 0,
        blocks: [{ id: 'b1', name: 'Bloque', order: 0, components }],
        ...overrides,
    };
}

const text = () => component({ id: 'text-1', type: 'text', content: '<p>El Cid</p>' });

function componentsOf(pages: ExportPage[]): ExportComponent[] {
    return pages.flatMap(p => (p.blocks || []).flatMap(b => b.components || []));
}

function run(pages: ExportPage[], mode: DocumentActivityMode, options: ApplyActivityModeOptions = {}): ExportPage[] {
    return applyActivityMode(pages, mode, options);
}

describe('applyActivityMode', () => {
    it('leaves a project with no interactive activity untouched', () => {
        for (const mode of ['omit', 'in-place', 'appendix'] as DocumentActivityMode[])
            expect(run([page([text()])], mode)).toEqual([page([text()])]);
    });

    it('never modifies the pages it is given', () => {
        const pages = [page([component(), text()])];
        const before = JSON.stringify(pages);

        run(pages, 'in-place');
        run(pages, 'appendix');
        run(pages, 'omit');

        expect(JSON.stringify(pages)).toBe(before);
    });

    describe('omit', () => {
        it('drops the activity and keeps everything else', () => {
            const types = componentsOf(run([page([text(), component()])], 'omit')).map(c => c.type);

            expect(types).toEqual(['text']);
        });

        it('drops a block it has emptied, so no heading is left hanging', () => {
            const result = run([page([component()])], 'omit');

            expect(result[0].blocks).toHaveLength(0);
        });

        it('keeps a block that arrived empty, which is how the document already prints', () => {
            const empty = page([], { blocks: [{ id: 'b1', name: 'Bloque', order: 0, components: [] }] });

            expect(run([empty], 'omit')[0].blocks).toHaveLength(1);
        });

        it('adds no appendix', () => {
            expect(run([page([component()])], 'omit')).toHaveLength(1);
        });
    });

    describe('in place', () => {
        it('replaces the activity with its exercise, where the author put it', () => {
            const components = componentsOf(run([page([text(), component()])], 'in-place'));

            expect(components.map(c => c.type)).toEqual(['text', PRINTABLE_ACTIVITY_TYPE]);
            expect(components[1].content).toContain('<article class="worksheet-activity"');
            expect(components[1].content).toContain('Ciudad conquistada');
        });

        it('keeps the component where it was in the document', () => {
            const components = componentsOf(run([page([component({ id: 'c9', order: 3 })])], 'in-place'));

            expect(components[0].id).toBe('c9');
            expect(components[0].order).toBe(3);
        });

        it('drops the stored game configuration along with the game', () => {
            const withProps = component({ properties: { percentajeQuestions: 50 } });

            expect(componentsOf(run([page([withProps])], 'in-place'))[0].properties).toEqual({});
        });

        it('prints a note where an activity has no printable form yet', () => {
            const content = componentsOf(run([page([component({ type: 'puzzle', content: '<div/>' })])], 'in-place'))[0]
                .content;

            expect(content).toContain('worksheet-activity-unprintable');
            expect(content).toContain('This activity cannot be printed yet.');
            // The type survives as an attribute, for stylesheets and tests, but is not written out
            // anywhere a reader would see it.
            expect(content).toContain('data-idevice="puzzle"');
        });

        it('prints the same note when the payload cannot be read', () => {
            const broken = component({ content: '<div class="adivina-DataGame js-hidden">not a payload</div>' });

            expect(componentsOf(run([page([broken])], 'in-place'))[0].content).toContain('worksheet-not-printable');
        });

        it('adds no appendix', () => {
            expect(run([page([component()])], 'in-place')).toHaveLength(1);
        });
    });

    describe('appendix', () => {
        it('leaves a pointer in place and puts the exercise at the back', () => {
            const result = run([page([component()])], 'appendix');

            expect(result).toHaveLength(2);
            expect(componentsOf([result[0]])[0].content).toContain('See appendix, activity 1');
            expect(componentsOf([result[1]])[0].content).toContain('Ciudad conquistada');
        });

        it('numbers the pointer and its exercise the same', () => {
            const result = run([page([component({ id: 'a' }), component({ id: 'b' })])], 'appendix');

            expect(componentsOf([result[0]]).map(c => c.content)).toEqual([
                expect.stringContaining('activity 1'),
                expect.stringContaining('activity 2'),
            ]);
            expect(componentsOf([result[1]]).map(c => c.content)).toEqual([
                expect.stringContaining('>1.<'),
                expect.stringContaining('>2.<'),
            ]);
        });

        it('numbers across pages, in document order', () => {
            const result = run(
                [page([component()], { id: 'p1' }), page([component()], { id: 'p2', order: 1 })],
                'appendix',
            );

            expect(componentsOf([result[0]])[0].content).toContain('activity 1');
            expect(componentsOf([result[1]])[0].content).toContain('activity 2');
            expect(componentsOf([result[2]])).toHaveLength(2);
        });

        it('numbers an activity with no printable form too, so the pointers still line up', () => {
            const result = run([page([component({ type: 'puzzle', content: '<div/>' }), component()])], 'appendix');
            const inAppendix = componentsOf([result[result.length - 1]]);

            expect(inAppendix[0].content).toContain('worksheet-not-printable');
            expect(inAppendix[0].content).toContain('>1.<');
            expect(inAppendix[1].content).toContain('>2.<');
        });

        it('builds the appendix as an ordinary page, after the last one', () => {
            const appendixPage = run([page([component()], { order: 4 })], 'appendix')[1];

            expect(appendixPage.id).toBe('worksheet-appendix');
            expect(appendixPage.title).toBe('Appendix');
            expect(appendixPage.parentId).toBeNull();
            expect(appendixPage.order).toBe(5);
            expect(appendixPage.blocks[0].name).toBe('');
        });

        it('gives the copy at the back its own id, so nothing is duplicated', () => {
            const result = run([page([component({ id: 'c7' })])], 'appendix');

            expect(componentsOf([result[0]])[0].id).toBe('c7');
            expect(componentsOf([result[1]])[0].id).toBe('c7-appendix');
        });

        it('orders the appendix entries as they appear in the document', () => {
            const result = run([page([component({ id: 'a' }), component({ id: 'b' })])], 'appendix');

            expect(componentsOf([result[1]]).map(c => c.order)).toEqual([0, 1]);
        });
    });

    describe('translated strings', () => {
        it('uses the labels it is given', () => {
            const result = run([page([component(), component({ type: 'puzzle', content: '<div/>' })])], 'appendix', {
                labels: {
                    appendixTitle: 'Anexo',
                    appendixReference: 'Ver anexo, actividad %s',
                    notPrintable: 'Todavía no se puede imprimir',
                },
                ideviceTitles: { guess: 'Adivina', puzzle: 'Puzle' },
            });

            expect(result[1].title).toBe('Anexo');
            expect(componentsOf([result[0]])[0].content).toContain('Ver anexo, actividad 1');
            expect(componentsOf([result[1]])[0].content).toContain('>1.<');
            expect(componentsOf([result[1]])[1].content).toContain('Todavía no se puede imprimir');
            expect(componentsOf([result[1]])[1].content).toContain('>2.<');
        });

        it('passes the worksheet labels down into the exercise itself', () => {
            // A crossword numbers its clues by direction, which is the one place the worksheet
            // labels show up inside an activity rather than around it.
            const result = run([page([component({ type: 'crossword', content: crosswordHtml() })])], 'in-place', {
                labels: { across: 'Horizontal', down: 'Vertical' },
            });
            const content = componentsOf(result)[0].content;

            expect(content).toMatch(/Horizontal|Vertical/);
            expect(content).not.toContain('Across');
            expect(content).not.toContain('Down');
        });
    });

    describe('untrusted content', () => {
        it('escapes the iDevice type before putting it in markup', () => {
            const nasty = component({ type: 'evil"><script>alert(1)</script>', content: '<div/>' });

            expect(componentsOf(run([page([nasty])], 'in-place'))[0].content).not.toContain('<script>');
        });

        it('escapes a translated label before putting it in markup', () => {
            const result = run([page([component({ type: 'puzzle', content: '<div/>' })])], 'in-place', {
                labels: { notPrintable: '<img src=x onerror=alert(1)>' },
            });

            expect(componentsOf(result)[0].content).not.toContain('<img');
            expect(componentsOf(result)[0].content).toContain('&lt;img');
        });
    });
});

describe('PRINTABLE_ACTIVITY_TYPE', () => {
    it('is not named after a class the worksheet markup uses', () => {
        // IdeviceRenderer puts the component's type on the wrapper it emits as a CSS class. A type
        // sharing a name with a worksheet class would land on both the wrapper and the exercise
        // inside it, so every selector — in a stylesheet or a test — would match twice.
        const markup = componentsOf(applyActivityMode([page([component()])], 'in-place'))[0].content;
        const classes = [...markup.matchAll(/class="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/));

        expect(classes).not.toContain(PRINTABLE_ACTIVITY_TYPE);
    });
});

describe('the iDevice name is never printed', () => {
    /** The text a reader would see, with attributes and tags stripped out. */
    const visibleText = (markup: string) => markup.replace(/<[^>]*>/g, ' ');

    const named = { ideviceTitles: { guess: 'Adivina', puzzle: 'Puzle' } };

    it('is absent from an exercise', () => {
        const markup = componentsOf(applyActivityMode([page([component()])], 'in-place', named))[0].content;

        expect(visibleText(markup)).not.toContain('Adivina');
        expect(visibleText(markup)).not.toContain('Guess');
    });

    it('is absent from the note for an activity with no printable form', () => {
        const unprintable = component({ type: 'puzzle', content: '<div/>' });
        const markup = componentsOf(applyActivityMode([page([unprintable])], 'in-place', named))[0].content;

        expect(visibleText(markup)).not.toContain('Puzle');
        expect(visibleText(markup)).not.toContain('puzzle');
    });

    it('is absent from the pointer into the appendix and from the entry it points at', () => {
        const result = applyActivityMode([page([component()])], 'appendix', named);

        for (const markup of componentsOf(result).map(entry => entry.content)) {
            expect(visibleText(markup)).not.toContain('Adivina');
        }
    });

    it('still leaves the appendix entry findable by its number', () => {
        const result = applyActivityMode([page([component()])], 'appendix', named);
        const inAppendix = componentsOf([result[1]])[0].content;

        expect(inAppendix).toContain('<h3 class="worksheet-activity-title">1.</h3>');
    });
});

describe('what the author restricted', () => {
    /** A block carrying the given properties, holding one Guess activity. */
    const restrictedPage = (properties: Record<string, unknown>) =>
        page([component()], {
            blocks: [{ id: 'b1', name: 'Bloque', order: 0, components: [component()], properties } as never],
        });

    it.each([
        ['a teacher-only block', { teacherOnly: true }],
        ['a hidden block', { visibility: false }],
        ['a legacy teacher block', { visibilityType: 'teacher' }],
    ])('leaves %s exactly as the document prints it', (_name, properties) => {
        for (const mode of ['omit', 'in-place', 'appendix'] as DocumentActivityMode[]) {
            const result = applyActivityMode([restrictedPage(properties)], mode);

            // Untouched: still the activity, still in its own block, and no appendix built from it.
            expect(result).toHaveLength(1);
            expect(componentsOf(result)[0].type).toBe('guess');
            expect(componentsOf(result)[0].content).toContain('adivina-DataGame');
        }
    });

    it('never copies a hidden component into the appendix', () => {
        // The appendix is a block of ours, so a copy there would not carry the restriction the
        // original block applied — and both markers are display:none in the export stylesheet.
        const hidden = component({ structureProperties: { visibility: 'false' } });
        const teacherOnly = component({ id: 'c2', structureProperties: { teacherOnly: 'true' } });

        const result = applyActivityMode([page([hidden, teacherOnly])], 'appendix');

        expect(result).toHaveLength(1);
        expect(componentsOf(result).map(entry => entry.type)).toEqual(['guess', 'guess']);
    });

    it('still converts an ordinary activity beside a restricted one', () => {
        const restricted = component({ id: 'c1', structureProperties: { teacherOnly: 'true' } });
        const ordinary = component({ id: 'c2' });

        const types = componentsOf(applyActivityMode([page([restricted, ordinary])], 'in-place')).map(
            entry => entry.type,
        );

        expect(types).toEqual(['guess', PRINTABLE_ACTIVITY_TYPE]);
    });
});

describe('questions an adapter had to leave out', () => {
    /** A Guess activity with one answerable question and one that needs a video. */
    const withVideoQuestion = () => {
        const payload = JSON.stringify({
            typeGame: 'Adivina',
            wordsGame: [
                { definition: 'Ciudad conquistada', word: 'Valencia', percentageShow: 0 },
                { type: 2, definition: 'Un vídeo', word: 'Nada', percentageShow: 0 },
            ],
        });
        return component({
            content: `<div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div>`,
        });
    };

    it('says so beside the exercise instead of dropping the news', () => {
        const markup = componentsOf(applyActivityMode([page([withVideoQuestion()])], 'in-place'))[0].content;

        expect(markup).toContain('worksheet-unsupported');
        expect(markup).toContain('Requires multimedia');
        expect(markup).toContain('(1)');
    });

    it('uses the translated wording', () => {
        const markup = componentsOf(
            applyActivityMode([page([withVideoQuestion()])], 'in-place', {
                labels: { mediaRequired: 'Necesita multimedia' },
            }),
        )[0].content;

        expect(markup).toContain('Necesita multimedia');
    });

    it('says nothing when nothing was left out', () => {
        const markup = componentsOf(applyActivityMode([page([component()])], 'in-place'))[0].content;

        expect(markup).not.toContain('worksheet-unsupported');
    });

    it('reports in the appendix too, where the exercise actually is', () => {
        const result = applyActivityMode([page([withVideoQuestion()])], 'appendix');

        expect(componentsOf([result[1]])[0].content).toContain('worksheet-unsupported');
    });
});
