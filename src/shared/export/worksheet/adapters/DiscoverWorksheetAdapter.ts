/**
 * Discover ('descubre') worksheet adapter
 *
 * Turns a Discover activity into a printable matching exercise: as many columns as the answer has
 * members, for the student to join with lines.
 *
 * On screen the cards are face down and the student turns them over looking for the ones that go
 * together. Paper cannot be turned over, so the cards are laid out face up and each column is
 * shuffled on its own — what is left is the part the memory game was testing anyway, which is
 * knowing which ones belong together.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'descubre', not the iDevice's name.
 * - `gameMode` is the activity's "Type", and it decides how wide an answer is: 0 pairs, 1 trios,
 *   2 quartets. Each stored entry of `wordsGame` holds a `data` array of four slots, of which the
 *   first `gameMode + 2` are in play; the rest are left over from the editor and are ignored.
 * - The sidecars are keyed **twice**, as Sort's are: the class carries the position within the
 *   answer (`descubre-LinkImages-0` … `-3`) and the link text the entry's index.
 * - `gameLevels` is how many difficulty buttons the activity offers, and a level is simply how
 *   many answers are in play: with three levels the easy one uses a third of them, the middle two
 *   thirds, the hard one all. A sheet cannot offer buttons, so it prints the middle — see
 *   `answersAtMediumLevel`.
 * - `color` is the font colour and `backcolor` the background, per card, exactly as Relate stores
 *   them. On paper the background becomes an outline and a band; see `cardColors`.
 * - `eText` is stored **raw**, straight off the editor's input. Relate keeps the same-named field
 *   URI-encoded and Classify keeps its own unescaped: the family agrees on the name and on
 *   nothing else, so each adapter has to read its own iDevice rather than its neighbour.
 * - A card carrying only a sound has nothing to print, and a quartet whose fourth card is a clip
 *   in every answer is common — it is how the activity adds listening to a matching game. That
 *   costs the column, not the exercise: see `printableColumns`.
 */

import { cardAccent, textInk } from '../cardColors';
import { extractDataGame, extractDivContent, extractMediaLinksByClass } from '../dataGameReader';
import { indexedQuestions, type RandomSource, selectQuestions, shuffleWith } from '../questionSelection';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableCard, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame and sidecar class prefix used by this iDevice. */
const PREFIX = 'descubre';

/** Shortest href the runtime accepts as a real media reference. */
const MIN_MEDIA_HREF_LENGTH = 4;

/** Slots the editor keeps on every entry, whatever the game mode uses. */
const MAX_MEMBERS = 4;

/** How many answers go in one block of the printed exercise. */
const ANSWERS_PER_GROUP = 5;

/** One member of an answer, as stored. */
interface DiscoverCard {
    eText?: string;
    url?: string;
    audio?: string;
    alt?: string;
    author?: string;
    color?: string;
    backcolor?: string;
}

/** One answer: the cards that belong together. */
interface DiscoverWord {
    data?: DiscoverCard[];
}

/** The Discover activity payload. */
interface DiscoverDataGame {
    instructions?: string;
    wordsGame?: DiscoverWord[];
    /** The activity's "Type": 0 pairs, 1 trios, 2 quartets. */
    gameMode?: number;
    /** How many difficulty buttons the activity offers: 1, 2 or 3. */
    gameLevels?: number;
    /** Share of the stored answers the activity actually uses. */
    percentajeQuestions?: number;
}

/** An answer paired with the index it had before selection, which the sidecars are keyed by. */
interface IndexedWord {
    question: DiscoverWord;
    index: number;
}

/**
 * How many cards make up one answer.
 *
 * @param gameMode - The activity's "Type"
 * @returns Two for pairs, three for trios, four for quartets
 */
export function membersPerAnswer(gameMode: number | undefined): number {
    const mode = Number.isFinite(gameMode) ? Math.floor(gameMode as number) : 0;
    return Math.min(MAX_MEMBERS, Math.max(2, mode + 2));
}

/**
 * How many answers the printed sheet sets.
 *
 * A difficulty level in this activity is not a different exercise — it is the same one with more
 * of the board in play. On screen the student picks a button; a sheet has no buttons, so it prints
 * the middle level, which is the teacher's own idea of the ordinary case.
 *
 * With three levels the middle is two thirds of the answers. With two there is no middle at all,
 * and the lower is taken: the two levels are "half" and "all", and the one that is not the maximum
 * is the one a default should be. With one level there is nothing to choose and every answer is
 * printed.
 *
 * @param total - How many answers survived
 * @param gameLevels - How many levels the activity offers
 * @returns How many of them to print, at least one
 */
export function answersAtMediumLevel(total: number, gameLevels: number | undefined): number {
    if (total === 0) return 0;

    const levels = Number.isFinite(gameLevels) ? Math.floor(gameLevels as number) : 1;
    if (levels === 2) return Math.max(1, Math.floor(total / 2));
    if (levels >= 3) return Math.max(1, Math.floor((total * 2) / 3));

    return total;
}

