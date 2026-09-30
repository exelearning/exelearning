import { describe, expect, it } from 'vitest';
import {
    buildCoverInteraction,
    coverBodyFromPoster,
    enforceSingleChoiceCorrect,
    isLegacyIslandHtml,
    migrateLegacySlide,
    migrateLegacyToV2,
    readLegacyIsland,
    safeParseJson,
} from './migration';
import { segmentBlanks } from './cloze';
import type { NoteInteraction, QuestionInteraction } from './types';

describe('safeParseJson', () => {
    it('parses valid JSON', () => {
        expect(safeParseJson('{"a":1}')).toEqual({ a: 1 });
        expect(safeParseJson('[1,2]')).toEqual([1, 2]);
    });

    it('recovers JSON that contains raw control characters', () => {
        // A literal tab/newline inside a string value is invalid JSON but
        // common in legacy content; the parser must recover it rather than
        // lose the data.
        expect(safeParseJson('{"a":"x\ty"}')).toEqual({ a: 'x\ty' });
    });

    it('returns null for unparseable input', () => {
        expect(safeParseJson('not json')).toBeNull();
        expect(safeParseJson('')).toBeNull();
        expect(safeParseJson(null)).toBeNull();
    });
});

describe('enforceSingleChoiceCorrect', () => {
    it('keeps the first correct answer and zeroes the rest', () => {
        expect(
            enforceSingleChoiceCorrect([
                ['a', 1],
                ['b', 1],
                ['c', 0],
            ]),
        ).toEqual([
            ['a', 1],
            ['b', 0],
            ['c', 0],
        ]);
    });

    it('leaves an all-wrong question untouched', () => {
        expect(
            enforceSingleChoiceCorrect([
                ['a', 0],
                ['b', 0],
            ]),
        ).toEqual([
            ['a', 0],
            ['b', 0],
        ]);
    });
});

