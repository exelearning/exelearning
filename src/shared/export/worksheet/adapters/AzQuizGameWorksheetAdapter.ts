/**
 * A-Z quiz game ('rosco') worksheet adapter
 *
 * Turns an alphabet ring into a printable exercise: the ring itself at the top, then one clue per
 * letter that carries a question — the letter and whether the answer starts with it or merely
 * contains it, the definition, its picture, and boxes to write the answer in.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'rosco', not the iDevice's name.
 * - `letters` is a string and `wordsGame` runs alongside it: `wordsGame[i]` belongs to
 *   `letters[i]`. A letter is in play when its word is not blank, which is exactly how the runtime
 *   decides whether to draw it plainly (`getLettersRosco`).
 * - Two letters are digraphs stored as digits: '0' is L·L and '1' is SS. What is read is the
 *   digraph, so that is what the ring and the clue show (`getRealLetter`).
 * - `type` 0 means the answer starts with the letter, anything else that it contains it. The
 *   wording comes from the activity's own messages, which the author can edit under custom texts,
 *   with `%1` standing for the letter.
 * - A definition may hold several wordings separated by '|', and the activity shows one at random
 *   per play (`getRandomDefinition`). One is printed, so a sheet reads like one round of the game.
 * - The answer may hold several accepted spellings, also separated by '|'. The boxes are sized
 *   from the first, the author's own.
 * - There is no share of questions and no random draw here, unlike its siblings: every letter with
 *   a question is asked.
 */

import { extractDataGame, extractDivContent, extractMediaLinks } from '../dataGameReader';
import { buildAnswerBoxes, type RandomSource } from '../questionSelection';
import { escapeText, hasPrintableContent, sanitizeHtml } from '../sanitizeHtml';
import type {
    PrintableActivity,
    PrintableItem,
    PrintableRingLetter,
    WorksheetAdapter,
    WorksheetAdapterOptions,
} from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'rosco';

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** `type` 0 asks for a word starting with the letter; anything else, one containing it. */
const STARTS_WITH = 0;

/** Digraphs the activity stores as digits, and reads as two characters. */
const DIGRAPHS: Record<string, string> = { '0': 'L·L', '1': 'SS' };

/** Wording used when the activity carries none of its own. */
const DEFAULT_STARTS_WITH = 'Starts with %1';
const DEFAULT_CONTAINS = 'Contains letter %1';

/** One letter's question as stored by the A-Z quiz game. */
interface RoscoWord {
    /** The answer. Blank means the letter carries no question. */
    word?: string;
    /** The clue, which may hold several wordings separated by '|'. */
    definition?: string;
    /** 0 starts with the letter, anything else contains it. */
    type?: number;
    url?: string;
    alt?: string;
    author?: string;
    /** Sound clip, which has no paper equivalent. */
    audio?: string;
}

/** The A-Z quiz game payload. */
interface RoscoDataGame {
    instructions?: string;
    /** The alphabet, one character per question, digraphs held as digits. */
    letters?: string;
    wordsGame?: RoscoWord[];
    caseSensitive?: boolean;
    /** User-visible wording, saved with the activity and editable by the author. */
    msgs?: { msgStartWith?: string; msgContaint?: string };
}

/** Spell a stored letter the way it is read. */
function realLetter(stored: string): string {
    return DIGRAPHS[stored] ?? stored;
}

/**
 * The author's own wording for the first thing a clue says.
 *
 * The wording already names the letter — 'Starts with D' — so nothing is put in front of it. The
 * letter on its own as well would say it twice.
 */
function letterCue(word: RoscoWord, letter: string, dataGame: RoscoDataGame): string {
    const pattern =
        word.type === STARTS_WITH
            ? dataGame.msgs?.msgStartWith || DEFAULT_STARTS_WITH
            : dataGame.msgs?.msgContaint || DEFAULT_CONTAINS;

    return pattern.replace('%1', letter);
}

/**
 * Pick one wording of a clue, as the activity does on each play.
 */
function oneDefinition(definition: string | undefined, random: RandomSource): string {
    const wordings = (definition ?? '').split('|');
    if (wordings.length < 2) return definition ?? '';

    return wordings[Math.floor(random() * wordings.length) % wordings.length].trim();
}

/** The first of the accepted spellings, which is the one the boxes are sized from. */
function primaryAnswer(word: string | undefined): string {
    return (word ?? '').split('|')[0].trim();
}

/**
 * Build the clue for one letter in play.
 */
function buildClue(
    word: RoscoWord,
    letter: string,
    index: number,
    dataGame: RoscoDataGame,
    imageLinks: Map<number, string>,
    random: RandomSource,
): PrintableItem | null {
    const cue = `<strong class="worksheet-letter-cue">${escapeText(letterCue(word, letter, dataGame))}</strong>`;
    const definition = sanitizeHtml(oneDefinition(word.definition, random));

    const item: PrintableItem = {
        prompt: cue + definition,
        // Blank boxes, one per character: the length is the only help the sheet gives.
        answer: {
            kind: 'characterBoxes',
            groups: buildAnswerBoxes(primaryAnswer(word.word), 0, dataGame.caseSensitive === true, random),
        },
    };

    const src = imageLinks.get(index) ?? word.url ?? '';
    if (src.length >= MIN_MEDIA_HREF_LENGTH) {
        item.media = {
            kind: 'image',
            src,
            alt: word.alt || undefined,
            author: word.author || undefined,
            // Small: an illustration sits under its clue without taking the page over.
            size: 'small',
        };
    }

    // The letter cue is generated guidance, not the clue. It must not make an audio-only or
    // empty definition look printable. Inline illustrations are valid clues too.
    return hasPrintableContent(definition) || item.media ? item : null;
}

export const AzQuizGameWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'az-quiz-game',
    defaultTitle: 'A-Z quiz game',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<RoscoDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.wordsGame) || typeof dataGame.letters !== 'string') return null;

        const random: RandomSource = options.random ?? Math.random;
        const imageLinks = extractMediaLinks(html, PREFIX, 'Images');
        const stored = [...dataGame.letters];

        const ring: PrintableRingLetter[] = [];
        const items: PrintableItem[] = [];

        stored.forEach((character, index) => {
            const word = dataGame.wordsGame?.[index];
            const letter = realLetter(character);
            // In play when it has an answer, exactly as the runtime decides it.
            const active = typeof word?.word === 'string' && word.word.trim() !== '';

            const ringLetter = { letter, active: false };
            ring.push(ringLetter);
            if (!active || !word) return;

            const clue = buildClue(word, letter, index, dataGame, imageLinks, random);
            // A letter whose clue is only a sound clip has nothing to read on paper.
            if (!clue) {
                options.onOmission?.('media-required');
                return;
            }
            ringLetter.active = true;
            items.push(clue);
        });

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'az-quiz-game',
            title: options.title || AzQuizGameWorksheetAdapter.defaultTitle,
            board: { kind: 'letterRing', letters: ring },
            // Each clue is labelled by its letter, so the list must not number them as well.
            unnumbered: true,
            items,
        };

        const instructions = sanitizeHtml(dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
