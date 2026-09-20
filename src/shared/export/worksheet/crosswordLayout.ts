/**
 * Crossword layout
 *
 * Arranges a set of words into a printable crossword grid.
 *
 * The Crossword iDevice does not store a grid: it builds one when the activity loads, shuffling
 * the words and keeping the best of twenty randomised attempts
 * (`generateLayout` in public/files/perm/idevices/base/crossword/export/crossword.js). Two plays
 * of the same activity therefore never share a layout, so there is nothing on screen for a
 * printed grid to match. Rather than port four hundred lines of solver to chase a layout that is
 * random anyway, this builds its own: a compact greedy placer whose job is a valid, well-crossed
 * grid that fits on paper.
 *
 * It follows the iDevice where the reader would notice: clue numbering runs down the vertical
 * words first and then the horizontal ones, the same convention the activity uses.
 */

import type { CrosswordCell } from './types';
import type { RandomSource } from './questionSelection';

/** A word placed on the grid, with the coordinates it occupies. */
export interface Placement {
    /** Index of the word in the input array, so callers can match clues back to placements. */
    index: number;
    /** Shared by clues starting in the same cell. */
    number: number;
    /** Letters actually placed, after normalisation. */
    letters: string[];
    row: number;
    col: number;
    horizontal: boolean;
    /** How many letters this word shares with words already on the grid. */
    crossings: number;
}

export interface CrosswordLayout {
    /** The grid, cropped to the cells actually used. */
    rows: CrosswordCell[][];
    /** Placements in clue-number order: verticals first, then horizontals. */
    placements: Placement[];
}

export interface CrosswordLayoutOptions {
    /** Whether the activity distinguishes case. Words are upper-cased when it does not. */
    caseSensitive?: boolean;
    /** Whether accents count as distinct letters. When false they are stripped. */
    tilde?: boolean;
    /** How many randomised attempts to make. More attempts, better crossings. */
    attempts?: number;
    /** Largest grid to work in, matching the iDevice's own board. */
    size?: number;
    /**
     * Whether to trim the empty margin around the placed words. Defaults to true.
     *
     * Must be false when a background picture is drawn behind the grid: the cells only line up
     * with the picture at their original board coordinates.
     */
    crop?: boolean;
    randomSource?: RandomSource;
}

const DEFAULT_SIZE = 16;
const DEFAULT_ATTEMPTS = 20;

/** Unicode combining diacritical marks, stripped when the activity ignores accents. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Reduce a stored answer to the letters that go in the boxes.
 *
 * Whitespace cannot occupy a crossword cell, so it is dropped rather than collapsed. Accents are
 * stripped only when the activity itself ignores them, so that a cell shared by two words never
 * shows a letter that contradicts one of them.
 *
 * @returns One entry per box, empty when the word cannot be placed at all
 */
export function normaliseWord(word: string | undefined, options: CrosswordLayoutOptions = {}): string[] {
    if (!word) return [];

    let text = options.caseSensitive ? word : word.toUpperCase();
    if (options.tilde === false) {
        text = text.normalize('NFD').replace(COMBINING_MARKS, '').normalize('NFC');
    }

    return [...text.replace(/\s+/g, '')];
}

/**
 * Shuffle a copy of the list with Fisher-Yates.
 */
function shuffled<T>(items: T[], random: RandomSource): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/** Scratch grid of letters, null where nothing is placed yet. */
type Scratch = ({ letter: string; horizontal: boolean; vertical: boolean } | null)[][];

function emptyScratch(size: number): Scratch {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => null));
}

/**
 * Check whether a word fits at a position, and count the letters it would share.
 *
 * A placement is legal when every cell either is empty or already holds the same letter, and when
 * the word neither runs into a neighbour end to end nor sits alongside a parallel word. That last
 * rule is what stops two words from touching down their whole length and spelling nonsense across.
 *
 * @returns The number of crossings, or -1 when the word does not fit
 */
