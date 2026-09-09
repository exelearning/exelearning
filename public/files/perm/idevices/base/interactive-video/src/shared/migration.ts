/**
 * Direct migration of ORIGINAL (pre-refactor, unversioned) Interactive Video
 * content to schema v2. There are no intermediate schemas: the legacy
 * `slides[]` model — found in the historical HTML data island, in `htmlView`/
 * `textTextarea` mirrors, or as a parsed object — is converted straight to the
 * final v2 shape in one pass. Idempotence is a property of the whole pipeline:
 * once saved as v2 a document never goes through this module again.
 *
 * Never throws: a malformed slide degrades to an `unsupported` interaction
 * that preserves the original data verbatim; malformed JSON degrades to an
 * empty document.
 */

import { htmlPromptToSegments, segmentsToPromptText } from './cloze';
import { escapeHtml } from './html';
import { toSeconds } from './time';
import type {
    AnswerRow,
    CoverInteraction,
    Interaction,
    InteractiveVideoDocumentV2,
    MatchPair,
    NoteInteraction,
} from './types';
import { isRecord, newDocument } from './types';
import { normalizeVideoSource } from './video-source';

/** Legacy top-level fields preserved verbatim under `meta.legacy`. */
const LEGACY_TOP_LEVEL_KEYS = [
    'i18n',
    'scoreNIA',
    'evaluation',
    'evaluationID',
    'ideviceID',
    'coverType',
    'poster',
    'posterDescription',
    'weighted',
] as const;

/**
 * Parse a JSON string, recovering from raw control characters (common in
 * legacy content and otherwise fatal to JSON.parse). Returns `null` on failure
 * so callers can fall back to an empty document instead of throwing.
 */
export function safeParseJson(text: unknown): unknown {
    if (typeof text !== 'string' || text === '') {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        try {
            // biome-ignore lint/suspicious/noControlCharactersInRegex: raw control characters are exactly what legacy JSON smuggles; they are escaped here so JSON.parse can recover it.
            const cleaned = text.replace(/[\u0000-\u001f]/g, ch => {
                return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4);
            });
            return JSON.parse(cleaned);
        } catch {
            return null;
        }
    }
}

/** First-correct-wins: keep the first correct answer, zero the rest. */
export function enforceSingleChoiceCorrect(answers: AnswerRow[]): AnswerRow[] {
    let seenCorrect = false;
    return answers.map((answer): AnswerRow => {
        if (answer[1] === 1) {
            if (seenCorrect) {
                return [answer[0], 0];
            }
            seenCorrect = true;
        }
        return answer;
    });
}

/**
 * Read one stored two-value row. Rows are authored as `[a, b]` tuples, but the
 * Yjs sync layer serializes arrays nested INSIDE jsonProperties as numeric-key
 * objects (`{"0": a, "1": b}`) — that is the shape preview/export/reopen
 * actually receive, and the pre-TypeScript runtime read it transparently via
 * index access. Accept both; anything else is not a row.
 */
function rowValues(value: unknown): [unknown, unknown] | null {
    if (Array.isArray(value)) {
        return [value[0], value[1]];
    }
    if (isRecord(value) && ('0' in value || '1' in value)) {
        return [value['0'], value['1']];
    }
    return null;
}

/** Coerce a stored choice-answers value into clean `[text, 0|1]` rows. */
export function coerceAnswerRows(value: unknown): AnswerRow[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const rows: AnswerRow[] = [];
    for (const item of value) {
        const row = rowValues(item);
        if (!row) {
            continue;
        }
        rows.push([String(row[0] == null ? '' : row[0]), row[1] === 1 ? 1 : 0]);
    }
    return rows;
}

/** Coerce a stored pairs value into clean `[left, right]` rows. */
export function coerceMatchPairs(value: unknown): MatchPair[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const pairs: MatchPair[] = [];
    for (const item of value) {
        const row = rowValues(item);
        if (!row) {
            continue;
        }
        pairs.push([String(row[0] == null ? '' : row[0]), String(row[1] == null ? '' : row[1])]);
    }
    return pairs;
}

/** Coerce a legacy string list (sortable items, distractor words). */
export function coerceStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(item => (item == null ? '' : String(item)));
}

