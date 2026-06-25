/**
 * Unified Compact Activity Authoring Format parser.
 *
 * Parses the compact, line-based authoring syntax proposed in issue #1228
 * (`#` field separators plus optional `@key=value` parameters) into a
 * normalized, iDevice-agnostic model. Used by:
 * - the activity adapters (see ./unified-activity-adapters) that convert the
 *   normalized model into concrete iDevice data structures.
 *
 * This is an AUTHORING/IMPORT format, NOT the canonical iDevice storage model.
 *
 * Unlike the sibling parsers in this directory (which return `null`/empty on
 * failure), this parser returns a result object carrying `diagnostics`, because
 * an interactive authoring format needs actionable, line-accurate error
 * reporting. It never throws for malformed authoring text.
 *
 * @module shared/parsers/unified-activity-format
 *
 * @example
 * ```typescript
 * import { parseUnifiedActivityLine } from '@/shared/parsers';
 *
 * const result = parseUnifiedActivityLine('0#Capital of France?#Paris#Rome#Berlin');
 * if (result.ok) {
 *     // result.item is a UnifiedSelectionItem
 * }
 * ```
 */

/** The activity kinds the format can express. */
export type UnifiedActivityKind = 'selection' | 'truefalse' | 'fillblank' | 'flashcard';

/** Severity of a parse diagnostic. */
export type DiagnosticSeverity = 'error' | 'warning';

/** A single parse diagnostic (error or warning). */
export interface UnifiedActivityDiagnostic {
    /** Whether this prevents a valid item (`error`) or is advisory (`warning`). */
    severity: DiagnosticSeverity;
    /** Stable machine-readable code, e.g. `ANSWER_INDEX_OUT_OF_RANGE`. */
    code: string;
    /** Human-readable explanation. */
    message: string;
    /** 1-based line number (set when parsing batches). */
    line?: number;
}

/** Normalized, recognized parameters plus any unknown ones in `extra`. */
export interface UnifiedActivityParams {
    /** Hint shown to the learner before answering. */
    hint?: string;
    /** Explanation of the correct answer. */
    explain?: string;
    /** Feedback shown when the answer is wrong. */
    feedback?: string;
    /** Numeric score weight for the activity. */
    points?: number;
    /** Free-form difficulty marker. */
    difficulty?: string;
    /** Comma-separated tags. */
    tags?: string[];
    /** Explicit selection mode override. */
    selection?: 'single' | 'multiple';
    /** Whether options should be shuffled. */
    shuffle?: boolean;
    /** Whether answers are case-sensitive. */
    caseSensitive?: boolean;
    /** Whether grading is strict. */
    strict?: boolean;
    /** Language hint. */
    lang?: string;
    /** Unknown parameters preserved verbatim (never silently dropped). */
    extra: Record<string, string>;
}

/** Fields shared by every parsed item. */
export interface UnifiedActivityItemBase {
    kind: UnifiedActivityKind;
    params: UnifiedActivityParams;
    /** The original (trimmed) source line. */
    raw: string;
    /** 1-based line number (set when parsing batches). */
    line?: number;
}

/** A single- or multiple-answer selection question. */
export interface UnifiedSelectionItem extends UnifiedActivityItemBase {
    kind: 'selection';
    question: string;
    options: string[];
    /** 0-based indexes of the correct options, sorted and de-duplicated. */
    correctIndexes: number[];
    selectionType: 'single' | 'multiple';
}

/** A true/false statement. */
export interface UnifiedTrueFalseItem extends UnifiedActivityItemBase {
    kind: 'truefalse';
    statement: string;
    /** `true` means the statement is true. */
    answer: boolean;
}

/** A literal text segment or a blank in a fill-in-the-blank item. */
export type FillToken = { type: 'text'; value: string } | { type: 'blank'; answers: string[] };

/** A fill-in-the-blank item. */
export interface UnifiedFillBlankItem extends UnifiedActivityItemBase {
    kind: 'fillblank';
    /** Ordered text/blank tokens, enough to reconstruct the sentence. */
    tokens: FillToken[];
    /** Convenience: the accepted answers per blank, in order (correct first). */
    blanks: string[][];
}

