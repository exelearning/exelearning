/**
 * Schema v2 hydration, normalization and serialization.
 *
 * `hydrateDocument` is the single entry point every consumer (editor, learner
 * runtime, preview) uses to turn stored data of ANY supported shape into a
 * well-formed schema-v2 document:
 *
 *   - original legacy content (HTML island / `htmlView` / `textTextarea` /
 *     parsed `slides` object)  -> migrated directly to v2;
 *   - schema v2                -> normalized field by field (never cast);
 *   - schemaVersion > 2        -> rejected as `unsupported-version`, with the
 *     original payload preserved so callers can refuse a destructive save.
 *
 * There are no intermediate schemas: v2 is the only published versioned shape.
 */

import { normalizeCaptions } from './captions';
import { parsePromptText } from './cloze';
import {
    coerceAnswerRows,
    coerceMatchPairs,
    enforceSingleChoiceCorrect,
    isLegacyIslandHtml,
    migrateLegacyToV2,
    readLegacyIsland,
} from './migration';
import { toSeconds } from './time';
import type {
    CompletionMode,
    CompletionSettings,
    Interaction,
    InteractiveVideoDocumentV2,
    NoteAsset,
    PromptSegment,
    ProviderId,
    Question,
    ScormSettings,
    VideoSource,
} from './types';
import { isRecord, newDocument, SCHEMA_VERSION } from './types';

export { SCHEMA_VERSION };

export type HydrationResult =
    | {
          status: 'ok';
          document: InteractiveVideoDocumentV2;
      }
    | {
          status: 'unsupported-version';
          version: number;
          original: unknown;
      }
    | {
          status: 'invalid';
          reason: string;
      };

const PROVIDERS: readonly ProviderId[] = ['youtube', 'vimeo', 'mediateca', 'local'];
const COMPLETION_MODES: readonly CompletionMode[] = ['none', 'watch', 'answerRequired', 'scoreThreshold'];

function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function asStringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null;
}

function coerceVideo(value: unknown): VideoSource {
    const record = isRecord(value) ? value : {};
    const provider = asString(record.provider);
    return {
        provider: (PROVIDERS as readonly string[]).includes(provider) ? (provider as ProviderId) : 'local',
        url: asString(record.url),
        videoId: asStringOrNull(record.videoId),
        assetId: asStringOrNull(record.assetId),
        captions: normalizeCaptions(record.captions),
        start: toSeconds(record.start),
    };
}

function coerceCompletion(value: unknown): CompletionSettings {
    const record = isRecord(value) ? value : {};
    const mode = asString(record.mode);
    // `Number(null)` is 0, so an absent threshold must be caught before the
    // numeric coercion — "no threshold" and "threshold 0" are different rules.
    const requiredScore =
        record.requiredScore == null || record.requiredScore === '' ? NaN : Number(record.requiredScore);
    return {
        mode: (COMPLETION_MODES as readonly string[]).includes(mode) ? (mode as CompletionMode) : 'none',
        requiredScore: isFinite(requiredScore) ? requiredScore : null,
    };
}

function coerceScorm(value: unknown): ScormSettings {
    const record = isRecord(value) ? value : {};
    const weight = Number(record.weight);
    return {
        enabled: !!record.enabled,
        weight: isFinite(weight) ? weight : 100,
        repeatActivity: record.repeatActivity !== false,
        showResults: record.showResults !== false,
    };
}

function coerceSegments(value: unknown): PromptSegment[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const out: PromptSegment[] = [];
    for (const item of value) {
        if (!isRecord(item)) {
            continue;
        }
        if (item.t === 'blank') {
            out.push({
                t: 'blank',
                answers: Array.isArray(item.answers) ? item.answers.map(v => (v == null ? '' : String(v))) : [],
            });
        } else if (item.t === 'text') {
            out.push({ t: 'text', text: asString(item.text) });
        }
    }
    return out;
}

function coerceStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map(item => (item == null ? '' : String(item)));
}

/**
 * Coerce a stored question into its final v2 form. Known kinds get exactly the
 * fields their kind needs (single-choice keeps exactly one correct answer;
 * cloze/dropdown derive missing `segments` from the plain-text `[[…]]`
 * prompt); an unknown kind is preserved verbatim so it is never destroyed.
 */
