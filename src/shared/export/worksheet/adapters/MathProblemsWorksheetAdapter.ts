/**
 * Maths problems ('mathproblems') worksheet adapter
 *
 * Turns a set of parametrised problems into a printable exercise: each statement with its numbers
 * filled in, and a line under it to write the answer on.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is the iDevice's own name, unusually for this family.
 * - A problem's statement, holes and all, lives in a hidden div of its own, tagged with the
 *   problem's index. That copy is the one that counts: the runtime reads it back over whatever the
 *   payload held, and because it is plain HTML the export pipeline has rewritten its `asset://`
 *   references — so a picture inside a statement still resolves. The payload's own copy was never
 *   reachable by that pass and is only a fallback.
 * - The numbers that fill the holes are drawn on every load, so two plays never pose the same
 *   problem.
 * - The formula is deliberately not touched. The printed exercise asks the student to solve it, so
 *   the answer is never needed — which also keeps author-written expressions from being evaluated
 *   on the way to a printed page.
 * - `percentajeQuestions` and `optionsRamdon` behave as they do elsewhere.
 * - A problem carries no picture of its own.
 */

import { extractDataGame, extractDivContent, extractKeyedDivContent } from '../dataGameReader';
import { fillStatement, type ProblemValues } from '../mathProblemValues';
import { indexedQuestions, type RandomSource, selectQuestions } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'mathproblems';

/** Lines of room left under a problem, for the working and the answer under it. */
const WORKING_LINES = 3;

/** One problem as stored by the Maths problems iDevice. */
interface MathProblem extends ProblemValues {
    /** The statement, with a hole for each number. */
    wordingseg?: string;
    /** The statement as last shown, kept by the runtime. Used only if the template is missing. */
    wording?: string;
}

/** The Maths problems activity payload. */
interface MathProblemsDataGame {
    instructions?: string;
    questions?: MathProblem[];
    /** Share of the stored problems the activity actually poses. */
    percentajeQuestions?: number;
    /** Whether the problems are drawn and ordered at random. */
    optionsRamdon?: boolean;
}

/** A problem paired with the index it had before selection. */
interface IndexedProblem {
    question: MathProblem;
    index: number;
}

/**
 * Build one problem, with its numbers filled in.
 *
 * @returns The question, or null when the problem has no statement to pose
 */
function buildProblem(
    { question: problem, index }: IndexedProblem,
    statements: Map<number, string>,
    random: RandomSource,
): PrintableItem | null {
    // The sidecar first: it is what the runtime reads and what the asset pass could reach.
    const stored = statements.get(index) ?? problem.wordingseg ?? problem.wording;
    const statement = sanitizeHtml(fillStatement(stored, problem, random));
    if (!statement) return null;

    return {
        prompt: statement,
        // Room to work in, not a line to answer on: a maths problem is worked out before it is
        // answered, and a rule under it would leave nowhere for the working.
        answer: { kind: 'writingSpace', lines: WORKING_LINES },
    };
}

export const MathProblemsWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'mathproblems',
    defaultTitle: 'Maths problems',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<MathProblemsDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.questions)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const statements = extractKeyedDivContent(html, `${PREFIX}-LinkWordings`);

        const selected = selectQuestions<IndexedProblem>(
            indexedQuestions(dataGame.questions, options),
            dataGame.percentajeQuestions,
            dataGame.optionsRamdon,
            random,
        );

        const items = selected.flatMap(entry => {
            const problem = buildProblem(entry, statements, random);
            if (problem) return [problem];
            options.onOmission?.('invalid-data');
            return [];
        });

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'mathproblems',
            title: options.title || MathProblemsWorksheetAdapter.defaultTitle,
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
