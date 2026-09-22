/**
 * Challenge ('challenge') worksheet adapter
 *
 * Turns a Challenge activity into the sheet it already is underneath: a challenge to solve, the
 * smaller ones that lead up to it, each under the activity's own name for it, and room to write
 * each answer.
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
 * - The activity's own word for a smaller challenge is in `msgs.msgChallenge`, where the author may
 *   have changed it, and its runtime numbers them from one. The sheet says the same, so a project
 *   calling them Retos does not become a sheet calling them Trials.
 * - `instructionsExe` is stored raw here, where most of the family `escape()`s it. Unescaping it
 *   would rewrite a literal `%41` in an author's instructions into an `A`.
 * - `desafioType` is 0 linear or 1 free. It changes nothing on paper: every challenge is there to
 *   be read whatever order the screen would have released them in.
 * - `clues` are timed, and the clock is the only thing that hands them over. A sheet has no clock,
 *   and printing them all would answer the questions it is asking, so they are left out.
 * - No solution is ever printed: the space for it is what the student fills in.
 */

import { extractDataGame, extractDivContent, extractDivContents } from '../dataGameReader';
import { escapeText, sanitizeHtml } from '../sanitizeHtml';
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
    /** The activity's own wording, which the author can edit. */
    msgs?: { msgChallenge?: string };
}

/**
 * Build one challenge: what it is called, its wording, then the room to answer in.
 *
 * The heading is marked as one. Nothing else on the sheet would say so — the challenges are not
 * numbered by the list they sit in, and a title set in the same type as the paragraphs under it
 * reads as the first line of them.
 *
 * @param title - The challenge's own title
 * @param description - Its wording, already chosen between the div and the payload
 * @param label - What to call it before its title, for the smaller challenges
 * @returns The item, or null when there is neither a title nor a description to print
 */
function buildChallenge(title: string | undefined, description: string, label = ''): PrintableItem | null {
    const name = sanitizeHtml(title);
    const wording = sanitizeHtml(description);

    // A challenge with no words at all is a heading over an empty space.
    if (!name && !wording) return null;

    const heading = [label, name].filter(part => part !== '').join(' ');
    const item: PrintableItem = {
        prompt: heading ? `<strong class="worksheet-challenge-title">${heading}</strong>` : '',
        answer: { kind: 'writingSpace', lines: ANSWER_LINES },
    };
    if (wording) item.extraText = wording;

    return item;
}

/**
 * What to call the smaller challenge in position `index`.
 *
 * The activity's own word for one, numbered the way its own runtime numbers them, and the number
 * alone where the activity names none — inventing a word here would need a translation for
 * something the activity already translates.
 */
function challengeLabel(word: string, index: number): string {
    return word ? `${escapeText(word)} ${index + 1}.` : `${index + 1}.`;
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

        const word = (dataGame.msgs?.msgChallenge ?? '').trim();
        for (const [index, challenge] of (dataGame.challengesGame ?? []).entries()) {
            const item = buildChallenge(
                challenge?.title,
                challengeDivs[index] || challenge?.description || '',
                challengeLabel(word, index),
            );
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