/**
 * Convert one legacy slide into a final-form v2 interaction (never throws).
 * Question slides come out already normalized: single-choice keeps exactly one
 * correct answer, and cloze/dropdown prompts are converted from their legacy
 * line-through HTML into the HTML-free `segments` model with a plain-text
 * `[[…]]` prompt.
 */
export function migrateLegacySlide(slide: unknown, index: number): Interaction {
    const source = isRecord(slide) ? slide : {};
    const time = toSeconds(source.startTime);
    const hasEnd = source.endTime !== undefined && source.endTime !== null && source.endTime !== '';
    const base = {
        id: 'iv-' + index,
        time: time,
        duration: hasEnd ? Math.max(0, toSeconds(source.endTime) - time) : null,
        pause: !hasEnd,
    };
    switch (source.type) {
        case 'text':
            return { ...base, type: 'note', body: typeof source.text === 'string' ? source.text : '' };
        case 'image': {
            const note: NoteInteraction = {
                ...base,
                type: 'note',
                body: '',
                asset: {
                    assetId: null,
                    url: typeof source.url === 'string' ? source.url : '',
                    alt: typeof source.description === 'string' ? source.description : '',
                    width: typeof source.width === 'number' || typeof source.width === 'string' ? source.width : null,
                    height:
                        typeof source.height === 'number' || typeof source.height === 'string' ? source.height : null,
                },
            };
            return note;
        }
        case 'singleChoice':
        case 'multipleChoice': {
            const answers = coerceAnswerRows(source.answers);
            return {
                ...base,
                type: 'question',
                question: {
                    kind: source.type,
                    prompt: typeof source.question === 'string' ? source.question : '',
                    answers: source.type === 'singleChoice' ? enforceSingleChoiceCorrect(answers) : answers,
                    score: 1,
                    retry: true,
                },
            };
        }
        case 'dropdown': {
            const segments = htmlPromptToSegments(typeof source.text === 'string' ? source.text : '');
            return {
                ...base,
                type: 'question',
                question: {
                    kind: 'dropdown',
                    prompt: segmentsToPromptText(segments),
                    segments: segments,
                    additionalWords: coerceStringList(source.additionalWords),
                    score: 1,
                    retry: true,
                },
            };
        }
        case 'cloze': {
            const segments = htmlPromptToSegments(typeof source.text === 'string' ? source.text : '');
            return {
                ...base,
                type: 'question',
                question: {
                    kind: 'cloze',
                    prompt: segmentsToPromptText(segments),
                    segments: segments,
                    score: 1,
                    retry: true,
                },
            };
        }
        case 'matchElements':
            return {
                ...base,
                type: 'question',
                question: {
                    kind: 'matchElements',
                    prompt: typeof source.text === 'string' ? source.text : '',
                    pairs: coerceMatchPairs(source.pairs),
                    score: 1,
                    retry: true,
                },
            };
        case 'sortableList':
            return {
                ...base,
                type: 'question',
                question: {
                    kind: 'sortableList',
                    prompt: typeof source.text === 'string' ? source.text : '',
                    items: coerceStringList(source.items),
                    score: 1,
                    retry: true,
                },
            };
        default:
            return { ...base, type: 'unsupported', originalType: source.type, raw: slide };
    }
}

/**
 * Build the singleton "cover" interaction: a note-like opener pinned to time
 * 0, never graded, always sorted first. Its body is rich text; when built from
 * a legacy poster it holds that image. `id` is fixed so re-migration cannot
 * create a duplicate.
 */
export function buildCoverInteraction(body: string, title?: string): CoverInteraction {
    return {
        id: 'iv-cover',
        type: 'cover',
        time: 0,
        duration: null,
        pause: false,
        title: typeof title === 'string' ? title : '',
        body: body || '',
    };
}

/** Cover body markup for a legacy poster image reference. */
export function coverBodyFromPoster(imageUrl: unknown, alt: unknown): string {
    return imageUrl
        ? '<p><img src="' +
              escapeHtml(String(imageUrl)) +
              '" alt="' +
              escapeHtml(alt == null ? '' : String(alt)) +
              '"></p>'
        : '';
}

/**
 * Migrate a parsed legacy (unversioned) document straight to schema v2.
 * `videoUrl` is the address extracted from the sibling
 * `#exe-interactive-video-file` link during island hydration — the ONLY place
 * the original iDevice kept the video URL. Never throws.
 *
 * Every legacy activity opened on a "cover" (its poster, or its title/
 * description shown as a start gate); that opener is re-created as a `cover`
 * interaction. `coverType` is only present on legacy content, so documents
 * without it never gain a spurious cover.
 */
