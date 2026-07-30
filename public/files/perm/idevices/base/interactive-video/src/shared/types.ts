/**
 * The persisted document model of the Interactive Video iDevice (schema v2)
 * and the value types shared by the editor and the learner runtime.
 *
 * Schema v2 is the ONLY published versioned schema. Content written by the
 * original (pre-refactor) iDevice is unversioned legacy data and is migrated
 * directly to v2 on open (see `migration.ts`); documents claiming a version
 * greater than 2 are rejected without being rewritten (see `schema.ts`).
 */

export type ProviderId = 'youtube' | 'vimeo' | 'mediateca' | 'local';

/** One subtitle track of the native `<video>` surface. */
export interface CaptionTrack {
    /** Asset reference or URL; `.srt` is converted to WebVTT at export time. */
    src: string;
    lang: string;
    label: string;
    default: boolean;
}

/** The declarative video descriptor: `{provider, videoId}` — never a raw embed URL. */
export interface VideoSource {
    provider: ProviderId;
    url: string;
    videoId: string | null;
    assetId: string | null;
    captions: CaptionTrack[];
    start: number;
}

/** The result of classifying a source URL (external providers get canonical URLs). */
export interface NormalizedVideoSource {
    provider: ProviderId;
    videoId: string | null;
    url: string;
}

// ---------------------------------------------------------------------------
// Cloze / dropdown prompt segments (HTML-free blank model)
// ---------------------------------------------------------------------------

export interface TextSegment {
    t: 'text';
    text: string;
}

/** A blank; `answers` holds the accepted variants (first one is canonical). */
export interface BlankSegment {
    t: 'blank';
    answers: string[];
}

export type PromptSegment = TextSegment | BlankSegment;

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

/** One choice row: `[text, correctFlag]` with `1` marking a correct answer. */
export type AnswerRow = [string, number];

/** One match row: `[left, right]`. */
export type MatchPair = [string, string];

interface QuestionBase {
    prompt: string;
    score: number;
    retry: boolean;
}

export interface SingleChoiceQuestion extends QuestionBase {
    kind: 'singleChoice';
    answers: AnswerRow[];
}

export interface MultipleChoiceQuestion extends QuestionBase {
    kind: 'multipleChoice';
    answers: AnswerRow[];
}

export interface TrueFalseQuestion extends QuestionBase {
    kind: 'trueFalse';
    /** `1` = the statement is true, `0` = false. */
    solution: 0 | 1;
}

export interface DropdownQuestion extends QuestionBase {
    kind: 'dropdown';
    segments: PromptSegment[];
    additionalWords: string[];
}

export interface ClozeQuestion extends QuestionBase {
    kind: 'cloze';
    segments: PromptSegment[];
}

export interface MatchElementsQuestion extends QuestionBase {
    kind: 'matchElements';
    pairs: MatchPair[];
}

export interface SortableListQuestion extends QuestionBase {
    /** `items` is stored in the CORRECT order; display shuffles it. */
    kind: 'sortableList';
    items: string[];
}

export type KnownQuestion =
    | SingleChoiceQuestion
    | MultipleChoiceQuestion
    | TrueFalseQuestion
    | DropdownQuestion
    | ClozeQuestion
    | MatchElementsQuestion
    | SortableListQuestion;

export type QuestionKind = KnownQuestion['kind'];

/**
 * A question whose `kind` is outside the supported set. It is preserved
 * verbatim (never destroyed, never graded) so nothing an author made is lost.
 */
export interface UnsupportedQuestion extends QuestionBase {
    kind: string;
    [extra: string]: unknown;
}

export type Question = KnownQuestion | UnsupportedQuestion;

export const QUESTION_KINDS: readonly QuestionKind[] = [
    'singleChoice',
    'multipleChoice',
    'trueFalse',
    'dropdown',
    'cloze',
    'matchElements',
    'sortableList',
];

export function isKnownQuestionKind(kind: string): kind is QuestionKind {
    return (QUESTION_KINDS as readonly string[]).includes(kind);
}