/** A two-sided flashcard. */
export interface UnifiedFlashcardItem extends UnifiedActivityItemBase {
    kind: 'flashcard';
    front: string;
    back: string;
}

/** Any parsed activity item. */
export type UnifiedActivityItem =
    | UnifiedSelectionItem
    | UnifiedTrueFalseItem
    | UnifiedFillBlankItem
    | UnifiedFlashcardItem;

/** Options controlling a single-line or batch parse. */
export interface UnifiedActivityParseOptions {
    /** Activity kind to assume when the type cannot be inferred. */
    defaultType?: UnifiedActivityKind;
    /** Promote warnings (unknown params/escapes) to errors. */
    strict?: boolean;
    /** Value added to line numbers reported in diagnostics. */
    lineOffset?: number;
    /** Whether unknown parameters are tolerated (default `true`). */
    allowUnknownParams?: boolean;
    /** 1-based line number to stamp on diagnostics/items (internal/batch use). */
    line?: number;
}

/** Result of parsing a single line. */
export interface UnifiedActivityParseResult {
    ok: boolean;
    item?: UnifiedActivityItem;
    diagnostics: UnifiedActivityDiagnostic[];
}

/** Result of parsing multiple lines. */
export interface UnifiedActivityParseBatchResult {
    ok: boolean;
    /** Successfully parsed items, each stamped with its 1-based line number. */
    items: UnifiedActivityItem[];
    /** All diagnostics across every line. */
    diagnostics: UnifiedActivityDiagnostic[];
    /** Per-line results in source order (excluding skipped blank/comment lines). */
    results: UnifiedActivityParseResult[];
}

const ESCAPE_MAP: Record<string, string> = { '#': '#', '@': '@', '|': '|', '\\': '\\', n: '\n', t: '\t' };

const TRUE_TOKENS = new Set(['1', 'true', 't', 'yes', 'y']);
const FALSE_TOKENS = new Set(['0', 'false', 'f', 'no', 'n']);

const TYPE_ALIASES: Record<string, UnifiedActivityKind> = {
    selection: 'selection',
    select: 'selection',
    'multiple-choice': 'selection',
    multiple: 'selection',
    single: 'selection',
    mc: 'selection',
    truefalse: 'truefalse',
    'true-false': 'truefalse',
    tf: 'truefalse',
    fillblank: 'fillblank',
    'fill-in-the-blank': 'fillblank',
    cloze: 'fillblank',
    fill: 'fillblank',
    flashcard: 'flashcard',
    flashcards: 'flashcard',
    flipcard: 'flashcard',
    flipcards: 'flashcard',
};

const RECOGNIZED_PARAMS = new Set([
    'type',
    'hint',
    'explain',
    'feedback',
    'points',
    'difficulty',
    'tags',
    'selection',
    'shuffle',
    'case-sensitive',
    'strict',
    'lang',
]);

// A parameter boundary only matches a VALID key (letter-leading). Keys that do
// not conform (digit/underscore/dash-leading) stay in the payload as literal text.
const PARAM_BOUNDARY = /@[A-Za-z][A-Za-z0-9_-]*=/y;
const INDEX_COMPACT = /^\d+$/;
const INDEX_LIST = /^\d+([,|]\d+)*$/;
const INDEX_LEAD = /^\d/;

/** Internal parse state threaded through the helpers. */
interface ParseContext {
    diagnostics: UnifiedActivityDiagnostic[];
    strict: boolean;
    allowUnknownParams: boolean;
    line?: number;
}

/** Append a diagnostic carrying the current line number. */
function addDiagnostic(ctx: ParseContext, severity: DiagnosticSeverity, code: string, message: string): void {
    ctx.diagnostics.push({ severity, code, message, line: ctx.line });
}