function scorePlacement(grid: Scratch, letters: string[], row: number, col: number, horizontal: boolean): number {
    const size = grid.length;
    const endRow = horizontal ? row : row + letters.length - 1;
    const endCol = horizontal ? col + letters.length - 1 : col;

    if (row < 0 || col < 0 || endRow >= size || endCol >= size) return -1;

    // The cells just before and just after the word must be free, or it would run into a neighbour.
    const beforeRow = horizontal ? row : row - 1;
    const beforeCol = horizontal ? col - 1 : col;
    const afterRow = horizontal ? row : endRow + 1;
    const afterCol = horizontal ? endCol + 1 : col;
    if (beforeRow >= 0 && beforeCol >= 0 && grid[beforeRow][beforeCol] !== null) return -1;
    if (afterRow < size && afterCol < size && grid[afterRow][afterCol] !== null) return -1;

    let crossings = 0;

    for (let offset = 0; offset < letters.length; offset++) {
        const r = horizontal ? row : row + offset;
        const c = horizontal ? col + offset : col;
        const occupant = grid[r][c];

        if (occupant !== null) {
            if (occupant.letter !== letters[offset] || (horizontal ? occupant.horizontal : occupant.vertical))
                return -1;
            crossings++;
            continue;
        }

        // An empty cell must not have parallel neighbours, which would glue two words side by side.
        const sideA = horizontal ? grid[r - 1]?.[c] : grid[r]?.[c - 1];
        const sideB = horizontal ? grid[r + 1]?.[c] : grid[r]?.[c + 1];
        if (sideA != null || sideB != null) return -1;
    }

    return crossings;
}

/**
 * Write a word onto a scratch grid.
 */
function write(grid: Scratch, letters: string[], row: number, col: number, horizontal: boolean): void {
    letters.forEach((letter, offset) => {
        const r = horizontal ? row : row + offset;
        const c = horizontal ? col + offset : col;
        const existing = grid[r][c];
        grid[r][c] = {
            letter,
            horizontal: horizontal || existing?.horizontal === true,
            vertical: !horizontal || existing?.vertical === true,
        };
    });
}

/**
 * Find the best position for a word among the letters already on the grid.
 *
 * @returns The placement, or null when the word cannot cross anything already placed
 */
function bestPlacement(grid: Scratch, letters: string[], index: number, size: number): Placement | null {
    let best: Placement | null = null;

    for (let offset = 0; offset < letters.length; offset++) {
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (grid[row][col]?.letter !== letters[offset]) continue;

                for (const horizontal of [true, false]) {
                    const startRow = horizontal ? row : row - offset;
                    const startCol = horizontal ? col - offset : col;
                    const crossings = scorePlacement(grid, letters, startRow, startCol, horizontal);

                    if (crossings > 0 && (best === null || crossings > best.crossings)) {
                        best = { index, number: 0, letters, row: startRow, col: startCol, horizontal, crossings };
                    }
                }
            }
        }
    }

    return best;
}

/**
 * Run one greedy pass: seed the longest word in the middle, then place the rest at their best
 * crossing.
 */
function attemptLayout(words: string[][], size: number, random: RandomSource): Placement[] {
    // Shuffling before the length sort varies which equal-length word seeds the grid, so repeated
    // attempts explore genuinely different layouts.
    const order = shuffled(
        words.map((letters, index) => ({ letters, index })),
        random,
    )
        .filter(entry => entry.letters.length > 1 && entry.letters.length <= size)
        .sort((a, b) => b.letters.length - a.letters.length);

    if (order.length === 0) return [];

    const grid = emptyScratch(size);
    const seed = order[0];
    const seedRow = Math.floor(size / 2);
    const seedCol = Math.max(0, Math.floor((size - seed.letters.length) / 2));

    if (scorePlacement(grid, seed.letters, seedRow, seedCol, true) < 0) return [];

    write(grid, seed.letters, seedRow, seedCol, true);
    const placements: Placement[] = [
        {
            index: seed.index,
            number: 0,
            letters: seed.letters,
            row: seedRow,
            col: seedCol,
            horizontal: true,
            crossings: 0,
        },
    ];

    for (const entry of order.slice(1)) {
        const placement = bestPlacement(grid, entry.letters, entry.index, size);
        if (!placement) continue;

        write(grid, placement.letters, placement.row, placement.col, placement.horizontal);
        placements.push(placement);
    }

    return placements;
}

