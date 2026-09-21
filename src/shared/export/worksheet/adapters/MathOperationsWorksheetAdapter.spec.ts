import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableOperationRow } from '../types';
import { MathOperationsWorksheetAdapter } from './MathOperationsWorksheetAdapter';

interface OperationsFixture {
    instructions?: string;
    textAfter?: string;
    settings?: Record<string, unknown>;
}

/** Build component HTML the way the Maths operations editor writes it. */
function operationsHtml(fixture: OperationsFixture = {}): string {
    const payload = JSON.stringify({
        typeGame: 'MathOperations',
        instructions: fixture.instructions ?? '',
        // A range of one value makes every draw the same, so a row can be asserted exactly.
        number: 2,
        operations: '1000',
        min: 4,
        max: 4,
        ...fixture.settings,
    });

    let html = '<div class="mathoperations-IDevice">';
    html += `<div class="mathoperations-DataGame js-hidden">${encryptDataGame(payload)}</div>`;
    if (fixture.textAfter) html += `<div class="mathoperations-extra-content">${fixture.textAfter}</div>`;
    html += '</div>';

    return html;
}

/** The table the adapter built, or a failure if it built something else. */
function tableOf(fixture: OperationsFixture = {}): PrintableOperationRow[] {
    const board = MathOperationsWorksheetAdapter.build(operationsHtml(fixture), {})?.board;

    expect(board?.kind).toBe('operationTable');
    return (board as { rows: PrintableOperationRow[] }).rows;
}

/** An operation with its blanks marked, so what was left out reads at a glance. */
function posed(operation: string): string {
    return operation.replace(/<span class="worksheet-gap"[^>]*><\/span>/g, '__');
}

/** How wide a gap the operation leaves, in millimetres. */
function gapWidth(operation: string): number {
    return Number(/width: ([\d.]+)mm/.exec(operation)?.[1]);
}

describe('MathOperationsWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(MathOperationsWorksheetAdapter.ideviceType).toBe('mathematicaloperations');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(MathOperationsWorksheetAdapter.build(operationsHtml(), { title: 'Sumas' })?.title).toBe('Sumas');
        expect(MathOperationsWorksheetAdapter.build(operationsHtml(), {})?.title).toBe('Math operations');
    });

    it('carries over instructions and closing text', () => {
        const activity = MathOperationsWorksheetAdapter.build(
            operationsHtml({ instructions: '<p>Calcula</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Calcula</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('strips anything unsafe the author left in the instructions', () => {
        const activity = MathOperationsWorksheetAdapter.build(
            operationsHtml({ instructions: '<p>Calcula<script>alert(1)</script></p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Calcula</p>');
    });

    it('sets the whole drill as a table, with no questions beside it', () => {
        const activity = MathOperationsWorksheetAdapter.build(operationsHtml(), {});

        expect(activity?.board?.kind).toBe('operationTable');
        expect(activity?.items).toEqual([]);
    });

    it('sets as many rows as the activity asks for', () => {
        expect(tableOf({ settings: { number: 7 } })).toHaveLength(7);
    });

    describe('the part the student supplies', () => {
        it('leaves the result blank by default, and poses the sum whole', () => {
            const rows = tableOf();

            expect(posed(rows[0].operation)).toBe('4 + 4');
            expect(rows[0].result).toBeNull();
        });

        it('leaves the first operand blank when that is what is asked', () => {
            const rows = tableOf({ settings: { type: 'operandA' } });

            expect(posed(rows[0].operation)).toBe('__ + 4');
            expect(rows[0].result).toBe('8');
        });

        it('leaves the second operand blank when that is what is asked', () => {
            const rows = tableOf({ settings: { type: 'operandB' } });

            expect(posed(rows[0].operation)).toBe('4 + __');
            expect(rows[0].result).toBe('8');
        });

        it('leaves the sign blank when that is what is asked', () => {
            const rows = tableOf({ settings: { type: 'operator' } });

            expect(posed(rows[0].operation)).toBe('4 __ 4');
            expect(rows[0].result).toBe('8');
        });

        it('leaves a narrower gap for a sign than for a number', () => {
            // One character against four: a gap wide enough for a number invites one.
            const sign = gapWidth(tableOf({ settings: { type: 'operator' } })[0].operation);
            const operand = gapWidth(tableOf({ settings: { type: 'operandA' } })[0].operation);

            expect(sign).toBeLessThan(operand);
        });

        it('asks the same part of every row, as the activity does when it says random', () => {
            const rows = tableOf({ settings: { type: 'random', number: 8 } });
            const blanks = new Set(rows.map(row => (row.result === null ? 'result' : posed(row.operation))));

            expect(blanks.size).toBe(1);
        });
    });

    it('writes the printed signs, not the ones the screen makes do with', () => {
        const rows = tableOf({ settings: { operations: '0011', min: 2, max: 2, number: 6 } });

        for (const row of rows) expect(posed(row.operation)).toMatch(/^2 [×÷] 2$/);
    });

    it('writes fractions as the activity writes them, in LaTeX', () => {
        // A range of one makes both fractions 4/4, which reduces to 1.
        const fractions = { mode: 1, min: 4, max: 4 };

        expect(posed(tableOf({ settings: fractions })[0].operation)).toBe('\\(1\\) + \\(1\\)');
        // The result is blank when it is what is asked, so a row that gives it has to ask elsewhere.
        expect(tableOf({ settings: { ...fractions, type: 'operandB' } })[0].result).toBe('\\(2\\)');
    });

    it('skips a component whose payload cannot be read', () => {
        expect(MathOperationsWorksheetAdapter.build('<div class="mathoperations-IDevice"></div>', {})).toBeNull();
    });

    it('skips an activity that sets no operations at all', () => {
        expect(MathOperationsWorksheetAdapter.build(operationsHtml({ settings: { number: 0 } }), {})).toBeNull();
    });
});