/** Resolve known escape sequences; preserve unknown ones literally with a diagnostic. */
function unescapeText(raw: string, ctx: ParseContext): string {
    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '\\' && i + 1 < raw.length) {
            const next = raw[i + 1];
            if (next in ESCAPE_MAP) {
                out += ESCAPE_MAP[next];
                i++;
            } else {
                addDiagnostic(
                    ctx,
                    ctx.strict ? 'error' : 'warning',
                    'UNKNOWN_ESCAPE',
                    `Unknown escape sequence "\\${next}"; preserved literally.`,
                );
                out += ch;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

/** Split a string on an unescaped delimiter, keeping escapes intact for later unescaping. */
function splitRawOnUnescaped(raw: string, delimiter: string): string[] {
    const fields: string[] = [];
    let cur = '';
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '\\' && i + 1 < raw.length) {
            cur += ch + raw[i + 1];
            i++;
        } else if (ch === delimiter) {
            fields.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    fields.push(cur);
    return fields;
}

/** Split a payload on unescaped `#`, keeping escapes intact for later unescaping. */
function splitRawFields(raw: string): string[] {
    return splitRawOnUnescaped(raw, '#');
}

/**
 * Given an index `i` where a `@@` blank marker starts, return the index just
 * past its closing `@@` (or `i + 2` when the marker is unmatched). This lets the
 * parameter scanners skip over `@@…@@` regions so a blank answer such as
 * `@@x=5@@` is never mistaken for a `@key=` parameter.
 */
function skipBlankRegion(raw: string, i: number): number {
    let j = i + 2;
    while (j < raw.length) {
        if (raw[j] === '\\') {
            j += 2;
            continue;
        }
        if (raw[j] === '@' && raw[j + 1] === '@') {
            return j + 2;
        }
        j++;
    }
    return i + 2;
}

/** Find the index where the parameter section begins, or -1 if there is none. */
function findParamSectionStart(raw: string): number {
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '\\') {
            i++;
            continue;
        }
        if (raw[i] === '@' && raw[i + 1] === '@') {
            i = skipBlankRegion(raw, i) - 1;
            continue;
        }
        if (raw[i] === '@') {
            PARAM_BOUNDARY.lastIndex = i;
            if (PARAM_BOUNDARY.test(raw)) {
                return i;
            }
        }
    }
    return -1;
}

/** True if the payload contains at least one unescaped `@@` blank marker. */
function containsBlankMarker(raw: string): boolean {
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '\\') {
            i++;
            continue;
        }
        if (raw[i] === '@' && raw[i + 1] === '@') {
            return true;
        }
    }
    return false;
}

/** Split the raw parameter section into `{ rawKey, valueRaw }` segments. */
function splitParamSegments(raw: string): Array<{ rawKey: string; valueRaw: string }> {
    const boundary = /@([A-Za-z][A-Za-z0-9_-]*)=/y;
    const positions: Array<{ index: number; key: string; valueStart: number }> = [];
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '\\') {
            i++;
            continue;
        }
        if (raw[i] === '@' && raw[i + 1] === '@') {
            i = skipBlankRegion(raw, i) - 1;
            continue;
        }
        if (raw[i] === '@') {
            boundary.lastIndex = i;
            const match = boundary.exec(raw);
            if (match && match.index === i) {
                positions.push({ index: i, key: match[1], valueStart: i + match[0].length });
            }
        }
    }
    return positions.map((cur, idx) => {
        const next = positions[idx + 1];
        return { rawKey: cur.key, valueRaw: raw.slice(cur.valueStart, next ? next.index : raw.length) };
    });
}

/** Parse a boolean token, returning `undefined` when it is not a recognized token. */
function parseBooleanToken(token: string): boolean | undefined {
    const normalized = token.trim().toLowerCase();
    if (TRUE_TOKENS.has(normalized)) {
        return true;
    }
    if (FALSE_TOKENS.has(normalized)) {
        return false;
    }
    return undefined;
}

/** True if the token is a literal `true`/`false` label (used for type inference). */
function isTrueFalseLabel(token: string): boolean {
    const normalized = token.trim().toLowerCase();
    return normalized === 'true' || normalized === 'false';
}

/** Parse a boolean-ish parameter value, returning `undefined` when unrecognized. */
function parseBooleanParam(value: string): boolean | undefined {
    return parseBooleanToken(value);
}

