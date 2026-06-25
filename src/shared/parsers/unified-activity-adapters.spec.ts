/**
 * Tests for the Unified Activity Format adapters (normalized model -> iDevice data).
 */

import { describe, expect, it } from 'bun:test';
import {
    flipCardDefault,
    unifiedFillBlankToFormQuestion,
    unifiedFlashcardToFlipCard,
    unifiedItemsToFormQuestionsData,
    unifiedSelectionToFormQuestion,
    unifiedTrueFalseToFormQuestion,
    unifiedTrueFalseToTrueOrFalseQuestion,
} from './unified-activity-adapters';
import {
    parseUnifiedActivityLine,
    type UnifiedFillBlankItem,
    type UnifiedFlashcardItem,
    type UnifiedSelectionItem,
    type UnifiedTrueFalseItem,
} from './unified-activity-format';

const selection = (line: string): UnifiedSelectionItem => parseUnifiedActivityLine(line).item as UnifiedSelectionItem;
const truefalse = (line: string): UnifiedTrueFalseItem => parseUnifiedActivityLine(line).item as UnifiedTrueFalseItem;
const fillblank = (line: string): UnifiedFillBlankItem => parseUnifiedActivityLine(line).item as UnifiedFillBlankItem;
const flashcard = (line: string): UnifiedFlashcardItem => parseUnifiedActivityLine(line).item as UnifiedFlashcardItem;

describe('unifiedSelectionToFormQuestion', () => {
    it('maps a multi-answer selection to a form questionsData entry', () => {
        const question = unifiedSelectionToFormQuestion(selection('012#Q#A#B#C#D'));
        expect(question.activityType).toBe('selection');
        expect(question.selectionType).toBe('multiple');
        expect(question.baseText).toBe('<p>Q</p>');
        expect(question.answers).toEqual([
            [true, 'A'],
            [true, 'B'],
            [true, 'C'],
            [false, 'D'],
        ]);
    });

    it('maps a single-answer selection to selectionType single', () => {
        const question = unifiedSelectionToFormQuestion(selection('1#Q#A#B'));
        expect(question.selectionType).toBe('single');
        expect(question.answers).toEqual([
            [false, 'A'],
            [true, 'B'],
        ]);
    });

    it('maps hint to suggestion, explain to feedbackRight, feedback to feedbackWrong and points to customScore', () => {
        const question = unifiedSelectionToFormQuestion(selection('0#Q#A#B@hint=h@explain=e@feedback=f@points=2'));
        expect(question.suggestion).toBe('h');
        expect(question.feedbackRight).toBe('e');
        expect(question.feedbackWrong).toBe('f');
        expect(question.customScore).toBe(2);
    });

    it('writes the suggestion field (never the dead "hint" field)', () => {
        const question = unifiedSelectionToFormQuestion(selection('0#Q#A#B@hint=h'));
        expect(question.suggestion).toBe('h');
        expect('hint' in question).toBe(false);
    });

    it('omits feedback fields when no parameters are given', () => {
        const question = unifiedSelectionToFormQuestion(selection('0#Q#A#B'));
        expect('suggestion' in question).toBe(false);
        expect('feedbackRight' in question).toBe(false);
        expect('customScore' in question).toBe(false);
    });
});

describe('unifiedTrueFalseToTrueOrFalseQuestion', () => {
    it('maps the issue example to the trueorfalse game question shape', () => {
        const line =
            '1#Is the Earth round?#True#False@hint=Think about the horizon@explain=The Earth is a geoid, not flat.';
        const question = unifiedTrueFalseToTrueOrFalseQuestion(truefalse(line));
        expect(question).toEqual({
            question: '<p>Is the Earth round?</p>',
            feedback: 'The Earth is a geoid, not flat.',
            suggestion: 'Think about the horizon',
            solution: 1,
        });
    });

    it('encodes a false answer as solution 0', () => {
        const question = unifiedTrueFalseToTrueOrFalseQuestion(truefalse('0#The Earth is flat#True#False'));
        expect(question.solution).toBe(0);
    });

    it('always includes feedback and suggestion (defaulting to empty strings)', () => {
        const question = unifiedTrueFalseToTrueOrFalseQuestion(truefalse('1#The sky is blue@type=truefalse'));
        expect(question.feedback).toBe('');
        expect(question.suggestion).toBe('');
    });
});

