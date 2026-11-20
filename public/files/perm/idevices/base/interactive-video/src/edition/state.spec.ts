import { describe, expect, it } from 'vitest';
import type { QuestionInteraction } from '../shared/types';
import { newDocument } from '../shared/types';
import { createInteraction, duplicateOf, findCover, findInteraction, nextInteractionId, tr } from './state';

describe('tr', () => {
    it('translates through the workarea i18n when it is available', () => {
        // The Vitest setup publishes `_` as an identity-ish translator.
        expect(tr('Options')).toBe('Options');
    });

    it('returns the source string when no translator is on the page', () => {
        const holder = globalThis as unknown as Record<string, unknown>;
        const previous = holder._;
        delete holder._;
        try {
            expect(tr('Options')).toBe('Options');
        } finally {
            holder._ = previous;
        }
    });
});

describe('nextInteractionId', () => {
    it('starts at iv-0 for an empty document', () => {
        expect(nextInteractionId(newDocument())).toBe('iv-0');
    });

    it('continues past the highest existing iv-<n>', () => {
        const doc = newDocument();
        doc.interactions = [
            createInteraction('note', 'iv-0', 0),
            createInteraction('note', 'iv-7', 5),
            createInteraction('note', 'iv-3', 9),
        ];
        expect(nextInteractionId(doc)).toBe('iv-8');
    });

    it('ignores ids that are not in the iv-<n> form', () => {
        const doc = newDocument();
        doc.interactions = [createInteraction('note', 'legacy-slide', 0), createInteraction('note', 'iv-2x', 1)];
        expect(nextInteractionId(doc)).toBe('iv-0');
    });
});

describe('findInteraction', () => {
    it('finds an interaction by id and returns undefined otherwise', () => {
        const doc = newDocument();
        doc.interactions = [createInteraction('note', 'iv-0', 1), createInteraction('pause', 'iv-1', 2)];
        expect(findInteraction(doc, 'iv-1')?.type).toBe('pause');
        expect(findInteraction(doc, 'iv-9')).toBeUndefined();
        expect(findInteraction(doc, null)).toBeUndefined();
    });
});

describe('findCover', () => {
    it('returns the single cover, or undefined when there is none', () => {
        const doc = newDocument();
        doc.interactions = [createInteraction('note', 'iv-0', 1)];
        expect(findCover(doc)).toBeUndefined();
        doc.interactions.push(createInteraction('cover', 'iv-1', 0));
        expect(findCover(doc)?.id).toBe('iv-1');
    });
});

describe('createInteraction', () => {
    it('pins the cover to the start and never pauses it', () => {
        const cover = createInteraction('cover', 'iv-0', 0);
        expect(cover).toMatchObject({ type: 'cover', time: 0, pause: false, title: '', body: '' });
    });

    it('defaults a question to singleChoice with two answers, the first correct', () => {
        const interaction = createInteraction('question', 'iv-1', 12) as QuestionInteraction;
        expect(interaction.type).toBe('question');
        expect(interaction.question).toMatchObject({ kind: 'singleChoice', prompt: '', score: 1, retry: true });
        expect(interaction.question).toHaveProperty('answers', [
            ['', 1],
            ['', 0],
        ]);
        expect(interaction.pause).toBe(true);
    });

    it('builds notes, pauses and jumps with their own payloads', () => {
        expect(createInteraction('note', 'iv-0', 4)).toMatchObject({ type: 'note', body: '', duration: null });
        expect(createInteraction('pause', 'iv-1', 5)).toMatchObject({ type: 'pause', body: '' });
        expect(createInteraction('jump', 'iv-2', 6)).toMatchObject({ type: 'jump', jump: { toTime: 0 } });
    });

    it('builds a bare unsupported interaction', () => {
        expect(createInteraction('unsupported', 'iv-3', 7)).toEqual({
            id: 'iv-3',
            time: 7,
            duration: null,
            pause: true,
            type: 'unsupported',
        });
    });
});

describe('duplicateOf', () => {
    it('deep-copies under a fresh id so the copy is independent', () => {
        const source = createInteraction('question', 'iv-0', 10) as QuestionInteraction;
        source.question.prompt = 'Original';
        const copy = duplicateOf(source, 'iv-1') as QuestionInteraction;
        expect(copy.id).toBe('iv-1');
        expect(copy.time).toBe(10);
        expect(copy.question.prompt).toBe('Original');
        copy.question.prompt = 'Changed';
        expect(source.question.prompt).toBe('Original');
    });
});
