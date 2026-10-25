import { describe, expect, it } from 'bun:test';
import {
    allowedOrientations,
    buildWordSearchLayout,
    normaliseSearchWord,
    type Orientation,
    type WordSearchLayout,
} from './wordSearchLayout';

/** Read a placed word back off the grid, following its own direction. */
function readBack(layout: WordSearchLayout, index: number): string {
    const placement = layout.placements.find(entry => entry.index === index);
    if (!placement) return '';

    const steps: Record<Orientation, { row: number; col: number }> = {
        horizontal: { row: 0, col: 1 },
        horizontalBack: { row: 0, col: -1 },
        vertical: { row: 1, col: 0 },
        verticalUp: { row: -1, col: 0 },
        diagonal: { row: 1, col: 1 },
        diagonalUp: { row: -1, col: 1 },
        diagonalBack: { row: 1, col: -1 },
        diagonalUpBack: { row: -1, col: -1 },
    };
    const step = steps[placement.orientation];

    return placement.letters
        .map((_, offset) => layout.rows[placement.row + step.row * offset][placement.col + step.col * offset])
        .join('');
}

describe('normaliseSearchWord', () => {
    it('reads a word in capitals, as the grid displays it', () => {
        expect(normaliseSearchWord('Perro').join('')).toBe('PERRO');
    });

    it('drops whitespace, which cannot occupy a cell', () => {
        // The editor forbids spaces, but an imported project need not have obeyed it.
        expect(normaliseSearchWord(' mio  cid ').join('')).toBe('MIOCID');
    });

    it('gives one entry per character, including accented ones', () => {
        expect(normaliseSearchWord('Ñandú')).toEqual(['Ñ', 'A', 'N', 'D', 'Ú']);
    });

    it('returns nothing for empty input', () => {
        expect(normaliseSearchWord('')).toEqual([]);
        expect(normaliseSearchWord(undefined)).toEqual([]);
        expect(normaliseSearchWord('   ')).toEqual([]);
    });
});

describe('allowedOrientations', () => {
    it('runs words across and down when the activity allows nothing else', () => {
        expect(allowedOrientations({})).toEqual(['horizontal', 'vertical']);
    });

    it('adds the diagonals when the activity allows them', () => {
        expect(allowedOrientations({ diagonals: true })).toEqual(['horizontal', 'vertical', 'diagonal', 'diagonalUp']);
    });

    it('adds the backwards runs when the activity allows them', () => {
        expect(allowedOrientations({ reverses: true })).toEqual([
            'horizontal',
            'vertical',
            'horizontalBack',
            'verticalUp',
        ]);
    });

    it('allows all eight when the activity allows both', () => {
        expect(allowedOrientations({ diagonals: true, reverses: true })).toHaveLength(8);
    });
});

describe('buildWordSearchLayout', () => {
    const words = ['CASA', 'SOL', 'MESA', 'LUNA'];

    it('hides every word in the grid', () => {
        const layout = buildWordSearchLayout(words);

        expect(layout.placements).toHaveLength(words.length);
        for (let index = 0; index < words.length; index++) expect(readBack(layout, index)).toBe(words[index]);
    });

    it('fills every cell, so a hidden word reads like its neighbours', () => {
        const layout = buildWordSearchLayout(words);

        expect(layout.rows.length).toBeGreaterThan(0);
        for (const row of layout.rows) {
            expect(row).toHaveLength(layout.rows.length);
            for (const cell of row) expect(cell).toMatch(/^[A-ZÀ-Ÿ]$/);
        }
    });

    it('fills the blanks from the alphabet the activity uses', () => {
        // The same set the library fills with, which leaves out q, x and z.
        const layout = buildWordSearchLayout(['AB'], { randomSource: () => 0.999 });
        const filled = layout.rows.flat().join('');

        expect(filled).not.toMatch(/[QXZ]/);
    });

    it('only runs words in the directions the activity allows', () => {
        const layout = buildWordSearchLayout(words, { reverses: false, diagonals: false });

        for (const placement of layout.placements) {
            expect(['horizontal', 'vertical']).toContain(placement.orientation);
        }
    });

    it('grows the grid until the words fit', () => {
        // Four eight-letter words cannot all sit in an eight by eight grid without crossing
        // badly, so the grid has to grow past the longest word.
        const long = ['ABCDEFGH', 'IJKLMNOP', 'RSTUVWYB', 'CDEFGHIJ'];
        const layout = buildWordSearchLayout(long);

        expect(layout.placements).toHaveLength(4);
        expect(layout.rows.length).toBeGreaterThanOrEqual(8);
    });

    it('keeps the grid no smaller than a puzzle worth printing', () => {
        expect(buildWordSearchLayout(['AB']).rows.length).toBeGreaterThanOrEqual(5);
    });

    it('is deterministic for a fixed randomness source', () => {
        const first = buildWordSearchLayout(words, { randomSource: () => 0.5 });
        const second = buildWordSearchLayout(words, { randomSource: () => 0.5 });

        expect(first.rows).toEqual(second.rows);
    });

    /**
     * Words that can never cross: each is one letter repeated, so any crossing contradicts a
     * letter already placed. In a grid of five rows and no room to grow, five of them fit and a
     * sixth cannot go anywhere.
     */
    const uncrossable = (count: number) => Array.from({ length: count }, (_, index) => 'ABCDEFGHIJ'[index].repeat(5));

    it('gives up a word rather than the whole puzzle', () => {
        const layout = buildWordSearchLayout(uncrossable(6), { maxGrowth: 0 });

        expect(layout.placements).toHaveLength(5);
        expect(layout.rows).toHaveLength(5);
    });

    describe('degenerate input', () => {
        it('returns nothing for no words', () => {
            expect(buildWordSearchLayout([])).toEqual({ rows: [], placements: [] });
        });

        it('ignores entries with no letters in them', () => {
            const layout = buildWordSearchLayout([undefined, '', '   ', 'CASA']);

            expect(layout.placements).toHaveLength(1);
            expect(readBack(layout, 3)).toBe('CASA');
        });

        it('returns nothing when it may give up no word and the set will not fit', () => {
            const layout = buildWordSearchLayout(uncrossable(6), { maxGrowth: 0, maxMissing: 0 });

            expect(layout).toEqual({ rows: [], placements: [] });
        });
    });
});