/** Parse and normalize the parameter section into a {@link UnifiedActivityParams}. */
function parseParams(rawParams: string, ctx: ParseContext): { params: UnifiedActivityParams; typeAlias?: string } {
    const params: UnifiedActivityParams = { extra: {} };
    let typeAlias: string | undefined;
    if (rawParams === '') {
        return { params, typeAlias };
    }
    const seen = new Set<string>();
    for (const { rawKey, valueRaw } of splitParamSegments(rawParams)) {
        // The boundary regex guarantees a valid letter-leading key here.
        const key = rawKey.toLowerCase();
        const value = unescapeText(valueRaw, ctx).trim();
        if (seen.has(key)) {
            addDiagnostic(ctx, 'error', 'DUPLICATE_PARAM', `Duplicate parameter "${key}".`);
            continue;
        }
        seen.add(key);
        if (!RECOGNIZED_PARAMS.has(key)) {
            const severity: DiagnosticSeverity = ctx.strict || !ctx.allowUnknownParams ? 'error' : 'warning';
            addDiagnostic(ctx, severity, 'UNKNOWN_PARAM', `Unknown parameter "${key}".`);
            params.extra[key] = value;
            continue;
        }
        assignRecognizedParam(params, key, value, ctx, alias => {
            typeAlias = alias;
        });
    }
    return { params, typeAlias };
}

/** Assign a single recognized parameter onto the params object. */
function assignRecognizedParam(
    params: UnifiedActivityParams,
    key: string,
    value: string,
    ctx: ParseContext,
    setType: (alias: string) => void,
): void {
    switch (key) {
        case 'type':
            setType(value.toLowerCase());
            break;
        case 'hint':
            params.hint = value;
            break;
        case 'explain':
            params.explain = value;
            break;
        case 'feedback':
            params.feedback = value;
            break;
        case 'difficulty':
            params.difficulty = value;
            break;
        case 'lang':
            params.lang = value;
            break;
        case 'tags':
            params.tags = value
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            break;
        case 'points': {
            // Number('') is 0, so guard against an empty value explicitly.
            const points = value === '' ? Number.NaN : Number(value);
            if (Number.isFinite(points)) {
                params.points = points;
            } else {
                addDiagnostic(ctx, 'warning', 'INVALID_POINTS', `Parameter "points" is not a number: "${value}".`);
            }
            break;
        }
        case 'selection':
            if (value === 'single' || value === 'multiple') {
                params.selection = value;
            } else {
                addDiagnostic(ctx, 'warning', 'INVALID_PARAM_VALUE', `Parameter "selection" must be single|multiple.`);
            }
            break;
        case 'shuffle':
            assignBooleanParam(params, 'shuffle', value, ctx);
            break;
        case 'strict':
            assignBooleanParam(params, 'strict', value, ctx);
            break;
        case 'case-sensitive':
            assignBooleanParam(params, 'caseSensitive', value, ctx);
            break;
        default:
            break;
    }
}

/** Assign a boolean parameter, warning on unrecognized values. */
function assignBooleanParam(
    params: UnifiedActivityParams,
    field: 'shuffle' | 'strict' | 'caseSensitive',
    value: string,
    ctx: ParseContext,
): void {
    const parsed = parseBooleanParam(value);
    if (parsed === undefined) {
        addDiagnostic(ctx, 'warning', 'INVALID_PARAM_VALUE', `Parameter "${field}" is not a boolean: "${value}".`);
        return;
    }
    params[field] = parsed;
}

/** Resolve the activity kind from explicit type, default, or inference. */
function resolveKind(
    rawPayload: string,
    typeAlias: string | undefined,
    fieldsForInference: string[] | undefined,
    options: UnifiedActivityParseOptions,
    ctx: ParseContext,
): UnifiedActivityKind | undefined {
    if (typeAlias !== undefined) {
        const kind = TYPE_ALIASES[typeAlias];
        if (!kind) {
            addDiagnostic(ctx, 'error', 'UNKNOWN_TYPE', `Unknown @type value "${typeAlias}".`);
            return undefined;
        }
        return kind;
    }
    if (options.defaultType) {
        return options.defaultType;
    }
    if (containsBlankMarker(rawPayload)) {
        return 'fillblank';
    }
    const fields = fieldsForInference ?? [];
    if (
        fields.length === 4 &&
        parseBooleanToken(fields[0]) !== undefined &&
        isTrueFalseLabel(fields[2]) &&
        isTrueFalseLabel(fields[3])
    ) {
        return 'truefalse';
    }
    if (fields.length >= 3 && INDEX_LEAD.test(fields[0] ?? '')) {
        return 'selection';
    }
    addDiagnostic(
        ctx,
        'error',
        'AMBIGUOUS_TYPE',
        'Cannot infer the activity type; add an explicit @type= parameter (for example @type=flashcard or @type=selection).',
    );
    return undefined;
}