describe('migrateLegacyToV2 — direct legacy (unversioned) to schema v2', () => {
    it('stamps schemaVersion 2 and defaults on empty/invalid input', () => {
        const doc = migrateLegacyToV2({});
        expect(doc.schemaVersion).toBe(2);
        expect(doc.interactions).toEqual([]);
        expect(migrateLegacyToV2(null).schemaVersion).toBe(2);
        expect(migrateLegacyToV2(undefined).schemaVersion).toBe(2);
    });

    it('maps a text slide to a paused note', () => {
        const doc = migrateLegacyToV2({ slides: [{ type: 'text', text: '<p>hi</p>', startTime: 2 }] });
        expect(doc.interactions[0]).toMatchObject({
            id: 'iv-0',
            type: 'note',
            body: '<p>hi</p>',
            time: 2,
            pause: true,
            duration: null,
        });
    });

    it('maps single/multiple choice slides to question interactions', () => {
        const doc = migrateLegacyToV2({
            slides: [
                {
                    type: 'singleChoice',
                    question: '<p>Q?</p>',
                    answers: [
                        ['a', 0],
                        ['b', 1],
                    ],
                    startTime: 5,
                },
                { type: 'multipleChoice', question: '<p>Q2?</p>', answers: [['c', 1]], startTime: 8 },
            ],
        });
        expect(doc.interactions[0]).toMatchObject({
            type: 'question',
            time: 5,
            question: {
                kind: 'singleChoice',
                prompt: '<p>Q?</p>',
                answers: [
                    ['a', 0],
                    ['b', 1],
                ],
            },
        });
        expect((doc.interactions[1] as QuestionInteraction).question.kind).toBe('multipleChoice');
    });

    it('normalizes a multi-correct legacy singleChoice to exactly one correct answer', () => {
        const doc = migrateLegacyToV2({
            slides: [
                {
                    type: 'singleChoice',
                    question: '<p>Q?</p>',
                    answers: [
                        ['a', 1],
                        ['b', 1],
                    ],
                    startTime: 5,
                },
            ],
        });
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            answers: [
                ['a', 1],
                ['b', 0],
            ],
        });
    });

    it('multipleChoice keeps every correct answer (not normalized)', () => {
        const doc = migrateLegacyToV2({
            slides: [
                {
                    type: 'multipleChoice',
                    question: 'Q',
                    answers: [
                        ['a', 1],
                        ['b', 1],
                        ['c', 0],
                    ],
                    startTime: 1,
                },
            ],
        });
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            answers: [
                ['a', 1],
                ['b', 1],
                ['c', 0],
            ],
        });
    });

    it('derives cloze segments from the legacy HTML prompt and stores the token prompt', () => {
        const doc = migrateLegacyToV2({
            slides: [
                {
                    type: 'cloze',
                    text: '<p>Capital is <span style="text-decoration: line-through;">Paris</span>.</p>',
                    startTime: 1,
                },
            ],
        });
        const question = (doc.interactions[0] as QuestionInteraction).question;
        expect(question).toMatchObject({
            kind: 'cloze',
            prompt: 'Capital is [[Paris]].',
            segments: [
                { t: 'text', text: 'Capital is ' },
                { t: 'blank', answers: ['Paris'] },
                { t: 'text', text: '.' },
            ],
        });
        expect(question.prompt).not.toContain('<span');
    });

    it('derives dropdown segments and keeps additionalWords', () => {
        const doc = migrateLegacyToV2({
            slides: [{ type: 'dropdown', text: 'A <s>one</s> B', additionalWords: ['two'], startTime: 1 }],
        });
        const question = (doc.interactions[0] as QuestionInteraction).question;
        expect(question).toMatchObject({ kind: 'dropdown', prompt: 'A [[one]] B', additionalWords: ['two'] });
        expect(segmentBlanks((question as { segments?: unknown }).segments).length).toBe(1);
    });

    it('maps matchElements and sortableList slides to questions of the same kind', () => {
        const doc = migrateLegacyToV2({
            slides: [
                { type: 'matchElements', text: '<p>m</p>', pairs: [['a', 'b']], startTime: 1 },
                { type: 'sortableList', text: '<p>s</p>', items: ['a', 'b'], startTime: 2 },
            ],
        });
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            kind: 'matchElements',
            pairs: [['a', 'b']],
        });
        expect((doc.interactions[1] as QuestionInteraction).question).toMatchObject({
            kind: 'sortableList',
            items: ['a', 'b'],
        });
    });

    it('maps an image slide to a note carrying the asset reference', () => {
        const doc = migrateLegacyToV2({
            slides: [{ type: 'image', url: 'resources/pic.jpg', description: 'a cat', startTime: 3 }],
        });
        expect(doc.interactions[0]).toMatchObject({
            type: 'note',
            asset: { url: 'resources/pic.jpg', alt: 'a cat' },
            time: 3,
        });
    });

    it('derives duration + pause from endTime', () => {
        const doc = migrateLegacyToV2({
            slides: [
                { type: 'text', text: 'a', startTime: 10, endTime: 15 },
                { type: 'text', text: 'b', startTime: 20 },
            ],
        });
        expect(doc.interactions[0]).toMatchObject({ time: 10, duration: 5, pause: false });
        expect(doc.interactions[1]).toMatchObject({ time: 20, duration: null, pause: true });
    });

    it('assigns stable sequential ids in original order', () => {
        const doc = migrateLegacyToV2({
            slides: [
                { type: 'text', text: 'a', startTime: 30 },
                { type: 'text', text: 'b', startTime: 5 },
            ],
        });
        expect(doc.interactions.map(i => i.id)).toEqual(['iv-0', 'iv-1']);
    });

    it('coerces non-numeric startTime via toSeconds', () => {
        const doc = migrateLegacyToV2({ slides: [{ type: 'text', text: 'a', startTime: '00:05' }] });
        expect(doc.interactions[0]?.time).toBe(5);
        const bad = migrateLegacyToV2({ slides: [{ type: 'text', text: 'a', startTime: 'oops' }] });
        expect(bad.interactions[0]?.time).toBe(0);
    });

    it('preserves unknown slide types losslessly as unsupported', () => {
        const raw = { type: 'crazyFutureType', foo: 'bar', startTime: 7 };
        const doc = migrateLegacyToV2({ slides: [raw] });
        expect(doc.interactions[0]).toMatchObject({
            type: 'unsupported',
            originalType: 'crazyFutureType',
            time: 7,
        });
        expect((doc.interactions[0] as { raw?: unknown }).raw).toEqual(raw);
    });

    it('never throws on malformed slides', () => {
        expect(() => migrateLegacyToV2({ slides: [null, 42, { type: 'cloze', text: null }] })).not.toThrow();
    });

    it('maps scorm.isScorm to scorm.enabled and carries weight', () => {
        const doc = migrateLegacyToV2({ slides: [], scorm: { isScorm: 1, weighted: 50, repeatActivity: false } });
        expect(doc.scorm).toMatchObject({ enabled: true, weight: 50, repeatActivity: false });
    });

    it('preserves legacy top-level fields under meta.legacy (nothing lost)', () => {
        const doc = migrateLegacyToV2({
            slides: [],
            title: 'T',
            description: 'D',
            i18n: { start: 'Inicio' },
            scoreNIA: true,
            evaluation: true,
            evaluationID: 'progress-1',
            ideviceID: 'iv-1',
            coverType: 'poster',
            poster: 'resources/p.jpg',
            posterDescription: 'alt',
        });
        expect(doc.title).toBe('T');
        expect(doc.description).toBe('D');
        expect(doc.meta.legacy.i18n).toEqual({ start: 'Inicio' });
        expect(doc.meta.legacy.scoreNIA).toBe(true);
        expect(doc.meta.legacy.evaluationID).toBe('progress-1');
        expect(doc.meta.legacy.coverType).toBe('poster');
        expect(doc.meta.legacy.poster).toBe('resources/p.jpg');
    });

    it('carries the legacy custom SCORM button text', () => {
        const doc = migrateLegacyToV2({ slides: [], scorm: { textButtonScorm: 'Guardar' } });
        expect(doc.meta.legacy.textButtonScorm).toBe('Guardar');
    });

    it('attaches a normalized video descriptor from a provided url', () => {
        const doc = migrateLegacyToV2({ slides: [] }, 'http://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(doc.video).toMatchObject({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
        expect(doc.video.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('keeps the local default for an unsafe video url', () => {
        const doc = migrateLegacyToV2({ slides: [] }, 'javascript:alert(1)');
        expect(doc.video.provider).toBe('local');
    });

    describe('cover synthesis (the legacy opener)', () => {
        it('turns a legacy poster into a cover interaction pinned first', () => {
            const doc = migrateLegacyToV2({
                slides: [{ type: 'text', text: 'a', startTime: 5 }],
                coverType: 'poster',
                poster: 'resources/p.jpg',
                posterDescription: 'alt text',
            });
            const cover = doc.interactions[0];
            expect(cover).toMatchObject({ id: 'iv-cover', type: 'cover', time: 0 });
            expect((cover as { body?: string }).body).toContain('resources/p.jpg');
            expect((cover as { body?: string }).body).toContain('alt text');
        });

        it('turns a text opener (coverType without poster) into a titled cover', () => {
            const doc = migrateLegacyToV2({
                slides: [],
                title: 'My video',
                description: '<p>Intro</p>',
                coverType: 'text',
            });
            expect(doc.interactions[0]).toMatchObject({
                type: 'cover',
                title: 'My video',
                body: '<p>Intro</p>',
            });
        });

        it('adds no cover when the legacy data has no coverType', () => {
            const doc = migrateLegacyToV2({ slides: [{ type: 'text', text: 'a', startTime: 5 }] });
            expect(doc.interactions.some(i => i.type === 'cover')).toBe(false);
        });
    });
});

describe('migrateLegacySlide', () => {
    it('tolerates a non-object slide', () => {
        expect(migrateLegacySlide(null, 3)).toMatchObject({ id: 'iv-3', type: 'unsupported' });
    });

    it('coerces malformed answer rows instead of keeping hazards', () => {
        const slide = {
            type: 'singleChoice',
            question: 'Q',
            answers: [['a', 1], null, 'junk', [null, 1]],
            startTime: 0,
        };
        const interaction = migrateLegacySlide(slide, 0) as QuestionInteraction;
        expect((interaction.question as { answers?: unknown }).answers).toEqual([
            ['a', 1],
            ['', 0],
        ]);
    });

    it('keeps image dimensions when present', () => {
        const interaction = migrateLegacySlide(
            { type: 'image', url: 'u.png', width: 320, height: '240', startTime: 0 },
            0,
        ) as NoteInteraction;
        expect(interaction.asset).toMatchObject({ width: 320, height: '240' });
    });
});

describe('buildCoverInteraction / coverBodyFromPoster', () => {
    it('builds the fixed-id cover with defaults', () => {
        expect(buildCoverInteraction('<p>b</p>', 'T')).toEqual({
            id: 'iv-cover',
            type: 'cover',
            time: 0,
            duration: null,
            pause: false,
            title: 'T',
            body: '<p>b</p>',
        });
        expect(buildCoverInteraction('')).toMatchObject({ title: '', body: '' });
    });

    it('escapes the poster reference and alt text', () => {
        expect(coverBodyFromPoster('a"b.jpg', 'x<y')).toBe('<p><img src="a&quot;b.jpg" alt="x&lt;y"></p>');
        expect(coverBodyFromPoster('', 'alt')).toBe('');
    });
});

describe('legacy HTML island', () => {
    it('isLegacyIslandHtml detects only real islands', () => {
        expect(isLegacyIslandHtml('<p id="exe-interactive-video-file"><a href="x">v</a></p>')).toBe(true);
        expect(isLegacyIslandHtml('<script id="exe-interactive-video-contents">{}</script>')).toBe(true);
        expect(isLegacyIslandHtml('<div class="exe-iv">rendered view</div>')).toBe(false);
        expect(isLegacyIslandHtml(null)).toBe(false);
    });

    it('readLegacyIsland extracts the parsed JSON and the sibling video link', () => {
        const html =
            '<div><p id="exe-interactive-video-file"><a href="https://youtu.be/dQw4w9WgXcQ">v</a></p>' +
            '<script id="exe-interactive-video-contents" type="application/json">{"slides":[]}</script></div>';
        const island = readLegacyIsland(html);
        expect(island.parsed).toEqual({ slides: [] });
        expect(island.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
    });

    it('reads a legacy div container too', () => {
        const html =
            '<div id="exe-interactive-video-contents" style="display:none">{"slides":[{"type":"cloze","text":"c","startTime":1}]}</div>';
        const island = readLegacyIsland(html);
        expect((island.parsed as { slides: unknown[] }).slides).toHaveLength(1);
    });

    it('degrades to null/empty for missing or garbage input', () => {
        expect(readLegacyIsland('<div>nothing here</div>')).toEqual({ parsed: null, videoUrl: '' });
        expect(readLegacyIsland(null)).toEqual({ parsed: null, videoUrl: '' });
    });
});
