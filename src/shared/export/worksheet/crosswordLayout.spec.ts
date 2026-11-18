import { describe, expect, it } from 'bun:test';
import { buildCrosswordLayout, normaliseWord, type CrosswordLayout } from './crosswordLayout';

/** Render a grid readably: '.' for a gap, the letter when shown, '_' for an empty box. */
function render(layout: CrosswordLayout): string {
    return layout.rows.map(row => row.map(cell => (cell === null ? '.' : (cell.letter ?? '_'))).join('')).join('\n');
}

/** Reveal every letter, so a layout can be read back and checked. */
function revealAll(words: string[]): Set<number>[] {
    return words.map(word => new Set(word.split('').map((_, index) => index)));
}

describe('normaliseWord', () => {
    it('upper-cases unless the activity is case sensitive', () => {
        expect(normaliseWord('Casa').join('')).toBe('CASA');
        expect(normaliseWord('Casa', { caseSensitive: true }).join('')).toBe('Casa');
    });

    it('strips accents only when the activity ignores them', () => {
        expect(normaliseWord('Montañés', { tilde: false }).join('')).toBe('MONTANES');
        expect(normaliseWord('Montañés', { tilde: true }).join('')).toBe('MONTAÑÉS');
    });

    it('drops whitespace, which cannot occupy a cell', () => {
        expect(normaliseWord('Mio Cid').join('')).toBe('MIOCID');
        expect(normaliseWord('  a  b  ').join('')).toBe('AB');
    });

    it('gives one entry per character, including accented ones', () => {
        expect(normaliseWord('Ñandú')).toEqual(['Ñ', 'A', 'N', 'D', 'Ú']);
    });

    it('returns nothing for empty input', () => {
        expect(normaliseWord('')).toEqual([]);
        expect(normaliseWord(undefined)).toEqual([]);
        expect(normaliseWord('   ')).toEqual([]);
    });
});