/** Parse the answer-index specification of a selection question into 0-based indexes. */
function parseAnswerIndexes(spec: string, optionCount: number, ctx: ParseContext): number[] {
    if (spec === '') {
        addDiagnostic(ctx, 'error', 'NO_CORRECT_ANSWER', 'A selection question needs at least one correct answer.');
        return [];
    }
    let parts: string[];
    if (INDEX_COMPACT.test(spec)) {
        parts = spec.split('');
    } else if (INDEX_LIST.test(spec)) {
        parts = spec.split(/[,|]/);
    } else {
        addDiagnostic(ctx, 'error', 'INVALID_ANSWER_INDEX', `Invalid answer index specification "${spec}".`);
        return [];
    }
    // INDEX_COMPACT/INDEX_LIST guarantee every part is a non-negative integer.
    const indexes: number[] = [];
    const seen = new Set<number>();
    for (const part of parts) {
        const value = Number(part);
        if (value >= optionCount) {
            addDiagnostic(
                ctx,
                'error',
                'ANSWER_INDEX_OUT_OF_RANGE',
                `Answer index ${value} is out of range (0..${optionCount - 1}).`,
            );
            continue;
        }
        if (seen.has(value)) {
            addDiagnostic(ctx, 'error', 'DUPLICATE_ANSWER_INDEX', `Duplicate answer index ${value}.`);
            continue;
        }
        seen.add(value);
        indexes.push(value);
    }
    return indexes.sort((a, b) => a - b);
}

/** Build a {@link UnifiedSelectionItem} from already-split, unescaped fields. */
function parseSelection(
    fields: string[],
    params: UnifiedActivityParams,
    raw: string,
    ctx: ParseContext,
): UnifiedSelectionItem | undefined {
    const question = fields[1] ?? '';
    const options = fields.slice(2);
    let failed = false;
    if (!question.trim()) {
        addDiagnostic(ctx, 'error', 'EMPTY_QUESTION', 'The question text is empty.');
        failed = true;
    }
    if (options.length < 2) {
        addDiagnostic(ctx, 'error', 'TOO_FEW_OPTIONS', 'A selection question needs at least two options.');
        failed = true;
    }
    if (options.some(option => !option.trim())) {
        addDiagnostic(ctx, 'error', 'EMPTY_OPTION', 'Selection options must not be empty.');
        failed = true;
    }
    const correctIndexes = parseAnswerIndexes(fields[0] ?? '', options.length, ctx);
    const override = params.selection;
    const inferredMultiple = correctIndexes.length > 1;
    let selectionType: 'single' | 'multiple';
    if (override === 'single') {
        if (inferredMultiple) {
            addDiagnostic(
                ctx,
                'error',
                'SELECTION_SINGLE_CONFLICT',
                'A single-selection question cannot have multiple correct answers.',
            );
            failed = true;
        }
        selectionType = 'single';
    } else if (override === 'multiple') {
        selectionType = 'multiple';
    } else {
        selectionType = inferredMultiple ? 'multiple' : 'single';
    }
    if (failed || ctx.diagnostics.some(d => d.severity === 'error')) {
        return undefined;
    }
    return { kind: 'selection', question, options, correctIndexes, selectionType, params, raw };
}