/**
 * Build a crossword grid from a set of answers.
 *
 * Words that cannot be crossed into the grid are left out; callers should print clues only for
 * the placements they get back.
 *
 * @param words - Stored answers, in clue order
 * @param revealed - Per word, the letter offsets to print as hints
 * @param options - Activity settings and solver budget
 * @returns The cropped grid and its placements, numbered verticals first
 */
export function buildCrosswordLayout(
    words: (string | undefined)[],
    revealed: Set<number>[] = [],
    options: CrosswordLayoutOptions = {},
): CrosswordLayout {
    const size = options.size ?? DEFAULT_SIZE;
    const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
    const random = options.randomSource ?? Math.random;
    const normalised = words.map(word => normaliseWord(word, options));

    let best: Placement[] = [];
    let bestScore = -1;

    for (let attempt = 0; attempt < attempts; attempt++) {
        const placements = attemptLayout(normalised, size, random);
        // Seating more words matters more than crossing them well, so it dominates the score.
        const crossings = placements.reduce((total, placement) => total + placement.crossings, 0);
        const score = placements.length * 1000 + crossings;

        if (score > bestScore) {
            best = placements;
            bestScore = score;
        }
    }

    if (best.length === 0) return { rows: [], placements: [] };

    // Vertical clues are numbered first, then horizontal ones, as the iDevice does.
    const ordered = [...best.filter(p => !p.horizontal), ...best.filter(p => p.horizontal)];
    const starts = new Map<string, number>();
    for (const placement of ordered) {
        const key = `${placement.row}:${placement.col}`;
        if (!starts.has(key)) starts.set(key, starts.size + 1);
        placement.number = starts.get(key)!;
    }

    return { rows: buildGrid(ordered, size, revealed, options.crop !== false), placements: ordered };
}

/**
 * Paint the placements onto a grid and crop it to the cells in use.
 *
 * Cropping matters on paper: the solver works in a 16x16 board, and printing the empty margin
 * would waste most of the page.
 */
function buildGrid(
    placements: Placement[],
    size: number,
    revealed: Set<number>[],
    shouldCrop: boolean,
): CrosswordCell[][] {
    const cells: CrosswordCell[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => null as CrosswordCell),
    );

    placements.forEach(placement => {
        const hints = revealed[placement.index] ?? new Set<number>();

        placement.letters.forEach((letter, offset) => {
            const row = placement.horizontal ? placement.row : placement.row + offset;
            const col = placement.horizontal ? placement.col + offset : placement.col;
            const existing = cells[row][col];

            // A crossing cell keeps a hint either word gives it, and the lower clue number.
            cells[row][col] = {
                letter: hints.has(offset) ? letter : (existing?.letter ?? null),
                number: offset === 0 ? placement.number : existing?.number,
            };
        });
    });

    return shouldCrop ? crop(cells) : cells;
}

/**
 * Trim the empty margin around the placed words.
 */
function crop(cells: CrosswordCell[][]): CrosswordCell[][] {
    let top = cells.length;
    let bottom = -1;
    let left = cells.length;
    let right = -1;

    cells.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell === null) return;
            top = Math.min(top, rowIndex);
            bottom = Math.max(bottom, rowIndex);
            left = Math.min(left, colIndex);
            right = Math.max(right, colIndex);
        });
    });

    if (bottom < 0) return [];

    return cells.slice(top, bottom + 1).map(row => row.slice(left, right + 1));
}
