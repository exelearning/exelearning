/**
 * Challenge ('challenge') worksheet adapter
 *
 * Turns a Challenge activity into the sheet it already is underneath: a challenge to solve, the
 * smaller ones that lead up to it, and room to write each answer.
 *
 * On screen this is a room to be escaped — a clock runs, clues appear as time passes, and in linear
 * mode one challenge unlocks the next. None of that survives the trip, and none of it has to: what
 * the student is actually asked is a question with a title and a description, and the answer is a
 * word they write. So the sheet prints the main challenge first, then each of the smaller ones the
 * same way, each with two lines under it.
 *
 * Notes on the stored data:
 * - The DataGame class prefix is 'desafio', not the iDevice's name.
 * - The main challenge is `desafioTitle` / `desafioSolution` / `desafioDescription`; the smaller
 *   ones are `challengesGame[]`, each with `title`, `solution` and `description`.
 * - Both kinds of description are kept twice: in the payload, and in a div beside it. The div is
 *   the copy the export pipeline rewrote, so it is the one to read — but the divs arrived with a
 *   later version of the iDevice, and a project saved before that has only the payload's copy.
 * - The challenges' divs are keyed by position, not by a `data-id`.
 * - `instructionsExe` is stored raw here, where most of the family `escape()`s it. Unescaping it
 *   would rewrite a literal `%41` in an author's instructions into an `A`.
 * - `desafioType` is 0 linear or 1 free. It changes nothing on paper: every challenge is there to
 *   be read whatever order the screen would have released them in.
 * - `clues` are timed, and the clock is the only thing that hands them over. A sheet has no clock,
 *   and printing them all would answer the questions it is asking, so they are left out.
 * - No solution is ever printed: the space for it is what the student fills in.
 */

import { extractDataGame, extractDivContent, extractDivContents } from '../dataGameReader';
import { sanitizeHtml } from '../sanitizeHtml';
import type { PrintableActivity, PrintableItem, WorksheetAdapter, WorksheetAdapterOptions } from '../types';

/** DataGame class prefix used by this iDevice. */
const PREFIX = 'desafio';

/** Lines of room left under each challenge. The answer is a word or a short phrase. */
const ANSWER_LINES = 2;

/** One of the smaller challenges leading up to the main one. */
interface Challenge {
    title?: string;
    /** The wording, in the copy that may have gone stale. */
    description?: string;
    /** What the student has to arrive at. Never printed. */
    solution?: string;
}

/** The Challenge payload. */
interface ChallengeDataGame {
    /** The main challenge's own title and wording. */
    desafioTitle?: string;
    desafioDescription?: string;
    /** Rich instructions, stored raw here rather than escaped. `instructions` is the plain one. */
    instructionsExe?: string;
    instructions?: string;
    challengesGame?: Challenge[];
}

/**
 * Build one challenge: its title, its wording, then the room to answer in.
 *
 * The title is marked as one. Nothing else on the sheet would say so — the challenges carry their
 * own names rather than numbers, and a title set in the same type as the paragraphs under it reads
 * as the first line of them.
 *
 * @param title - The challenge's own title
 * @param description - Its wording, already chosen between the div and the payload
 * @returns The item, or null when there is neither a title nor a description to print
 */
function buildChallenge(title: string | undefined, description: string): PrintableItem | null {
    const name = sanitizeHtml(title);
    const wording = sanitizeHtml(description);

    // A challenge with no words at all is a heading over an empty space.
    if (!name && !wording) return null;

    const item: PrintableItem = {
        prompt: name ? `<strong class="worksheet-challenge-title">${name}</strong>` : '',
        // Ruled, not blank: the answer is a word, and a gap between two paragraphs of the author's
        // own prose says nothing about there being an answer to write.
        answer: { kind: 'writingSpace', lines: ANSWER_LINES, ruled: true },
    };
    if (wording) item.extraText = wording;

    return item;
}

export const ChallengeWorksheetAdapter: WorksheetAdapter = {
    ideviceType: 'challenge',
    defaultTitle: 'Challenge',

    build(html: string, options: WorksheetAdapterOptions = {}): PrintableActivity | null {
        const dataGame = extractDataGame<ChallengeDataGame>(html, PREFIX);
        if (!dataGame) return null;

        // The divs are what the asset pass rewrote; the payload's copies are the ones that may
        // have gone stale. Older projects have no divs at all, so each falls back to the payload.
        const mainDiv = extractDivContent(html, `${PREFIX}-EDescription`);
        const challengeDivs = extractDivContents(html, `${PREFIX}-ChallengeDescription`);

        const items: PrintableItem[] = [];
        const main = buildChallenge(dataGame.desafioTitle, mainDiv || dataGame.desafioDescription || '');
        if (main) items.push(main);
        else if (dataGame.desafioTitle !== undefined) options.onOmission?.('invalid-data');

        for (const [index, challenge] of (dataGame.challengesGame ?? []).entries()) {
            const item = buildChallenge(challenge?.title, challengeDivs[index] || challenge?.description || '');
            if (item) items.push(item);
            else options.onOmission?.('invalid-data');
        }

        if (items.length === 0) return null;

        const activity: PrintableActivity = {
            ideviceType: 'challenge',
            title: options.title || ChallengeWorksheetAdapter.defaultTitle,
            items,
            // Each challenge is named by the author, and the main one is not question 1 of a list.
            // Numbering them as well would put a count beside a title that already says which it is.
            unnumbered: true,
        };

        const instructions = sanitizeHtml(
            extractDivContent(html, `${PREFIX}-instructions`) || dataGame.instructionsExe || dataGame.instructions,
        );
        if (instructions) activity.instructions = instructions;

        return activity;
    },
};
