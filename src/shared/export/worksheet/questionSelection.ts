/**
 * Question selection and letter hints
 *
 * A gamified activity rarely asks everything it stores. It asks a percentage of its questions,
 * optionally in random order, and gives away a percentage of each solution's letters as a hint.
 * A worksheet has to honour all three, or the printed exercise is not the activity the teacher
 * configured.
 *
 * These are deliberate mirrors of the runtime, which is the behaviour a teacher actually sees:
 * - `selectQuestions` mirrors `$exeDevices.iDevice.gamification.helpers.getQuestions`
 *   (public/app/common/common.js).
 * - `buildAnswerBoxes` mirrors `$guess.getShowLetter` + `$guess.drawPhrase`
 *   (public/files/perm/idevices/base/guess/export/guess.js).
 *
 * They cannot import those directly: this module also runs under Bun for CLI exports, where the
 * browser runtime does not exist. The same mirroring pattern is used by ServerLatexPreRenderer.
 */

import type { CharacterBoxGroup } from './types';

/** A source of randomness in [0, 1), injectable so callers can make output deterministic. */
export type RandomSource = () => number;

/**
 * Shuffle in place with Fisher-Yates, matching `helpers.shuffleAds`.
 */
function shuffle<T>(items: T[], random: RandomSource): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

/**
 * Shuffle a copy of a list, for callers that must not disturb the original.
 *
 * @param items - The list to shuffle
 * @param random - Randomness, injectable for tests
 * @returns A shuffled copy
 */
export function shuffleWith<T>(items: T[], random: RandomSource = Math.random): T[] {
    return shuffle([...items], random);
}

/**
 * Pick the questions an activity actually asks.
 *
 * With `random` off the first `percentage`% are taken in stored order; with it on the selection
 * is drawn — and ordered — at random. At least one question is always kept, so a low percentage
 * on a short activity still prints something.
 *
 * @param questions - Every question the activity stores
 * @param percentage - Share of them to ask, 0-100 (defaults to all)
 * @param random - Whether to draw and order them at random
 * @param randomSource - Randomness, injectable for tests
 * @returns The selected questions, in the order they should be printed
 */
export function selectQuestions<T>(
    questions: T[],
    percentage: number | undefined,
    random: boolean | undefined,
    randomSource: RandomSource = Math.random,
): T[] {
    if (!Array.isArray(questions)) return [];

    const total = questions.length;
    const share = typeof percentage === 'number' && Number.isFinite(percentage) ? percentage : 100;

    if (share >= 100 && !random) return questions;

    const wanted = Math.max(1, Math.round((share * total) / 100));
    if (wanted >= total && !random) return questions;

    const indices = Array.from({ length: total }, (_, index) => index);
    if (random) shuffle(indices, randomSource);

    return indices.slice(0, wanted).map(index => questions[index]);
}

/**
 * Pick the questions a Crossword activity asks.
 *
 * The Crossword iDevice does not share `getQuestions` with the rest; it carries its own variant
 * (`$eXeCrucigrama.getQuestions`) and differs in three ways worth keeping:
 * - the draw is always random, there being no option to turn it off;
 * - it keeps a minimum of two words, since one word is not a crossword;
 * - the chosen indices are sorted back into stored order afterwards.
 *
 * @param questions - Every question the activity stores
 * @param percentage - Share of them to ask, 0-100 (defaults to all)
 * @param maxWords - Hard cap the board can seat, applied after the share
 * @param randomSource - Randomness, injectable for tests
 * @returns The selected questions
 */
export function selectCrosswordQuestions<T>(
    questions: T[],
    percentage: number | undefined,
    maxWords: number,
    randomSource: RandomSource = Math.random,
): T[] {
    if (!Array.isArray(questions) || questions.length === 0) return [];

    const total = questions.length;
    const share = typeof percentage === 'number' && Number.isFinite(percentage) ? percentage : 100;

    let chosen = questions;
    if (share < 100) {
        const wanted = Math.max(2, Math.round((share * total) / 100));

        if (wanted < total) {
            const indices = shuffle(
                Array.from({ length: total }, (_, index) => index),
                randomSource,
            );
            chosen = indices
                .slice(0, wanted)
                .sort((a, b) => a - b)
                .map(index => questions[index]);
        }
    }

    // The board cannot seat more than this however generous the share was.
    return chosen.length > maxWords ? chosen.slice(0, maxWords) : chosen;
}

/**
 * Normalise a solution the way the runtime does before drawing it.
 *
 * Collapses separators and whitespace to single spaces and trims, and upper-cases the whole
 * phrase unless the activity is case sensitive — so the printed boxes read exactly like the
 * on-screen ones.
 */
function normaliseSolution(solution: string, caseSensitive: boolean): string {
    const cased = caseSensitive ? solution : solution.toUpperCase();
    return cased.replace(/[&\s\n\r]+/g, ' ').trim();
}

/**
 * Build the answer boxes for a solution, revealing a share of its letters at random.
 *
 * @param solution - The solution word or phrase
 * @param percentageShow - Share of characters to give away, 0-100
 * @param caseSensitive - Whether the activity distinguishes case
 * @param randomSource - Randomness, injectable for tests
 * @returns One group of boxes per word; `null` marks a box the student fills in
 */
export function buildAnswerBoxes(
    solution: string | undefined,
    percentageShow: number | undefined,
    caseSensitive = false,
    randomSource: RandomSource = Math.random,
): CharacterBoxGroup[] {
    if (!solution) return [];

    const phrase = normaliseSolution(solution, caseSensitive);
    if (!phrase) return [];

    // Code points rather than UTF-16 units, so an astral character gets one box instead of two.
    const characters = [...phrase];

    const share = typeof percentageShow === 'number' && Number.isFinite(percentageShow) ? percentageShow : 0;
    const revealed = pickRevealedIndices(characters.length, share, randomSource);

    const groups: CharacterBoxGroup[] = [];
    let current: CharacterBoxGroup = [];

    characters.forEach((character, index) => {
        if (character === ' ') {
            if (current.length > 0) groups.push(current);
            current = [];
            return;
        }
        current.push(revealed.has(index) ? character : null);
    });

    if (current.length > 0) groups.push(current);

    return groups;
}

/**
 * Choose which positions of the solution are given away.
 *
 * Mirrors `getShowLetter`, including its quirk: positions are drawn across the whole phrase,
 * spaces included, and a draw that lands on a space is spent without revealing a letter. So the
 * number of letters actually shown can be lower than the percentage suggests — which is exactly
 * what the activity does on screen.
 */
function pickRevealedIndices(length: number, percentage: number, randomSource: RandomSource): Set<number> {
    const wanted = Math.floor((length * percentage) / 100);
    const chosen = new Set<number>();

    if (wanted <= 0 || length === 0) return chosen;
    if (wanted >= length) {
        for (let index = 0; index < length; index++) chosen.add(index);
        return chosen;
    }

    // Bounded, unlike the runtime's unbounded retry loop: a randomSource that keeps returning the
    // same value would spin forever there. Falling back to a linear scan keeps the count exact.
    let attempts = 0;
    const maxAttempts = length * 10;
    while (chosen.size < wanted && attempts < maxAttempts) {
        chosen.add(Math.floor(randomSource() * length) % length);
        attempts++;
    }

    for (let index = 0; chosen.size < wanted && index < length; index++) {
        chosen.add(index);
    }

    return chosen;
}