/** Build a {@link UnifiedTrueFalseItem} from already-split, unescaped fields. */
function parseTrueFalse(
    fields: string[],
    params: UnifiedActivityParams,
    raw: string,
    ctx: ParseContext,
): UnifiedTrueFalseItem | undefined {
    if (fields.length !== 2 && fields.length !== 4) {
        addDiagnostic(
            ctx,
            'error',
            'TRUEFALSE_BAD_SHAPE',
            'A true/false line needs `answer#statement` or `answer#statement#TrueLabel#FalseLabel`.',
        );
        return undefined;
    }
    const answer = parseBooleanToken(fields[0]);
    const statement = fields[1] ?? '';
    let failed = false;
    if (answer === undefined) {
        addDiagnostic(ctx, 'error', 'INVALID_BOOLEAN', `"${fields[0]}" is not a valid true/false answer.`);
        failed = true;
    }
    if (!statement.trim()) {
        addDiagnostic(ctx, 'error', 'EMPTY_STATEMENT', 'The true/false statement is empty.');
        failed = true;
    }
    if (failed || answer === undefined) {
        return undefined;
    }
    return { kind: 'truefalse', statement, answer, params, raw };
}

/** Build a {@link UnifiedFlashcardItem} from already-split, unescaped fields. */
function parseFlashcard(
    fields: string[],
    params: UnifiedActivityParams,
    raw: string,
    ctx: ParseContext,
): UnifiedFlashcardItem | undefined {
    if (fields.length < 2) {
        addDiagnostic(ctx, 'error', 'MISSING_BACK', 'A flashcard needs a back side: `front#back`.');
        return undefined;
    }
    if (fields.length > 2) {
        addDiagnostic(ctx, 'error', 'TOO_MANY_FIELDS', 'A flashcard has exactly two fields: `front#back`.');
        return undefined;
    }
    const [front, back] = fields;
    let failed = false;
    if (!front.trim()) {
        addDiagnostic(ctx, 'error', 'EMPTY_FRONT', 'The flashcard front is empty.');
        failed = true;
    }
    if (!back.trim()) {
        addDiagnostic(ctx, 'error', 'EMPTY_BACK', 'The flashcard back is empty.');
        failed = true;
    }
    if (failed) {
        return undefined;
    }
    return { kind: 'flashcard', front, back, params, raw };
}

/** Build a {@link UnifiedFillBlankItem} by scanning `@@answer@@` markers in the payload. */
function parseFillBlank(
    rawPayload: string,
    params: UnifiedActivityParams,
    raw: string,
    ctx: ParseContext,
): UnifiedFillBlankItem | undefined {
    const tokens: FillToken[] = [];
    const blanks: string[][] = [];
    let textBuffer = '';
    let foundBlank = false;
    let i = 0;
    while (i < rawPayload.length) {
        const ch = rawPayload[i];
        if (ch === '\\' && i + 1 < rawPayload.length) {
            textBuffer += ch + rawPayload[i + 1];
            i += 2;
            continue;
        }
        if (ch === '@' && rawPayload[i + 1] === '@') {
            let j = i + 2;
            let blankRaw = '';
            let closed = false;
            while (j < rawPayload.length) {
                if (rawPayload[j] === '\\' && j + 1 < rawPayload.length) {
                    blankRaw += rawPayload[j] + rawPayload[j + 1];
                    j += 2;
                    continue;
                }
                if (rawPayload[j] === '@' && rawPayload[j + 1] === '@') {
                    closed = true;
                    break;
                }
                blankRaw += rawPayload[j];
                j++;
            }
            if (!closed) {
                addDiagnostic(ctx, 'error', 'UNMATCHED_BLANK', 'Unmatched @@ blank marker.');
                return undefined;
            }
            foundBlank = true;
            if (textBuffer.length > 0) {
                tokens.push({ type: 'text', value: unescapeText(textBuffer, ctx) });
                textBuffer = '';
            }
            const alternatives = splitRawOnUnescaped(blankRaw, '|').map(alt => unescapeText(alt, ctx).trim());
            const answers = alternatives.filter(alt => alt.length > 0);
            // Only warn about a dropped alternative when a real answer survived;
            // a fully empty blank is reported by EMPTY_BLANK instead.
            if (answers.length > 0 && answers.length < alternatives.length) {
                addDiagnostic(ctx, 'warning', 'EMPTY_ALTERNATIVE', 'Empty blank alternative was dropped.');
            }
            if (answers.length === 0) {
                addDiagnostic(ctx, 'error', 'EMPTY_BLANK', 'A blank must contain at least one answer.');
            } else {
                tokens.push({ type: 'blank', answers });
                blanks.push(answers);
            }
            i = j + 2;
            continue;
        }
        textBuffer += ch;
        i++;
    }
    if (textBuffer.length > 0) {
        tokens.push({ type: 'text', value: unescapeText(textBuffer, ctx) });
    }
    if (!foundBlank) {
        addDiagnostic(ctx, 'error', 'NO_BLANKS', 'A fill-in-the-blank item needs at least one @@answer@@ blank.');
    }
    if (ctx.diagnostics.some(d => d.severity === 'error')) {
        return undefined;
    }
    return { kind: 'fillblank', tokens, blanks, params, raw };
}