function coerceQuestion(value: unknown): Question {
    const record = isRecord(value) ? value : {};
    const kind = asString(record.kind);
    const base = {
        prompt: asString(record.prompt),
        score: isFinite(Number(record.score)) ? Number(record.score) : 1,
        retry: record.retry !== false,
    };
    switch (kind) {
        case 'singleChoice':
            return { kind, ...base, answers: enforceSingleChoiceCorrect(coerceAnswerRows(record.answers)) };
        case 'multipleChoice':
            return { kind, ...base, answers: coerceAnswerRows(record.answers) };
        case 'trueFalse':
            return { kind, ...base, solution: Number(record.solution) === 1 ? 1 : 0 };
        case 'dropdown': {
            const segments = Array.isArray(record.segments)
                ? coerceSegments(record.segments)
                : parsePromptText(base.prompt);
            return { kind, ...base, segments, additionalWords: coerceStringList(record.additionalWords) };
        }
        case 'cloze': {
            const segments = Array.isArray(record.segments)
                ? coerceSegments(record.segments)
                : parsePromptText(base.prompt);
            return { kind, ...base, segments };
        }
        case 'matchElements':
            return { kind, ...base, pairs: coerceMatchPairs(record.pairs) };
        case 'sortableList':
            return { kind, ...base, items: coerceStringList(record.items) };
        default:
            // Unknown kind: preserve every stored field, only guaranteeing the
            // base contract on top of it.
            return { ...record, ...base, kind };
    }
}

const INTERACTION_TYPES = ['cover', 'note', 'pause', 'question', 'jump', 'unsupported'] as const;

