import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { MathProblemsWorksheetAdapter } from './MathProblemsWorksheetAdapter';

interface MathFixtureOptions {
    instructions?: string;
    questions?: Record<string, unknown>[];
    percentajeQuestions?: number;
    optionsRamdon?: boolean;
    textAfter?: string;
}

/** One problem, with a hole for a number and a range to fill it from. */
function problem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        wordingseg: 'Compra {a} manzanas. ¿Cuánto paga?',
        formula: '{a} * 2',
        min: 4,
        max: 4,
        decimals: 0,
        ...overrides,
    };
}

/** Build component HTML the way the Maths problems editor writes it. */
function mathHtml(options: MathFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'MathProblems',
        instructions: options.instructions ?? '',
        percentajeQuestions: options.percentajeQuestions,
        optionsRamdon: options.optionsRamdon,
        questions: options.questions ?? [problem()],
    });

    let html = '<div class="mathproblems-IDevice">';
    html += `<div class="mathproblems-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (options.textAfter) {
        html += `<div class="mathproblems-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

describe('MathProblemsWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(MathProblemsWorksheetAdapter.ideviceType).toBe('mathproblems');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(MathProblemsWorksheetAdapter.build(mathHtml(), { title: 'Problemas' })?.title).toBe('Problemas');
        expect(MathProblemsWorksheetAdapter.build(mathHtml(), {})?.title).toBe('Maths problems');
    });

    it('carries over instructions and closing text', () => {
        const activity = MathProblemsWorksheetAdapter.build(
            mathHtml({ instructions: '<p>Resuelve</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Resuelve</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('poses the statement with its numbers filled in', () => {
        const activity = MathProblemsWorksheetAdapter.build(mathHtml(), {});

        expect(activity?.items[0].prompt).toBe('Compra 4 manzanas. ¿Cuánto paga?');
    });

    it('leaves room to work the problem out in, with nothing ruled', () => {
        // A maths problem is worked out before it is answered, so the space is for both.
        expect(MathProblemsWorksheetAdapter.build(mathHtml(), {})?.items[0].answer).toEqual({
            kind: 'writingSpace',
            lines: 3,
        });
    });

    it('draws each variable from its own named domain', () => {
        const activity = MathProblemsWorksheetAdapter.build(
            mathHtml({
                questions: [
                    problem({
                        wordingseg: '{a} por {b}',
                        definedVariables: true,
                        domains: [
                            { name: 'a', value: '7' },
                            { name: 'b', value: '3' },
                        ],
                    }),
                ],
            }),
            {},
        );

        expect(activity?.items[0].prompt).toBe('7 por 3');
    });

    it('never prints the answer, nor the formula that gives it', () => {
        // The student is asked to solve it; the sheet says nothing about how.
        const activity = MathProblemsWorksheetAdapter.build(
            mathHtml({ questions: [problem({ formula: '{a} * 2' })] }),
            {},
        );

        expect(JSON.stringify(activity)).not.toContain('formula');
        expect(JSON.stringify(activity)).not.toContain('* 2');
    });

    it('poses one question per problem', () => {
        const activity = MathProblemsWorksheetAdapter.build(
            mathHtml({
                questions: [
                    problem({ wordingseg: 'Primero {a}' }),
                    problem({ wordingseg: 'Segundo {a}' }),
                    problem({ wordingseg: 'Tercero {a}' }),
                ],
            }),
            {},
        );

        expect(activity?.items.map(item => item.prompt)).toEqual(['Primero 4', 'Segundo 4', 'Tercero 4']);
    });

    describe('the share of problems', () => {
        const four = () =>
            Array.from({ length: 4 }, (_, index) => problem({ wordingseg: `Problema ${index} con {a}` }));

        it('poses only the share the activity uses', () => {
            const activity = MathProblemsWorksheetAdapter.build(
                mathHtml({ questions: four(), percentajeQuestions: 50 }),
                {},
            );

            expect(activity?.items).toHaveLength(2);
        });

        it('poses them in stored order unless the activity draws at random', () => {
            const activity = MathProblemsWorksheetAdapter.build(mathHtml({ questions: four() }), {});

            expect(activity?.items.map(item => item.prompt)).toEqual([
                'Problema 0 con 4',
                'Problema 1 con 4',
                'Problema 2 con 4',
                'Problema 3 con 4',
            ]);
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(MathProblemsWorksheetAdapter.build(mathHtml({ questions: [] }), {})).toBeNull();
            expect(MathProblemsWorksheetAdapter.build('<div class="mathproblems-IDevice"></div>', {})).toBeNull();
            expect(MathProblemsWorksheetAdapter.build('<div class="mathproblems-DataGame">no</div>', {})).toBeNull();
            expect(MathProblemsWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when questions is not an array', () => {
            const html = `<div class="mathproblems-DataGame js-hidden">${encryptDataGame('{"questions":"no"}')}</div>`;

            expect(MathProblemsWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('reports a problem with no statement to pose', () => {
            const omissions: string[] = [];
            const activity = MathProblemsWorksheetAdapter.build(
                mathHtml({ questions: [problem(), problem({ wordingseg: '' })] }),
                { onOmission: reason => omissions.push(reason) },
            );

            expect(activity?.items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data']);
        });

        it('falls back to the statement the runtime last left behind', () => {
            // Older projects may carry only the substituted text.
            const activity = MathProblemsWorksheetAdapter.build(
                mathHtml({ questions: [problem({ wordingseg: undefined, wording: 'Un enunciado ya resuelto' })] }),
                {},
            );

            expect(activity?.items[0].prompt).toBe('Un enunciado ya resuelto');
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a statement', () => {
            const activity = MathProblemsWorksheetAdapter.build(
                mathHtml({ questions: [problem({ wordingseg: '<p>Hi</p><script>alert(1)</script>' })] }),
                {},
            );

            expect(activity?.items[0].prompt).toBe('<p>Hi</p>');
        });

        it('strips a script smuggled into the instructions', () => {
            const activity = MathProblemsWorksheetAdapter.build(
                mathHtml({ instructions: '<p>Hi</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hi</p>');
        });
    });
});

describe('MathProblemsWorksheetAdapter and the statement sidecar', () => {
    /** The statement divs the editor writes beside the payload, one per problem. */
    const sidecars = (statements: string[]) =>
        statements
            .map((text, index) => `<div class="js-hidden mathproblems-LinkWordings" data-id="${index}">${text}</div>`)
            .join('');

    /** Component HTML with a payload whose statements have gone stale. */
    const withSidecars = (statements: string[], questions = statements.map(() => problem({ wordingseg: 'Viejo' }))) => {
        const html = mathHtml({ questions });
        // Beside the payload, not inside it: the last close is the component's own.
        const close = html.lastIndexOf('</div>');
        return html.slice(0, close) + sidecars(statements) + html.slice(close);
    };

    it('reads the statement the runtime reads, not the stale copy in the payload', () => {
        const activity = MathProblemsWorksheetAdapter.build(withSidecars(['Enunciado al día con {a}']), {});

        expect(activity?.items[0].prompt).toBe('Enunciado al día con 4');
        expect(activity?.items[0].prompt).not.toContain('Viejo');
    });

    it('keeps a picture the author put in a statement', () => {
        // The reason this matters: an image lives in the statement, and only this copy has had
        // its asset reference rewritten.
        const activity = MathProblemsWorksheetAdapter.build(
            withSidecars(['<p>Mide la figura</p><img src="blob:http://localhost/figure" alt="Figura">']),
            {},
        );

        expect(activity?.items[0].prompt).toContain('<img');
        expect(activity?.items[0].prompt).toContain('blob:http://localhost/figure');
    });

    it('gives each problem its own statement', () => {
        const activity = MathProblemsWorksheetAdapter.build(withSidecars(['Primero {a}', 'Segundo {a}']), {});

        expect(activity?.items.map(item => item.prompt)).toEqual(['Primero 4', 'Segundo 4']);
    });

    it('falls back to the payload for a problem with no sidecar of its own', () => {
        const html = mathHtml({ questions: [problem({ wordingseg: 'Sólo en el payload {a}' })] });

        expect(MathProblemsWorksheetAdapter.build(html, {})?.items[0].prompt).toBe('Sólo en el payload 4');
    });

    it('still strips a script smuggled into a statement', () => {
        const activity = MathProblemsWorksheetAdapter.build(withSidecars(['<p>Hi</p><script>alert(1)</script>']), {});

        expect(activity?.items[0].prompt).toBe('<p>Hi</p>');
    });
});
