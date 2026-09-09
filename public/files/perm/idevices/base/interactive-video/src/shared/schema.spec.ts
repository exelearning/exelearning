import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hydrateDocument, normalizeV2, SCHEMA_VERSION, serializeDocument } from './schema';
import { safeParseJson } from './migration';
import type { InteractiveVideoDocumentV2, QuestionInteraction } from './types';
import { newDocument } from './types';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');

function fixture(name: string): string {
    return readFileSync(join(fixturesDir, name), 'utf-8');
}

function okDocument(input: unknown): InteractiveVideoDocumentV2 {
    const result = hydrateDocument(input);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
        throw new Error('expected ok');
    }
    return result.document;
}

describe('SCHEMA_VERSION', () => {
    it('is 2 — the only published versioned schema', () => {
        expect(SCHEMA_VERSION).toBe(2);
        expect(newDocument().schemaVersion).toBe(2);
    });
});

describe('hydrateDocument — input shapes', () => {
    it('returns a fresh empty document for null/undefined', () => {
        expect(okDocument(null)).toEqual(newDocument());
        expect(okDocument(undefined)).toEqual(newDocument());
    });

    it('rejects unusable primitives as invalid', () => {
        expect(hydrateDocument(42)).toMatchObject({ status: 'invalid' });
        expect(hydrateDocument(true)).toMatchObject({ status: 'invalid' });
        expect(hydrateDocument([1, 2])).toMatchObject({ status: 'invalid' });
    });

    it('hydrates real legacy HTML (data island) directly into schema v2', () => {
        const doc = okDocument(fixture('legacy/island-youtube.html'));
        expect(doc.schemaVersion).toBe(2);
        expect(doc.title).toBe('Reporting campaign');
        expect(doc.video).toMatchObject({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
        // The text opener becomes the cover, then the three slides.
        expect(doc.interactions.map(i => i.type)).toEqual(['cover', 'note', 'question', 'question']);
        const cloze = doc.interactions[3] as QuestionInteraction;
        expect(cloze.question).toMatchObject({ kind: 'cloze', prompt: expect.stringContaining('[[report]]') });
    });

    it('hydrates a parsed legacy object containing slides', () => {
        const doc = okDocument({ slides: [{ type: 'text', text: '<p>hi</p>', startTime: 2 }] });
        expect(doc.schemaVersion).toBe(2);
        expect(doc.interactions[0]).toMatchObject({ type: 'note', body: '<p>hi</p>', time: 2 });
    });

    it('prefers the textTextarea/htmlView island over the bare object (the URL lives there)', () => {
        const island =
            '<div><p id="exe-interactive-video-file"><a href="https://youtu.be/dQw4w9WgXcQ">v</a></p>' +
            '<script id="exe-interactive-video-contents">{"slides":[{"type":"text","text":"a","startTime":1}]}</script></div>';
        for (const key of ['textTextarea', 'htmlView'] as const) {
            const doc = okDocument({ [key]: island, slides: [] });
            expect(doc.video).toMatchObject({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            expect(doc.interactions).toHaveLength(1);
        }
    });

    it('ignores htmlView strings that are NOT a data island (a rendered view)', () => {
        const doc = okDocument({
            htmlView: '<div class="exe-iv">rendered</div>',
            slides: [{ type: 'text', text: 'a', startTime: 1 }],
        });
        expect(doc.interactions).toHaveLength(1);
    });

    it('accepts a stored v2 document and normalizes it field by field', () => {
        const stored = safeParseJson(fixture('schema-v2/minimal.json'));
        const doc = okDocument(stored);
        expect(doc.schemaVersion).toBe(2);
        expect(doc.interactions).toHaveLength(4);
        expect(doc.video.videoId).toBe('dQw4w9WgXcQ');
    });

    it('rejects schema versions greater than 2 without rewriting them', () => {
        const future = { schemaVersion: 3, interactions: [{ id: 'x', type: 'hologram' }], secret: 'keep me' };
        const result = hydrateDocument(future);
        expect(result).toMatchObject({ status: 'unsupported-version', version: 3 });
        if (result.status === 'unsupported-version') {
            // The original payload is preserved verbatim, not a rewritten copy.
            expect(result.original).toBe(future);
        }
        expect(hydrateDocument({ schemaVersion: 99 })).toMatchObject({ status: 'unsupported-version', version: 99 });
    });

    it('rejects a future version stored inside an island too', () => {
        const html = '<script id="exe-interactive-video-contents">{"schemaVersion":4,"interactions":[]}</script>';
        expect(hydrateDocument(html)).toMatchObject({ status: 'unsupported-version', version: 4 });
    });

    it('degrades malformed island JSON to an empty document (never throws)', () => {
        const doc = okDocument('<script id="exe-interactive-video-contents">{ not json</script>');
        expect(doc.interactions).toEqual([]);
        expect(doc.schemaVersion).toBe(2);
    });
});

describe('normalizeV2', () => {
    it('round-trips a canonical v2 document without data loss', () => {
        const stored = safeParseJson(fixture('schema-v2/minimal.json')) as InteractiveVideoDocumentV2;
        const once = normalizeV2(stored);
        expect(once).toEqual(stored);
    });

    it('is idempotent', () => {
        const doc = okDocument(fixture('legacy/island-youtube.html'));
        const once = normalizeV2(doc);
        const twice = normalizeV2(once);
        expect(twice).toEqual(once);
    });

    it('fills defaults for missing containers (never throws)', () => {
        const doc = normalizeV2({ schemaVersion: 2 } as unknown as InteractiveVideoDocumentV2);
        expect(doc.video.provider).toBe('local');
        expect(doc.completion).toEqual({ mode: 'none', requiredScore: null });
        expect(doc.scorm).toEqual({ enabled: false, weight: 100, repeatActivity: true, showResults: true });
        expect(doc.meta.legacy).toEqual({});
    });

    it('enforces exactly one correct single-choice answer', () => {
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [
                {
                    id: 'q',
                    type: 'question',
                    time: 1,
                    question: {
                        kind: 'singleChoice',
                        prompt: 'Q',
                        answers: [
                            ['a', 1],
                            ['b', 1],
                        ],
                    },
                },
            ],
        } as unknown as InteractiveVideoDocumentV2);
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            answers: [
                ['a', 1],
                ['b', 0],
            ],
        });
    });

    it('derives missing cloze/dropdown segments from the token prompt', () => {
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [{ id: 'c', type: 'question', time: 1, question: { kind: 'cloze', prompt: 'a [[b]] c' } }],
        } as unknown as InteractiveVideoDocumentV2);
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            segments: [
                { t: 'text', text: 'a ' },
                { t: 'blank', answers: ['b'] },
                { t: 'text', text: ' c' },
            ],
        });
    });

    it('keeps at most one cover (the first one wins)', () => {
        const cover = (id: string) => ({ id, type: 'cover', time: 0, title: id, body: '' });
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [cover('iv-cover'), cover('iv-cover-2')],
        } as unknown as InteractiveVideoDocumentV2);
        expect(doc.interactions).toHaveLength(1);
        expect(doc.interactions[0]).toMatchObject({ id: 'iv-cover', type: 'cover' });
    });

    it('preserves unknown interaction types (and their payload) as unsupported', () => {
        const stranger = { id: 'x', type: 'hologram', time: 3, beam: 'blue' };
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [stranger],
        } as unknown as InteractiveVideoDocumentV2);
        expect(doc.interactions[0]).toMatchObject({ type: 'unsupported', originalType: 'hologram', time: 3 });
        expect((doc.interactions[0] as { raw?: unknown }).raw).toBe(stranger);
    });

    it('accepts the Yjs numeric-key object shape for answer rows and pairs', () => {
        // The Yjs sync layer serializes arrays nested inside jsonProperties as
        // numeric-key objects; preview, export and reopening the editor all
        // receive answers/pairs in that shape (regression: the question overlay
        // rendered without options in the workarea Preview).
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [
                {
                    id: 'q',
                    type: 'question',
                    time: 1,
                    question: {
                        kind: 'singleChoice',
                        prompt: 'Q',
                        answers: [
                            { '0': 'Blue', '1': 1 },
                            { '0': 'Green', '1': 0 },
                        ],
                    },
                },
                {
                    id: 'm',
                    type: 'question',
                    time: 2,
                    question: {
                        kind: 'matchElements',
                        prompt: 'M',
                        pairs: [{ '0': 'France', '1': 'Paris' }],
                    },
                },
            ],
        } as unknown as InteractiveVideoDocumentV2);
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            answers: [
                ['Blue', 1],
                ['Green', 0],
            ],
        });
        expect((doc.interactions[1] as QuestionInteraction).question).toMatchObject({
            pairs: [['France', 'Paris']],
        });
    });

    it('preserves unknown question kinds verbatim', () => {
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [
                { id: 'q', type: 'question', time: 1, question: { kind: 'essay', prompt: 'Write!', rubric: 'r' } },
            ],
        } as unknown as InteractiveVideoDocumentV2);
        expect((doc.interactions[0] as QuestionInteraction).question).toMatchObject({
            kind: 'essay',
            prompt: 'Write!',
            rubric: 'r',
        });
    });

    it('survives question objects that are not one', () => {
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [
                { id: 'a', type: 'question', time: 1, question: null },
                { id: 'b', type: 'question', time: 2 },
            ],
        } as unknown as InteractiveVideoDocumentV2);
        expect(doc.interactions).toHaveLength(2);
    });

    it('drops null entries and coerces malformed fields', () => {
        const doc = normalizeV2({
            schemaVersion: 2,
            interactions: [null, { id: 'n', type: 'note', time: '00:05', duration: 'x', pause: 1, body: 7 }],
        } as unknown as InteractiveVideoDocumentV2);
        expect(doc.interactions).toHaveLength(1);
        // A non-string body cannot be trusted as HTML; it normalizes to empty.
        expect(doc.interactions[0]).toMatchObject({ time: 5, duration: null, pause: true, body: '' });
    });
});

describe('serializeDocument', () => {
    it('produces a JSON string that round-trips back to the document', () => {
        const doc = okDocument({ slides: [{ type: 'text', text: 'hi', startTime: 2 }] });
        const json = serializeDocument(doc);
        expect(typeof json).toBe('string');
        expect(safeParseJson(json)).toEqual(doc);
    });

    it('always stamps the current schema version', () => {
        const json = serializeDocument({ interactions: [] });
        expect((safeParseJson(json) as { schemaVersion: number }).schemaVersion).toBe(2);
    });
});

describe('the whole pipeline', () => {
    it('a legacy document opened and saved persists ONLY as schema v2', () => {
        const opened = okDocument(fixture('legacy/island-youtube.html'));
        const persisted = safeParseJson(serializeDocument(opened)) as Record<string, unknown>;
        expect(persisted.schemaVersion).toBe(2);
        // Reopening the persisted document no longer touches the migration path.
        const reopened = okDocument(persisted);
        expect(reopened).toEqual(opened);
    });
});