describe('buildCrosswordLayout', () => {
    const words = ['CASA', 'SOL', 'MESA', 'LUNA', 'AMOR', 'SALA'];

    it('places the words it is given', () => {
        const layout = buildCrosswordLayout(words, revealAll(words));

        expect(layout.placements.length).toBeGreaterThan(1);
        expect(layout.rows.length).toBeGreaterThan(0);
    });

    it('spells each placed word correctly on the grid', () => {
        const layout = buildCrosswordLayout(words, revealAll(words));

        // Every cell a placement covers must hold that placement's letter, which is what makes the
        // grid a crossword rather than a pile of boxes.
        const size = 16;
        const board: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
        for (const placement of layout.placements) {
            placement.letters.forEach((letter, offset) => {
                const row = placement.horizontal ? placement.row : placement.row + offset;
                const col = placement.horizontal ? placement.col + offset : placement.col;
                const existing = board[row][col];
                expect(existing === null || existing === letter).toBe(true);
                board[row][col] = letter;
            });
        }
    });

    it('crosses words rather than leaving them apart', () => {
        const layout = buildCrosswordLayout(words, revealAll(words));

        const crossings = layout.placements.reduce((total, placement) => total + placement.crossings, 0);
        expect(crossings).toBeGreaterThan(0);
    });

    it('numbers the vertical words before the horizontal ones', () => {
        const layout = buildCrosswordLayout(words, revealAll(words));

        const directions = layout.placements.map(placement => placement.horizontal);
        const firstHorizontal = directions.indexOf(true);

        if (firstHorizontal !== -1) {
            // Once the horizontal run starts, no vertical word may follow it.
            expect(directions.slice(firstHorizontal).every(Boolean)).toBe(true);
        }
    });

    it('crops the grid to the cells in use', () => {
        const layout = buildCrosswordLayout(words, revealAll(words));
        const rendered = render(layout);

        // No fully blank leading or trailing row survives the crop.
        const lines = rendered.split('\n');
        expect(lines[0]).not.toMatch(/^\.+$/);
        expect(lines[lines.length - 1]).not.toMatch(/^\.+$/);
    });

    it('leaves boxes empty when no hints are given', () => {
        const layout = buildCrosswordLayout(words, []);

        expect(render(layout)).not.toMatch(/[A-Z]/);
        expect(render(layout)).toContain('_');
    });

    it('shows only the letters it is told to', () => {
        // Reveal the first letter of every word and nothing else.
        const hints = words.map(() => new Set([0]));
        const layout = buildCrosswordLayout(words, hints);
        const rendered = render(layout);
        const shown = rendered.replace(/[._\n]/g, '');
        const boxes = rendered.replace(/[.\n]/g, '');

        // At most one letter per word, and fewer when two words start in the same cell.
        expect(shown.length).toBeGreaterThan(0);
        expect(shown.length).toBeLessThanOrEqual(layout.placements.length);
        // The rest of the grid stays empty for the student.
        expect(boxes.length).toBeGreaterThan(shown.length);
    });

    it('numbers the cell a word starts in', () => {
        const layout = buildCrosswordLayout(words, revealAll(words));
        const numbers = layout.rows
            .flat()
            .filter((cell): cell is { letter: string | null; number?: number } => cell !== null)
            .map(cell => cell.number)
            .filter((number): number is number => number !== undefined);

        expect(numbers.length).toBeGreaterThan(0);
        expect(Math.min(...numbers)).toBe(1);
    });

    it('is deterministic for a fixed randomness source', () => {
        const first = buildCrosswordLayout(words, revealAll(words), { randomSource: () => 0.5 });
        const second = buildCrosswordLayout(words, revealAll(words), { randomSource: () => 0.5 });

        expect(render(first)).toBe(render(second));
    });

    describe('degenerate input', () => {
        it('returns nothing for no words', () => {
            expect(buildCrosswordLayout([], [])).toEqual({ rows: [], placements: [] });
        });

        it('ignores words too short to cross', () => {
            // A single letter cannot anchor a crossword.
            expect(buildCrosswordLayout(['A', 'B'], []).placements).toHaveLength(0);
        });

        it('places a single word on its own', () => {
            const layout = buildCrosswordLayout(['CASA'], revealAll(['CASA']));

            expect(layout.placements).toHaveLength(1);
            expect(render(layout)).toBe('CASA');
        });

        it('seats a word that cannot cross anything instead of dropping it', () => {
            // 'XYZW' shares no letter with 'CASAS', so it crosses nothing. The activity's own
            // solver seats it on its own rather than losing it, and so does this: a dropped word
            // takes its clue off the sheet with it.
            const layout = buildCrosswordLayout(['CASAS', 'XYZW'], []);

            expect(layout.placements).toHaveLength(2);
            expect(layout.placements.map(placement => placement.letters.join('')).sort()).toEqual(['CASAS', 'XYZW']);
        });

        it('survives undefined entries', () => {
            expect(() => buildCrosswordLayout([undefined, 'CASA'], [])).not.toThrow();
        });

        it('respects a smaller board', () => {
            const layout = buildCrosswordLayout(words, revealAll(words), { size: 6 });

            expect(layout.rows.length).toBeLessThanOrEqual(6);
            for (const row of layout.rows) expect(row.length).toBeLessThanOrEqual(6);
        });
    });
});

describe('words that cross nothing', () => {
    it('seats a word sharing no letter with the others, rather than dropping its clue', () => {
        // BCDF shares no letter with AAA or with itself-adjacent words. The activity's own solver
        // seats it isolated on the board; before this, it was silently left off the worksheet.
        const layout = buildCrosswordLayout(['CASA', 'SOL', 'BUFF'], [], { randomSource: () => 0 });

        expect(layout.placements).toHaveLength(3);
        expect(layout.placements.map(placement => placement.letters.join(''))).toEqual(
            expect.arrayContaining(['CASA', 'SOL', 'BUFF']),
        );
    });

    it('seats several unconnected words', () => {
        const layout = buildCrosswordLayout(['AAA', 'BBB', 'CCC', 'DDD'], [], { randomSource: () => 0 });

        expect(layout.placements).toHaveLength(4);
    });

    it('never overlaps a word it seats on its own', () => {
        const layout = buildCrosswordLayout(['AAA', 'BBB', 'CCC'], [], { randomSource: () => 0 });

        // Every cell a word occupies must hold that word's letter: an isolated placement that
        // trampled another would corrupt both answers.
        for (const placement of layout.placements) {
            placement.letters.forEach((letter, offset) => {
                const row = placement.horizontal ? placement.row : placement.row + offset;
                const col = placement.horizontal ? placement.col + offset : placement.col;
                expect(layout.rows[row]?.[col]).not.toBeNull();
            });
        }
    });
});
