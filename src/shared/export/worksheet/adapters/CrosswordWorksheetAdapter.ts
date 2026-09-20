/**
 * Crossword ('crucigrama') worksheet adapter
 *
 * Turns a Crossword activity into a printable exercise: the grid on top, the numbered clues
 * below, each with its illustration underneath when it has one.
 *
 * Differences from Guess that are easy to get wrong:
 * - The DataGame class prefix is 'crucigrama'.
 * - There is no `optionsRamdon`: the draw is always random, and the activity keeps a minimum of
 *   two words rather than one.
 * - `maxWords` caps how many words the board can seat, whatever the share asked for.
 * - Hints come from `difficulty`, not `percentageShow`: the share of letters given away is
 *   `(100 - difficulty)%` (`calculateLettersToShow` in the iDevice's export JS).
 * - Clue numbers come from the grid, not from the order of the list, so items carry an explicit
 *   number. Vertical words are numbered first, then horizontal ones, as the activity does.
 * - A word the solver cannot cross into the grid is dropped, together with its clue.
 */

import { buildCrosswordLayout } from '../crosswordLayout';
import { extractDataGame, extractDivContent, extractLinkHref, extractMediaLinks } from '../dataGameReader';
import { selectCrosswordQuestions, indexedQuestions, type RandomSource } from '../questionSelection';
import { escapeText, htmlToText, isSafeImageUrl, sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'crucigrama';

/** Largest number of words the iDevice's board will seat. */
const MAX_WORDS = 16;

/** Board the iDevice solves in, and the largest grid this adapter will produce. */
const BOARD_SIZE = 16;

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** Picture the iDevice falls back to when the author set no background of their own. */
const DEFAULT_BACKGROUND_FILE = 'ccgmbackground.jpg';

/** One clue as stored by the Crossword iDevice. */
interface CrosswordWord {
    word?: string;
    definition?: string;
    url?: string;
    alt?: string;
    author?: string;
}

/** The Crossword activity payload. */
interface CrosswordDataGame {
    instructions?: string;
    wordsGame?: CrosswordWord[];
    /** Share of the stored words the activity actually asks. */
    percentajeQuestions?: number;
    /** 0-100; the share of letters given away is its complement. */
    difficulty?: number;
    caseSensitive?: boolean;
    /** Whether accents count as distinct letters. */
    tilde?: boolean;
    /** Whether the activity draws a picture behind the board. */
    hasBack?: boolean;
    /** Background picture reference. The sidecar link carries the resolvable one. */
    urlBack?: string;
    authorBackImage?: string;
}

/** A word paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedWord {
    question: CrosswordWord;
    index: number;
}

/**
 * Choose which letters of a word to print as hints.
 *
 * Mirrors `calculateLettersToShow`: the share is the complement of the difficulty, truncated, and
 * the offsets are drawn at random.
 */
function pickHints(length: number, difficulty: number | undefined, random: RandomSource): Set<number> {
    const level = typeof difficulty === 'number' && Number.isFinite(difficulty) ? difficulty : 100;
    const wanted = Math.floor(((100 - level) / 100) * length);
    const chosen = new Set<number>();

    if (wanted <= 0) return chosen;
    if (wanted >= length) {
        for (let offset = 0; offset < length; offset++) chosen.add(offset);
        return chosen;
    }

    // Bounded, so a randomness source that keeps repeating itself cannot spin forever.
    let attempts = 0;
    while (chosen.size < wanted && attempts < length * 10) {
        chosen.add(Math.floor(random() * length) % length);
        attempts++;
    }
    for (let offset = 0; chosen.size < wanted && offset < length; offset++) chosen.add(offset);

    return chosen;
}

/**
 * Build the clue for one placed word.
 */
function buildClue(
    question: CrosswordWord,
    storedIndex: number,
    number: number,
    imageLinks: Map<number, string>,
): PrintableItem {
    const item: PrintableItem = {
        prompt: escapeText(htmlToText(question.definition)),
        // The answer goes in the shared grid, so the clue has no box row of its own.
        number,
    };

    const src = imageLinks.get(storedIndex) ?? question.url ?? '';
    if (src.length >= MIN_MEDIA_HREF_LENGTH) {
        item.media = {
            kind: 'image',
            src,
            alt: question.alt || undefined,
            author: question.author || undefined,
            // Small: a clue illustration sits under its definition without taking the page over.
            size: 'small',
        };
    }

    return item;
}

export const CrosswordWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'crossword',
    defaultTitle: 'Crossword',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<CrosswordDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.wordsGame)) return null;

        const random = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');

        // Selection carries the stored index along: the sidecars are keyed by it, and both the
        // random draw and the solver reorder the words.
        const selected = selectCrosswordQuestions<IndexedWord>(
            indexedQuestions(dataGame.wordsGame, options).filter(({ question, index }) => {
                const src = imageLinks.get(index) ?? question.url ?? '';
                if (
                    htmlToText(question.definition) ||
                    (typeof src === 'string' && src.length >= MIN_MEDIA_HREF_LENGTH && isSafeImageUrl(src))
                )
                    return true;
                options.onOmission?.('media-required');
                return false;
            }),
            dataGame.percentajeQuestions,
            MAX_WORDS,
            random,
        );

        // A stored background comes from the sidecar, which is the reference the export pipeline
        // can resolve. With none set the iDevice falls back to a picture of its own, which the
        // worksheet can show too as long as the caller said where iDevice files are served from.
        const storedBackground = extractLinkHref(html, `${PREFIX}-LinkBack`);
        const backgroundSrc =
            storedBackground.length >= MIN_MEDIA_HREF_LENGTH
                ? storedBackground
                : options.ideviceBasePath
                  ? `${options.ideviceBasePath}crossword/export/${DEFAULT_BACKGROUND_FILE}`
                  : '';
        const hasBackground = dataGame.hasBack === true && backgroundSrc !== '';

        const layoutOptions = {
            caseSensitive: dataGame.caseSensitive === true,
            tilde: dataGame.tilde !== false,
            size: BOARD_SIZE,
            // The cells only line up with the picture at their original board coordinates, so the
            // board keeps its full size whenever there is one behind it.
            crop: !hasBackground,
            randomSource: random,
        };

        // Hints are chosen before placing, so a cell shared by two words shows a letter that is
        // consistent with both.
        const hints = selected.map(entry => {
            const length = (entry.question.word ?? '').replace(/\s+/g, '').length;
            return pickHints(length, dataGame.difficulty, random);
        });

        const layout = buildCrosswordLayout(
            selected.map(entry => entry.question.word),
            hints,
            layoutOptions,
        );

        const omitted = selected.length - layout.placements.length;
        if (omitted > 0) options.onOmission?.('unplaced-word', omitted);
        if (layout.placements.length === 0) return null;

        const items = layout.placements.map(placement => ({
            ...buildClue(
                selected[placement.index].question,
                selected[placement.index].index,
                placement.number,
                imageLinks,
            ),
            direction: placement.horizontal ? ('across' as const) : ('down' as const),
        }));

        const activity: PrintableActivity = {
            ideviceType: 'crossword',
            title: options.title || CrosswordWorksheetAdapter.defaultTitle,
            board: {
                kind: 'crosswordGrid',
                rows: layout.rows,
                ...(hasBackground
                    ? { background: { src: backgroundSrc, author: dataGame.authorBackImage || undefined } }
                    : {}),
            },
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