describe('unifiedTrueFalseToFormQuestion', () => {
    it('maps to a form true-false question with a string answer', () => {
        const question = unifiedTrueFalseToFormQuestion(truefalse('1#The sky is blue@type=truefalse'));
        expect(question.activityType).toBe('true-false');
        expect(question.baseText).toBe('<p>The sky is blue</p>');
        expect(question.answer).toBe('1');
    });

    it('encodes false as answer "0"', () => {
        const question = unifiedTrueFalseToFormQuestion(truefalse('0#The sky is green@type=truefalse'));
        expect(question.answer).toBe('0');
    });
});

describe('unifiedFillBlankToFormQuestion', () => {
    it('maps the issue example to a form fill question using <u> gaps', () => {
        const line =
            'eXeLearning is a @@free@@ and open source editor to create @@educational@@ resources.@explain=eXeLearning creates interactive learning content.';
        const question = unifiedFillBlankToFormQuestion(fillblank(line));
        expect(question.activityType).toBe('fill');
        expect(question.baseText).toBe(
            '<p>eXeLearning is a <u>free</u> and open source editor to create <u>educational</u> resources.</p>',
        );
        expect(question.feedbackRight).toBe('eXeLearning creates interactive learning content.');
    });

    it('encodes alternative answers with pipe-wrapped <u> gaps', () => {
        const question = unifiedFillBlankToFormQuestion(fillblank('Water is @@wet|moist@@.'));
        expect(question.baseText).toBe('<p>Water is <u>|wet|moist|</u>.</p>');
    });

    it('maps case-sensitive to capitalization and strict to strict', () => {
        const question = unifiedFillBlankToFormQuestion(
            fillblank('The sky is @@blue@@.@case-sensitive=true@strict=true'),
        );
        expect(question.capitalization).toBe(true);
        expect(question.strict).toBe(true);
    });
});

describe('unifiedFlashcardToFlipCard', () => {
    it('maps a flashcard to a flipcards card with URI-encoded text', () => {
        const card = unifiedFlashcardToFlipCard(
            flashcard('Photosynthesis#Process by which plants convert light into energy@type=flashcard'),
        );
        expect(card.eText).toBe('Photosynthesis');
        expect(card.eTextBk).toBe('Process%20by%20which%20plants%20convert%20light%20into%20energy');
        expect(card.type).toBe(2);
        expect(card.color).toBe('#000000');
    });

    it('mirrors the editor encodeURIComponentSafe percent handling', () => {
        const card = unifiedFlashcardToFlipCard(flashcard('50% done#half@type=flashcard'));
        expect(card.eText).toBe(encodeURIComponent('50&percnt; done'));
    });

    it('produces a card that passes the front/back content requirement', () => {
        const card = unifiedFlashcardToFlipCard(flashcard('Term#Definition@type=flashcard'));
        expect(card.eText.length).toBeGreaterThan(0);
        expect(card.eTextBk.length).toBeGreaterThan(0);
    });

    it('preserves empty text without encoding (defensive guard)', () => {
        const item: UnifiedFlashcardItem = { kind: 'flashcard', front: '', back: '', params: { extra: {} }, raw: '' };
        const card = unifiedFlashcardToFlipCard(item);
        expect(card.eText).toBe('');
        expect(card.eTextBk).toBe('');
    });
});

describe('flipCardDefault', () => {
    it('provides every card field with safe defaults', () => {
        const card = flipCardDefault();
        expect(card.type).toBe(2);
        expect(card.eText).toBe('');
        expect(card.eTextBk).toBe('');
        expect(card.color).toBe('#000000');
        expect(card.backcolor).toBe('#ffffff');
        expect(card.xBk).toBe(0);
    });
});

describe('unifiedItemsToFormQuestionsData', () => {
    it('converts selection, true-false and fill items and skips flashcards', () => {
        const items = [
            selection('0#Q1#A#B'),
            truefalse('1#Q2 statement@type=truefalse'),
            fillblank('A @@gap@@ here.'),
            flashcard('Front#Back@type=flashcard'),
        ];
        const result = unifiedItemsToFormQuestionsData(items);
        expect(result.questions).toHaveLength(3);
        expect(result.questions.map(q => q.activityType)).toEqual(['selection', 'true-false', 'fill']);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].item.kind).toBe('flashcard');
    });
});
