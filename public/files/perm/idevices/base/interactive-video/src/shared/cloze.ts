/**
 * Semantic cloze/dropdown blanks (schema v2).
 *
 * Blanks are authored as PLAIN-TEXT `[[…]]` tokens and stored as an HTML-free
 * `segments` array — `{t:'text', text}` and `{t:'blank', answers[]}`. No
 * line-through markup is ever persisted or shown to the author.
 * `parsePromptText`/`segmentsToPromptText` round-trip the textarea; the
 * DOM-based `htmlPromptToSegments` converts legacy prompts (migration + a
 * read-only runtime fallback), reusing the shared blank definition so
 * `<s>`/`<strike>`/`<del>` and line-through spans all become inputs.
 */

import { collectDropdownBlankNodes, unescapeEntitiesOnce } from './html';
import type { BlankSegment, PromptSegment } from './types';

/**
 * Parse a plain-text prompt into segments, splitting on `[[…]]` tokens. `|`
 * inside a token splits answer variants. Unmatched or empty (`[[]]`) brackets
 * degrade to literal text; nesting is not supported (documented). Never throws.
 */
export function parsePromptText(text: unknown): PromptSegment[] {
    const str = String(text == null ? '' : text);
    const segments: PromptSegment[] = [];
    const re = /\[\[([\s\S]*?)\]\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    function pushText(value: string): void {
        if (value === '') {
            return;
        }
        const last = segments[segments.length - 1];
        if (last && last.t === 'text') {
            last.text += value;
        } else {
            segments.push({ t: 'text', text: value });
        }
    }
    while ((match = re.exec(str)) !== null) {
        const inner = match[1] ?? '';
        // Empty (whitespace-only) token: leave it in the text (degrade).
        if (inner.replace(/\s+/g, '') === '') {
            continue;
        }
        pushText(str.slice(lastIndex, match.index));
        segments.push({ t: 'blank', answers: inner.split('|') });
        lastIndex = re.lastIndex;
    }
    pushText(str.slice(lastIndex));
    return segments;
}

/** Render segments back to the plain-text `[[…]]` token form. */
export function segmentsToPromptText(segments: unknown): string {
    const list = Array.isArray(segments) ? segments : [];
    let out = '';
    for (const seg of list) {
        if (!seg) {
            continue;
        }
        if (seg.t === 'blank') {
            const answers = Array.isArray(seg.answers) ? seg.answers : [];
            out += '[[' + answers.join('|') + ']]';
        } else {
            out += String(seg.text == null ? '' : seg.text);
        }
    }
    return out;
}

/**
 * Walk a parsed DOM node in document order, emitting text/blank segments. A
 * node in `blankNodes` becomes a single blank segment (its trimmed text,
 * `|`-split into variants) and its subtree is skipped; other text is kept with
 * internal whitespace runs collapsed to single spaces. Text segments are
 * merged so the output is minimal.
 */
function buildSegmentsFromDom(node: Node, blankNodes: Element[], out: PromptSegment[]): void {
    const children = node.childNodes;
    function pushText(value: string): void {
        if (value === '') {
            return;
        }
        const last = out[out.length - 1];
        if (last && last.t === 'text') {
            last.text += value;
        } else {
            out.push({ t: 'text', text: value });
        }
    }
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child) {
            continue;
        }
        if (child.nodeType === 3) {
            pushText(String(child.nodeValue == null ? '' : child.nodeValue).replace(/\s+/g, ' '));
        } else if (child.nodeType === 1) {
            if (blankNodes.indexOf(child as Element) > -1) {
                const raw = String(child.textContent == null ? '' : child.textContent)
                    .replace(/\s+/g, ' ')
                    .replace(/^\s+|\s+$/g, '');
                const answers = raw.split('|').map(v => v.replace(/^\s+|\s+$/g, ''));
                out.push({ t: 'blank', answers: answers });
            } else {
                buildSegmentsFromDom(child, blankNodes, out);
            }
        }
    }
}

