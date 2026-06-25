/**
 * Tests for the Unified Compact Activity Authoring Format parser.
 */

import { describe, expect, it } from 'bun:test';
import {
    parseUnifiedActivityLine,
    parseUnifiedActivityLines,
    type UnifiedActivityParseOptions,
    type UnifiedActivityParseResult,
    type UnifiedFillBlankItem,
    type UnifiedFlashcardItem,
    type UnifiedSelectionItem,
    type UnifiedTrueFalseItem,
} from './unified-activity-format';

const parse = (input: string, options?: UnifiedActivityParseOptions): UnifiedActivityParseResult =>
    parseUnifiedActivityLine(input, options);

const codesOf = (result: UnifiedActivityParseResult): string[] => result.diagnostics.map(d => d.code);

const hasCode = (result: UnifiedActivityParseResult, code: string): boolean => codesOf(result).includes(code);

describe('parseUnifiedActivityLine', () => {
    describe('selection', () => {
        it('parses a single correct answer (single selection)', () => {
            const result = parse('0#Capital of France?#Paris#Rome#Berlin');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.kind).toBe('selection');
            expect(item.question).toBe('Capital of France?');
            expect(item.options).toEqual(['Paris', 'Rome', 'Berlin']);
            expect(item.correctIndexes).toEqual([0]);
            expect(item.selectionType).toBe('single');
        });

        it('parses multiple correct answers with compact digit syntax', () => {
            const result = parse('02#Select prime numbers#2#4#5');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.correctIndexes).toEqual([0, 2]);
            expect(item.selectionType).toBe('multiple');
            expect(item.options).toEqual(['2', '4', '5']);
        });

        it('parses multiple correct answers with comma syntax', () => {
            const item = parse('0,2#Select prime numbers#2#4#5').item as UnifiedSelectionItem;
            expect(item.correctIndexes).toEqual([0, 2]);
            expect(item.selectionType).toBe('multiple');
        });

        it('parses multiple correct answers with pipe syntax', () => {
            const item = parse('0|2#Select prime numbers#2#4#5').item as UnifiedSelectionItem;
            expect(item.correctIndexes).toEqual([0, 2]);
            expect(item.selectionType).toBe('multiple');
        });

        it('parses the issue multiple-choice example with @explain', () => {
            const line =
                '012#Which are the three main axes?#Poverty blame#Dehumanization#Dissent criminalization#Democratic participation@explain=The three axes are poverty as guilt, dehumanization, and dissent criminalization.';
            const result = parse(line);
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.kind).toBe('selection');
            expect(item.correctIndexes).toEqual([0, 1, 2]);
            expect(item.options).toHaveLength(4);
            expect(item.selectionType).toBe('multiple');
            expect(item.params.explain).toBe(
                'The three axes are poverty as guilt, dehumanization, and dissent criminalization.',
            );
        });

        it('rejects an out-of-range answer index', () => {
            const result = parse('5#Question#A#B');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'ANSWER_INDEX_OUT_OF_RANGE')).toBe(true);
        });

        it('rejects duplicated answer indexes', () => {
            const result = parse('0,0#Question#A#B');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'DUPLICATE_ANSWER_INDEX')).toBe(true);
        });

        it('rejects a missing (empty) question', () => {
            const result = parse('0##A#B');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'EMPTY_QUESTION')).toBe(true);
        });

        it('rejects fewer than two options', () => {
            const result = parse('0#Question#OnlyOne');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'TOO_FEW_OPTIONS')).toBe(true);
        });

        it('rejects an empty option', () => {
            const result = parse('0#Question##B');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'EMPTY_OPTION')).toBe(true);
        });

        it('rejects a non-numeric answer index', () => {
            const result = parse('0,x#Question#A#B');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'INVALID_ANSWER_INDEX')).toBe(true);
        });

        it('supports an escaped # inside the question', () => {
            const item = parse('0#What is 2 \\# 3?#A#B').item as UnifiedSelectionItem;
            expect(item.question).toBe('What is 2 # 3?');
        });

        it('supports an escaped @ inside an option', () => {
            const item = parse('0#Question#a\\@b#c').item as UnifiedSelectionItem;
            expect(item.options).toEqual(['a@b', 'c']);
        });

        it('supports @hint, @explain and @points parameters', () => {
            const item = parse('0#Question#A#B@hint=think@explain=because@points=2').item as UnifiedSelectionItem;
            expect(item.params.hint).toBe('think');
            expect(item.params.explain).toBe('because');
            expect(item.params.points).toBe(2);
        });

        it('warns on an unknown parameter but still parses', () => {
            const result = parse('0#Question#A#B@wat=x');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.params.extra.wat).toBe('x');
            expect(result.diagnostics.some(d => d.code === 'UNKNOWN_PARAM' && d.severity === 'warning')).toBe(true);
        });

        it('rejects a duplicate parameter', () => {
            const result = parse('0#Question#A#B@hint=a@hint=b');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'DUPLICATE_PARAM')).toBe(true);
        });

        it('rejects @selection=single combined with multiple correct answers', () => {
            const result = parse('01#Question#A#B@selection=single');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'SELECTION_SINGLE_CONFLICT')).toBe(true);
        });

        it('allows @selection=multiple with a single correct answer', () => {
            const result = parse('0#Question#A#B@selection=multiple');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.selectionType).toBe('multiple');
        });

        it('reports a missing answer specification when type is forced to selection', () => {
            const result = parse('#Question#A#B@type=selection');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'NO_CORRECT_ANSWER')).toBe(true);
        });
    });

    describe('truefalse', () => {
        it('parses the issue example where 1 means true', () => {
            const line =
                '1#Is the Earth round?#True#False@hint=Think about the horizon@explain=The Earth is a geoid, not flat.';
            const result = parse(line);
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedTrueFalseItem;
            expect(item.kind).toBe('truefalse');
            expect(item.statement).toBe('Is the Earth round?');
            expect(item.answer).toBe(true);
            expect(item.params.hint).toBe('Think about the horizon');
            expect(item.params.explain).toBe('The Earth is a geoid, not flat.');
        });

        it('parses 0 meaning false', () => {
            const item = parse('0#The Earth is flat#True#False').item as UnifiedTrueFalseItem;
            expect(item.kind).toBe('truefalse');
            expect(item.answer).toBe(false);
        });

        it('parses textual true/false tokens', () => {
            expect((parse('true#Water is wet#True#False').item as UnifiedTrueFalseItem).answer).toBe(true);
            expect((parse('false#2+2=5#True#False').item as UnifiedTrueFalseItem).answer).toBe(false);
        });

        it('rejects an invalid boolean token when type is explicit', () => {
            const result = parse('maybe#Statement#True#False@type=truefalse');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'INVALID_BOOLEAN')).toBe(true);
        });

        it('supports an explicit two-field truefalse line', () => {
            const item = parse('1#The sky is blue@type=truefalse').item as UnifiedTrueFalseItem;
            expect(item.kind).toBe('truefalse');
            expect(item.statement).toBe('The sky is blue');
            expect(item.answer).toBe(true);
        });

        it('does not misclassify an arbitrary two-option selection as truefalse', () => {
            const item = parse('0#Pick one#Apple#Banana').item as UnifiedSelectionItem;
            expect(item.kind).toBe('selection');
            expect(item.correctIndexes).toEqual([0]);
        });

        it('rejects a true/false line with an unsupported field count', () => {
            const result = parse('1#statement#extra@type=truefalse');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'TRUEFALSE_BAD_SHAPE')).toBe(true);
        });

        it('rejects an empty true/false statement', () => {
            const result = parse('1#@type=truefalse');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'EMPTY_STATEMENT')).toBe(true);
        });
    });

    describe('fillblank', () => {
        it('parses the issue example', () => {
            const line =
                'eXeLearning is a @@free@@ and open source editor to create @@educational@@ resources.@explain=eXeLearning creates interactive learning content.';
            const result = parse(line);
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedFillBlankItem;
            expect(item.kind).toBe('fillblank');
            expect(item.blanks).toEqual([['free'], ['educational']]);
            expect(item.tokens).toEqual([
                { type: 'text', value: 'eXeLearning is a ' },
                { type: 'blank', answers: ['free'] },
                { type: 'text', value: ' and open source editor to create ' },
                { type: 'blank', answers: ['educational'] },
                { type: 'text', value: ' resources.' },
            ]);
            expect(item.params.explain).toBe('eXeLearning creates interactive learning content.');
        });

        it('parses multiple blanks', () => {
            const item = parse('Roses are @@red@@ and violets are @@blue@@.').item as UnifiedFillBlankItem;
            expect(item.blanks).toEqual([['red'], ['blue']]);
        });

        it('parses alternative answers inside a blank', () => {
            const item = parse('Water is @@wet|moist@@.').item as UnifiedFillBlankItem;
            expect(item.blanks).toEqual([['wet', 'moist']]);
        });

        it('rejects an unmatched @@ marker', () => {
            const result = parse('This is @@broken.');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'UNMATCHED_BLANK')).toBe(true);
        });

        it('rejects an empty blank', () => {
            const result = parse('This is @@@@ bad.');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'EMPTY_BLANK')).toBe(true);
        });

        it('requires at least one blank when type is forced to fillblank', () => {
            const result = parse('Just plain text@type=fillblank');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'NO_BLANKS')).toBe(true);
        });

        it('preserves escaped separators in the surrounding text', () => {
            const item = parse('Price is 5\\# and a\\@b @@here@@.').item as UnifiedFillBlankItem;
            expect(item.tokens[0]).toEqual({ type: 'text', value: 'Price is 5# and a@b ' });
            expect(item.blanks).toEqual([['here']]);
        });

        it('drops an empty alternative with a warning', () => {
            const result = parse('Pick @@a||b@@.');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedFillBlankItem;
            expect(item.blanks).toEqual([['a', 'b']]);
            expect(hasCode(result, 'EMPTY_ALTERNATIVE')).toBe(true);
        });

        it('resolves escaped separators inside a blank answer', () => {
            const item = parse('Pick @@a\\#b@@.').item as UnifiedFillBlankItem;
            expect(item.blanks).toEqual([['a#b']]);
        });
    });

    describe('flashcard', () => {
        it('parses the issue example with @type=flashcard', () => {
            const result = parse('Photosynthesis#Process by which plants convert light into energy@type=flashcard');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedFlashcardItem;
            expect(item.kind).toBe('flashcard');
            expect(item.front).toBe('Photosynthesis');
            expect(item.back).toBe('Process by which plants convert light into energy');
        });

        it('treats flashcard as an input alias (plural form normalises to flashcard)', () => {
            const item = parse('Term#Definition@type=flashcards').item as UnifiedFlashcardItem;
            expect(item.kind).toBe('flashcard');
        });

        it('rejects a missing back side', () => {
            const result = parse('OnlyFront@type=flashcard');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'MISSING_BACK')).toBe(true);
        });

        it('rejects more than two fields', () => {
            const result = parse('a#b#c@type=flashcard');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'TOO_MANY_FIELDS')).toBe(true);
        });

        it('handles escaped separators in the front and back', () => {
            const item = parse('a\\#b#c\\@d@type=flashcard').item as UnifiedFlashcardItem;
            expect(item.front).toBe('a#b');
            expect(item.back).toBe('c@d');
        });

        it('rejects an empty front side', () => {
            const result = parse('#back@type=flashcard');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'EMPTY_FRONT')).toBe(true);
        });

        it('rejects an empty back side', () => {
            const result = parse('front#@type=flashcard');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'EMPTY_BACK')).toBe(true);
        });
    });

    describe('parameters', () => {
        it('parses multiple parameters of different kinds', () => {
            const item = parse('0#Q#A#B@hint=h@explain=e@points=3@difficulty=hard@tags=x,y')
                .item as UnifiedSelectionItem;
            expect(item.params.hint).toBe('h');
            expect(item.params.explain).toBe('e');
            expect(item.params.points).toBe(3);
            expect(item.params.difficulty).toBe('hard');
            expect(item.params.tags).toEqual(['x', 'y']);
        });

        it('supports an escaped @ inside a parameter value', () => {
            const item = parse('0#Q#A#B@explain=email is a\\@b.com').item as UnifiedSelectionItem;
            expect(item.params.explain).toBe('email is a@b.com');
        });

        it('supports an escaped # inside a parameter value', () => {
            const item = parse('0#Q#A#B@explain=use \\# for headings').item as UnifiedSelectionItem;
            expect(item.params.explain).toBe('use # for headings');
        });

        it('treats a non-letter-leading @key= as literal payload, not a parameter', () => {
            const result = parse('0#Q#A#B@2nd=x');
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.options).toEqual(['A', 'B@2nd=x']);
        });

        it('normalises parameter keys to lowercase', () => {
            const item = parse('0#Q#A#B@Hint=value').item as UnifiedSelectionItem;
            expect(item.params.hint).toBe('value');
        });

        it('warns on a non-numeric @points value', () => {
            const result = parse('0#Q#A#B@points=abc');
            expect(result.ok).toBe(true);
            expect(hasCode(result, 'INVALID_POINTS')).toBe(true);
            expect((result.item as UnifiedSelectionItem).params.points).toBeUndefined();
        });

        it('parses @lang, @shuffle and @strict parameters', () => {
            const item = parse('0#Q#A#B@lang=es@shuffle=true@strict=false').item as UnifiedSelectionItem;
            expect(item.params.lang).toBe('es');
            expect(item.params.shuffle).toBe(true);
            expect(item.params.strict).toBe(false);
        });

        it('warns on an invalid @selection value', () => {
            const result = parse('0#Q#A#B@selection=both');
            expect(result.ok).toBe(true);
            expect(hasCode(result, 'INVALID_PARAM_VALUE')).toBe(true);
            expect((result.item as UnifiedSelectionItem).params.selection).toBeUndefined();
        });

        it('warns on a non-boolean @shuffle value', () => {
            const result = parse('0#Q#A#B@shuffle=maybe');
            expect(result.ok).toBe(true);
            expect(hasCode(result, 'INVALID_PARAM_VALUE')).toBe(true);
            expect((result.item as UnifiedSelectionItem).params.shuffle).toBeUndefined();
        });
    });

    describe('robustness and security', () => {
        it('keeps script-like text as literal data without executing it', () => {
            const result = parse(
                '0#What does <script>alert(1)</script> do?#It runs JS#Nothing@explain=<script>bad</script>',
            );
            expect(result.ok).toBe(true);
            const item = result.item as UnifiedSelectionItem;
            expect(item.question).toBe('What does <script>alert(1)</script> do?');
            expect(item.params.explain).toBe('<script>bad</script>');
        });

        it('preserves Unicode, accents and emoji', () => {
            const item = parse('0#¿Cuál es la capital? 🌍#París#Roma').item as UnifiedSelectionItem;
            expect(item.question).toBe('¿Cuál es la capital? 🌍');
            expect(item.options).toEqual(['París', 'Roma']);
        });

        it('handles a very long input without crashing', () => {
            const longQuestion = 'x'.repeat(10000);
            const item = parse(`0#${longQuestion}#A#B`).item as UnifiedSelectionItem;
            expect(item.question).toHaveLength(10000);
        });

        it('strips a trailing carriage return from a single line', () => {
            const item = parse('0#Question#A#B\r').item as UnifiedSelectionItem;
            expect(item.options).toEqual(['A', 'B']);
        });

        it('warns on an unknown escape sequence and preserves it literally', () => {
            const result = parse('0#a\\zb#A#B');
            expect(result.ok).toBe(true);
            expect(hasCode(result, 'UNKNOWN_ESCAPE')).toBe(true);
            expect((result.item as UnifiedSelectionItem).question).toBe('a\\zb');
        });
    });

    describe('type detection', () => {
        it('returns an ambiguity error when the type cannot be inferred', () => {
            const result = parse('Apple#Banana');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'AMBIGUOUS_TYPE')).toBe(true);
            expect(result.diagnostics.some(d => d.message.includes('@type'))).toBe(true);
        });

        it('honours the defaultType option', () => {
            const item = parse('Apple#Banana', { defaultType: 'flashcard' }).item as UnifiedFlashcardItem;
            expect(item.kind).toBe('flashcard');
            expect(item.front).toBe('Apple');
            expect(item.back).toBe('Banana');
        });

        it('rejects an unknown @type value', () => {
            const result = parse('0#Q#A#B@type=bogus');
            expect(result.ok).toBe(false);
            expect(hasCode(result, 'UNKNOWN_TYPE')).toBe(true);
        });
    });

    describe('strict mode', () => {
        it('treats an unknown parameter as an error', () => {
            const result = parse('0#Q#A#B@wat=x', { strict: true });
            expect(result.ok).toBe(false);
            expect(result.diagnostics.some(d => d.code === 'UNKNOWN_PARAM' && d.severity === 'error')).toBe(true);
        });

        it('treats an unknown escape sequence as an error', () => {
            const result = parse('0#a\\zb#A#B', { strict: true });
            expect(result.ok).toBe(false);
            expect(result.diagnostics.some(d => d.code === 'UNKNOWN_ESCAPE' && d.severity === 'error')).toBe(true);
        });
    });
});

