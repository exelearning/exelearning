import { describe, expect, it } from 'bun:test';
import { groupMatchingCards, partitionMatchingRows } from './matchingCards';

describe('groupMatchingCards', () => {
    it('preserves the relation after independently shuffling two, three or four columns', () => {
        for (const columns of [2, 3, 4]) {
            const rows = Array.from({ length: 7 }, (_, row) =>
                Array.from({ length: columns }, (_, column) => ({ text: `${row}:${column}` })),
            );
            let seed = 7;
            const groups = groupMatchingCards(rows, () => (seed = (seed * 9301 + 49297) % 233280) / 233280);
            expect(groups.map(group => group.columns[0].length)).toEqual([5, 2]);
            groups.forEach((group, groupIndex) => {
                group.columns.forEach((column, col) =>
                    column.forEach((card, position) => {
                        expect(card).toBe(rows[groupIndex * 5 + group.rowIndices![col][position]][col]);
                    }),
                );
            });
            expect(groups[0].rowIndices![0]).not.toEqual(groups[0].rowIndices![1]);
        }
    });

    it('handles an empty exercise without inventing a group', () => {
        expect(groupMatchingCards([], Math.random)).toEqual([]);
    });
});

describe('partitionMatchingRows', () => {
    it('uses the tallest column, including the spaces between cards', () => {
        expect(
            partitionMatchingRows(
                [
                    [40, 10],
                    [40, 10],
                    [10, 90],
                ],
                100,
                5,
            ),
        ).toEqual([[0, 1], [2]]);
        expect(
            partitionMatchingRows(
                [
                    [40, 10],
                    [40, 10],
                ],
                80,
                5,
            ),
        ).toEqual([[0], [1]]);
    });

    it('keeps an exact fit together and supports any number of columns', () => {
        expect(
            partitionMatchingRows(
                [
                    [20, 30, 40, 50],
                    [20, 30, 40, 45],
                ],
                100,
                5,
            ),
        ).toEqual([[0, 1]]);
    });

    it('never loses an oversized answer or empty input', () => {
        expect(
            partitionMatchingRows(
                [
                    [120, 20],
                    [30, 30],
                ],
                100,
                5,
            ),
        ).toEqual([[0], [1]]);
        expect(partitionMatchingRows([], 100, 5)).toEqual([]);
    });
});
