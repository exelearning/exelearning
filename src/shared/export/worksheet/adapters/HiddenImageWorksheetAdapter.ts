/**
 * Hidden image ('hiddenimage') worksheet adapter
 *
 * Turns a Hidden image activity into a printable multiple-choice exercise: each question, the
 * picture that goes with it, and the options underneath with a box to tick.
 *
 * On screen the picture starts covered and a correct answer uncovers a piece of it. Paper cannot
 * uncover anything, so the picture is simply shown beside its question — which is what the
 * question was always about. What is lost is the reveal, and there is no paper equivalent to
 * reach for.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'hiddenimage', run together, not the iDevice's hyphenated name.
 * - The payload is only obfuscated from version 1 onwards; an older activity stores plain JSON.
 *   `extractDataGame` tries both, so nothing is needed here.
 * - A question keeps `options` padded to four slots and `numberOptions` saying how many are real.
 *   The runtime draws four boxes and leaves the spare ones blank; a sheet prints only the real
 *   ones, since a blank line beside a tick box reads as an option the student failed to see.
 * - `solution` is the index of the right answer and is never printed.
 * - **The two shuffle flags are named the wrong way round.** `optionsRamdon` shuffles the
 *   *questions* and `answersRamdon` shuffles the *options* — the editor's own field ids say so
 *   (`#hiEQuestionsRamdon`, `#hiEAnswersRamdon`). Reading them the way they are spelled sets a
 *   different exercise from the one the teacher configured.
 * - `instructionsExe` is `escape()`d rich text and `instructions` is the plain fallback; the
 *   closing text is kept twice, escaped in the payload and plain in a div beside it. The div is
 *   the copy the export pipeline rewrites, so it is the one to read.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { indexedQuestions, type RandomSource, selectQuestions, shuffleWith } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'hiddenimage';

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** Slots the editor keeps on every question, whatever `numberOptions` uses. */
const MAX_OPTIONS = 4;

/** One question as stored by the Hidden image iDevice. */
interface HiddenImageQuestion {
    /** The prompt, as plain HTML. */
    question?: string;
    /** Four slots, of which the first `numberOptions` are real. */
    options?: string[];
    numberOptions?: number;
    /** Index of the right answer, which a worksheet never prints. */
    solution?: number;
    /** The picture. The sidecar link carries the reference that still resolves. */
    url?: string;
    alt?: string;
    author?: string;
    /** Sound clip, which has no paper equivalent. */
    audio?: string;
}

/** The Hidden image activity payload. */
interface HiddenImageDataGame {
    /** Rich instructions, `escape()`d. `instructions` is the plain fallback. */
    instructionsExe?: string;
    instructions?: string;
    /** Escaped copy of the closing text; the div beside the payload is the one to read. */
    textAfter?: string;
    questionsGame?: HiddenImageQuestion[];
    /** Share of the stored questions the activity actually uses. */
    percentajeQuestions?: number;
    /** Despite the name, this is whether the *questions* are drawn at random. */
    optionsRamdon?: boolean;
    /** And this one is whether the *options* of a question are shuffled. */
    answersRamdon?: boolean;
}

/** A question paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedQuestion {
    question: HiddenImageQuestion;
    index: number;
}

/**
 * The options a question really offers.
 *
 * @param question - The question, as stored
 * @returns The real options, sanitised, in their stored order
 */
function realOptions(question: HiddenImageQuestion): string[] {
    const stored = Array.isArray(question.options) ? question.options : [];
    const wanted = Number.isFinite(question.numberOptions)
        ? Math.min(MAX_OPTIONS, Math.max(0, Math.floor(question.numberOptions as number)))
        : stored.length;

    return stored
        .slice(0, wanted)
        .map(option => sanitizeHtml(option))
        .filter(option => option.length > 0);
}

/**
 * Turn one stored question into a printable one.
 *
 * @returns The item, or null when there is nothing to answer
 */
function buildItem(
    { question, index }: IndexedQuestion,
    images: Map<number, string>,
    shuffleOptions: boolean,
    random: RandomSource,
): PrintableItem | null {
    const prompt = sanitizeHtml(question.question);
    const options = realOptions(question);

    // Without a prompt or without anything to choose between, there is no question on the sheet.
    if (!prompt || options.length === 0) return null;

    const item: PrintableItem = {
        prompt,
        answer: { kind: 'options', labels: shuffleOptions ? shuffleWith(options, random) : options, marker: 'box' },
    };

    const src = images.get(index) ?? question.url ?? '';
    if (src.length >= MIN_MEDIA_HREF_LENGTH) {
        item.media = { kind: 'image', src, alt: question.alt || undefined, author: question.author || undefined };
    }

    return item;
}

export const HiddenImageWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'hidden-image',
    defaultTitle: 'Hidden image',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<HiddenImageDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.questionsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const images = extractMediaLinks(html, PREFIX, 'Images');
        const shuffleOptions = dataGame.answersRamdon === true;

        // Unusable questions go before the share is applied, so one that cannot be printed does
        // not take up part of the number the teacher asked for.
        const items = indexedQuestions(dataGame.questionsGame, options).flatMap(entry => {
            const item = buildItem(entry, images, shuffleOptions, random);
            if (item) return [item];
            options.onOmission?.('invalid-data');
            return [];
        });

        // `optionsRamdon` is the questions' flag, whatever it is called.
        const selected = selectQuestions(items, dataGame.percentajeQuestions, dataGame.optionsRamdon, random);
        if (selected.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'hidden-image',
            title: options.title || HiddenImageWorksheetAdapter.defaultTitle,
            items: selected,
        };

        const instructions = sanitizeHtml(
            dataGame.instructionsExe ? unescape(dataGame.instructionsExe) : dataGame.instructions,
        );
        if (instructions) activity.instructions = instructions;

        // The div is what the asset pass rewrote; the payload's copy is the stale one.
        const stored = extractDivContent(html, `${PREFIX}-extra-content`);
        const textAfter = sanitizeHtml(stored || (dataGame.textAfter ? unescape(dataGame.textAfter) : ''));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
