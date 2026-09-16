import { describe, expect, it } from 'vitest';
import {
    clozeAnswersFromSegments,
    dropdownOptions,
    dropdownWordsFromSegments,
    htmlPromptToSegments,
    normalizeClozeAnswer,
    parsePromptText,
    segmentBlanks,
    segmentsToPromptText,
} from './cloze';

describe('parsePromptText / segmentsToPromptText', () => {
    it('splits [[…]] tokens into blank segments and keeps the surrounding text', () => {
        expect(parsePromptText('el caballo [[blanco|blanca]]')).toEqual([
            { t: 'text', text: 'el caballo ' },
            { t: 'blank', answers: ['blanco', 'blanca'] },
        ]);
    });

    it('treats repeated words as two independent blanks', () => {
        const segments = parsePromptText('the [[cat]] and the other [[cat]]');
        expect(segments.filter(s => s.t === 'blank').length).toBe(2);
        expect(segments).toEqual([
            { t: 'text', text: 'the ' },
            { t: 'blank', answers: ['cat'] },
            { t: 'text', text: ' and the other ' },
            { t: 'blank', answers: ['cat'] },
        ]);
    });

    it('preserves punctuation and Unicode/accents around blanks', () => {
        expect(parsePromptText('La capital es [[París]].')).toEqual([
            { t: 'text', text: 'La capital es ' },
            { t: 'blank', answers: ['París'] },
            { t: 'text', text: '.' },
        ]);
    });

    it('degrades unmatched or empty brackets to literal text (no nesting)', () => {
        expect(parsePromptText('open [[ only')).toEqual([{ t: 'text', text: 'open [[ only' }]);
        expect(parsePromptText('empty [[]] here')).toEqual([{ t: 'text', text: 'empty [[]] here' }]);
    });

    it('round-trips segmentsToPromptText(parsePromptText(s)) === s for canonical forms', () => {
        for (const s of [
            'el caballo [[blanco|blanca]]',
            'árbol [[verde|azul]]',
            'the [[cat]] and the other [[cat]]',
            'La capital es [[París]].',
            'no blanks here',
            '[[start]] and [[end]]',
        ]) {
            expect(segmentsToPromptText(parsePromptText(s))).toBe(s);
        }
    });

    it('segmentsToPromptText tolerates malformed segment input', () => {
        expect(segmentsToPromptText(null)).toBe('');
        expect(segmentsToPromptText([{ t: 'blank' }])).toBe('[[]]');
    });
});

describe('htmlPromptToSegments (legacy HTML -> semantic segments)', () => {
    it('derives segments from a line-through <span> blank', () => {
        expect(
            htmlPromptToSegments('<p>Capital is <span style="text-decoration: line-through;">Paris</span>.</p>'),
        ).toEqual([
            { t: 'text', text: 'Capital is ' },
            { t: 'blank', answers: ['Paris'] },
            { t: 'text', text: '.' },
        ]);
    });

    it('captures s/strike/del blanks (shared blank definition)', () => {
        expect(htmlPromptToSegments('A <s>one</s> B <del>two</del>')).toEqual([
            { t: 'text', text: 'A ' },
            { t: 'blank', answers: ['one'] },
            { t: 'text', text: ' B ' },
            { t: 'blank', answers: ['two'] },
        ]);
    });

    it('captures modern text-decoration-line blanks', () => {
        expect(htmlPromptToSegments('x <span style="text-decoration-line: line-through">y</span>')).toEqual([
            { t: 'text', text: 'x ' },
            { t: 'blank', answers: ['y'] },
        ]);
    });

    it('splits |-separated variants inside one blank', () => {
        expect(htmlPromptToSegments('<span style="text-decoration: line-through;">blanco|blanca</span>')).toEqual([
            { t: 'blank', answers: ['blanco', 'blanca'] },
        ]);
    });

    it('recovers double-escaped &lt;span markup with a single unescape', () => {
        const escaped = 'el caballo &lt;span style="text-decoration: line-through;"&gt;blanco&lt;/span&gt;';
        expect(htmlPromptToSegments(escaped)).toEqual([
            { t: 'text', text: 'el caballo ' },
            { t: 'blank', answers: ['blanco'] },
        ]);
    });

    it('keeps a blank-free prompt as a single lossless text segment (tags stripped)', () => {
        expect(htmlPromptToSegments('<p>just text</p>')).toEqual([{ t: 'text', text: 'just text' }]);
        expect(htmlPromptToSegments('')).toEqual([]);
    });

    it('never double-counts a nested blank', () => {
        expect(htmlPromptToSegments('<s>a <span style="text-decoration: line-through;">b</span></s>')).toEqual([
            { t: 'blank', answers: ['a b'] },
        ]);
    });
});

describe('segment answer helpers', () => {
    const segments = [
        { t: 'text' as const, text: 'el caballo ' },
        { t: 'blank' as const, answers: ['blanco', 'blanca'] },
        { t: 'text' as const, text: ' y el ' },
        { t: 'blank' as const, answers: ['negro'] },
    ];

    it('segmentBlanks returns only the blank segments in order', () => {
        expect(segmentBlanks(segments)).toEqual([
            { t: 'blank', answers: ['blanco', 'blanca'] },
            { t: 'blank', answers: ['negro'] },
        ]);
        expect(segmentBlanks(null)).toEqual([]);
    });

    it('clozeAnswersFromSegments joins variants with a pipe (one per blank)', () => {
        expect(clozeAnswersFromSegments(segments)).toEqual(['blanco|blanca', 'negro']);
    });

    it('dropdownWordsFromSegments takes the first variant of each blank', () => {
        expect(dropdownWordsFromSegments(segments)).toEqual(['blanco', 'negro']);
    });
});

describe('dropdownOptions', () => {
    it('pools blanks then distractors, de-duplicated and trimmed in stable order', () => {
        expect(dropdownOptions(['Paris', 'Madrid'], ['London', 'Paris', ' Rome '])).toEqual([
            'Paris',
            'Madrid',
            'London',
            'Rome',
        ]);
    });

    it('drops empty entries and tolerates non-array input', () => {
        expect(dropdownOptions(['a', '', 'b'], null)).toEqual(['a', 'b']);
        expect(dropdownOptions(null, ['x'])).toEqual(['x']);
        expect(dropdownOptions(null, null)).toEqual([]);
    });
});

describe('normalizeClozeAnswer', () => {
    it('collapses whitespace, trims and lower-cases', () => {
        expect(normalizeClozeAnswer('  New   York ')).toBe('new york');
        expect(normalizeClozeAnswer(null)).toBe('');
    });
});
