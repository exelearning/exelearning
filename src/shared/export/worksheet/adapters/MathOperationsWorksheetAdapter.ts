/**
 * Maths operations ('mathoperations') worksheet adapter
 *
 * Turns an arithmetic drill into a printable table: each operation on one side, its result on the
 * other, and whichever part the activity asks for left blank.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'mathoperations', not the iDevice's name.
 * - Nothing is stored as a question. The activity stores the rules — which operators are in play,
 *   the range the operands come from, whether a result may be negative, decimal or zero — and
 *   makes up a fresh set on every load. A sheet sets one such set.
 * - `type` says which part the student supplies: the result, an operand, or the sign between them.
 *   'random' settles on one for the whole activity, as the runtime settles it.
 * - `mode` 1 sets fractions instead of plain numbers, written as LaTeX.
 * - The printed signs are × and ÷ rather than the letter and the colon the screen uses.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { askedPart, generateOperations, type AskedPart, type Operation } from '../mathOperations';
import type { RandomSource } from '../questionSelection';
import { escapeText, sanitizeHtml } from '../sanitizeHtml';
import { renderInlineGap } from '../WorksheetRenderer';
import type { OperationSettings } from '../mathOperations';
import type { PrintableActivity, PrintableOperationRow, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'mathoperations';

/** Width of the gap left for a missing operand or sign, in characters. */
const OPERAND_GAP = 4;
const OPERATOR_GAP = 2;

/** The Maths operations payload: settings, and nothing else. */
type MathOperationsDataGame = OperationSettings & { instructions?: string };

/**
 * Lay one operation out, leaving a gap where the part the student supplies would be.
 */
function buildRow(operation: Operation, asked: AskedPart): PrintableOperationRow {
    const operandA = asked === 'operandA' ? renderInlineGap(OPERAND_GAP) : escapeText(operation.operandA);
    const operator = asked === 'operator' ? renderInlineGap(OPERATOR_GAP) : escapeText(operation.operator);
    const operandB = asked === 'operandB' ? renderInlineGap(OPERAND_GAP) : escapeText(operation.operandB);

    return {
        operation: `${operandA} ${operator} ${operandB}`,
        // Blank when the result is what is asked; otherwise it is given, and the gap is in the sum.
        result: asked === 'result' ? null : escapeText(operation.result),
    };
}

export const MathOperationsWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'mathematicaloperations',
    defaultTitle: 'Math operations',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<MathOperationsDataGame>(html, PREFIX);
        if (!dataGame) return null;

        const random: RandomSource = options.random ?? Math.random;
        const asked = askedPart(dataGame, random);
        const operations = generateOperations(dataGame, random);

        if (operations.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'mathematicaloperations',
            title: options.title || MathOperationsWorksheetAdapter.defaultTitle,
            board: { kind: 'operationTable', rows: operations.map(operation => buildRow(operation, asked)) },
            // The whole exercise is the table; there are no questions to number beside it.
            items: [],
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