describe('adversarial regressions (issue #1228 review)', () => {
    it('parses a blank whose answer contains = (e.g. @@x=5@@)', () => {
        const result = parse('Solve @@x=5@@ now.');
        expect(result.ok).toBe(true);
        const item = result.item as UnifiedFillBlankItem;
        expect(item.blanks).toEqual([['x=5']]);
    });

    it('parses multiple blanks when a later blank answer contains =', () => {
        const result = parse('Use @@x@@ and @@y=2@@ here.');
        expect(result.ok).toBe(true);
        const item = result.item as UnifiedFillBlankItem;
        expect(item.blanks).toEqual([['x'], ['y=2']]);
        expect(item.tokens[item.tokens.length - 1]).toEqual({ type: 'text', value: ' here.' });
    });

    it('parses a blank whose answer starts with a digit and contains = (@@0=zero@@)', () => {
        const item = parse('val @@0=zero@@ done.').item as UnifiedFillBlankItem;
        expect(item.blanks).toEqual([['0=zero']]);
    });

    it('does not treat a digit-leading @8am= as a parameter', () => {
        const result = parse('0#Pay before @8am=now#Yes#No');
        expect(result.ok).toBe(true);
        const item = result.item as UnifiedSelectionItem;
        expect(item.question).toBe('Pay before @8am=now');
        expect(item.options).toEqual(['Yes', 'No']);
    });

    it('keeps an escaped \\@word= sequence as literal text', () => {
        const item = parse('0#cost \\@x=5 today#Yes#No').item as UnifiedSelectionItem;
        expect(item.question).toBe('cost @x=5 today');
    });

    it('rejects multiple correct answers when @type=single', () => {
        const result = parse('01#Q#A#B@type=single');
        expect(result.ok).toBe(false);
        expect(hasCode(result, 'SELECTION_SINGLE_CONFLICT')).toBe(true);
    });

    it('forces a multiple-selection question when @type=multiple', () => {
        const item = parse('0#Q#A#B@type=multiple').item as UnifiedSelectionItem;
        expect(item.selectionType).toBe('multiple');
    });

    it('lets an explicit @selection override @type=single', () => {
        const item = parse('01#Q#A#B@type=single@selection=multiple').item as UnifiedSelectionItem;
        expect(item.selectionType).toBe('multiple');
    });

    it('warns on an empty @points value instead of silently using 0', () => {
        const result = parse('0#Q#A#B@points=');
        expect(hasCode(result, 'INVALID_POINTS')).toBe(true);
        expect((result.item as UnifiedSelectionItem).params.points).toBeUndefined();
    });

    it('reports only EMPTY_BLANK (no spurious EMPTY_ALTERNATIVE) for @@@@', () => {
        const result = parse('This is @@@@ bad.');
        expect(hasCode(result, 'EMPTY_BLANK')).toBe(true);
        expect(hasCode(result, 'EMPTY_ALTERNATIVE')).toBe(false);
    });

    it('keeps @@ inside a parameter value from splitting the value', () => {
        const item = parse('0#Q#A#B@explain=use @@k=v@@ carefully').item as UnifiedSelectionItem;
        expect(item.params.explain).toBe('use @@k=v@@ carefully');
        expect(item.params.extra).toEqual({});
    });

    it('treats an escaped pipe inside a blank as a literal pipe, not an alternative separator', () => {
        const result = parse('The regex is @@a\\|b@@ here.');
        expect(result.ok).toBe(true);
        const item = result.item as UnifiedFillBlankItem;
        expect(item.blanks).toEqual([['a|b']]);
        expect(hasCode(result, 'EMPTY_ALTERNATIVE')).toBe(false);
        expect(hasCode(result, 'UNKNOWN_ESCAPE')).toBe(false);
    });

    it('parses a blank answer ending in an escaped pipe without a spurious warning', () => {
        const result = parse('End @@x\\|@@ here.');
        expect(result.ok).toBe(true);
        const item = result.item as UnifiedFillBlankItem;
        expect(item.blanks).toEqual([['x|']]);
        expect(hasCode(result, 'EMPTY_ALTERNATIVE')).toBe(false);
    });
});

