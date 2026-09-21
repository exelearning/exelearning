/**
 * Blocking a matching exercise so no answer straddles a page break
 *
 * Paper has pages, and cards that belong together but land on different sheets cannot be joined
 * with a line. Every joining exercise therefore comes out in blocks, each one self-contained: a
 * card's partners are always in the block beside it.
 *
 * How many answers fit a block cannot be known here. A card's height depends on its font, its
 * picture and how much the author wrote, none of which exists until a browser has laid the sheet
 * out. So this module does the half that is knowable — grouping and shuffling without losing
 * track of which cards belong together — and `matchingLayout` measures the rest in the document
 * and re-partitions against real heights.
 *
 * `rowIndices` is what carries the relation across that boundary: once each column is shuffled on
 * its own, nothing in the cards themselves says which ones were a pair.
 */

import { shuffleWith, type RandomSource } from './questionSelection';
import type { PrintableCard, PrintableCardGroup } from './types';

/**
 * How many answers a block starts with, before the document is measured.
 *
 * A first guess rather than a limit: `matchingLayout` re-partitions against the heights it finds,
 * so this only has to be a sensible number of cards to lay out, not a number that always fits.
 */
const ANSWERS_PER_BLOCK = 5;

/** Keep the matching relation while independently shuffling each column. */
export function groupMatchingCards(rows: PrintableCard[][], random: RandomSource): PrintableCardGroup[] {
    const groups: PrintableCardGroup[] = [];
    for (let start = 0; start < rows.length; start += ANSWERS_PER_BLOCK) {
        const group = rows.slice(start, start + ANSWERS_PER_BLOCK);
        const rowIndices = group[0].map(() =>
            shuffleWith(
                group.map((_, index) => index),
                random,
            ),
        );
        groups.push({
            columns: rowIndices.map((indices, column) => indices.map(index => group[index][column])),
            rowIndices,
        });
    }
    return groups;
}

/** Partition complete answers using measured card heights; never split a matching relation. */
export function partitionMatchingRows(heights: number[][], available: number, gap: number): number[][] {
    const groups: number[][] = [];
    let current: number[] = [];
    let totals: number[] = [];
    heights.forEach((row, index) => {
        const next = row.map((height, column) => (totals[column] || 0) + height + (current.length ? gap : 0));
        if (current.length && next.some(height => height > available)) {
            groups.push(current);
            current = [];
            totals = [];
        }
        totals = row.map((height, column) => (totals[column] || 0) + height + (current.length ? gap : 0));
        current.push(index);
    });
    if (current.length) groups.push(current);
    return groups;
}