/** Narrow a question to the supported union (runtime-checked, not a cast). */
export function asKnownQuestion(question: Question): KnownQuestion | null {
    return isKnownQuestionKind(question.kind) ? (question as KnownQuestion) : null;
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

export interface InteractionBase {
    id: string;
    /** Seconds into the video at which the interaction fires. */
    time: number;
    /** Auto-dismiss after this many seconds; `null` = wait for Continue. */
    duration: number | null;
    /** Pause playback while the interaction is on screen. */
    pause: boolean;
}

/** An image reference shown inside a note (from legacy image slides). */
export interface NoteAsset {
    assetId: string | null;
    url: string;
    alt: string;
    width: number | string | null;
    height: number | string | null;
}

/** The singleton opener pinned to time 0; never graded, always sorted first. */
export interface CoverInteraction extends InteractionBase {
    type: 'cover';
    title: string;
    body: string;
}

export interface NoteInteraction extends InteractionBase {
    type: 'note';
    body: string;
    asset?: NoteAsset | null;
}

export interface PauseInteraction extends InteractionBase {
    type: 'pause';
    body: string;
}

export interface QuestionInteraction extends InteractionBase {
    type: 'question';
    question: Question;
}

export interface JumpInteraction extends InteractionBase {
    type: 'jump';
    jump: { toTime: number };
}

/**
 * A legacy interaction type this runtime cannot render. The original slide is
 * kept verbatim in `raw` so a round-trip can never destroy it.
 */
export interface UnsupportedLegacyInteraction extends InteractionBase {
    type: 'unsupported';
    originalType?: unknown;
    raw?: unknown;
}

export type Interaction =
    | CoverInteraction
    | NoteInteraction
    | QuestionInteraction
    | PauseInteraction
    | JumpInteraction
    | UnsupportedLegacyInteraction;

export type InteractionType = Interaction['type'];

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export type CompletionMode = 'none' | 'watch' | 'answerRequired' | 'scoreThreshold';

export interface CompletionSettings {
    mode: CompletionMode;
    requiredScore: number | null;
}

export interface ScormSettings {
    enabled: boolean;
    weight: number;
    repeatActivity: boolean;
    showResults: boolean;
}

/** Legacy fields carried verbatim (scoreNIA, evaluation, …) plus anything unknown. */
export interface DocumentMetadata {
    legacy: Record<string, unknown>;
}

export const SCHEMA_VERSION = 2 as const;

export interface InteractiveVideoDocumentV2 {
    schemaVersion: typeof SCHEMA_VERSION;
    title: string;
    description: string;
    video: VideoSource;
    interactions: Interaction[];
    completion: CompletionSettings;
    scorm: ScormSettings;
    meta: DocumentMetadata;
    /** Author overrides for learner-facing strings, by ci18n key. */
    customTexts: Record<string, string>;
}

/** A fully-defaulted, empty schema-v2 document. */
export function newDocument(): InteractiveVideoDocumentV2 {
    return {
        schemaVersion: SCHEMA_VERSION,
        title: '',
        description: '',
        video: {
            provider: 'local',
            url: '',
            videoId: null,
            assetId: null,
            captions: [],
            start: 0,
        },
        interactions: [],
        completion: { mode: 'none', requiredScore: null },
        scorm: { enabled: false, weight: 100, repeatActivity: true, showResults: true },
        meta: { legacy: {} },
        customTexts: {},
    };
}

// ---------------------------------------------------------------------------
// Runtime value types
// ---------------------------------------------------------------------------

/** A watched range `[from, to]` in seconds. */
export type PlayedSegment = [number, number];

/** What the learner has actually watched, as sorted disjoint ranges. */
export interface PlaybackProgress {
    segments: PlayedSegment[];
    /** Every second played, including re-watched ones. */
    totalWatchTime: number;
}

/** Aggregated score in the shapes SCORM and the legacy report expect. */
export interface ScoreSummary {
    raw: number;
    max: number;
    fraction: number;
    scaled10: number;
    percent: number;
}

/** The state the completion rules read (see `computeCompletion`). */
export interface CompletionState {
    watched?: boolean;
    answeredIds?: Iterable<string> | null;
    score?: ScoreSummary | null;
}

/** True for a plain object (the only shape persisted data may take). */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