/**
 * Derive semantic segments from a legacy HTML prompt (DOM-based, never a
 * regex). Line-through blanks (`collectDropdownBlankNodes`) become blank
 * segments; everything else becomes escaped-on-render text. Double-escaped
 * `&lt;span…` prompts are unescaped once and re-parsed. A prompt with no
 * detectable blank collapses to a single lossless text segment. Never throws.
 */
export function htmlPromptToSegments(promptHtml: unknown, depth?: number): PromptSegment[] {
    const str = String(promptHtml == null ? '' : promptHtml);
    if (str === '') {
        return [];
    }
    if (typeof DOMParser === 'undefined') {
        return [{ t: 'text', text: str }];
    }
    try {
        const doc = new DOMParser().parseFromString(str, 'text/html');
        const body: ParentNode = doc.body || doc;
        const blankNodes = collectDropdownBlankNodes(body);
        if (blankNodes.length === 0) {
            // Recover double-escaped markup with a single unescape pass.
            if ((depth || 0) < 4 && /&lt;/.test(str)) {
                const unescaped = unescapeEntitiesOnce(str);
                if (unescaped !== str) {
                    return htmlPromptToSegments(unescaped, (depth || 0) + 1);
                }
            }
            const text = String(body.textContent == null ? '' : body.textContent).replace(/\s+/g, ' ');
            return text === '' ? [] : [{ t: 'text', text: text }];
        }
        const segments: PromptSegment[] = [];
        buildSegmentsFromDom(body as Node, blankNodes, segments);
        return segments;
    } catch {
        return [{ t: 'text', text: str }];
    }
}

/** The blank segments of a segments array, in order ([] for non-arrays). */
export function segmentBlanks(segments: unknown): BlankSegment[] {
    const list = Array.isArray(segments) ? segments : [];
    const out: BlankSegment[] = [];
    for (const seg of list) {
        if (seg && seg.t === 'blank') {
            out.push(seg);
        }
    }
    return out;
}

/** Cloze correct answers from segments: each blank's variants joined by `|`. */
export function clozeAnswersFromSegments(segments: unknown): string[] {
    return segmentBlanks(segments).map(blank => {
        const answers = Array.isArray(blank.answers) ? blank.answers : [];
        return answers.join('|');
    });
}

/** Dropdown correct words from segments: the first variant of each blank. */
export function dropdownWordsFromSegments(segments: unknown): string[] {
    return segmentBlanks(segments).map(blank => {
        const answers = Array.isArray(blank.answers) ? blank.answers : [];
        return answers.length ? String(answers[0] == null ? '' : answers[0]) : '';
    });
}

/** De-duplicated, trimmed option pool: correct words first, then distractors. */
export function dropdownOptions(blanks: unknown, additionalWords: unknown): string[] {
    const pool: string[] = [];
    // Null prototype so an option named like an Object member ("constructor")
    // cannot collide with an inherited key.
    const seen: Record<string, true> = Object.create(null);
    function add(word: unknown): void {
        const value = typeof word === 'string' ? word.replace(/^\s+|\s+$/g, '') : '';
        if (value === '' || value in seen) {
            return;
        }
        seen[value] = true;
        pool.push(value);
    }
    if (Array.isArray(blanks)) {
        for (const blank of blanks) {
            add(blank);
        }
    }
    if (Array.isArray(additionalWords)) {
        for (const word of additionalWords) {
            add(word);
        }
    }
    return pool;
}

/**
 * Normalize a cloze answer for comparison: collapse internal whitespace to a
 * single space, trim the ends, and lower-case. Makes matching forgiving of
 * spacing and capitalization (the legacy line-through blank was compared
 * exactly; this is the deliberate, documented relaxation).
 */
export function normalizeClozeAnswer(value: unknown): string {
    return String(value == null ? '' : value)
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}