/**
 * Parse a single logical line of the unified compact activity format.
 *
 * Never throws for malformed authoring text; failures are reported through the
 * returned `diagnostics` and `ok: false`.
 */
export function parseUnifiedActivityLine(
    input: string,
    options: UnifiedActivityParseOptions = {},
): UnifiedActivityParseResult {
    const ctx: ParseContext = {
        diagnostics: [],
        strict: options.strict ?? false,
        allowUnknownParams: options.allowUnknownParams ?? true,
        line: options.line,
    };
    const line = input.trim();
    const paramStart = findParamSectionStart(line);
    const rawPayload = paramStart === -1 ? line : line.slice(0, paramStart);
    const rawParams = paramStart === -1 ? '' : line.slice(paramStart);

    const { params, typeAlias } = parseParams(rawParams, ctx);

    const isExplicitFill = typeAlias !== undefined && TYPE_ALIASES[typeAlias] === 'fillblank';
    const fields =
        isExplicitFill ||
        (typeAlias === undefined && options.defaultType === undefined && containsBlankMarker(rawPayload))
            ? undefined
            : splitRawFields(rawPayload).map(field => unescapeText(field, ctx));

    const kind = resolveKind(rawPayload, typeAlias, fields, options, ctx);

    // The @type=single / @type=multiple aliases also fix the selection mode,
    // unless an explicit @selection= already set it (which takes precedence).
    if ((typeAlias === 'single' || typeAlias === 'multiple') && params.selection === undefined) {
        params.selection = typeAlias;
    }

    let item: UnifiedActivityItem | undefined;
    if (kind === 'fillblank') {
        item = parseFillBlank(rawPayload, params, line, ctx);
    } else if (kind === 'selection') {
        item = parseSelection(fields ?? [], params, line, ctx);
    } else if (kind === 'truefalse') {
        item = parseTrueFalse(fields ?? [], params, line, ctx);
    } else if (kind === 'flashcard') {
        item = parseFlashcard(fields ?? [], params, line, ctx);
    }

    const hasError = ctx.diagnostics.some(d => d.severity === 'error');
    const ok = !hasError && item !== undefined;
    if (item && ctx.line !== undefined) {
        item.line = ctx.line;
    }
    return { ok, item: ok ? item : undefined, diagnostics: ctx.diagnostics };
}

/**
 * Parse multiple lines of the unified compact activity format.
 *
 * Blank lines, `//` comment lines, and `# ` (hash-space) comment lines are
 * skipped. Diagnostics and successfully parsed items carry their 1-based line
 * number (offset by {@link UnifiedActivityParseOptions.lineOffset}).
 */
export function parseUnifiedActivityLines(
    input: string,
    options: UnifiedActivityParseOptions = {},
): UnifiedActivityParseBatchResult {
    const offset = options.lineOffset ?? 0;
    const rawLines = input.split(/\r?\n/);
    const items: UnifiedActivityItem[] = [];
    const diagnostics: UnifiedActivityDiagnostic[] = [];
    const results: UnifiedActivityParseResult[] = [];
    rawLines.forEach((rawLine, index) => {
        const trimmed = rawLine.trim();
        if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('# ')) {
            return;
        }
        const lineNumber = index + 1 + offset;
        const result = parseUnifiedActivityLine(rawLine, {
            defaultType: options.defaultType,
            strict: options.strict,
            allowUnknownParams: options.allowUnknownParams,
            line: lineNumber,
        });
        results.push(result);
        diagnostics.push(...result.diagnostics);
        if (result.ok && result.item) {
            items.push(result.item);
        }
    });
    return { ok: !diagnostics.some(d => d.severity === 'error'), items, diagnostics, results };
}
