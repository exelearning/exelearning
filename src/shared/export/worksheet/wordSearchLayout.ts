/**
 * Word search layout
 *
 * Builds a letter grid with a set of words hidden in it.
 *
 * The Word search iDevice does not store a grid either: it builds one every time the activity
 * loads, with the bundled `wordfind` library, choosing placements at random among the best
 * overlaps. Two plays never share a grid, so there is nothing on screen for a printed one to
 * match, and this builds its own rather than porting the library.
 *
 * It follows the activity where the reader would notice:
 *
 * - Which directions a word may run in comes from the same two settings, and means the same eight
 *   orientations.
 * - Placement prefers overlap, so words cross one another rather than sitting apart.
 * - The grid starts square and grows a row and a column at a time until every word fits.
 * - The blanks are filled from the same alphabet the library uses, which leaves out q, x and z.
 *
 * It departs in one place, deliberately: the library sizes its first attempt from whichever word
 * sorts first alphabetically, which is arbitrary. This starts from the longest word, the smallest
 * grid that could possibly hold them all.
 */

import type { RandomSource } from './questionSelection';

/** A word placed in the grid, with where it starts and which way it runs. */
export interface WordPlacement {
    /** Index of the word in the input array, so callers can match clues back to placements. */
    index: number;
    /** Letters actually placed, after normalisation. */
    letters: string[];
    row: number;
    col: number;
    orientation: Orientation;
}

export interface WordSearchLayout {
    /** The finished grid, every cell filled. */
    rows: string[][];
    /** Where each word ended up. A word that could not be placed is absent. */
    placements: WordPlacement[];
}

export interface WordSearchLayoutOptions {
    /** Whether words may run backwards, as the activity's own setting does. */
    reverses?: boolean;
    /** Whether words may run diagonally. */
    diagonals?: boolean;
    /** How many times the grid may grow before giving up. */
    maxGrowth?: number;
    /** How many words may be left out when nothing else will fit. */
    maxMissing?: number;
    randomSource?: RandomSource;
}

/** The eight ways a word can run, as the library names them. */
export type Orientation =
    | 'horizontal'
    | 'horizontalBack'
    | 'vertical'
    | 'verticalUp'
    | 'diagonal'
    | 'diagonalUp'
    | 'diagonalBack'
    | 'diagonalUpBack';

/** Row and column step for each orientation. */
const STEPS: Record<Orientation, { row: number; col: number }> = {
    horizontal: { row: 0, col: 1 },
    horizontalBack: { row: 0, col: -1 },
    vertical: { row: 1, col: 0 },
    verticalUp: { row: -1, col: 0 },
    diagonal: { row: 1, col: 1 },
    diagonalUp: { row: -1, col: 1 },
    diagonalBack: { row: 1, col: -1 },
    diagonalUpBack: { row: -1, col: -1 },
};

/**
 * Letters the blanks are filled with.
 *
 * The same set the library uses, which leaves out q, x and z — they would stand out in a grid
 * and give a scanning eye something to catch on.
 */
const FILLER = 'ABCDEFGHIJKLMNOPRSTUVWY';

/** How many times the grid may grow before the search is abandoned. */
const DEFAULT_MAX_GROWTH = 10;

/** How many words may be given up when nothing else will fit, as the activity gives up its own. */
const DEFAULT_MAX_MISSING = 3;

/** Smallest grid worth printing, whatever the words. */
const MIN_SIZE = 5;

/**
 * Reduce a stored word to the letters that go in the grid.
 *
 * The editor already forbids spaces and caps the length, so this only settles the case: a printed
 * grid is read in capitals, which is how the activity displays it too.
 */
export function normaliseSearchWord(word: string | undefined): string[] {
    return [...(word ?? '').replace(/\s+/g, '').toUpperCase()];
}

/** Which directions are allowed, from the activity's two settings. */
export function allowedOrientations(options: WordSearchLayoutOptions): Orientation[] {
    const orientations: Orientation[] = ['horizontal', 'vertical'];

    if (options.diagonals) orientations.push('diagonal', 'diagonalUp');
    if (options.reverses) orientations.push('horizontalBack', 'verticalUp');
    if (options.diagonals && options.reverses) orientations.push('diagonalBack', 'diagonalUpBack');

    return orientations;
}

