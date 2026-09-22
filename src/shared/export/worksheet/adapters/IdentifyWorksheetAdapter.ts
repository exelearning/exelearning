/**
 * Identify ('identify') worksheet adapter
 *
 * Turns an Identify activity into what is left of it once the picture is gone: a statement about
 * something, the clues that narrow it down, and a line to name it on.
 *
 * On screen the activity is a picture to be recognised, with clues bought one at a time at the cost
 * of points. The sheet leaves the picture out — recognising it is the whole game, and a printed
 * copy would either give the answer away or be too small to read — so what the student works from
 * is the statement and the clues, all of them, laid out in order, with room to answer underneath.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'identifica', not the iDevice's name.
 * - `question` is the statement shown above the picture, and is what the sheet leads with.
 * - `clues` is always eight slots long and `numberClues` says how many of them are in play. Both
 *   matter: an author can leave a gap in the middle, and the slots past the count hold whatever
 *   they last typed there.
 * - The activity's own word for a clue is in `msgs.msgClue`, where the author may have changed it.
 *   It is used before one of ours: a sheet saying 'Hint' under an activity that says 'Sugerencia'
 *   would be the same activity speaking with two voices.
 * - `question`, `clues` and `solution` are stored raw; `instructionsExe` and `textAfter` are
 *   `escape()`d, as most of the family stores them.
 * - `solution` may hold several accepted answers separated by a pipe. None is ever printed.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { selectQuestions, type RandomSource } from '../questionSelection';
import { escapeText, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'identifica';

/** Lines of blank room left to name the answer. */
const ANSWER_LINES = 2;

/** One question as stored by the Identify iDevice. */
interface IdentifyQuestion {
    /** The statement shown above the picture. */
    question?: string;
    /** Eight slots, of which `numberClues` are in play. */
    clues?: string[];
    numberClues?: number;
}

/** The Identify payload. */
interface IdentifyDataGame {
    /** Rich instructions, `escape()`d. `instructions` is the plain fallback. */
    instructionsExe?: string;
    instructions?: string;
    /** Escaped copy of the closing text; the div beside the payload is the one to read. */
    textAfter?: string;
    questionsGame?: IdentifyQuestion[];
    percentajeQuestions?: number;
    questionsRamdon?: boolean;
    /** The activity's own wording, which the author can edit. */
    msgs?: { msgClue?: string };
}

/**
 * The clues in play for one question, in the order the activity offers them.
 *
 * @returns The clues that have something in them
 */
function cluesOf(question: IdentifyQuestion): string[] {
    const clues = Array.isArray(question.clues) ? question.clues : [];
    const inPlay = typeof question.numberClues === 'number' ? Math.max(0, question.numberClues) : clues.length;

    return clues.slice(0, inPlay).filter(clue => typeof clue === 'string' && clue.trim() !== '');
}

/**
 * Lay the clues out as a list, each under its own label.
 *
 * Numbered by the activity's own word for a clue where it has one, and by the number alone where
 * it does not — inventing a word for it would need a translation for something already translated.
 *
 * @param clues - The clues in play, already filtered
 * @param word - The activity's word for a clue, if it has one
 * @returns The list as sanitised markup, or an empty string when there are no clues
 */
function buildClues(clues: string[], word: string): string {
    if (clues.length === 0) return '';

    const items = clues
        .map((clue, index) => {
            const label = word ? `${word} ${index + 1}.` : `${index + 1}.`;
            const text = sanitizeHtml(clue);

            return `<li><span class="worksheet-clue-label">${escapeText(label)}</span>${text}</li>`;
        })
        .join('');

    return `<ul class="worksheet-clues">${items}</ul>`;
}

/** One question: the statement, its clues, then room to name the answer in. */
function buildQuestion(question: IdentifyQuestion, word: string): PrintableItem | null {
    const prompt = sanitizeHtml(question.question);
    const clues = buildClues(cluesOf(question), word);

    // Without the picture, a question with neither a statement nor a clue asks nothing at all.
    if (!prompt && !clues) return null;

    const item: PrintableItem = { prompt, answer: { kind: 'writingSpace', lines: ANSWER_LINES } };
    if (clues) item.extraText = clues;

    return item;
}

export const IdentifyWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'identify',
    defaultTitle: 'Identify',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<IdentifyDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.questionsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const word = (dataGame.msgs?.msgClue ?? '').trim();

        const items = dataGame.questionsGame.flatMap(question => {
            const item = buildQuestion(question ?? {}, word);
            if (item) return [item];
            options.onOmission?.('invalid-data');
            return [];
        });

        const selected = selectQuestions(items, dataGame.percentajeQuestions, dataGame.questionsRamdon, random);
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'identify',
            title: options.title || IdentifyWorksheetAdapter.defaultTitle,
            items: selected,
        };

        // The divs are what the asset pass rewrote; the payload's copies are escaped and stale.
        const instructions = sanitizeHtml(
            extractDivContent(html, `${PREFIX}-instructions`) ||
                (dataGame.instructionsExe ? unescape(dataGame.instructionsExe) : dataGame.instructions),
        );
        if (instructions) activity.instructions = instructions;

        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