function coerceDuration(value: unknown): number | null {
    if (value == null || value === '') {
        return null;
    }
    const parsed = Number(value);
    return isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function coerceNoteAsset(value: unknown): NoteAsset | null {
    if (!isRecord(value)) {
        return null;
    }
    return {
        assetId: asStringOrNull(value.assetId),
        url: asString(value.url),
        alt: asString(value.alt),
        width: typeof value.width === 'number' || typeof value.width === 'string' ? value.width : null,
        height: typeof value.height === 'number' || typeof value.height === 'string' ? value.height : null,
    };
}

/** Coerce one stored interaction; unknown types are preserved as `unsupported`. */
function coerceInteraction(value: unknown, index: number): Interaction {
    const record = isRecord(value) ? value : {};
    const type = asString(record.type);
    const base = {
        id: typeof record.id === 'string' && record.id !== '' ? record.id : 'iv-' + index,
        time: toSeconds(record.time),
        duration: coerceDuration(record.duration),
        pause: !!record.pause,
    };
    switch (type) {
        case 'cover':
            return { ...base, type, title: asString(record.title), body: asString(record.body) };
        case 'note': {
            const asset = coerceNoteAsset(record.asset);
            return asset
                ? { ...base, type, body: asString(record.body), asset }
                : { ...base, type, body: asString(record.body) };
        }
        case 'pause':
            return { ...base, type, body: asString(record.body) };
        case 'question':
            return { ...base, type, question: coerceQuestion(record.question) };
        case 'jump': {
            const jump = isRecord(record.jump) ? record.jump : {};
            return { ...base, type, jump: { toTime: Number(jump.toTime) } };
        }
        case 'unsupported':
            return {
                ...base,
                type,
                ...('originalType' in record ? { originalType: record.originalType } : {}),
                ...('raw' in record ? { raw: record.raw } : {}),
            };
        default:
            // A type this runtime does not know: keep it, and everything it
            // carried, as an `unsupported` interaction so nothing is lost.
            return { ...base, type: 'unsupported', originalType: type, raw: value };
    }
}

function coerceCustomTexts(value: unknown): Record<string, string> {
    if (!isRecord(value)) {
        return {};
    }
    const out: Record<string, string> = {};
    for (const key of Object.keys(value)) {
        const text = value[key];
        if (typeof text === 'string' && text !== '') {
            out[key] = text;
        }
    }
    return out;
}

/**
 * Normalize a schema-v2 document field by field (idempotent, never throws,
 * never a cast). Also the coercion step `hydrateDocument` applies to stored
 * v2 data: every field is rebuilt from the input with safe defaults, at most
 * one interaction may be a cover, and question invariants (exactly one
 * correct single-choice answer, segments present for cloze/dropdown) are
 * enforced.
 */
export function normalizeV2(input: InteractiveVideoDocumentV2 | Record<string, unknown>): InteractiveVideoDocumentV2 {
    const record: Record<string, unknown> = isRecord(input) ? input : {};
    const doc = newDocument();
    doc.title = asString(record.title);
    doc.description = asString(record.description);
    doc.video = coerceVideo(record.video);
    doc.completion = coerceCompletion(record.completion);
    doc.scorm = coerceScorm(record.scorm);
    // `contentBefore`/`contentAfter` are intentionally NOT part of the model:
    // the importer converts them into sibling Text iDevices in the same block
    // (see src/shared/import), so surrounding content is authored as ordinary
    // block members rather than as fields of this iDevice.
    doc.customTexts = coerceCustomTexts(record.customTexts);
    const meta = isRecord(record.meta) ? record.meta : {};
    doc.meta = { legacy: isRecord(meta.legacy) ? { ...meta.legacy } : {} };

    const rawInteractions = Array.isArray(record.interactions) ? record.interactions : [];
    const interactions: Interaction[] = [];
    let hasCover = false;
    rawInteractions.forEach((raw, index) => {
        if (raw == null) {
            return;
        }
        const interaction = coerceInteraction(raw, index);
        if (interaction.type === 'cover') {
            // The cover is a singleton; a duplicate (hand-edited data) is dropped.
            if (hasCover) {
                return;
            }
            hasCover = true;
        }
        interactions.push(interaction);
    });
    doc.interactions = interactions;
    return doc;
}

/**
 * Hydrate stored data of any supported shape into a schema-v2 document.
 * See the module doc for the supported inputs. Never throws.
 */
export function hydrateDocument(input: unknown): HydrationResult {
    if (input == null) {
        return { status: 'ok', document: newDocument() };
    }
    if (typeof input === 'string') {
        return hydrateIsland(input);
    }
    if (!isRecord(input)) {
        return { status: 'invalid', reason: 'Stored data is not an object or an HTML fragment.' };
    }
    const version = Number(input.schemaVersion);
    if (version === SCHEMA_VERSION) {
        return { status: 'ok', document: normalizeV2(input) };
    }
    if (isFinite(version) && version > SCHEMA_VERSION) {
        return { status: 'unsupported-version', version, original: input };
    }
    // Legacy interactive-videos keep their data in the htmlView island (and its
    // Text-bag mirror), not in jsonProperties — prefer the island whenever one
    // is present: it is a superset (slides + video URL) and the ONLY place the
    // URL survives.
    if (isLegacyIslandHtml(input.textTextarea)) {
        return hydrateIsland(input.textTextarea);
    }
    if (isLegacyIslandHtml(input.htmlView)) {
        return hydrateIsland(input.htmlView);
    }
    return { status: 'ok', document: migrateLegacyToV2(input) };
}

/** Hydrate from a legacy HTML island fragment (or any stored HTML string). */
function hydrateIsland(html: string): HydrationResult {
    const island = readLegacyIsland(html);
    const parsed = island.parsed;
    if (isRecord(parsed)) {
        const version = Number(parsed.schemaVersion);
        if (version === SCHEMA_VERSION) {
            return { status: 'ok', document: normalizeV2(parsed) };
        }
        if (isFinite(version) && version > SCHEMA_VERSION) {
            return { status: 'unsupported-version', version, original: parsed };
        }
    }
    return { status: 'ok', document: migrateLegacyToV2(parsed, island.videoUrl) };
}

/**
 * Serialize a document to a JSON string, normalizing first so what is stored
 * is always a well-formed v2 document.
 */
export function serializeDocument(doc: InteractiveVideoDocumentV2 | Record<string, unknown>): string {
    return JSON.stringify(normalizeV2(doc));
}
