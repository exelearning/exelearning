/**
 * Complete ('completa') worksheet adapter
 *
 * Turns a Complete activity into a printable exercise: the author's text with a gap wherever a
 * word was hidden, and — in the modes that offer the words on screen — the list of those words
 * above it.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'completa'.
 * - `textText` is the author's text, escape()'d, with each hidden word wrapped in `@@`. The
 *   runtime pairs those markers up and swaps each pair for a gap.
 * - A hidden word may list alternatives separated by `|`; select mode offers all of them,
 *   while drag mode offers the primary word.
 * - `wordsErrors` are the wrong words, comma separated, each also allowing `|` alternatives.
 * - `type` is the game mode: 0 the student writes the word, 1 drags it, 2 picks it from a list.
 *
 * What changes between modes is where the student gets the word from. Writing it is recall, so the
 * sheet gives nothing away; dragging and picking show the words on screen, so the sheet has to
 * list them — wrong ones included — or it would set a harder exercise than the author wrote.
 *
 * `wordsSize` says how wide a gap is: proportional to the word it hides when set, and a fixed
 * width otherwise. The fixed width is wider on paper than on screen, where the runtime uses ten
 * characters, since a printed gap cannot grow as the student writes.
 */

import { extractDataGame, extractDivContent } from '../dataGameReader';
import { shuffleWith, type RandomSource } from '../questionSelection';
import { htmlToText, sanitizeHtml } from '../sanitizeHtml';
import { renderInlineGap } from '../WorksheetRenderer';
import type { PrintableActivity, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'completa';

/** Characters a fixed-width gap is drawn as, when the activity does not size them to the word. */
const FIXED_GAP_CHARACTERS = 12;

/** Game modes stored in `type`. */
const MODE_DRAG = 1;
const MODE_SELECT = 2;

/** The Complete activity payload. */
interface CompleteDataGame {
    instructions?: string;
    /** The author's text, escaped, with hidden words wrapped in `@@`. */
    textText?: string;
    /** 0 write the word, 1 drag it, 2 pick it from a list. */
    type?: number;
    /** Wrong words offered alongside the right ones, comma separated. */
    wordsErrors?: string;
    /** Whether a gap is as wide as the word it hides, rather than a fixed width. */
    wordsSize?: boolean;
    /** Select mode may offer different alternatives at each gap. */
    wordsLimit?: boolean;
}

/** The author's text with each gap marked, plus the words those gaps hide. */
export interface GappedText {
    /** The text, with `{{gap-N}}` where each hidden word was. */
    text: string;
    /** The hidden words, in the order they appear. */
    words: string[];
}

/**
 * Build the token that stands in for a gap while the text is sanitised.
 */
function gapToken(index: number): string {
    return `{{gap-${index}}}`;
}

/**
 * Replace the author's `@@` markers with gap tokens.
 *
 * Markers are paired opening-to-closing as the runtime does, so an odd one left dangling closes
 * nothing and stays in the text rather than swallowing the rest of it.
 *
 * Tokens rather than a split, because the text has to be sanitised whole: cutting it at the gaps
 * would leave `<b>El ` and `</b>` as separate fragments, and a sanitiser sees each of those as
 * broken markup.
 *
 * @param text - The author's text, already unescaped
 * @returns The tokenised text and the words the gaps hide
 */
export function splitGappedText(text: string): GappedText {
    const words: string[] = [];
    let result = '';
    let rest = text;

    while (true) {
        const open = rest.indexOf('@@');
        if (open === -1) break;

        const close = rest.indexOf('@@', open + 2);
        if (close === -1) break;

        result += rest.slice(0, open) + gapToken(words.length);
        words.push(rest.slice(open + 2, close));
        rest = rest.slice(close + 2);
    }

    return { text: result + rest, words };
}

/**
 * Take the word that is printed for a gap: the first of its alternatives.
 */
function primaryWord(word: string): string {
    return word.split('|')[0].trim();
}

/**
 * Read the wrong words the activity offers alongside the right ones.
 */
function readWrongWords(wordsErrors: string | undefined): string[] {
    if (!wordsErrors) return [];

    return wordsErrors
        .split(',')
        .flatMap(entry => entry.split('|'))
        .map(word => word.trim())
        .filter(word => word !== '');
}

export const CompleteWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'complete',
    defaultTitle: 'Complete',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<CompleteDataGame>(html, PREFIX);
        if (!dataGame) return null;

        const random: RandomSource = options.random ?? Math.random;
        const source =
            extractDivContent(html, 'completa-text-game') ||
            (typeof dataGame.textText === 'string' ? unescape(dataGame.textText) : '');
        const { text, words } = splitGappedText(source);
        const limited = dataGame.type === MODE_SELECT && dataGame.wordsLimit === true;
        const alternatives = (word: string) => [...new Set(word.split('|').map(htmlToText).filter(Boolean))];

        // A text with no hidden word is not an exercise.
        if (words.length === 0) return null;

        // Sanitised whole, with the gaps still tokens, so the author's markup and spacing survive.
        // The gap markup goes in afterwards, once nothing untrusted can be confused with it.
        const gapWidth = (word: string) =>
            dataGame.wordsSize === true ? [...primaryWord(word)].length : FIXED_GAP_CHARACTERS;

        const gaps = words.map(word =>
            renderInlineGap(gapWidth(word), limited ? shuffleWith(alternatives(word), random) : undefined),
        );
        // Only text nodes can become answer spaces; tokens in attributes must stay attributes.
        const prompt = sanitizeHtml(text)
            .split(/(<[^>]+>)/g)
            .map(part =>
                part.startsWith('<')
                    ? part
                    : part.replace(/\{\{gap-(\d+)\}\}/g, (token, index) => gaps[Number(index)] ?? token),
            )
            .join('');

        const activity: PrintableActivity = {
            ideviceType: 'complete',
            title: options.title || CompleteWorksheetAdapter.defaultTitle,
            items: [{ prompt }],
        };

        // Dragging and picking show the words on screen, so the sheet lists them too.
        if (dataGame.type === MODE_DRAG || (dataGame.type === MODE_SELECT && !limited)) {
            const answers = dataGame.type === MODE_SELECT ? words.flatMap(alternatives) : words.map(primaryWord);
            const candidates = [...answers, ...readWrongWords(dataGame.wordsErrors)];
            // Drag mode needs one copy per gap, including repeated words. Select menus share
            // their choices and remove duplicates, as the interactive activity does.
            const offered = shuffleWith(dataGame.type === MODE_SELECT ? [...new Set(candidates)] : candidates, random);

            if (offered.length > 0) {
                activity.board = { kind: 'wordBank', words: offered.map(word => sanitizeHtml(word)) };
            }
        }

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