/**
 * Score a placement: how many letters it shares with what is already there.
 *
 * @returns The number of overlaps, or -1 when the word runs off the grid or contradicts a letter
 */
function scorePlacement(
    grid: (string | null)[][],
    letters: string[],
    row: number,
    col: number,
    orientation: Orientation,
): number {
    const size = grid.length;
    const step = STEPS[orientation];
    let overlaps = 0;

    for (let offset = 0; offset < letters.length; offset++) {
        const r = row + step.row * offset;
        const c = col + step.col * offset;

        if (r < 0 || c < 0 || r >= size || c >= size) return -1;

        const occupant = grid[r][c];
        if (occupant === null) continue;
        if (occupant !== letters[offset]) return -1;
        overlaps++;
    }

    return overlaps;
}

/** Write a word onto the grid. */
function write(grid: (string | null)[][], letters: string[], row: number, col: number, orientation: Orientation): void {
    const step = STEPS[orientation];
    letters.forEach((letter, offset) => {
        grid[row + step.row * offset][col + step.col * offset] = letter;
    });
}

/**
 * Try to place every word in a grid of the given size.
 *
 * @returns The placements, or null when some word found nowhere to go
 */
function tryLayout(
    words: { letters: string[]; index: number }[],
    size: number,
    orientations: Orientation[],
    random: RandomSource,
): { grid: (string | null)[][]; placements: WordPlacement[] } | null {
    const grid: (string | null)[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => null));
    const placements: WordPlacement[] = [];

    // Longest first: the hardest word to seat goes into the emptiest grid.
    const order = [...words].sort((a, b) => b.letters.length - a.letters.length);

    for (const { letters, index } of order) {
        // Every position in every allowed direction, keeping those that overlap the most.
        let best = -1;
        let candidates: WordPlacement[] = [];

        for (const orientation of orientations) {
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const overlaps = scorePlacement(grid, letters, row, col, orientation);
                    if (overlaps < 0) continue;

                    if (overlaps > best) {
                        best = overlaps;
                        candidates = [];
                    }
                    if (overlaps === best) candidates.push({ index, letters, row, col, orientation });
                }
            }
        }

        if (candidates.length === 0) return null;

        const chosen = candidates[Math.floor(random() * candidates.length) % candidates.length];
        write(grid, chosen.letters, chosen.row, chosen.col, chosen.orientation);
        placements.push(chosen);
    }

    return { grid, placements };
}

/**
 * Build a word search grid.
 *
 * @param words - The answers to hide, in clue order
 * @param options - The activity's direction settings and the solver's budget
 * @returns The filled grid and where each word was placed
 */
export function buildWordSearchLayout(
    words: (string | undefined)[],
    options: WordSearchLayoutOptions = {},
): WordSearchLayout {
    const random = options.randomSource ?? Math.random;
    const entries = words
        .map((word, index) => ({ letters: normaliseSearchWord(word), index }))
        .filter(entry => entry.letters.length > 0);

    if (entries.length === 0) return { rows: [], placements: [] };

    const orientations = allowedOrientations(options);
    const maxGrowth = options.maxGrowth ?? DEFAULT_MAX_GROWTH;
    const maxMissing = Math.min(options.maxMissing ?? DEFAULT_MAX_MISSING, entries.length - 1);

    // Longest first, so a set that will not fit gives up its longest word first — which is both
    // what frees the most room and what the activity does when its own generator gives up.
    const byLength = [...entries].sort((a, b) => b.letters.length - a.letters.length);

    for (let missing = 0; missing <= maxMissing; missing++) {
        const kept = byLength.slice(missing);
        const longest = kept[0]?.letters.length ?? 0;

        // Start at the smallest grid that could hold the longest word, and grow until it all fits.
        for (let growth = 0; growth <= maxGrowth; growth++) {
            const attempt = tryLayout(kept, Math.max(longest, MIN_SIZE) + growth, orientations, random);
            if (!attempt) continue;

            return {
                rows: attempt.grid.map(row => row.map(cell => cell ?? FILLER[Math.floor(random() * FILLER.length)])),
                placements: attempt.placements,
            };
        }
    }

    return { rows: [], placements: [] };
}
