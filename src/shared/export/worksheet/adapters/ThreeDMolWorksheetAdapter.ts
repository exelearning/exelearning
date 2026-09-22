/**
 * 3D molecules ('3dmol') worksheet adapter
 *
 * Turns a 3D molecules activity into either a set of pictures or a test about them, following the
 * mode the author chose — the same two modes, and the same stored shape, as Electrical circuits.
 *
 * What differs is where the picture comes from. Electrical circuits stores its diagram already
 * rendered; this activity stores only the molecule file and the angle the author framed it at, and
 * what the reader sees is drawn by WebGL from those. An adapter cannot draw it, so the drawing is
 * made before the adapter runs and written into the payload beside the model — see
 * `moleculeCapture`. With nothing drawn, as in a command-line export, the questions still print,
 * and the pictures are reported as missing rather than silently absent.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'dmole', not the iDevice's name.
 * - `activityMode` is `'show'` or `'test'`, defaulting to `'test'` as the runtime defaults it.
 * - The questions are Select's shape once more: `selectsGame`, `quextion`, `typeSelect` 0 tick /
 *   1 order / 2 write, `options` and `solution`. The three kinds are answered as they are there.
 * - `description` is the caption under the molecule in `'show'` mode. A question keeps its
 *   `quextion` from whenever it was last in `'test'` mode, so in `'show'` mode it is ignored
 *   rather than trusted.
 * - `alt` describes the molecule for a reader who cannot see it, and carries over to the picture.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { CAPTURE_FIELD } from '../moleculeCapture';
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
const PREFIX = 'dmole';

/** What the author built the activity for. */
const MODE_SHOW = 'show';

/** Answer kinds stored in `selectsGame[].typeSelect`, as Select stores them. */
const SELECT_KIND_ORDER = 1;
const SELECT_KIND_WORD = 2;

/** One question as stored by the 3D molecules iDevice. */
interface MoleculeQuestion {
    /** The prompt, in `'test'` mode. Spelled this way throughout the family. */
    quextion?: string;
    /** The caption under the molecule, in `'show'` mode. */
    description?: string;
    /** What the molecule is, for a reader who cannot see the picture. */
    alt?: string;
    /** The picture, written in by the capture pass. Absent when nothing drew it. */
    [CAPTURE_FIELD]?: string;
    /** The model itself, which says a picture was meant to be here. */
    modelData?: string;
    typeSelect?: number;
    options?: string[];
    numberOptions?: number;
    solutionQuestion?: string;
    percentageShow?: number;
}

/** The 3D molecules payload. */
interface MoleculeDataGame {
    activityMode?: string;
    /** Rich instructions, `escape()`d. `instructions` is the plain fallback. */
    instructionsExe?: string;
    instructions?: string;
    /** Escaped copy of the closing text; the div beside the payload is the one to read. */
    textAfter?: string;
    selectsGame?: MoleculeQuestion[];
    percentajeQuestions?: number;
    questionsRandom?: boolean;
    answersRamdon?: boolean;
}

/** The picture of this molecule, when one was drawn for it. */
function pictureOf(question: MoleculeQuestion): PrintableItem['media'] | undefined {
    const src = question[CAPTURE_FIELD];
    if (typeof src !== 'string' || !src.startsWith('data:image/')) return undefined;

    return { kind: 'image', src, alt: question.alt || undefined };
}

/**
 * Build the answer space for one question, which depends on its kind.
 *
 * @returns The answer, or null when there is nothing for the student to fill in
 */
function buildAnswer(
    question: MoleculeQuestion,
    dataGame: MoleculeDataGame,
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

/** One molecule as it is presented, with its caption underneath. */
function buildShownMolecule(question: MoleculeQuestion): PrintableItem | null {
    const media = pictureOf(question);
    // Presenting a molecule nobody drew leaves a caption describing an empty space.
    if (!media) return null;

    const item: PrintableItem = { prompt: '', media };
    const description = sanitizeHtml(question.description);
    if (description) item.extraText = description;

    return item;
}

/** One question about a molecule: the prompt, the picture, then the answer space. */
function buildAskedMolecule(
    question: MoleculeQuestion,
    dataGame: MoleculeDataGame,
    random: RandomSource,
): PrintableItem | null {
    const prompt = sanitizeHtml(question.quextion);
    const answer = buildAnswer(question, dataGame, random);

    if (!prompt || !answer) return null;

    const item: PrintableItem = { prompt, answer };
    const media = pictureOf(question);
    if (media) item.media = media;

    return item;
}

export const ThreeDMolWorksheetAdapter: WorksheetAdapter = {
    ideviceType: '3dmol',
    defaultTitle: '3D molecules',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<MoleculeDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.selectsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const presenting = dataGame.activityMode === MODE_SHOW;

        const items = dataGame.selectsGame.flatMap(question => {
            const item = presenting ? buildShownMolecule(question) : buildAskedMolecule(question, dataGame, random);

            if (item) {
                // A question that kept its words but lost its molecule is worth saying so.
                if (!item.media && question.modelData) options.onOmission?.('media-required');
                return [item];
            }
            options.onOmission?.(presenting ? 'media-required' : 'invalid-data');
            return [];
        });

        const selected = selectQuestions(items, dataGame.percentajeQuestions, dataGame.questionsRandom, random);
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: '3dmol',
            title: options.title || ThreeDMolWorksheetAdapter.defaultTitle,
            items: selected,
            // A presented molecule is not a numbered question: the sheet is a set of pictures.
            ...(presenting ? { unnumbered: true } : {}),
        };

        const instructions = sanitizeHtml(
            extractDivContent(html, `${PREFIX}-instructions`) ||
                (dataGame.instructionsExe ? unescape(dataGame.instructionsExe) : dataGame.instructions),
        );
        if (instructions) activity.instructions = instructions;

        // The div is what the asset pass rewrote; the payload's copy is the escaped, stale one.
        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