describe('parseUnifiedActivityLines', () => {
    it('parses multiple valid lines into items', () => {
        const result = parseUnifiedActivityLines(['0#Q1#A#B', '1#Q2#C#D'].join('\n'));
        expect(result.ok).toBe(true);
        expect(result.items).toHaveLength(2);
    });

    it('preserves 1-based line numbers in diagnostics', () => {
        const result = parseUnifiedActivityLines(['0#Q1#A#B', '5#Q2#A#B'].join('\n'));
        expect(result.ok).toBe(false);
        const bad = result.diagnostics.find(d => d.code === 'ANSWER_INDEX_OUT_OF_RANGE');
        expect(bad?.line).toBe(2);
    });

    it('ignores blank lines and comment lines', () => {
        const input = ['// a comment', '', '0#Q1#A#B', '# hash comment', '1#Q2#C#D'].join('\n');
        const result = parseUnifiedActivityLines(input);
        expect(result.items).toHaveLength(2);
    });

    it('returns partial successes alongside diagnostics', () => {
        const result = parseUnifiedActivityLines(['0#Q1#A#B', 'Apple#Banana'].join('\n'));
        expect(result.items).toHaveLength(1);
        expect(result.ok).toBe(false);
        expect(result.diagnostics.some(d => d.code === 'AMBIGUOUS_TYPE')).toBe(true);
    });

    it('handles CRLF line endings', () => {
        const result = parseUnifiedActivityLines('0#Q1#A#B\r\n1#Q2#C#D');
        expect(result.items).toHaveLength(2);
    });

    it('applies the lineOffset option to diagnostics', () => {
        const result = parseUnifiedActivityLines('5#Q#A#B', { lineOffset: 10 });
        const bad = result.diagnostics.find(d => d.code === 'ANSWER_INDEX_OUT_OF_RANGE');
        expect(bad?.line).toBe(11);
    });

    it('assigns line numbers to successfully parsed items', () => {
        const result = parseUnifiedActivityLines(['', '0#Q1#A#B'].join('\n'));
        expect(result.items[0].line).toBe(2);
    });
});