/**
 * One member of an answer, as it would print.
 *
 * @param source - The card, as stored
 * @param href - The picture from the sidecar, which is the reference that still resolves
 * @returns The card, or null when it carries nothing a student could see
 */
function buildCard(source: DiscoverCard, href: string | undefined): PrintableCard | null {
    const card: PrintableCard = {};
    const text = sanitizeHtml(source.eText);

    if (text) card.text = text;
    if (href && href.length >= MIN_MEDIA_HREF_LENGTH) {
        card.media = { kind: 'image', src: href, alt: source.alt || undefined, author: source.author || undefined };
    }

    // A card with neither words nor a picture is a sound clip, which paper cannot carry.
    if (!card.text && !card.media) return null;

    const ink = textInk(source.color);
    const accent = cardAccent(source.backcolor);
    if (ink) card.textColor = ink;
    if (accent) card.accentColor = accent;

    return card;
}

/**
 * Build one answer, with a gap wherever a member has nothing to show.
 *
 * @returns One entry per member, null where that member would print blank
 */
function buildRow(
    { question: word, index }: IndexedWord,
    members: number,
    pictures: Map<number, string>[],
): (PrintableCard | null)[] {
    const stored = Array.isArray(word.data) ? word.data : [];

    return Array.from({ length: members }, (_, member) => {
        const source = stored[member];
        return source ? buildCard(source, pictures[member]?.get(index) ?? source.url) : null;
    });
}

/**
 * Which positions of an answer are worth a column.
 *
 * A position no answer can print is one the activity built out of sound: a quartet whose fourth
 * card is a clip in every answer is, on paper, a trio. Dropping that column costs the listening
 * half of the exercise, which paper could not carry anyway, and keeps the rest — where dropping
 * the answers instead would print nothing at all.
 *
 * A position most answers can print is kept, and an answer missing its card there is dropped
 * instead: that is one author's gap rather than the activity's shape, and taking the column away
 * would punish every other answer for it.
 *
 * @param rows - Every answer, with nulls where a member prints blank
 * @param members - How many members the activity's Type gives an answer
 * @returns The positions to draw, in order
 */
export function printableColumns(rows: (PrintableCard | null)[][], members: number): number[] {
    return Array.from({ length: members }, (_, member) => member).filter(member => rows.some(row => row[member]));
}

export const DiscoverWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'discover',
    defaultTitle: 'Discover',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<DiscoverDataGame>(html, PREFIX);
        if (!dataGame || !Array.isArray(dataGame.wordsGame)) return null;

        const random: RandomSource = options.random ?? Math.random;
        const members = membersPerAnswer(dataGame.gameMode);
        // One map per position in the answer: the class carries the position, the link text the
        // entry. Read for every slot the editor keeps, so a mode change never loses a picture.
        const pictures = Array.from({ length: MAX_MEMBERS }, (_, member) =>
            extractMediaLinksByClass(html, `${PREFIX}-LinkImages-${member}`),
        );

        const rows = indexedQuestions(dataGame.wordsGame, options).map(entry => buildRow(entry, members, pictures));
        const columns = printableColumns(rows, members);

        // Two columns is the least an exercise about joining things can be made of.
        if (columns.length < 2) return null;
        if (columns.length < members) options.onOmission?.('media-required', members - columns.length);

        // Unusable answers go before the share is applied, so one that cannot be printed does not
        // take up part of the number the teacher asked for.
        const answers = rows.flatMap(row => {
            if (columns.every(member => row[member])) return [columns.map(member => row[member] as PrintableCard)];
            options.onOmission?.('media-required');
            return [];
        });

        const shared = selectQuestions(answers, dataGame.percentajeQuestions, false, random);
        const selected = shared.slice(0, answersAtMediumLevel(shared.length, dataGame.gameLevels));
        if (selected.length === 0) return null;

        // Grouped before shuffling, so an answer's members are always in the same group and never
        // end up on different sheets. Each column of a group is then shuffled on its own:
        // shuffling them together, or not at all, would leave every answer sharing a line and give
        // the exercise away.
        const groups = [];
        for (let start = 0; start < selected.length; start += ANSWERS_PER_GROUP) {
            const group = selected.slice(start, start + ANSWERS_PER_GROUP);

            groups.push({
                columns: columns.map((_, column) =>
                    shuffleWith(
                        group.map(answer => answer[column]),
                        random,
                    ),
                ),
            });
        }

        const activity: PrintableActivity = {
            ideviceType: 'discover',
            title: options.title || DiscoverWorksheetAdapter.defaultTitle,
            board: { kind: 'groupColumns', groups },
            // The whole exercise is the columns; there are no questions to number.
            items: [],
        };

        const instructions = sanitizeHtml(extractDivContent(html, `${PREFIX}-instructions`) || dataGame.instructions);
        if (instructions) activity.instructions = instructions;

        const textAfter = sanitizeHtml(extractDivContent(html, `${PREFIX}-extra-content`));
        if (textAfter) activity.textAfter = textAfter;

        return activity;
    },
};