export function migrateLegacyToV2(input: unknown, videoUrl?: string): InteractiveVideoDocumentV2 {
    const old = isRecord(input) ? input : {};
    const doc = newDocument();
    doc.title = typeof old.title === 'string' ? old.title : '';
    doc.description = typeof old.description === 'string' ? old.description : '';
    const slides = Array.isArray(old.slides) ? old.slides : [];
    doc.interactions = slides.map(migrateLegacySlide);

    if (videoUrl) {
        const normalized = normalizeVideoSource(videoUrl);
        if (normalized) {
            doc.video.provider = normalized.provider;
            doc.video.url = normalized.url;
            doc.video.videoId = normalized.videoId;
        }
    }

    const oldScorm = isRecord(old.scorm) ? old.scorm : {};
    doc.scorm.enabled = !!oldScorm.isScorm;
    let weight = Number(oldScorm.weighted);
    if (!isFinite(weight)) {
        weight = Number(old.weighted);
    }
    doc.scorm.weight = isFinite(weight) ? weight : 100;
    if (typeof oldScorm.repeatActivity === 'boolean') {
        doc.scorm.repeatActivity = oldScorm.repeatActivity;
    }

    for (const key of LEGACY_TOP_LEVEL_KEYS) {
        if (old[key] !== undefined) {
            doc.meta.legacy[key] = old[key];
        }
    }
    if (oldScorm.textButtonScorm !== undefined) {
        doc.meta.legacy.textButtonScorm = oldScorm.textButtonScorm;
    }

    const legacy = doc.meta.legacy;
    const posterUrl = legacy.coverType === 'poster' && typeof legacy.poster === 'string' ? legacy.poster : '';
    const posterAlt = typeof legacy.posterDescription === 'string' ? legacy.posterDescription : '';
    if (posterUrl) {
        doc.interactions.unshift(buildCoverInteraction(coverBodyFromPoster(posterUrl, posterAlt)));
    } else if (legacy.coverType) {
        // The legacy opener's title is a field of its own, not markup buried in
        // the body — so the author can still edit it as a title.
        doc.interactions.unshift(buildCoverInteraction(doc.description || '', doc.title));
    }

    return doc;
}

// ---------------------------------------------------------------------------
// Legacy HTML island
// ---------------------------------------------------------------------------

/**
 * True when `html` is a legacy interactive-video htmlView island — i.e. it
 * carries the old `#exe-interactive-video-file` link (the video URL) and/or
 * the `#exe-interactive-video-contents` JSON script. The old model kept the
 * video URL ONLY in that link, never in jsonProperties, so this island is the
 * only place to recover it. The modern render never emits these ids (it uses
 * `.exe-iv-*` markup), so this guard also stops a rendered view being mistaken
 * for a data island.
 */
export function isLegacyIslandHtml(html: unknown): html is string {
    return (
        typeof html === 'string' &&
        (html.indexOf('exe-interactive-video-file') !== -1 || html.indexOf('exe-interactive-video-contents') !== -1)
    );
}

export interface LegacyIslandContent {
    /** The parsed island JSON (`null` when absent or unparseable). */
    parsed: unknown;
    /** The video URL from the sibling `#exe-interactive-video-file` link. */
    videoUrl: string;
}

/**
 * Extract the legacy data island from a stored htmlView fragment: the
 * embedded `#exe-interactive-video-contents` JSON (script or legacy div) and
 * the sibling video link. Never throws.
 */
export function readLegacyIsland(html: unknown): LegacyIslandContent {
    if (typeof html !== 'string' || typeof DOMParser === 'undefined') {
        return { parsed: null, videoUrl: '' };
    }
    try {
        const dom = new DOMParser().parseFromString(html, 'text/html');
        const island = dom.querySelector('#exe-interactive-video-contents');
        const parsed = island ? safeParseJson((island.textContent || '').trim()) : null;
        const link = dom.querySelector('#exe-interactive-video-file a[href]');
        const videoUrl = link ? link.getAttribute('href') || '' : '';
        return { parsed, videoUrl };
    } catch {
        return { parsed: null, videoUrl: '' };
    }
}
