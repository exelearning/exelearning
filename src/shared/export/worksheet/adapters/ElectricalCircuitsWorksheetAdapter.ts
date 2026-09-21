/**
 * Electrical circuits ('electrical-circuits') worksheet adapter
 *
 * Turns an Electrical circuits activity into either a set of diagrams or a test about them,
 * depending on which the author built.
 *
 * The circuit itself survives the trip intact, which is what makes this activity printable at all
 * where a map or a puzzle is not: it is a drawing, and the author's TikZ source has already been
 * rendered to SVG and stored beside it. Nothing about it is interactive.
 *
 * Notes on the stored data:
 * - `activityMode` is the author's own choice of what the activity is for, and the sheet follows
 *   it. `'show'` presents each circuit with its description underneath; `'test'` asks a question
 *   about each one. It defaults to `'test'`, as the runtime defaults it.
 * - The questions are the same shape Select stores, down to the field names: `selectsGame`,
 *   `quextion`, `typeSelect` 0 tick / 1 order / 2 write, `options` and `solution`. The three kinds
 *   are answered here the way they are there, so the two activities set the same exercise.
 * - `description` is the caption shown under the circuit in `'show'` mode, and is not used in
 *   `'test'` mode — the question takes its place.
 * - `tikzSvg` is the drawing and `tikzCode` the source it came from. Only the drawing is printed:
 *   see `circuitImage` for why it travels as an image rather than as markup.
 * - A question with neither a circuit nor anything to answer is reported and left out.
 */

import { circuitImageSource } from '../circuitImage';
import { extractDataGame, extractDivContent } from '../dataGameReader';
import { buildAnswerBoxes, readPrintableOptions, selectQuestions, type RandomSource } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableAnswer,
    PrintableItem,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'electrical-circuits';

/** What the author built the activity for. */
const MODE_SHOW = 'show';

/** Answer kinds stored in `selectsGame[].typeSelect`, as Select stores them. */
const SELECT_KIND_ORDER = 1;
const SELECT_KIND_WORD = 2;

/** One question as stored by the Electrical circuits iDevice. */
interface CircuitQuestion {
    /** The prompt, in `'test'` mode. Spelled this way throughout the family. */
    quextion?: string;
    /** The caption under the circuit, in `'show'` mode. */
    description?: string;
    /** The circuit, already rendered from its TikZ source. */
    tikzSvg?: string;
    /** 0 tick an option, 1 put the options in order, 2 write a word. */
    typeSelect?: number;
    options?: string[];
    numberOptions?: number;
    solutionQuestion?: string;
    percentageShow?: number;
}

/** The Electrical circuits payload. */
interface CircuitDataGame {
    /** `'show'` presents the circuits; `'test'` asks about them. Defaults to `'test'`. */
    activityMode?: string;
    /** Rich instructions, `escape()`d. `instructions` is the plain fallback. */
    instructionsExe?: string;
    instructions?: string;
    /** Escaped copy of the closing text; the div beside the payload is the one to read. */
    textAfter?: string;
    selectsGame?: CircuitQuestion[];
    percentajeQuestions?: number;
    questionsRandom?: boolean;
    answersRamdon?: boolean;
}

/**
 * Build the answer space for one question, which depends on its kind.
 *
 * Mirrors Select, whose questions these are: an ordering question gets a line to write a position
 * on rather than a box to tick, and a written answer gets one box per letter.
 *
 * @returns The answer, or null when there is nothing for the student to fill in
 */
function buildAnswer(
    question: CircuitQuestion,
    dataGame: CircuitDataGame,
    random: RandomSource,
): PrintableAnswer | null {
    if (question.typeSelect === SELECT_KIND_WORD) {
        const groups = buildAnswerBoxes(question.solutionQuestion, question.percentageShow, false, random);
        return groups.length > 0 ? { kind: 'characterBoxes', groups } : null;
    }

    const labels = readPrintableOptions(
        question.options,
        question.numberOptions,
        dataGame.answersRamdon === true,
        random,
    );
    if (labels.length === 0) return null;

    return { kind: 'options', labels, marker: question.typeSelect === SELECT_KIND_ORDER ? 'line' : 'box' };
}

/**
 * One circuit as it is presented, with its caption underneath.
 *
 * The caption goes in the extra text rather than the prompt, because the renderer draws an item
 * as prompt, picture, extra text — and here the drawing comes first.
 */
function buildShownCircuit(question: CircuitQuestion): PrintableItem | null {
    const src = circuitImageSource(question.tikzSvg);
    const description = sanitizeHtml(question.description);

    // Without the drawing there is nothing to present: the caption alone describes a picture the
    // reader cannot see.
    if (!src) return null;

    const item: PrintableItem = { prompt: '', media: { kind: 'image', src } };
    if (description) item.extraText = description;

    return item;
}

/** One question about a circuit: the prompt, the drawing, then the answer space. */
function buildAskedCircuit(
    question: CircuitQuestion,
    dataGame: CircuitDataGame,
    random: RandomSource,
): PrintableItem | null {
    const prompt = sanitizeHtml(question.quextion);
    const answer = buildAnswer(question, dataGame, random);

    // A question needs something to ask and somewhere to answer; the circuit may be absent.
    if (!prompt || !answer) return null;

    const item: PrintableItem = { prompt, answer };
    const src = circuitImageSource(question.tikzSvg);
    if (src) item.media = { kind: 'image', src };

    return item;
}

export const ElectricalCircuitsWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'electrical-circuits',
    defaultTitle: 'Electrical circuits',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<CircuitDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.selectsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const presenting = dataGame.activityMode === MODE_SHOW;

        const items = dataGame.selectsGame.flatMap(question => {
            const item = presenting ? buildShownCircuit(question) : buildAskedCircuit(question, dataGame, random);

            if (item) return [item];
            options.onOmission?.(presenting ? 'media-required' : 'invalid-data');
            return [];
        });

        const selected = selectQuestions(items, dataGame.percentajeQuestions, dataGame.questionsRandom, random);
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'electrical-circuits',
            title: options.title || ElectricalCircuitsWorksheetAdapter.defaultTitle,
            items: selected,
            // A presented circuit is not a numbered question: the sheet is a set of diagrams.
            ...(presenting ? { unnumbered: true } : {}),
        };

        const instructions = sanitizeHtml(
            dataGame.instructionsExe ? unescape(dataGame.instructionsExe) : dataGame.instructions,
        );
        if (instructions) activity.instructions = instructions;

        // The div is what the asset pass rewrote; the payload's copy is the escaped, stale one.
        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
